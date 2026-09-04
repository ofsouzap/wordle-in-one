#!/usr/bin/env python3
"""Benchmark deterministic Wordle-in-One puzzle generation."""

from __future__ import annotations

import argparse
import cProfile
import json
import math
import pstats
import statistics
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from server import generate_puzzle


@dataclass(frozen=True)
class Measurement:
    seed: int
    seconds: float
    attempts: int


def percentile(values: list[float], percentage: float) -> float:
    """Return a nearest-rank percentile."""
    ordered = sorted(values)
    rank = max(0, math.ceil(percentage * len(ordered)) - 1)
    return ordered[rank]


def run_benchmark(seeds: range, progress_every: int) -> list[Measurement]:
    measurements = []
    total = len(seeds)
    for number, seed in enumerate(seeds, start=1):
        started = time.perf_counter()
        puzzle = generate_puzzle(seed)
        elapsed = time.perf_counter() - started
        measurements.append(
            Measurement(seed=seed, seconds=elapsed, attempts=int(puzzle["attempts"]))
        )
        if progress_every and (number % progress_every == 0 or number == total):
            print(f"completed {number}/{total}", flush=True)
    return measurements


def summarize(measurements: list[Measurement]) -> dict[str, object]:
    timings = [measurement.seconds for measurement in measurements]
    attempts = [measurement.attempts for measurement in measurements]
    slowest = sorted(measurements, key=lambda item: item.seconds, reverse=True)[:5]
    total_seconds = sum(timings)
    total_attempts = sum(attempts)
    return {
        "puzzles": len(measurements),
        "total_seconds": total_seconds,
        "puzzles_per_second": len(measurements) / total_seconds,
        "latency_seconds": {
            "minimum": min(timings),
            "median": statistics.median(timings),
            "p95": percentile(timings, 0.95),
            "maximum": max(timings),
            "mean": statistics.mean(timings),
        },
        "attempts": {
            "minimum": min(attempts),
            "median": statistics.median(attempts),
            "p95": percentile([float(value) for value in attempts], 0.95),
            "maximum": max(attempts),
            "mean": statistics.mean(attempts),
            "total": total_attempts,
        },
        "milliseconds_per_pair_attempt": total_seconds * 1000 / total_attempts,
        "attempt_latency_correlation": (
            statistics.correlation(attempts, timings) if len(measurements) > 1 else None
        ),
        "slowest": [asdict(measurement) for measurement in slowest],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--start-seed", type=int, default=10_000_000)
    parser.add_argument("--progress-every", type=int, default=10)
    parser.add_argument("--json", type=Path, help="write measurements and summary as JSON")
    parser.add_argument("--profile", type=Path, help="write cProfile data to this file")
    parser.add_argument("--profile-top", type=int, default=20)
    args = parser.parse_args()
    if args.count <= 0:
        parser.error("--count must be positive")
    return args


def main() -> None:
    args = parse_args()
    seeds = range(args.start_seed, args.start_seed + args.count)

    if args.profile:
        args.profile.parent.mkdir(parents=True, exist_ok=True)
        profiler = cProfile.Profile()
        profiler.enable()
        measurements = run_benchmark(seeds, args.progress_every)
        profiler.disable()
        profiler.dump_stats(args.profile)
    else:
        measurements = run_benchmark(seeds, args.progress_every)

    summary = summarize(measurements)
    print(json.dumps(summary, indent=2))

    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(
            json.dumps(
                {
                    "summary": summary,
                    "measurements": [asdict(item) for item in measurements],
                },
                indent=2,
            )
            + "\n"
        )

    if args.profile:
        print(f"\nTop {args.profile_top} functions by cumulative time:")
        pstats.Stats(str(args.profile)).strip_dirs().sort_stats("cumulative").print_stats(
            args.profile_top
        )


if __name__ == "__main__":
    main()
