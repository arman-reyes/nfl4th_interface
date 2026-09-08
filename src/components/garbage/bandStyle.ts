import type { Band } from '../../lib/garbageTime'

export interface BandStyle {
  /** Full name, for a legend, a column heading or a screen reader. */
  label: string
  color: string
  hint: string
}

/**
 * One palette for every place the three bands are drawn.
 *
 * The encoding is diverging, not categorical: these are positions on one
 * win-probability axis — the game out of reach, the game in doubt, the game
 * already won — so the middle is a neutral grey and the two poles are opposed
 * hues. Amber and blue clear every colour-vision check against this surface
 * (lightness band, CVD separation, normal-vision floor and contrast); the grey
 * midpoint is prescribed by the diverging form rather than being a compromise.
 *
 * Shared so the donut, the table breakdown and any legend cannot drift apart —
 * the same colour has to mean the same band everywhere or the page lies.
 */
export const BAND_STYLE: Record<Band, BandStyle> = {
  trailing: {
    label: 'Garbage time, trailing',
    color: '#b45309',
    hint: 'Two scores behind, game gone',
  },
  competitive: {
    label: 'Competitive',
    color: '#57534e',
    hint: 'The game still in doubt',
  },
  leading: {
    label: 'Garbage time, leading',
    color: '#1d4ed8',
    hint: 'Two scores up, game decided',
  },
}
