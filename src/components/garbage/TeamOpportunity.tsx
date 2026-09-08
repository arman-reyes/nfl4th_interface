import { useState } from 'react'
import { BANDS } from '../../lib/garbageTime'
import type { Band } from '../../lib/garbageTime'
import { accentOnLight } from '../../lib/color'
import { TeamPill } from '../TeamPill'
import { BAND_STYLE } from './bandStyle'
import type { TeamAbbr } from '../../types'

interface Props {
  shares: Map<TeamAbbr, Record<Band, number>>
  season: number
}

/** Completes "How much ___ each offense played". */
const PHRASE: Record<Band, string> = {
  trailing: 'garbage time while trailing',
  leading: 'garbage time while leading',
  competitive: 'competitive football',
}

/**
 * How much of each offense's season happened in one state of the game.
 *
 * The fairness check behind every share on the player page: a receiver on a team
 * that spent a fifth of its season four scores down had far more garbage time
 * available to him than one who never trailed.
 *
 * One column so the bars share a left edge and a reader can run an eye down
 * them; two would put half the league on a different baseline.
 *
 * Bars carry the team's own colour rather than the selected band's. Colour here
 * follows the entity, which is the team — the band is already named in the
 * heading and shown in the select, so spending the bar's colour on it would say
 * a thing the reader has been told twice while giving up the one cue that makes
 * a particular team findable in a list of thirty-two.
 */
export function TeamOpportunity({ shares, season }: Props) {
  // Local state: nothing outside this chart depends on which band it is showing,
  // and hoisting it would put a control in the page that only one child reads.
  const [band, setBand] = useState<Band>('trailing')

  const sorted = [...shares.entries()].sort((a, b) => b[1][band] - a[1][band])
  // Scaled to the leader rather than to 100%, because the interesting comparison
  // is between offenses and no band ever fills the axis.
  const max = sorted[0]?.[1][band] ?? 1

  return (
    <section className="rounded-lg border border-stone-200 bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-stone-200 px-4 py-3">
        <h2 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">
          How much {PHRASE[band]} each offense played &middot; {season}
        </h2>
        <label className="flex items-center gap-2 text-[0.625rem] font-bold tracking-[0.14em] text-stone-500 uppercase">
          Game state
          <select
            value={band}
            onChange={(event) => setBand(event.target.value as Band)}
            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-semibold tracking-normal text-stone-900 normal-case focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
          >
            {BANDS.map((option) => (
              <option key={option} value={option}>
                {BAND_STYLE[option].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1 px-4 py-3">
        {sorted.map(([team, bands]) => (
          <div key={team} className="flex items-center gap-2 text-[0.6875rem]">
            <TeamPill abbr={team} />
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${max > 0 ? (bands[band] / max) * 100 : 0}%`,
                  background: accentOnLight(team),
                }}
              />
            </span>
            <span className="tnum w-10 text-right text-stone-600">
              {(bands[band] * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
