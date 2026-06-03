export const DEFAULT_BONUSES = [
  { label: "capicúa", points: 30 },
  { label: "pase", points: 25 },
  { label: "domino", points: 50 },
];

export function createGame({
  us = "Us",
  them = "Them",
  target = 200,
  rules = {},
  bonuses,
} = {}) {
  return {
    names: {
      us: String(us).trim() || "Us",
      them: String(them).trim() || "Them",
    },
    target: Math.max(50, Number(target) || 200),
    rules: {
      blocked: !!rules.blocked,
      roundTo5: !!rules.roundTo5,
    },
    bonuses: normalizeBonuses(bonuses ?? DEFAULT_BONUSES),
    rounds: [],
    startedAt: Date.now(),
  };
}

export function normalizeBonuses(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((b) => ({
      label: String(b?.label ?? "").trim(),
      points: Math.max(0, Number(b?.points) || 0),
    }))
    .filter((b) => b.label.length > 0);
}

export function applyRoundingRule(rules, points) {
  const p = Math.max(0, Number(points) || 0);
  return rules && rules.roundTo5 ? Math.round(p / 5) * 5 : p;
}

export function roundTotal(round) {
  const hand = Math.max(0, Number(round?.hand) || 0);
  const bonusSum = (round?.bonuses ?? []).reduce(
    (s, b) => s + (Number(b?.points) || 0),
    0,
  );
  return hand + bonusSum;
}

export function addRound(state, { winner, hand = 0, bonuses = [] }) {
  if (winner !== "us" && winner !== "them") {
    throw new Error("winner must be 'us' or 'them'");
  }
  const round = {
    winner,
    hand: applyRoundingRule(state.rules, hand),
    bonuses: normalizeBonuses(bonuses),
    at: Date.now(),
  };
  if (round.hand === 0 && round.bonuses.length === 0) {
    throw new Error("round must have a hand value or at least one bonus");
  }
  return { ...state, rounds: [...state.rounds, round] };
}

export function undoRound(state, index) {
  const rounds = state.rounds.slice();
  rounds.splice(index, 1);
  return { ...state, rounds };
}

export function totals(state) {
  const t = { us: 0, them: 0 };
  for (const r of state.rounds) t[r.winner] += roundTotal(r);
  return t;
}

export function winner(state) {
  const t = totals(state);
  if (t.us >= state.target && t.us >= t.them) return "us";
  if (t.them >= state.target && t.them >= t.us) return "them";
  return null;
}
