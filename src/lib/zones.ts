import type { Band, Play } from '../types'
import { band } from './decision'

/**
 * The two axes of the deviation profile: where on the field the decision was
 * made, and how strong the model's call was.
 */

export const FIELD_ZONES = ['Own half', 'Midfield', 'Opp 40-21', 'Red zone'] as const
export type FieldZone = (typeof FIELD_ZONES)[number]

/** `yardline_100`: 1 is the opponent's goal line, 99 is your own 1. */
export function fieldZone(play: Play): FieldZone {
  const y = play.yardline_100
  if (y <= 20) return 'Red zone'
  if (y <= 40) return 'Opp 40-21'
  if (y <= 50) return 'Midfield'
  return 'Own half'
}

export const BANDS: readonly Band[] = ['coin flip', 'lean', 'clear']

export function playBand(play: Play): Band {
  return band(play.go_boost)
}
