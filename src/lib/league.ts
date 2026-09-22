import type { LeagueIndex, TeamSummary } from '../types'

/**
 * League-wide trends: how the whole NFL has moved, season by season.
 *
 * Individual team lines were dropped from this view. Thirty-two of them is
 * spaghetti, and one of them out of context says nothing — what is worth
 * seeing here is the league, and how far apart its teams are.
 *
 * Everything reads `index.json` alone; the per-season summaries are already
 * precomputed there.
 */

export interface LeagueMetric {
  key: string
  label: string
  caption: string
  value: (summary: TeamSummary) => number | null
  format: (value: number) => string
  /** Bounds the fitted axis may not exceed. */
  clamp: [number, number] | null
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`

export const LEAGUE_METRICS: LeagueMetric[] = [
  {
    key: 'aggressiveness',
    label: 'Aggressiveness',
    caption: 'Of the 4th downs where the model said go, the share teams went for.',
    value: (s) => s.aggressiveness,
    format: pct,
    clamp: [0, 1],
  },
  {
    key: 'saidGo',
    label: 'How often the model said go',
    caption:
      'The share of 4th downs where going was the best option. A property of the situations teams faced, not of what they did about them.',
    value: (s) => (s.decisions > 0 ? s.go_recommended / s.decisions : null),
    format: pct,
    clamp: [0, 1],
  },
  {
    key: 'agreement',
    label: 'Agreement',
    caption: "The share of 4th downs where the call matched the model's top option.",
    value: (s) => s.agreement,
    format: pct,
    clamp: [0, 1],
  },
  {
    key: 'forfeitedPerGame',
    label: 'Win probability given up',
    caption:
      'Points of win probability handed away per game. A hundred points is one win, so a full season at this rate is roughly a third of a win.',
    value: (s) => s.wp_forfeited_per_game,
    format: (v) => v.toFixed(2),
    clamp: [0, Infinity],
  },
]

/**
 * The same four numbers for the try, with the captions written for it. The
 * value functions are shared: a TeamSummary means the same thing on both
 * pages, only what "go" refers to changes.
 */
export const TWO_POINT_METRICS: LeagueMetric[] = [
  {
    ...LEAGUE_METRICS[0],
    caption: 'Of the tries where the model said go for two, the share teams actually went for.',
  },
  {
    ...LEAGUE_METRICS[1],
    label: 'How often the model said go for two',
    caption:
      'The share of tries where two was the better option. A property of the scores and clocks teams faced, not of what they did about them.',
  },
  {
    ...LEAGUE_METRICS[2],
    caption: "The share of tries where the call matched the model's better option.",
  },
  {
    ...LEAGUE_METRICS[3],
    caption:
      'Points of win probability handed away per game on tries. A hundred points is one win, so a season at this rate is about a fifth of a win — more than half of what 4th downs cost.',
  },
]

export interface SeasonSpread {
  season: number
  /** Lower quartile, median and upper quartile across the 32 teams. */
  p25: number
  p50: number
  p75: number
  n: number
}

function quantile(sorted: number[], p: number): number {
  const position = (sorted.length - 1) * p
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

/**
 * The median team and the middle half of the league, per season.
 *
 * The band matters as much as the line: it says whether the league moved
 * together or came apart, and these teams did not move together.
 */
export function seasonSpreads(index: LeagueIndex, metric: LeagueMetric): SeasonSpread[] {
  return leagueSeasons(index)
    .map((season) => {
      const values = index.teams
        .map((team) => team.summaries.find((s) => s.season === season))
        .filter((s): s is TeamSummary => s !== undefined)
        .map((s) => metric.value(s))
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b)

      if (values.length === 0) return null
      return {
        season,
        p25: quantile(values, 0.25),
        p50: quantile(values, 0.5),
        p75: quantile(values, 0.75),
        n: values.length,
      }
    })
    .filter((s): s is SeasonSpread => s !== null)
}

/** The axis range over a metric's whole band, padded and bounded. */
export function spreadExtent(spreads: SeasonSpread[], metric: LeagueMetric): [number, number] {
  if (spreads.length === 0) return [0, 1]
  const lo = Math.min(...spreads.map((s) => s.p25))
  const hi = Math.max(...spreads.map((s) => s.p75))
  if (hi === lo) return [lo - 1, hi + 1]
  const pad = (hi - lo) * 0.15
  const [floor, ceiling] = metric.clamp ?? [-Infinity, Infinity]
  return [Math.max(floor, lo - pad), Math.min(ceiling, hi + pad)]
}

/** How far the median moved from the first season to the last. */
export interface Movement {
  first: SeasonSpread
  last: SeasonSpread
  /** Change in the metric's own units. */
  change: number
}

export function movement(spreads: SeasonSpread[]): Movement | null {
  if (spreads.length < 2) return null
  const first = spreads[0]
  const last = spreads.at(-1)!
  return { first, last, change: last.p50 - first.p50 }
}

/**
 * The completed seasons in the index, oldest first, which is how a trend
 * reads. A season still being played is left out: a week or two of games is
 * not a season's tendency, and as the last point it would set the headline.
 */
export function leagueSeasons(index: LeagueIndex): number[] {
  return index.seasons.filter((s) => s !== index.in_progress?.season).sort((a, b) => a - b)
}

export function recordLabel(summary: TeamSummary): string {
  const base = `${summary.wins}-${summary.losses}`
  return summary.ties > 0 ? `${base}-${summary.ties}` : base
}

export interface TeamPoint {
  season: number
  /** Null when the team has no data that season, or the metric no denominator. */
  value: number | null
  summary: TeamSummary | null
}

export interface TeamSeries {
  abbr: string
  points: TeamPoint[]
}

/**
 * One series per named team, with a point for every season on the chart so the
 * lines align with the league band behind them.
 */
export function teamSeries(
  index: LeagueIndex,
  metric: LeagueMetric,
  abbrs: string[],
  seasons: number[],
): TeamSeries[] {
  const wanted = new Set(abbrs)
  return index.teams
    .filter((team) => wanted.has(team.team_abbr))
    .map((team) => {
      const bySeason = new Map(team.summaries.map((s) => [s.season, s]))
      return {
        abbr: team.team_abbr,
        points: seasons.map((season) => {
          const summary = bySeason.get(season) ?? null
          return { season, value: summary ? metric.value(summary) : null, summary }
        }),
      }
    })
}

/**
 * The axis range, covering the league band and any selected team lines.
 *
 * Selected teams are included because a line that ran off the top of its own
 * panel would be worse than a slightly looser axis; the band still anchors the
 * reading.
 */
export function chartExtent(
  spreads: SeasonSpread[],
  series: TeamSeries[],
  metric: LeagueMetric,
): [number, number] {
  const values = [
    ...spreads.flatMap((s) => [s.p25, s.p75]),
    ...series.flatMap((s) => s.points.map((p) => p.value)).filter((v): v is number => v !== null),
  ]
  if (values.length === 0) return [0, 1]
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  if (hi === lo) return [lo - 1, hi + 1]
  const pad = (hi - lo) * 0.12
  const [floor, ceiling] = metric.clamp ?? [-Infinity, Infinity]
  return [Math.max(floor, lo - pad), Math.min(ceiling, hi + pad)]
}
