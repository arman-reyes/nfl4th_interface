import { describe, expect, it } from 'vitest'
import {
  medianSeries,
  metricByKey,
  pearson,
  recordLabel,
  valueExtent,
  winPct,
} from '../trends'
import type { Pair, TrendSeries } from '../trends'
import type { TeamSummary } from '../../types'

function summary(over: Partial<TeamSummary> = {}): TeamSummary {
  return {
    season: 2024,
    games: 17,
    plays: 120,
    wins: 10,
    losses: 7,
    ties: 0,
    decisions: 110,
    go_recommended: 40,
    go_taken: 14,
    aggressiveness: 0.35,
    agreement: 0.7,
    wp_forfeited: 34,
    wp_forfeited_per_game: 2,
    ...over,
  }
}

describe('winPct', () => {
  it('counts a tie as half a win, the way the NFL does', () => {
    expect(winPct(summary({ wins: 10, losses: 7, ties: 0 }))).toBeCloseTo(10 / 17, 10)
    expect(winPct(summary({ wins: 8, losses: 8, ties: 1 }))).toBeCloseTo(0.5, 10)
  })

  it('is null when no games were played', () => {
    expect(winPct(summary({ wins: 0, losses: 0, ties: 0 }))).toBeNull()
  })
})

describe('recordLabel', () => {
  it('shows ties only when there were any', () => {
    expect(recordLabel(summary({ wins: 12, losses: 5, ties: 0 }))).toBe('12-5')
    expect(recordLabel(summary({ wins: 8, losses: 8, ties: 1 }))).toBe('8-8-1')
  })
})

function series(abbr: string, values: (number | null)[]): TrendSeries {
  return {
    abbr,
    name: abbr,
    points: values.map((value, i) => ({ season: 2020 + i, value, summary: null })),
  }
}

describe('medianSeries', () => {
  it('takes the median across teams for each season', () => {
    const all = [series('A', [1, 10]), series('B', [2, 20]), series('C', [3, 30])]
    expect(medianSeries(all, [2020, 2021])).toEqual([2, 20])
  })

  it('averages the middle pair when the count is even', () => {
    const all = [series('A', [1]), series('B', [2]), series('C', [3]), series('D', [4])]
    expect(medianSeries(all, [2020])).toEqual([2.5])
  })

  it('ignores seasons a team has no value for', () => {
    const all = [series('A', [null]), series('B', [4]), series('C', [6])]
    expect(medianSeries(all, [2020])).toEqual([5])
  })

  it('is null for a season nobody has', () => {
    expect(medianSeries([series('A', [null])], [2020])).toEqual([null])
  })
})

describe('valueExtent', () => {
  it('fits the data and holds inside the metric bounds', () => {
    const metric = metricByKey('aggressiveness')
    const [lo, hi] = valueExtent([series('A', [0.2, 0.6])], metric)
    expect(lo).toBeGreaterThanOrEqual(0)
    expect(hi).toBeLessThanOrEqual(1)
    expect(lo).toBeLessThan(0.2)
    expect(hi).toBeGreaterThan(0.6)
  })

  it('never lets a share run past 100%', () => {
    const [, hi] = valueExtent([series('A', [0.99, 1])], metricByKey('agreement'))
    expect(hi).toBe(1)
  })

  it('gives a usable range when every value is identical', () => {
    const [lo, hi] = valueExtent([series('A', [5, 5])], metricByKey('forfeited'))
    expect(hi).toBeGreaterThan(lo)
  })
})

function pair(x: number, y: number): Pair {
  return { abbr: 'AAA', season: 2024, x, y, record: '10-7' }
}

describe('pearson', () => {
  it('is 1 for a perfect rise and -1 for a perfect fall', () => {
    expect(pearson([pair(1, 1), pair(2, 2), pair(3, 3)])).toBeCloseTo(1, 10)
    expect(pearson([pair(1, 3), pair(2, 2), pair(3, 1)])).toBeCloseTo(-1, 10)
  })

  it('is null when a variable never varies, rather than dividing by zero', () => {
    expect(pearson([pair(1, 5), pair(2, 5), pair(3, 5)])).toBeNull()
  })

  it('is null below three points, where it would mean nothing', () => {
    expect(pearson([pair(1, 1), pair(2, 2)])).toBeNull()
  })
})
