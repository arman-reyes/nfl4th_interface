import { BANDS } from '../../lib/garbageTime'
import type { Band, BandSplit } from '../../lib/garbageTime'
import { BAND_STYLE } from './bandStyle'

/** A surface-coloured gap, so adjacent segments read as separate marks. */
const GAP = 2

interface Props {
  split: BandSplit
  /** Everything the player scored, which the three bands sum to. */
  total: number
  /** Stack the three values under the bar instead of flanking it. */
  stacked?: boolean
}

/**
 * Where a season's points came from, as one stacked bar.
 *
 * Replaces a single garbage-share percentage, which could not distinguish a
 * receiver whose extra production came while his team was buried from a back
 * whose came while his team was coasting — opposite situations that one number
 * collapsed into the same value.
 *
 * In a table row the bar is flanked by the two garbage shares, each in its own
 * band's colour: trailing on the left where its segment starts, leading on the
 * right where its segment ends, so a number and the segment it describes are
 * the same colour in the same place. The competitive share is the remainder and
 * is left to the bar — it is the one part of the row nobody is asking about.
 * Both colours clear AA for normal text against the row and its hover tint
 * (5.0:1 and 6.7:1), which is what makes colouring the numbers legitimate
 * rather than decorative.
 */
export function BandBreakdown({ split, total, stacked = false }: Props) {
  // A band can be negative — a quarterback whose only competitive snap was an
  // interception. A bar cannot show that, so it contributes no width and the
  // number beside it carries the truth.
  const weights = BANDS.map((band) => Math.max(split[band], 0))
  const drawn = weights.reduce((a, b) => a + b, 0)
  const share = (band: Band) => (total > 0 ? split[band] / total : 0)
  const pct = (band: Band) => (total > 0 ? `${Math.round(share(band) * 100)}%` : '—')

  const label = BANDS.map((band) => `${BAND_STYLE[band].label} ${pct(band)}`).join(', ')

  const bar = (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`flex h-1.5 overflow-hidden rounded-full bg-stone-100 ${
        stacked ? 'w-full' : 'w-20 shrink-0'
      }`}
    >
      {BANDS.map((band, i) => ({ band, width: drawn > 0 ? (weights[i] / drawn) * 100 : 0 }))
        .filter((segment) => segment.width > 0)
        // The gap sits between drawn segments, not after every band: a player
        // with nothing in the last band would otherwise end on a stray notch.
        .map((segment, i, drawnSegments) => (
          <span
            key={segment.band}
            style={{
              width: `${segment.width}%`,
              background: BAND_STYLE[segment.band].color,
              marginRight: i < drawnSegments.length - 1 ? GAP : 0,
            }}
          />
        ))}
    </span>
  )

  if (stacked) {
    return (
      <span className="block">
        {bar}
        <span className="mt-2 block space-y-1">
          {BANDS.map((band) => (
            <span key={band} className="flex items-baseline gap-2">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 translate-y-px rounded-xs"
                style={{ background: BAND_STYLE[band].color }}
              />
              <span className="min-w-0 flex-1 text-[0.6875rem] text-stone-600">
                {BAND_STYLE[band].label}
              </span>
              <span className="tnum text-[0.6875rem] font-semibold text-stone-900">
                {split[band].toFixed(1)}
              </span>
              <span className="tnum w-9 text-right text-[0.6875rem] text-stone-400">
                {pct(band)}
              </span>
            </span>
          ))}
        </span>
      </span>
    )
  }

  // Fixed-width flanks so every bar in the column starts and ends on the same
  // pixel. Ragged numbers would stagger the bars and make the column unscannable.
  return (
    <span className="flex items-center justify-center gap-1.5">
      <span
        className="tnum w-9 shrink-0 text-right text-[0.6875rem] font-semibold"
        style={{ color: BAND_STYLE.trailing.color }}
      >
        {pct('trailing')}
      </span>
      {bar}
      <span
        className="tnum w-9 shrink-0 text-left text-[0.6875rem] font-semibold"
        style={{ color: BAND_STYLE.leading.color }}
      >
        {pct('leading')}
      </span>
    </span>
  )
}
