// Naive pip counter for dominoes photos.
//
// Pipeline: downsample → grayscale → Otsu threshold → connected components →
// filter components by size and roundness → count survivors.
//
// This is intentionally dependency-free. It works best on flat, well-lit
// photos of a single hand against a plain background. Real-table photos will
// be wrong often — treat the number as a suggestion and adjust.

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

export function countPipsFromImage(img) {
  const W = 320;
  const scale = W / img.width;
  const H = Math.max(1, Math.round(img.height * scale));
  const cnv = document.createElement("canvas");
  cnv.width = W;
  cnv.height = H;
  const ctx = cnv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);

  const gray = new Uint8ClampedArray(W * H);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  const t = otsu(gray);
  const dark = new Uint8Array(W * H);
  for (let i = 0; i < gray.length; i++) dark[i] = gray[i] < t ? 1 : 0;

  const blobs = labelComponents(dark, W, H);
  const area = W * H;
  const minA = Math.max(8, area * 0.0002);
  const maxA = area * 0.006;
  const pips = blobs.filter(
    (b) => b.size >= minA && b.size <= maxA && roundness(b) > 0.55,
  );
  return pips.length;
}

function otsu(gray) {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
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
    }
  }
  return threshold;
}

function labelComponents(dark, W, H) {
  const seen = new Uint8Array(W * H);
  const blobs = [];
  const stack = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!dark[idx] || seen[idx]) continue;
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
        if (px > 0 && dark[p - 1] && !seen[p - 1]) stack.push(p - 1);
        if (px < W - 1 && dark[p + 1] && !seen[p + 1]) stack.push(p + 1);
        if (py > 0 && dark[p - W] && !seen[p - W]) stack.push(p - W);
        if (py < H - 1 && dark[p + W] && !seen[p + W]) stack.push(p + W);
      }
      blobs.push({ size, minX, minY, maxX, maxY });
    }
  }
  return blobs;
}

function roundness(b) {
  const w = b.maxX - b.minX + 1;
  const h = b.maxY - b.minY + 1;
  const bbox = w * h;
  if (bbox <= 0) return 0;
  const fill = b.size / bbox;
  const ratio = Math.min(w, h) / Math.max(w, h);
  return fill * ratio;
}
