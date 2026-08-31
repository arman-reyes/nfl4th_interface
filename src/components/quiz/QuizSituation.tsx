import type { QuizPlay } from '../../types'
import { clock, fieldSpot, quarterLabel, scoreLine } from '../../lib/format'
import { FieldSpotLabel } from '../TeamPill'

/**
 * The 4th down as the model sees it: down, distance, field position, clock,
 * score and timeouts, and nothing else. No hint of what happened next.
 *
 * Shown on the question and again on the reveal, so the call can be read back
 * against the situation that produced it rather than from memory.
 */
export function QuizSituation({ play, compact }: { play: QuizPlay; compact?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-stone-200 bg-white text-center shadow-xs ${
        compact ? 'p-4' : 'p-5 sm:p-8'
      }`}
    >
      <p
        className={`flex flex-wrap items-center justify-center gap-2 font-bold tracking-tight text-stone-900 ${
          compact ? 'text-xl sm:text-2xl' : 'text-3xl sm:text-4xl'
        }`}
      >
        <span>4th &amp; {play.ydstogo} at</span>
        <FieldSpotLabel {...fieldSpot(play)} size="md" />
      </p>
      <dl
        className={`tnum flex flex-wrap items-baseline justify-center gap-x-5 gap-y-1 text-stone-600 ${
          compact ? 'mt-2 text-xs' : 'mt-4 text-sm'
        }`}
      >
        <Fact label="Clock">
          {quarterLabel(play.qtr)} {clock(play.quarter_seconds_remaining)}
        </Fact>
        <Fact label="Score">{scoreLine(play.score_differential)}</Fact>
        <Fact label="Field position">{play.yardline_100} yds to goal</Fact>
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
