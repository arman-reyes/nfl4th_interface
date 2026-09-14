import { FORMAT_LABEL } from '../../lib/garbageTime'
import type { Format } from '../../lib/garbageTime'
import {
  farCut,
  mean,
  playerCut,
  pointsPerGame,
  POSITIONS,
  rowPoints,
  se,
  signedText,
  statPerGame,
  tripsCut,
} from '../../lib/travel'
import type { PlayerSplit, TravelAggregate } from '../../lib/travel'
import type { FantasyPos, TravelStatKey } from '../../types'
import { Segmented } from '../garbage/Segmented'
import { TeamPill } from '../TeamPill'
import { signTone } from './signTone'

export type PlayerSortKey = 'total' | 'home' | 'away' | 'delta' | 'far'

interface Props {
  agg: TravelAggregate
  pos: FantasyPos
  format: Format
  threshold: number
  sort: PlayerSortKey
  onPos: (pos: FantasyPos) => void
  onFormat: (format: Format) => void
  onSort: (key: PlayerSortKey) => void
}

const HEAD =
  'text-[0.625rem] font-bold tracking-[0.14em] text-stone-500 uppercase whitespace-nowrap'

/** Fewer games than this and a home/away split is two coin flips. */
const MIN_GAMES = 8

/** The one counting stat shown beside the points, per position. */
const KEY_STAT: Record<FantasyPos, { key: TravelStatKey; label: string }> = {
  QB: { key: 'pass_yds', label: 'Pass yds / g' },
  RB: { key: 'rush_yds', label: 'Rush yds / g' },
  WR: { key: 'rec_yds', label: 'Rec yds / g' },
  TE: { key: 'rec_yds', label: 'Rec yds / g' },
}

interface Row {
  player: PlayerSplit
  total: number
  homeN: number
  awayN: number
  home: number | null
  away: number | null
  delta: number | null
  far: number | null
  farN: number
  statHome: number | null
  statAway: number | null
}

function rowOf(player: PlayerSplit, format: Format, threshold: number, stat: TravelStatKey): Row {
  const cut = playerCut(player, threshold)
  const home = pointsPerGame(cut.home, format)
  const away = pointsPerGame(cut.away, format)
  return {
    player,
    total: player.bins.reduce((sum, cell) => sum + rowPoints(cell.sums, format), 0),
    homeN: cut.home.n,
    awayN: cut.away.n,
    home,
    away,
    delta: home === null || away === null ? null : away - home,
    far: pointsPerGame(cut.far, format),
    farN: cut.far.n,
    statHome: statPerGame(cut.home, stat),
    statAway: statPerGame(cut.away, stat),
  }
}

const last = (v: number | null) => (v === null ? Number.NEGATIVE_INFINITY : v)

const SORTS: Record<PlayerSortKey, (a: Row, b: Row) => number> = {
  total: (a, b) => b.total - a.total,
  home: (a, b) => last(b.home) - last(a.home),
  away: (a, b) => last(b.away) - last(a.away),
  // Most negative first: the players who leave the most at home.
  delta: (a, b) => (a.delta === null ? 1 : b.delta === null ? -1 : a.delta - b.delta),
  far: (a, b) => last(b.far) - last(a.far),
}

const COLUMNS: { key: PlayerSortKey; label: string; long: string }[] = [
  { key: 'total', label: 'Points', long: 'Total points' },
  { key: 'home', label: 'Home / g', long: 'Points per game at home' },
  { key: 'away', label: 'Away / g', long: 'Points per game away' },
  { key: 'delta', label: 'Away − Home', long: 'Away minus home, per game' },
  { key: 'far', label: 'Far / g', long: 'Points per game on far trips' },
]

const num = (v: number | null, digits = 1) => (v === null ? '—' : v.toFixed(digits))
const signed = (v: number | null, digits = 1) => (v === null ? '—' : signedText(v, digits))

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-stone-400">—</span>
  const tone = signTone(Math.round(value * 10))
  return (
    <span
      className={tone.color ? 'font-semibold' : 'text-stone-400'}
      style={tone.color ? { color: tone.color } : undefined}
      aria-label={tone.label}
    >
      {tone.arrow} {Math.abs(value).toFixed(1)}
    </span>
  )
}

/**
 * What the whole position did, above the players who make it up.
 *
 * Per-game means over every player-game at the position, with the error, so
 * a reader can see whether the position moved before asking whether one
 * player did — a single player's split is a handful of games either way.
 */
function PositionLine({
  agg,
  pos,
  format,
  threshold,
}: {
  agg: TravelAggregate
  pos: FantasyPos
  format: Format
  threshold: number
}) {
  const cells = agg.byPosition[pos].distance[format]
  const parts = [
    { label: 'home', cell: cells[0] },
    { label: 'away', cell: tripsCut(cells) },
    { label: `${threshold.toLocaleString('en-US')}+ mi`, cell: farCut(cells, threshold) },
  ]
  return (
    <p className="tnum text-[0.6875rem] leading-relaxed text-stone-600">
      <span className="font-semibold text-stone-900">Every {pos} game:</span>{' '}
      {parts.map((p, i) => {
        const m = mean(p.cell)
        const err = se(p.cell)
        return (
          <span key={p.label}>
            {i > 0 && ' · '}
            {p.label}{' '}
            <span className="font-semibold text-stone-900">{num(m)}</span>
            {err !== null && <span className="text-stone-400"> ±{err.toFixed(2)}</span>}
            <span className="text-stone-400"> ({p.cell.n.toLocaleString('en-US')})</span>
          </span>
        )
      })}{' '}
      points per game, {FORMAT_LABEL[format]} scoring.
    </p>
  )
}

