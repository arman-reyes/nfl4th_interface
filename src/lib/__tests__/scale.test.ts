import { describe, expect, it } from 'vitest'
import { axisFraction, optionWindow } from '../scale'

describe('optionWindow', () => {
  it('never zooms past a ten point span, so close calls stay visibly close', () => {
    const w = optionWindow([50, 50.4])
    expect(w.end - w.start).toBeCloseTo(15, 6)
    const gap = axisFraction(50.4, w) - axisFraction(50, w)
    expect(gap).toBeLessThan(0.05)
  })

  it('widens for a decisive gap so it fills the card', () => {
    const w = optionWindow([45, 65])
    expect(w.end - w.start).toBeCloseTo(30, 6)
    const gap = axisFraction(65, w) - axisFraction(45, w)
    expect(gap).toBeCloseTo(2 / 3, 6)
  })

  it('centres the options in the window', () => {
    const w = optionWindow([48, 52])
    expect((w.start + w.end) / 2).toBeCloseTo(50, 6)
  })

  it('stays inside 0-100 when the options sit near an edge', () => {
    const low = optionWindow([1, 3])
    expect(low.start).toBe(0)
    expect(low.end).toBeCloseTo(15, 6)

    const high = optionWindow([97, 99])
    expect(high.end).toBe(100)
    expect(high.start).toBeCloseTo(85, 6)
  })

  it('clamps fractions to the window', () => {
    const w = optionWindow([50, 52])
    expect(axisFraction(0, w)).toBe(0)
    expect(axisFraction(100, w)).toBe(1)
  })
})
