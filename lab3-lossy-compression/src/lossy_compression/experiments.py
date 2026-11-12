"""Experiment runner: compression levels × methods → metrics tables."""

import csv
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass, fields
from pathlib import Path

from .codec import Comparison, CompressionResult, compare
from .image_io import GrayImage
from .strategies import StrategySpec


@dataclass(frozen=True)
class LevelResult:
    value: float
    comparison: Comparison


@dataclass(frozen=True)
class ExperimentRecord:
    image: str
    strategy: str
    parameter: float
    method: str
    dwt_levels: int
    kept_percent: float
    psnr_db: float
    bits_per_pixel: float
    coefficient_ratio: float
    entropy_ratio: float
    deflate_ratio: float

    @classmethod
    def of(
        cls, image: str, spec: StrategySpec, value: float, dwt_levels: int, result: CompressionResult
    ) -> "ExperimentRecord":
        rate = result.rate
        return cls(
            image=image,
            strategy=spec.key,
            parameter=value,
            method=result.method,
            dwt_levels=dwt_levels,
            kept_percent=round(100 * rate.kept_fraction, 3),
            psnr_db=round(result.psnr, 2),
            bits_per_pixel=round(rate.bits_per_pixel, 3),
            coefficient_ratio=round(rate.coefficient_ratio, 2),
            entropy_ratio=round(rate.entropy_ratio, 2),
            deflate_ratio=round(rate.deflate_ratio, 2),
        )


def run_levels(
    image: GrayImage, spec: StrategySpec, values: Iterable[float], dwt_levels: int
) -> list[LevelResult]:
    return [LevelResult(value, compare(image, spec.build(value), dwt_levels)) for value in values]


def to_records(
    image_name: str, spec: StrategySpec, levels: Sequence[LevelResult], dwt_levels: int
) -> list[ExperimentRecord]:
    return [
        ExperimentRecord.of(image_name, spec, level.value, dwt_levels, result)
        for level in levels
        for result in level.comparison.results
    ]


def write_csv(records: Sequence[ExperimentRecord], path: Path) -> None:
    with path.open("w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=[field.name for field in fields(ExperimentRecord)])
        writer.writeheader()
        writer.writerows(asdict(record) for record in records)


def markdown_table(spec: StrategySpec, levels: Sequence[LevelResult]) -> str:
    """DCT and DWT side by side for every level."""
    header = (
        f"| {spec.parameter.capitalize()} | Kept, % (DCT / DWT) | PSNR, dB (DCT / DWT) "
        "| Entropy, bpp (DCT / DWT) | CR deflate (DCT / DWT) |"
    )
    rows = [header, "|" + " --- |" * 5]
    for level in levels:
        dct, dwt = level.comparison.results
        rows.append(
            f"| {spec.format(level.value)} "
            f"| {100 * dct.rate.kept_fraction:.2f} / {100 * dwt.rate.kept_fraction:.2f} "
            f"| {_mark_best(dct.psnr, dwt.psnr, '{:.2f}')} "
            f"| {dct.rate.bits_per_pixel:.3f} / {dwt.rate.bits_per_pixel:.3f} "
            f"| {dct.rate.deflate_ratio:.1f} / {dwt.rate.deflate_ratio:.1f} |"
        )
    return "\n".join(rows)


def _mark_best(dct: float, dwt: float, template: str) -> str:
    first, second = template.format(dct), template.format(dwt)
    if dct > dwt:
        first = f"**{first}**"
    elif dwt > dct:
        second = f"**{second}**"
    return f"{first} / {second}"
