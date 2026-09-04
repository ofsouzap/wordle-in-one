# Wordle in One

A mobile-first puzzle game: infer the sole possible Wordle solution from one
carefully generated first-guess result. Players can keep trying until they find
the answer; incorrect attempts provide no additional tile feedback. Confirmed
hints reveal and lock one correctly placed letter, and the finished game reports
the numbers of submitted guesses and hints used. Hint order is deterministic:
unknown letter occurrences are revealed left-to-right first, followed by
occurrences already established by yellow clue tiles. Typed input never affects
which hint is selected.

The completion summary omits the guess count when the player submitted exactly
one guess; that tautological `Guesses: 1` message should not be reintroduced.
It says `No hints used` instead of displaying the mechanical `Hints: 0`.

## Run locally

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python server.py
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
