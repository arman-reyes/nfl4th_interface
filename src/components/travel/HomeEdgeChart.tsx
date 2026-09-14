import { useState } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { mean, se, signedText } from '../../lib/travel'
import type { MetricKey, SeasonSplit } from '../../lib/travel'
import { axisTicks, bandPath, linePath } from '../trends/layout'
import { Gridlines, SeasonLabels } from '../trends/ChartAxis'

interface Props {
  seasons: SeasonSplit[]
}

const PAD = { top: 10, right: 12, bottom: 20, left: 38 }
const HEIGHT = 150

interface PanelDef {
  key: MetricKey
  label: string
  caption: string
}

const PANELS: PanelDef[] = [
  {
    key: 'margin',
    label: 'Home margin',
    caption:
      'Average margin of the home team, by season. Near zero in 2019–2021 — 2020 was played without crowds — and lower since than before.',
  },
  {
    key: 'vs_line',
    label: 'Home margin vs. line',
    caption:
      'The same, against the closing spread. Flat around zero throughout: the market has tracked the home edge as it moved.',
  },
]

function Panel({
  def,
  seasons,
  hover,
  onHover,
}: {
  def: PanelDef
  seasons: SeasonSplit[]
  hover: number | null
  onHover: (i: number | null) => void
}) {
  const [container, width] = useElementWidth<HTMLDivElement>()
  const points = seasons.map((s) => ({
    season: s.season,
    value: mean(s.home[def.key]),
    err: se(s.home[def.key]),
  }))
  const upper = points.map((p) => (p.value ?? 0) + (p.err ?? 0))
  const lower = points.map((p) => (p.value ?? 0) - (p.err ?? 0))
  // Zero is always on the axis: it is the line the reader is judging against.
  const lo = Math.min(0, ...lower) - 0.5
  const hi = Math.max(0, ...upper) + 0.5

  const innerWidth = Math.max(0, width - PAD.left - PAD.right)
  const innerHeight = HEIGHT - PAD.top - PAD.bottom
  const x = (i: number) =>
    PAD.left + (points.length <= 1 ? innerWidth / 2 : (i / (points.length - 1)) * innerWidth)
  const y = (v: number) => PAD.top + innerHeight - ((v - lo) / (hi - lo || 1)) * innerHeight

  function onPointer(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const step = innerWidth / Math.max(1, points.length - 1)
    const i = Math.round((event.clientX - box.left - PAD.left) / step)
    onHover(i >= 0 && i < points.length ? i : null)
  }

  const active = hover === null ? null : (points[hover] ?? null)
  const first = points[0]
  const last = points[points.length - 1]

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-bold tracking-[0.14em] text-stone-500 uppercase">{def.label}</h3>
        <p className="tnum text-xs text-stone-500">
          {active ? (
            <>
              <span className="font-semibold text-stone-900">{active.season}</span>{' '}
              <span className="font-bold text-stone-900">
                {active.value === null ? '—' : signedText(active.value, 1)}
              </span>
              {active.err !== null && <span className="text-stone-400"> ±{active.err.toFixed(1)}</span>}
            </>
          ) : (
            first &&
            last && (
              <>
                {first.value === null ? '—' : signedText(first.value, 1)}
                <span className="mx-1 text-stone-400">→</span>
                <span className="text-sm font-bold text-stone-900">
                  {last.value === null ? '—' : signedText(last.value, 1)}
                </span>
              </>
            )
          )}
        </p>
      </div>
      <div ref={container} className="relative mt-2">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${def.label} by season`}
            onPointerMove={onPointer}
            onPointerLeave={() => onHover(null)}
            className="touch-pan-y"
          >
            <Gridlines
              ticks={axisTicks(lo, hi)}
              y={y}
              left={PAD.left}
              right={width - PAD.right}
              format={(v) => signedText(v, 0)}
            />
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(0)}
              y2={y(0)}
              stroke="#a8a29e"
              strokeWidth={1}
            />
            {/* One standard error either side, the same grey as the league
                band on the trends page: it is the uncertainty, not a second series. */}
            <path d={bandPath(upper, lower, x, y)} fill="#e7e5e4" />
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
              d={linePath(
                points.map((p) => p.value),
                x,
                y,
              )}
              fill="none"
              stroke="#44403c"
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <SeasonLabels
              seasons={points.map((p) => p.season)}
              x={x}
              baseline={HEIGHT - 6}
              hover={hover}
            />
          </svg>
        )}
      </div>
      <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-stone-500">{def.caption}</p>
    </div>
  )
}

/**
 * The home edge over time, raw and against the line.
 *
 * Two panels because the contrast is the point: the raw edge has moved — it
 * fell to nothing in the empty stadiums of 2020 and has come back smaller —
 * while the edge against the line has stayed at zero, which is the market
 * moving with it. The band is one standard error; a season is only ~270
 * games, so the band is wide and the reader should not read a single year.
 */
export function HomeEdgeChart({ seasons }: Props) {
  // Shared across the two panels so hovering one moves the guide on both.
  const [hover, setHover] = useState<number | null>(null)
  const sorted = [...seasons].sort((a, b) => a.season - b.season)
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-xs sm:p-4">
      <h2 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">
        The home edge, season by season
      </h2>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        {PANELS.map((def) => (
          <Panel key={def.key} def={def} seasons={sorted} hover={hover} onHover={setHover} />
        ))}
      </div>
    </section>
  )
}
