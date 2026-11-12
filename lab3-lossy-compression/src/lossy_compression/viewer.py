"""Interactive side-by-side comparison: Original | DCT | DWT with live PSNR."""

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.widgets import Button, CheckButtons, RadioButtons, Slider

from .codec import Comparison, compare
from .haar import DEFAULT_LEVELS, max_levels
from .image_io import GrayImage, save_grayscale
from .plotting import ERROR_LIMIT, error_map
from .strategies import DEFAULT_STRATEGY, STRATEGIES

MAX_DWT_LEVELS = 8


class ComparisonViewer:
    def __init__(
        self, image: GrayImage, name: str, dwt_levels: int = DEFAULT_LEVELS, export_dir: Path = Path(".")
    ) -> None:
        self.image = image
        self.name = name
        self.export_dir = export_dir
        self.spec = STRATEGIES[DEFAULT_STRATEGY]
        self.value = self.spec.default
        self.dwt_levels = dwt_levels
        self.show_error = False
        self.comparison: Comparison | None = None

        self.figure = plt.figure(figsize=(15, 7.6))
        self.figure.canvas.manager.set_window_title(f"Lossy compression — {name}")
        self.figure.subplots_adjust(left=0.02, right=0.98, top=0.9, bottom=0.27, wspace=0.04)
        self.image_axes = self.figure.subplots(1, 3, sharex=True, sharey=True)
        self.panels = [axes.imshow(image, cmap="gray", vmin=0, vmax=255) for axes in self.image_axes]
        for axes in self.image_axes:
            axes.set_xticks([])
            axes.set_yticks([])
        self.image_axes[0].set_title(f"Original\n{name} · {image.shape[1]}×{image.shape[0]}", fontsize=10)

        self.strategy_picker = RadioButtons(
            self.figure.add_axes((0.02, 0.03, 0.2, 0.17)),
            [spec.title for spec in STRATEGIES.values()],
            active=list(STRATEGIES).index(DEFAULT_STRATEGY),
        )
        self.strategy_picker.on_clicked(self._on_strategy)
        self.parameter_axes = self.figure.add_axes((0.33, 0.14, 0.42, 0.04))
        self.parameter_slider = self._create_parameter_slider()
        self.levels_slider = Slider(
            self.figure.add_axes((0.33, 0.06, 0.42, 0.04)),
            "Haar levels",
            1,
            min(MAX_DWT_LEVELS, max_levels(image.shape)),
            valinit=dwt_levels,
            valstep=1,
        )
        self.levels_slider.on_changed(self._on_levels)
        self.error_toggle = CheckButtons(self.figure.add_axes((0.82, 0.11, 0.15, 0.07)), ["Show |error|"])
        self.error_toggle.on_clicked(self._on_error_toggle)
        self.save_button = Button(self.figure.add_axes((0.82, 0.04, 0.15, 0.05)), "Save results")
        self.save_button.on_clicked(self._on_save)
        self.update()

    def _create_parameter_slider(self) -> Slider:
        spec = self.spec
        self.parameter_axes.clear()
        scale = np.log10 if spec.log_scale else float
        slider = Slider(
            self.parameter_axes,
            spec.parameter.capitalize(),
            scale(spec.minimum),
            scale(spec.maximum),
            valinit=scale(self.value),
        )
        slider.on_changed(self._on_parameter)
        slider.valtext.set_text(spec.format(self.value))
        return slider

    def _on_strategy(self, title: str) -> None:
        self.spec = next(spec for spec in STRATEGIES.values() if spec.title == title)
        self.value = self.spec.default
        self.parameter_slider = self._create_parameter_slider()
        self.update()

    def _on_parameter(self, position: float) -> None:
        self.value = 10**position if self.spec.log_scale else position
        self.parameter_slider.valtext.set_text(self.spec.format(self.value))
        self.update()

    def _on_levels(self, levels: float) -> None:
        self.dwt_levels = int(levels)
        self.update()

    def _on_error_toggle(self, _label: str) -> None:
        self.show_error = not self.show_error
        self.render()

    def _on_save(self, _event) -> None:
        self.export_dir.mkdir(parents=True, exist_ok=True)
        stem = f"{self.name}_{self.spec.key}_{self.spec.format(self.value).rstrip('%')}"
        for result in self.comparison.results:
            save_grayscale(result.reconstruction, self.export_dir / f"{stem}_{result.method.lower()}.png")
        self.figure.savefig(self.export_dir / f"{stem}_comparison.png", dpi=110)
        print(f"Saved to {self.export_dir.resolve()}/{stem}_*.png")

    def show(self) -> None:
        plt.show()

    def update(self) -> None:
        self.comparison = compare(self.image, self.spec.build(self.value), self.dwt_levels)
        self.render()

    def render(self) -> None:
        comparison = self.comparison
        mode = f" — absolute error, dark 0 … bright {ERROR_LIMIT}+" if self.show_error else ""
        self.figure.suptitle(f"{self.spec.title}: {self.spec.label(self.value)}{mode}", fontsize=13)
        for panel, axes, result in zip(self.panels[1:], self.image_axes[1:], comparison.results, strict=True):
            if self.show_error:
                panel.set_data(error_map(comparison.original, result.reconstruction))
                panel.set(cmap="magma", clim=(0, ERROR_LIMIT))
            else:
                panel.set_data(result.reconstruction)
                panel.set(cmap="gray", clim=(0, 255))
            method = "DCT 8×8" if result.method == "DCT" else f"Haar DWT, {self.dwt_levels} levels"
            rate = result.rate
            axes.set_title(
                f"{method}\nPSNR {result.psnr:.2f} dB · kept {100 * rate.kept_fraction:.2f}% "
                f"· {rate.bits_per_pixel:.2f} bpp · CR {rate.deflate_ratio:.1f}:1",
                fontsize=10,
            )
        self.figure.canvas.draw_idle()
