# 4th Down Stats

A coach-facing interface over the [`nfl4th`](https://www.nfl4th.com/) win-probability
model. It answers two questions for any of the 32 NFL teams: what does the model say
they should do on 4th down, and what do they actually do? A second page asks the
same two questions of the decision after every touchdown — kick the extra point, or
go for two — through the same interface.

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
Rscript scripts/extract.R         # every season, 2014 to the current one: ~50 minutes
Rscript scripts/extract.R 2026    # one season, merged into the team files: ~4 minutes
```

Needs R with `nfl4th`, `nflreadr`, `dplyr`, `purrr` and `jsonlite`. Seasons are
processed one at a time and reduced to 4th downs immediately, because a full
play-by-play frame for twelve seasons does not want to be in memory at once.
Whatever seasons were asked for replace their rows in each team file and every
other season is kept, so a single-season run cannot lose the rest. The data
through 2025 is 49,416 fourth downs across all 32 teams.

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

### Keeping up with the season

```bash
npm run data:update                     # current season, all three pipelines
npm run data:update -- --season 2026    # a specific season
npm run data:update -- --deploy         # ...and push the data to S3
npm run data:update -- --only garbage   # one pipeline: fourth | twopt | garbage
```

`scripts/update-season.mjs` tops up the current season in every pipeline
without touching any other: `extract.R` for that season, `data:index`,
`extract-2pt.R` and `data:index:twopt`, `garbage-time.R` for that season,
`data:garbage:check`, then lint, tests and the production build. With `--deploy` it also syncs `dist/data/` to the bucket
and invalidates `/data/*` (bucket and distribution come from `.env.deploy.local`,
which is gitignored — see the deployment guide). About seven minutes end to end.

Run it Tuesday morning: nflverse rebuilds its play-by-play overnight after the
last game of the week, so a run before that sees a partial week.

While a season is being played, `index.json` carries
`in_progress: { season, through_week }`, and it is cleared once a Super Bowl
play is in the data. The team banner and the About dialog say "in progress,
through week N" from it. The season is the default view as soon as it has a
game in it, but two things hold it back until it is complete: the league trends
leave it off, because a week or two of games is not a tendency and as the last
point it would set the headline; and the quiz does not draw from it, because
the quiz pool is a seeded shuffle of the whole candidate list and adding a
week's plays would deal a different quiz every week. The garbage-time files
carry their own `through_week` and `complete`.

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

### Tries

The two-point page has a pipeline of its own, the same shape as the 4th-down
one: `scripts/extract-2pt.R` pulls every play that recorded an extra point or a
two-point result, prices both options with `nfl4th::add_2pt_probs()`, and
writes one file per team to `public/data/twopt/teams/` plus the raw team
metadata to `public/data/twopt/index.json`; `npm run data:index:twopt` then
adds the precomputed summaries and the quiz pool. The three files under
`public/data/twopt/` have exactly the shapes of the three at `public/data/`,
which is what lets one `LeagueIndex` type, one data client and one set of
hooks serve both pages.

```bash
Rscript scripts/extract-2pt.R          # every season, 2015 to the current one: ~6 minutes
Rscript scripts/extract-2pt.R 2026     # one season, merged into the team files
npm run data:index:twopt
```

**2015 is the floor, and it is a modelling floor.** That is the season the
extra point moved back to the 15, and nfl4th prices every kick from there —
`add_2pt_probs()` evaluates the field-goal model at `yardline_100 = 15`
whatever the play says. Before 2015 the kick was a 99.5% snap from the 2, and
the model would be pricing a decision no staff faced. The data through 2025 is
15,362 tries across all 32 teams.

Two things nfl4th does that the interface has to say out loud:

- **The spot is not an input.** A penalty can move a try — a kick from the
  20, a two from the 1 — and the play-by-play records it, but the extra point
  is priced from the 15 and the two-point try from the 2 regardless. The card
  shows a moved spot as a fact; the About dialog says the model ignored it.
- **Nothing is priced in the last fifteen seconds or in overtime.** A try with
  the clock gone cannot change who wins, so `add_2pt_probs()` returns NA and
  the extract drops those rows, about ten a season, with a line in the log.

The extract restates one number the way `extract.R` restates the final
scores: `go_boost = 100 × (wp_go2 − wp_go1)`, the win probability points gained
by going for two rather than kicking. nfl4th does not emit it for tries, but
the whole interface reads the model's recommendation off the sign of the
headline number rather than from a raw argmax, and a try needs the same
guarantee that the verdict can never contradict the number beside it.

### Garbage time

A second pipeline, independent of the 4th-down one. `scripts/garbage-time.R`
reads full regular-season play-by-play and rebuilds every fantasy counting stat
from it, bucketed by the win probability the offense faced *before* the snap.

```bash
Rscript scripts/garbage-time.R            # the current season
Rscript scripts/garbage-time.R 2016:2025  # or a range on the command line
npm run data:garbage:check                # read it back through src/lib
```

Set `GT_CACHE=<dir>` to cache each season's play-by-play as `.rds`, which makes
a multi-season backfill resumable — without it every season re-downloads, at
about three minutes each. The current season is never cached, because its
play-by-play changes every week.

Each run touches only the seasons it was given; `seasons.json` is rebuilt from
whatever files are in the directory. If a season fails reconciliation the script
exits non-zero and the file that season had before, if any, stays in place.

It writes one file per season to `public/data/garbage/` (~230 KB each) plus
`seasons.json`. The browser fetches one season at a time, so the payload does
not grow with the archive.

**Why bins.** The threshold that separates garbage time from football is a
control on the page, so no single cut can be baked in. Production is bucketed
into 25 win-probability bins — twelve 2.5%-wide bins under 0.30, twelve mirrored
above 0.70, and one lump for everything between — and the client cumulative-sums
the bins under whatever the reader picked. The two-score margin gate is *not* a
control, so it is applied here: a play that fails it lands in the lump whatever
its win probability, which is what stops a reader sliding the threshold until a
two-minute drill counts as garbage.

**The reconciliation gate.** Every season is checked against
`nflreadr::load_player_stats()` before it is written, and a season that cannot
rebuild nflverse's own fantasy totals is skipped rather than shipped;
`seasons.json` lists only what passed. The gate looks at the share of players
affected as well as the worst one, because a dropped stat category moves
hundreds of players at once while the known residuals move two or three.

Those residuals are irreducible: how nflverse splits yardage on a lateral, and
whether it charges a fumble on an aborted snap. Both are worth at most a fumble,
never a touchdown. Recent seasons land at median 0, p95 0, and a worst case
under a point.

**Seasons that do not pass**, and why — worth reading before widening the range:

| Season | Reason |
|---|---|
| 1999, 2000 | ~40% of players mismatch. The play-by-play is genuinely incomplete this far back. |
| 2001 | Three players off by up to 4 points. |
| 2011 | One player: a kickoff return that carries `rush_touchdown` and rushing yardage, which nflverse counts as rushing and no sane offensive filter will. |

Several attribution rules in that script look arbitrary and are not; each is
commented where it sits. The ones worth knowing about:

- **Gate on `play_type`, never on `pass_attempt`/`rush_attempt`.** A play wiped
  out by penalty keeps its attempt flags and its player ids, and only
  `play_type == "no_play"` marks it. Measured across 2024 and 2025, not a single
  nullified play carries yardage — which is what makes it safe to recover the
  rare fake punt that is filed as `no_play` but whose yards stand anyway.
- **Kneels and spikes count**, as official rushing attempts and incompletions.
  Kneels sit almost entirely in leading garbage time, so dropping them would
  bias exactly the panel being drawn.
- **Sacks are excluded.** nflfastR sets `pass_attempt` on them; the NFL does not.
- **There is no `td_team` check.** It reads like an obvious guard, but
  `pass_touchdown` and `rush_touchdown` are already offensive-only markers, and
  `td_team` is unreliable in older data — in 2002 a Jacksonville back's rushing
  touchdowns carry `td_team` values of NYJ, PHI, HOU and WAS.
- **Special-teams touchdowns are counted by nflverse and only located here.**
  Its rule for what counts is not reconstructable from the play-by-play: a
  kickoff recovered in the end zone by the kicking team counts, a muffed punt
  recovered the same way does not.

## 2-Point Stats

A page at `/twopoint`: the decision after every touchdown, reviewed exactly the
way the 4th-down page reviews a 4th down. The same team picker, the same banner,
the same drill-down to the individual try, the same comparison card, the same
season summary, its own league trends at `/twopoint/trends` and its own quiz at
`/twopoint/quiz`, with the same About button opening a dialog written for tries.

It is the same page because it is the same code. A 4th down and a try are the
same shape of question — the staff picked one option, the model priced every
option, and the gap between them is the cost — with different options. So
everything downstream of the pricing is written once against a small interface,
`DecisionRules` in `src/lib/rules.ts`: the choices, which one counts as
aggressive, what the staff did, what the model wanted, what each option was
worth, and how each choice is written. The 4th-down rules are `FOURTH_DOWN` in
`src/lib/decision.ts` and the try rules are `TWO_POINT` in `src/lib/twopt.ts`;
team summaries, game roll-ups, impact tiers, the decision matrix, the quiz
scoring and the trends take whichever they are handed. The 4th-down page keeps
its original function names as one-line bindings, so nothing that page calls had
to change.

What is different is what a try is:

- **Two options, never unavailable.** Kick, or go for two. There is no
  situation where a team may not do either, so nothing on the card is null and
  the matrix is 2x2 rather than 3x3.
- **The situation is the score.** A try has no down, distance or field position
  worth stating, so a row reads "Up 6 after the TD" — `score_differential` on
  the try row, which nflfastR states after the touchdown — and the card's first
  fact is what each option does to it: *kick → up 7 · two → up 8*. That is the
  whole decision, and it is what a coach is actually thinking about.
- **Both options get their branches drawn.** The 4th-down card draws only the
  go, because a punt has one outcome. An extra point has two, and at 94% the
  miss is a real branch of the decision rather than a footnote to it, so the
  card shows *If they go for two* and *If they kick* side by side, through the
  same `BranchSplit` component.
- **The strength band and the cost tiers are unchanged.** A coin flip is still
  under a point, a clear call still over three. That matters here because of
  what the distribution turns out to be.

### What it shows

Across 2015–2025, **76% of tries are coin flips**, 23% leans and 1.4% clear
calls. An extra point is worth about 0.94 points and a two-point try about
1.0, so with a game still open the two options usually sit within a fraction
of a win-probability point of each other. The model prefers going for two on
about **60% of tries** — most of them by a hair — and staffs go for two on
about **7% of those**, a figure that has not moved in eleven seasons:

| Metric | Median team, 2015 → 2025 |
|---|---|
| Aggressiveness | 7% → 7% |
| How often the model said go for two | 60% → 58% |
| Agreement | 44% → 43% |
| Win probability given up, per game | 1.14 → 1.12 |

Where 4th downs moved over a decade, tries did not. The kick is the default,
and a coin flip does not move a staff off a default. The About dialog says so
in as many words, because a page where every staff reads at 5–12% aggressive
and 35–45% agreement looks broken until the reader knows the calls are hairline
— and it then points at the number that does the work, which is the cost. At
about 1.1 points a game a season of tries gives up roughly a fifth of a win,
more than half of what the same staff gives up on 4th downs.

The quiz deals four of its ten as situations the model would go for two on,
the same fixed four as the 4th-down quiz, so the two scorecards read against
each other; the sample-size line counts against the ~45 tries a team faces in a
season rather than the ~130 4th downs.

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

## Make the call

A quiz, reached from the button at the bottom of the landing screen. Ten real
4th downs, twenty seconds each, go / kick / punt — then the reader's own numbers
in the same format a coaching staff gets: aggressiveness, agreement, win
probability given up, and the 3x3 of their calls against the model, with the
median NFL staff shown beside the first two for scale.

Four decisions shape it:

- **The pool ships without `desc`.** The play description narrates what actually
  happened, and the reveal never shows it. The quiz is scored on the decision,
  and revealing the outcome would teach exactly the lesson this tool argues
  against. `scripts/build-index.ts` writes `public/data/quiz.json`, a uniform
  random sample of 400 real decisions (220 KB, 35 KB gzipped), stripped of the
  description.
- **Four of the ten are situations the model would go for.** Fixed rather than
  left to chance, because aggressiveness needs a denominator — and 4 in 10 is
  close to the league's real rate of about 41%, so a round still feels like a
  season.
- **Options the model cannot price are offered as unavailable.** nfl4th prices
  no punt from inside the opponent's 30 and no kick from beyond range. Offering
  those as live buttons made an unscoreable call look like a timeout and left
  the aggressiveness denominator disagreeing with the matrix.
- **Running out of time is not a call.** It is excluded the way a penalty is, and
  the results say how many.

Rounds accumulate. "Ten more" adds to the record rather than restarting it, so a
reader can build a sample worth reading — ten calls says very little, and the
results say so until the count gets closer to the ~130 an NFL team faces in a
season. Questions already asked this session are excluded from later draws, since
a repeat would be counted twice.

The round's state is one object rather than separate answer and pending values,
so answering and advancing are atomic. Two clicks landing in the same tick — a
double-click on Next, or a click racing the clock — otherwise both read the same
stale value and record a call for a question the reader never saw.

## Switching between pages

Each statistical display owns the page heading, and the heading is the switcher:
a dropdown arrow beside "4th Down Stats" or "Garbage Time" opens a menu of the
others, each with a line on what it answers. Moving between them is the same
gesture as reading which one you are on.

The registry is `SECTIONS` in `src/lib/routes.ts`. **Adding a page is one entry
there** — title, blurb, and the view it routes to — and it appears in the menu on
every other page with nothing else to wire up. The two nfl4th pages sit next to
each other in the menu, with garbage time after them.

League trends and the quiz are deliberately not sections. They are ways of
reading a page's data rather than separate bodies of it, so they stay on that
page's own header where they have always been — the 4th-down ones at `/trends`
and `/quiz`, the two-point ones at `/twopoint/trends` and `/twopoint/quiz`.

## Garbage time

A page at `/garbagetime`: the same fantasy rankings a reader already knows, with
one subtraction — the plays that happened after the game stopped being in doubt.

A play is garbage time when the offense's pre-snap win probability was under the
threshold **and** it was at least two scores behind. The second condition is what
keeps a two-minute drill out: trailing by eight with a minute left is a low win
probability and the most contested football there is. Only 3% of sub-10% plays
are one-score games, and their median is 1.3 minutes left at exactly −8.

The controls sit in two halves of one row, because they do different jobs and
the difference is easy to miss. On the left, **the threshold** decides what counts
as garbage time — everywhere on the page, including the garbage share column and
the per-team rates. On the right, **"Remove points from total"** decides only what
comes out of the **Remaining** column:

| Checkbox | Default |
|---|---|
| Garbage time points when trailing | on |
| Garbage time points when leading | off |
| Competitive points | off |

Those three are the whole season between them, so the table's Remaining column is
whatever is left of the three. Unchecking all of them makes Remaining equal
Actual; checking all three zeroes it out, and the page says so rather than
showing a ranking of zeroes. Checking only the third inverts the question
entirely — what a player scored *only* in garbage time. They are the same three
segments as the donut in an opened row, so a reader can see what a box is about
to take out.

The **Points Breakdown** column is a stacked bar of the three bands rather than a
single garbage-share percentage. One number could not tell a receiver whose
extra production came while his team was buried from a back whose came while his
team was coasting — opposite situations that a share collapsed into the same
value. One legend above the table gives the colour order, so no row carries its
own key.

In the table the bar is **flanked by the two garbage shares**, each in its own
band's colour: trailing on the left where its segment starts, leading on the
right where its segment ends. The competitive share is the remainder and is left
to the bar. The flanks are fixed-width so every bar in the column starts and
ends on the same pixel — ragged numbers stagger the bars and make the column
unscannable — and the whole assembly is centred under its heading rather than
right-aligned like the number columns beside it.

Colouring those numbers is a deliberate exception to the usual rule that text
wears text tokens and only marks carry series colour. It is legitimate here
because the number *is* the mark's identity, standing in for a per-row legend,
and because both colours clear WCAG AA for normal text against the row and its
hover tint (5.0:1 and 6.7:1 — measured, not assumed).

The three band colours live in `src/components/garbage/bandStyle.ts` and are
shared by everything that draws them — the breakdown bar, the mobile card, the
team donut on the trends page — because the same colour has to mean the same
band everywhere or the page lies. They are a **diverging** scale rather than
three peer categories, because that is what the data is: two poles of one
win-probability axis either side of a neutral middle. The grey midpoint is
prescribed by that form rather than being a compromise, and the amber and blue
poles clear every colour-vision check against the page's surface — lightness
band, CVD separation, normal-vision floor and contrast. Within the site's own
stone-and-amber palette three distinguishable bands are not achievable: two
ambers land at 13.4 ΔE for normal vision, below the hard floor of 15.

A band can be negative — a quarterback whose only competitive snap was an
interception — so it contributes no width to a bar and the number beside it
carries the real value.

The table has **two layouts, not one that bends**. Seven columns of numbers
cannot shrink to a phone and stay legible, and scrolling a table sideways takes
the player's name off screen — the one column that says whose row it is. Below
`sm` each player is a card where every number keeps its label, which matters
most here because Remaining, Actual and Δ Rank are easy to confuse; above it the
table returns, still `overflow-x-auto` for the widths in between.

The table sorts from its column headers, which a card list has none of, so the
phone gets **its own Sort by control** rather than losing the ability to sort.
Its labels are fuller than the column headers — a header can be terse because it
sits above its own numbers, and "Points from" means nothing in a dropdown.

**Rank changes are red for a fall and green for a rise**, gaining colour as the
move gets bigger: a dusty, barely tinted step for the ordinary shuffling and a
vivid one for the moves worth stopping at. The headline mover tiles use the same
ramp, and derive their arrow from the sign rather than hard-coding one, so with
nothing removed they read "—" instead of claiming a fall of zero.

The ramp holds **lightness still and raises chroma**, because lightness cannot
move: this is 11px text, so every step needs 4.5:1 against the row and its hover
tint, and that floor sits at roughly a mid-tone. A genuinely light grey —
`stone-400` — is 2.5:1 and illegal here however good it would look. With
lightness pinned, saturation is the only axis left, and it is the one the eye
reads as intensity anyway.

Red and green is the one pairing colour-vision deficiency attacks, so it is used
only because **direction is never carried by colour alone**: every value ships
with an arrow and keeps its sign. The steps in
`src/components/garbage/rankTone.ts` were measured, not chosen:

| Move | Fall | Rise | AA (hover) | Normal-vision ΔE | CVD ΔE |
|---|---|---|---|---|---|
| 1–4 | `#a85f57` | `#417f68` | 4.53 | 16.2 | 4.7 |
| 5–11 | `#c7483a` | `#258260` | 4.55 | 24.9 | 8.3 |
| 12+ | `#df2712` | `#0b8458` | 4.53 | 31.2 | 11.0 |

The faintest step sits at the edge of the palette rules and no further: below
about 32% saturation the two tints stop being separable even with full colour
vision (normal ΔE drops under 15), at which point the tint is decoration that has
stopped doing its job. Its colour-vision separation is low by design and nothing
rests on it — a move of one to four places is the noise, and the arrow already
says which way. The three magnitude steps come from the real distribution:
across 8,810 player-seasons two thirds of moves are four places or fewer, and
only the top 5% reach twelve.

The **rank shown against a row follows whichever ranking is being sorted on**.
Pinned to the actual rank, sorting by Remaining printed a scrambled column — 3,
1, 7, 2 — which reads as a bug rather than as a deliberate second ranking.
Sorting by rank change or garbage share is a deliberate reordering of a ranking,
so those keep the actual rank.

**Remaining sits to the left of Actual** because it is the column the page is
about; Actual is the thing it is being read against. It is called Remaining and
not "Clean" because with the third box ticked it is not clean, it is the garbage.

Three further decisions shape the page:

- **Trailing garbage is removed by default; leading garbage is not.** That
  matches how the phrase is normally used, but it is not symmetric and the page
  says so. Plays with the offense hopeless are about three-quarters passes;
  plays with it comfortably ahead are mostly runs. Stripping only the first
  takes points from quarterbacks and receivers while leaving a running back's
  clock-killing carries alone, so the second is measured, shown, and one click
  from being removed too. The **Garbage** share column always counts both bands,
  whichever ones are being removed — the share a player carries is a fact about
  his season and the threshold, not about what the reader is subtracting.
- **The threshold snaps to 2.5% steps.** A cut inside a bin cannot be answered by
  summing bins, and interpolating would mean inventing plays that are not in the
  file. The control carries a live readout of what share of the league's
  offensive plays the current setting calls garbage — around 11% at the default.
- **The file carries more players than the page shows.** Ranking by actual points
  and keeping the top 100 would structurally exclude the players at the other end
  of the story: someone 108th on actual but 82nd once cleaned is exactly the
  finding, and would not be in the file. The pipeline keeps the union of the top
  120 by actual points and the top 120 by clean points at the most aggressive
  settings the controls allow.

Opening a row shows what the removals actually took: his counting stats actual
against remaining, and beside them **points by game state** — what his season was
worth in each band, in points, per game, his share of it, and **his team's share
of the same state, side by side**.

The gap between those two is the whole question. A third of his points earned on
a fifth of his snaps is a player feasting on a state; the same third earned on a
third of his snaps is a player who was simply out there. Both are shares of his
own season, so they read against each other directly.

**Snaps are real snaps.** They come from `nflreadr::load_participation()`, which
lists the eleven offensive players on every play, so a receiver who ran a route
and was never looked at still counts — which is the whole point, since touches
and targets would fold his usage back into his production. Participation joins
100% of scrimmage plays with exactly 11 players on each, in all ten seasons it
covers.

It exists **from 2016 only**. Earlier seasons carry `has_snaps: false`, zero
snaps, and the column falls back to touches and targets with the header renamed
to match — two different measurements are never printed under one name. Ten
seasons have snaps, thirteen do not.

It is close to but not perfectly clean: the passer is listed on 99.8% of pass
plays, and on **16 of 12,828 player-bands (0.1%)** a player is charged with more
touches than snaps — almost always a quarterback on a team that changed starters
mid-season, where participation attributes the other quarterback's personnel
grouping. `npm run data:garbage:check` reports the rate per season rather than
hiding it; it is upstream data, so it is surfaced rather than failed.

The panel carries no prose. Two columns of percentages next to each other make
the comparison without a sentence restating it, and the games count sits in the
heading so "per game" has its denominator.

**Any number of players can be open at once**, because reading two against each
other is the point and a single-open table forces the reader to hold the first in
their head. The open set lives on the page, so it survives a re-sort, and clears
when the position or season changes — those rows belong to a table that is no
longer on screen. A **Collapse all (n)** control appears once anything is open.

Rows and cards say they open. Each carries a chevron that rotates when expanded,
and in the table that chevron is a real `<button>` — tabbable, labelled "Show /
Hide {player}, {team}, detail", and carrying `aria-expanded` — because a row that
signals itself only with a cursor change and a hover tint says nothing on a
touch screen and nothing to a keyboard. The row around it stays clickable for
the mouse, with `stopPropagation` on the button so the panel does not toggle
twice and appear stuck. A line above the table says the interaction exists
before anyone tries it.

The label carries the team because names are not unique: two Steve Smiths, two
Mike Williamses and two Zach Millers each share a position and a season in this
archive, and without it a screen reader would announce two identical controls.

There is deliberately **no chart in the panel** — the row that opened it already
draws the three bands, as a stacked bar in the table and as a labelled bar on a
card, so a donut underneath would be the same split a second time a few pixels
below the first.

On a wide screen the team-context line sits beside the table rather than under
it, so the table keeps a readable measure instead of stretching four number
columns across the page.

The donut survives on the **trends** page, where it shows a whole offense and
there is no breakdown bar for it to duplicate.

### League stats

A **League Stats** button on the garbage-time header opens `/garbagetime/trends`,
the same relationship the 4th-down page has with its own trends view. (The path
keeps its original name so existing links survive; only the label changed.) It holds
the two things that are about offenses rather than players:

- **How much of each offense's season happened in one game state** — 32 bars in
  one column, so they share a left edge and a reader can run an eye down them.
  A **Game state** select switches between trailing, competitive and leading, and
  reorders descending on whichever is picked. Bars carry each team's own colour:
  colour follows the entity, and the band is already named in the heading and
  shown in the select, so spending the bar on it would repeat what the reader has
  been told twice and give up the cue that makes one team findable among
  thirty-two. This moved off the player page, where it was an aside.

  The three views cross-check each other: in 2025 the Jets lead trailing garbage
  at 32.9% and sit last in leading at 0.0%, with Seattle the exact inverse.
- **Team garbage time stats** — pick a team and get its points donut beside a
  table of counting stats split four ways: **All, Trailing, Leading,
  Competitive**. Every stat is conserved across the three bands, which the build-time
  check asserts for all 32 offenses in every season.

The team picker is **alphabetical**, because it is for finding a team you already
have in mind and a list that reshuffles itself whenever the threshold moves is no
use for that — the bar chart above is where the ranking lives. The *default*
selection is a separate question and gets its own answer: the page opens on the
offense that played the most garbage time.

The trends page has **no "Remove points from total" control**. There is no
Remaining column here for it to change, so it would be a control with no visible
effect; this page describes the bands rather than subtracting them. The threshold
slider, the scoring format and the season picker are shared with the player page.

The team totals are the **whole offense**, not a sum of the players the rankings
carry — the file holds only the top 120 per position, so summing those would
quietly undercount. `scripts/garbage-time.R` therefore emits a stat line per team
per bin alongside the play counts. Each event already knows which offense it
happened for, so the player rows and the team rows come out of one attribution
and cannot disagree.

Teams keep both a `plays` count and a set of stat lines because they answer
different questions: `plays` is the true snap count and the denominator for every
rate, while the stat lines sum a snap across roles (a completion is an attempt
and a target at once) and so cannot stand in for it.

There are no verdict labels. Naming a player a "mirage" or "inflated" put a word
on him that the data does not support: the same rank drop is produced by his own
garbage time and by his position-mates', and a label cannot tell those apart
while a rank change shown next to its two totals invites the reader to. The
Δ Rank column and the breakdown bar say what happened; what to call it is the
reader's.

### About dialog

The question-mark button, top right on both garbage-time pages, opens
`GarbageAbout` — what counts as garbage time and why the two-score gate is
there, the 74%/40% pass-rate asymmetry between the bands and what it would do to
the page if left unsaid, how to read a rank that moved, and the sources.

It is a **separate dialog from the 4th-down one**, which explains the nfl4th
model. The two pages share no data, no model and no argument, and pointing a
reader here at fourth-down methodology would answer a question nobody asked.

Citations are the real ones, taken from `citation()` rather than written from
memory: nflfastR (Carl & Baldwin) for the play-by-play and the `wp` model,
nflreadr (Ho & Carl) for loading it and for the official player stats every
season is reconciled against, and nflverse-data for the release assets. Every
link is checked to resolve.

There is deliberately no leaders panel for garbage time earned while ahead. The
table sorts by Remaining and filters by position, which answers the same
question without a second component that can drift from the first.

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
| Game result | `home_score` and `away_score` are the game's *final* score, not the running one. The extract restates them from the offense's side as `posteam_final_score` / `defteam_final_score`, so a team file says how each game ended with no second lookup. Rendered W/L/T from the viewed team's point of view, alongside `posteam_home` as vs/at. |

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
  hooks/useDrilldown.ts   team, season, week, quarter, open play — the state both pages share
  lib/rules.ts            DecisionRules: what a kind of decision must say about itself
  lib/decision.ts         the 4th-down rules: actual choice, model choice, cost, band
  lib/twopt.ts            the try rules: kick or two
  lib/metrics.ts          team tendency metrics, shared with the build script
  lib/filters.ts          the season / week / quarter drill-down
  lib/scale.ts            the shared, floor-limited axis the option bars sit on
  lib/color.ts            team colour with contrast checks
  lib/zones.ts            the two axes of the deviation grid
  components/
    TeamExplorer.tsx      the drill-down shell: banner, filters, list, summary or card
    TeamPicker.tsx        all 32 teams by division, in their own colours
    TeamBanner.tsx        sticky identity: team, season, plays in scope
    PlayFilters.tsx       season, then week, then quarter
    PlayList.tsx          every decision in the filter, grouped by game
    ComparisonCard.tsx    one 4th down, reviewed
    decision/             the parts of that card, shared with the try card
    twopt/                the try row, card, quiz situation and About dialog
scripts/
  extract.R               stage 1: nfl4th -> public/data/
  extract-2pt.R           stage 1 for tries: nfl4th -> public/data/twopt/
  build-index.ts          stage 2: precomputed summaries -> index.json, for either
  make-fixture.mjs        stand-in data for development, both pipelines
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
| `npm run data:index:twopt` | rebuild `twopt/index.json` and the try quiz pool |
| `npm run data:fixture` | regenerate fixture data and rebuild both indexes |
| `npm run data:garbage:check` | validate `public/data/garbage/` through `src/lib` |
| `npm run data:update` | top up the current season in every pipeline; `-- --deploy` pushes the data |
