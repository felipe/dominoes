import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createGame,
  addRound,
  undoRound,
  totals,
  winner,
  applyRoundingRule,
  normalizeBonuses,
  DEFAULT_BONUSES,
} from "../game.js";

test("createGame: defaults", () => {
  const g = createGame();
  assert.equal(g.names.us, "Us");
  assert.equal(g.names.them, "Them");
  assert.equal(g.target, 200);
  assert.deepEqual(g.rules, { blocked: false, roundTo5: false });
  assert.deepEqual(g.rounds, []);
  assert.deepEqual(g.bonuses, DEFAULT_BONUSES);
});

test("createGame: trims names and falls back when blank", () => {
  const g = createGame({ us: "  ", them: "Otros  " });
  assert.equal(g.names.us, "Us");
  assert.equal(g.names.them, "Otros");
});

test("createGame: clamps low targets to 50", () => {
  assert.equal(createGame({ target: 10 }).target, 50);
  assert.equal(createGame({ target: "garbage" }).target, 200);
  assert.equal(createGame({ target: 150 }).target, 150);
});

test("createGame: accepts custom bonuses and normalizes them", () => {
  const g = createGame({
    bonuses: [
      { label: "  zap ", points: "40" },
      { label: "", points: 10 },
      { label: "neg", points: -5 },
    ],
  });
  assert.deepEqual(g.bonuses, [
    { label: "zap", points: 40 },
    { label: "neg", points: 0 },
  ]);
});

test("normalizeBonuses: drops empty labels and coerces points", () => {
  assert.deepEqual(normalizeBonuses([{ label: "x", points: "3" }]), [
    { label: "x", points: 3 },
  ]);
  assert.deepEqual(normalizeBonuses(null), []);
  assert.deepEqual(normalizeBonuses(undefined), []);
});

test("applyRoundingRule: passthrough when disabled", () => {
  assert.equal(applyRoundingRule({}, 17), 17);
  assert.equal(applyRoundingRule({ roundTo5: false }, 17), 17);
});

test("applyRoundingRule: rounds to nearest 5 when enabled", () => {
  assert.equal(applyRoundingRule({ roundTo5: true }, 17), 15);
  assert.equal(applyRoundingRule({ roundTo5: true }, 18), 20);
  assert.equal(applyRoundingRule({ roundTo5: true }, 0), 0);
});

test("applyRoundingRule: clamps negatives to 0", () => {
  assert.equal(applyRoundingRule({}, -10), 0);
  assert.equal(applyRoundingRule({ roundTo5: true }, -10), 0);
});

test("addRound: appends without mutating prior state", () => {
  const g = createGame();
  const g2 = addRound(g, { winner: "us", points: 30, note: "  capi  " });
  assert.equal(g.rounds.length, 0);
  assert.equal(g2.rounds.length, 1);
  assert.equal(g2.rounds[0].winner, "us");
  assert.equal(g2.rounds[0].points, 30);
  assert.equal(g2.rounds[0].note, "capi");
});

test("addRound: applies rounding rule from state", () => {
  const g = createGame({ rules: { roundTo5: true } });
  const g2 = addRound(g, { winner: "them", points: 22 });
  assert.equal(g2.rounds[0].points, 20);
});

test("addRound: rejects invalid winner", () => {
  const g = createGame();
  assert.throws(() => addRound(g, { winner: "elf", points: 10 }), /winner/);
});

test("undoRound: removes by index without mutating prior state", () => {
  let g = createGame();
  g = addRound(g, { winner: "us", points: 10 });
  g = addRound(g, { winner: "them", points: 20 });
  g = addRound(g, { winner: "us", points: 30 });
  const g2 = undoRound(g, 1);
  assert.equal(g.rounds.length, 3);
  assert.equal(g2.rounds.length, 2);
  assert.equal(g2.rounds[0].points, 10);
  assert.equal(g2.rounds[1].points, 30);
});

test("totals: sums per side", () => {
  let g = createGame();
  g = addRound(g, { winner: "us", points: 30 });
  g = addRound(g, { winner: "them", points: 15 });
  g = addRound(g, { winner: "us", points: 20 });
  assert.deepEqual(totals(g), { us: 50, them: 15 });
});

test("winner: null below target, side once crossed", () => {
  let g = createGame({ target: 100 });
  assert.equal(winner(g), null);
  g = addRound(g, { winner: "us", points: 50 });
  assert.equal(winner(g), null);
  g = addRound(g, { winner: "us", points: 50 });
  assert.equal(winner(g), "us");
});

test("winner: detects them side crossing", () => {
  let g = createGame({ target: 100 });
  g = addRound(g, { winner: "them", points: 100 });
  assert.equal(winner(g), "them");
});
