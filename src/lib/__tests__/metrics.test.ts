import { describe, expect, it } from 'vitest'
import { deviationGrid, summarize, summarizeAll } from '../metrics'
import { makePlay } from './fixtures'

const plays = [
  // Model says go (+5), they punted: a deviation costing 5 points.
  makePlay({ game_id: 'g1', season: 2024, go_boost: 5, go_wp: 0.56, punt_wp: 0.51, play_type: 'punt' }),
  // Model says go (+2), they went: agreement, no cost.
  makePlay({ game_id: 'g1', season: 2024, go_boost: 2, go_wp: 0.53, punt_wp: 0.51, play_type: 'run' }),
  // Model says punt (-4), they punted: agreement.
  makePlay({ game_id: 'g2', season: 2024, go_boost: -4, go_wp: 0.47, punt_wp: 0.51, play_type: 'punt' }),
  // No decision: excluded everywhere.
  makePlay({ game_id: 'g2', season: 2024, go_boost: 9, play_type: 'no_play' }),
  // A different season, to prove scoping works.
  makePlay({ game_id: 'g3', season: 2023, go_boost: 8, go_wp: 0.6, punt_wp: 0.52, play_type: 'punt' }),
]

describe('summarize', () => {
  it('scopes to a season and counts only classifiable decisions', () => {
    const s = summarize(plays, 2024)
    expect(s.decisions).toBe(3)
    expect(s.games).toBe(2)
  })

  it('measures aggressiveness against the plays the model wanted them to go on', () => {
    const s = summarize(plays, 2024)
    expect(s.go_recommended).toBe(2)
    expect(s.go_taken).toBe(1)
    expect(s.aggressiveness).toBeCloseTo(0.5, 10)
  })

  it('measures agreement across every decision', () => {
    const s = summarize(plays, 2024)
    expect(s.agreement).toBeCloseTo(2 / 3, 10)
  })

  it('sums forfeited win probability in percentage points and per game', () => {
    const s = summarize(plays, 2024)
    expect(s.wp_forfeited).toBeCloseTo(5, 6)
    expect(s.wp_forfeited_per_game).toBeCloseTo(2.5, 6)
  })

  it('reports nulls rather than zeros when a rate has no denominator', () => {
    const s = summarize([], null)
    expect(s.aggressiveness).toBeNull()
    expect(s.agreement).toBeNull()
    expect(s.decisions).toBe(0)
  })

  it('leads with the all-seasons row, then seasons newest first', () => {
    const all = summarizeAll(plays)
    expect(all.map((s) => s.season)).toEqual([null, 2024, 2023])
    expect(all[0].decisions).toBe(4)
  })
})

describe('deviationGrid', () => {
  it('covers every zone and band, with empty cells reported as null', () => {
    const grid = deviationGrid(plays)
    expect(grid).toHaveLength(12)
    expect(grid.filter((c) => c.decisions === 0).every((c) => c.rate === null)).toBe(true)
  })

  it('accumulates deviations and cost into the right cell', () => {
    // yardline_100 55 is own half; go_boost 5 and 8 are clear calls.
    const cell = deviationGrid(plays).find((c) => c.zone === 'Own half' && c.band === 'clear')
    expect(cell?.decisions).toBe(3)
    expect(cell?.deviations).toBe(2)
    expect(cell?.rate).toBeCloseTo(2 / 3, 10)
    expect(cell?.wp_forfeited).toBeCloseTo(13, 6)
  })

  it('totals only the plays that carried a decision', () => {
    const total = deviationGrid(plays).reduce((sum, c) => sum + c.decisions, 0)
    expect(total).toBe(4)
  })
})
