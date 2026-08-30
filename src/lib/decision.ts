import type { Band, Choice, Play } from '../types'

/**
 * The decision rules. Every derived number in the app comes from this file,
 * so the definitions live here once and nowhere else.
 */

/** Options that exist for a situation, with their expected win probability. */
export interface Option {
  choice: Choice
  /** Expected win probability, 0-1. */
  wp: number
}

const PLAY_TYPE_TO_CHOICE: Record<string, Choice> = {
  run: 'go',
  pass: 'go',
  field_goal: 'fg',
  punt: 'punt',
}

/**
 * What the staff actually decided, read off `play_type`.
 * Returns null for anything else (penalties, aborted snaps, no-plays), which
 * excludes the play from every agreement statistic.
 */
export function actualChoice(play: Play): Choice | null {
  if (!play.play_type) return null
  return PLAY_TYPE_TO_CHOICE[play.play_type] ?? null
}

/** The options available in this situation, best first. */
export function options(play: Play): Option[] {
  const all: Option[] = [{ choice: 'go', wp: play.go_wp }]
  if (play.fg_wp != null) all.push({ choice: 'fg', wp: play.fg_wp })
  if (play.punt_wp != null) all.push({ choice: 'punt', wp: play.punt_wp })
  return all.sort((a, b) => b.wp - a.wp)
}

/**
 * The model's recommendation.
 *
 * Defined off the sign of `go_boost` rather than a raw argmax so the verdict
 * can never contradict the headline number the card displays: nfl4th defines
 * `go_boost = 100 * (go_wp - max(fg_wp, punt_wp))`, and JSON rounding can put
 * an argmax on the other side of a hairline gap.
 */
export function modelChoice(play: Play): Choice {
  if (play.go_boost > 0) return 'go'
  const fg = play.fg_wp
  const punt = play.punt_wp
  if (fg == null) return 'punt'
  if (punt == null) return 'fg'
  return fg >= punt ? 'fg' : 'punt'
}

/** Expected win probability of one choice, or null if it was unavailable. */
export function wpOf(play: Play, choice: Choice): number | null {
  if (choice === 'go') return play.go_wp
  if (choice === 'fg') return play.fg_wp
  return play.punt_wp
}

/**
 * Win probability forfeited by the actual decision, in percentage points.
 * Zero when the staff agreed with the model, null when the play carries no
 * classifiable decision.
 */
export function wpForfeited(play: Play): number | null {
  const actual = actualChoice(play)
  if (actual === null) return null
  const chosen = wpOf(play, actual)
  if (chosen == null) return null
  const best = options(play)[0].wp
  return Math.max(0, (best - chosen) * 100)
}

export function agreed(play: Play): boolean | null {
  const actual = actualChoice(play)
  if (actual === null) return null
  return actual === modelChoice(play)
}

/**
 * How strong the call is, from the magnitude of `go_boost`.
 * Under 1 point is a coin flip, 1-3 a lean, above 3 a clear call.
 * Magnitude, not sign: a 4-point edge for the punt is just as clear a call
 * as a 4-point edge for going.
 */
export function band(goBoost: number): Band {
  const m = Math.abs(goBoost)
  if (m < 1) return 'coin flip'
  if (m <= 3) return 'lean'
  return 'clear'
}

export const CHOICE_VERB: Record<Choice, string> = {
  go: 'GO',
  fg: 'KICK',
  punt: 'PUNT',
}

export const CHOICE_LABEL: Record<Choice, string> = {
  go: 'Go for it',
  fg: 'Field goal',
  punt: 'Punt',
}
