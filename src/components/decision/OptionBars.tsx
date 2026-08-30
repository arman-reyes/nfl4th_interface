import type { Choice, Play } from '../../types'
import { CHOICE_LABEL, wpOf } from '../../lib/decision'
import { axisFraction, optionWindow } from '../../lib/scale'
import { pct } from '../../lib/format'

const ORDER: Choice[] = ['go', 'fg', 'punt']

interface Props {
  play: Play
  recommended: Choice
  /** Marked as what the staff actually did, when the card came from a real play. */
  actual?: Choice | null
}

/**
 * The three options on one shared, zoomed axis. The recommended bar is solid
 * black and the others are grey, so the argument is the length difference and
 * nothing else. Options the situation does not allow are stated as such rather
 * than drawn as zero.
 */
export function OptionBars({ play, recommended, actual }: Props) {
  const values = ORDER.map((choice) => ({ choice, wp: wpOf(play, choice) }))
  const available = values.filter((v) => v.wp !== null).map((v) => v.wp! * 100)
  const window = optionWindow(available)

  return (
    <div>
      <ul className="space-y-3">
        {values.map(({ choice, wp }) => {
          const isBest = choice === recommended
          return (
            <li key={choice} className="flex items-center gap-4">
              <span
                className={`w-32 shrink-0 text-base font-semibold tracking-wide uppercase ${
                  isBest ? 'text-stone-900' : 'text-stone-400'
                }`}
              >
                {CHOICE_LABEL[choice]}
              </span>

              <div className="relative h-9 flex-1 overflow-hidden rounded-sm bg-stone-100">
                {wp === null ? (
                  <span className="absolute inset-0 flex items-center pl-3 text-xs tracking-wide text-stone-400 uppercase">
                    not available here
                  </span>
                ) : (
                  <div
                    className={`h-full rounded-sm ${isBest ? 'bg-stone-900' : 'bg-stone-300'}`}
                    style={{ width: `${axisFraction(wp * 100, window) * 100}%` }}
                  />
                )}
              </div>

              <span
                className={`tnum w-16 shrink-0 text-right text-lg font-semibold ${
                  isBest ? 'text-stone-900' : 'text-stone-400'
                }`}
              >
                {wp === null ? '—' : pct(wp, 1)}
              </span>

              <span className="flex w-36 shrink-0 flex-wrap gap-1">
                {isBest && <Tag>model</Tag>}
                {actual === choice && <Tag>called</Tag>}
              </span>
            </li>
          )
        })}
      </ul>

      {/* Mirrors the bar row's columns exactly so the axis lands under the track. */}
      <div className="mt-2 flex items-center gap-4" aria-hidden>
        <span className="w-32 shrink-0" />
        <span className="tnum flex flex-1 justify-between text-xs text-stone-400">
          <span>{window.start.toFixed(0)}%</span>
          <span className="tracking-wide uppercase">win probability</span>
          <span>{window.end.toFixed(0)}%</span>
        </span>
        <span className="w-16 shrink-0" />
        <span className="w-36 shrink-0" />
      </div>
    </div>
  )
}

function Tag({ children }: { children: string }) {
  return (
    <span className="rounded-xs bg-stone-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-stone-500 uppercase">
      {children}
    </span>
  )
}
