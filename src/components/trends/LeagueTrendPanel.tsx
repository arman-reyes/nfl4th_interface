import { useMemo, useState } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import type { LeagueIndex } from '../../types'
import type { LeagueMetric } from '../../lib/league'
import { movement, seasonSpreads, spreadExtent } from '../../lib/league'
import { axisTicks } from './layout'

interface Props {
  index: LeagueIndex
  metric: LeagueMetric
}

const PAD = { top: 10, right: 8, bottom: 20, left: 38 }
const HEIGHT = 168

/**
 * One league metric across the seasons: the median team as a line, the middle
 * half of the league as a band behind it.
 *
 * The band is the half of the story a median hides. It says whether the league
 * moved as a block or came apart, and on aggressiveness it has widened — the
 * gap between the 25th and 75th percentile team is nearly twice what it was in
 * 2014.
 */
export function LeagueTrendPanel({ index, metric }: Props) {
  const [container, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const spreads = useMemo(() => seasonSpreads(index, metric), [index, metric])
  const shift = useMemo(() => movement(spreads), [spreads])
  const [lo, hi] = spreadExtent(spreads, metric)

  const innerWidth = Math.max(0, width - PAD.left - PAD.right)
  const innerHeight = HEIGHT - PAD.top - PAD.bottom
  const x = (i: number) =>
    PAD.left + (spreads.length <= 1 ? innerWidth / 2 : (i / (spreads.length - 1)) * innerWidth)
  const y = (v: number) => PAD.top + innerHeight - ((v - lo) / (hi - lo || 1)) * innerHeight

  const line = spreads.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(s.p50).toFixed(1)}`).join(' ')
  const band = [
    ...spreads.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(s.p75).toFixed(1)}`),
    ...[...spreads].reverse().map((s, i) => `L${x(spreads.length - 1 - i).toFixed(1)},${y(s.p25).toFixed(1)}`),
    'Z',
  ].join(' ')

  const active = hover === null ? null : spreads[hover]

  function onPointer(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const step = innerWidth / Math.max(1, spreads.length - 1)
    const index = Math.round((event.clientX - box.left - PAD.left) / step)
    setHover(index >= 0 && index < spreads.length ? index : null)
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-xs sm:p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-bold tracking-[0.14em] text-stone-500 uppercase">
          {metric.label}
        </h3>
        {active ? (
          <p className="tnum text-xs text-stone-500">
            <span className="font-bold text-stone-900">{active.season}</span>{' '}
            <span className="font-semibold text-stone-900">{metric.format(active.p50)}</span>{' '}
            <span className="text-stone-400">
              ({metric.format(active.p25)}–{metric.format(active.p75)})
            </span>
          </p>
        ) : (
          shift && (
            <p className="tnum text-xs text-stone-500">
              {metric.format(shift.first.p50)}
              <span className="mx-1 text-stone-400">→</span>
              <span className="text-sm font-bold text-stone-900">
                {metric.format(shift.last.p50)}
              </span>
            </p>
          )
        )}
      </div>

      <div ref={container} className="mt-2">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${metric.label}, league median by season`}
            onPointerMove={onPointer}
            onPointerLeave={() => setHover(null)}
            className="touch-pan-y"
          >
            {axisTicks(lo, hi).map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="#f0efee"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 6}
                  y={y(tick) + 3.5}
                  textAnchor="end"
                  className="fill-stone-400 text-[9px]"
                >
                  {metric.format(tick)}
                </text>
              </g>
            ))}

            <path d={band} fill="#e7e5e4" />

            {hover !== null && (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={PAD.top + innerHeight}
                stroke="#a8a29e"
                strokeWidth={1}
              />
            )}

            <path
              d={line}
              fill="none"
              stroke="#1c1917"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {spreads.map((s, i) => (
              <circle
                key={s.season}
                cx={x(i)}
                cy={y(s.p50)}
                r={hover === i ? 4 : 2}
                fill="#1c1917"
              />
            ))}

            {spreads.map((s, i) =>
              i === 0 || i === spreads.length - 1 || s.season % 2 === 0 ? (
                <text
                  key={s.season}
                  x={x(i)}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  className={`text-[9px] ${hover === i ? 'fill-stone-900 font-semibold' : 'fill-stone-400'}`}
                >
                  {String(s.season).slice(2)}
                </text>
              ) : null,
            )}
          </svg>
        )}
      </div>

      <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-stone-500">{metric.caption}</p>
    </section>
  )
}
