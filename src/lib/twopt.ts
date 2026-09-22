import type { TryChoice, TryFacts } from '../types'
import { forfeitedBy } from './rules'
import type { DecisionRules } from './rules'

/**
 * The try decision rules: kick the extra point, or go for two.
 *
 * The same shape as the 4th-down rules in `decision.ts`, with two options
 * instead of three and neither ever unavailable. Everything the two-point
 * page derives comes through here, so the definitions live here once.
 */

const PLAY_TYPE_TO_CHOICE: Record<string, TryChoice> = {
  extra_point: 'kick',
  run: 'two',
  pass: 'two',
}

/**
 * What the staff actually did, read off `play_type`. A try is either a kick
 * or a snap from the two, so unlike a 4th down there is no third thing it can
 * be; null only if the extract ever passes through a play type it should not.
 */
export function tryChoice(play: TryFacts): TryChoice | null {
  if (!play.play_type) return null
  return PLAY_TYPE_TO_CHOICE[play.play_type] ?? null
}

/**
 * The model's recommendation, from the sign of `go_boost` — the same rule as
 * the 4th down, and for the same reason: the verdict can never contradict the
 * headline number when rounding puts an argmax on the other side of a hairline
 * gap. Exactly zero goes to the kick, the default a staff would take.
 */
export function tryModelChoice(play: TryFacts): TryChoice {
  return play.go_boost > 0 ? 'two' : 'kick'
}

/** Expected win probability of one choice. Both always exist. */
export function tryWpOf(play: TryFacts, choice: TryChoice): number {
  return choice === 'two' ? play.wp_go2 : play.wp_go1
}

/** Win probability forfeited by the actual decision, in percentage points. */
export function tryWpForfeited(play: TryFacts): number | null {
  const actual = tryChoice(play)
  if (actual === null) return null
  return forfeitedBy(TWO_POINT, play, actual)
}

/**
 * The score once the try is over, from the offense's side, for each thing it
 * can score. `score_differential` is stated after the touchdown, so this is
 * just an addition — but it is the number a coach is actually deciding on.
 */
export function marginAfter(play: TryFacts, points: 0 | 1 | 2): number {
  return play.score_differential + points
}

/** "up 7", "tied", "down 1" — a margin, lower case, for mid-sentence. */
export function marginLabel(margin: number): string {
  if (margin === 0) return 'tied'
  return margin > 0 ? `up ${margin}` : `down ${-margin}`
}

/**
 * The situation as it would be said out loud: the score after the touchdown,
 * which is the one the decision is made on. "Up 6 after the TD".
 */
export function tryLine(play: TryFacts): string {
  const margin = play.score_differential
  const lead = margin === 0 ? 'Tied' : margin > 0 ? `Up ${margin}` : `Down ${-margin}`
  return `${lead} after the TD`
}

/** The standard spot for each choice; anything else is a penalty. */
export const STANDARD_SPOT: Record<TryChoice, number> = { kick: 15, two: 2 }

/**
 * Where the try was snapped from, only when a penalty moved it. Null at the
 * standard spot, so the ordinary try says nothing about the spot at all.
 */
export function movedSpot(play: TryFacts): number | null {
  const actual = tryChoice(play)
  if (actual === null) return null
  return play.yardline_100 === STANDARD_SPOT[actual] ? null : play.yardline_100
}

export const TRY_CHOICES: readonly TryChoice[] = ['kick', 'two']

export const TWO_POINT: DecisionRules<TryFacts, TryChoice> = {
  choices: TRY_CHOICES,
  aggressive: 'two',
  actual: tryChoice,
  model: tryModelChoice,
  wp: tryWpOf,
  boost: (play) => play.go_boost,
  copy: {
    kick: { verb: 'KICK', label: 'Extra point', did: 'Kicked', past: 'KICKED', phrase: 'the kick' },
    two: {
      verb: 'GO FOR 2',
      label: 'Two-point try',
      did: 'Went for 2',
      past: 'WENT FOR TWO',
      phrase: 'going for two',
    },
  },
}
