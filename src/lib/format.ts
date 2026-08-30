import type { Play } from '../types'

/** Win probability 0-1 rendered as whole percentage points. */
export function pct(p: number, digits = 0): string {
  return `${(p * 100).toFixed(digits)}%`
}

/** A number already in percentage points, with an explicit sign. */
export function signedPoints(points: number, digits = 1): string {
  const s = points.toFixed(digits)
  return points > 0 ? `+${s}` : s
}

export function points(value: number, digits = 1): string {
  return value.toFixed(digits)
}

/** "3rd" for a quarter number; overtime periods read as OT. */
export function quarterLabel(qtr: number): string {
  if (qtr >= 5) return 'OT'
  return ['1st', '2nd', '3rd', '4th'][qtr - 1] ?? `Q${qtr}`
}

export function clock(secondsRemaining: number): string {
  const s = Math.max(0, Math.round(secondsRemaining))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Field position in the way a broadcast says it: the side of the field plus
 * the yard line. `yardline_100` counts down to the opponent's end zone.
 */
export function fieldPosition(play: Play): string {
  const y = play.yardline_100
  if (y === 50) return 'the 50'
  if (y < 50) return `${play.defteam} ${y}`
  return `${play.posteam} ${100 - y}`
}

/** "4th & 3 at the KC 38" */
export function situationLine(play: Play): string {
  return `4th & ${play.ydstogo} at ${fieldPosition(play)}`
}

export function scoreLine(diff: number): string {
  if (diff === 0) return 'Tied'
  if (diff > 0) return `Up ${diff}`
  return `Down ${-diff}`
}

export function gameLabel(play: Play): string {
  return `${play.season} Wk ${play.week} vs ${play.defteam}`
}
