import { useCallback, useMemo, useState } from 'react'
import type { Choice, LeagueIndex } from '../types'
import { useQuizPool } from '../hooks/useTeamData'
import type { Answer } from '../lib/quiz'
import {
  pickQuestions,
  QUESTIONS_PER_ROUND,
  SECONDS_PER_QUESTION,
  seededRandom,
} from '../lib/quiz'
import { QuizQuestion } from './quiz/QuizQuestion'
import { QuizReveal } from './quiz/QuizReveal'
import { QuizResults } from './quiz/QuizResults'
import { AboutButton } from './AboutButton'

interface Props {
  index: LeagueIndex
  onBack: () => void
  onAbout: () => void
}

/**
 * Ten real 4th downs, put to the reader with a clock running.
 *
 * Every situation is one a staff actually faced, and it is scored exactly the
 * way that staff is scored elsewhere in this tool — so the numbers at the end
 * can be read straight against a coaching staff's.
 */
export function QuizPage({ index, onBack, onAbout }: Props) {
  const pool = useQuizPool()
  const [round, setRound] = useState(0)
  // Fresh questions on every visit, stable within a round.
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31))
  const [answers, setAnswers] = useState<Answer[]>([])
  const [pending, setPending] = useState<Choice | null | undefined>(undefined)

  // Bumping `round` reseeds, which draws ten fresh questions.
  const questions = useMemo(
    () => (pool.data ? pickQuestions(pool.data, seededRandom(seed + round)) : []),
    [pool.data, seed, round],
  )

  const current = questions[answers.length] ?? null
  const done = questions.length > 0 && answers.length === questions.length && pending === undefined

  const answer = useCallback((choice: Choice | null) => {
    setPending(choice)
  }, [])

  function next() {
    if (pending === undefined || !current) return
    setAnswers((prev) => [...prev, { play: current, choice: pending }])
    setPending(undefined)
  }

  function again() {
    setAnswers([])
    setPending(undefined)
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
            {QUESTIONS_PER_ROUND} real 4th downs, {SECONDS_PER_QUESTION} seconds each. Go, kick or
            punt.
          </p>
        </div>
        <AboutButton onClick={onAbout} tone="muted" />
      </header>

      {pool.loading && <p className="py-16 text-center text-sm text-stone-500">Loading…</p>}
      {pool.error && (
        <p className="py-16 text-center text-sm text-red-700">{pool.error.message}</p>
      )}

      {done ? (
        <QuizResults answers={answers} index={index} onAgain={again} onBack={onBack} />
      ) : current ? (
        pending === undefined ? (
          <QuizQuestion
            key={`${round}-${answers.length}`}
            play={current}
            number={answers.length + 1}
            total={questions.length}
            onAnswer={answer}
          />
        ) : (
          <QuizReveal
            play={current}
            choice={pending}
            number={answers.length + 1}
            total={questions.length}
            onNext={next}
          />
        )
      ) : null}
    </main>
  )
}
