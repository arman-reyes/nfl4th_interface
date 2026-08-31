/** Axis geometry, kept out of the drawing code. */

/** Four or five round gridlines across the domain. */
export function axisTicks(lo: number, hi: number): number[] {
  const span = hi - lo
  const raw = span / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
    ticks.push(Number(v.toFixed(6)))
  }
  return ticks
}

export interface EndLabel {
  x: number
  y: number
}

interface Placed {
  key: string
  /** Value at the series' last real point. */
  value: number | null
  x: number
}

/**
 * Where to print each line's label: at its last real point, nudged apart
 * vertically so two lines finishing together do not print on top of each other.
 */
export function endLabels(
  entries: Placed[],
  y: (v: number) => number,
  minGap = 10,
): Map<string, EndLabel> {
  const placed = entries
    .filter((e): e is Placed & { value: number } => e.value !== null)
    .map((e) => ({ key: e.key, x: e.x, y: y(e.value) }))
    .sort((a, b) => a.y - b.y)

  for (let i = 1; i < placed.length; i += 1) {
    if (placed[i].y - placed[i - 1].y < minGap) placed[i].y = placed[i - 1].y + minGap
  }
  return new Map(placed.map((p) => [p.key, { x: p.x, y: p.y }]))
}

/**
 * An SVG path through a series, lifting the pen over gaps rather than drawing
 * a straight line across a season a team has no data for.
 */
export function linePath(
  values: (number | null)[],
  x: (i: number) => number,
  y: (v: number) => number,
): string {
  let d = ''
  let pen = false
  values.forEach((value, i) => {
    if (value === null) {
      pen = false
      return
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(value).toFixed(1)} `
    pen = true
  })
  return d.trim()
}

/** A closed band: along the upper bound, back along the lower. */
export function bandPath(
  upper: number[],
  lower: number[],
  x: (i: number) => number,
  y: (v: number) => number,
): string {
  if (upper.length === 0) return ''
  const forward = upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  const back = [...lower]
    .map((v, i) => ({ v, i }))
    .reverse()
    .map(({ v, i }) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  return [...forward, ...back, 'Z'].join(' ')
}
