#!/usr/bin/env python3
"""Small HTTP backend for Wordle in One."""

from __future__ import annotations

import argparse
import random
from collections import Counter
from pathlib import Path
from typing import Final

from flask import Flask, jsonify, request, send_from_directory

ABSENT: Final = 0
PRESENT: Final = 1
CORRECT: Final = 2
ROOT: Final = Path(__file__).resolve().parent
STATIC_DIR: Final = ROOT / "static"
ACCEPTED_GUESSES: Final = ROOT / "data" / "accepted-guesses.txt"
SOLUTIONS: Final = ROOT / "data" / "solutions.txt"

Feedback = tuple[int, int, int, int, int]


def score_guess(guess: str, solution: str) -> Feedback:
    """Return Wordle feedback, correctly accounting for repeated letters."""
    result = [ABSENT] * 5
    unmatched_solution_letters: Counter[str] = Counter()

    for position, (guessed_letter, solution_letter) in enumerate(
        zip(guess, solution, strict=True)
    ):
        if guessed_letter == solution_letter:
            result[position] = CORRECT
        else:
            unmatched_solution_letters[solution_letter] += 1

    for position, guessed_letter in enumerate(guess):
        if result[position] == CORRECT:
            continue
        if unmatched_solution_letters[guessed_letter] > 0:
            result[position] = PRESENT
            unmatched_solution_letters[guessed_letter] -= 1

    return tuple(result)  # type: ignore[return-value]


def uniquely_identifies(solution: str, guess: str, words: list[str]) -> bool:
    target_feedback = score_guess(guess, solution)
    return not any(
        candidate not in (solution, guess)
        and score_guess(guess, candidate) == target_feedback
        for candidate in words
    )


def load_words(path: Path) -> list[str]:
    words = [line.strip().lower() for line in path.read_text().splitlines() if line.strip()]
    invalid = [word for word in words if len(word) != 5 or not word.isalpha()]
    if invalid:
        raise ValueError(f"invalid entries in {path}: {invalid[:5]}")
    if len(words) != len(set(words)):
        raise ValueError(f"duplicate entries in {path}")
    return words


ACCEPTED_WORDS = load_words(ACCEPTED_GUESSES)
SOLUTION_WORDS = load_words(SOLUTIONS)
if not set(SOLUTION_WORDS) <= set(ACCEPTED_WORDS):
    raise RuntimeError("every solution must also be an accepted guess")

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")


def generate_puzzle(seed: int) -> dict[str, object]:
    rng = random.Random(seed)
    attempts = 0
    while True:
        solution = rng.choice(SOLUTION_WORDS)
        guess = rng.choice(ACCEPTED_WORDS)
        if guess == solution:
            continue
        attempts += 1
        if uniquely_identifies(solution, guess, ACCEPTED_WORDS):
            return {
                "seed": seed,
                "firstGuess": guess,
                "feedback": score_guess(guess, solution),
                "solution": solution,
                "attempts": attempts,
            }


@app.get("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.get("/service-worker.js")
def service_worker():
    response = send_from_directory(STATIC_DIR, "service-worker.js")
    response.headers["Cache-Control"] = "no-cache"
    response.headers["Service-Worker-Allowed"] = "/"
    return response


@app.get("/api/puzzle")
def puzzle():
    values = request.args.getlist("seed")
    if len(values) != 1:
        return jsonify(error="seed is required"), 400
    try:
        seed = int(values[0])
    except ValueError:
        return jsonify(error="seed must be an integer"), 400

    response = jsonify(generate_puzzle(seed))
    response.headers["Cache-Control"] = "no-store"
    return response


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    app.run(host=args.host, port=args.port)


if __name__ == "__main__":
    main()
