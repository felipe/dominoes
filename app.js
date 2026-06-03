import {
  createGame,
  addRound,
  undoRound,
  totals,
  winner,
  roundTotal,
  normalizeBonuses,
  DEFAULT_BONUSES,
} from "./game.js";

const STORAGE_KEY = "dominoes:v2";
const SETTINGS_KEY = "dominoes:settings:v1";

const DEFAULT_SETTINGS = {
  photoEnabled: false,
  defaults: {
    us: "Us",
    them: "Them",
    target: 200,
    rules: { blocked: true, roundTo5: false },
    bonuses: DEFAULT_BONUSES,
  },
};

const $ = (sel) => document.querySelector(sel);

// ---------- DOM refs ----------

const setupEl = $("#setup");
const settingsEl = $("#settings");
const gameEl = $("#game");

const setupForm = $("#setupForm");
const bonusRowsEl = $("#bonusRows");
const addBonusBtn = $("#addBonusBtn");

const settingsBtn = $("#settingsBtn");
const settingsBack = $("#settingsBack");
const settingsResetAll = $("#settingsResetAll");
const photoEnabledInput = $("#photoEnabled");

const newGameBtn = $("#newGameBtn");
const resetLink = $("#resetLink");

const roundForm = $("#roundForm");
const bonusChipsEl = $("#bonusChips");
const roundPreview = $("#roundPreview");
const roundStatus = $("#roundStatus");
const historyEl = $("#history");
const winnerEl = $("#winner");

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
const photoReview = $("#photoReview");
const photoReviewImg = $("#photoReviewImg");
const photoReviewSvg = $("#photoReviewSvg");
const photoReviewTotal = $("#photoReviewTotal");
const photoReviewCancel = $("#photoReviewCancel");
const photoReviewUse = $("#photoReviewUse");

// ---------- state ----------

let settings = loadSettings();
let state = loadGame();
let draftBonuses = []; // bonuses staged on the round form
let currentView = "setup"; // 'setup' | 'settings' | 'game'

// ---------- persistence ----------

function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveGame() {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    return mergeSettings(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

function mergeSettings(parsed) {
  const out = structuredClone(DEFAULT_SETTINGS);
  if (typeof parsed?.photoEnabled === "boolean") out.photoEnabled = parsed.photoEnabled;
  const d = parsed?.defaults ?? {};
  if (typeof d.us === "string" && d.us.trim()) out.defaults.us = d.us;
  if (typeof d.them === "string" && d.them.trim()) out.defaults.them = d.them;
  if (Number(d.target) >= 50) out.defaults.target = Number(d.target);
  if (d.rules) {
    out.defaults.rules.blocked = !!d.rules.blocked;
    out.defaults.rules.roundTo5 = !!d.rules.roundTo5;
  }
  if (Array.isArray(d.bonuses)) {
    const norm = normalizeBonuses(d.bonuses);
    if (norm.length) out.defaults.bonuses = norm;
  }
  return out;
}

// ---------- utilities ----------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function setStatus(msg) {
  if (!msg) {
    roundStatus.hidden = true;
    roundStatus.textContent = "";
  } else {
    roundStatus.hidden = false;
    roundStatus.textContent = msg;
  }
}

function setWinnerRadio(w) {
  for (const el of roundForm.elements.winner) el.checked = el.value === w;
}

// ---------- bonus rows (new-game form) ----------

function makeBonusRow(label = "", points = "") {
  const row = document.createElement("div");
  row.className = "bonus-row";
  row.innerHTML = `
    <input type="text" placeholder="label" value="${escapeHtml(label)}" data-bonus="label" autocomplete="off" />
    <input type="number" min="0" max="200" placeholder="pts" value="${
      points === "" ? "" : Number(points)
    }" data-bonus="points" />
    <button type="button" class="ghost" data-remove aria-label="remove">×</button>
  `;
  return row;
}

function renderBonusRows(bonuses) {
  bonusRowsEl.innerHTML = "";
  bonuses.forEach((b) => bonusRowsEl.appendChild(makeBonusRow(b.label, b.points)));
}

function readBonuses() {
  const out = [];
  bonusRowsEl.querySelectorAll(".bonus-row").forEach((row) => {
    out.push({
      label: row.querySelector('[data-bonus="label"]').value,
      points: row.querySelector('[data-bonus="points"]').value,
    });
  });
  return normalizeBonuses(out);
}

bonusRowsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-remove]");
  if (btn) btn.closest(".bonus-row").remove();
});
addBonusBtn.addEventListener("click", () => bonusRowsEl.appendChild(makeBonusRow()));

