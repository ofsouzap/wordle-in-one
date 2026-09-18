const feedbackClasses = ["absent", "present", "correct"];
const keyboardRows = ["QWERTYUIOP", "ASDFGHJKL", ["ENTER", ..."ZXCVBNM", "⌫"]];

const clueRow = document.querySelector("#clue-row");
const answerRow = document.querySelector("#answer-row");
const keyboard = document.querySelector("#keyboard");
const message = document.querySelector("#message");
const seedInput = document.querySelector("#seed");
const hintButton = document.querySelector("#hint-button");
const installButton = document.querySelector("#install-app");

const MINIMUM_SEED = 10_000_000;
const SEED_RANGE = 90_000_000;

let puzzle = null;
let answer = Array(5).fill("");
let lockedPositions = new Set();
let hintOrder = [];
let finished = false;
let hints = 0;
let deferredInstallPrompt = null;

function randomSeed() {
  const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
  return MINIMUM_SEED + Math.floor((randomValue / 2 ** 32) * SEED_RANGE);
}

async function fetchPuzzle(seed) {
  const response = await fetch(`/api/puzzle?seed=${encodeURIComponent(seed)}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Could not load puzzle");
  return body;
}

function tiles(container) {
  container.replaceChildren();
  return Array.from({ length: 5 }, () => {
    const tile = document.createElement("div");
    tile.className = "tile";
    container.append(tile);
    return tile;
  });
}

function drawClue() {
  const row = tiles(clueRow);
  [...puzzle.firstGuess].forEach((letter, index) => {
    row[index].textContent = letter;
    row[index].classList.add(feedbackClasses[puzzle.feedback[index]], "reveal");
    row[index].style.animationDelay = `${index * 90}ms`;
  });
}

function colorKeyboard() {
  const bestFeedback = new Map();
  [...puzzle.firstGuess].forEach((letter, index) => {
    const value = puzzle.feedback[index];
    bestFeedback.set(letter, Math.max(bestFeedback.get(letter) ?? -1, value));
  });

  keyboard.querySelectorAll(".key[data-letter]").forEach((key) => {
    key.classList.remove(...feedbackClasses);
    const value = bestFeedback.get(key.dataset.letter.toLowerCase());
    if (value !== undefined) key.classList.add(feedbackClasses[value]);
  });
}

function drawAnswer() {
  const row = [...answerRow.children];
  row.forEach((tile, index) => {
    tile.textContent = answer[index] || "";
    tile.classList.toggle("locked", lockedPositions.has(index));
    tile.classList.toggle("filled", Boolean(answer[index]) && !lockedPositions.has(index));
  });
}

function resetAnswer() {
  answerRow.classList.remove("shake");
  lockedPositions = new Set(
    puzzle.feedback
      .map((value, index) => value === 2 ? index : -1)
      .filter((index) => index !== -1),
  );
  answer = [...puzzle.firstGuess.toUpperCase()].map((letter, index) =>
    lockedPositions.has(index) ? letter : ""
  );
  hintOrder = buildHintOrder();
  drawAnswer();
}

function buildHintOrder() {
  const yellowCounts = new Map();
  [...puzzle.firstGuess].forEach((letter, index) => {
    if (puzzle.feedback[index] === 1) {
      yellowCounts.set(letter, (yellowCounts.get(letter) ?? 0) + 1);
    }
  });

  const unknownPositions = [];
  const yellowPositions = [];
  [...puzzle.solution].forEach((letter, index) => {
    if (lockedPositions.has(index)) return;
    const remaining = yellowCounts.get(letter) ?? 0;
    if (remaining > 0) {
      yellowPositions.push(index);
      yellowCounts.set(letter, remaining - 1);
    } else {
      unknownPositions.push(index);
    }
  });
  return [...unknownPositions, ...yellowPositions];
}

function animateWin() {
  [...answerRow.children].forEach((tile, index) => {
    tile.classList.remove("filled");
    tile.classList.add("win-flip");
    tile.style.animationDelay = `${index * 120}ms`;
  });
}

function finishGame() {
  finished = true;
  hintButton.disabled = true;
  animateWin();
  const hintSummary = hints === 0 ? "No hints used" : `Hints: ${hints}`;
  message.textContent = `You found it! ${hintSummary}`;
  message.className = "message win";
}

function shakeAnswer() {
  answerRow.classList.remove("shake");
  void answerRow.offsetWidth;
  answerRow.classList.add("shake");
}

function beginLoading() {
  finished = true;
  hintButton.disabled = true;
  message.className = "message";
  message.textContent = "Generating puzzle…";
}

function showPuzzle(puzzleToShow) {
  puzzle = puzzleToShow;
  finished = false;
  hints = 0;
  hintButton.disabled = false;
  seedInput.value = puzzle.seed;
  drawClue();
  colorKeyboard();
  tiles(answerRow);
  resetAnswer();
  message.textContent = "What must the solution be?";
  message.className = "message";
}

function showLoadError(error) {
  message.textContent = error.message;
  message.className = "message lose";
}

async function loadPuzzle(seed) {
  beginLoading();
  try {
    showPuzzle(await fetchPuzzle(seed));
  } catch (error) {
    showLoadError(error);
  }
}

async function loadNextPuzzle() {
  beginLoading();
  try {
    showPuzzle(await fetchPuzzle(randomSeed()));
  } catch (error) {
    showLoadError(error);
  }
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function enterLetter(letter) {
  if (finished || !puzzle) return;
  if (letter === "ENTER") {
    if (answer.some((value) => !value)) {
      message.textContent = "Enter five letters first.";
      return;
    }
    const won = answer.join("") === puzzle.solution.toUpperCase();
    if (won) {
      finishGame();
    } else {
      shakeAnswer();
      message.textContent = "Not that one—try again.";
      message.className = "message";
    }
    return;
  }
  if (letter === "⌫" || letter === "BACKSPACE") {
    for (let index = answer.length - 1; index >= 0; index -= 1) {
      if (!lockedPositions.has(index) && answer[index]) {
        answer[index] = "";
        break;
      }
    }
  } else if (/^[A-Z]$/.test(letter)) {
    const index = answer.findIndex((value, position) =>
      !value && !lockedPositions.has(position)
    );
    if (index !== -1) answer[index] = letter;
  }
  message.textContent = "What must the solution be?";
  drawAnswer();
}

function revealHint() {
  if (finished || !puzzle) return;
  if (!window.confirm("Reveal one correctly placed letter?")) return;

  const position = hintOrder.find((index) => !lockedPositions.has(index));
  if (position === undefined) return;
  answer[position] = puzzle.solution[position].toUpperCase();
  lockedPositions.add(position);
  hints += 1;
  drawAnswer();

  if (lockedPositions.size === 5) {
    finishGame();
  } else {
    message.textContent = "A correctly placed letter has been revealed.";
    message.className = "message";
  }
}

function buildKeyboard() {
  keyboardRows.forEach((letters) => {
    const row = document.createElement("div");
    row.className = "keyboard-row";
    [...letters].forEach((letter) => {
      const key = document.createElement("button");
      key.className = `key ${letter.length > 1 ? "wide" : ""}`;
      key.textContent = letter;
      if (letter.length === 1) key.dataset.letter = letter;
      key.addEventListener("click", () => enterLetter(letter));
      row.append(key);
    });
    keyboard.append(row);
  });
}

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  const key = event.key.toUpperCase();
  if (/^[A-Z]$/.test(key) || key === "ENTER" || key === "BACKSPACE") {
    event.preventDefault();
    enterLetter(key);
  }
});

document.querySelector("#load-seed").addEventListener("click", () => loadPuzzle(seedInput.value));
document.querySelector("#new-game").addEventListener("click", () => {
  void loadNextPuzzle();
});
hintButton.addEventListener("click", revealHint);
document.querySelector("#info-button").addEventListener("click", () => document.querySelector("#info-dialog").showModal());
document.querySelector("#close-info").addEventListener("click", () => document.querySelector("#info-dialog").close());
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.hidden = true;
});
installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});
buildKeyboard();
void loadNextPuzzle();
