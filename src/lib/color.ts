import type { TeamAbbr, TeamMeta } from '../types'
import { TEAM_COLORS } from '../data/teamColors'
import type { TeamPalette } from '../data/teamColors'

/**
 * Team colour handling.
 *
 * Team identity has to be obvious without any colour ever deciding whether a
 * number can be read. Some primaries are near-black (LV, CHI) and some are
 * near-yellow (PIT); a palette that assumes either one breaks on the other.
 * So every use goes through a contrast check.
 */

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ]
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * Rough perceptual distance between two colours, on the "redmean" weighting.
 * Used for the accent stripe, where the question is whether a reader can see
 * a difference at all — Miami's teal and orange sit at almost the same
 * luminance while being unmistakably different colours, so a WCAG contrast
 * ratio is the wrong instrument for it.
 */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = parseHex(a)
  const [r2, g2, b2] = parseHex(b)
  const rMean = (r1 + r2) / 2
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db,
  )
}

const INK = '#1c1917'
const PAPER = '#ffffff'

/** Text colour to place on a filled swatch of `hex`. */
export function onColor(hex: string): string {
  return contrast(hex, PAPER) >= contrast(hex, INK) ? PAPER : INK
}

function toHex(rgb: number[]): string {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
}

/** Linear blend from `a` towards `b`; t of 0 is all a, 1 is all b. */
function mix(a: string, b: string, t: number): string {
  const from = parseHex(a)
  const to = parseHex(b)
  return toHex(from.map((v, i) => v + (to[i] - v) * t))
}

/**
 * The palette for a team. Prefers the curated table, falls back to whatever
 * the R pipeline put in index.json so an unknown abbreviation still renders.
 */
export function paletteOf(team: TeamMeta | TeamAbbr): TeamPalette {
  const abbr = typeof team === 'string' ? team : team.team_abbr
  const curated = TEAM_COLORS[abbr]
  if (curated) return curated
  if (typeof team === 'string') return { primary: '#57534e', secondary: '#a8a29e' }
  return { primary: team.team_color, secondary: team.team_color2 }
}

/**
 * A team colour safe to use as text or a thin rule on a white background.
 * Prefers the primary, falls back to the secondary, and darkens as a last
 * resort — which is what rescues Pittsburgh's yellow and New Orleans' gold.
 */
export function accentOnLight(team: TeamMeta | TeamAbbr, minContrast = 4.5): string {
  const { primary, secondary } = paletteOf(team)
  for (const candidate of [primary, secondary]) {
    if (contrast(candidate, PAPER) >= minContrast) return candidate
  }
  let best = primary
  for (let step = 0; step < 16; step += 1) {
    best = mix(best, INK, 0.18)
    if (contrast(best, PAPER) >= minContrast) break
  }
  return best
}

export interface Swatch {
  background: string
  /** Guaranteed to reach 4.5:1 against `background`. */
  color: string
  /** The secondary colour, for a rule or stripe that distinguishes the team. */
  accent: string
}

/**
 * A solid team-coloured surface with legible text.
 *
 * Ten of the 32 primaries are near-black, so a fill alone leaves Chicago,
 * Seattle, Dallas, Tennessee and the Giants looking like the same navy chip.
 * The secondary is returned alongside as a stripe, which is what tells them
 * apart. Where neither white nor ink quite reaches 4.5:1 on the primary — the
 * Panthers' blue is the awkward one — the background is nudged until it does,
 * so no pill in the app is ever borderline.
 */
export function teamSurface(team: TeamMeta | TeamAbbr): Swatch {
  const { primary, secondary } = paletteOf(team)
  let background = primary
  let color = onColor(background)
  for (let step = 0; step < 24 && contrast(color, background) < 4.5; step += 1) {
    background = mix(background, color === PAPER ? INK : PAPER, 0.06)
    color = onColor(background)
  }
  return { background, color, accent: secondary }
}
