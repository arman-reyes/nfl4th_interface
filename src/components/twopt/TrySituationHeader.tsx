import type { TeamMeta, Try } from '../../types'
import { clock, quarterLabel } from '../../lib/format'
import { marginAfter, marginLabel, movedSpot, tryLine } from '../../lib/twopt'
import { gameResult, weekLongLabel } from '../../lib/filters'
import { accentOnLight } from '../../lib/color'
import { TeamPill } from '../TeamPill'

interface Props {
  play: Try
  team?: TeamMeta
}

/**
 * The situation, stated the way it would be said out loud.
 *
 * A try has no down, distance or field position worth stating — every one
 * is snapped from the same two spots — so the headline is the score, and the
 * first fact is what each option does to it. That is the whole decision: a
 * kick to go up seven, or a two to go up eight.
 */
export function TrySituationHeader({ play, team }: Props) {
  const accent = team ? accentOnLight(team.team_abbr) : '#1c1917'
  const result = gameResult(play)
  const spot = movedSpot(play)
  return (
    <header className="border-b border-stone-200 pb-4">
      <h2 className="text-2xl leading-tight font-bold tracking-tight text-stone-900 sm:text-3xl">
        {tryLine(play)}
      </h2>
      <dl className="tnum mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-stone-500">
        <Fact label="After the try">
          kick → {marginLabel(marginAfter(play, 1))}
          <span className="mx-1.5 text-stone-300">·</span>
          two → {marginLabel(marginAfter(play, 2))}
        </Fact>
        <Divider />
        <Fact label="Clock">
          <span style={{ color: accent }} className="font-semibold">
            {quarterLabel(play.qtr)}
          </span>{' '}
          {clock(play.quarter_seconds_remaining)}
        </Fact>
        <Divider />
        <Fact label="Timeouts">
          TO {play.posteam_timeouts_remaining}–{play.defteam_timeouts_remaining}
        </Fact>
        {spot !== null && (
          <>
            <Divider />
            <Fact label="Spot">snapped from the {spot}, after a penalty</Fact>
          </>
        )}
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
