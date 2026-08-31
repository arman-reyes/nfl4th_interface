import type { LeagueMetric, SeasonSpread, TeamSeries } from '../../lib/league'
import { recordLabel } from '../../lib/league'
import { TeamPill } from '../TeamPill'

interface Props {
  spread: SeasonSpread
  teams: TeamSeries[]
  index: number
  metric: LeagueMetric
  left: number
  width: number
}

/**
 * The hovered season: the league median and its middle half, then each
 * selected team's value with that team's record for the year.
 */
export function PanelReadout({ spread, teams, index, metric, left, width }: Props) {
  const rows = teams
    .map((team) => ({ abbr: team.abbr, point: team.points[index] }))
    .filter((row) => row.point?.value !== null && row.point?.value !== undefined)
    .sort((a, b) => (b.point.value ?? 0) - (a.point.value ?? 0))

  const flip = left > width - 150
  const style = flip ? { right: width - left + 10 } : { left: left + 10 }

  return (
    <div
      style={style}
      // w-max so the box sizes to its content: an absolutely positioned box
      // otherwise shrinks to the space left in its container and clips the text.
      className="pointer-events-none absolute top-0 z-10 w-max rounded-md border border-stone-200 bg-white/97 px-2.5 py-2 shadow-lg"
    >
      <p className="tnum text-[0.6875rem] font-bold text-stone-900">{spread.season}</p>
      <p className="tnum mt-0.5 text-[0.6875rem] whitespace-nowrap text-stone-500">
        median <span className="font-semibold text-stone-900">{metric.format(spread.p50)}</span>{' '}
        <span className="text-stone-400">
          ({metric.format(spread.p25)}–{metric.format(spread.p75)})
        </span>
      </p>
      {rows.length > 0 && (
        <ul className="mt-1.5 space-y-1 border-t border-stone-100 pt-1.5">
          {rows.map(({ abbr, point }) => (
            <li key={abbr} className="flex items-center gap-1.5 whitespace-nowrap">
              <TeamPill abbr={abbr} />
              <span className="tnum text-[0.625rem] text-stone-500">
                {point.summary ? recordLabel(point.summary) : '—'}
              </span>
              <span className="tnum ml-auto pl-2 text-xs font-semibold text-stone-900">
                {point.value === null ? '—' : metric.format(point.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
