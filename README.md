# 4th Down Stats

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

**1. R — extract the model output.** `scripts/extract.R` loads twelve seasons of
4th downs, runs `nfl4th::add_4th_probs()`, and writes one JSON file per team to
`public/data/teams/` plus the raw team metadata to `public/data/index.json`.

```bash
Rscript scripts/extract.R    # ~50 minutes for 2014-2025
```

Needs R with `nfl4th`, `nflreadr`, `dplyr`, `purrr` and `jsonlite`. Seasons are
processed one at a time and reduced to 4th downs immediately, because a full
play-by-play frame for twelve seasons does not want to be in memory at once. The
current data is 49,416 fourth downs across all 32 teams, 2014-2025.

2014 is the floor: `load_4th_pbp()` refuses anything earlier and the precomputed
release assets start there. nflreadr standardises historical team codes on the
way through, so the pre-relocation seasons arrive as `LA`, `LAC` and `LV` rather
than `STL`, `SD` and `OAK`, and a team file stays franchise-continuous with no
mapping in this repository.

**2. Node — build the index.** `npm run data:index` reads those files and rewrites
`public/data/index.json` with precomputed per-season tendency metrics for all 32
teams. It is idempotent: run it as many times as you like.

**3. The app** loads `index.json` once at startup and fetches a team's play file only
when that team is selected.

### Why the summary metrics are precomputed

The league overview needs a headline metric for all 32 teams at once, and the app is
only allowed to fetch the selected team's file. Computing the metrics in the browser
would mean pulling all 32 team files (~32 MB) on the landing screen. So they are
computed at build time — by `src/lib/metrics.ts`, the same module the team profile
calls at runtime, so the grid and the profile cannot disagree.

Sizes, which matter because a team file is fetched whole: `index.json` is 100 KB
(17 KB gzipped) and loads once; a team file is around 940 KB (145 KB gzipped) and
holds roughly 1,500 plays. Served behind a CDN with compression enabled that is a
single small request per team, cached at the edge — so **turn on automatic
compression** on the distribution, because uncompressed it is seven times bigger.

### Fixture data

`npm run data:fixture` writes stand-in data for all 32 teams so the interface can be
built and reviewed before the R output exists. It is **not the model** — it is a crude
closed-form stand-in that produces fields of the right shape, scale, and internal
consistency. Every file it writes is overwritten by the R pipeline. The index it
produces is stamped `"fixture": true`, which the app surfaces in the UI, so fixture
numbers can never be mistaken for real ones.

## League trends

A second view, reached from the header on either screen. Four metrics across
2014–2025, drawn as small multiples.

Every panel carries two marks, both spelled out in a legend on the page:

- a **dashed line** — the **median team** that season;
- a **grey band** — the **middle half of the league**, the 25th to 75th
  percentile team. A wider band means the 32 were further apart.

The band is the half of the story a median hides. On aggressiveness it has
widened from about 8 points of spread in 2014 to 14 in 2025: the league did not
move as a block, and early adopters pulled away from the teams that did not
move.

Teams are opt-in. Picking any adds a solid line in its own colour to **all four**
panels at once, with the abbreviation printed at the line's end — colour alone
cannot separate two lines, since ten of the 32 team colours resolve to near-black
on white. Hovering a season puts a guide on all four panels and reads out the
league median, its quartiles, and each selected team's value with that team's
record for the year.

The whole view reads `index.json` alone, so it is one small request.

### What it shows

| Metric | Median team, 2014 → 2025 |
|---|---|
| Aggressiveness | **22% → 50%** |
| How often the model said go | 41% → 41% |
| Agreement | 66% → 73% |
| Win probability given up, per game | **3.53 → 1.93** |

The first two panels sit side by side because the contrast is the point. The
model's advice barely moved across twelve seasons — the share of 4th downs where
going was optimal is a property of the situations teams faced, not of what they
did about them. What changed is what teams did with it, and the cost per game
nearly halved.

### Why there is no "does it correlate with winning" panel

One was built and then removed, because the question it answers is not one this
data can answer.

Win probability points are expected wins by definition — a hundred points is one
win — so the size of the effect is already stated: teams give up **0.48 wins a
season** on average, and the worst team-season in the data gave up **1.00**.

A correlation against actual records is a far weaker instrument. Spread in wins
given up is 0.16; spread in actual wins is 3.6. So even if 4th downs were the
only thing separating two teams, r could not exceed **±0.045** — against a
standard error of 0.051 at n = 384. The test cannot resolve an effect this size,
and the measured correlations bear that out: agreement −0.02, win probability
given up per game +0.03, both inside the noise floor. Aggressiveness comes in at
−0.16, which is *larger* than decision quality could produce and therefore
measures the reverse: teams that spend a season behind go for it more, and losing
teams spend seasons behind.

