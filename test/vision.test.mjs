import { test } from "node:test";
import assert from "node:assert/strict";

import {
  otsuArr,
  labelComponents,
  roundness,
  findTileRegions,
  countPipsFromGray,
  grayscaleFromRGBA,
  NoTileError,
} from "../vision.js";

// ---------- helpers ----------

function makeGray(W, H, fill = 255) {
  const g = new Uint8ClampedArray(W * H);
  g.fill(fill);
  return g;
}

function fillRect(gray, W, x0, y0, x1, y1, value) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      gray[y * W + x] = value;
    }
  }
}

function fillCircle(gray, W, H, cx, cy, r, value) {
  for (let y = Math.max(0, cy - r); y < Math.min(H, cy + r + 1); y++) {
    for (let x = Math.max(0, cx - r); x < Math.min(W, cx + r + 1); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) gray[y * W + x] = value;
    }
  }
}

function drawDomino({
  W = 320,
  H = 160,
  bg = 30, // dark background
  tile = 230, // light tile face
  pip = 20, // dark pips
  tileX0 = 40,
  tileY0 = 30,
  tileX1 = 280,
  tileY1 = 130,
  patternA = [],
  patternB = [],
  pipRadius = 6,
} = {}) {
  const gray = makeGray(W, H, bg);
  fillRect(gray, W, tileX0, tileY0, tileX1, tileY1, tile);
  // divider line — drawn vertically through tile center
  const midX = (tileX0 + tileX1) >> 1;
  fillRect(gray, W, midX - 1, tileY0, midX + 1, tileY1, pip);
  const halfW = midX - tileX0;
  const halfH = tileY1 - tileY0;
  const placePip = (ox, [u, v]) => {
    const px = ox + Math.round(u * halfW);
    const py = tileY0 + Math.round(v * halfH);
    fillCircle(gray, W, H, px, py, pipRadius, pip);
  };
  for (const p of patternA) placePip(tileX0, p);
  for (const p of patternB) placePip(midX, p);
  return { gray, W, H };
}

