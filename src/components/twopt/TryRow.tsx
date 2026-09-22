import type { TeamMeta, Try, TryChoice } from '../../types'
import { tryLine, TWO_POINT } from '../../lib/twopt'
import { judgeDecision } from '../../lib/impact'
import { clock } from '../../lib/format'
import { quarterLabelShort } from '../../lib/filters'
import { teamSurface } from '../../lib/color'
import { ImpactMeter } from '../ImpactMeter'

interface Props {
  play: Try
  team: TeamMeta
  selected: boolean
  onSelect: () => void
}

/** One try in the list: when, the score it was taken at, what they did against what the model said. */
export function TryRow({ play, team, selected, onSelect }: Props) {
  const surface = teamSurface(team.team_abbr)
  const actual = TWO_POINT.actual(play)
  const model = TWO_POINT.model(play)

  return (
    <button
      onClick={onSelect}
      aria-current={selected}
      // Selection is a tint plus a bar in the team's colour rather than a solid
      // fill, the same as a 4th-down row, so the two lists read alike.
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
        <span className="block text-sm font-semibold text-stone-900">{tryLine(play)}</span>
        <span
          className={`mt-0.5 block text-[0.6875rem] font-semibold tracking-wide uppercase ${
            selected ? 'text-stone-600' : 'text-stone-500'
          }`}
        >
          {actual === null ? 'no call' : TWO_POINT.copy[actual].verb}
          <span aria-hidden className="text-stone-300">
            {' '}
            vs{' '}
          </span>
          {TWO_POINT.copy[model].verb}
        </span>
      </span>

      <Outcome impact={judgeDecision(TWO_POINT, play)} actual={actual} />
    </button>
  )
}

interface OutcomeProps {
  impact: ReturnType<typeof judgeDecision>
  actual: TryChoice | null
}

/** The right edge of a row: agreement, or how much the disagreement cost. */
function Outcome({ impact, actual }: OutcomeProps) {
  if (actual === null) {
    return (
      <span className="w-16 shrink-0 text-right text-xs text-stone-300" title="No decision">
        —
      </span>
    )
  }
  if (impact === null) {
    return (
      <span
        className="w-16 shrink-0 text-right text-xs font-semibold text-stone-400"
        title="Agreed with the model"
      >
        ✓
      </span>
    )
  }
  return (
    <span className="flex w-16 shrink-0 justify-end">
      <ImpactMeter impact={impact} />
    </span>
  )
}
