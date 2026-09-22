import type { Play, Situation } from '../types'
import { FOURTH_DOWN } from './decision'
import { forfeitedBy } from './rules'
import type { DecisionRules } from './rules'

/**
 * How much a disagreement actually mattered.
 *
 * Win probability is already a linear currency, so the points forfeited by a
 * decision need no leverage multiplier — and applying one would double-count.
 * Across 2020-2025 the numbers bear that out: of 6,749 disagreements, the
 * 1,519 taken in games already decided carry a mean cost of 0.29 points and
 * never exceed 4.2, while none of the 125 disagreements costing more than five
 * points happened in a decided game.
 *
 * What the cost alone does not say is *why* it is small. A 0.3-point
 * disagreement in a tie game is a close call the staff nearly got right; the
 * same 0.3 with a 97% win probability is garbage time, and it should not read
 * as a considered decision at all. So impact is reported on two axes that both
 * trace to the data: the cost, and the state of the game it was taken in.
 *
 * None of this is specific to a 4th down. A try is judged the same way, on
 * the same scale, through the same functions with its own rules passed in.
 */

export const IMPACT_TIERS = ['minor', 'notable', 'costly'] as const
export type Impact = (typeof IMPACT_TIERS)[number]

/**
 * Cost tiers, on the same 1-and-3 point scale as the model's strength band,
 * so a "notable" cost and a "lean" recommendation mean the same size of edge.
 */
export function impactOf(costPoints: number): Impact {
  if (costPoints < 1) return 'minor'
  if (costPoints <= 3) return 'notable'
  return 'costly'
}

export const GAME_STATES = ['in doubt', 'leaning', 'lopsided', 'decided'] as const
export type GameState = (typeof GAME_STATES)[number]

/**
 * How live the game was, from the win probability the model's own
 * recommendation carried — the team's standing going into the decision if
 * they play it right. Bands are 65/35, 85/15 and 95/5.
 */
export function gameStateOf(bestWp: number | null): GameState {
  if (bestWp === null) return 'in doubt'
  const edge = Math.abs(bestWp - 0.5)
  if (edge >= 0.45) return 'decided'
  if (edge >= 0.35) return 'lopsided'
  if (edge >= 0.15) return 'leaning'
  return 'in doubt'
}

export function gameState(play: Play): GameState {
  return gameStateOf(FOURTH_DOWN.wp(play, FOURTH_DOWN.model(play)))
}

export interface DecisionImpact {
  /** Win probability forfeited, in percentage points. */
  cost: number
  tier: Impact
  state: GameState
  /**
   * True when the game was already decided. The decision still disagreed with
   * the model, but at a 95%+ win probability it could not change much, and it
   * says little about how the staff decides when a game is live.
   */
  inert: boolean
}

/** Null when the play carried no decision, or when the staff agreed. */
export function judgeDecision<P extends Situation, C extends string>(
  rules: DecisionRules<P, C>,
  play: P,
): DecisionImpact | null {
  const actual = rules.actual(play)
  const model = rules.model(play)
  if (actual === null || actual === model) return null
  const cost = forfeitedBy(rules, play, actual)
  if (cost === null) return null
  const state = gameStateOf(rules.wp(play, model))
  return { cost, tier: impactOf(cost), state, inert: state === 'decided' }
}

export function decisionImpact(play: Play): DecisionImpact | null {
  return judgeDecision(FOURTH_DOWN, play)
}

export const IMPACT_FILL: Record<Impact, number> = { minor: 1, notable: 2, costly: 3 }

export const GAME_STATE_NOTE: Record<GameState, string> = {
  'in doubt': 'game in doubt',
  leaning: 'game leaning',
  lopsided: 'game lopsided',
  decided: 'game already decided',
}
