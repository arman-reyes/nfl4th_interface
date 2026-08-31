import type { TrendMetric, TrendSeries } from '../../lib/trends'
import { recordLabel } from '../../lib/trends'
import { TeamPill } from '../TeamPill'

interface Props {
  season: number
  index: number
  series: TrendSeries[]
  metric: TrendMetric
  median: number | null
  left: number
  width: number
}

/**
 * The hovered season, with each selected team's value and — always, whatever
 * metric is on the chart — that team's record for the year. The record is the
 * thing you actually want beside a tendency, so it is never a second click
 * away.
 */
export function TrendTooltip({ season, index, series, metric, median, left, width }: Props) {
  const rows = series
    .map((s) => ({ abbr: s.abbr, point: s.points[index] }))
    .filter((r) => r.point?.value !== null && r.point?.summary)
    .sort((a, b) => (b.point.value ?? 0) - (a.point.value ?? 0))

  if (rows.length === 0) return null

  // Flip to the left of the guide once it would run off the right edge.
  const flip = left > width - 220
  const style = flip ? { right: width - left + 12 } : { left: left + 12 }

  return (
    <div
      style={style}
      className="pointer-events-none absolute top-2 z-10 min-w-[11rem] rounded-md border border-stone-200 bg-white/97 p-2.5 shadow-lg"
    >
      <p className="tnum flex items-baseline justify-between gap-3 text-xs font-bold text-stone-900">
        {season}
        {median !== null && (
          <span className="font-normal text-stone-400">league {metric.format(median)}</span>
        )}
      </p>
      <ul className="mt-1.5 space-y-1">
        {rows.map(({ abbr, point }) => (
          <li key={abbr} className="flex items-center gap-2">
            <TeamPill abbr={abbr} />
            <span className="tnum text-xs text-stone-500">
              {point.summary ? recordLabel(point.summary) : '—'}
            </span>
            <span className="tnum ml-auto text-sm font-semibold text-stone-900">
              {point.value === null ? '—' : metric.format(point.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
