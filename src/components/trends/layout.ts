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
