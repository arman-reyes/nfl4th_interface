import { fantasyPoints } from '../../lib/garbageTime'
import type { Band, Totals } from '../../lib/garbageTime'
import { BAND_STYLE } from './bandStyle'
import type { StatLineSpec } from './statLines'

/**
 * Column order, which is not the axis order the bar and the donut use.
 *
 * Those are pictures of a scale, so they run trailing → competitive → leading.
 * This is a table being read for an answer, and the answer is about garbage
 * time, so the two garbage bands come first and ordinary football is the
 * remainder at the end.
 */
const COLUMNS: Band[] = ['trailing', 'leading', 'competitive']

const HEADING: Record<Band, string> = {
  trailing: 'Trailing',
  leading: 'Leading',
  competitive: 'Competitive',
}

interface Props {
  all: Totals
  byBand: Record<Band, Totals>
  lines: StatLineSpec[]
  /** Points per reception, for the fantasy-points footer. */
  ppr: number
}

/**
 * Counting stats by game state: everything, then how much of it happened while
 * the game was gone, already won, or still in doubt.
 *
 * The band headings are tinted with their own colours so a column and the
 * segment it matches in the donut beside it are the same colour. Both clear AA
 * for normal text on this surface; the competitive column stays in ordinary ink
 * because its neutral grey is a chart midpoint, not a legible text colour.
 */
export function BandStatTable({ all, byBand, lines, ppr }: Props) {
  const cell = 'py-1 text-right'

  return (
    <table className="w-full text-[0.6875rem]">
      <thead>
        <tr>
          <th className="pb-1 text-left font-semibold text-stone-400"> </th>
          <th className="pb-1 text-right font-semibold text-stone-500">All</th>
          {COLUMNS.map((band) => (
            <th
              key={band}
              className="pb-1 text-right font-semibold"
              style={band === 'competitive' ? undefined : { color: BAND_STYLE[band].color }}
            >
              <span className={band === 'competitive' ? 'text-stone-500' : undefined}>
                {HEADING[band]}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="tnum">
        {lines.map(({ key, label }) => (
          <tr key={key} className="border-t border-stone-200">
            <td className="py-1 text-left text-stone-600">{label}</td>
            <td className={`${cell} font-medium text-stone-900`}>{all[key]}</td>
            {COLUMNS.map((band) => (
              <td key={band} className={`${cell} text-stone-600`}>
                {byBand[band][key] === 0 ? '—' : byBand[band][key]}
              </td>
            ))}
          </tr>
        ))}
        <tr className="border-t border-stone-300 font-semibold">
          <td className="py-1 text-left text-stone-900">Fantasy points</td>
          <td className={`${cell} text-stone-900`}>{fantasyPoints(all, ppr).toFixed(1)}</td>
          {COLUMNS.map((band) => (
            <td key={band} className={`${cell} text-stone-600`}>
              {fantasyPoints(byBand[band], ppr).toFixed(1)}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}