Showing a flat scatter invited the conclusion that none of it matters, which is
the opposite of what the arithmetic says. The per-decision numbers are the
product; a 17-game record is the wrong instrument for reading them.

## About dialog

The question-mark button, top right on both the picker and the team banner,
opens the methodology: what nfl4th is and what sits behind it, where the data
came from, every derived quantity defined, and how to read the result. It is
built from `index.json`, so the corpus size and build date it quotes describe
the data actually loaded rather than a number written into the prose.

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
| Go expected value | `go_wp` is exactly `first_down_prob × wp_succeed + (1 − first_down_prob) × wp_fail`. Verified against all 49,416 plays: the identity holds to the last decimal place on every one, which is why the card draws it as two weighted branches. |
| Impact tier | The forfeited points banded on the same 1-and-3 scale as the strength band: *minor*, *notable*, *costly*. |
| Game state | How live the game was, from the win probability carried by the model's own recommendation: *in doubt* inside 35–65%, *leaning* to 15/85, *lopsided* to 5/95, *decided* beyond it. |
| Field zone | `yardline_100` 1–20 red zone, 21–40 opponent 40–21, 41–50 midfield, 51+ own half. |
| Field goal distance | `yardline_100 + 17` — ten yards of end zone plus a seven-yard snap. Shown as context on the field-goal row; the model's own `fg_make_prob` is what is displayed beside it. |
| Game result | `home_score` and `away_score` are the game's *final* score, not the running one. The extract restates them from the offence's side as `posteam_final_score` / `defteam_final_score`, so a team file says how each game ended with no second lookup. Rendered W/L/T from the viewed team's point of view, alongside `posteam_home` as vs/at. |

Win-probability fields are probabilities on a 0–1 scale. `go_boost` is the only field
already expressed in percentage points.

### Reading a disagreement

A disagreement is reported on two axes, because the cost alone does not say why
it is small.

Win probability is already a linear currency, so the points forfeited need no
leverage multiplier — applying one would double-count. The data bears this out.
Of 14,320 disagreements across 2014–2025:

| Game state at the decision | n | Mean cost | Max | Over 3 pts |
|---|---|---|---|---|
| In doubt (35–65%) | 3,774 | 1.96 | 16.8 | 20% |
| Leaning (65–85%) | 4,878 | 1.58 | 13.0 | 13% |
| Lopsided (85–95%) | 2,531 | 0.97 | 16.1 | 3% |
| Decided (>95 / <5%) | 3,137 | 0.29 | 4.2 | 0% |

None of the 343 disagreements costing more than five points happened in a game
that was already decided, and decided games carry 4.9% of all forfeited win
probability while making up 21.9% of the disagreements. The decided-game row is
unchanged from the 2020–2025 subset to two decimal places, which is a good sign
the banding is picking up something real rather than an artefact of one era.

So the cost already suppresses itself. What it does not do is distinguish a
0.3-point call in a tie game — a close one the staff nearly got right — from
0.3 points at a 97% win probability, which is garbage time and says nothing
about how a staff decides. The play list therefore draws the cost tier as a
three-segment meter, in amber when the game was live and in grey when it was
already decided, and the comparison spells out which case it is. Decided-game
disagreements still count against the agreement rate; they are marked, not
excluded.

### What is deliberately absent

`nfl4th` produces point estimates. There are no confidence intervals or error bars in
this interface, because any it drew would be invented. Uncertainty is expressed only
through the strength band and through the sensitivity strip's flip point.

## Layout

```
src/
  types.ts                shapes of the static data and the derived domain types
  data/client.ts          the only module that talks to storage, behind a DataSource interface
  hooks/                  useTeamData, useLeagueIndex — fetch, cache, loading state
  lib/decision.ts         the decision rules: actual choice, model choice, cost, band
  lib/metrics.ts          team tendency metrics, shared with the build script
  lib/filters.ts          the season / week / quarter drill-down
  lib/scale.ts            the shared, floor-limited axis the option bars sit on
  lib/color.ts            team colour with contrast checks
  lib/zones.ts            the two axes of the deviation grid
  components/
    TeamPicker.tsx        all 32 teams by division, in their own colours
    TeamBanner.tsx        sticky identity: team, season, plays in scope
    PlayFilters.tsx       season, then week, then quarter
    PlayList.tsx          every 4th down in the filter
    ComparisonCard.tsx    one 4th down, reviewed
    decision/             the parts of that card
scripts/
  extract.R               stage 1: nfl4th -> public/data/
  build-index.ts          stage 2: precomputed summaries -> public/data/index.json
  make-fixture.mjs        stand-in data for development
```

