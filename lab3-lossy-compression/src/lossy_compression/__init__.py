"""Experimental lossy image compression: block DCT vs. Haar DWT."""

from .codec import Comparison, CompressionResult, compare, compress
from .dct import BlockDCT, dct_matrix
from .haar import HaarDWT, haar_matrix
from .metrics import psnr
from .reduction import HardThreshold, KeepLargest, LowPassZonal, Reducer, UniformQuantization

__all__ = [
    "BlockDCT",
    "Comparison",
    "CompressionResult",
    "HaarDWT",
    "HardThreshold",
    "KeepLargest",
    "LowPassZonal",
    "Reducer",
    "UniformQuantization",
    "compare",
    "compress",
    "dct_matrix",
    "haar_matrix",
    "psnr",
]
