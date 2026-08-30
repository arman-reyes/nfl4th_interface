import { describe, expect, it } from 'vitest'
import { accentOnLight, colorDistance, contrast, onColor, paletteOf, teamSurface } from '../color'
import { TEAM_COLORS } from '../../data/teamColors'
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
    // Pittsburgh: yellow primary, black secondary.
    expect(accentOnLight('PIT')).toBe('#000000')
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

const ABBRS = Object.keys(TEAM_COLORS)

describe('the palette', () => {
  it('covers all 32 teams', () => {
    expect(ABBRS).toHaveLength(32)
  })

  it('uses the nflverse abbreviations rather than the source palette ones', () => {
    expect(TEAM_COLORS.JAX).toBeDefined()
    expect(TEAM_COLORS.LA).toBeDefined()
    expect(TEAM_COLORS.JAC).toBeUndefined()
    expect(TEAM_COLORS.LAR).toBeUndefined()
  })

  it('prefers the curated colours over whatever index.json carried', () => {
    // nflreadr gives Pittsburgh a near-black primary; the palette says yellow.
    expect(paletteOf(team('#101820', '#FFB612')).primary).toBe('#101820')
    expect(paletteOf('PIT').primary).toBe('#FFB612')
  })

  it('falls back to the index colours for an abbreviation it does not know', () => {
    const unknown: TeamMeta = { ...team('#123456', '#654321'), team_abbr: 'ZZZ' }
    expect(paletteOf(unknown)).toEqual({ primary: '#123456', secondary: '#654321' })
  })
})

describe('teamSurface', () => {
  it('is readable for every team, with no borderline pill anywhere', () => {
    for (const abbr of ABBRS) {
      const swatch = teamSurface(abbr)
      expect(contrast(swatch.color, swatch.background)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('nudges a background that neither white nor ink quite clears', () => {
    // Carolina blue lands at about 4.3:1 against ink before adjustment.
    const swatch = teamSurface('CAR')
    expect(contrast(swatch.color, swatch.background)).toBeGreaterThanOrEqual(4.5)
  })

  it('leaves a background alone when it is already comfortable', () => {
    expect(teamSurface('LV').background).toBe('#000000')
  })

  it('returns the secondary as the accent that tells navy teams apart', () => {
    expect(teamSurface('SEA').accent).toBe('#69BE28')
    expect(teamSurface('CHI').accent).toBe('#C83803')
    expect(teamSurface('DAL').accent).toBe('#869397')
  })

  it('gives every team an accent that is visibly a different colour', () => {
    for (const abbr of ABBRS) {
      const swatch = teamSurface(abbr)
      expect(colorDistance(swatch.accent, swatch.background)).toBeGreaterThan(120)
    }
  })
})
