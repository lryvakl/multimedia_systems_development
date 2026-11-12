import numpy as np
import pytest

from lossy_compression.codec import compare, compress
from lossy_compression.dct import BlockDCT
from lossy_compression.haar import HaarDWT
from lossy_compression.metrics import estimate_rate, mse, psnr, shannon_entropy
from lossy_compression.reduction import KeepLargest, UniformQuantization


def test_psnr_of_identical_images_is_infinite(image: np.ndarray) -> None:
    assert psnr(image, image) == float("inf")


def test_psnr_matches_formula() -> None:
    original = np.zeros((4, 4), dtype=np.uint8)
    noisy = np.full((4, 4), 5, dtype=np.uint8)
    assert mse(original, noisy) == 25
    assert psnr(original, noisy) == pytest.approx(10 * np.log10(255**2 / 25))


def test_psnr_does_not_overflow_on_uint8() -> None:
    assert mse(np.array([0], dtype=np.uint8), np.array([255], dtype=np.uint8)) == 255**2


def test_entropy() -> None:
    assert shannon_entropy(np.zeros(16, dtype=np.int64)) == 0
    assert shannon_entropy(np.arange(8)) == pytest.approx(3)


def test_rate_estimate_ratios() -> None:
    symbols = np.zeros((8, 8), dtype=np.int64)
    symbols[0, :4] = 1
    rate = estimate_rate(symbols, np.zeros((8, 8), dtype=np.int64), pixels=64)
    assert rate.kept_fraction == pytest.approx(4 / 64)
    assert rate.coefficient_ratio == pytest.approx(16)
    assert rate.bits_per_pixel == pytest.approx(shannon_entropy(symbols))
    assert rate.entropy_ratio == pytest.approx(8 / rate.bits_per_pixel)


@pytest.mark.parametrize("transform", [BlockDCT(), HaarDWT(3)], ids=["dct", "dwt"])
def test_keeping_everything_is_near_lossless(image: np.ndarray, transform) -> None:
    result = compress(image, transform, KeepLargest(1.0))
    assert result.psnr > 50
    assert result.reconstruction.dtype == np.uint8


@pytest.mark.parametrize("transform", [BlockDCT(), HaarDWT(3)], ids=["dct", "dwt"])
def test_quality_drops_with_stronger_compression(image: np.ndarray, transform) -> None:
    results = [compress(image, transform, UniformQuantization(step)) for step in (4, 16, 64)]
    assert results[0].psnr > results[1].psnr > results[2].psnr
    assert results[0].rate.bits_per_pixel > results[1].rate.bits_per_pixel > results[2].rate.bits_per_pixel


def test_unaligned_image_is_padded_and_cropped_back(rng: np.random.Generator) -> None:
    image = rng.integers(0, 256, (50, 37), dtype=np.uint8)
    comparison = compare(image, KeepLargest(0.3), dwt_levels=3)
    for result in comparison.results:
        assert result.reconstruction.shape == image.shape
        assert result.rate.pixels == image.size


def test_equal_budget_for_both_methods(image: np.ndarray) -> None:
    dct, dwt = compare(image, KeepLargest(0.1), dwt_levels=3).results
    assert abs(dct.rate.nonzero - dwt.rate.nonzero) <= 0.01 * image.size
