import type { Choice, Play } from '../../types'
import { CHOICE_VERB } from '../../lib/decision'
import { CHOICES, choiceMatrix } from '../../lib/metrics'
import { pct } from '../../lib/format'

/**
 * What the staff did against what the model asked for.
 *
 * The diagonal is agreement. Reading a row answers the scouting question
 * directly: when the model wanted them to go, what did they do instead?
 */
/** Column headers: what the staff did. Short enough to fit a phone. */
const DID: Record<Choice, string> = { go: 'Went', fg: 'Kicked', punt: 'Punted' }

export function DecisionMatrix({ plays }: { plays: Play[] }) {
  const rows = choiceMatrix(plays)

  return (
    <section>
      <h3 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">
        Decisions against the model
      </h3>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[19rem] border-collapse text-left">
          <thead>
            <tr className="text-[0.625rem] tracking-wide text-stone-500 uppercase">
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                Model said
              </th>
              {CHOICES.map((choice) => (
                <th key={choice} scope="col" className="py-1.5 pr-2 text-right font-semibold">
                  {DID[choice]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.model} className="border-t border-stone-200">
                <th scope="row" className="w-24 py-2 pr-3 text-left">
                  <span className="block text-sm font-bold tracking-wide text-stone-900 uppercase">
                    {CHOICE_VERB[row.model]}
                  </span>
                  <span className="tnum block text-[0.625rem] font-normal text-stone-400">
                    {row.total} {row.total === 1 ? 'time' : 'times'}
                  </span>
                </th>
                {CHOICES.map((choice) => (
                  <Cell
                    key={choice}
                    count={row.counts[choice]}
                    total={row.total}
                    agreed={choice === row.model}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[0.6875rem] text-stone-400">
        Shaded cells are agreement. Share is of the row.
      </p>
    </section>
  )
}

function Cell({ count, total, agreed }: { count: number; total: number; agreed: boolean }) {
  const share = total > 0 ? count / total : 0
  return (
    <td className="py-1 pr-2 align-middle">
      <div
        className={`relative flex h-11 items-center justify-end overflow-hidden rounded-sm px-2 ${
          agreed ? 'bg-stone-100 ring-1 ring-stone-300 ring-inset' : 'bg-stone-50'
        }`}
      >
        <div
          aria-hidden
          className={`absolute inset-y-0 left-0 ${agreed ? 'bg-stone-300' : 'bg-stone-200'}`}
          style={{ width: `${share * 100}%` }}
        />
        <span className="tnum relative text-right leading-tight">
          <span
            className={`block text-base font-bold ${count === 0 ? 'text-stone-300' : 'text-stone-900'}`}
          >
            {count}
          </span>
          {total > 0 && count > 0 && (
            <span className="block text-[0.625rem] text-stone-500">{pct(share)}</span>
          )}
        </span>
      </div>
    </td>
  )
}
