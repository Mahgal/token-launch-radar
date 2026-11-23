# token-radar-01 — BUILD.md

Entry: Mahgal/token-launch-radar, model radar-2 (comps-calibrated).
Competition: token-radar-01 "Build the best token launch radar", $1,325 USDC, deadline 2026-12-14T10:00:00Z.
Kit: make.fun skill v1.5.274, kit downloaded 2026-11-23 14:51 UTC from https://make.fun/c/token-radar-01/kit (8,444,137 bytes), RULES.txt + competition.yaml + starter read in full before building.

## Design (radar-2, written by this session)

- Board: ALL farmable pre-token protocols in the sealed snapshot (watchlist 40 + every other rankable one), ranked by implied value. No arbitrary cap (starter caps early rows at 160).
- Implied value = TVL × category comps multiple × growth × maturity, all from the snapshot's own figures:
  - comps multiple = median mcap/TVL of live tokens in the same category (≥3 comps), else global median (0.2049); clamped ×0.05–×1.50.
  - growth = 1 + clamp(7d change, −60%, +120%) × 0.4.
  - maturity = 0.65 + 0.35 × min(age with no token, 1095d) / 1095d (unknown age: 365d).
- Exclusions mirror the snapshot's watchlist rule (CEX / Bridge / Liquid Staking / Liquid Restaking / Restaked BTC / versioned names / wrapped-staked words / exchange-name prefixes) — so all 40 watchlist slugs are rankable by construction.
- Farm plans: 6 steps each, category-aware action, capital by TVL tier ($50–250), hold by age (30–60d), cost + time on every step.
- Dashboard (own design, dark radar theme): sortable/filterable board, detail view per protocol with the value arithmetic shown and the page recomputing the implied value to prove code/board agreement, live-token view, model page with the full comparables table. No network, no links out. Source total kept under the 64 KiB dossier text cap.
- Screenshots: real renders of the built dashboard at 1440×900 via headless Chromium (Playwright cache), three states via URL hash: board / detail of #1 / watchlist-only filter.

## Build log

- 2026-11-23 14:51 UTC: kit downloaded, RULES.txt + requirements + starter read. Snapshot: 758 protocols, 342 pre-token, watchlist 40, floor $50M. Calibration: rankable 198 rows (40 watchlist + 60 ≥$50M + 138 below floor); global median mcap/TVL **0.2138** (128 live; AUTOfinance carries mcap_usd −1, a missing-data sentinel, and is excluded by the mcap > 0 filter — a first Python pass that trusted truthiness gave 0.2049 over 129, which was wrong); change_7d median −8.22%, range −72.7%…+4448% (clamped); age median 418d.
- 2026-11-23 ~15:00 UTC: wrote lib/model.ts (radar-2), main.ts, dashboard/ (index.html, app.css, app.js), README.md, .gitignore; vendor/makefun-board.ts copied byte-for-byte from the kit (sha256 9ca51b6e…); LICENSE copied from kit starter (MIT).
