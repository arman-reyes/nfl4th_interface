import type { Situation } from '../../types'
import { band } from '../../lib/decision'
import { pct, pointsGap } from '../../lib/format'
import { judgeWith } from '../../lib/quiz'
import type { DecisionRules } from '../../lib/rules'
import { axisFraction, optionWindow } from '../../lib/scale'
import type { QuizCopy } from './copy'

interface Props<P extends Situation, C extends string> {
  rules: DecisionRules<P, C>
  copy: QuizCopy
  play: P
  choice: C | null
  number: number
  total: number
  /** The situation again, compact, so the call can be read against it. */
  situation: React.ReactNode
  onNext: () => void
}

/**
 * What the model wanted, set against the call just made.
 *
 * It shows the options and the gap between them, and stops there. What the
 * play actually gained is never shown — the quiz is scored on the decision,
 * and revealing the outcome would teach the opposite lesson.
 */
export function QuizReveal<P extends Situation, C extends string>({
  rules,
  copy,
  play,
  choice,
  number,
  total,
  situation,
  onNext,
}: Props<P, C>) {
  const verdict = judgeWith(rules, { play, choice })
  const values = rules.choices.map((option) => ({ option, wp: rules.wp(play, option) }))
  const window = optionWindow(values.filter((v) => v.wp !== null).map((v) => v.wp! * 100))

  return (
    <div className="space-y-4">
      {/* The situation stays up so the call can be read against it, and so the
          next button never lands where the answer buttons just were. */}
      {situation}

      <div
        className={`rounded-lg px-5 py-4 ${
          verdict === null
            ? 'bg-stone-200 text-stone-700'
            : verdict.matched
              ? 'bg-stone-900 text-white'
              : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200 ring-inset'
        }`}
      >
        <p className="text-lg font-bold tracking-tight sm:text-xl">
          {verdict === null
            ? 'Out of time — no call'
            : verdict.matched
              ? `Agreed — the model said ${rules.copy[verdict.model].verb}`
              : `The model said ${rules.copy[verdict.model].verb}`}
        </p>
        <p className="tnum mt-1 text-sm opacity-90">
          {verdict === null ? (
            <>This one is left out of your numbers, the way a penalty would be.</>
          ) : verdict.matched ? (
            <>
              A {band(rules.boost(play))} call, {pointsGap(Math.abs(rules.boost(play)))} points{' '}
              {copy.edge}.
            </>
          ) : (
            <>
              You said {rules.copy[choice as C].verb}. That gave up{' '}
              <span className="font-bold">{pointsGap(verdict.cost)}</span> points of win
              probability.
            </>
          )}
        </p>
      </div>

      <ul className="space-y-2 rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
        {values.map(({ option, wp }) => {
          const isModel = verdict !== null && option === verdict.model
          const isYours = option === choice
          return (
            <li key={option} className="flex items-center gap-3">
              <span
                className={`w-24 shrink-0 text-sm font-semibold tracking-wide uppercase ${
                  isModel ? 'text-stone-900' : 'text-stone-400'
                }`}
              >
                {rules.copy[option].label}
              </span>
              <span className="relative h-7 flex-1 overflow-hidden rounded-sm bg-stone-100">
                {wp === null ? (
                  <span className="absolute inset-0 flex items-center pl-2 text-[0.6875rem] tracking-wide text-stone-400 uppercase">
                    not available
                  </span>
                ) : (
                  <span
                    className={`block h-full rounded-sm ${isModel ? 'bg-stone-900' : 'bg-stone-300'}`}
                    style={{ width: `${axisFraction(wp * 100, window) * 100}%` }}
                  />
                )}
              </span>
              <span
                className={`tnum w-14 shrink-0 text-right text-base font-semibold ${
                  isModel ? 'text-stone-900' : 'text-stone-500'
                }`}
              >
                {wp === null ? '—' : pct(wp, 1)}
              </span>
              <span className="w-16 shrink-0 text-[0.625rem] font-bold tracking-wide uppercase">
                {isYours && <span className="text-amber-700">Your call</span>}
              </span>
            </li>
          )
        })}
      </ul>

      <button
        onClick={onNext}
        className="w-full rounded-lg bg-stone-900 py-3.5 text-base font-bold tracking-wide text-white uppercase hover:bg-stone-700 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {number === total ? 'See your results' : `Next ${copy.noun[0]}`}
      </button>
    </div>
  )
}
