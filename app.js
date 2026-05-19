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

const usNameEl = $("#usName");
const themNameEl = $("#themName");
const usTotalEl = $("#usTotal");
const themTotalEl = $("#themTotal");
const targetLabel = $("#targetLabel");
const rulesLabel = $("#rulesLabel");
const winnerUsOpt = $("#winnerUs");
const winnerThemOpt = $("#winnerThem");

let state = load() ?? null;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function totals() {
  const t = { us: 0, them: 0 };
  for (const r of state.rounds) t[r.winner] += r.points;
  return t;
}

function winner() {
  const t = totals();
  if (t.us >= state.target && t.us >= t.them) return "us";
  if (t.them >= state.target && t.them >= t.us) return "them";
  return null;
}

function applyRoundingRule(points) {
  if (!state.rules.roundTo5) return points;
  return Math.round(points / 5) * 5;
}

function render() {
  if (!state) {
    setupEl.hidden = false;
    gameEl.hidden = true;
    newGameBtn.hidden = true;
    return;
  }

  setupEl.hidden = true;
  gameEl.hidden = false;
  newGameBtn.hidden = false;

  usNameEl.textContent = state.names.us;
  themNameEl.textContent = state.names.them;
  winnerUsOpt.textContent = state.names.us;
  winnerUsOpt.value = "us";
  winnerThemOpt.textContent = state.names.them;
  winnerThemOpt.value = "them";

  const t = totals();
  usTotalEl.textContent = t.us;
  themTotalEl.textContent = t.them;

  targetLabel.textContent = state.target;
  const ruleBits = [];
  if (state.rules.blocked) ruleBits.push("blocked → lower hand");
  if (state.rules.roundTo5) ruleBits.push("round to 5");
  rulesLabel.textContent = ruleBits.join(" · ");

  historyEl.innerHTML = "";
  state.rounds.forEach((r, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="num">${i + 1}.</span>
      <span class="who" data-side="${r.winner}">${state.names[r.winner]}${
      r.note ? ` <em style="color:var(--muted);font-style:normal">— ${escapeHtml(r.note)}</em>` : ""
    }</span>
      <span class="pts">+${r.points}</span>
      <button type="button" class="undo" data-i="${i}" aria-label="remove round">×</button>
    `;
    historyEl.appendChild(li);
  });

  const w = winner();
  if (w) {
    winnerEl.hidden = false;
    winnerEl.textContent = `${state.names[w]} win`;
  } else {
    winnerEl.hidden = true;
    winnerEl.textContent = "";
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

setupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(setupForm);
  state = {
    names: {
      us: String(fd.get("us")).trim() || "Us",
      them: String(fd.get("them")).trim() || "Them",
    },
    target: Math.max(50, Number(fd.get("target")) || 200),
    rules: {
      blocked: fd.get("ruleBlocked") === "on",
      roundTo5: fd.get("ruleRoundTo5") === "on",
    },
    rounds: [],
    startedAt: Date.now(),
  };
  save();
  render();
});

roundForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(roundForm);
  const points = applyRoundingRule(Math.max(0, Number(fd.get("points")) || 0));
  state.rounds.push({
    winner: fd.get("winner") === "us" ? "us" : "them",
    points,
    note: String(fd.get("note") || "").trim(),
    at: Date.now(),
  });
  save();
  roundForm.reset();
  render();
});

historyEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button.undo");
  if (!btn) return;
  const i = Number(btn.dataset.i);
  state.rounds.splice(i, 1);
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
