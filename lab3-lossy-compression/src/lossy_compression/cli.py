import argparse
from pathlib import Path

from .codec import compare
from .experiments import markdown_table, run_levels, to_records, write_csv
from .haar import DEFAULT_LEVELS, max_levels
from .image_io import load_grayscale, save_grayscale
from .plotting import comparison_grid, detail_figure, rate_distortion_figure, save
from .strategies import DEFAULT_STRATEGY, STRATEGIES

SWEEP_POINTS = 16
DEPTH_SWEEP_FRACTION = 2


def _view(args: argparse.Namespace) -> None:
    from .viewer import ComparisonViewer

    ComparisonViewer(load_grayscale(args.image), args.image.stem, args.levels, args.out).show()


def _compress(args: argparse.Namespace) -> None:
    spec = STRATEGIES[args.strategy]
    value = spec.default if args.value is None else args.value
    comparison = compare(load_grayscale(args.image), spec.build(value), args.levels)
    args.out.mkdir(parents=True, exist_ok=True)
    print(f"{args.image.name}: {spec.title}, {spec.label(value)}, Haar levels = {args.levels}")
    for result in comparison.results:
        path = args.out / f"{args.image.stem}_{result.method.lower()}.png"
        save_grayscale(result.reconstruction, path)
        rate = result.rate
        print(
            f"  {result.method}: PSNR {result.psnr:6.2f} dB | kept {100 * rate.kept_fraction:6.2f}% "
            f"| {rate.bits_per_pixel:.3f} bpp | CR nonzero {rate.coefficient_ratio:.1f}:1, "
            f"entropy {rate.entropy_ratio:.1f}:1, deflate {rate.deflate_ratio:.1f}:1 → {path}"
        )


def _experiment(args: argparse.Namespace) -> None:
    args.out.mkdir(parents=True, exist_ok=True)
    records, summary = [], [f"# Experiment results (Haar levels = {args.levels})"]
    for path in args.images:
        image, name = load_grayscale(path), path.stem
        image_dir = args.out / name
        image_dir.mkdir(exist_ok=True)
        summary.append(f"\n## {name} ({image.shape[1]}×{image.shape[0]})")
        print(f"{name}:")
        for spec in STRATEGIES.values():
            levels = run_levels(image, spec, spec.levels, args.levels)
            records += to_records(name, spec, levels, args.levels)
            summary += [f"\n### {spec.title}\n", markdown_table(spec, levels)]
            save(comparison_grid(spec, levels), image_dir / f"{spec.key}.png")
            print(f"  {spec.title}: {len(levels)} levels")

        largest, quantization = STRATEGIES[DEFAULT_STRATEGY], STRATEGIES["quantization"]
        middle = run_levels(image, largest, [largest.default], args.levels)[0]
        save(detail_figure(middle.comparison, largest.label(largest.default)), image_dir / "detail.png")
        depth = [
            (levels, compare(image, largest.build(DEPTH_SWEEP_FRACTION), levels))
            for levels in range(1, min(8, max_levels(image.shape)) + 1)
        ]
        figure = rate_distortion_figure(
            run_levels(image, largest, largest.sweep(SWEEP_POINTS), args.levels),
            run_levels(image, quantization, quantization.sweep(SWEEP_POINTS), args.levels),
            depth,
            largest.label(DEPTH_SWEEP_FRACTION),
        )
        save(figure, image_dir / "rate-distortion.png")

    write_csv(records, args.out / "experiments.csv")
    (args.out / "summary.md").write_text("\n".join(summary) + "\n")
    print(f"Results written to {args.out.resolve()}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lossy-compression", description="Lossy image compression with block DCT and Haar DWT."
    )
    parser.add_argument("--levels", type=int, default=DEFAULT_LEVELS, help="Haar decomposition levels")
    commands = parser.add_subparsers(required=True)

    view = commands.add_parser("view", help="interactive Original | DCT | DWT comparison")
    view.add_argument("image", type=Path)
    view.add_argument("--out", type=Path, default=Path("results/viewer"), help="where 'Save results' writes")
    view.set_defaults(handler=_view)

    single = commands.add_parser("compress", help="compress one image with both methods and save results")
    single.add_argument("image", type=Path)
    single.add_argument("--strategy", choices=STRATEGIES, default=DEFAULT_STRATEGY)
    single.add_argument("--value", type=float, help="strategy parameter (defaults to the strategy default)")
    single.add_argument("--out", type=Path, default=Path("results/single"))
    single.set_defaults(handler=_compress)

    experiment = commands.add_parser("experiment", help="run all strategies at several levels, write report")
    experiment.add_argument("images", type=Path, nargs="+")
    experiment.add_argument("--out", type=Path, default=Path("results"))
    experiment.set_defaults(handler=_experiment)
    return parser


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    args.handler(args)
