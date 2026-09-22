import { useCallback, useMemo, useState } from 'react'
import type { LeagueIndex, Situation } from '../types'
import { useAsync } from '../hooks/useAsync'
import { playKey } from '../lib/filters'
import type { Answer } from '../lib/quiz'
import {
  pickQuestionsWith,
  QUESTIONS_PER_ROUND,
  SECONDS_PER_QUESTION,
  seededRandom,
} from '../lib/quiz'
import type { DecisionRules } from '../lib/rules'
import type { QuizCopy } from './quiz/copy'
import { QuizQuestion } from './quiz/QuizQuestion'
import { QuizReveal } from './quiz/QuizReveal'
import { QuizResults } from './quiz/QuizResults'
import { AboutButton } from './AboutButton'

interface Props<P extends Situation, C extends string> {
  index: LeagueIndex
  rules: DecisionRules<P, C>
  copy: QuizCopy
  /** The pool of real decisions, with their outcomes withheld. */
  loadPool: () => Promise<P[]>
  /** The situation as the model sees it; compact on the reveal. */
  situation: (play: P, compact: boolean) => React.ReactNode
  onBack: () => void
  onAbout: () => void
}

interface RoundState<P extends Situation, C extends string> {
  answers: Answer<P, C>[]
  /** The call awaiting its reveal; undefined while the question is open. */
  pending: C | null | undefined
}

/**
 * Real decisions, put to the reader with a clock running.
 *
 * Rounds accumulate into one sample: ten calls says very little about anyone,
 * and asking for ten more should build the record rather than restart it. Every
 * situation is one a staff actually faced, scored exactly the way that staff is
 * scored elsewhere, so the numbers at the end read straight against theirs.
 *
 * The 4th-down quiz and the two-point quiz are this one component with a
 * different pool, different rules and different words.
 */
export function QuizPage<P extends Situation, C extends string>({
  index,
  rules,
  copy,
  loadPool,
  situation,
  onBack,
  onAbout,
}: Props<P, C>) {
  const load = useCallback(() => loadPool(), [loadPool])
  const pool = useAsync<P[]>('pool', load)
  const [round, setRound] = useState(0)
  // Fresh questions on every visit, stable within a round.
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31))
  /** Every call from rounds already finished. */
  const [history, setHistory] = useState<Answer<P, C>[]>([])
  /**
   * The round's calls and the one awaiting its reveal, held together.
   *
   * One object rather than two pieces of state so that answering and advancing
   * are single atomic transitions. Two clicks landing in the same tick — a
   * double-click on Next, or a click racing the clock running out — would
   * otherwise both read the same stale value and record a call for a question
   * the reader never saw.
   */
  const [state, setState] = useState<RoundState<P, C>>({ answers: [], pending: undefined })
  const { answers, pending } = state

  const seen = useMemo(() => new Set(history.map((answer) => playKey(answer.play))), [history])

  // Bumping `round` reseeds, which draws a fresh set the reader has not seen.
  const questions = useMemo(
    () =>
      pool.data
        ? pickQuestionsWith(rules, pool.data, seededRandom(seed + round), QUESTIONS_PER_ROUND, seen)
        : [],
    [rules, pool.data, seed, round, seen],
  )

  const current = questions[answers.length] ?? null
  const done = questions.length > 0 && answers.length >= questions.length && pending === undefined

  const answer = useCallback((choice: C | null) => {
    setState((s) => (s.pending === undefined ? { ...s, pending: choice } : s))
  }, [])

  function next() {
    setState((s) => {
      if (s.pending === undefined) return s
      const play = questions[s.answers.length]
      if (!play) return { ...s, pending: undefined }
      return { answers: [...s.answers, { play, choice: s.pending }], pending: undefined }
    })
  }

  function again() {
    setHistory((prev) => [...prev, ...answers])
    setState({ answers: [], pending: undefined })
    setRound((r) => r + 1)
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-3 py-5 sm:px-6 sm:py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="text-sm font-semibold text-stone-500 hover:text-stone-900"
          >
            ← Teams
          </button>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            Make the call
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {QUESTIONS_PER_ROUND} real {copy.noun[1]}, {SECONDS_PER_QUESTION} seconds each.{' '}
            {copy.options}
            {history.length > 0 && ` Round ${round + 1} — ${history.length} calls behind you.`}
          </p>
        </div>
        <AboutButton onClick={onAbout} tone="muted" />
      </header>

      {pool.loading && <p className="py-16 text-center text-sm text-stone-500">Loading…</p>}
      {pool.error && <p className="py-16 text-center text-sm text-red-700">{pool.error.message}</p>}

      {done ? (
        <QuizResults
          rules={rules}
          copy={copy}
          all={[...history, ...answers]}
          round={answers}
          rounds={round + 1}
          index={index}
          onAgain={again}
          onBack={onBack}
        />
      ) : current ? (
        pending === undefined ? (
          <QuizQuestion
            key={`${round}-${answers.length}`}
            rules={rules}
            play={current}
            number={answers.length + 1}
            total={questions.length}
            situation={situation(current, false)}
            onAnswer={answer}
          />
        ) : (
          <QuizReveal
            rules={rules}
            copy={copy}
            play={current}
            choice={pending}
            number={answers.length + 1}
            total={questions.length}
            situation={situation(current, true)}
            onNext={next}
          />
        )
      ) : null}
    </main>
  )
}