## The drill-down

Team, then season, then week, then quarter, then the individual 4th down.

The landing screen groups the 32 by conference and division, in the order the
NFL prints them — East, North, South, West — with each division a column of
four laid out like a standings block. A scout looking for next week's opponent
knows the division before they know the alphabet, and four columns of four fit a
phone as two, so nothing scrolls sideways. Every
level offers only the values the level above actually contains, so no filter can
lead to an empty screen, and switching teams cannot strand you on a week the new
team did not play (`reconcile` in `lib/filters.ts`).

The team's season summary is the landing view and the resting state. Selecting
a play swaps it for that play's comparison, which reads in review order: the
situation; what the staff did set against what the model wanted; every option
priced row by row; and what going for it actually risked. Clearing the
selection — from the back control, or by tapping the open row again — brings
the summary back.

### The season summary

Scoped to the season, not to the week and quarter chips: those narrow the list
so a play can be found, while the summary answers what the staff did across the
year.

- **Headline metrics** — aggressiveness, agreement, win probability given up per
  game and across the season.
- **Decisions against the model** — a 3x3 tally of what the model asked for
  against what the staff did. The diagonal is agreement; reading a row answers
  the scouting question directly, and it is where a staff's habits show. A
  conservative staff has a fat *model said GO → they punted* cell and almost
  nothing off the diagonal elsewhere.
- **Where the calls cost most** — the games that gave away the most while still
  live, split into losses and wins. Both columns rank on the same number, which
  is the point of showing them together: the cost of a decision is fixed when it
  is made, and the result afterwards does not change it. The wins column is the
  honest counterweight to the losses column, not a separate metric. Clicking a
  game narrows the list to that week.

Win probability is an expected value. A game near the top of either column is
one where the 4th-down calls gave away the most, not one where the result would
have been different.

### Responsive behaviour

| Width | Layout |
|---|---|
| Below 640px | Everything stacks. The outcome panels sit one above the other, the options table drops its bar column and leans on the numbers, and selecting a play replaces the list with the comparison plus a back link. |
| 640–1023px | Outcome panels go side by side; the list and the comparison are still two steps. |
| 1024px and up | The shell is pinned to the viewport and the two panes scroll independently, so a long play list never scrolls the summary out of reach and a tall summary stays fully readable. |

Filter chips wrap to whatever width they are given rather than scrolling
sideways. An 18-week season does not fit a 22rem pane on one line, and a strip
that scrolls hides half the season behind an affordance the reader has to
discover. Wrapping costs a little height and hides nothing.

### Team colour

Identity comes from colour and abbreviation only — no logos.

The palette lives in `src/data/teamColors.ts`, adapted from the fanbank colours,
rather than being read out of `index.json`. `nflreadr::load_teams()` makes a
different editorial call on several teams — Pittsburgh, New Orleans and
Jacksonville most visibly — and the index is regenerated by the R pipeline, so
the curated table is the source of truth and the index values are the fallback.
Abbreviations are remapped to nflverse's: `JAC` → `JAX`, `LAR` → `LA`.

Colour is used for team identity only, never to encode a recommendation. The
model's own emphasis stays neutral black throughout, so the two systems cannot
be confused.

Every use goes through `lib/color.ts`:

- **Text on a team fill** picks white or ink by measured contrast, and if
  neither quite reaches 4.5:1 the fill is nudged until one does. Carolina's blue
  is the only team that needs it, landing at about 4.3:1 untouched. A test
  asserts the guarantee for all 32.
- **A team colour used as text on white** falls back to the secondary, then to a
  darkened primary, until it reaches 4.5:1. This is what rescues Pittsburgh's
  yellow.
- **The secondary is drawn as a stripe** on every pill, tile, chip and banner.
  Ten of the 32 primaries are near-black, so without it Chicago, Seattle,
  Dallas, Tennessee, New England, the Giants and the Jaguars are all the same
  navy chip. The stripe is checked with a perceptual distance rather than a
  contrast ratio: Miami's teal and orange sit at almost identical luminance
  while being unmistakably different colours, so WCAG contrast is the wrong
  instrument for a decorative mark.

Team abbreviations render as `TeamPill` wherever they appear — the side of the
field in a play row, the opponent on a game header, the situation line on the
comparison. List selection is a tint plus a bar in the team's colour rather than
a solid fill, because a filled row would swallow the pill of the team whose
colour filled it.

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
