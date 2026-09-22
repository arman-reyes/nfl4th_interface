import type { QuizTry } from '../../types'
import { clock, quarterLabel } from '../../lib/format'
import { marginAfter, marginLabel, tryLine } from '../../lib/twopt'

/**
 * The try as the model sees it: the score after the touchdown, the clock and
 * the timeouts, and nothing else. No hint of what happened next.
 *
 * What each option does to the score is stated under the headline, because
 * "up 6" is not the decision — "seven or eight" is.
 */
export function TryQuizSituation({ play, compact }: { play: QuizTry; compact?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-stone-200 bg-white text-center shadow-xs ${
        compact ? 'p-4' : 'p-5 sm:p-8'
      }`}
    >
      <p
        className={`font-bold tracking-tight text-stone-900 ${
          compact ? 'text-xl sm:text-2xl' : 'text-3xl sm:text-4xl'
        }`}
      >
        {tryLine(play)}
      </p>
      <p className={`tnum text-stone-600 ${compact ? 'mt-1 text-xs' : 'mt-2 text-sm'}`}>
        kick → {marginLabel(marginAfter(play, 1))}
        <span className="mx-1.5 text-stone-300">·</span>
        two → {marginLabel(marginAfter(play, 2))}
      </p>
      <dl
        className={`tnum flex flex-wrap items-baseline justify-center gap-x-5 gap-y-1 text-stone-600 ${
          compact ? 'mt-2 text-xs' : 'mt-4 text-sm'
        }`}
      >
        <Fact label="Clock">
          {quarterLabel(play.qtr)} {clock(play.quarter_seconds_remaining)}
        </Fact>
        <Fact label="Timeouts">
          TO {play.posteam_timeouts_remaining}–{play.defteam_timeouts_remaining}
        </Fact>
      </dl>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}
