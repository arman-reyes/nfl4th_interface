import { useState } from 'react'
import { BANDS, PPR, splitByBand } from '../../lib/garbageTime'
import type { Format, Removals } from '../../lib/garbageTime'
import { BAND_STYLE } from './bandStyle'
import type { BinRow, GarbageTimeFile } from '../../types'

/**
 * Where a season's points came from, as three shares of one whole.
 *
 * Colours and labels come from BAND_STYLE so this and the table breakdown
 * cannot disagree about what amber means.
 */
const SIZE = 148
const STROKE = 22
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** A surface-coloured gap so adjacent arcs read as separate marks. */
const GAP = 2

interface Props {
  /** A player's bins or a whole offense's — they are packed identically. */
  rows: BinRow[]
  /** Named in the accessible description, so a screen reader knows whose it is. */
  label: string
  file: GarbageTimeFile
  format: Format
  threshold: number
  remove: Removals
}

export function PointsDonut({ rows, label, file, format, threshold, remove }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const split = splitByBand(rows, file.bins, threshold, PPR[format])
  const total = split.trailing + split.competitive + split.leading

  // One segment per checkbox, in the order they sit on the win-probability
  // axis. The donut and the "Remove points from total" group are the same three
  // things, so a reader can see what a box is about to take out.
  const segments = BANDS.map((band) => {
    const value = split[band]
    return {
      key: band,
      ...BAND_STYLE[band],
      value,
      // A band can go negative - a quarterback whose only competitive snap was
      // an interception. An arc cannot show that, so it contributes nothing to
      // the ring and the legend carries the real number.
      weight: Math.max(value, 0),
      stripped: remove[band],
    }
  })
  const drawn = segments.reduce((sum, s) => sum + s.weight, 0)

  // Prefix sums rather than a running offset, so nothing is reassigned during
  // render. Three segments makes the quadratic cost meaningless.
  const arcs = segments.map((segment, i) => ({
    ...segment,
    fraction: drawn > 0 ? segment.weight / drawn : 0,
    offset:
      drawn > 0 ? segments.slice(0, i).reduce((sum, s) => sum + s.weight, 0) / drawn : 0,
  }))
  const visible = arcs.filter((a) => a.fraction > 0)

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="relative">
        <svg
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={`${label}: ${total.toFixed(1)} points, ${segments
            .map((s) => `${s.value.toFixed(1)} in ${s.label.toLowerCase()}`)
            .join(', ')}`}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#f0efee"
            strokeWidth={STROKE}
          />
          {visible.map((arc) => {
            const length = arc.fraction * CIRCUMFERENCE
            // One full-circle band needs no gap; anything less gets one so the
            // arcs do not run together.
            const gap = visible.length > 1 ? GAP : 0
            return (
              <circle
                key={arc.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={arc.color}
                strokeWidth={hover === arc.key ? STROKE + 4 : STROKE}
                strokeDasharray={`${Math.max(length - gap, 0.5)} ${CIRCUMFERENCE - Math.max(length - gap, 0.5)}`}
                strokeDashoffset={-arc.offset * CIRCUMFERENCE}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                onMouseEnter={() => setHover(arc.key)}
                onMouseLeave={() => setHover(null)}
                className="cursor-default transition-[stroke-width] duration-100"
              />
            )
          })}
          <text
            x={SIZE / 2}
            y={SIZE / 2 - 2}
            textAnchor="middle"
            className="tnum fill-stone-900 text-[1.35rem] font-bold"
          >
            {total.toFixed(1)}
          </text>
          <text
            x={SIZE / 2}
            y={SIZE / 2 + 14}
            textAnchor="middle"
            className="fill-stone-400 text-[0.5625rem] font-bold tracking-[0.14em] uppercase"
          >
            fantasy pts
          </text>
        </svg>
      </div>

      <dl className="min-w-[11rem] flex-1 space-y-1.5">
        {segments.map((segment) => (
          <div
            key={segment.key}
            onMouseEnter={() => setHover(segment.key)}
            onMouseLeave={() => setHover(null)}
            className={`flex items-baseline gap-2 rounded px-1 py-0.5 transition-colors ${
              hover === segment.key ? 'bg-stone-100' : ''
            }`}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 translate-y-px rounded-xs"
              style={{ background: segment.color }}
            />
            <dt className="min-w-0 flex-1 text-[0.6875rem] leading-tight text-stone-600">
              {segment.label}
              {segment.stripped && (
                <span className="ml-1 text-[0.625rem] font-semibold text-amber-700">removed</span>
              )}
              <span className="block text-[0.625rem] text-stone-400">{segment.hint}</span>
            </dt>
            <dd className="tnum text-right text-sm font-semibold text-stone-900">
              {segment.value.toFixed(1)}
              <span className="tnum block text-[0.625rem] font-medium text-stone-400">
                {total > 0 ? `${Math.round((segment.value / total) * 100)}%` : '—'}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
