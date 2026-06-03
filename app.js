import {
  createGame,
  addRound,
  editRound,
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

const setupEl = $("#setup");
const settingsEl = $("#settings");
const gameEl = $("#game");
const setupForm = $("#setupForm");
const roundForm = $("#roundForm");
const historyEl = $("#history");
const winnerEl = $("#winner");
const newGameBtn = $("#newGameBtn");
const settingsBtn = $("#settingsBtn");
const settingsBack = $("#settingsBack");
const settingsSave = $("#settingsSave");
const settingsSavedHint = $("#settingsSaved");
const settingsResetAll = $("#settingsResetAll");
const resetLink = $("#resetLink");
const setupBonusRows = $("#setupBonusRows");
const setupAddBonusBtn = $("#setupAddBonusBtn");
const settingsBonusRows = $("#settingsBonusRows");
const settingsAddBonusBtn = $("#settingsAddBonusBtn");
const bonusChipsEl = $("#bonusChips");
const roundPreview = $("#roundPreview");
const editIndicator = $("#editIndicator");
const editCancel = $("#editCancel");

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
const photoReview = $("#photoReview");
const photoReviewImg = $("#photoReviewImg");
const photoReviewSvg = $("#photoReviewSvg");
const photoReviewTotal = $("#photoReviewTotal");
const photoReviewCancel = $("#photoReviewCancel");
const photoReviewUse = $("#photoReviewUse");

const photoEnabledInput = $("#photoEnabled");
const defUs = $("#defUs");
const defThem = $("#defThem");
const defTarget = $("#defTarget");
const defRuleBlocked = $("#defRuleBlocked");
const defRuleRoundTo5 = $("#defRuleRoundTo5");

let settings = loadSettings();
let state = loadGame();
let attachedBonuses = []; // bonuses staged on the round form
let editingIndex = null; // index of the round we are editing, or null

function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveGame() {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable — keep playing in-memory
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return cloneSettings(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    return mergeSettings(parsed);
  } catch {
    return cloneSettings(DEFAULT_SETTINGS);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

function cloneSettings(s) {
  return JSON.parse(JSON.stringify(s));
}

function mergeSettings(parsed) {
  const out = cloneSettings(DEFAULT_SETTINGS);
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

// ---------- bonus row helpers (shared between setup and settings) ----------

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

function renderBonusRows(container, bonuses) {
  container.innerHTML = "";
  bonuses.forEach((b) => container.appendChild(makeBonusRow(b.label, b.points)));
}

function readBonusesFrom(container) {
  const out = [];
  container.querySelectorAll(".bonus-row").forEach((row) => {
    out.push({
      label: row.querySelector('[data-bonus="label"]').value,
      points: row.querySelector('[data-bonus="points"]').value,
    });
  });
  return normalizeBonuses(out);
}

setupBonusRows.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-remove]");
  if (btn) btn.closest(".bonus-row").remove();
});
settingsBonusRows.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-remove]");
  if (btn) btn.closest(".bonus-row").remove();
});
setupAddBonusBtn.addEventListener("click", () => setupBonusRows.appendChild(makeBonusRow()));
settingsAddBonusBtn.addEventListener("click", () => settingsBonusRows.appendChild(makeBonusRow()));

// ---------- view switching ----------

function showSetup() {
  setupEl.hidden = false;
  settingsEl.hidden = true;
  gameEl.hidden = true;
  newGameBtn.hidden = true;
  // pre-fill from settings defaults
  setupForm.elements.us.value = settings.defaults.us;
  setupForm.elements.them.value = settings.defaults.them;
  setupForm.elements.target.value = settings.defaults.target;
  setupForm.elements.ruleBlocked.checked = settings.defaults.rules.blocked;
  setupForm.elements.ruleRoundTo5.checked = settings.defaults.rules.roundTo5;
  renderBonusRows(setupBonusRows, settings.defaults.bonuses);
}

function showSettings() {
  setupEl.hidden = true;
  settingsEl.hidden = false;
  gameEl.hidden = true;
  newGameBtn.hidden = true;
  photoEnabledInput.checked = !!settings.photoEnabled;
  defUs.value = settings.defaults.us;
  defThem.value = settings.defaults.them;
  defTarget.value = settings.defaults.target;
  defRuleBlocked.checked = settings.defaults.rules.blocked;
  defRuleRoundTo5.checked = settings.defaults.rules.roundTo5;
  renderBonusRows(settingsBonusRows, settings.defaults.bonuses);
  settingsSavedHint.hidden = true;
}

function showGame() {
  setupEl.hidden = true;
  settingsEl.hidden = true;
  gameEl.hidden = false;
  newGameBtn.hidden = false;
  renderGame();
}

