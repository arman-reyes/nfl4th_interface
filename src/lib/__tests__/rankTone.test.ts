import { describe, expect, it } from 'vitest'
import { rankTone } from '../../components/garbage/rankTone'

describe('rankTone', () => {
  it('points down for a fall and up for a rise', () => {
    expect(rankTone(5).arrow).toBe('▼')
    expect(rankTone(-5).arrow).toBe('▲')
  })

  it('says nothing when the rank held', () => {
    const tone = rankTone(0)
    expect(tone.arrow).toBe('—')
    expect(tone.color).toBeUndefined()
    expect(tone.label).toMatch(/no change/)
  })

  it('is red falling and green rising, never the other way round', () => {
    for (const delta of [1, 5, 12, 40]) {
      // red channel dominant on a fall, green on a rise
      const fall = rankTone(delta).color!
      const rise = rankTone(-delta).color!
      const red = (hex: string) => parseInt(hex.slice(1, 3), 16)
      const green = (hex: string) => parseInt(hex.slice(3, 5), 16)
      expect(red(fall)).toBeGreaterThan(green(fall))
      expect(green(rise)).toBeGreaterThan(red(rise))
    }
  })

  it('darkens as the move gets bigger, and mirrors across the sign', () => {
    const luminance = (hex: string) =>
      [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0)
    for (const sign of [1, -1]) {
      const steps = [1, 6, 20].map((m) => luminance(rankTone(m * sign).color!))
      expect(steps[0]).toBeGreaterThan(steps[1])
      expect(steps[1]).toBeGreaterThan(steps[2])
    }
    // the two arms step at the same magnitudes
    expect(new Set([1, 6, 20].map((m) => rankTone(m).color)).size).toBe(3)
    expect(new Set([1, 6, 20].map((m) => rankTone(-m).color)).size).toBe(3)
  })

  it('steps at the measured cutoffs, not somewhere near them', () => {
    expect(rankTone(4).color).toBe(rankTone(1).color)
    expect(rankTone(5).color).not.toBe(rankTone(4).color)
    expect(rankTone(11).color).toBe(rankTone(5).color)
    expect(rankTone(12).color).not.toBe(rankTone(11).color)
    expect(rankTone(45).color).toBe(rankTone(12).color)
  })

  it('never leaves direction to colour alone', () => {
    for (const delta of [-40, -1, 0, 1, 40]) {
      expect(rankTone(delta).arrow).toBeTruthy()
      expect(rankTone(delta).label).toBeTruthy()
    }
  })

  it('keeps every colour above the AA contrast floor on the row and its hover tint', () => {
    const lum = (hex: string) =>
      [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0)
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    for (const delta of [1, -1, 6, -6, 20, -20]) {
      const color = rankTone(delta).color!
      expect(ratio(color, '#ffffff')).toBeGreaterThanOrEqual(4.5)
      expect(ratio(color, '#fafaf9')).toBeGreaterThanOrEqual(4.5)
    }
  })
})
