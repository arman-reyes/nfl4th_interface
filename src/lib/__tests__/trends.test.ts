import { describe, expect, it } from 'vitest'
import { effectSize, metricAgainstRecord, pairExtent, pearson, recordLabel, winPct } from '../trends'
import type { Pair } from '../trends'
import { LEAGUE_METRICS, movement, seasonSpreads, spreadExtent } from '../league'
import type { LeagueIndex, TeamSummary } from '../../types'

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

function team(abbr: string, summaries: TeamSummary[]) {
  return {
    team_abbr: abbr,
    team_name: abbr,
    team_conf: 'AFC',
    team_division: 'AFC East',
    team_color: '#000000',
    team_color2: '#ffffff',
    summaries,
  }
}

function index(teams: ReturnType<typeof team>[], seasons = [2024, 2023]): LeagueIndex {
  return { generated_at: '2026-01-01T00:00:00Z', seasons, fixture: false, teams }
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

const AGGRESSIVENESS = LEAGUE_METRICS[0]
const SAID_GO = LEAGUE_METRICS[1]

describe('seasonSpreads', () => {
  const four = index([
    team('A', [summary({ season: 2023, aggressiveness: 0.1 }), summary({ season: 2024, aggressiveness: 0.4 })]),
    team('B', [summary({ season: 2023, aggressiveness: 0.2 }), summary({ season: 2024, aggressiveness: 0.5 })]),
    team('C', [summary({ season: 2023, aggressiveness: 0.3 }), summary({ season: 2024, aggressiveness: 0.6 })]),
    team('D', [summary({ season: 2023, aggressiveness: 0.4 }), summary({ season: 2024, aggressiveness: 0.7 })]),
  ])

  it('runs oldest season first, which is how a trend reads', () => {
    expect(seasonSpreads(four, AGGRESSIVENESS).map((s) => s.season)).toEqual([2023, 2024])
  })

  it('reports the median and the middle half of the league', () => {
    const [first] = seasonSpreads(four, AGGRESSIVENESS)
    expect(first.p50).toBeCloseTo(0.25, 10)
    expect(first.p25).toBeCloseTo(0.175, 10)
    expect(first.p75).toBeCloseTo(0.325, 10)
    expect(first.n).toBe(4)
  })

  it('skips a season no team has data for', () => {
    const sparse = index([team('A', [summary({ season: 2024 })])], [2024, 2023])
    expect(seasonSpreads(sparse, AGGRESSIVENESS).map((s) => s.season)).toEqual([2024])
  })

  it('derives how often the model said go from the summary counts', () => {
    const one = index([team('A', [summary({ season: 2024, go_recommended: 44, decisions: 110 })])], [2024])
    expect(seasonSpreads(one, SAID_GO)[0].p50).toBeCloseTo(0.4, 10)
  })
})

describe('movement', () => {
  it('measures the median from the first season to the last', () => {
    const two = index([
      team('A', [summary({ season: 2023, aggressiveness: 0.2 }), summary({ season: 2024, aggressiveness: 0.5 })]),
    ])
    const shift = movement(seasonSpreads(two, AGGRESSIVENESS))
    expect(shift?.first.p50).toBeCloseTo(0.2, 10)
    expect(shift?.last.p50).toBeCloseTo(0.5, 10)
    expect(shift?.change).toBeCloseTo(0.3, 10)
  })

  it('is null with fewer than two seasons to compare', () => {
    expect(movement([])).toBeNull()
  })
})

describe('spreadExtent', () => {
  it('covers the whole band and stays inside the metric bounds', () => {
    const spreads = [{ season: 2024, p25: 0.9, p50: 0.95, p75: 1, n: 32 }]
    const [lo, hi] = spreadExtent(spreads, AGGRESSIVENESS)
    expect(hi).toBe(1)
    expect(lo).toBeLessThan(0.9)
    expect(lo).toBeGreaterThanOrEqual(0)
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

describe('metricAgainstRecord', () => {
  it('leaves out the all-seasons row, which would double count', () => {
    const one = index([team('A', [summary({ season: null }), summary({ season: 2024 })])])
    expect(metricAgainstRecord(one, AGGRESSIVENESS)).toHaveLength(1)
  })

  it('carries the record for the tooltip', () => {
    const one = index([team('A', [summary({ season: 2024, wins: 12, losses: 5 })])])
    expect(metricAgainstRecord(one, AGGRESSIVENESS)[0].record).toBe('12-5')
  })
})

describe('pairExtent', () => {
  it('gives a usable range when every value is identical', () => {
    const [lo, hi] = pairExtent([pair(0.3, 0.5), pair(0.3, 0.6)], AGGRESSIVENESS)
    expect(hi).toBeGreaterThan(lo)
  })
})

describe('effectSize', () => {
  const two = index([
    team('A', [
      summary({ season: null, wp_forfeited: 999, wins: 99 }),
      summary({ season: 2024, wp_forfeited: 40, wins: 12 }),
      summary({ season: 2023, wp_forfeited: 60, wins: 4 }),
    ]),
  ])

  it('states the cost in wins, a hundred points to one', () => {
    expect(effectSize(two).meanWins).toBeCloseTo(0.5, 10)
    expect(effectSize(two).maxWins).toBeCloseTo(0.6, 10)
  })

  it('ignores the all-seasons row', () => {
    expect(effectSize(two).n).toBe(2)
  })

  it('reports the ceiling as the ratio of the two spreads', () => {
    const effect = effectSize(two)
    // Given up: 0.4 and 0.6, sd 0.1. Wins: 12 and 4, sd 4.
    expect(effect.sdWins).toBeCloseTo(0.1, 10)
    expect(effect.sdActualWins).toBeCloseTo(4, 10)
    expect(effect.ceiling).toBeCloseTo(0.025, 10)
  })
})
