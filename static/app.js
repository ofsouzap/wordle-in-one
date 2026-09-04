const feedbackClasses = ["absent", "present", "correct"];
const keyboardRows = ["QWERTYUIOP", "ASDFGHJKL", ["ENTER", ..."ZXCVBNM", "⌫"]];

const clueRow = document.querySelector("#clue-row");
const answerRow = document.querySelector("#answer-row");
const keyboard = document.querySelector("#keyboard");
const message = document.querySelector("#message");
const seedInput = document.querySelector("#seed");

let puzzle = null;
let answer = "";
let finished = false;

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
    tile.classList.toggle("filled", Boolean(answer[index]));
  });
}

function animateWin() {
  [...answerRow.children].forEach((tile, index) => {
    tile.classList.remove("filled");
    tile.classList.add("win-flip");
    tile.style.animationDelay = `${index * 120}ms`;
  });
}

async function loadPuzzle(seed) {
  finished = true;
  message.className = "message";
  message.textContent = "Generating puzzle…";
  try {
    const response = await fetch(`/api/puzzle?seed=${encodeURIComponent(seed)}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Could not load puzzle");
    puzzle = body;
    answer = "";
    finished = false;
    seedInput.value = body.seed;
    drawClue();
    colorKeyboard();
    tiles(answerRow);
    message.textContent = "What must the solution be?";
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("lose");
  }
}

function enterLetter(letter) {
  if (finished || !puzzle) return;
  if (letter === "ENTER") {
    if (answer.length !== 5) {
      message.textContent = "Enter five letters first.";
      return;
    }
    const won = answer === puzzle.solution.toUpperCase();
    if (won) {
      finished = true;
      animateWin();
      message.textContent = "You found it!";
      message.className = "message win";
    } else {
      answer = "";
      drawAnswer();
      message.textContent = "Not that one—try again.";
      message.className = "message";
    }
    return;
  }
  if (letter === "⌫" || letter === "BACKSPACE") {
    answer = answer.slice(0, -1);
  } else if (/^[A-Z]$/.test(letter) && answer.length < 5) {
    answer += letter;
  }
  message.textContent = "What must the solution be?";
  drawAnswer();
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
  const key = event.key.toUpperCase();
  if (/^[A-Z]$/.test(key) || key === "ENTER" || key === "BACKSPACE") {
    event.preventDefault();
    enterLetter(key);
  }
});

document.querySelector("#load-seed").addEventListener("click", () => loadPuzzle(seedInput.value));
document.querySelector("#new-game").addEventListener("click", () => {
  loadPuzzle(Date.now());
});
document.querySelector("#info-button").addEventListener("click", () => document.querySelector("#info-dialog").showModal());
document.querySelector("#close-info").addEventListener("click", () => document.querySelector("#info-dialog").close());

buildKeyboard();
loadPuzzle(Date.now());
