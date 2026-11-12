"""User-facing description of every reduction method: its parameter, range and experiment levels."""

from collections.abc import Callable
from dataclasses import dataclass

import numpy as np

from .reduction import HardThreshold, KeepLargest, LowPassZonal, Reducer, UniformQuantization


@dataclass(frozen=True)
class StrategySpec:
    key: str
    title: str
    parameter: str
    unit: str
    build: Callable[[float], Reducer]
    minimum: float
    maximum: float
    default: float
    levels: tuple[float, ...]
    """Experiment levels, from the mildest to the strongest compression."""
    log_scale: bool = False

    def format(self, value: float) -> str:
        return f"{value:.3g}{self.unit}"

    def label(self, value: float) -> str:
        return f"{self.parameter} = {self.format(value)}"

    def sweep(self, points: int) -> np.ndarray:
        space = np.geomspace if self.log_scale else np.linspace
        return space(self.minimum, self.maximum, points)


STRATEGIES: dict[str, StrategySpec] = {
    spec.key: spec
    for spec in (
        StrategySpec(
            key="largest",
            title="Keep largest coefficients",
            parameter="kept",
            unit="%",
            build=lambda percent: KeepLargest(percent / 100),
            minimum=0.1,
            maximum=100,
            default=5,
            levels=(20, 10, 5, 2, 1),
            log_scale=True,
        ),
        StrategySpec(
            key="threshold",
            title="Hard threshold",
            parameter="T",
            unit="",
            build=HardThreshold,
            minimum=1,
            maximum=300,
            default=40,
            levels=(10, 25, 50, 100),
            log_scale=True,
        ),
        StrategySpec(
            key="quantization",
            title="Uniform quantization",
            parameter="step",
            unit="",
            build=UniformQuantization,
            minimum=1,
            maximum=300,
            default=40,
            levels=(10, 25, 50, 100),
            log_scale=True,
        ),
        StrategySpec(
            key="zonal",
            title="Low-pass (zonal) mask",
            parameter="low-frequency share",
            unit="%",
            build=lambda percent: LowPassZonal(percent / 100),
            minimum=1,
            maximum=100,
            default=10,
            levels=(25, 10, 5, 2),
            log_scale=True,
        ),
    )
}

DEFAULT_STRATEGY = "largest"
