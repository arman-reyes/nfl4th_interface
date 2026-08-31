import type { Play, TeamMeta } from '../types'
import type { PlayFilter } from '../lib/filters'
import { ALL, quarterLabelShort, quartersOf, weekLabel, weeksOf } from '../lib/filters'
import { teamSurface } from '../lib/color'

interface Props {
  plays: Play[]
  team: TeamMeta
  filter: PlayFilter
  onChange: (filter: PlayFilter) => void
}

/**
 * Week, then quarter, within the season the banner is holding. Each row offers
 * only what the level above it contains, so no combination lands on an empty
 * list.
 */
export function PlayFilters({ plays, team, filter, onChange }: Props) {
  const weeks = weeksOf(plays, filter.season)
  const quarters = quartersOf(plays, filter.season, filter.week)

  return (
    <div className="space-y-2.5">
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
            {weekLabel(filter.season, week)}
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

/**
 * Chips wrap to fit whatever width they are given rather than scrolling
 * sideways. An 18-week season does not fit a 22rem pane on one line, and a
 * strip that scrolls hides half the season behind an affordance the reader has
 * to discover. Wrapping costs a little height and hides nothing.
 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-14 shrink-0 pt-1.5 text-[0.625rem] font-bold tracking-[0.14em] text-stone-400 uppercase sm:w-16 sm:text-xs">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{children}</div>
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
  const surface = teamSurface(team.team_abbr)
  const style = selected
    ? {
        background: surface.background,
        color: surface.color,
        borderColor: surface.background,
        boxShadow: `inset 0 -3px 0 ${surface.accent}`,
      }
    : undefined
  return (
    <button
      onClick={onClick}
      style={style}
      aria-pressed={selected}
      className={`tnum flex min-w-9 shrink-0 justify-center rounded border px-2 py-1 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none ${
        selected ? '' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
      }`}
    >
      {children}
    </button>
  )
}
