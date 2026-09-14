import { farCut, LENS, mean, METRIC, se, tripsCut } from '../../lib/travel'
import type { Cell, Lens, MetricKey, TravelAggregate } from '../../lib/travel'
import { signTone } from './signTone'

interface Props {
  agg: TravelAggregate
  lens: Lens
  threshold: number
}

const HEAD =
  'text-[0.625rem] font-bold tracking-[0.14em] text-stone-500 uppercase whitespace-nowrap'

/** Columns in reading order: the result, the result against the line, then how the offence played. */
const COLUMNS: MetricKey[] = [
  'win',
  'margin',
  'vs_line',
  'cover',
  'epa_play',
  'yards',
  'turnovers',
  'penalties',
]

/** The four a phone card carries: the result and the result against the line. */
const CARD_COLUMNS: MetricKey[] = ['win', 'margin', 'vs_line', 'cover']

/** Where the standard error is printed beside the mean rather than only on hover. */
const SHOW_SE = new Set<MetricKey>(['margin', 'vs_line'])

interface Row {
  label: string
  cells: Record<MetricKey, Cell>
  /** Summary rows sit under a rule and read bold. */
  summary?: boolean
}

function rowsFor(agg: TravelAggregate, lens: Lens, threshold: number): Row[] {
  const def = LENS[lens]
  const byMetric = agg.byLens[lens]
  const pick = (f: (cells: Cell[]) => Cell) =>
    Object.fromEntries(
      (Object.keys(byMetric) as MetricKey[]).map((k) => [k, f(byMetric[k])]),
    ) as Record<MetricKey, Cell>

  const rows: Row[] = def.bins
    .map((label, i) => ({ label, cells: pick((cells) => cells[i]) }))
    // A bin with no games in it (no international trip that season) is not a
    // row of dashes; it is absent.
    .filter((row) => row.cells.win.n > 0)

  const distance = agg.byLens.distance
  const cut = (f: (cells: Cell[]) => Cell) =>
    Object.fromEntries(
      (Object.keys(distance) as MetricKey[]).map((k) => [k, f(distance[k])]),
    ) as Record<MetricKey, Cell>
  rows.push({ label: 'Every trip', cells: cut(tripsCut), summary: true })
  rows.push({
    label: `Trips of ${threshold.toLocaleString('en-US')}+ mi`,
    cells: cut((cells) => farCut(cells, threshold)),
    summary: true,
  })
  return rows
}

/** A mean with its error on hover, and inline where the argument rests on it. */
function Value({ cell, metric, inlineSe }: { cell: Cell; metric: MetricKey; inlineSe: boolean }) {
  const m = mean(cell)
  const def = METRIC[metric]
  if (m === null) return <span className="text-stone-400">—</span>
  const err = se(cell)
  const errText = err === null ? '' : ` ± ${def.format(err).replace(/^[+−]/, '')}`
  return (
    <span title={`${def.label}: ${def.format(m)}${errText}, over ${cell.n} team-games`}>
      {def.format(m)}
      {inlineSe && err !== null && (
        <span className="ml-1 text-[0.625rem] text-stone-400">
          ±{def.format(err).replace(/^[+−]/, '')}
        </span>
      )}
    </span>
  )
}

/**
 * A margin as a bar either side of zero, so the eye can run down the column
 * without reading every number. Scaled to the largest magnitude on the table,
 * because the comparison is between rows and no margin ever reaches the axis.
 */
function MarginBar({ value, max }: { value: number; max: number }) {
  const share = max > 0 ? Math.min(1, Math.abs(value) / max) : 0
  const tone = signTone(value)
  return (
    <span aria-hidden className="relative inline-block h-1.5 w-16 rounded-full bg-stone-100 align-middle">
      <span className="absolute top-0 bottom-0 left-1/2 w-px bg-stone-300" />
      <span
        className="absolute top-0 bottom-0 rounded-full"
        style={{
          width: `${share * 50}%`,
          [value < 0 ? 'right' : 'left']: '50%',
          background: tone.color ?? 'transparent',
        }}
      />
    </span>
  )
}

/**
 * Results by trip: the page's core answer.
 *
 * One row per bin of the chosen lens, home first, then two summary rows —
 * every trip, and the far ones — which do not move with the lens, so a reader
 * can switch lenses and keep the same reference lines in view.
 *
 * Two layouts. Nine columns of means cannot fit a phone; below `sm` each bin
 * is a card carrying the four columns the argument turns on.
 */
export function TripTable({ agg, lens, threshold }: Props) {
  const rows = rowsFor(agg, lens, threshold)
  const def = LENS[lens]
  const maxMargin = Math.max(
    0,
    ...rows.map((row) => Math.abs(mean(row.cells.margin) ?? 0)),
  )

  return (
    <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
      <div className="border-b border-stone-200 bg-stone-50 px-3 py-2 sm:px-4">
        <h2 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">
          Results by {def.label.toLowerCase()}
        </h2>
        <p className="mt-0.5 text-[0.625rem] text-stone-400">
          Means over team-games, ± one standard error. &ldquo;vs Line&rdquo; is the margin
          against the closing spread, which already prices the teams and the home field.
        </p>
      </div>

      <ul className="sm:hidden">
        {rows.map((row) => (
          <li
            key={row.label}
            className={`border-b border-stone-100 px-3 py-3 last:border-b-0 ${
              row.summary ? 'bg-stone-50' : ''
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-sm ${row.summary ? 'font-bold' : 'font-semibold'} text-stone-900`}>
                {row.label}
              </span>
              <span className="tnum text-[0.6875rem] text-stone-400">
                {row.cells.win.n.toLocaleString('en-US')} games
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {CARD_COLUMNS.map((key) => (
                <span key={key} className="block">
                  <span className={HEAD}>{METRIC[key].short}</span>
                  <span className="tnum block text-sm text-stone-700">
                    <Value cell={row.cells[key]} metric={key} inlineSe={false} />
                  </span>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className={`${HEAD} px-3 py-2 text-left`}>{def.heading}</th>
              <th className={`${HEAD} px-2 py-2 text-right`}>Games</th>
              {COLUMNS.map((key) => (
                <th
                  key={key}
                  className={`${HEAD} px-2 py-2 text-right`}
                  title={METRIC[key].label}
                >
                  {METRIC[key].short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const firstSummary = row.summary && !rows[i - 1]?.summary
              const m = mean(row.cells.margin)
              return (
                <tr
                  key={row.label}
                  className={`border-b border-stone-100 hover:bg-stone-50 ${
                    firstSummary ? 'border-t-2 border-t-stone-200' : ''
                  } ${row.summary ? 'font-semibold' : ''}`}
                >
                  <td className="px-3 py-2 whitespace-nowrap text-stone-900">{row.label}</td>
                  <td className="tnum px-2 py-2 text-right text-stone-500">
                    {row.cells.win.n.toLocaleString('en-US')}
                  </td>
                  {COLUMNS.map((key) => (
                    <td key={key} className="tnum px-2 py-2 text-right whitespace-nowrap text-stone-700">
                      {key === 'margin' && m !== null && (
                        <MarginBar value={m} max={maxMargin} />
                      )}
                      {key === 'margin' && <span className="inline-block w-2" />}
                      <Value cell={row.cells[key]} metric={key} inlineSe={SHOW_SE.has(key)} />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
