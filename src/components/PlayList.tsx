import type { Choice, Play, TeamMeta } from '../types'
import { actualChoice, agreed, CHOICE_VERB, modelChoice, wpForfeited } from '../lib/decision'
import { clock, points, situationLine } from '../lib/format'
import { playKey, quarterLabelShort, weekLabel } from '../lib/filters'
import { onColor } from '../lib/color'

interface Props {
  plays: Play[]
  team: TeamMeta
  selectedKey: string | null
  onSelect: (play: Play) => void
}

/** Every 4th down in the current filter. One tap opens the comparison. */
export function PlayList({ plays, team, selectedKey, onSelect }: Props) {
  if (plays.length === 0) {
    return <p className="px-1 py-6 text-sm text-stone-500">No 4th downs match this filter.</p>
  }

  return (
    <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white">
      {plays.map((play) => {
        const key = playKey(play)
        const selected = key === selectedKey
        const actual = actualChoice(play)
        const model = modelChoice(play)
        const match = agreed(play)
        const cost = wpForfeited(play)

        return (
          <li key={key}>
            <button
              onClick={() => onSelect(play)}
              aria-current={selected}
              style={
                selected
                  ? { background: team.team_color, color: onColor(team.team_color) }
                  : undefined
              }
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none ${
                selected ? '' : 'hover:bg-stone-50'
              }`}
            >
              <span
                className={`tnum w-16 shrink-0 text-xs font-semibold sm:w-20 ${
                  selected ? 'opacity-80' : 'text-stone-400'
                }`}
              >
                {isNaN(Number(weekLabel(play.week))) ? '' : 'Wk '}
                {weekLabel(play.week)} · {quarterLabelShort(play.qtr)}
                <span className="block font-normal">{clock(play.quarter_seconds_remaining)}</span>
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-sm font-semibold ${selected ? '' : 'text-stone-900'}`}
                >
                  {situationLine(play)}
                </span>
                <span
                  className={`mt-0.5 flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-wide uppercase ${
                    selected ? 'opacity-80' : 'text-stone-500'
                  }`}
                >
                  <Verb>{actual === null ? 'no call' : CHOICE_VERB[actual]}</Verb>
                  <span aria-hidden className={selected ? 'opacity-60' : 'text-stone-300'}>
                    vs
                  </span>
                  <Verb>{CHOICE_VERB[model]}</Verb>
                </span>
              </span>

              <Cost selected={selected} match={match} cost={cost} actual={actual} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Verb({ children }: { children: string }) {
  return <span>{children}</span>
}

interface CostProps {
  selected: boolean
  match: boolean | null
  cost: number | null
  actual: Choice | null
}

function Cost({ selected, match, cost, actual }: CostProps) {
  if (actual === null) {
    return <span className="w-14 shrink-0 text-right text-xs text-stone-300">—</span>
  }
  if (match) {
    return (
      <span
        className={`w-14 shrink-0 text-right text-xs font-semibold ${
          selected ? 'opacity-80' : 'text-stone-400'
        }`}
      >
        ✓
      </span>
    )
  }
  return (
    <span
      className={`tnum w-14 shrink-0 text-right text-sm font-bold ${
        selected ? '' : 'text-amber-700'
      }`}
    >
      −{points(cost ?? 0)}
    </span>
  )
}
