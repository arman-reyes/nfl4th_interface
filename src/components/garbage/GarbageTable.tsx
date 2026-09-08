import { Fragment } from 'react'
import { BANDS, PPR, splitByBand } from '../../lib/garbageTime'
import type { Format, PlayerRow, Removals } from '../../lib/garbageTime'
import type { GarbageTimeFile, TeamAbbr } from '../../types'
import { TeamPill } from '../TeamPill'
import { PlayerDetail } from './PlayerDetail'
import { BandBreakdown } from './BandBreakdown'
import { BAND_STYLE } from './bandStyle'
import { rankTone } from './rankTone'

export type SortKey = 'actual' | 'remaining' | 'delta' | 'share'

interface Props {
  rows: PlayerRow[]
  file: GarbageTimeFile
  format: Format
  threshold: number
  remove: Removals
  sort: SortKey
  openId: string | null
  teamRanks: Map<TeamAbbr, number>
  onSort: (key: SortKey) => void
  onOpen: (id: string | null) => void
}

const HEAD =
  'text-[0.625rem] font-bold tracking-[0.14em] text-stone-500 uppercase whitespace-nowrap'

/**
 * Numbers align right so their digits line up down the column. The breakdown is
 * centred instead, because it is a bar with a flank on each side rather than a
 * value — right-aligning it would push the whole assembly off its own heading.
 */
const COLUMNS: { key: SortKey; label: string; align: 'right' | 'center' }[] = [
  { key: 'remaining', label: 'Remaining', align: 'right' },
  { key: 'actual', label: 'Actual', align: 'right' },
  { key: 'delta', label: 'Δ Rank', align: 'right' },
  { key: 'share', label: 'Points Breakdown', align: 'center' },
]

/**
 * Fuller names for the phone's sort control.
 *
 * A column header can be terse because it sits above its own numbers; the same
 * words in a dropdown, with nothing under them, cannot. "Points from" means
 * nothing on its own.
 */
const SORT_LABEL: Record<SortKey, string> = {
  remaining: 'Remaining points',
  actual: 'Actual points',
  delta: 'Rank change',
  share: 'Garbage-time share',
}

function Delta({ value }: { value: number }) {
  const tone = rankTone(value)
  if (value === 0) {
    return (
      <span className="text-stone-400" aria-label={tone.label}>
        {tone.arrow}
      </span>
    )
  }
  return (
    <span className="font-semibold" style={{ color: tone.color }} aria-label={tone.label}>
      {tone.arrow} {Math.abs(value)}
    </span>
  )
}

/**
 * One legend for the whole table, so no row has to carry a colour key.
 *
 * Table only: a card labels each band beside its own number, so repeating the
 * key above them would say the same thing twice.
 */
function BandLegend() {
  return (
    <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[0.625rem] text-stone-500 sm:flex sm:px-4">
      <span className="font-bold tracking-[0.14em] uppercase">Points Breakdown</span>
      {BANDS.map((band) => (
        <span key={band} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-2 rounded-xs"
            style={{ background: BAND_STYLE[band].color }}
          />
          {BAND_STYLE[band].label}
        </span>
      ))}
      <span className="text-stone-400">
        — in that order, with the two garbage shares either side of each bar
      </span>
    </div>
  )
}

/**
 * The ranking, twice over: what a player scored and what survives the removals,
 * with the distance between the two ranks.
 *
 * Two layouts rather than one that bends. Seven columns of numbers cannot be
 * shrunk to a phone and stay legible, and scrolling a table sideways takes the
 * player's name off screen — the one column that says whose row it is. Below
 * `sm` each player is a card where every number keeps its label, which matters
 * most here because Remaining, Actual and Δ Rank are easy to confuse. Above it
 * the table returns, still scrollable for the widths in between.
 */
