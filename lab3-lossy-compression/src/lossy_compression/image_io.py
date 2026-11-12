from pathlib import Path

import numpy as np
from numpy.typing import NDArray
from PIL import Image

GrayImage = NDArray[np.uint8]


def load_grayscale(path: str | Path) -> GrayImage:
    """Reads any image Pillow supports and converts it to 8-bit luminance (ITU-R 601-2)."""
    with Image.open(path) as image:
        return np.asarray(image.convert("L"), dtype=np.uint8)


def save_grayscale(image: GrayImage, path: str | Path) -> None:
    Image.fromarray(image, mode="L").save(path)


def pad_to_multiple(image: NDArray, multiple: int) -> NDArray:
    """Extends the image by edge replication so both dimensions are multiples of `multiple`."""
    rows, cols = image.shape
    return np.pad(image, ((0, -rows % multiple), (0, -cols % multiple)), mode="edge")
