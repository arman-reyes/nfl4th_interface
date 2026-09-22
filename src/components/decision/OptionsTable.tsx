import { axisFraction, optionWindow } from '../../lib/scale'
import { pct, points } from '../../lib/format'

/** One option, already priced and labelled by the page that owns it. */
export interface OptionRow {
  key: string
  label: string
  /** Expected win probability, 0-1; null where the option did not exist. */
  wp: number | null
  /** Context under the label: the conversion rate, the kick distance. */
  detail: string | null
  model: boolean
  actual: boolean
}

interface Props {
  rows: OptionRow[]
}

/**
 * Every option and what it is worth, best first. The bar is on the same
 * zoomed axis the whole app uses; it is there so the size of the gap is
 * visible, and it drops out below the small breakpoint where the numbers
 * have to carry it alone.
 *
 * The table knows nothing about which decision it is drawing. The page hands
 * it rows already priced and tagged, which is what lets three 4th-down
 * options and two try options come through the same component.
 */
export function OptionsTable({ rows: given }: Props) {
  const rows = [...given].sort((a, b) => (b.wp ?? -1) - (a.wp ?? -1))
  const best = rows[0]?.wp ?? null
  const window = optionWindow(rows.filter((r) => r.wp !== null).map((r) => r.wp! * 100))

  return (
    <section>
      <h3 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">
        Every option
      </h3>
      <table className="mt-3 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-stone-200 text-[0.6875rem] tracking-wide text-stone-500 uppercase">
            <th scope="col" className="py-2 pr-3 font-semibold">
              Option
            </th>
            <th scope="col" className="hidden py-2 pr-3 font-semibold sm:table-cell">
              <span className="sr-only">Relative win probability</span>
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">
              Win prob
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              vs best
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isBest = row.model
            const gap = row.wp === null || best === null ? null : (row.wp - best) * 100
            return (
              <tr key={row.key} className="border-b border-stone-100 align-middle">
                <td className="py-3 pr-3">
                  <div
                    className={`text-base font-semibold ${isBest ? 'text-stone-900' : 'text-stone-600'}`}
                  >
                    {row.label}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {isBest && <Tag tone="model">model</Tag>}
                    {row.actual && <Tag tone="actual">on the field</Tag>}
                    {row.detail && (
                      <span className="text-xs text-stone-500">{row.detail}</span>
                    )}
                  </div>
                </td>
                <td className="hidden w-[38%] py-3 pr-3 sm:table-cell">
                  {row.wp === null ? (
                    <span className="text-xs tracking-wide text-stone-400 uppercase">
                      not available
                    </span>
                  ) : (
                    <div className="h-6 w-full overflow-hidden rounded-xs bg-stone-100">
                      <div
                        className={`h-full ${isBest ? 'bg-stone-900' : 'bg-stone-300'}`}
                        style={{ width: `${axisFraction(row.wp * 100, window) * 100}%` }}
                      />
                    </div>
                  )}
                </td>
                <td
                  className={`tnum py-3 pr-3 text-right text-lg font-semibold ${
                    isBest ? 'text-stone-900' : 'text-stone-500'
                  }`}
                >
                  {row.wp === null ? '—' : pct(row.wp, 1)}
                </td>
                <td className="tnum py-3 text-right text-sm text-stone-500">
                  {gap === null ? '—' : gap === 0 ? 'best' : `−${points(Math.abs(gap))}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 hidden text-[0.6875rem] text-stone-400 sm:block">
        Bars span {window.start.toFixed(0)}–{window.end.toFixed(0)}% win probability.
      </p>
    </section>
  )
}

function Tag({ tone, children }: { tone: 'model' | 'actual'; children: string }) {
  const styles =
    tone === 'model'
      ? 'bg-stone-900 text-white'
      : 'bg-amber-100 text-amber-900 ring-1 ring-amber-200 ring-inset'
  return (
    <span
      className={`rounded-xs px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wide uppercase ${styles}`}
    >
      {children}
    </span>
  )
}
