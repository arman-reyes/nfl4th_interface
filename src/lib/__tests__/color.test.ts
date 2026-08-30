import { describe, expect, it } from 'vitest'
import { accentOnLight, contrast, onColor } from '../color'
import type { TeamMeta } from '../../types'

function team(color: string, color2: string): TeamMeta {
  return {
    team_abbr: 'XX',
    team_name: 'Test',
    team_conf: 'AFC',
    team_division: 'AFC East',
    team_color: color,
    team_color2: color2,
  }
}

describe('contrast', () => {
  it('spans 1 to 21', () => {
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 6)
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 6)
  })
})

describe('onColor', () => {
  it('puts white on a dark fill and ink on a light one', () => {
    expect(contrast(onColor('#000000'), '#000000')).toBeGreaterThan(4.5)
    expect(contrast(onColor('#FFB612'), '#FFB612')).toBeGreaterThan(4.5)
  })
})

describe('accentOnLight', () => {
  it('keeps a primary that already reads on white', () => {
    expect(accentOnLight(team('#003594', '#869397'))).toBe('#003594')
  })

  it('falls back to the secondary when the primary is too light', () => {
    // Pittsburgh: yellow primary, near-black secondary.
    expect(accentOnLight(team('#FFB612', '#101820'))).toBe('#101820')
  })

  it('darkens when neither colour reads on white', () => {
    // New Orleans: gold and a light grey would both fail.
    const accent = accentOnLight(team('#D3BC8D', '#D9D9D9'))
    expect(contrast(accent, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('always returns something readable for all shapes of input', () => {
    for (const primary of ['#000000', '#ffffff', '#FFB612', '#97233F', '#69BE28']) {
      expect(contrast(accentOnLight(team(primary, primary)), '#ffffff')).toBeGreaterThanOrEqual(4.5)
    }
  })
})
