"""Block 2-D DCT-II in matrix form: Y = C·X·Cᵀ for every block, X = Cᵀ·Y·C back."""

from functools import cache

import numpy as np

from .transform import FloatArray, IntArray, require_alignment

BLOCK_SIZE = 8


@cache
def dct_matrix(size: int = BLOCK_SIZE) -> FloatArray:
    """Orthonormal DCT-II matrix: C[k, n] = α(k)·cos((2n + 1)·k·π / 2N)."""
    k = np.arange(size)[:, np.newaxis]
    n = np.arange(size)[np.newaxis, :]
    matrix = np.sqrt(2 / size) * np.cos((2 * n + 1) * k * np.pi / (2 * size))
    matrix[0] /= np.sqrt(2)
    matrix.setflags(write=False)
    return matrix


@cache
def zigzag_order(size: int = BLOCK_SIZE) -> IntArray:
    """JPEG zig-zag index of every position in a block (0 = DC, size² - 1 = highest frequency)."""
    positions = sorted(
        ((row, col) for row in range(size) for col in range(size)),
        key=lambda p: (p[0] + p[1], p[0] if (p[0] + p[1]) % 2 else p[1]),
    )
    order = np.empty((size, size), dtype=np.int64)
    for index, position in enumerate(positions):
        order[position] = index
    order.setflags(write=False)
    return order


def split_blocks(image: FloatArray, size: int) -> FloatArray:
    """(H, W) → (H/size, W/size, size, size)."""
    rows, cols = image.shape
    return image.reshape(rows // size, size, cols // size, size).swapaxes(1, 2)


def merge_blocks(blocks: FloatArray) -> FloatArray:
    """(H/size, W/size, size, size) → (H, W)."""
    block_rows, block_cols, size, _ = blocks.shape
    return blocks.swapaxes(1, 2).reshape(block_rows * size, block_cols * size)


class BlockDCT:
    """DCT-II on non-overlapping blocks; coefficients keep the spatial block layout."""

    def __init__(self, block_size: int = BLOCK_SIZE) -> None:
        self.block_size = block_size
        self.name = "DCT"
        self._matrix = dct_matrix(block_size)

    @property
    def alignment(self) -> int:
        return self.block_size

    def forward(self, image: FloatArray) -> FloatArray:
        require_alignment(image.shape, self.alignment)
        blocks = split_blocks(image, self.block_size)
        return merge_blocks(self._matrix @ blocks @ self._matrix.T)

    def inverse(self, coefficients: FloatArray) -> FloatArray:
        require_alignment(coefficients.shape, self.alignment)
        blocks = split_blocks(coefficients, self.block_size)
        return merge_blocks(self._matrix.T @ blocks @ self._matrix)

    def frequency_rank(self, shape: tuple[int, int]) -> IntArray:
        require_alignment(shape, self.alignment)
        rows, cols = shape
        return np.tile(zigzag_order(self.block_size), (rows // self.block_size, cols // self.block_size))
