"""Multi-level 2-D Haar wavelet transform in matrix form (Mallat decomposition)."""

from functools import cache

import numpy as np

from .transform import FloatArray, IntArray, require_alignment

DEFAULT_LEVELS = 5


@cache
def haar_matrix(size: int) -> FloatArray:
    """One orthonormal analysis step.

    Rows 0..N/2-1 are the low-pass filter (x[2i] + x[2i+1]) / √2,
    rows N/2..N-1 are the high-pass filter (x[2i] - x[2i+1]) / √2.
    """
    if size < 2 or size % 2:
        raise ValueError(f"Haar matrix size must be even and positive, got {size}")
    half = size // 2
    pairs = np.arange(half)
    scale = 1 / np.sqrt(2)
    matrix = np.zeros((size, size))
    matrix[pairs, 2 * pairs] = matrix[pairs, 2 * pairs + 1] = scale
    matrix[half + pairs, 2 * pairs] = scale
    matrix[half + pairs, 2 * pairs + 1] = -scale
    matrix.setflags(write=False)
    return matrix


def max_levels(shape: tuple[int, int]) -> int:
    return int(np.log2(min(shape)))


class HaarDWT:
    """Each level transforms the current approximation (top-left) region: A ← H_r·A·H_cᵀ.

    The result uses the standard pyramid layout: the approximation in the top-left corner,
    detail subbands of coarser levels closer to it.
    """

    def __init__(self, levels: int = DEFAULT_LEVELS) -> None:
        if levels < 1:
            raise ValueError(f"At least one decomposition level is required, got {levels}")
        self.levels = levels
        self.name = "DWT"

    @property
    def alignment(self) -> int:
        return 2**self.levels

    def _region_sizes(self, shape: tuple[int, int]) -> list[tuple[int, int]]:
        rows, cols = shape
        return [(rows >> level, cols >> level) for level in range(self.levels)]

    def forward(self, image: FloatArray) -> FloatArray:
        require_alignment(image.shape, self.alignment)
        coefficients = image.astype(np.float64, copy=True)
        for rows, cols in self._region_sizes(image.shape):
            region = coefficients[:rows, :cols]
            coefficients[:rows, :cols] = haar_matrix(rows) @ region @ haar_matrix(cols).T
        return coefficients

    def inverse(self, coefficients: FloatArray) -> FloatArray:
        require_alignment(coefficients.shape, self.alignment)
        image = coefficients.astype(np.float64, copy=True)
        for rows, cols in reversed(self._region_sizes(coefficients.shape)):
            region = image[:rows, :cols]
            image[:rows, :cols] = haar_matrix(rows).T @ region @ haar_matrix(cols)
        return image

    def frequency_rank(self, shape: tuple[int, int]) -> IntArray:
        """0 for the approximation, then three detail subbands per level from the coarsest to the finest."""
        require_alignment(shape, self.alignment)
        rank = np.empty(shape, dtype=np.int64)
        for level, (rows, cols) in enumerate(self._region_sizes(shape), start=1):
            half_rows, half_cols = rows // 2, cols // 2
            base = 3 * (self.levels - level) + 1
            rank[:half_rows, half_cols:cols] = base
            rank[half_rows:rows, :half_cols] = base + 1
            rank[half_rows:rows, half_cols:cols] = base + 2
        rows, cols = shape
        rank[: rows >> self.levels, : cols >> self.levels] = 0
        return rank
