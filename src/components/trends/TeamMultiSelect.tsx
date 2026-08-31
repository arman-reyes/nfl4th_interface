import type { TeamIndexEntry } from '../../types'
import { teamSurface } from '../../lib/color'

interface Props {
  teams: TeamIndexEntry[]
  selected: string[]
  onToggle: (abbr: string) => void
  onClear: () => void
}

/** Which teams are drawn in colour. Everything else stays as faint context. */
export function TeamMultiSelect({ teams, selected, onToggle, onClear }: Props) {
  const chosen = new Set(selected)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">Teams</h3>
        <button
          onClick={onClear}
          disabled={selected.length === 0}
          className="text-xs font-semibold text-stone-500 hover:text-stone-900 disabled:opacity-40 disabled:hover:text-stone-500"
        >
          Clear
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {teams.map((team) => {
          const on = chosen.has(team.team_abbr)
          const surface = teamSurface(team.team_abbr)
          return (
            <button
              key={team.team_abbr}
              onClick={() => onToggle(team.team_abbr)}
              aria-pressed={on}
              title={team.team_name}
              style={
                on
                  ? {
                      background: surface.background,
                      color: surface.color,
                      borderColor: surface.background,
                      boxShadow: `inset 0 -3px 0 ${surface.accent}`,
                    }
                  : undefined
              }
              className={`min-w-11 rounded border px-2 py-1 text-xs font-bold tracking-wide ${
                on ? '' : 'border-stone-200 bg-white text-stone-500 hover:border-stone-400'
              }`}
            >
              {team.team_abbr}
            </button>
          )
        })}
      </div>
    </div>
  )
}
