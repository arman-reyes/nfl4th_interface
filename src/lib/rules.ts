import type { Situation } from '../types'

/**
 * What a kind of decision needs to say about itself for the rest of the app
 * to review it.
 *
 * A 4th down and a try are the same shape of question — the staff picked one
 * option, the model priced every option, and the gap between them is the cost
 * — with different options. Everything downstream of the pricing (team
 * summaries, game roll-ups, the impact tiers, the matrix, the quiz scoring)
 * only needs these five things, so it is written once against this interface
 * and each decision supplies its own. The 4th-down rules live in
 * `decision.ts`, the try rules in `twopt.ts`.
 */
export interface DecisionRules<P extends Situation, C extends string> {
  /** Every choice, in the order the interface lists them. */
  choices: readonly C[]
  /**
   * The choice whose take-rate is the aggressiveness metric: of the decisions
   * where the model wanted this, the share the staff actually did it.
   */
  aggressive: C
  /** What the staff did, or null when the play carries no decision. */
  actual(play: P): C | null
  /** What the model wanted. */
  model(play: P): C
  /** Expected win probability of a choice, or null if it was unavailable. */
  wp(play: P, choice: C): number | null
  /**
   * The headline number: the edge for the aggressive choice over the best
   * alternative, in percentage points. Its magnitude sets the strength band.
   */
  boost(play: P): number
  /** How each choice is written wherever the interface names it. */
  copy: Record<C, ChoiceCopy>
}

export interface ChoiceCopy {
  /** Shouted, on a panel or a button: "GO", "KICK". */
  verb: string
  /** In a table: "Go for it", "Extra point". */
  label: string
  /** Column header for what the staff did: "Went", "Kicked". */
  did: string
  /** Past tense, on the "on the field" panel: "WENT FOR IT". */
  past: string
  /** Reads naturally after "over ...": "going for it", "the kick". */
  phrase: string
}

/** Win probability forfeited by a choice against the model's, in points. */
export function forfeitedBy<P extends Situation, C extends string>(
  rules: DecisionRules<P, C>,
  play: P,
  choice: C,
): number | null {
  const chosen = rules.wp(play, choice)
  if (chosen == null) return null
  // Measured against the model's recommendation rather than a raw argmax, so
  // that agreeing with the model always costs exactly zero.
  const best = rules.wp(play, rules.model(play))
  if (best == null) return null
  return Math.max(0, (best - chosen) * 100)
}
