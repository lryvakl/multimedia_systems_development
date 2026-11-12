import numpy as np
import pytest

from lossy_compression.dct import BlockDCT, dct_matrix, zigzag_order


def naive_dct_2d(block: np.ndarray) -> np.ndarray:
    """DCT-II straight from the definition, as an independent reference."""
    size = block.shape[0]
    alpha = [np.sqrt(1 / size)] + [np.sqrt(2 / size)] * (size - 1)
    result = np.zeros_like(block, dtype=float)
    for u in range(size):
        for v in range(size):
            total = sum(
                block[x, y]
                * np.cos((2 * x + 1) * u * np.pi / (2 * size))
                * np.cos((2 * y + 1) * v * np.pi / (2 * size))
                for x in range(size)
                for y in range(size)
            )
            result[u, v] = alpha[u] * alpha[v] * total
    return result


@pytest.mark.parametrize("size", [4, 8, 16])
def test_dct_matrix_is_orthonormal(size: int) -> None:
    matrix = dct_matrix(size)
    np.testing.assert_allclose(matrix @ matrix.T, np.eye(size), atol=1e-12)


def test_first_basis_vector_is_constant() -> None:
    np.testing.assert_allclose(dct_matrix(8)[0], np.full(8, 1 / np.sqrt(8)))


def test_matrix_form_matches_definition(rng: np.random.Generator) -> None:
    block = rng.uniform(0, 255, (8, 8))
    np.testing.assert_allclose(BlockDCT().forward(block), naive_dct_2d(block), atol=1e-9)


def test_blocks_are_transformed_independently(rng: np.random.Generator) -> None:
    image = rng.uniform(0, 255, (16, 24))
    coefficients = BlockDCT().forward(image)
    block = image[8:16, 16:24]
    np.testing.assert_allclose(coefficients[8:16, 16:24], naive_dct_2d(block), atol=1e-9)


def test_constant_block_has_only_dc() -> None:
    coefficients = BlockDCT().forward(np.full((8, 8), 100.0))
    assert coefficients[0, 0] == pytest.approx(800)
    assert np.count_nonzero(np.abs(coefficients) > 1e-9) == 1


def test_inverse_restores_image(image: np.ndarray) -> None:
    transform = BlockDCT()
    restored = transform.inverse(transform.forward(image.astype(float)))
    np.testing.assert_allclose(restored, image, atol=1e-9)


def test_energy_is_preserved(image: np.ndarray) -> None:
    pixels = image.astype(float)
    assert np.sum(BlockDCT().forward(pixels) ** 2) == pytest.approx(np.sum(pixels**2))


def test_zigzag_follows_jpeg_order() -> None:
    order = zigzag_order(8)
    first = [tuple(np.argwhere(order == index)[0]) for index in range(6)]
    assert first == [(0, 0), (0, 1), (1, 0), (2, 0), (1, 1), (0, 2)]
    assert order[7, 7] == 63
    assert sorted(order.ravel()) == list(range(64))


def test_rejects_unaligned_image() -> None:
    with pytest.raises(ValueError, match="multiples of 8"):
        BlockDCT().forward(np.zeros((10, 16)))