export function GarbageTable({
  rows,
  file,
  format,
  threshold,
  remove,
  sort,
  openId,
  teamRanks,
  onSort,
  onOpen,
}: Props) {
  const bandsOf = (row: PlayerRow) =>
    splitByBand(row.player.bins, file.bins, threshold, PPR[format])

  /**
   * The rank shown against a row follows whichever ranking is being sorted on.
   *
   * Pinning it to the actual rank meant that sorting by Remaining printed a
   * scrambled column — 3, 1, 7, 2 — which reads as a bug rather than as a
   * deliberate second ranking. Sorting by rank change or garbage share is a
   * deliberate reordering of a ranking, so those keep the actual rank.
   */
  const rankOf = (row: PlayerRow) => (sort === 'remaining' ? row.remainingRank : row.actualRank)
  const rankHead = sort === 'remaining' ? 'Rank on remaining points' : 'Rank on actual points'

  const detailFor = (row: PlayerRow) => (
    <PlayerDetail
      row={row}
      file={file}
      threshold={threshold}
      remove={remove}
      teamRank={teamRanks.get(row.player.team) ?? 32}
    />
  )

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white shadow-xs">
        <p className="px-3 py-8 text-center text-sm text-stone-500">No players at this position.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
      <div className="border-b border-stone-200 bg-stone-50">
        {/* The table sorts from its column headers, which a card list has none
            of — so the phone gets its own control rather than losing the
            ability to sort at all. */}
        <div className="flex items-center gap-2 px-3 py-2 sm:hidden">
          <label
            htmlFor="gt-sort"
            className="text-[0.625rem] font-bold tracking-[0.14em] text-stone-500 uppercase"
          >
            Sort by
          </label>
          <select
            id="gt-sort"
            value={sort}
            onChange={(event) => onSort(event.target.value as SortKey)}
            className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm font-semibold text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
          >
            {COLUMNS.map((column) => (
              <option key={column.key} value={column.key}>
                {SORT_LABEL[column.key]}
              </option>
            ))}
          </select>
        </div>
        <BandLegend />
      </div>

      {/* Phones: one card per player, every number labelled. */}
      <ul className="sm:hidden">
        {rows.map((row) => {
          const open = openId === row.player.id
          return (
            <li key={row.player.id} className="border-b border-stone-100 last:border-b-0">
              <button
                onClick={() => onOpen(open ? null : row.player.id)}
                aria-expanded={open}
                className={`w-full px-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-900 focus-visible:outline-none ${
                  open ? 'bg-stone-50' : ''
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    title={rankHead}
                    className="tnum w-6 shrink-0 text-xs font-semibold text-stone-400"
                  >
                    {rankOf(row)}
                  </span>
                  <TeamPill abbr={row.player.team} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-900">
                    {row.player.name}
                  </span>
                </span>

                <span className="mt-2.5 grid grid-cols-3 gap-2 pl-8">
                  {[
                    { label: 'Remaining', value: row.remaining.toFixed(1), strong: true },
                    { label: 'Actual', value: row.actual.toFixed(1), strong: false },
                  ].map((cell) => (
                    <span key={cell.label} className="block">
                      <span className={HEAD}>{cell.label}</span>
                      <span
                        className={`tnum block text-sm ${
                          cell.strong ? 'font-semibold text-stone-900' : 'text-stone-600'
                        }`}
                      >
                        {cell.value}
                      </span>
                    </span>
                  ))}
                  <span className="block">
                    <span className={HEAD}>Δ Rank</span>
                    <span className="tnum block text-sm">
                      <Delta value={row.rankDelta} />
                    </span>
                  </span>
                </span>

                <span className="mt-3 block pl-8">
                  <BandBreakdown split={bandsOf(row)} total={row.actual} stacked />
                </span>
              </button>
              {open && detailFor(row)}
            </li>
          )
        })}
      </ul>

      {/* Everything else: the table, scrollable at the awkward widths. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className={`${HEAD} px-3 py-2 text-right`} title={rankHead}>
                #
              </th>
              <th className={`${HEAD} px-2 py-2 text-left`}>Player</th>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className={`${HEAD} px-2 py-2 ${
                    column.align === 'center' ? 'text-center' : 'text-right'
                  }`}
                >
                  <button
                    onClick={() => onSort(column.key)}
                    aria-pressed={sort === column.key}
                    className={`focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none ${
                      sort === column.key
                        ? 'text-stone-900 underline underline-offset-4'
                        : 'hover:text-stone-900'
                    }`}
                  >
                    {column.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const open = openId === row.player.id
              return (
                <Fragment key={row.player.id}>
                  <tr
                    className={`cursor-pointer border-b border-stone-100 transition-colors ${
                      open ? 'bg-stone-50' : 'hover:bg-stone-50'
                    }`}
                    onClick={() => onOpen(open ? null : row.player.id)}
                  >
                    <td className="tnum px-3 py-2 text-right text-xs font-semibold text-stone-400">
                      {rankOf(row)}
                    </td>
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-2">
                        <TeamPill abbr={row.player.team} />
                        <span className="truncate font-semibold text-stone-900">
                          {row.player.name}
                        </span>
                      </span>
                    </td>
                    <td className="tnum px-2 py-2 text-right font-semibold text-stone-900">
                      {row.remaining.toFixed(1)}
                    </td>
                    <td className="tnum px-2 py-2 text-right text-stone-600">
                      {row.actual.toFixed(1)}
                    </td>
                    <td className="tnum px-2 py-2 text-right">
                      <Delta value={row.rankDelta} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <BandBreakdown split={bandsOf(row)} total={row.actual} />
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        {detailFor(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
