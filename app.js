import {
  createGame,
  addRound,
  undoRound,
  totals,
  winner,
  normalizeBonuses,
  DEFAULT_BONUSES,
} from "./game.js";
import { countPipsFromFile, NoTileError } from "./vision.js";

const STORAGE_KEY = "dominoes:v1";

const $ = (sel) => document.querySelector(sel);

const setupEl = $("#setup");
const gameEl = $("#game");
const setupForm = $("#setupForm");
const roundForm = $("#roundForm");
const historyEl = $("#history");
const winnerEl = $("#winner");
const newGameBtn = $("#newGameBtn");
const resetLink = $("#resetLink");
const bonusRowsEl = $("#bonusRows");
const addBonusBtn = $("#addBonusBtn");
const bonusChipsEl = $("#bonusChips");

const usNameEl = $("#usName");
const themNameEl = $("#themName");
const usTotalEl = $("#usTotal");
const themTotalEl = $("#themTotal");
const targetLabel = $("#targetLabel");
const rulesLabel = $("#rulesLabel");
const rockerUsLabel = $("#rockerUs");
const rockerThemLabel = $("#rockerThem");
const photoBtn = $("#photoBtn");
const photoInput = $("#photoInput");
const photoStatus = $("#photoStatus");

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.bonuses) parsed.bonuses = normalizeBonuses(DEFAULT_BONUSES);
    return parsed;
  } catch {
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (quota, private mode, disabled) — keep playing in-memory
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function renderBonusRows(bonuses) {
  bonusRowsEl.innerHTML = "";
  bonuses.forEach((b, i) => bonusRowsEl.appendChild(makeBonusRow(b.label, b.points, i)));
}

function makeBonusRow(label = "", points = "", i = bonusRowsEl.children.length) {
  const row = document.createElement("div");
  row.className = "bonus-row";
  row.innerHTML = `
    <input type="text" placeholder="label" value="${escapeHtml(String(label))}" data-bonus="label" autocomplete="off" />
    <input type="number" min="0" max="200" placeholder="pts" value="${points === "" ? "" : Number(points)}" data-bonus="points" />
    <button type="button" class="ghost" data-remove="${i}" aria-label="remove">×</button>
  `;
  return row;
}

function readBonusesFromForm() {
  const rows = bonusRowsEl.querySelectorAll(".bonus-row");
  const out = [];
  rows.forEach((row) => {
    const label = row.querySelector('[data-bonus="label"]').value;
    const points = row.querySelector('[data-bonus="points"]').value;
    out.push({ label, points });
  });
  return normalizeBonuses(out);
}

function render() {
  if (!state) {
    setupEl.hidden = false;
    gameEl.hidden = true;
    newGameBtn.hidden = true;
    renderBonusRows(DEFAULT_BONUSES);
    return;
  }

  setupEl.hidden = true;
  gameEl.hidden = false;
  newGameBtn.hidden = false;

  usNameEl.textContent = state.names.us;
  themNameEl.textContent = state.names.them;
  rockerUsLabel.textContent = state.names.us;
  rockerThemLabel.textContent = state.names.them;

  const t = totals(state);
  usTotalEl.textContent = t.us;
  themTotalEl.textContent = t.them;

  targetLabel.textContent = state.target;
  const ruleBits = [];
  if (state.rules.blocked) ruleBits.push("blocked → lower hand");
  if (state.rules.roundTo5) ruleBits.push("round to 5");
  rulesLabel.textContent = ruleBits.join(" · ");

  bonusChipsEl.innerHTML = "";
  state.bonuses.forEach((b) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.points = String(b.points);
    chip.dataset.label = b.label;
    chip.innerHTML = `${escapeHtml(b.label)} <span class="chip-pts">+${b.points}</span>`;
    bonusChipsEl.appendChild(chip);
  });

  historyEl.innerHTML = "";
  state.rounds.forEach((r, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="num">${i + 1}.</span>
      <span class="who" data-side="${r.winner}">${escapeHtml(state.names[r.winner])}${
      r.note ? ` <em style="color:var(--muted);font-style:normal">— ${escapeHtml(r.note)}</em>` : ""
    }</span>
      <span class="pts">+${r.points}</span>
      <button type="button" class="undo" data-i="${i}" aria-label="remove round">×</button>
    `;
    historyEl.appendChild(li);
  });

  const w = winner(state);
  if (w) {
    winnerEl.hidden = false;
    winnerEl.textContent = `Winner: ${state.names[w]}`;
  } else {
    winnerEl.hidden = true;
    winnerEl.textContent = "";
  }
}

setupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(setupForm);
  state = createGame({
    us: fd.get("us"),
    them: fd.get("them"),
    target: fd.get("target"),
    rules: {
      blocked: fd.get("ruleBlocked") === "on",
      roundTo5: fd.get("ruleRoundTo5") === "on",
    },
    bonuses: readBonusesFromForm(),
  });
  save();
  render();
});

addBonusBtn.addEventListener("click", () => {
  bonusRowsEl.appendChild(makeBonusRow());
});

bonusRowsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-remove]");
  if (!btn) return;
  btn.closest(".bonus-row").remove();
});

bonusChipsEl.addEventListener("click", (e) => {
  const chip = e.target.closest("button.chip");
  if (!chip) return;
  roundForm.elements.points.value = chip.dataset.points;
  roundForm.elements.note.value = chip.dataset.label;
  roundForm.elements.points.focus();
});

photoBtn.addEventListener("click", () => photoInput.click());

photoInput.addEventListener("change", async () => {
  const file = photoInput.files && photoInput.files[0];
  if (!file) return;
  photoStatus.hidden = false;
  photoStatus.textContent = "counting pips…";
  try {
    const count = await countPipsFromFile(file);
    roundForm.elements.points.value = String(count);
    roundForm.elements.note.value = "photo";
    photoStatus.textContent = `counted ${count} pip${count === 1 ? "" : "s"} — adjust if needed`;
  } catch (err) {
    if (err instanceof NoTileError) {
      photoStatus.textContent =
        "no domino tile detected — take a top-down photo on a flat surface";
    } else {
      photoStatus.textContent = "couldn't read that photo — enter manually";
    }
  } finally {
    photoInput.value = "";
  }
});

roundForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(roundForm);
  state = addRound(state, {
    winner: fd.get("winner") === "us" ? "us" : "them",
    points: fd.get("points"),
    note: String(fd.get("note") || ""),
  });
  save();
  roundForm.reset();
  roundForm.elements.note.value = "";
  photoStatus.hidden = true;
  photoStatus.textContent = "";
  render();
});

historyEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button.undo");
  if (!btn) return;
  state = undoRound(state, Number(btn.dataset.i));
  save();
  render();
});

newGameBtn.addEventListener("click", () => {
  if (state && state.rounds.length && !confirm("start a new game? current scores will be cleared.")) return;
  state = null;
  localStorage.removeItem(STORAGE_KEY);
  render();
});

resetLink.addEventListener("click", (e) => {
  e.preventDefault();
  if (!confirm("clear all saved state?")) return;
  state = null;
  localStorage.removeItem(STORAGE_KEY);
  render();
});

render();