function render() {
  if (!state) showSetup();
  else showGame();
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
  if (w) {
    winnerEl.hidden = false;
    winnerEl.textContent = `Winner: ${state.names[w]}`;
  } else {
    winnerEl.hidden = true;
    winnerEl.textContent = "";
  }

  editIndicator.hidden = editingIndex === null;
}

function renderBonusChips() {
  bonusChipsEl.innerHTML = "";
  state.bonuses.forEach((b) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.label = b.label;
    chip.dataset.points = String(b.points);
    if (isBonusAttached(b)) chip.classList.add("attached");
    chip.innerHTML = `${escapeHtml(b.label)} <span class="chip-pts">+${b.points}</span>`;
    bonusChipsEl.appendChild(chip);
  });
}

function isBonusAttached(b) {
  return attachedBonuses.some((a) => a.label === b.label && a.points === b.points);
}

function renderRoundPreview() {
  const handStr = roundForm.elements.hand.value;
  const hand = Math.max(0, Number(handStr) || 0);
  const parts = [];
  if (hand > 0 || attachedBonuses.length === 0) parts.push(String(hand));
  for (const b of attachedBonuses) parts.push(`${b.points} ${b.label}`);
  const total = hand + attachedBonuses.reduce((s, b) => s + b.points, 0);
  if (total === 0 && attachedBonuses.length === 0) {
    roundPreview.hidden = true;
    roundPreview.textContent = "";
    return;
  }
  roundPreview.hidden = false;
  roundPreview.textContent = `${parts.join(" + ")} = ${total}`;
}

function renderHistory() {
  historyEl.innerHTML = "";
  const lastIndex = state.rounds.length - 1;
  state.rounds.forEach((r, i) => {
    const li = document.createElement("li");
    li.className = i === lastIndex ? "latest" : "";
    const num = i + 1;
    const breakdown = formatBreakdown(r);
    const total = roundTotal(r);
    const who = escapeHtml(state.names[r.winner]);
    const actions =
      i === lastIndex
        ? `<button type="button" class="row-edit" data-i="${i}" aria-label="edit round">edit</button>
           <button type="button" class="row-del" data-i="${i}" aria-label="delete round">×</button>`
        : "";
    li.innerHTML = `
      <span class="num">${num}.</span>
      <span class="who" data-side="${r.winner}">${who}</span>
      <span class="breakdown">${escapeHtml(breakdown)}</span>
      <span class="pts">= ${total}</span>
      <span class="row-actions">${actions}</span>
    `;
    historyEl.appendChild(li);
  });
}

function formatBreakdown(r) {
  const parts = [];
  if (r.hand > 0 || (r.bonuses?.length ?? 0) === 0) parts.push(String(r.hand));
  for (const b of r.bonuses ?? []) parts.push(`${b.points} ${b.label}`);
  return parts.join(" + ");
}

// ---------- round form behavior ----------

function readHand() {
  return Math.max(0, Number(roundForm.elements.hand.value) || 0);
}

function clearRoundForm() {
  attachedBonuses = [];
  roundForm.elements.hand.value = "";
  // do not clear winner radio — usually the same opponent wins streaks; user can flip
  photoStatus.hidden = true;
  photoStatus.textContent = "";
  editingIndex = null;
}

function startEdit(index) {
  const r = state.rounds[index];
  editingIndex = index;
  roundForm.elements.hand.value = r.hand > 0 ? r.hand : "";
  const radio = roundForm.elements.winner;
  if (radio) {
    for (const el of radio) if (el.value === r.winner) el.checked = true;
  }
  attachedBonuses = (r.bonuses ?? []).map((b) => ({ label: b.label, points: b.points }));
  renderGame();
  roundForm.elements.hand.focus();
}

function cancelEdit() {
  clearRoundForm();
  renderGame();
}

bonusChipsEl.addEventListener("click", (e) => {
  const chip = e.target.closest("button.chip");
  if (!chip) return;
  const label = chip.dataset.label;
  const points = Number(chip.dataset.points) || 0;
  const idx = attachedBonuses.findIndex((b) => b.label === label && b.points === points);
  if (idx >= 0) attachedBonuses.splice(idx, 1);
  else attachedBonuses.push({ label, points });
  renderBonusChips();
  renderRoundPreview();
});

roundForm.elements.hand.addEventListener("input", () => {
  renderRoundPreview();
});

roundForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(roundForm);
  const winnerVal = fd.get("winner") === "us" ? "us" : "them";
  const hand = readHand();
  if (hand === 0 && attachedBonuses.length === 0) {
    photoStatus.hidden = false;
    photoStatus.textContent = "enter a hand value or attach a bonus";
    return;
  }
  try {
    if (editingIndex !== null) {
      state = editRound(state, editingIndex, {
        winner: winnerVal,
        hand,
        bonuses: attachedBonuses.slice(),
      });
    } else {
      state = addRound(state, {
        winner: winnerVal,
        hand,
        bonuses: attachedBonuses.slice(),
      });
    }
  } catch (err) {
    photoStatus.hidden = false;
    photoStatus.textContent = err.message;
    return;
  }
  clearRoundForm();
  // keep winner radio set to current value for fast streak entry
  saveGame();
  renderGame();
});

historyEl.addEventListener("click", (e) => {
  const editBtn = e.target.closest("button.row-edit");
  if (editBtn) {
    startEdit(Number(editBtn.dataset.i));
    return;
  }
  const delBtn = e.target.closest("button.row-del");
  if (delBtn) {
    const i = Number(delBtn.dataset.i);
    if (!confirm("delete this round?")) return;
    state = undoRound(state, i);
    if (editingIndex === i) clearRoundForm();
    saveGame();
    renderGame();
    return;
  }
});

editCancel.addEventListener("click", cancelEdit);

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
    bonuses: readBonusesFrom(setupBonusRows),
  });
  clearRoundForm();
  saveGame();
  render();
});

// ---------- settings ----------

settingsBtn.addEventListener("click", () => {
  showSettings();
});

settingsBack.addEventListener("click", () => {
  render();
});

settingsSave.addEventListener("click", () => {
  settings = {
    photoEnabled: !!photoEnabledInput.checked,
    defaults: {
      us: defUs.value.trim() || "Us",
      them: defThem.value.trim() || "Them",
      target: Math.max(50, Number(defTarget.value) || 200),
      rules: {
        blocked: !!defRuleBlocked.checked,
        roundTo5: !!defRuleRoundTo5.checked,
      },
      bonuses: readBonusesFrom(settingsBonusRows),
    },
  };
  saveSettings();
  settingsSavedHint.hidden = false;
  setTimeout(() => { settingsSavedHint.hidden = true; }, 1500);
});

photoEnabledInput.addEventListener("change", () => {
  // live-apply the toggle so the photo button hides/shows in the open game
  settings.photoEnabled = !!photoEnabledInput.checked;
  saveSettings();
  if (!settings.photoEnabled) closePhotoReview();
});

settingsResetAll.addEventListener("click", () => {
  if (!confirm("erase the current game AND all settings?")) return;
  state = null;
  settings = cloneSettings(DEFAULT_SETTINGS);
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  try { localStorage.removeItem(SETTINGS_KEY); } catch {}
  clearRoundForm();
  render();
});

// ---------- new game / reset ----------

newGameBtn.addEventListener("click", () => {
  if (
    state &&
    state.rounds.length &&
    !confirm("start a new game? current scores will be cleared.")
  )
    return;
  state = null;
  clearRoundForm();
  closePhotoReview();
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  render();
});

resetLink.addEventListener("click", (e) => {
  e.preventDefault();
  if (!confirm("clear current game?")) return;
  state = null;
  clearRoundForm();
  closePhotoReview();
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  render();
});

// ---------- photo feature (lazy) ----------

let visionPromise = null;
async function loadVision() {
  if (!visionPromise) visionPromise = import("./vision.js");
  return visionPromise;
}

photoBtn.addEventListener("click", () => {
  if (!settings.photoEnabled) return;
  photoInput.click();
});

photoInput.addEventListener("change", async () => {
  const file = photoInput.files && photoInput.files[0];
  if (!file) return;
  photoStatus.hidden = false;
  photoStatus.textContent = "loading…";
  try {
    const vision = await loadVision();
    photoStatus.textContent = "finding dominoes…";
    const result = await vision.analyzePhotoFile(file);
    openPhotoReview(file, result);
    photoStatus.hidden = true;
  } catch (err) {
    const vision = await loadVision().catch(() => null);
    if (vision && err instanceof vision.NoTileError) {
      photoStatus.textContent =
        "no domino tile detected — take a top-down photo on a flat surface";
    } else {
      photoStatus.textContent = "couldn't read that photo — enter manually";
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

  const vb = `0 0 ${result.imageWidth} ${result.imageHeight}`;
  photoReviewSvg.setAttribute("viewBox", vb);
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
  photoStatus.hidden = false;
  photoStatus.textContent = `counted ${total} pip${total === 1 ? "" : "s"} — adjust if needed`;
  renderRoundPreview();
});

photoReviewCancel.addEventListener("click", closePhotoReview);

// ---------- multi-tab safety ----------

window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY) {
    state = loadGame();
    render();
  } else if (e.key === SETTINGS_KEY) {
    settings = loadSettings();
    render();
  }
});

// ---------- boot ----------

render();