const P = {
  0: [],
  1: [[0.5, 0.5]],
  2: [[0.3, 0.3], [0.7, 0.7]],
  3: [[0.3, 0.3], [0.5, 0.5], [0.7, 0.7]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
  6: [[0.3, 0.25], [0.7, 0.25], [0.3, 0.5], [0.7, 0.5], [0.3, 0.75], [0.7, 0.75]],
};

// ---------- otsu ----------

test("otsuArr: bimodal histogram lands threshold between modes", () => {
  const arr = [];
  for (let i = 0; i < 1000; i++) arr.push(40);
  for (let i = 0; i < 1000; i++) arr.push(200);
  const t = otsuArr(arr);
  assert.ok(t > 40 && t < 200, `expected 40 < t < 200, got ${t}`);
});

test("otsuArr: handles all-same input without crashing", () => {
  const t = otsuArr(new Array(100).fill(128));
  assert.equal(typeof t, "number");
});

// ---------- labelComponents ----------

test("labelComponents: counts isolated blobs", () => {
  const W = 10;
  const H = 10;
  const m = new Uint8Array(W * H);
  m[0] = 1;
  m[2] = 1; // separate
  m[22] = 1; // another, isolated
  m[55] = 1;
  m[56] = 1; // pair, counts as one blob
  const blobs = labelComponents(m, W, H);
  assert.equal(blobs.length, 4);
});

test("labelComponents: bounding box is correct", () => {
  const W = 6;
  const H = 6;
  const m = new Uint8Array(W * H);
  // an L-shape at rows 1-3, cols 1-2
  [7, 8, 13, 14, 19, 20].forEach((i) => (m[i] = 1));
  const [b] = labelComponents(m, W, H);
  assert.deepEqual(
    { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY, size: b.size },
    { minX: 1, minY: 1, maxX: 2, maxY: 3, size: 6 },
  );
});

// ---------- roundness ----------

test("roundness: square fills bbox", () => {
  assert.equal(roundness({ minX: 0, minY: 0, maxX: 9, maxY: 9, size: 100 }), 1);
});

test("roundness: skinny line is low", () => {
  const r = roundness({ minX: 0, minY: 0, maxX: 19, maxY: 0, size: 20 });
  assert.ok(r < 0.1, `expected < 0.1, got ${r}`);
});

// ---------- grayscaleFromRGBA ----------

test("grayscaleFromRGBA: averages channels", () => {
  const data = new Uint8ClampedArray([90, 180, 0, 255, 0, 0, 0, 255]);
  const g = grayscaleFromRGBA(data);
  assert.equal(g[0], 90);
  assert.equal(g[1], 0);
});

// ---------- findTileRegions ----------

test("findTileRegions: locates the bright tile face on dark background", () => {
  const { gray, W, H } = drawDomino({ patternA: P[2], patternB: P[3] });
  const regions = findTileRegions(gray, W, H);
  // A tile with a pip-colored divider may split into two half-regions —
  // that's fine; we just want every region inside the tile's footprint.
  assert.ok(regions.length >= 1 && regions.length <= 2);
  for (const r of regions) {
    assert.ok(r.minX > 20, "region should not hug the left edge");
    assert.ok(r.maxX < W - 20, "region should not hug the right edge");
  }
});

test("findTileRegions: finds three tiles in a hand", () => {
  const W = 600;
  const H = 200;
  const gray = makeGray(W, H, 60); // dark felt
  // three tiles
  for (let t = 0; t < 3; t++) {
    const x0 = 30 + t * 190;
    fillRect(gray, W, x0, 30, x0 + 170, 170, 230);
  }
  const regions = findTileRegions(gray, W, H);
  assert.equal(regions.length, 3);
});

// ---------- end-to-end pipeline on synthetic grays ----------

test("countPipsFromGray: 0-0 returns 0", () => {
  const { gray, W, H } = drawDomino({ patternA: P[0], patternB: P[0] });
  assert.equal(countPipsFromGray(gray, W, H), 0);
});

test("countPipsFromGray: 6-6 returns 12", () => {
  const { gray, W, H } = drawDomino({ patternA: P[6], patternB: P[6] });
  assert.equal(countPipsFromGray(gray, W, H), 12);
});

test("countPipsFromGray: 5-4 returns 9", () => {
  const { gray, W, H } = drawDomino({ patternA: P[5], patternB: P[4] });
  assert.equal(countPipsFromGray(gray, W, H), 9);
});

test("countPipsFromGray: 6-3 returns 9 (was a stress-test failure pre-fix)", () => {
  const { gray, W, H } = drawDomino({ patternA: P[6], patternB: P[3] });
  assert.equal(countPipsFromGray(gray, W, H), 9);
});

test("countPipsFromGray: throws NoTileError when no tile face is found", () => {
  // A uniformly dark image — no bright tile face to detect.
  const W = 200;
  const H = 100;
  const gray = makeGray(W, H, 30);
  assert.throws(() => countPipsFromGray(gray, W, H), NoTileError);
});

test("countPipsFromGray: three-tile hand on felt sums correctly", () => {
  const W = 900;
  const H = 220;
  const gray = makeGray(W, H, 50);
  const tiles = [
    [P[5], P[4]], // 9
    [P[6], P[2]], // 8
    [P[3], P[3]], // 6
  ];
  tiles.forEach(([a, b], i) => {
    const t = drawDomino({
      W: 280,
      H: 200,
      tileX0: 20,
      tileY0: 10,
      tileX1: 260,
      tileY1: 190,
      patternA: a,
      patternB: b,
      bg: 50,
    });
    // copy into the big image at offset
    const x0 = 20 + i * 290;
    for (let y = 0; y < 200; y++) {
      for (let x = 0; x < 280; x++) {
        gray[(10 + y) * W + (x0 + x)] = t.gray[y * 280 + x];
      }
    }
  });
  assert.equal(countPipsFromGray(gray, W, H), 9 + 8 + 6);
});
