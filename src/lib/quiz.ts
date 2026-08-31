import type { Choice, QuizPlay } from '../types'
import { modelChoice, wpOf } from './decision'
import { playKey } from './filters'

/**
 * A round of the quiz: ten real 4th downs, the reader's call on each, and how
 * that scores against the model.
 *
 * The scoring deliberately mirrors the team profile — aggressiveness,
 * agreement, win probability given up — so a reader's own numbers can be read
 * against a coaching staff's without translation.
 */

export const QUESTIONS_PER_ROUND = 10
/** Seconds on the clock for each call. */
export const SECONDS_PER_QUESTION = 20

/**
 * How many of the ten the model would go for.
 *
 * Fixed rather than left to chance for two reasons: aggressiveness needs a
 * denominator, and 4 in 10 is close to the league's real rate of about 41%, so
 * the round still feels like a season.
 */
const GO_QUESTIONS = 4

/**
 * A small seeded generator, so a round is stable across re-renders while a new
 * seed draws a fresh ten. Mulberry32.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Ten questions drawn from the pool, mixed so the model wants to go on four of
 * them.
 *
 * `seen` holds the plays already asked this session. Rounds accumulate into one
 * sample, so a repeated situation would be counted twice — and noticed. If the
 * unseen pool cannot fill a round, it falls back to the whole pool rather than
 * dealing short.
 */
export function pickQuestions(
  pool: QuizPlay[],
  random: () => number = Math.random,
  count = QUESTIONS_PER_ROUND,
  seen: ReadonlySet<string> = new Set(),
): QuizPlay[] {
  const unseen = pool.filter((p) => !seen.has(playKey(p)))
  const source = unseen.length >= count ? unseen : pool

  const goes = shuffle(
    source.filter((p) => modelChoice(p) === 'go'),
    random,
  )
  const others = shuffle(
    source.filter((p) => modelChoice(p) !== 'go'),
    random,
  )

  const wantGo = Math.min(GO_QUESTIONS, goes.length)
  const picked = [...goes.slice(0, wantGo), ...others.slice(0, count - wantGo)]
  // If one side ran short, top up from the other so a round is still full.
  if (picked.length < count) {
    const rest = [...goes.slice(wantGo), ...others.slice(count - wantGo)]
    picked.push(...rest.slice(0, count - picked.length))
  }
  return shuffle(picked, random)
}

export interface Answer {
  play: QuizPlay
  /** Null when the clock ran out before a call was made. */
  choice: Choice | null
}

export interface Verdict {
  model: Choice
  matched: boolean
  /** Win probability points given up, in percentage points. Zero when matched. */
  cost: number
}

/** Scores one call against the model. Null when no call was made. */
export function judge(answer: Answer): Verdict | null {
  if (answer.choice === null) return null
  const model = modelChoice(answer.play)
  const chosen = wpOf(answer.play, answer.choice)
  const best = wpOf(answer.play, model)
  if (chosen === null || best === null) return null
  return {
    model,
    matched: answer.choice === model,
    cost: Math.max(0, (best - chosen) * 100),
  }
}

export interface QuizScore {
  /** Calls actually made and scoreable. */
  decisions: number
  /** Questions where the clock ran out before a call was made. */
  timedOut: number
  matched: number
  agreement: number | null
  goRecommended: number
  goTaken: number
  aggressiveness: number | null
  /** Total win probability given up, in percentage points. */
  forfeited: number
  /** The same figure per call made, comparable to a team's per-game number. */
  forfeitedPerDecision: number
}

export function scoreRound(answers: Answer[]): QuizScore {
  let decisions = 0
  let timedOut = 0
  let matched = 0
  let goRecommended = 0
  let goTaken = 0
  let forfeited = 0

  for (const answer of answers) {
    // Only a missing call is a timeout. A call the model cannot price is
    // unreachable from the interface, which offers those options as
    // unavailable, but it must not be miscounted as one if it ever occurs.
    if (answer.choice === null) {
      timedOut += 1
      continue
    }
    const verdict = judge(answer)
    if (verdict === null) continue
    decisions += 1
    if (verdict.matched) matched += 1
    forfeited += verdict.cost
    if (verdict.model === 'go') {
      goRecommended += 1
      if (answer.choice === 'go') goTaken += 1
    }
  }

  return {
    decisions,
    timedOut,
    matched,
    agreement: decisions > 0 ? matched / decisions : null,
    goRecommended,
    goTaken,
    aggressiveness: goRecommended > 0 ? goTaken / goRecommended : null,
    forfeited,
    forfeitedPerDecision: decisions > 0 ? forfeited / decisions : 0,
  }
}
