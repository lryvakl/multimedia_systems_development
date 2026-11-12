"""Ways to reduce the number of significant coefficients.

Every reducer selects coefficients to keep and maps them to integer symbols with a uniform
quantization step (1 for pure selection methods), which is what an encoder would store.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from .transform import FloatArray, IntArray

BoolArray = NDArray[np.bool_]


@dataclass(frozen=True)
class QuantizedCoefficients:
    symbols: IntArray
    step: float

    def dequantize(self) -> FloatArray:
        return self.symbols * self.step

    @property
    def nonzero(self) -> int:
        return int(np.count_nonzero(self.symbols))


class Reducer(ABC):
    @property
    def quantization_step(self) -> float:
        return 1.0

    @abstractmethod
    def select(self, coefficients: FloatArray, rank: IntArray) -> BoolArray:
        """Mask of coefficients that are kept."""

    def reduce(self, coefficients: FloatArray, rank: IntArray) -> QuantizedCoefficients:
        kept = np.where(self.select(coefficients, rank), coefficients, 0.0)
        symbols = np.rint(kept / self.quantization_step).astype(np.int64)
        return QuantizedCoefficients(symbols, self.quantization_step)


def _require_fraction(fraction: float) -> None:
    if not 0 < fraction <= 1:
        raise ValueError(f"Fraction must be in (0, 1], got {fraction}")


@dataclass(frozen=True)
class KeepLargest(Reducer):
    """Keeps the given fraction of coefficients with the largest magnitude over the whole image."""

    fraction: float

    def __post_init__(self) -> None:
        _require_fraction(self.fraction)

    def select(self, coefficients: FloatArray, rank: IntArray) -> BoolArray:
        magnitudes = np.abs(coefficients).ravel()
        count = max(1, round(self.fraction * magnitudes.size))
        largest = np.argpartition(magnitudes, magnitudes.size - count)[magnitudes.size - count :]
        mask = np.zeros(magnitudes.size, dtype=bool)
        mask[largest] = True
        return mask.reshape(coefficients.shape)


@dataclass(frozen=True)
class HardThreshold(Reducer):
    """Zeroes every coefficient whose magnitude is below the threshold."""

    threshold: float

    def __post_init__(self) -> None:
        if self.threshold < 0:
            raise ValueError(f"Threshold must be non-negative, got {self.threshold}")

    def select(self, coefficients: FloatArray, rank: IntArray) -> BoolArray:
        return np.abs(coefficients) >= self.threshold


@dataclass(frozen=True)
class UniformQuantization(Reducer):
    """Rounds every coefficient to the nearest multiple of the step; small ones become zero."""

    step: float

    def __post_init__(self) -> None:
        if self.step <= 0:
            raise ValueError(f"Quantization step must be positive, got {self.step}")

    @property
    def quantization_step(self) -> float:
        return self.step

    def select(self, coefficients: FloatArray, rank: IntArray) -> BoolArray:
        return np.ones(coefficients.shape, dtype=bool)


@dataclass(frozen=True)
class LowPassZonal(Reducer):
    """Keeps whole low-frequency classes (zig-zag positions / wavelet subbands) up to the fraction.

    The approximation class (DC / LL) is always kept, so the kept share can be below the fraction.
    """

    fraction: float

    def __post_init__(self) -> None:
        _require_fraction(self.fraction)

    def select(self, coefficients: FloatArray, rank: IntArray) -> BoolArray:
        class_sizes = np.cumsum(np.bincount(rank.ravel()))
        classes = max(1, int(np.searchsorted(class_sizes, self.fraction * rank.size, side="right")))
        return rank < classes
