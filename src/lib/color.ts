import type { TeamMeta } from '../types'

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

const INK = '#1c1917'
const PAPER = '#ffffff'

/** Text colour to place on a filled swatch of `hex`. */
export function onColor(hex: string): string {
  return contrast(hex, PAPER) >= contrast(hex, INK) ? PAPER : INK
}

function darken(hex: string, factor: number): string {
  const rgb = parseHex(hex).map((v) => Math.round(v * factor))
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * A team colour safe to use as text or a thin rule on a white background.
 * Prefers the primary, falls back to the secondary, and darkens as a last
 * resort — which is what rescues Pittsburgh's yellow and New Orleans' gold.
 */
export function accentOnLight(team: TeamMeta, minContrast = 4.5): string {
  const candidates = [team.team_color, team.team_color2]
  for (const candidate of candidates) {
    if (contrast(candidate, PAPER) >= minContrast) return candidate
  }
  let best = candidates[0]
  for (let step = 0; step < 12; step += 1) {
    best = darken(best, 0.82)
    if (contrast(best, PAPER) >= minContrast) break
  }
  return best
}

/** The pair to use for a solid team-coloured surface. */
export function teamSurface(team: TeamMeta): { background: string; color: string } {
  return { background: team.team_color, color: onColor(team.team_color) }
}
