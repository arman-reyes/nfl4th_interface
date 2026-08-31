import type { LeagueIndex, TeamSummary } from '../types'
import type { LeagueMetric } from './league'

/**
 * Setting a tendency against how teams actually finished — and, more usefully,
 * working out whether that comparison could ever have shown anything.
 */

/**
 * Winning percentage the way the NFL counts it: a tie is half a win. Records
 * cover every game in the data, postseason included.
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

export interface Pair {
  abbr: string
  season: number
  x: number
  y: number
  record: string
}

/** Every team-season as a (metric, win percentage) pair. */
export function metricAgainstRecord(index: LeagueIndex, metric: LeagueMetric): Pair[] {
  const pairs: Pair[] = []
  for (const team of index.teams) {
    for (const summary of team.summaries) {
      if (summary.season === null) continue
      const x = metric.value(summary)
      const y = winPct(summary)
      if (x === null || y === null) continue
      pairs.push({
        abbr: team.team_abbr,
        season: summary.season,
        x,
        y,
        record: recordLabel(summary),
      })
    }
  }
  return pairs
}

/**
 * Pearson correlation. Always reported with n beside it and described as an
 * association: 32 teams making their own decisions is not an experiment, and
 * the causation could run either way — a team that is behind goes for it more.
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

/** The horizontal range for the scatter, padded and held inside the metric's bounds. */
export function pairExtent(pairs: Pair[], metric: LeagueMetric): [number, number] {
  if (pairs.length === 0) return [0, 1]
  const xs = pairs.map((p) => p.x)
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  if (hi === lo) return [lo - 1, hi + 1]
  const pad = (hi - lo) * 0.06
  const [floor, ceiling] = metric.clamp ?? [-Infinity, Infinity]
  return [Math.max(floor, lo - pad), Math.min(ceiling, hi + pad)]
}

/**
 * How big the thing being measured actually is, and whether a correlation
 * against the standings could ever see it.
 *
 * Win probability points sum to expected wins by definition — a hundred points
 * is one win — so the cost of a season of 4th-down calls can be stated in wins
 * without any correlation at all. The correlation is a far weaker instrument,
 * and this is the arithmetic that says so.
 */
export interface EffectSize {
  n: number
  /** Expected wins given up on 4th down, per team-season. */
  meanWins: number
  sdWins: number
  maxWins: number
  /** Spread in actual wins, which is what a correlation has to see through. */
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
