import { describe, expect, it } from 'vitest'
import { costliest, summarizeGames, tallyByOutcome } from '../games'
import { choiceMatrix } from '../metrics'
import { makePlay } from './fixtures'

/** A disagreement costing `cost` points, in a game at `bestWp` win probability. */
function deviation(gameId: string, week: number, cost: number, bestWp: number, over: object = {}) {
  return makePlay({
    game_id: gameId,
    week,
    play_type: 'punt',
    go_boost: cost,
    go_wp: bestWp,
    punt_wp: bestWp - cost / 100,
    fg_wp: null,
    ...over,
  })
}

const plays = [
  // Week 1, a loss: two live disagreements worth 6 points, one in garbage time.
  deviation('g1', 1, 4, 0.5, { posteam_final_score: 17, defteam_final_score: 24 }),
  deviation('g1', 1, 2, 0.6, { posteam_final_score: 17, defteam_final_score: 24 }),
  deviation('g1', 1, 1, 0.98, { posteam_final_score: 17, defteam_final_score: 24 }),
  // Week 2, a win with one live disagreement worth 3.
  deviation('g2', 2, 3, 0.55, { posteam_final_score: 28, defteam_final_score: 14 }),
  // Week 3, a win where they agreed throughout.
  makePlay({
    game_id: 'g3',
    week: 3,
    play_type: 'punt',
    go_boost: -5,
    go_wp: 0.45,
    punt_wp: 0.5,
    fg_wp: null,
    posteam_final_score: 20,
    defteam_final_score: 10,
  }),
]

describe('summarizeGames', () => {
  it('rolls up one entry per game, in week order', () => {
    expect(summarizeGames(plays).map((g) => g.gameId)).toEqual(['g1', 'g2', 'g3'])
  })

  it('sums what the decisions gave away', () => {
    const g1 = summarizeGames(plays)[0]
    expect(g1.decisions).toBe(3)
    expect(g1.disagreements).toBe(3)
    expect(g1.forfeited).toBeCloseTo(7, 6)
  })

  it('separates what was given up while the game was still live', () => {
    // The 1-point call came at a 98% win probability and is excluded.
    expect(summarizeGames(plays)[0].forfeitedLive).toBeCloseTo(6, 6)
  })

  it('carries the result so games can be split by outcome', () => {
    const [g1, g2] = summarizeGames(plays)
    expect(g1.result?.outcome).toBe('L')
    expect(g2.result?.outcome).toBe('W')
  })

  it('counts a game with no disagreements at zero rather than dropping it', () => {
    const g3 = summarizeGames(plays)[2]
    expect(g3.decisions).toBe(1)
    expect(g3.disagreements).toBe(0)
    expect(g3.forfeited).toBe(0)
  })
})

describe('costliest', () => {
  it('ranks by what was given up while live, within one outcome', () => {
    const games = summarizeGames(plays)
    expect(costliest(games, 'L').map((g) => g.gameId)).toEqual(['g1'])
    expect(costliest(games, 'W').map((g) => g.gameId)).toEqual(['g2'])
  })

  it('leaves out games that gave away nothing', () => {
    expect(costliest(summarizeGames(plays), 'W').map((g) => g.gameId)).not.toContain('g3')
  })

  it('respects the limit', () => {
    expect(costliest(summarizeGames(plays), 'L', 0)).toEqual([])
  })
})

describe('tallyByOutcome', () => {
  it('counts games won despite going against the model', () => {
    const t = tallyByOutcome(summarizeGames(plays), 'W')
    expect(t.games).toBe(2)
    expect(t.withDisagreement).toBe(1)
  })
})

describe('choiceMatrix', () => {
  it('has a row per model recommendation, always all three', () => {
    expect(choiceMatrix([]).map((r) => r.model)).toEqual(['go', 'fg', 'punt'])
  })

  it('tallies what the staff did against what the model asked', () => {
    const row = choiceMatrix(plays).find((r) => r.model === 'go')
    // Four of the five plays have go_boost > 0; all four were punted.
    expect(row?.total).toBe(4)
    expect(row?.counts.punt).toBe(4)
    expect(row?.counts.go).toBe(0)
  })

  it('excludes plays that carried no decision', () => {
    const withNoPlay = [...plays, makePlay({ play_type: 'no_play', go_boost: 9 })]
    const total = choiceMatrix(withNoPlay).reduce((sum, r) => sum + r.total, 0)
    expect(total).toBe(5)
  })
})