/**
 * Players: the same home/away split, one man at a time.
 *
 * The far column is the one the page is about, but it sits last because its
 * counts are small — a receiver makes three or four far trips a season — and
 * the reader should meet the home and away numbers, with their larger
 * counts, first.
 */
export function PlayerTravelTable({
  agg,
  pos,
  format,
  threshold,
  sort,
  onPos,
  onFormat,
  onSort,
}: Props) {
  const stat = KEY_STAT[pos]
  const rows = agg.players
    .filter((p) => p.pos === pos)
    .map((p) => rowOf(p, format, threshold, stat.key))
    .filter((row) => row.homeN + row.awayN >= MIN_GAMES && row.homeN > 0 && row.awayN > 0)
    .sort(SORTS[sort])
  const farLabel = `${threshold.toLocaleString('en-US')}+ mi`

  return (
    <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
      <div className="border-b border-stone-200 bg-stone-50 px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">Players</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Segmented
              label="Position"
              value={pos}
              options={POSITIONS.map((p) => ({ value: p, label: p }))}
              onChange={onPos}
            />
            <Segmented
              label="Scoring format"
              value={format}
              options={(['standard', 'half', 'ppr'] as Format[]).map((f) => ({
                value: f,
                label: FORMAT_LABEL[f],
              }))}
              onChange={onFormat}
            />
          </div>
        </div>
        <div className="mt-2">
          <PositionLine agg={agg} pos={pos} format={format} threshold={threshold} />
        </div>
        <div className="mt-2 flex items-center gap-2 sm:hidden">
          <label htmlFor="player-sort" className={HEAD}>
            Sort by
          </label>
          <select
            id="player-sort"
            value={sort}
            onChange={(event) => onSort(event.target.value as PlayerSortKey)}
            className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm font-semibold text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
          >
            {COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.long}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 && (
        <p className="px-3 py-8 text-center text-sm text-stone-500">
          No {pos} with {MIN_GAMES} games and at least one at home and one away.
        </p>
      )}

      <ul className="sm:hidden">
        {rows.map((row) => (
          <li key={row.player.id} className="border-b border-stone-100 px-3 py-3 last:border-b-0">
            <div className="flex items-center gap-2">
              <TeamPill abbr={row.player.team} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-900">
                {row.player.name}
              </span>
              <span className="tnum text-[0.6875rem] text-stone-400">
                {row.homeN}H / {row.awayN}A
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[
                { label: 'Home / g', value: num(row.home) },
                { label: 'Away / g', value: num(row.away) },
              ].map((cell) => (
                <span key={cell.label} className="block">
                  <span className={HEAD}>{cell.label}</span>
                  <span className="tnum block text-sm text-stone-700">{cell.value}</span>
                </span>
              ))}
              <span className="block">
                <span className={HEAD}>Δ</span>
                <span className="tnum block text-sm">
                  <Delta value={row.delta} />
                </span>
              </span>
              <span className="block">
                <span className={HEAD}>Far / g</span>
                <span className="tnum block text-sm text-stone-700">
                  {num(row.far)} <span className="text-stone-400">({row.farN})</span>
                </span>
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className={`${HEAD} px-3 py-2 text-left`}>Player</th>
              <th className={`${HEAD} px-2 py-2 text-right`} title="Games at home / away">
                G (H / A)
              </th>
              {COLUMNS.map((column) => (
                <th key={column.key} className={`${HEAD} px-2 py-2 text-right`} title={column.long}>
                  <button
                    onClick={() => onSort(column.key)}
                    aria-pressed={sort === column.key}
                    className={`focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none ${
                      sort === column.key
                        ? 'text-stone-900 underline underline-offset-4'
                        : 'hover:text-stone-900'
                    }`}
                  >
                    {column.key === 'far' ? `${farLabel} / g` : column.label}
                  </button>
                </th>
              ))}
              <th className={`${HEAD} px-2 py-2 text-right`} title={`${stat.label}, home → away`}>
                {stat.label} H → A
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.player.id} className="border-b border-stone-100 hover:bg-stone-50">
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <TeamPill abbr={row.player.team} />
                    <span className="truncate font-semibold text-stone-900">{row.player.name}</span>
                    {row.player.seasons > 1 && (
                      <span className="tnum text-[0.6875rem] text-stone-400">
                        {row.player.seasons} seasons
                      </span>
                    )}
                  </span>
                </td>
                <td className="tnum px-2 py-2 text-right whitespace-nowrap text-stone-500">
                  {row.homeN} / {row.awayN}
                </td>
                <td className="tnum px-2 py-2 text-right text-stone-600">{row.total.toFixed(0)}</td>
                <td className="tnum px-2 py-2 text-right text-stone-700">{num(row.home)}</td>
                <td className="tnum px-2 py-2 text-right text-stone-700">{num(row.away)}</td>
                <td className="tnum px-2 py-2 text-right">
                  <Delta value={row.delta} />
                </td>
                <td className="tnum px-2 py-2 text-right whitespace-nowrap text-stone-700">
                  {num(row.far)}{' '}
                  <span className="text-[0.6875rem] text-stone-400">n={row.farN}</span>
                </td>
                <td className="tnum px-2 py-2 text-right whitespace-nowrap text-stone-600">
                  {num(row.statHome, 0)} → {num(row.statAway, 0)}{' '}
                  <span className="text-[0.6875rem] text-stone-400">
                    {row.statHome !== null && row.statAway !== null
                      ? signed(row.statAway - row.statHome, 0)
                      : ''}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
