# dominoes

A tiny, zero-runtime-dependency dominoes score tracker. Static site, hosted on GitHub Pages.

- Set the two sides, the target score, and optional rules (blocked-hand counting, round-to-5).
- Customize **bonus buttons** (defaults: capicúa +30, pase +25, domino +50) at setup time.
- Add a round in **one line**: pick the winning side with the rocker, enter points, hit `+`. Bonus chips pre-fill points. Or tap the camera button to count pips from a photo.
- Running totals, undo per round, win detection.
- State auto-saves to `localStorage`. Refresh-safe.

## Local

```
npm test      # run the Node test suite
npm run serve # python3 -m http.server 8000
```

…then visit `http://localhost:8000`.

## Tests

`game.js` is pure logic and has Node test coverage in `test/`. Run them via `npm test` (uses the built-in `node:test` runner — no dev dependencies). CI runs them on every push and PR (`.github/workflows/test.yml`).

## Photo pip counting

The camera button on the round row opens the camera (mobile) or file picker. The `vision.js` pipeline runs entirely in the browser — no upload, no library:

1. Find bright tile-face regions on the photo.
2. Stitch back the two halves of each tile that the divider line split apart.
3. Inside each tile, run a local Otsu threshold and count blobs that look like pips (size and roundness filters).

The photo opens a review panel: the original image with one outline per detected domino. **Nothing is selected by default** — this is end-of-match accounting, so you tap each domino in the loser's hand to count it. Selected tiles fill yellow and show their pip count; the running total updates live. Hit `use` to send the total into the round's points field, or `cancel` to drop it.

**Take the photo top-down on a flat surface.** That's the supported case. If no tile face is detected the app says so and waits for you to retry or enter the points manually. The per-tile count is a suggestion — adjust before adding the round if a tile was misread.

The pure helpers (`otsuArr`, `labelComponents`, `roundness`, `findTileRegions`, `mergeHalves`, `countPipsFromGray`) are covered by `test/vision.test.mjs` against synthetic grayscale arrays so the pipeline doesn't regress silently.

## Deploy

`.github/workflows/pages.yml` ships the site to GitHub Pages on every push to `main`. Enable it once under **Settings → Pages → Source: GitHub Actions**.

## Roadmap

- [ ] PWA manifest + offline (still no deps)
- [ ] Per-team color picker
- [ ] Export/import a game as JSON
- [ ] Tighter pip detection (perspective correct, double-half segmentation)
