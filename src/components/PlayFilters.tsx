import type { Play, TeamMeta } from '../types'
import type { PlayFilter } from '../lib/filters'
import { ALL, quarterLabelShort, quartersOf, seasonsOf, weekLabel, weeksOf } from '../lib/filters'
import { onColor } from '../lib/color'

interface Props {
  plays: Play[]
  team: TeamMeta
  filter: PlayFilter
  onChange: (filter: PlayFilter) => void
}

/**
 * Season, then week, then quarter. Each row offers only what the row above
 * contains, and the rows scroll sideways on a phone rather than wrapping into
 * a wall of chips.
 */
export function PlayFilters({ plays, team, filter, onChange }: Props) {
  const seasons = seasonsOf(plays)
  const weeks = weeksOf(plays, filter.season)
  const quarters = quartersOf(plays, filter.season, filter.week)

  return (
    <div className="space-y-2.5">
      <Row label="Season">
        {seasons.map((season) => (
          <Chip
            key={season}
            team={team}
            selected={season === filter.season}
            onClick={() => onChange({ season, week: ALL, qtr: ALL })}
          >
            {String(season)}
          </Chip>
        ))}
      </Row>

      <Row label="Week">
        <Chip
          team={team}
          selected={filter.week === ALL}
          onClick={() => onChange({ ...filter, week: ALL, qtr: ALL })}
        >
          All
        </Chip>
        {weeks.map((week) => (
          <Chip
            key={week}
            team={team}
            selected={filter.week === week}
            onClick={() => onChange({ ...filter, week, qtr: ALL })}
          >
            {weekLabel(week)}
          </Chip>
        ))}
      </Row>

      <Row label="Quarter">
        <Chip
          team={team}
          selected={filter.qtr === ALL}
          onClick={() => onChange({ ...filter, qtr: ALL })}
        >
          All
        </Chip>
        {quarters.map((qtr) => (
          <Chip
            key={qtr}
            team={team}
            selected={filter.qtr === qtr}
            onClick={() => onChange({ ...filter, qtr })}
          >
            {quarterLabelShort(qtr)}
          </Chip>
        ))}
      </Row>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-[0.625rem] font-bold tracking-[0.14em] text-stone-400 uppercase sm:w-16 sm:text-xs">
        {label}
      </span>
      <div className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  )
}

interface ChipProps {
  team: TeamMeta
  selected: boolean
  onClick: () => void
  children: string
}

function Chip({ team, selected, onClick, children }: ChipProps) {
  const style = selected
    ? { background: team.team_color, color: onColor(team.team_color), borderColor: team.team_color }
    : undefined
  return (
    <button
      onClick={onClick}
      style={style}
      aria-pressed={selected}
      className={`tnum shrink-0 rounded border px-2.5 py-1 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none ${
        selected ? '' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
      }`}
    >
      {children}
    </button>
  )
}
