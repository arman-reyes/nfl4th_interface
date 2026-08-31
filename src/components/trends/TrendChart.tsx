import { useState } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { accentOnLight } from '../../lib/color'
import type { TrendMetric, TrendSeries } from '../../lib/trends'
import { medianSeries, valueExtent } from '../../lib/trends'
import { TrendTooltip } from './TrendTooltip'
import { axisTicks, endLabels } from './layout'

interface Props {
  seasons: number[]
  /** Every team, drawn faint so a selected line can be read against the league. */
  all: TrendSeries[]
  selected: TrendSeries[]
  metric: TrendMetric
}

// Right padding holds the end-of-line labels.
const PAD = { top: 14, right: 40, bottom: 26, left: 42 }
const HEIGHT = 320

/**
 * One line per team across the seasons.
 *
 * All 32 teams are drawn faintly underneath. A single line means nothing on
 * its own — 38% aggressive is only high or low relative to what everyone else
 * was doing that year, and the league moved a long way over these seasons —
 * so the spread and the median are always in view behind the selection.
 */
export function TrendChart({ seasons, all, selected, metric }: Props) {
  const [container, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  // Fitted across all 32, never the selection, so toggling a team never
  // rescales the axis underneath the comparison.
  const [lo, hi] = valueExtent(all, metric)
  const median = medianSeries(all, seasons)

  const innerWidth = Math.max(0, width - PAD.left - PAD.right)
  const innerHeight = HEIGHT - PAD.top - PAD.bottom
  const x = (i: number) =>
    PAD.left + (seasons.length <= 1 ? innerWidth / 2 : (i / (seasons.length - 1)) * innerWidth)
  const y = (v: number) => PAD.top + innerHeight - ((v - lo) / (hi - lo)) * innerHeight

  const ticks = axisTicks(lo, hi)
  const labels = endLabels(selected, x, y, seasons.length)

  function path(points: (number | null)[]): string {
    let d = ''
    let pen = false
    points.forEach((value, i) => {
      if (value === null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(value).toFixed(1)} `
      pen = true
    })
    return d.trim()
  }

  function onPointer(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const position = event.clientX - box.left
    const step = innerWidth / Math.max(1, seasons.length - 1)
    const index = Math.round((position - PAD.left) / step)
    setHover(index >= 0 && index < seasons.length ? index : null)
  }

  return (
    <div ref={container} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${metric.label} by season, ${selected.length} teams selected`}
          onPointerMove={onPointer}
          onPointerLeave={() => setHover(null)}
          className="touch-pan-y"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="#e7e5e4"
                strokeWidth={1}
              />
              <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="fill-stone-400 text-[10px]">
                {metric.format(tick)}
              </text>
            </g>
          ))}

          {seasons.map((season, i) => (
            <text
              key={season}
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className={`text-[10px] ${hover === i ? 'fill-stone-900 font-semibold' : 'fill-stone-400'}`}
            >
              {String(season).slice(2)}
            </text>
          ))}

          {/* Every team, as context. */}
          {all.map((series) => (
            <path
              key={series.abbr}
              d={path(series.points.map((p) => p.value))}
              fill="none"
              stroke="#d6d3d1"
              strokeWidth={1}
            />
          ))}

          <path
            d={path(median)}
            fill="none"
            stroke="#57534e"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />

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

          {selected.map((series) => {
            const color = accentOnLight(series.abbr)
            const label = labels.get(series.abbr)
            return (
              <g key={series.abbr}>
                <path
                  d={path(series.points.map((p) => p.value))}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {series.points.map((point, i) =>
                  point.value === null ? null : (
                    <circle
                      key={point.season}
                      cx={x(i)}
                      cy={y(point.value)}
                      r={hover === i ? 4.5 : 2.5}
                      fill={color}
                    />
                  ),
                )}
                {/* Identify the line at its end. Ten of the 32 team colours
                    resolve to near-black on white, so colour alone cannot tell
                    two selected lines apart. */}
                {label && (
                  <text
                    x={label.x + 6}
                    y={label.y + 3.5}
                    fill={color}
                    className="text-[10px] font-bold"
                  >
                    {series.abbr}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {hover !== null && (
        <TrendTooltip
          season={seasons[hover]}
          index={hover}
          series={selected}
          metric={metric}
          median={median[hover]}
          left={x(hover)}
          width={width}
        />
      )}
    </div>
  )
}