// ---------- view router ----------

function setView(view) {
  currentView = view;
  setupEl.hidden = view !== "setup";
  settingsEl.hidden = view !== "settings";
  gameEl.hidden = view !== "game";
  newGameBtn.hidden = view !== "game";
  if (view === "setup") populateSetup();
  if (view === "settings") populateSettings();
  if (view === "game") renderGame();
}

function render() {
  setView(state ? "game" : "setup");
}

function populateSetup() {
  setupForm.elements.us.value = settings.defaults.us;
  setupForm.elements.them.value = settings.defaults.them;
  setupForm.elements.target.value = settings.defaults.target;
  setupForm.elements.ruleBlocked.checked = settings.defaults.rules.blocked;
  setupForm.elements.ruleRoundTo5.checked = settings.defaults.rules.roundTo5;
  renderBonusRows(settings.defaults.bonuses);
}

function populateSettings() {
  photoEnabledInput.checked = !!settings.photoEnabled;
}

// ---------- game rendering ----------

function renderGame() {
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

  photoBtn.hidden = !settings.photoEnabled;

  renderBonusChips();
  renderRoundPreview();
  renderHistory();

  const w = winner(state);
  winnerEl.hidden = !w;
  winnerEl.textContent = w ? `Winner: ${state.names[w]}` : "";
}

function bonusKey(b) {
  return `${b.label}|${b.points}`;
}

function renderBonusChips() {
  const attached = new Set(draftBonuses.map(bonusKey));
  bonusChipsEl.innerHTML = "";
  state.bonuses.forEach((b) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.label = b.label;
    chip.dataset.points = String(b.points);
    if (attached.has(bonusKey(b))) chip.classList.add("attached");
    chip.innerHTML = `${escapeHtml(b.label)} <span class="chip-pts">+${b.points}</span>`;
    bonusChipsEl.appendChild(chip);
  });
}

function renderRoundPreview() {
  const hand = readHand();
  if (hand === 0 && draftBonuses.length === 0) {
    roundPreview.hidden = true;
    roundPreview.textContent = "";
    return;
  }
  const parts = [];
  if (hand > 0 || draftBonuses.length === 0) parts.push(String(hand));
  for (const b of draftBonuses) parts.push(`${b.points} ${b.label}`);
  const total = hand + draftBonuses.reduce((s, b) => s + b.points, 0);
  roundPreview.hidden = false;
  roundPreview.textContent = `${parts.join(" + ")} = ${total}`;
}

function formatBreakdown(r) {
  const parts = [];
  if (r.hand > 0 || (r.bonuses?.length ?? 0) === 0) parts.push(String(r.hand));
  for (const b of r.bonuses ?? []) parts.push(`${b.points} ${b.label}`);
  return parts.join(" + ");
}

function renderHistory() {
  historyEl.innerHTML = "";
  const lastIndex = state.rounds.length - 1;
  state.rounds.forEach((r, i) => {
    const li = document.createElement("li");
    if (i === lastIndex) li.className = "latest";
    const actions =
      i === lastIndex
        ? `<button type="button" class="row-edit" aria-label="edit round">edit</button>
           <button type="button" class="row-del" aria-label="delete round">×</button>`
        : "";
    li.innerHTML = `
      <span class="num">${i + 1}.</span>
      <span class="who" data-side="${r.winner}">${escapeHtml(state.names[r.winner])}</span>
      <span class="breakdown">${escapeHtml(formatBreakdown(r))}</span>
      <span class="pts">= ${roundTotal(r)}</span>
      <span class="row-actions">${actions}</span>
    `;
    historyEl.appendChild(li);
  });
}

