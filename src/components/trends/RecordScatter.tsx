import { useMemo } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { accentOnLight } from '../../lib/color'
import type { TrendMetric, TrendSeries } from '../../lib/trends'
import { metricAgainstRecord, pearson, valueExtent } from '../../lib/trends'

interface Props {
  all: TrendSeries[]
  selected: TrendSeries[]
  metric: TrendMetric
}

const PAD = { top: 12, right: 14, bottom: 44, left: 40 }
const HEIGHT = 280

/**
 * Every team-season as one dot: the metric against how the team finished.
 *
 * This is the question the trend lines cannot answer on their own. The whole
 * league is plotted, with the selection picked out in colour, and the
 * correlation is quoted over the league rather than the selection — twelve
 * dots from one team would give a number that moves wildly with the team you
 * happened to click.
 *
 * It is an association and nothing more. Thirty-two teams making their own
 * calls is not an experiment, and the arrow could point the other way, since a
 * team that spends the season behind goes for it more.
 */
export function RecordScatter({ all, selected, metric }: Props) {
  const [container, width] = useElementWidth<HTMLDivElement>()
  const league = useMemo(() => metricAgainstRecord(all, metric), [all, metric])
  const r = useMemo(() => pearson(league), [league])
  const highlighted = useMemo(() => new Set(selected.map((s) => s.abbr)), [selected])

  if (metric.key === 'winPct') {
    return (
      <Frame>
        <p className="text-sm text-stone-500">
          Win percentage plotted against itself says nothing. Pick another metric to see how it
          travels with a team&rsquo;s record.
        </p>
      </Frame>
    )
  }

  const [lo, hi] = valueExtent(all, metric)
  const innerWidth = Math.max(0, width - PAD.left - PAD.right)
  const innerHeight = HEIGHT - PAD.top - PAD.bottom
  const x = (v: number) => PAD.left + ((v - lo) / (hi - lo || 1)) * innerWidth
  const y = (v: number) => PAD.top + innerHeight - v * innerHeight

  // Selected dots last, so they sit above the league.
  const ordered = [...league].sort(
    (a, b) => Number(highlighted.has(a.abbr)) - Number(highlighted.has(b.abbr)),
  )

  return (
    <Frame>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">
          {metric.label} against record
        </h3>
        <p className="tnum text-xs text-stone-500">
          {r === null ? '—' : `r = ${r.toFixed(2)}`}
          <span className="text-stone-400"> · n = {league.length} team-seasons, league-wide</span>
        </p>
      </div>

      <div ref={container} className="mt-2">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${metric.label} against win percentage, ${league.length} team-seasons`}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={tick === 0.5 ? '#d6d3d1' : '#f0efee'}
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 7}
                  y={y(tick) + 4}
                  textAnchor="end"
                  className="fill-stone-400 text-[10px]"
                >
                  {(tick * 100).toFixed(0)}%
                </text>
              </g>
            ))}

            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
              const value = lo + (hi - lo) * fraction
              return (
                <text
                  key={fraction}
                  x={x(value)}
                  y={PAD.top + innerHeight + 14}
                  textAnchor="middle"
                  className="fill-stone-400 text-[10px]"
                >
                  {metric.format(value)}
                </text>
              )
            })}

            {ordered.map((pair) => {
              const on = highlighted.has(pair.abbr)
              return (
                <circle
                  key={`${pair.abbr}-${pair.season}`}
                  cx={x(pair.x)}
                  cy={y(pair.y)}
                  r={on ? 4 : 2.5}
                  fill={on ? accentOnLight(pair.abbr) : '#d6d3d1'}
                  fillOpacity={on ? 0.9 : 0.7}
                >
                  <title>
                    {pair.abbr} {pair.season} · {pair.record} · {metric.format(pair.x)}
                  </title>
                </circle>
              )
            })}

            <text
              x={PAD.left + innerWidth / 2}
              y={HEIGHT - 6}
              textAnchor="middle"
              className="fill-stone-500 text-[10px] font-semibold"
            >
              {metric.label} →
            </text>
            <text
              x={12}
              y={PAD.top + innerHeight / 2}
              textAnchor="middle"
              transform={`rotate(-90 12 ${PAD.top + innerHeight / 2})`}
              className="fill-stone-500 text-[10px] font-semibold"
            >
              Win %
            </text>
          </svg>
        )}
      </div>

      <p className="mt-1 text-xs leading-relaxed text-stone-500">
        One dot per team-season, the whole league; selected teams in colour. This is an association,
        not a cause — 32 teams making their own calls is not an experiment, and the arrow could
        point the other way, since a team that spends a season behind goes for it more.
      </p>
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-xs sm:p-5">
      {children}
    </section>
  )
}
