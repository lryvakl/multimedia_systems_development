"""Compression pipeline: forward transform → coefficient reduction → inverse transform."""

from dataclasses import dataclass

import numpy as np

from .dct import BlockDCT
from .haar import DEFAULT_LEVELS, HaarDWT
from .image_io import GrayImage, pad_to_multiple
from .metrics import PEAK_VALUE, RateEstimate, estimate_rate, psnr
from .reduction import Reducer
from .transform import Transform


@dataclass(frozen=True)
class CompressionResult:
    method: str
    reconstruction: GrayImage
    psnr: float
    rate: RateEstimate


@dataclass(frozen=True)
class Comparison:
    original: GrayImage
    dct: CompressionResult
    dwt: CompressionResult

    @property
    def results(self) -> tuple[CompressionResult, CompressionResult]:
        return self.dct, self.dwt


def compress(image: GrayImage, transform: Transform, reducer: Reducer) -> CompressionResult:
    rows, cols = image.shape
    padded = pad_to_multiple(image, transform.alignment).astype(np.float64)
    rank = transform.frequency_rank(padded.shape)
    quantized = reducer.reduce(transform.forward(padded), rank)
    restored = transform.inverse(quantized.dequantize())[:rows, :cols]
    reconstruction = np.clip(np.rint(restored), 0, PEAK_VALUE).astype(np.uint8)
    return CompressionResult(
        method=transform.name,
        reconstruction=reconstruction,
        psnr=psnr(image, reconstruction),
        rate=estimate_rate(quantized.symbols, rank, image.size),
    )


def compare(image: GrayImage, reducer: Reducer, dwt_levels: int = DEFAULT_LEVELS) -> Comparison:
    return Comparison(
        original=image,
        dct=compress(image, BlockDCT(), reducer),
        dwt=compress(image, HaarDWT(dwt_levels), reducer),
    )
