/**
 * The shared axis the three option bars sit on.
 *
 * A 0-100% axis would flatten every card: the options on a real 4th down
 * usually sit within a few percentage points of each other, and the whole
 * point of the bars is that the gap between them is the argument.
 *
 * So the window is zoomed, but never below MIN_SPAN points wide. That floor is
 * what keeps the zoom honest: a half-point gap can only ever render as a
 * sliver, while a ten-point gap fills the card. Gaps stay comparable from one
 * card to the next until they outgrow the floor, and the axis prints its own
 * endpoints so the truncation is stated rather than hidden.
 */
const MIN_SPAN = 10
/** The bars occupy the middle two thirds of the window. */
const WINDOW_RATIO = 1.5

export interface AxisWindow {
  /** Win probability in percentage points at the left edge. */
  start: number
  /** Win probability in percentage points at the right edge. */
  end: number
}

export function optionWindow(values: number[]): AxisWindow {
  if (values.length === 0) return { start: 0, end: 100 }
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const width = Math.max(hi - lo, MIN_SPAN) * WINDOW_RATIO
  const mid = (lo + hi) / 2

  let start = mid - width / 2
  let end = mid + width / 2
  if (start < 0) {
    end = Math.min(100, end - start)
    start = 0
  }
  if (end > 100) {
    start = Math.max(0, start - (end - 100))
    end = 100
  }
  return { start, end }
}

/** Where a value falls in the window, as a 0-1 fraction of its width. */
export function axisFraction(value: number, window: AxisWindow): number {
  const width = window.end - window.start
  if (width <= 0) return 0
  return Math.min(1, Math.max(0, (value - window.start) / width))
}
