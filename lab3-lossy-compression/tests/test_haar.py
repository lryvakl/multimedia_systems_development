import numpy as np
import pytest

from lossy_compression.dct import BlockDCT
from lossy_compression.haar import HaarDWT, haar_matrix, max_levels


@pytest.mark.parametrize("size", [2, 8, 64])
def test_haar_matrix_is_orthonormal(size: int) -> None:
    matrix = haar_matrix(size)
    np.testing.assert_allclose(matrix @ matrix.T, np.eye(size), atol=1e-12)


def test_haar_matrix_rejects_odd_size() -> None:
    with pytest.raises(ValueError):
        haar_matrix(5)


def test_single_level_on_2x2_block() -> None:
    a, b, c, d = 10.0, 20.0, 30.0, 60.0
    coefficients = HaarDWT(levels=1).forward(np.array([[a, b], [c, d]]))
    expected = np.array([[a + b + c + d, a - b + c - d], [a + b - c - d, a - b - c + d]]) / 2
    np.testing.assert_allclose(coefficients, expected)


def test_one_dimensional_step_gives_averages_and_differences() -> None:
    signal = np.array([4.0, 2.0, 5.0, 5.0])
    np.testing.assert_allclose(haar_matrix(4) @ signal, np.array([6, 10, 2, 0]) / np.sqrt(2))


@pytest.mark.parametrize("levels", [1, 2, 3, 6])
def test_inverse_restores_image(image: np.ndarray, levels: int) -> None:
    transform = HaarDWT(levels)
    restored = transform.inverse(transform.forward(image.astype(float)))
    np.testing.assert_allclose(restored, image, atol=1e-9)


@pytest.mark.parametrize("levels", [1, 3, 6])
def test_energy_is_preserved(image: np.ndarray, levels: int) -> None:
    pixels = image.astype(float)
    assert np.sum(HaarDWT(levels).forward(pixels) ** 2) == pytest.approx(np.sum(pixels**2))


def test_constant_image_has_only_approximation() -> None:
    coefficients = HaarDWT(levels=3).forward(np.full((16, 16), 50.0))
    np.testing.assert_allclose(coefficients[:2, :2], np.full((2, 2), 50.0 * 2**3))
    coefficients[:2, :2] = 0
    np.testing.assert_allclose(coefficients, 0, atol=1e-9)


def test_three_level_approximation_equals_dct_dc(image: np.ndarray) -> None:
    """Both are 8 × the mean of an 8×8 block, which explains equal results at very low budgets."""
    dc = BlockDCT().forward(image.astype(float))[::8, ::8]
    approximation = HaarDWT(levels=3).forward(image.astype(float))[:8, :8]
    np.testing.assert_allclose(approximation, dc, atol=1e-9)


def test_frequency_rank_layout() -> None:
    rank = HaarDWT(levels=2).frequency_rank((8, 8))
    assert np.all(rank[:2, :2] == 0)
    assert (rank[0, 2], rank[2, 0], rank[2, 2]) == (1, 2, 3)
    assert (rank[1, 3], rank[3, 1], rank[3, 3]) == (1, 2, 3)
    assert (rank[0, 4], rank[4, 0], rank[7, 7]) == (4, 5, 6)
    assert np.bincount(rank.ravel()).tolist() == [4, 4, 4, 4, 16, 16, 16]


def test_max_levels() -> None:
    assert max_levels((512, 256)) == 8


def test_rejects_invalid_configuration() -> None:
    with pytest.raises(ValueError):
        HaarDWT(levels=0)
    with pytest.raises(ValueError, match="multiples of 8"):
        HaarDWT(levels=3).forward(np.zeros((12, 16)))
