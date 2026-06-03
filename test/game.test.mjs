import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createGame,
  addRound,
  undoRound,
  totals,
  winner,
  roundTotal,
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

test("roundTotal: hand plus all bonus points", () => {
  assert.equal(
    roundTotal({ hand: 30, bonuses: [{ label: "capicúa", points: 30 }] }),
    60,
  );
  assert.equal(
    roundTotal({
      hand: 30,
      bonuses: [
        { label: "capicúa", points: 30 },
        { label: "pase", points: 25 },
      ],
    }),
    85,
  );
  assert.equal(roundTotal({ hand: 0, bonuses: [{ label: "x", points: 50 }] }), 50);
  assert.equal(roundTotal({ hand: 42, bonuses: [] }), 42);
});

test("addRound: appends without mutating prior state", () => {
  const g = createGame();
  const g2 = addRound(g, {
    winner: "us",
    hand: 30,
    bonuses: [{ label: "capicúa", points: 30 }],
  });
  assert.equal(g.rounds.length, 0);
  assert.equal(g2.rounds.length, 1);
  assert.equal(g2.rounds[0].winner, "us");
  assert.equal(g2.rounds[0].hand, 30);
  assert.deepEqual(g2.rounds[0].bonuses, [{ label: "capicúa", points: 30 }]);
  assert.equal(typeof g2.rounds[0].at, "number");
});

test("addRound: multiple bonuses stack individually", () => {
  const g = addRound(createGame(), {
    winner: "them",
    hand: 20,
    bonuses: [
      { label: "capicúa", points: 30 },
      { label: "pase", points: 25 },
    ],
  });
  assert.equal(g.rounds[0].bonuses.length, 2);
  assert.equal(roundTotal(g.rounds[0]), 75);
});

test("addRound: bonus-only round (hand=0) allowed", () => {
  const g = addRound(createGame(), {
    winner: "us",
    hand: 0,
    bonuses: [{ label: "capicúa", points: 30 }],
  });
  assert.equal(g.rounds[0].hand, 0);
  assert.equal(roundTotal(g.rounds[0]), 30);
});

test("addRound: empty round (no hand, no bonuses) rejected", () => {
  assert.throws(
    () => addRound(createGame(), { winner: "us", hand: 0, bonuses: [] }),
    /hand|bonus/,
  );
});

test("addRound: applies rounding rule to hand", () => {
  const g = createGame({ rules: { roundTo5: true } });
  const g2 = addRound(g, { winner: "them", hand: 22 });
  assert.equal(g2.rounds[0].hand, 20);
});

test("addRound: rejects invalid winner", () => {
  const g = createGame();
  assert.throws(
    () => addRound(g, { winner: "elf", hand: 10 }),
    /winner/,
  );
});

test("addRound: sanitizes bonus labels and points", () => {
  const g = addRound(createGame(), {
    winner: "us",
    hand: 10,
    bonuses: [
      { label: " trim ", points: "30" },
      { label: "", points: 10 },
      { label: "neg", points: -5 },
    ],
  });
  assert.deepEqual(g.rounds[0].bonuses, [
    { label: "trim", points: 30 },
    { label: "neg", points: 0 },
  ]);
});

test("undoRound: removes by index without mutating prior state", () => {
  let g = createGame();
  g = addRound(g, { winner: "us", hand: 10 });
  g = addRound(g, { winner: "them", hand: 20 });
  g = addRound(g, { winner: "us", hand: 30 });
  const g2 = undoRound(g, 1);
  assert.equal(g.rounds.length, 3);
  assert.equal(g2.rounds.length, 2);
  assert.equal(g2.rounds[0].hand, 10);
  assert.equal(g2.rounds[1].hand, 30);
});

test("totals: sums hand + bonuses per side", () => {
  let g = createGame();
  g = addRound(g, {
    winner: "us",
    hand: 30,
    bonuses: [{ label: "capicúa", points: 30 }],
  });
  g = addRound(g, { winner: "them", hand: 15 });
  g = addRound(g, {
    winner: "us",
    hand: 20,
    bonuses: [{ label: "pase", points: 25 }],
  });
  assert.deepEqual(totals(g), { us: 105, them: 15 });
});

test("winner: null below target, side once crossed", () => {
  let g = createGame({ target: 100 });
  assert.equal(winner(g), null);
  g = addRound(g, { winner: "us", hand: 50 });
  assert.equal(winner(g), null);
  g = addRound(g, { winner: "us", hand: 50 });
  assert.equal(winner(g), "us");
});

test("winner: detects them side crossing via bonus", () => {
  let g = createGame({ target: 100 });
  g = addRound(g, {
    winner: "them",
    hand: 70,
    bonuses: [{ label: "domino", points: 50 }],
  });
  assert.equal(winner(g), "them");
});
