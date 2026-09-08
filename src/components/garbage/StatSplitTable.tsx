import { emptyTotals, STAT_ORDER } from '../../lib/garbageTime'
import type { Totals } from '../../lib/garbageTime'
import type { StatLineSpec } from './statLines'

interface Props {
  all: Totals
  kept: Totals
  lines: StatLineSpec[]
  /** Optional footer comparing per-game rates. */
  perGame?: { label: string; actual: number; remaining: number }
}

/**
 * Counting stats, actual against what survives the removals.
 *
 * Shared by a player row and a whole offense, because the two are packed the
 * same way and the question is the same one at both scales.
 */
export function StatSplitTable({ all, kept, lines, perGame }: Props) {
  const cut = emptyTotals()
  for (const k of STAT_ORDER) cut[k] = all[k] - kept[k]

  return (
    <table className="w-full text-[0.6875rem]">
      <thead>
        <tr className="text-stone-400">
          <th className="pb-1 text-left font-semibold"> </th>
          <th className="pb-1 text-right font-semibold">All</th>
          <th className="pb-1 text-right font-semibold">Remaining</th>
          <th className="pb-1 text-right font-semibold">Removed</th>
        </tr>
      </thead>
      <tbody className="tnum">
        {lines.map(({ key, label }) => (
          <tr key={key} className="border-t border-stone-200">
            <td className="py-1 text-stone-600">{label}</td>
            <td className="py-1 text-right font-medium text-stone-900">{all[key]}</td>
            <td className="py-1 text-right text-stone-600">{kept[key]}</td>
            <td className="py-1 text-right text-amber-700">
              {cut[key] === 0 ? '—' : `−${cut[key]}`}
            </td>
          </tr>
        ))}
        {perGame && (
          <tr className="border-t border-stone-300 font-semibold">
            <td className="py-1 text-stone-900">{perGame.label}</td>
            <td className="py-1 text-right text-stone-900">{perGame.actual.toFixed(1)}</td>
            <td className="py-1 text-right text-stone-600">{perGame.remaining.toFixed(1)}</td>
            <td className="py-1 text-right text-amber-700">
              −{(perGame.actual - perGame.remaining).toFixed(1)}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
