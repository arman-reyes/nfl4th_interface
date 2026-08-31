import type { LeagueIndex, TeamSummary } from '../types'

/**
 * League-wide trends: one value per team per season, for a chosen metric.
 *
 * Everything here reads `index.json` alone. The per-season summaries are
 * already precomputed there, so the trends view needs no team files at all —
 * it is one small request no matter how many teams are on the chart.
 */

export type TrendMetricKey =
  | 'aggressiveness'
  | 'agreement'
  | 'forfeited'
  | 'forfeitedPerGame'
  | 'winPct'

export interface TrendMetric {
  key: TrendMetricKey
  label: string
  /** Null when the season has no denominator for it. */
  value: (summary: TeamSummary) => number | null
  format: (value: number) => string
  /** Bounds the fitted axis may not exceed, e.g. a share cannot leave 0-1. */
  clamp: [number, number] | null
  note: string
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`
const pts = (v: number) => v.toFixed(1)

/**
 * Winning percentage the way the NFL counts it: a tie is half a win. Records
 * here cover every game in the data, postseason included.
 */
export function winPct(summary: TeamSummary): number | null {
  const played = summary.wins + summary.losses + summary.ties
  if (played === 0) return null
  return (summary.wins + 0.5 * summary.ties) / played
}

export function recordLabel(summary: TeamSummary): string {
  const base = `${summary.wins}-${summary.losses}`
  return summary.ties > 0 ? `${base}-${summary.ties}` : base
}

export const TREND_METRICS: TrendMetric[] = [
  {
    key: 'aggressiveness',
    label: 'Aggressiveness',
    value: (s) => s.aggressiveness,
    format: pct,
    clamp: [0, 1],
    note: 'Of the 4th downs where the model recommended going, the share the staff went for.',
  },
  {
    key: 'agreement',
    label: 'Agreement',
    value: (s) => s.agreement,
    format: pct,
    clamp: [0, 1],
    note: "Share of decisions matching the model's top option.",
  },
  {
    key: 'forfeited',
    label: 'Given up, total',
    value: (s) => s.wp_forfeited,
    format: pts,
    clamp: [0, Infinity],
    note: 'Win probability points given up across the season. Seasons before 2021 were 16 games rather than 17, so totals are not perfectly comparable across that line — the per-game metric is.',
  },
  {
    key: 'forfeitedPerGame',
    label: 'Given up, per game',
    value: (s) => s.wp_forfeited_per_game,
    format: pts,
    clamp: [0, Infinity],
    note: 'The same figure divided by games played, which is comparable across every season.',
  },
  {
    key: 'winPct',
    label: 'Win %',
    value: winPct,
    format: pct,
    clamp: [0, 1],
    note: 'Every game in the data, postseason included. A tie counts as half a win.',
  },
]

export function metricByKey(key: TrendMetricKey): TrendMetric {
  return TREND_METRICS.find((m) => m.key === key) ?? TREND_METRICS[0]
}

export interface TrendPoint {
  season: number
  /** Null when the team has no data for that season, or the metric no denominator. */
  value: number | null
  summary: TeamSummary | null
}

export interface TrendSeries {
  abbr: string
  name: string
  points: TrendPoint[]
}

/** Every season in the index, oldest first, which is how a trend reads. */
export function trendSeasons(index: LeagueIndex): number[] {
  return [...index.seasons].sort((a, b) => a - b)
}

/** One series per team, with a point for every league season so lines align. */
export function buildSeries(
  index: LeagueIndex,
  metric: TrendMetric,
  abbrs?: string[],
): TrendSeries[] {
  const seasons = trendSeasons(index)
  const wanted = abbrs ? new Set(abbrs) : null

  return index.teams
    .filter((team) => (wanted ? wanted.has(team.team_abbr) : true))
    .map((team) => {
      const bySeason = new Map(team.summaries.map((s) => [s.season, s]))
      return {
        abbr: team.team_abbr,
        name: team.team_name,
        points: seasons.map((season) => {
          const summary = bySeason.get(season) ?? null
          return { season, value: summary ? metric.value(summary) : null, summary }
        }),
      }
    })
}

/** The league median for each season, the reference a single line is read against. */
export function medianSeries(series: TrendSeries[], seasons: number[]): (number | null)[] {
  return seasons.map((_, index) => {
    const values = series
      .map((s) => s.points[index]?.value)
      .filter((v): v is number => v !== null && v !== undefined)
      .sort((a, b) => a - b)
    if (values.length === 0) return null
    const middle = Math.floor(values.length / 2)
    return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle]
  })
}

/**
 * The axis range, fitted to the data with a little padding and held inside the
 * metric's natural bounds.
 *
 * Always computed across all 32 teams, never the selection: an axis that
 * rescaled every time a team was toggled would make two selections
 * incomparable, and the grey context lines behind would slide with it.
 */
export function valueExtent(series: TrendSeries[], metric: TrendMetric): [number, number] {
  const values = series
    .flatMap((s) => s.points.map((p) => p.value))
    .filter((v): v is number => v !== null)
  if (values.length === 0) return [0, 1]
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  if (hi === lo) return [lo - 1, hi + 1]
  const pad = (hi - lo) * 0.08
  const [floor, ceiling] = metric.clamp ?? [-Infinity, Infinity]
  return [Math.max(floor, lo - pad), Math.min(ceiling, hi + pad)]
}

export interface Pair {
  abbr: string
  season: number
  x: number
  y: number
  record: string
}

/**
 * Every team-season as a (metric, win percentage) pair, for the scatter that
 * asks whether a tendency travels with winning.
 */
export function metricAgainstRecord(series: TrendSeries[], metric: TrendMetric): Pair[] {
  const pairs: Pair[] = []
  for (const team of series) {
    for (const point of team.points) {
      if (point.summary === null) continue
      const x = metric.value(point.summary)
      const y = winPct(point.summary)
      if (x === null || y === null) continue
      pairs.push({ abbr: team.abbr, season: point.season, x, y, record: recordLabel(point.summary) })
    }
  }
  return pairs
}

/**
 * Pearson correlation. Reported with n beside it and described as an
 * association, because that is all it is: these are 32 teams making their own
 * decisions, not an experiment, and the causation could run either way — a
 * team that is behind goes for it more.
 */
export function pearson(pairs: Pair[]): number | null {
  const n = pairs.length
  if (n < 3) return null
  const meanX = pairs.reduce((sum, p) => sum + p.x, 0) / n
  const meanY = pairs.reduce((sum, p) => sum + p.y, 0) / n
  let covariance = 0
  let varianceX = 0
  let varianceY = 0
  for (const p of pairs) {
    const dx = p.x - meanX
    const dy = p.y - meanY
    covariance += dx * dy
    varianceX += dx * dx
    varianceY += dy * dy
  }
  if (varianceX === 0 || varianceY === 0) return null
  return covariance / Math.sqrt(varianceX * varianceY)
}

/**
 * How big the thing being measured actually is, and whether a correlation
 * against the standings could ever see it.
 *
 * Win probability points sum to expected wins by definition — a hundred points
 * is one win — so the cost of a season of 4th-down calls can be stated in wins
 * without any correlation at all. The correlation is a far weaker instrument,
 * and this reports the arithmetic that says so.
 */
export interface EffectSize {
  n: number
  /** Expected wins given up on 4th down, per team-season. */
  meanWins: number
  sdWins: number
  maxWins: number
  /** Spread in actual wins, which is what the correlation has to see through. */
  sdActualWins: number
  /** The largest r possible if 4th-down cost were the only thing that varied. */
  ceiling: number
  /** Standard error of r at this sample size. */
  standardError: number
}

/** A hundred win probability points is one expected win. */
export const POINTS_PER_WIN = 100

export function effectSize(index: LeagueIndex): EffectSize {
  const rows = index.teams.flatMap((team) =>
    team.summaries.filter((s) => s.season !== null && s.games > 0),
  )
  const givenUp = rows.map((s) => s.wp_forfeited / POINTS_PER_WIN)
  const actual = rows.map((s) => s.wins)

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const sd = (xs: number[]) => {
    const m = mean(xs)
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
  }

  const n = rows.length
  const sdWins = sd(givenUp)
  const sdActualWins = sd(actual)

  return {
    n,
    meanWins: mean(givenUp),
    sdWins,
    maxWins: Math.max(...givenUp),
    sdActualWins,
    ceiling: sdWins / sdActualWins,
    standardError: 1 / Math.sqrt(Math.max(1, n - 3)),
  }
}
