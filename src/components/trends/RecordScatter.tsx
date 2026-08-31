import { useElementWidth } from '../../hooks/useElementWidth'
import type { LeagueMetric } from '../../lib/league'
import type { Pair } from '../../lib/trends'
import { pairExtent } from '../../lib/trends'

interface Props {
  pairs: Pair[]
  metric: LeagueMetric
}

const PAD = { top: 12, right: 14, bottom: 44, left: 40 }
const HEIGHT = 280

/**
 * Every team-season as one dot: the metric against how that team finished.
 *
 * The interpretation lives in AgainstRecord, which wraps this. On its own a
 * flat cloud invites the wrong conclusion, so the plot is never shown without
 * the arithmetic saying the correlation could not have seen the effect anyway.
 */
export function RecordScatter({ pairs, metric }: Props) {
  const [container, width] = useElementWidth<HTMLDivElement>()

  const [lo, hi] = pairExtent(pairs, metric)
  const innerWidth = Math.max(0, width - PAD.left - PAD.right)
  const innerHeight = HEIGHT - PAD.top - PAD.bottom
  const x = (v: number) => PAD.left + ((v - lo) / (hi - lo || 1)) * innerWidth
  const y = (v: number) => PAD.top + innerHeight - v * innerHeight

  return (
    <div>
      <div ref={container}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${metric.label} against win percentage, ${pairs.length} team-seasons`}
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

            {pairs.map((pair) => (
              <circle
                key={`${pair.abbr}-${pair.season}`}
                cx={x(pair.x)}
                cy={y(pair.y)}
                r={2.5}
                fill="#78716c"
                fillOpacity={0.5}
              >
                <title>
                  {pair.abbr} {pair.season} · {pair.record} · {metric.format(pair.x)}
                </title>
              </circle>
            ))}

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

      <p className="mt-1 text-xs leading-relaxed text-stone-400">
        One dot per team-season, {pairs.length} of them. Association, not cause — a team that spends
        a season behind goes for it more, so the arrow can point either way.
      </p>
    </div>
  )
}
