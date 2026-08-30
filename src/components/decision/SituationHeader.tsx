import type { Play, TeamMeta } from '../../types'
import { clock, quarterLabel, scoreLine, situationLine } from '../../lib/format'

interface Props {
  play: Play
  team?: TeamMeta
}

/**
 * The situation, stated the way it would be said out loud. Team identity is a
 * colour rule and an abbreviation, nothing more.
 */
export function SituationHeader({ play, team }: Props) {
  const accent = team?.team_color ?? '#1c1917'
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-stone-200 pb-4">
      <div className="flex items-baseline gap-3">
        <span
          aria-hidden
          className="inline-block h-6 w-1.5 translate-y-0.5 rounded-sm"
          style={{ background: accent }}
        />
        <span className="text-lg font-bold tracking-tight text-stone-900">{play.posteam}</span>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          {situationLine(play)}
        </h2>
      </div>
      <dl className="tnum flex items-baseline gap-5 text-sm text-stone-500">
        <div className="flex items-baseline gap-1.5">
          <dt className="sr-only">Clock</dt>
          <dd className="font-medium text-stone-700">
            {quarterLabel(play.qtr)} · {clock(play.quarter_seconds_remaining)}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="sr-only">Score</dt>
          <dd className="font-medium text-stone-700">{scoreLine(play.score_differential)}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt>Timeouts</dt>
          <dd className="font-medium text-stone-700">
            {play.posteam_timeouts_remaining}–{play.defteam_timeouts_remaining}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="sr-only">Game</dt>
          <dd>
            {play.season} · Wk {play.week} · vs {play.defteam}
          </dd>
        </div>
      </dl>
    </header>
  )
}
