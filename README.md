# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Mahgal/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Mahgal/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar (radar-2): every farmable pre-token protocol in the sealed DefiLlama snapshot, ranked by implied launch value — priced from live-token comparables, not from a list of names — with a concrete farm plan for each one. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## Run it

Node 22.18 or later, standard library only — nothing to install. The program reads the sealed snapshot (`snapshot.json` from the competition kit) and writes the board, the dashboard data, the dossier and the copied dashboard into an output directory:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Then open `out/dashboard/index.html` in a browser (no network needed — the page reads `out/data.js` beside it). Two runs on the same snapshot produce byte-identical outputs.

## The model — radar-2

A launch is priced the way a market prices one: what comparable tokens already trade at per dollar of TVL, in the same line of business.

```
implied = TVL × comp_multiple × growth_mult × maturity_mult
```

- **comp_multiple** — the category's live-token multiple: the median mcap/TVL of the protocols in the same category whose token already trades (at least 3 of them), else the global median across all live tokens; clamped to ×0.05–×1.50.
- **growth_mult** — `1 + clamp(7-day TVL change, −60%, +120%) × 0.4`.
- **maturity_mult** — `0.65 + 0.35 × min(age with no token, 1095d) / 1095d` (age unknown: 365 days).

No protocol name is ever special-cased; the same function scores every row. The board ranks all 198 farmable pre-token protocols (the 40 on the watchlist plus every other rankable one below and above its floor). Exchanges, bridges, staking receipts and versioned pools are left out — the same exclusions the snapshot's watchlist rule uses — because none of them is a launch a reader can farm. Live-token protocols are not ranked; they are the comparables, shown on the dashboard's Live tokens tab.

## What is in this repo

- `main.ts` — the program: reads `/input/snapshot.json`, writes `/output/board.json`, `/output/data.js`, copies `dashboard/` and `screenshots/`, writes `/output/dossier.json` with the vendored make.fun library.
- `lib/model.ts` — the radar-2 model: snapshot parsing, comparables, implied values, farm plans, board validation.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied byte for byte from the competition kit.
- `dashboard/` — the static page (index.html, app.css, app.js): sortable/filterable board, a detail view for every protocol with the value arithmetic shown, live-token view, model page. No network, no links out.
- `screenshots/` — the three screenshots the entry hands in: the board, a protocol's detail view, a filtered view.

## Screenshots

- `screenshots/1-board.png` — the board, ranked by implied value.
- `screenshots/2-detail.png` — the detail view of the #1 protocol, with the value arithmetic and its farm plan.
- `screenshots/3-filtered.png` — the board filtered to the watchlist only.

---

<sub>Entered on [make.fun](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
