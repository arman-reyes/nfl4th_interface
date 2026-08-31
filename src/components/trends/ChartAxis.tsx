/** Axis furniture shared by the trend panels. */

interface GridlinesProps {
  ticks: number[]
  y: (v: number) => number
  left: number
  right: number
  format: (v: number) => string
}

export function Gridlines({ ticks, y, left, right, format }: GridlinesProps) {
  return (
    <>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke="#f0efee" strokeWidth={1} />
          <text
            x={left - 6}
            y={y(tick) + 3.5}
            textAnchor="end"
            className="fill-stone-400 text-[9px]"
          >
            {format(tick)}
          </text>
        </g>
      ))}
    </>
  )
}

interface SeasonLabelsProps {
  seasons: number[]
  x: (i: number) => number
  baseline: number
  hover: number | null
}

/** Two-digit years, thinned to every other one so they do not collide. */
export function SeasonLabels({ seasons, x, baseline, hover }: SeasonLabelsProps) {
  return (
    <>
      {seasons.map((season, i) =>
        i === 0 || i === seasons.length - 1 || season % 2 === 0 ? (
          <text
            key={season}
            x={x(i)}
            y={baseline}
            textAnchor="middle"
            className={`text-[9px] ${hover === i ? 'fill-stone-900 font-semibold' : 'fill-stone-400'}`}
          >
            {String(season).slice(2)}
          </text>
        ) : null,
      )}
    </>
  )
}