// ---------- round form ----------

function readHand() {
  return Math.max(0, Number(roundForm.elements.hand.value) || 0);
}

function clearRoundForm() {
  draftBonuses = [];
  roundForm.elements.hand.value = "";
  setStatus("");
}

function editLatest() {
  const i = state.rounds.length - 1;
  if (i < 0) return;
  const r = state.rounds[i];
  draftBonuses = (r.bonuses ?? []).map((b) => ({ label: b.label, points: b.points }));
  roundForm.elements.hand.value = r.hand > 0 ? r.hand : "";
  setWinnerRadio(r.winner);
  state = undoRound(state, i);
  saveGame();
  renderGame();
  roundForm.elements.hand.focus();
}

bonusChipsEl.addEventListener("click", (e) => {
  const chip = e.target.closest("button.chip");
  if (!chip) return;
  const label = chip.dataset.label;
  const points = Number(chip.dataset.points) || 0;
  const idx = draftBonuses.findIndex((b) => b.label === label && b.points === points);
  if (idx >= 0) draftBonuses.splice(idx, 1);
  else draftBonuses.push({ label, points });
  renderBonusChips();
  renderRoundPreview();
});

roundForm.elements.hand.addEventListener("input", renderRoundPreview);

roundForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(roundForm);
  const winnerVal = fd.get("winner") === "us" ? "us" : "them";
  const hand = readHand();
  if (hand === 0 && draftBonuses.length === 0) {
    setStatus("enter a hand value or attach a bonus");
    return;
  }
  try {
    state = addRound(state, { winner: winnerVal, hand, bonuses: draftBonuses.slice() });
  } catch (err) {
    setStatus(err.message);
    return;
  }
  clearRoundForm();
  saveGame();
  renderGame();
});

historyEl.addEventListener("click", (e) => {
  if (e.target.closest("button.row-edit")) {
    editLatest();
    return;
  }
  if (e.target.closest("button.row-del")) {
    if (!confirm("delete this round?")) return;
    state = undoRound(state, state.rounds.length - 1);
    saveGame();
    renderGame();
  }
});

// ---------- setup form ----------

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
    bonuses: readBonuses(),
  });
  // whatever the user just chose is the next new-game default
  settings = {
    ...settings,
    defaults: {
      us: state.names.us,
      them: state.names.them,
      target: state.target,
      rules: { ...state.rules },
      bonuses: state.bonuses.length ? state.bonuses : DEFAULT_BONUSES,
    },
  };
  clearRoundForm();
  saveGame();
  saveSettings();
  render();
});

// ---------- settings ----------

settingsBtn.addEventListener("click", () => setView("settings"));
settingsBack.addEventListener("click", render);

photoEnabledInput.addEventListener("change", () => {
  settings.photoEnabled = !!photoEnabledInput.checked;
  saveSettings();
  if (!settings.photoEnabled) closePhotoReview();
});

// ---------- reset paths ----------

function resetGame({ wipeSettings = false, prompt } = {}) {
  if (prompt && !confirm(prompt)) return;
  state = null;
  if (wipeSettings) settings = structuredClone(DEFAULT_SETTINGS);
  clearRoundForm();
  closePhotoReview();
  saveGame();
  if (wipeSettings) saveSettings();
  render();
}

newGameBtn.addEventListener("click", () =>
  resetGame({
    prompt: state?.rounds.length
      ? "start a new game? current scores will be cleared."
      : undefined,
  }),
);

resetLink.addEventListener("click", (e) => {
  e.preventDefault();
  resetGame({ prompt: "clear current game?" });
});

