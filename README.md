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

The camera button on the round row opens the camera (mobile) or file picker. The `vision.js` pipeline (find bright tile-face regions → local Otsu threshold inside each region → connected components → size and roundness filter) runs entirely in the browser — no upload, no library.

**Take the photo top-down on a flat surface.** That's the supported case. If no tile face is detected, the app says "no domino tile detected — take a top-down photo on a flat surface" and waits for you to retry or enter the points manually. Treat the count as a suggestion and confirm before adding the round.

The pure helpers (`otsuArr`, `labelComponents`, `roundness`, `findTileRegions`, `countPipsFromGray`) are tested in `test/vision.test.mjs` against synthetic grayscale arrays so the pipeline doesn't regress silently.

## Deploy

`.github/workflows/pages.yml` ships the site to GitHub Pages on every push to `main`. Enable it once under **Settings → Pages → Source: GitHub Actions**.

## Roadmap

- [ ] PWA manifest + offline (still no deps)
- [ ] Per-team color picker
- [ ] Export/import a game as JSON
- [ ] Tighter pip detection (perspective correct, double-half segmentation)
