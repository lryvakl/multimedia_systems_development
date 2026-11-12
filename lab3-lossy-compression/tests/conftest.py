import numpy as np
import pytest


@pytest.fixture
def rng() -> np.random.Generator:
    return np.random.default_rng(seed=7)


@pytest.fixture
def image(rng: np.random.Generator) -> np.ndarray:
    """Smooth gradient with noise and a sharp edge: a small stand-in for a photograph."""
    rows, cols = np.mgrid[0:64, 0:64]
    picture = 100 + rows + 0.5 * cols + rng.normal(0, 4, (64, 64))
    picture[20:44, 20:44] += 60
    return np.clip(np.rint(picture), 0, 255).astype(np.uint8)
