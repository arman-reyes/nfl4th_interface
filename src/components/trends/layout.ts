import type { TrendSeries } from '../../lib/trends'

/** Geometry for the trend chart, kept out of the drawing code. */

/** Four or five round gridlines across the domain. */
export function axisTicks(lo: number, hi: number): number[] {
  const span = hi - lo
  const raw = span / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Number(v.toFixed(6)))
  return ticks
}

interface EndLabel {
  x: number
  y: number
}

/**
 * Where to print each line's abbreviation: at its last real point, nudged
 * apart vertically so two lines finishing together do not print on top of one
 * another.
 */
export function endLabels(
  series: TrendSeries[],
  x: (i: number) => number,
  y: (v: number) => number,
  seasonCount: number,
): Map<string, EndLabel> {
  const placed = series
    .map((s) => {
      for (let i = seasonCount - 1; i >= 0; i -= 1) {
        const value = s.points[i]?.value
        if (value !== null && value !== undefined) {
          return { abbr: s.abbr, x: x(i), y: y(value) }
        }
      }
      return null
    })
    .filter((v): v is { abbr: string; x: number; y: number } => v !== null)
    .sort((a, b) => a.y - b.y)

  const MIN_GAP = 11
  for (let i = 1; i < placed.length; i += 1) {
    const gap = placed[i].y - placed[i - 1].y
    if (gap < MIN_GAP) placed[i].y = placed[i - 1].y + MIN_GAP
  }

  return new Map(placed.map((p) => [p.abbr, { x: p.x, y: p.y }]))
}
