# dominoes

A tiny, zero-dependency dominoes score tracker. Static site, hosted on GitHub Pages.

- Set the two sides, the target score, and optional rules (blocked-hand counting, round-to-5).
- Add a round at a time — winner + points (+ optional note like *capicúa*).
- Running totals, win detection, undo per round.
- State auto-saves to `localStorage`, so refresh-safe on a phone or tablet.

## Local

Open `index.html` in a browser. That's it.

```
python3 -m http.server 8000
```
…then visit `http://localhost:8000`.

## Deploy

`.github/workflows/pages.yml` ships the site to GitHub Pages on every push to `main`.
Enable it once under **Settings → Pages → Source: GitHub Actions**.

## Roadmap

- [ ] PWA manifest + offline (still no deps)
- [ ] Per-team color picker
- [ ] Export/import a game as JSON
- [ ] **Stretch:** snap a photo of a hand, auto-count pips, flag scoring mistakes
