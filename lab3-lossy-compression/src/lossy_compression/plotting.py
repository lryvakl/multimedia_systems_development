"""Report figures. Uses the object-oriented Figure API, so no GUI backend is required."""

from collections.abc import Callable, Sequence
from pathlib import Path

import numpy as np
from matplotlib.axes import Axes
from matplotlib.figure import Figure

from .codec import Comparison, CompressionResult
from .experiments import LevelResult
from .image_io import GrayImage
from .strategies import StrategySpec

METHOD_COLORS = {"DCT": "#d1495b", "DWT": "#00798c"}
ERROR_LIMIT = 40
DPI = 110


def show_gray(axes: Axes, image: np.ndarray, title: str) -> None:
    axes.imshow(image, cmap="gray", vmin=0, vmax=255, interpolation="nearest")
    axes.set_title(title, fontsize=9)
    axes.set_axis_off()


def describe(result: CompressionResult) -> str:
    return f"{result.method}: PSNR {result.psnr:.2f} dB\nkept {100 * result.rate.kept_fraction:.2f}%"


def error_map(original: GrayImage, reconstruction: GrayImage) -> np.ndarray:
    return np.abs(original.astype(np.int16) - reconstruction.astype(np.int16))


def comparison_grid(spec: StrategySpec, levels: Sequence[LevelResult]) -> Figure:
    """One row per compression level: Original | DCT | DWT."""
    figure = Figure(figsize=(9, 3.1 * len(levels)), layout="constrained")
    figure.suptitle(spec.title)
    for row, level in zip(figure.subplots(len(levels), 3, squeeze=False), levels, strict=True):
        comparison = level.comparison
        show_gray(row[0], comparison.original, f"Original\n{spec.label(level.value)}")
        for axes, result in zip(row[1:], comparison.results, strict=True):
            show_gray(axes, result.reconstruction, describe(result))
    return figure


def most_detailed_region(image: GrayImage, size: int = 128, stride: int = 32) -> tuple[slice, slice]:
    """The window with the highest variance: compression artifacts are most visible there."""
    rows, cols = image.shape
    size = min(size, rows, cols)
    candidates = (
        (image[top : top + size, left : left + size].var(), top, left)
        for top in range(0, rows - size + 1, stride)
        for left in range(0, cols - size + 1, stride)
    )
    _, top, left = max(candidates)
    return slice(top, top + size), slice(left, left + size)


def detail_figure(comparison: Comparison, caption: str) -> Figure:
    """Zoomed crops and absolute error maps on a shared scale."""
    region = most_detailed_region(comparison.original)
    figure = Figure(figsize=(9, 6.4), layout="constrained")
    figure.suptitle(f"Detail view and |error| (0–{ERROR_LIMIT}), {caption}")
    crops, errors = figure.subplots(2, 3)
    show_gray(crops[0], comparison.original[region], "Original")
    errors[0].set_axis_off()
    for crop_axes, error_axes, result in zip(crops[1:], errors[1:], comparison.results, strict=True):
        show_gray(crop_axes, result.reconstruction[region], describe(result))
        mapped = error_axes.imshow(
            error_map(comparison.original, result.reconstruction)[region],
            cmap="magma",
            vmin=0,
            vmax=ERROR_LIMIT,
            interpolation="nearest",
        )
        error_axes.set_title(f"{result.method} |error|", fontsize=9)
        error_axes.set_axis_off()
    figure.colorbar(mapped, ax=errors[1:], location="right", shrink=0.9)
    return figure


def _plot_methods(
    axes: Axes, levels: Sequence[LevelResult], x_of: Callable[[CompressionResult], float]
) -> None:
    for index, method in enumerate(METHOD_COLORS):
        results = [level.comparison.results[index] for level in levels]
        x, y = zip(*sorted((x_of(result), result.psnr) for result in results), strict=True)
        axes.plot(x, y, marker=".", color=METHOD_COLORS[method], label=method)
    axes.set_ylabel("PSNR, dB")
    axes.grid(alpha=0.3)
    axes.legend()


def rate_distortion_figure(
    largest: Sequence[LevelResult],
    quantization: Sequence[LevelResult],
    depth: Sequence[tuple[int, Comparison]],
    depth_caption: str,
) -> Figure:
    figure = Figure(figsize=(14, 4.2), layout="constrained")
    by_fraction, by_rate, by_depth = figure.subplots(1, 3)

    _plot_methods(by_fraction, largest, lambda result: 100 * result.rate.kept_fraction)
    by_fraction.set(xscale="log", xlabel="Kept coefficients, %", title="Quality vs. kept coefficients")

    _plot_methods(by_rate, quantization, lambda result: result.rate.bits_per_pixel)
    by_rate.set(xlabel="Entropy, bits per pixel", title="Rate–distortion (uniform quantization)")

    levels, comparisons = zip(*depth, strict=True)
    dwt_psnr = [comparison.dwt.psnr for comparison in comparisons]
    by_depth.plot(levels, dwt_psnr, marker="o", color=METHOD_COLORS["DWT"], label="DWT")
    by_depth.axhline(comparisons[0].dct.psnr, color=METHOD_COLORS["DCT"], linestyle="--", label="DCT 8×8")
    by_depth.set(
        xlabel="Haar decomposition levels", ylabel="PSNR, dB", title=f"Wavelet depth, {depth_caption}"
    )
    by_depth.grid(alpha=0.3)
    by_depth.legend()
    return figure


def save(figure: Figure, path: Path) -> None:
    figure.savefig(path, dpi=DPI)
