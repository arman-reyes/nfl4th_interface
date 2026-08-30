import { describe, expect, it } from 'vitest'
import {
  ALL,
  applyFilter,
  gameResult,
  groupByGame,
  quartersOf,
  reconcile,
  weekLabel,
  weeksOf,
} from '../filters'
import { makePlay } from './fixtures'

const plays = [
  makePlay({ season: 2025, week: 1, qtr: 2, quarter_seconds_remaining: 300 }),
  makePlay({ season: 2025, week: 1, qtr: 2, quarter_seconds_remaining: 800 }),
  makePlay({ season: 2025, week: 4, qtr: 4, quarter_seconds_remaining: 120 }),
  makePlay({ season: 2024, week: 21, qtr: 1, quarter_seconds_remaining: 500 }),
]

describe('weekLabel', () => {
  it('names the postseason rounds rather than counting past 18', () => {
    expect(weekLabel(7)).toBe('7')
    expect(weekLabel(21)).toBe('CONF')
    expect(weekLabel(22)).toBe('SB')
  })
})

describe('option lists', () => {
  it('offers only the weeks the team actually played that season', () => {
    expect(weeksOf(plays, 2025)).toEqual([1, 4])
    expect(weeksOf(plays, 2024)).toEqual([21])
  })

  it('narrows quarters to the chosen week', () => {
    expect(quartersOf(plays, 2025, ALL)).toEqual([2, 4])
    expect(quartersOf(plays, 2025, 4)).toEqual([4])
  })
})

describe('applyFilter', () => {
  it('filters and orders by game time', () => {
    const result = applyFilter(plays, { season: 2025, week: 1, qtr: ALL })
    expect(result).toHaveLength(2)
    expect(result[0].quarter_seconds_remaining).toBe(800)
  })

  it('treats all as no constraint', () => {
    expect(applyFilter(plays, { season: 2025, week: ALL, qtr: ALL })).toHaveLength(3)
  })
})

describe('reconcile', () => {
  it('defaults to the most recent season', () => {
    expect(reconcile(plays, null)).toEqual({ season: 2025, week: ALL, qtr: ALL })
  })

  it('keeps a selection that still exists', () => {
    const filter = { season: 2025, week: 4, qtr: 4 }
    expect(reconcile(plays, filter)).toEqual(filter)
  })

  it('drops a week the team did not play instead of showing nothing', () => {
    expect(reconcile(plays, { season: 2025, week: 9, qtr: 3 })).toEqual({
      season: 2025,
      week: ALL,
      qtr: ALL,
    })
  })

  it('drops a quarter that the surviving week does not contain', () => {
    expect(reconcile(plays, { season: 2025, week: 4, qtr: 1 })).toEqual({
      season: 2025,
      week: 4,
      qtr: ALL,
    })
  })
})

describe('groupByGame', () => {
  const ordered = [
    makePlay({ game_id: 'a', week: 1, defteam: 'NYJ' }),
    makePlay({ game_id: 'a', week: 1, defteam: 'NYJ' }),
    makePlay({ game_id: 'b', week: 2, defteam: 'SEA' }),
  ]

  it('carries the venue and the final score onto the group', () => {
    const groups = groupByGame([
      makePlay({ game_id: 'a', posteam_home: false, posteam_final_score: 17, defteam_final_score: 31 }),
    ])
    expect(groups[0].home).toBe(false)
    expect(groups[0].result).toEqual({ outcome: 'L', for: 17, against: 31 })
  })

  it('collects consecutive plays from the same game', () => {
    const groups = groupByGame(ordered)
    expect(groups.map((g) => g.gameId)).toEqual(['a', 'b'])
    expect(groups[0].plays).toHaveLength(2)
    expect(groups[0].opponent).toBe('NYJ')
  })

  it('keeps the order it was given', () => {
    expect(groupByGame(ordered).map((g) => g.week)).toEqual([1, 2])
  })

  it('handles an empty list', () => {
    expect(groupByGame([])).toEqual([])
  })
})

describe('gameResult', () => {
  it('reads the final score from the viewed team’s side', () => {
    expect(gameResult(makePlay({ posteam_final_score: 28, defteam_final_score: 14 }))).toEqual({
      outcome: 'W',
      for: 28,
      against: 14,
    })
    expect(gameResult(makePlay({ posteam_final_score: 14, defteam_final_score: 28 }))).toEqual({
      outcome: 'L',
      for: 14,
      against: 28,
    })
  })

  it('handles a tie, which the NFL still allows', () => {
    expect(gameResult(makePlay({ posteam_final_score: 20, defteam_final_score: 20 }))?.outcome).toBe(
      'T',
    )
  })

  it('is null when the game has no recorded result', () => {
    expect(gameResult(makePlay({ posteam_final_score: null }))).toBeNull()
    expect(gameResult(makePlay({ defteam_final_score: null }))).toBeNull()
  })
})
