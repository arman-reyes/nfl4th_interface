import { describe, expect, it } from 'vitest'
import {
  actualChoice,
  agreed,
  band,
  modelChoice,
  options,
  wpForfeited,
  wpOf,
} from '../decision'
import { makePlay } from './fixtures'

describe('actualChoice', () => {
  it('maps run and pass to going for it', () => {
    expect(actualChoice(makePlay({ play_type: 'run' }))).toBe('go')
    expect(actualChoice(makePlay({ play_type: 'pass' }))).toBe('go')
  })

  it('maps kicks and punts', () => {
    expect(actualChoice(makePlay({ play_type: 'field_goal' }))).toBe('fg')
    expect(actualChoice(makePlay({ play_type: 'punt' }))).toBe('punt')
  })

  it('returns null for anything else so the play leaves the statistics', () => {
    expect(actualChoice(makePlay({ play_type: 'no_play' }))).toBeNull()
    expect(actualChoice(makePlay({ play_type: null }))).toBeNull()
  })
})

describe('options', () => {
  it('drops options the situation does not allow', () => {
    const play = makePlay({ fg_wp: null, punt_wp: null })
    expect(options(play).map((o) => o.choice)).toEqual(['go'])
  })

  it('sorts by expected win probability, best first', () => {
    const play = makePlay({ go_wp: 0.4, fg_wp: 0.6, punt_wp: 0.5 })
    expect(options(play).map((o) => o.choice)).toEqual(['fg', 'punt', 'go'])
  })
})

describe('modelChoice', () => {
  it('follows the sign of go_boost rather than a raw argmax', () => {
    // go_wp trails fg_wp by a rounding hair, but go_boost says go.
    const play = makePlay({ go_boost: 0.4, go_wp: 0.5, fg_wp: 0.5001, punt_wp: 0.49 })
    expect(modelChoice(play)).toBe('go')
  })

  it('picks the better of the kick and the punt when going is not best', () => {
    expect(modelChoice(makePlay({ go_boost: -2, fg_wp: 0.55, punt_wp: 0.5 }))).toBe('fg')
    expect(modelChoice(makePlay({ go_boost: -2, fg_wp: 0.45, punt_wp: 0.5 }))).toBe('punt')
  })

  it('falls back to the only available kick or punt', () => {
    expect(modelChoice(makePlay({ go_boost: -2, fg_wp: null, punt_wp: 0.5 }))).toBe('punt')
    expect(modelChoice(makePlay({ go_boost: -2, fg_wp: 0.5, punt_wp: null }))).toBe('fg')
  })
})

describe('wpForfeited', () => {
  it('is zero when the staff took the best option', () => {
    const play = makePlay({ play_type: 'punt', go_wp: 0.45, punt_wp: 0.51, go_boost: -6 })
    expect(wpForfeited(play)).toBeCloseTo(0, 10)
    expect(agreed(play)).toBe(true)
  })

  it('is the gap to the best option in percentage points', () => {
    const play = makePlay({ play_type: 'punt', go_wp: 0.55, punt_wp: 0.51, go_boost: 4 })
    expect(wpForfeited(play)).toBeCloseTo(4, 6)
    expect(agreed(play)).toBe(false)
  })

  it('is null for a play with no decision', () => {
    expect(wpForfeited(makePlay({ play_type: 'no_play' }))).toBeNull()
    expect(agreed(makePlay({ play_type: 'no_play' }))).toBeNull()
  })

  it('is null when the staff did something the model could not price', () => {
    expect(wpForfeited(makePlay({ play_type: 'field_goal', fg_wp: null }))).toBeNull()
  })
})

describe('band', () => {
  it('splits at 1 and 3 points', () => {
    expect(band(0.99)).toBe('coin flip')
    expect(band(1)).toBe('lean')
    expect(band(3)).toBe('lean')
    expect(band(3.01)).toBe('clear')
  })

  it('reads magnitude, so a strong punt call is just as clear', () => {
    expect(band(-6)).toBe('clear')
    expect(band(-0.2)).toBe('coin flip')
  })
})

describe('wpOf', () => {
  it('returns null for an unavailable option', () => {
    expect(wpOf(makePlay(), 'fg')).toBeNull()
    expect(wpOf(makePlay(), 'punt')).toBeCloseTo(0.5102, 6)
  })
})
