import { describe, expect, it } from 'vitest'
import { ALL, applyFilter, quartersOf, reconcile, weekLabel, weeksOf } from '../filters'
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
