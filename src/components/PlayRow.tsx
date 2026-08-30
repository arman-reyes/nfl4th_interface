import type { Choice, Play, TeamMeta } from '../types'
import { actualChoice, agreed, CHOICE_VERB, modelChoice, wpForfeited } from '../lib/decision'
import { clock, fieldSpot, points, situationLine } from '../lib/format'
import { quarterLabelShort } from '../lib/filters'
import { teamSurface } from '../lib/color'
import { FieldSpotLabel } from './TeamPill'

interface Props {
  play: Play
  team: TeamMeta
  selected: boolean
  onSelect: () => void
}

/** One 4th down in the list: when, what, what they did against what the model said. */
export function PlayRow({ play, team, selected, onSelect }: Props) {
  const surface = teamSurface(team.team_abbr)
  const actual = actualChoice(play)
  const model = modelChoice(play)

  return (
    <button
      onClick={onSelect}
      aria-current={selected}
      // Selection is a tint plus a bar in the team's colour rather than a solid
      // fill: the rows contain team pills, and a filled row would swallow the
      // pill of the team whose colour filled it.
      style={selected ? { boxShadow: `inset 4px 0 0 ${surface.background}` } : undefined}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none ${
        selected ? 'bg-stone-100' : 'hover:bg-stone-50'
      }`}
    >
      <span
        className={`tnum w-12 shrink-0 text-xs font-semibold ${
          selected ? 'text-stone-600' : 'text-stone-400'
        }`}
      >
        {quarterLabelShort(play.qtr)}
        <span className="block font-normal">{clock(play.quarter_seconds_remaining)}</span>
      </span>

      <span className="min-w-0 flex-1">
        <span
          className="flex items-center gap-1.5 text-sm font-semibold text-stone-900"
          aria-label={situationLine(play)}
        >
          <span aria-hidden>4th &amp; {play.ydstogo} at</span>
          <span aria-hidden>
            <FieldSpotLabel {...fieldSpot(play)} />
          </span>
        </span>
        <span
          className={`mt-0.5 block text-[0.6875rem] font-semibold tracking-wide uppercase ${
            selected ? 'text-stone-600' : 'text-stone-500'
          }`}
        >
          {actual === null ? 'no call' : CHOICE_VERB[actual]}
          <span aria-hidden className="text-stone-300">
            {' '}
            vs{' '}
          </span>
          {CHOICE_VERB[model]}
        </span>
      </span>

      <Cost match={agreed(play)} cost={wpForfeited(play)} actual={actual} />
    </button>
  )
}

interface CostProps {
  match: boolean | null
  cost: number | null
  actual: Choice | null
}

function Cost({ match, cost, actual }: CostProps) {
  if (actual === null) {
    return <span className="w-14 shrink-0 text-right text-xs text-stone-300">—</span>
  }
  if (match) {
    return (
      <span
        className="w-14 shrink-0 text-right text-xs font-semibold text-stone-400"
        title="Agreed with the model"
      >
        ✓
      </span>
    )
  }
  return (
    <span
      className="tnum w-14 shrink-0 text-right text-sm font-bold text-amber-700"
      title="Win probability forfeited"
    >
      −{points(cost ?? 0)}
    </span>
  )
}
