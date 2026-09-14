import { describe, expect, it } from 'vitest'
import {
  chartExtent,
  LEAGUE_METRICS,
  leagueSeasons,
  movement,
  recordLabel,
  seasonSpreads,
  spreadExtent,
  teamSeries,
} from '../league'
import type { LeagueIndex, SeasonProgress, TeamSummary } from '../../types'

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

function index(
  teams: ReturnType<typeof team>[],
  seasons = [2024, 2023],
  in_progress: SeasonProgress | null = null,
): LeagueIndex {
  return { generated_at: '2026-01-01T00:00:00Z', seasons, fixture: false, in_progress, teams }
}

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

  it('leaves a season still being played off the trend', () => {
    const partial = index(
      [
        team('A', [summary({ season: 2024, aggressiveness: 0.4 }), summary({ season: 2025, aggressiveness: 0.9 })]),
        team('B', [summary({ season: 2024, aggressiveness: 0.5 }), summary({ season: 2025, aggressiveness: 0.9 })]),
      ],
      [2025, 2024],
      { season: 2025, through_week: 2 },
    )
    expect(leagueSeasons(partial)).toEqual([2024])
    expect(seasonSpreads(partial, AGGRESSIVENESS).map((s) => s.season)).toEqual([2024])
  })

  it('keeps every season once the index says none is in progress', () => {
    const done = index([team('A', [summary({ season: 2023 }), summary({ season: 2024 })])])
    expect(leagueSeasons(done)).toEqual([2023, 2024])
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

describe('teamSeries', () => {
  const two = index([
    team('A', [summary({ season: 2023, aggressiveness: 0.2 }), summary({ season: 2024, aggressiveness: 0.5 })]),
    team('B', [summary({ season: 2024, aggressiveness: 0.9 })]),
  ])

  it('returns only the teams asked for', () => {
    expect(teamSeries(two, AGGRESSIVENESS, ['B'], [2023, 2024]).map((s) => s.abbr)).toEqual(['B'])
  })

  it('has a point for every season on the chart, so lines align with the band', () => {
    const [b] = teamSeries(two, AGGRESSIVENESS, ['B'], [2023, 2024])
    expect(b.points.map((p) => p.season)).toEqual([2023, 2024])
    expect(b.points[0].value).toBeNull()
    expect(b.points[1].value).toBeCloseTo(0.9, 10)
  })

  it('carries the summary so a readout can show the record', () => {
    const [a] = teamSeries(two, AGGRESSIVENESS, ['A'], [2024])
    expect(a.points[0].summary?.wins).toBe(10)
  })

  it('returns nothing when no team is selected', () => {
    expect(teamSeries(two, AGGRESSIVENESS, [], [2024])).toEqual([])
  })
})

describe('chartExtent', () => {
  const spreads = [{ season: 2024, p25: 0.3, p50: 0.35, p75: 0.4, n: 32 }]

  it('covers the band when nothing is selected', () => {
    const [lo, hi] = chartExtent(spreads, [], AGGRESSIVENESS)
    expect(lo).toBeLessThan(0.3)
    expect(hi).toBeGreaterThan(0.4)
  })

  it('stretches to hold a selected line that runs outside the band', () => {
    const outlier = [{ abbr: 'A', points: [{ season: 2024, value: 0.8, summary: null }] }]
    const [, hi] = chartExtent(spreads, outlier, AGGRESSIVENESS)
    expect(hi).toBeGreaterThanOrEqual(0.8)
  })

  it('still respects the metric bounds', () => {
    const outlier = [{ abbr: 'A', points: [{ season: 2024, value: 1, summary: null }] }]
    expect(chartExtent(spreads, outlier, AGGRESSIVENESS)[1]).toBe(1)
  })
})
