import { useMemo } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { accentOnLight } from '../../lib/color'
import type { LeagueIndex } from '../../types'
import type { LeagueMetric } from '../../lib/league'
import { chartExtent, movement, seasonSpreads, teamSeries } from '../../lib/league'
import { axisTicks, bandPath, endLabels, linePath } from './layout'
import { PanelReadout } from './PanelReadout'
import { Gridlines, SeasonLabels } from './ChartAxis'

interface Props {
  index: LeagueIndex
  metric: LeagueMetric
  selected: string[]
  /** Shared across the four panels, so hovering one moves the guide on all. */
  hover: number | null
  onHover: (index: number | null) => void
}

const PAD = { top: 10, right: 34, bottom: 20, left: 38 }
const HEIGHT = 168

/**
 * One league metric across the seasons: the median team as a line, the middle
 * half of the league as a band behind it, and a coloured line for each team
 * the reader has picked out.
 *
 * The band is the half of the story a median hides. It says whether the league
 * moved as a block or came apart, and on aggressiveness it has widened.
 */
export function LeagueTrendPanel({ index, metric, selected, hover, onHover }: Props) {
  const [container, width] = useElementWidth<HTMLDivElement>()

  const spreads = useMemo(() => seasonSpreads(index, metric), [index, metric])
  const seasons = useMemo(() => spreads.map((s) => s.season), [spreads])
  const teams = useMemo(
    () => teamSeries(index, metric, selected, seasons),
    [index, metric, selected, seasons],
  )
  const shift = useMemo(() => movement(spreads), [spreads])
  const [lo, hi] = chartExtent(spreads, teams, metric)

  const innerWidth = Math.max(0, width - PAD.left - PAD.right)
  const innerHeight = HEIGHT - PAD.top - PAD.bottom
  const x = (i: number) =>
    PAD.left + (spreads.length <= 1 ? innerWidth / 2 : (i / (spreads.length - 1)) * innerWidth)
  const y = (v: number) => PAD.top + innerHeight - ((v - lo) / (hi - lo || 1)) * innerHeight

  const median = linePath(
    spreads.map((s) => s.p50),
    x,
    y,
  )
  const band = bandPath(
    spreads.map((s) => s.p75),
    spreads.map((s) => s.p25),
    x,
    y,
  )

  const labels = endLabels(
    teams.map((t) => {
      const last = [...t.points].reverse().find((p) => p.value !== null)
      return { key: t.abbr, value: last?.value ?? null, x: x(spreads.length - 1) }
    }),
    y,
  )

  function onPointer(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const step = innerWidth / Math.max(1, spreads.length - 1)
    const i = Math.round((event.clientX - box.left - PAD.left) / step)
    onHover(i >= 0 && i < spreads.length ? i : null)
  }

  const active = hover === null ? null : (spreads[hover] ?? null)

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-xs sm:p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-bold tracking-[0.14em] text-stone-500 uppercase">
          {metric.label}
        </h3>
        {shift && (
          <p className="tnum text-xs text-stone-500">
            {metric.format(shift.first.p50)}
            <span className="mx-1 text-stone-400">→</span>
            <span className="text-sm font-bold text-stone-900">
              {metric.format(shift.last.p50)}
            </span>
          </p>
        )}
      </div>

      <div ref={container} className="relative mt-2">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${metric.label}, league median by season`}
            onPointerMove={onPointer}
            onPointerLeave={() => onHover(null)}
            className="touch-pan-y"
          >
            <Gridlines ticks={axisTicks(lo, hi)} y={y} left={PAD.left} right={width - PAD.right} format={metric.format} />

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

            {/* Dashed, and a shade lighter than ink: it is the reference the
                team lines are read against, and several team colours resolve
                to black on white. */}
            <path
              d={median}
              fill="none"
              stroke="#44403c"
              strokeWidth={1.75}
              strokeDasharray="5 3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {teams.map((team) => {
              const color = accentOnLight(team.abbr)
              const label = labels.get(team.abbr)
              return (
                <g key={team.abbr}>
                  <path
                    d={linePath(
                      team.points.map((p) => p.value),
                      x,
                      y,
                    )}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {label && (
                    <text
                      x={label.x + 5}
                      y={label.y + 3}
                      fill={color}
                      className="text-[9px] font-bold"
                    >
                      {team.abbr}
                    </text>
                  )}
                </g>
              )
            })}

            <SeasonLabels seasons={seasons} x={x} baseline={HEIGHT - 6} hover={hover} />
          </svg>
        )}

        {active && (
          <PanelReadout
            spread={active}
            teams={teams}
            index={hover ?? 0}
            metric={metric}
            left={x(hover ?? 0)}
            width={width}
          />
        )}
      </div>

      <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-stone-500">{metric.caption}</p>
    </section>
  )
}
