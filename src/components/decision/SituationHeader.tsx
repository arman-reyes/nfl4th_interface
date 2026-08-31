import type { Play, TeamMeta } from '../../types'
import { clock, fieldSpot, quarterLabel, scoreLine, situationLine } from '../../lib/format'
import { gameResult, weekLongLabel } from '../../lib/filters'
import { accentOnLight } from '../../lib/color'
import { FieldSpotLabel, TeamPill } from '../TeamPill'

interface Props {
  play: Play
  team?: TeamMeta
}

/** The situation, stated the way it would be said out loud. */
export function SituationHeader({ play, team }: Props) {
  const accent = team ? accentOnLight(team.team_abbr) : '#1c1917'
  // Stated plainly rather than as a badge: the card is reviewing a decision,
  // and the decision is judged on win probability, not on how the game ended.
  const result = gameResult(play)
  return (
    <header className="border-b border-stone-200 pb-4">
      <h2
        className="flex flex-wrap items-center gap-2 text-2xl leading-tight font-bold tracking-tight text-stone-900 sm:text-3xl"
        aria-label={situationLine(play)}
      >
        <span aria-hidden>
          4th &amp; {play.ydstogo} at
        </span>
        <span aria-hidden>
          <FieldSpotLabel {...fieldSpot(play)} size="md" />
        </span>
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
        {/* The headline states field position the way a broadcast does, which
            needs you to know whose half it is. This is the same thing as the
            model sees it: distance to the end zone. */}
        <Fact label="Field position">{play.yardline_100} yds to goal</Fact>
        <Divider />
        <Fact label="Timeouts">
          TO {play.posteam_timeouts_remaining}–{play.defteam_timeouts_remaining}
        </Fact>
        <Divider />
        <Fact label="Game">
          <span className="inline-flex items-center gap-1.5">
            {play.season} {weekLongLabel(play.season, play.week)} {play.posteam_home ? 'vs' : 'at'}{' '}
            <TeamPill abbr={play.defteam} />
            {result && (
              <span className="tnum font-normal text-stone-500">
                {result.outcome} {result.for}–{result.against}
              </span>
            )}
          </span>
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
