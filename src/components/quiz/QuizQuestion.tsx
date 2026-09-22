import { useEffect, useState } from 'react'
import type { Situation } from '../../types'
import { SECONDS_PER_QUESTION } from '../../lib/quiz'
import type { DecisionRules } from '../../lib/rules'

interface Props<P extends Situation, C extends string> {
  rules: DecisionRules<P, C>
  play: P
  number: number
  total: number
  /** The situation as the model sees it, drawn by the page that owns it. */
  situation: React.ReactNode
  onAnswer: (choice: C | null) => void
}

/**
 * One decision, put to the reader with a clock running.
 *
 * The situation shows exactly what the model is given and nothing else. No
 * team names beyond who has the ball, and no hint of what happened next.
 */
export function QuizQuestion<P extends Situation, C extends string>({
  rules,
  play,
  number,
  total,
  situation,
  onAnswer,
}: Props<P, C>) {
  const [remaining, setRemaining] = useState(SECONDS_PER_QUESTION * 1000)

  // The parent keys this component per question, so it remounts with a fresh
  // clock rather than needing a reset here.
  useEffect(() => {
    const started = Date.now()
    const tick = setInterval(() => {
      const left = SECONDS_PER_QUESTION * 1000 - (Date.now() - started)
      if (left <= 0) {
        clearInterval(tick)
        setRemaining(0)
        onAnswer(null)
      } else {
        setRemaining(left)
      }
    }, 100)
    return () => clearInterval(tick)
    // A new question restarts the clock; onAnswer is stable for the round.
  }, [play, onAnswer])

  const seconds = Math.ceil(remaining / 1000)
  const fraction = remaining / (SECONDS_PER_QUESTION * 1000)
  const urgent = seconds <= 5

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between gap-4 text-xs font-semibold tracking-wide text-stone-500 uppercase">
          <span>
            {number} of {total}
          </span>
          <span className={`tnum text-base ${urgent ? 'text-amber-700' : 'text-stone-500'}`}>
            {seconds}s
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200">
          <div
            className={`h-full rounded-full transition-none ${urgent ? 'bg-amber-600' : 'bg-stone-900'}`}
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
      </div>

      {situation}

      <div
        className={`grid gap-2 ${rules.choices.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}
      >
        {rules.choices.map((choice) => {
          // nfl4th prices no punt from inside the opponent's 30, and no kick
          // from beyond range. An option it cannot price cannot be scored, so
          // it is offered as unavailable rather than as a trap.
          const available = rules.wp(play, choice) !== null
          return (
            <button
              key={choice}
              onClick={() => onAnswer(choice)}
              disabled={!available}
              className={`rounded-lg border-2 py-5 text-2xl font-extrabold tracking-tight transition-colors focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 focus-visible:outline-none sm:text-3xl ${
                available
                  ? 'border-stone-300 bg-white text-stone-900 hover:border-stone-900 hover:bg-stone-900 hover:text-white'
                  : 'cursor-not-allowed border-dashed border-stone-200 bg-transparent text-stone-300'
              }`}
            >
              {rules.copy[choice].verb}
              {!available && (
                <span className="mt-0.5 block text-[0.625rem] font-semibold tracking-wide uppercase">
                  not available
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
