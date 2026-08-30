import type { Play, TeamMeta } from '../../types'
import { clock, quarterLabel, scoreLine, situationLine } from '../../lib/format'
import { weekLongLabel } from '../../lib/filters'
import { accentOnLight } from '../../lib/color'

interface Props {
  play: Play
  team?: TeamMeta
}

/** The situation, stated the way it would be said out loud. */
export function SituationHeader({ play, team }: Props) {
  const accent = team ? accentOnLight(team) : '#1c1917'
  return (
    <header className="border-b border-stone-200 pb-4">
      <h2 className="text-2xl leading-tight font-bold tracking-tight text-stone-900 sm:text-3xl">
        {situationLine(play)}
      </h2>
      <dl className="tnum mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-stone-500">
        <Fact label="Clock">
          <span style={{ color: accent }} className="font-semibold">
            {quarterLabel(play.qtr)}
          </span>{' '}
          {clock(play.quarter_seconds_remaining)}
        </Fact>
        <Divider />
        <Fact label="Score">{scoreLine(play.score_differential)}</Fact>
        <Divider />
        <Fact label="Timeouts">
          TO {play.posteam_timeouts_remaining}–{play.defteam_timeouts_remaining}
        </Fact>
        <Divider />
        <Fact label="Game">
          {play.season} {weekLongLabel(play.week)} vs {play.defteam}
        </Fact>
      </dl>
    </header>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd className="font-medium text-stone-700">{children}</dd>
    </div>
  )
}

function Divider() {
  return (
    <span aria-hidden className="hidden text-stone-300 sm:inline">
      ·
    </span>
  )
}
