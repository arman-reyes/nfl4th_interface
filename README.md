# 4th Down Review

A coach-facing interface over the [`nfl4th`](https://www.nfl4th.com/) win-probability
model. It answers two questions for any of the 32 NFL teams: what does the model say
they should do on 4th down, and what do they actually do?

The model is not part of this app. `nfl4th` produces the point estimates; this
repository is the interface that makes them legible.

## Running it

```bash
npm install
npm run data:fixture   # generate stand-in data (see below)
npm run dev
```

## Data pipeline

Three stages, two of which you run yourself.

**1. R — extract the model output.** `scripts/extract.R` loads six seasons of 4th
downs, keeps the `nfl4th` probability columns, and writes one JSON file per team to
`public/data/teams/` plus the raw team metadata to `public/data/index.json`.

**2. Node — build the index.** `npm run data:index` reads those files and rewrites
`public/data/index.json` with precomputed per-season tendency metrics for all 32
teams. It is idempotent: run it as many times as you like.

**3. The app** loads `index.json` once at startup and fetches a team's play file only
when that team is selected.

### Why the summary metrics are precomputed

The league overview needs a headline metric for all 32 teams at once, and the app is
only allowed to fetch the selected team's file. Computing the metrics in the browser
would mean pulling all 32 team files (~9 MB) on the landing screen. So they are
computed at build time — by `src/lib/metrics.ts`, the same module the team profile
calls at runtime, so the grid and the profile cannot disagree. `index.json` is 53 KB;
a team file is around 280 KB.

### Fixture data

`npm run data:fixture` writes stand-in data for all 32 teams so the interface can be
built and reviewed before the R output exists. It is **not the model** — it is a crude
closed-form stand-in that produces fields of the right shape, scale, and internal
consistency. Every file it writes is overwritten by the R pipeline. The index it
produces is stamped `"fixture": true`, which the app surfaces in the UI, so fixture
numbers can never be mistaken for real ones.

## Definitions

Every number in the interface traces to a field in the data or to one of these:

| Term | Definition |
|---|---|
| Actual choice | `play_type` of `run`/`pass` → went for it, `field_goal` → kicked, `punt` → punted. Anything else carries no decision and is excluded from every statistic. |
| Model recommendation | `go` when `go_boost > 0`, otherwise the higher of `fg_wp` and `punt_wp`. Taken from the sign of `go_boost` rather than a raw argmax so the verdict can never contradict the headline number. |
| Strength band | `\|go_boost\|` under 1 point is a *coin flip*, 1–3 a *lean*, above 3 a *clear* call. Magnitude, not sign: a 4-point edge for the punt is as clear as a 4-point edge for going. |
| Aggressiveness | Of the 4th downs where the model recommended going, the share the staff actually went for. |
| Agreement rate | Share of all classifiable 4th downs where the actual choice matched the model's top option. |
| WP forfeited | Per play, (best option's WP − chosen option's WP) in percentage points; summed, and divided by games. |
| Field zone | `yardline_100` 1–20 red zone, 21–40 opponent 40–21, 41–50 midfield, 51+ own half. |

Win-probability fields are probabilities on a 0–1 scale. `go_boost` is the only field
already expressed in percentage points.

### What is deliberately absent

`nfl4th` produces point estimates. There are no confidence intervals or error bars in
this interface, because any it drew would be invented. Uncertainty is expressed only
through the strength band and through the sensitivity strip's flip point.

## Layout

```
src/
  types.ts            shapes of the static data and the derived domain types
  data/client.ts      the only module that talks to storage, behind a DataSource interface
  hooks/              useTeamData, useLeagueIndex — fetch, cache, loading state
  lib/decision.ts     the decision rules: actual choice, model choice, cost, band
  lib/metrics.ts      team tendency metrics, shared with the build script
  lib/zones.ts        the two axes of the deviation grid
  components/         the interface
scripts/
  extract.R           stage 1: nfl4th -> public/data/
  build-index.ts      stage 2: precomputed summaries -> public/data/index.json
  make-fixture.mjs    stand-in data for development
```

## Commands

| | |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | typecheck and production build |
| `npm test` | unit tests over the decision rules and metrics |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |
| `npm run data:index` | rebuild `index.json` from real data |
| `npm run data:fixture` | regenerate fixture data and rebuild `index.json` |
