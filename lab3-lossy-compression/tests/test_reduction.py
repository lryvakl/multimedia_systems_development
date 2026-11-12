import numpy as np
import pytest

from lossy_compression.reduction import HardThreshold, KeepLargest, LowPassZonal, UniformQuantization

COEFFICIENTS = np.array([[50.0, -3.0], [-20.0, 0.4]])
RANK = np.array([[0, 1], [2, 3]])


def test_keep_largest_keeps_exact_count_by_magnitude() -> None:
    reduced = KeepLargest(0.5).reduce(COEFFICIENTS, RANK)
    np.testing.assert_array_equal(reduced.symbols, [[50, 0], [-20, 0]])
    assert reduced.nonzero == 2


def test_keep_largest_keeps_at_least_one() -> None:
    assert KeepLargest(1e-6).reduce(COEFFICIENTS, RANK).nonzero == 1


def test_threshold_drops_small_magnitudes() -> None:
    reduced = HardThreshold(3).reduce(COEFFICIENTS, RANK)
    np.testing.assert_array_equal(reduced.symbols, [[50, -3], [-20, 0]])


def test_quantization_rounds_to_step_multiples() -> None:
    reduced = UniformQuantization(8).reduce(COEFFICIENTS, RANK)
    np.testing.assert_array_equal(reduced.symbols, [[6, 0], [-2, 0]])
    np.testing.assert_array_equal(reduced.dequantize(), [[48, 0], [-16, 0]])


def test_zonal_keeps_whole_low_frequency_classes() -> None:
    rank = np.repeat(np.arange(4), 4).reshape(4, 4)
    coefficients = np.full((4, 4), 9.0)
    assert LowPassZonal(0.5).select(coefficients, rank).sum() == 8
    assert LowPassZonal(0.6).select(coefficients, rank).sum() == 8
    assert LowPassZonal(0.01).select(coefficients, rank).sum() == 4


@pytest.mark.parametrize(
    "factory, value",
    [(KeepLargest, 0), (KeepLargest, 1.5), (LowPassZonal, 0), (HardThreshold, -1), (UniformQuantization, 0)],
)
def test_invalid_parameters_are_rejected(factory, value) -> None:
    with pytest.raises(ValueError):
        factory(value)
