from typing import Protocol

import numpy as np
from numpy.typing import NDArray

FloatArray = NDArray[np.float64]
IntArray = NDArray[np.int64]


class Transform(Protocol):
    """Orthonormal 2-D transform applied to the whole image."""

    name: str

    @property
    def alignment(self) -> int:
        """Both image dimensions must be multiples of this value."""
        ...

    def forward(self, image: FloatArray) -> FloatArray: ...

    def inverse(self, coefficients: FloatArray) -> FloatArray: ...

    def frequency_rank(self, shape: tuple[int, int]) -> IntArray:
        """Frequency class of every coefficient: 0 is the lowest (DC / approximation)."""
        ...


def require_alignment(shape: tuple[int, ...], alignment: int) -> None:
    if len(shape) != 2:
        raise ValueError(f"Expected a 2-D array, got shape {shape}")
    if any(size % alignment for size in shape):
        raise ValueError(f"Image dimensions {shape} must be multiples of {alignment}")
