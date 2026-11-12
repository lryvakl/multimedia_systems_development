"""Quality (PSNR) and rate estimates for compressed coefficients."""

import zlib
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from .transform import IntArray

PEAK_VALUE = 255.0
BITS_PER_PIXEL = 8


def mse(original: NDArray, reconstructed: NDArray) -> float:
    if original.shape != reconstructed.shape:
        raise ValueError(f"Shape mismatch: {original.shape} vs {reconstructed.shape}")
    difference = original.astype(np.float64) - reconstructed.astype(np.float64)
    return float(np.mean(difference**2))


def psnr(original: NDArray, reconstructed: NDArray, peak: float = PEAK_VALUE) -> float:
    """PSNR = 10·log10(peak² / MSE), in dB; infinite for identical images."""
    error = mse(original, reconstructed)
    return float("inf") if error == 0 else float(10 * np.log10(peak**2 / error))


def shannon_entropy(symbols: IntArray) -> float:
    """Zero-order entropy in bits per symbol: a lower bound for an ideal entropy coder."""
    _, counts = np.unique(symbols, return_counts=True)
    probabilities = counts / counts.sum()
    return max(0.0, float(-(probabilities * np.log2(probabilities)).sum()))


def deflate_size(symbols: IntArray) -> int:
    """Bytes produced by zlib (level 9) for the symbols stored as the narrowest integer type."""
    dtype = np.int16 if np.abs(symbols).max(initial=0) <= np.iinfo(np.int16).max else np.int32
    return len(zlib.compress(symbols.astype(dtype).tobytes(), level=9))


@dataclass(frozen=True)
class RateEstimate:
    """Three different answers to "how much was the image compressed".

    - kept_fraction: share of nonzero coefficients (says nothing about how they are stored);
    - entropy: ideal entropy coding of the quantized symbols (zero-order model);
    - deflate: real size of the symbols serialized in frequency order and packed by zlib.
    """

    pixels: int
    coefficients: int
    nonzero: int
    entropy_bits: float
    deflate_bytes: int

    @property
    def kept_fraction(self) -> float:
        return self.nonzero / self.coefficients

    @property
    def coefficient_ratio(self) -> float:
        return self.coefficients / max(1, self.nonzero)

    @property
    def bits_per_pixel(self) -> float:
        return self.entropy_bits / self.pixels

    @property
    def entropy_ratio(self) -> float:
        return BITS_PER_PIXEL / max(self.bits_per_pixel, 1e-12)

    @property
    def deflate_ratio(self) -> float:
        return self.pixels * BITS_PER_PIXEL / 8 / self.deflate_bytes


def estimate_rate(symbols: IntArray, rank: IntArray, pixels: int) -> RateEstimate:
    serialized = symbols.ravel()[np.argsort(rank.ravel(), kind="stable")]
    return RateEstimate(
        pixels=pixels,
        coefficients=symbols.size,
        nonzero=int(np.count_nonzero(symbols)),
        entropy_bits=shannon_entropy(symbols) * symbols.size,
        deflate_bytes=deflate_size(serialized),
    )