settingsResetAll.addEventListener("click", () =>
  resetGame({ wipeSettings: true, prompt: "erase the current game AND all settings?" }),
);

// ---------- photo feature (lazy) ----------

let visionMod = null;
async function loadVision() {
  if (!visionMod) visionMod = await import("./vision.js");
  return visionMod;
}

photoBtn.addEventListener("click", () => {
  if (!settings.photoEnabled) return;
  photoInput.click();
});

photoInput.addEventListener("change", async () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  setStatus("loading…");
  try {
    const vision = await loadVision();
    setStatus("finding dominoes…");
    const result = await vision.analyzePhotoFile(file);
    openPhotoReview(file, result);
    setStatus("");
  } catch (err) {
    if (visionMod && err instanceof visionMod.NoTileError) {
      setStatus("no domino tile detected — take a top-down photo on a flat surface");
    } else {
      setStatus("couldn't read that photo — enter manually");
    }
  } finally {
    photoInput.value = "";
  }
});

let photoReviewUrl = null;

function openPhotoReview(file, result) {
  if (photoReviewUrl) URL.revokeObjectURL(photoReviewUrl);
  photoReviewUrl = URL.createObjectURL(file);
  photoReviewImg.src = photoReviewUrl;

  photoReviewSvg.setAttribute("viewBox", `0 0 ${result.imageWidth} ${result.imageHeight}`);
  photoReviewSvg.innerHTML = "";

  const longest = Math.max(result.imageWidth, result.imageHeight);
  const fontSize = Math.max(20, Math.round(longest * 0.05));
  const stroke = Math.max(2, Math.round(longest * 0.006));
  photoReviewSvg.style.setProperty("--tile-stroke", String(stroke));
  for (const tile of result.tiles) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "tile");
    g.dataset.pips = String(tile.pips);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", tile.x);
    rect.setAttribute("y", tile.y);
    rect.setAttribute("width", tile.width);
    rect.setAttribute("height", tile.height);
    rect.setAttribute("rx", Math.round(Math.min(tile.width, tile.height) * 0.08));
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", tile.x + tile.width / 2);
    text.setAttribute("y", tile.y + tile.height / 2);
    text.setAttribute("font-size", fontSize);
    text.textContent = String(tile.pips);
    g.append(rect, text);
    photoReviewSvg.appendChild(g);
  }
  updatePhotoReviewTotal();
  photoReview.hidden = false;
}

function updatePhotoReviewTotal() {
  let total = 0;
  for (const g of photoReviewSvg.querySelectorAll("g.tile.selected")) {
    total += Number(g.dataset.pips) || 0;
  }
  photoReviewTotal.textContent = String(total);
}

function closePhotoReview() {
  photoReview.hidden = true;
  photoReviewSvg.innerHTML = "";
  if (photoReviewUrl) {
    URL.revokeObjectURL(photoReviewUrl);
    photoReviewUrl = null;
  }
  photoReviewImg.removeAttribute("src");
}

photoReviewSvg.addEventListener("click", (e) => {
  const g = e.target.closest("g.tile");
  if (!g) return;
  g.classList.toggle("selected");
  updatePhotoReviewTotal();
});

photoReviewUse.addEventListener("click", () => {
  const total = Number(photoReviewTotal.textContent) || 0;
  roundForm.elements.hand.value = String(total);
  closePhotoReview();
  setStatus(`counted ${total} pip${total === 1 ? "" : "s"} — adjust if needed`);
  renderRoundPreview();
});

photoReviewCancel.addEventListener("click", closePhotoReview);

// ---------- multi-tab safety ----------

window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY) {
    state = loadGame();
    if (currentView === "game" || currentView === "setup") render();
  } else if (e.key === SETTINGS_KEY) {
    settings = loadSettings();
    if (currentView === "settings") populateSettings();
    else if (currentView === "game") renderGame();
  }
});

// ---------- boot ----------

render();
