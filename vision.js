// Pip counter for dominoes photos. Dependency-free.
//
// Pipeline:
//   downsample → grayscale → find tile face regions (bright connected
//   components, rectangular, away from frame edges) → for each region,
//   run local Otsu and find dark blobs that look like pips → sum.
//
// Falls back to a global pass when no tile region is detected.

export const DEFAULTS = {
  width: 320,
  // Tile-face filters (relative to whole image).
  tileMinArea: 0.03,
  tileMaxArea: 0.85,
  tileMinRectFill: 0.55, // blob area / bounding-box area
  // Pip filters (relative to tile region area).
  pipMinAreaFrac: 0.0008,
  pipMaxAreaFrac: 0.05,
  pipMinRoundness: 0.55,
};

export async function countPipsFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return countPipsFromImage(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function countPipsFromImage(img, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const W = cfg.width;
  const scale = W / img.width;
  const H = Math.max(1, Math.round(img.height * scale));
  const cnv = document.createElement("canvas");
  cnv.width = W;
  cnv.height = H;
  const ctx = cnv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const gray = grayscaleFromRGBA(data);
  return countPipsFromGray(gray, W, H, cfg);
}

export function grayscaleFromRGBA(data) {
  const gray = new Uint8ClampedArray(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  return gray;
}

export function countPipsFromGray(gray, W, H, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const regions = findTileRegions(gray, W, H, cfg);
  if (regions.length === 0) {
    return countPipsInRegion(gray, W, H, fullRegion(W, H), cfg);
  }
  let total = 0;
  for (const r of regions) total += countPipsInRegion(gray, W, H, r, cfg);
  return total;
}

function fullRegion(W, H) {
  return { minX: 0, minY: 0, maxX: W - 1, maxY: H - 1, size: W * H };
}

export function findTileRegions(gray, W, H, cfg = DEFAULTS) {
  const t = otsuArr(gray);
  const bright = new Uint8Array(W * H);
  for (let i = 0; i < gray.length; i++) bright[i] = gray[i] >= t ? 1 : 0;
  const blobs = labelComponents(bright, W, H);
  const imageArea = W * H;
  return blobs.filter((b) => {
    if (b.size < imageArea * cfg.tileMinArea) return false;
    if (b.size > imageArea * cfg.tileMaxArea) return false;
    const bw = b.maxX - b.minX + 1;
    const bh = b.maxY - b.minY + 1;
    const bbox = bw * bh;
    if (bbox === 0) return false;
    if (b.size / bbox < cfg.tileMinRectFill) return false;
    // discard a single blob that hugs all four edges (likely full-frame background)
    if (
      b.minX === 0 &&
      b.minY === 0 &&
      b.maxX === W - 1 &&
      b.maxY === H - 1
    ) {
      return false;
    }
    return true;
  });
}

export function countPipsInRegion(gray, W, H, region, cfg = DEFAULTS) {
  const insideValues = [];
  for (let y = region.minY; y <= region.maxY; y++) {
    for (let x = region.minX; x <= region.maxX; x++) {
      insideValues.push(gray[y * W + x]);
    }
  }
  if (insideValues.length === 0) return 0;
  const t = otsuArr(insideValues);
  const dark = new Uint8Array(W * H);
  for (let y = region.minY; y <= region.maxY; y++) {
    for (let x = region.minX; x <= region.maxX; x++) {
      const i = y * W + x;
      dark[i] = gray[i] < t ? 1 : 0;
    }
  }
  const blobs = labelComponents(dark, W, H);
  const regionArea =
    (region.maxX - region.minX + 1) * (region.maxY - region.minY + 1);
  const minA = Math.max(6, regionArea * cfg.pipMinAreaFrac);
  const maxA = regionArea * cfg.pipMaxAreaFrac;
  return blobs.filter((b) => {
    if (b.size < minA || b.size > maxA) return false;
    if (roundness(b) < cfg.pipMinRoundness) return false;
    return true;
  }).length;
}

export function otsuArr(values) {
  const hist = new Array(256).fill(0);
  for (const v of values) hist[v]++;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let bestMB = 0;
  let bestMF = 0;
  let threshold = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > maxVar) {
      maxVar = v;
      threshold = i;
      bestMB = mB;
      bestMF = mF;
    }
  }
  // Place threshold midway between the two class means so it lands in the
  // gap, not on a mode. Important for clean bimodal images where Otsu's
  // raw argmax sits at the lower cluster value.
  if (maxVar > 0) {
    threshold = Math.round((bestMB + bestMF) / 2);
  }
  return threshold;
}

export function labelComponents(mask, W, H) {
  const seen = new Uint8Array(W * H);
  const blobs = [];
  const stack = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!mask[idx] || seen[idx]) continue;
      let size = 0;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      stack.length = 0;
      stack.push(idx);
      while (stack.length) {
        const p = stack.pop();
        if (seen[p]) continue;
        seen[p] = 1;
        size++;
        const px = p % W;
        const py = (p - px) / W;
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
        if (px > 0 && mask[p - 1] && !seen[p - 1]) stack.push(p - 1);
        if (px < W - 1 && mask[p + 1] && !seen[p + 1]) stack.push(p + 1);
        if (py > 0 && mask[p - W] && !seen[p - W]) stack.push(p - W);
        if (py < H - 1 && mask[p + W] && !seen[p + W]) stack.push(p + W);
      }
      blobs.push({ size, minX, minY, maxX, maxY });
    }
  }
  return blobs;
}

export function roundness(b) {
  const w = b.maxX - b.minX + 1;
  const h = b.maxY - b.minY + 1;
  const bbox = w * h;
  if (bbox <= 0) return 0;
  const fill = b.size / bbox;
  const ratio = Math.min(w, h) / Math.max(w, h);
  return fill * ratio;
}
