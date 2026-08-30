import { describe, expect, it } from 'vitest'
import { decisionImpact, gameState, impactOf } from '../impact'
import { makePlay } from './fixtures'

describe('impactOf', () => {
  it('uses the same 1 and 3 point scale as the strength band', () => {
    expect(impactOf(0.9)).toBe('minor')
    expect(impactOf(1)).toBe('notable')
    expect(impactOf(3)).toBe('notable')
    expect(impactOf(3.01)).toBe('costly')
  })
})

describe('gameState', () => {
  it('reads the win probability of the model’s own recommendation', () => {
    // Model punts, punt_wp is the standing going into the down.
    expect(gameState(makePlay({ go_boost: -4, punt_wp: 0.52, fg_wp: null }))).toBe('in doubt')
    expect(gameState(makePlay({ go_boost: -4, punt_wp: 0.72, fg_wp: null }))).toBe('leaning')
    expect(gameState(makePlay({ go_boost: -4, punt_wp: 0.9, fg_wp: null }))).toBe('lopsided')
    expect(gameState(makePlay({ go_boost: -4, punt_wp: 0.97, fg_wp: null }))).toBe('decided')
  })

  it('is symmetric, so being buried counts the same as being clear', () => {
    expect(gameState(makePlay({ go_boost: -4, punt_wp: 0.03, fg_wp: null }))).toBe('decided')
    expect(gameState(makePlay({ go_boost: -4, punt_wp: 0.1, fg_wp: null }))).toBe('lopsided')
  })
})

describe('decisionImpact', () => {
  it('is null when the staff agreed with the model', () => {
    const play = makePlay({ play_type: 'punt', go_boost: -4, go_wp: 0.47, punt_wp: 0.51 })
    expect(decisionImpact(play)).toBeNull()
  })

  it('is null when the play carried no decision', () => {
    expect(decisionImpact(makePlay({ play_type: 'no_play' }))).toBeNull()
  })

  it('reports the cost, its tier, and the state of the game', () => {
    const play = makePlay({
      play_type: 'punt',
      go_boost: 5,
      go_wp: 0.56,
      punt_wp: 0.51,
      fg_wp: null,
    })
    expect(decisionImpact(play)).toEqual({
      cost: expect.closeTo(5, 6),
      tier: 'costly',
      state: 'in doubt',
      inert: false,
    })
  })

  it('marks a disagreement in a decided game as inert', () => {
    const play = makePlay({
      play_type: 'punt',
      go_boost: 0.4,
      go_wp: 0.977,
      punt_wp: 0.973,
      fg_wp: null,
    })
    const impact = decisionImpact(play)
    expect(impact?.inert).toBe(true)
    expect(impact?.state).toBe('decided')
    expect(impact?.tier).toBe('minor')
  })

  it('does not mute a small cost when the game was still live', () => {
    const play = makePlay({
      play_type: 'punt',
      go_boost: 0.4,
      go_wp: 0.524,
      punt_wp: 0.52,
      fg_wp: null,
    })
    expect(decisionImpact(play)?.inert).toBe(false)
    expect(decisionImpact(play)?.tier).toBe('minor')
  })
})
