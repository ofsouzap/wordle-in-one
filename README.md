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

## Offline puzzle queue

The browser keeps ten generated puzzles in IndexedDB. A new game consumes the
oldest cached puzzle and refills the queue in the background while online. If
the connection drops while the page is open, new games continue to work until
the queue is empty. The **Offline cache status** dialog shows the connection,
queue depth, current seed, last successful update, refresh activity, and queued
seeds; it also provides a manual refresh button.
The dialog also offers a confirmed cache-clear action. Clearing cancels any
active refill and leaves the current puzzle untouched.

New puzzle seeds are random eight-digit integers. Timestamps are used only for
cache diagnostics, never as puzzle seeds.

## Progressive Web App

The app is installable and supports offline startup. `manifest.webmanifest`
defines its installed appearance and icons. The versioned service worker
precaches the complete application shell while leaving API puzzle responses to
the IndexedDB queue. The cache-status dialog reports service-worker, app-shell,
and display-mode state.

Whenever a cached frontend asset changes, increment `APP_CACHE` in
`static/service-worker.js` and the matching `APP_SHELL_CACHE` in
`static/app.js`. Installation is atomic: failure to fetch any shell asset leaves
the preceding service worker and cache in place.

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
