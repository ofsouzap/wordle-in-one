# Wordle in One

A mobile-first puzzle game: infer the sole possible Wordle solution from one
carefully generated first-guess result. Players can keep trying until they find
the answer; incorrect attempts provide no additional tile feedback. Confirmed
hints reveal and lock one correctly placed letter, and the finished game reports
the number of hints used. Guess attempts are deliberately not counted. Hint order is deterministic:
unknown letter occurrences are revealed left-to-right first, followed by
occurrences already established by yellow clue tiles. Typed input never affects
which hint is selected.

The completion summary says `No hints used` instead of displaying the
mechanical `Hints: 0`.

## Progressive Web App

The app is installable but requires a network connection to load the page and
generate puzzles. `manifest.webmanifest` defines its installed appearance and
icons, while the browser's install prompt and standalone display mode provide
the app-like launch experience. It does not use a service worker or an
application-managed offline cache.

## Benchmark puzzle generation

Run a reproducible uninstrumented benchmark:

```sh
.venv/bin/python benchmark_generation.py --count 100
```

Profile the same workload and show its hottest functions:

```sh
.venv/bin/python benchmark_generation.py --count 100 \
  --profile benchmark-results/generation.prof
```

Use `--json` to retain detailed per-seed measurements. Profiling adds overhead,
so use an unprofiled run for latency numbers and the profiled run only to locate
expensive functions.

## Run locally

```sh
uv sync
uv run python server.py
```

Then open <http://127.0.0.1:8000>. The only API endpoint is:

```text
GET /api/puzzle?seed=0
```

The integer seed makes generation reproducible. The endpoint returns the first
guess, its feedback (`0` gray, `1` yellow, `2` green), the solution, and the
number of random pairs examined.

The original 2,315-solution list is from cfreshman's archived extraction of
the original Wordle source:
<https://gist.github.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b>

The 14,855 accepted guesses and its license were copied from the existing
OpenClaw workspace resource `resources/wordle-list`.
