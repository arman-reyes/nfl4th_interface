import { farCut, mean, perSeason, se, signedText } from '../../lib/travel'
import type { TeamSplit, TravelAggregate } from '../../lib/travel'
import { TeamPill } from '../TeamPill'
import { signTone } from './signTone'

export type TeamSortKey = 'gap' | 'miles' | 'home' | 'away' | 'homeLine' | 'far'

interface Props {
  agg: TravelAggregate
  threshold: number
  sort: TeamSortKey
  onSort: (key: TeamSortKey) => void
}

const HEAD =
  'text-[0.625rem] font-bold tracking-[0.14em] text-stone-500 uppercase whitespace-nowrap'

interface Row {
  team: TeamSplit
  seasons: number
  miles: number
  tz: number
  homeWin: number | null
  homeMargin: number | null
  awayWin: number | null
  awayMargin: number | null
  /** Away margin minus home margin: how much the team's own home edge is worth. */
  gap: number | null
  /** Home margin against the line: whether the stadium beats the market. */
  homeVsLine: number | null
  homeVsLineSe: number | null
  farVsLine: number | null
  farSe: number | null
  farN: number
}

function rowOf(team: TeamSplit, threshold: number): Row {
  const p = perSeason(team)
  const homeMargin = mean(team.site.home.margin)
  const awayMargin = mean(team.site.away.margin)
  const far = farCut(team.distance.vs_line, threshold)
  return {
    team,
    seasons: team.seasons,
    miles: p.miles,
    tz: p.tz,
    homeWin: mean(team.site.home.win),
    homeMargin,
    awayWin: mean(team.site.away.win),
    awayMargin,
    gap: homeMargin === null || awayMargin === null ? null : awayMargin - homeMargin,
    homeVsLine: mean(team.site.home.vs_line),
    homeVsLineSe: se(team.site.home.vs_line),
    farVsLine: mean(far),
    farSe: se(far),
    farN: far.n,
  }
}

/** Nulls sort last whichever way the column runs. */
const last = (v: number | null) => (v === null ? Number.NEGATIVE_INFINITY : v)

const SORTS: Record<TeamSortKey, (a: Row, b: Row) => number> = {
  // Most negative first: the teams that lose the most by leaving home.
  gap: (a, b) => (a.gap === null ? 1 : b.gap === null ? -1 : a.gap - b.gap),
  miles: (a, b) => b.miles - a.miles,
  home: (a, b) => last(b.homeMargin) - last(a.homeMargin),
  away: (a, b) => last(b.awayMargin) - last(a.awayMargin),
  homeLine: (a, b) => last(b.homeVsLine) - last(a.homeVsLine),
  far: (a, b) => last(b.farVsLine) - last(a.farVsLine),
}

const COLUMNS: { key: TeamSortKey; label: string; long: string }[] = [
  { key: 'miles', label: 'Mi / season', long: 'Miles travelled per season' },
  { key: 'home', label: 'Home', long: 'Home margin' },
  { key: 'away', label: 'Away', long: 'Away margin' },
  { key: 'gap', label: 'Away − Home', long: 'Away margin minus home margin' },
  { key: 'homeLine', label: 'Home vs Line', long: 'Home margin vs. line' },
  { key: 'far', label: 'Far vs Line', long: 'Far trips, margin vs. line' },
]

const signed = (v: number | null, digits = 1) => (v === null ? '—' : signedText(v, digits))
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(0)}%`)

function Signed({ value, digits = 1 }: { value: number | null; digits?: number }) {
  if (value === null) return <span className="text-stone-400">—</span>
  const tone = signTone(Math.round(value * 10 ** digits))
  return (
    <span style={tone.color ? { color: tone.color } : undefined} aria-label={tone.label}>
      {signed(value, digits)}
    </span>
  )
}

/**
 * The 32 teams: how far each travels and what it gets for staying home.
 *
 * Home and away here follow the schedule's own designation rather than the
 * distance bins, because a team's home and road records are the split a
 * reader already knows and will check the table against. The far column uses
 * the distance cut, like everything else on the page.
 */
export function TeamTravelTable({ agg, threshold, sort, onSort }: Props) {
  const rows = agg.byTeam.map((t) => rowOf(t, threshold)).sort(SORTS[sort])
  const farLabel = `${threshold.toLocaleString('en-US')}+ mi`

  return (
    <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
      <div className="border-b border-stone-200 bg-stone-50">
        <div className="px-3 pt-2 sm:px-4">
          <h2 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">Teams</h2>
          <p className="mt-0.5 text-[0.625rem] text-stone-400">
            Average margin at home and away by the schedule&rsquo;s designation; then against the
            line at home — whether the stadium beats the market — and on trips of {farLabel}.
            Miles are per season, from the team&rsquo;s home stadium that year.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 sm:hidden">
          <label htmlFor="team-sort" className={HEAD}>
            Sort by
          </label>
          <select
            id="team-sort"
            value={sort}
            onChange={(event) => onSort(event.target.value as TeamSortKey)}
            className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm font-semibold text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
          >
            {COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.long}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden pb-2 sm:block" />
      </div>

      <ul className="sm:hidden">
        {rows.map((row) => (
          <li key={row.team.team} className="border-b border-stone-100 px-3 py-3 last:border-b-0">
            <div className="flex items-center gap-2">
              <TeamPill abbr={row.team.team} size="md" />
              <span className="tnum text-[0.6875rem] text-stone-500">
                {Math.round(row.miles).toLocaleString('en-US')} mi / season · {row.tz.toFixed(1)}{' '}
                zones / trip
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <span className="block">
                <span className={HEAD}>Home</span>
                <span className="tnum block text-sm text-stone-700">
                  {signed(row.homeMargin)} <span className="text-stone-400">{pct(row.homeWin)}</span>
                </span>
              </span>
              <span className="block">
                <span className={HEAD}>Away</span>
                <span className="tnum block text-sm text-stone-700">
                  {signed(row.awayMargin)} <span className="text-stone-400">{pct(row.awayWin)}</span>
                </span>
              </span>
              <span className="block">
                <span className={HEAD}>{farLabel} vs line</span>
                <span className="tnum block text-sm text-stone-700">
                  <Signed value={row.farVsLine} />{' '}
                  <span className="text-stone-400">n={row.farN}</span>
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
              <th className={`${HEAD} px-3 py-2 text-left`}>Team</th>
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
                    {column.key === 'far' ? `${farLabel} vs Line` : column.label}
                  </button>
                </th>
              ))}
              <th className={`${HEAD} px-2 py-2 text-right`} title="Time zones crossed per trip">
                Zones / trip
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.team.team} className="border-b border-stone-100 hover:bg-stone-50">
                <td className="px-3 py-2">
                  <TeamPill abbr={row.team.team} />
                </td>
                <td className="tnum px-2 py-2 text-right text-stone-700">
                  {Math.round(row.miles).toLocaleString('en-US')}
                </td>
                <td className="tnum px-2 py-2 text-right whitespace-nowrap text-stone-700">
                  {signed(row.homeMargin)}{' '}
                  <span className="text-[0.6875rem] text-stone-400">{pct(row.homeWin)}</span>
                </td>
                <td className="tnum px-2 py-2 text-right whitespace-nowrap text-stone-700">
                  {signed(row.awayMargin)}{' '}
                  <span className="text-[0.6875rem] text-stone-400">{pct(row.awayWin)}</span>
                </td>
                <td className="tnum px-2 py-2 text-right font-semibold">
                  <Signed value={row.gap} />
                </td>
                <td
                  className="tnum px-2 py-2 text-right whitespace-nowrap text-stone-700"
                  title={
                    row.homeVsLineSe === null
                      ? undefined
                      : `${signed(row.homeVsLine)} ± ${row.homeVsLineSe.toFixed(1)} at home`
                  }
                >
                  <Signed value={row.homeVsLine} />
                </td>
                <td
                  className="tnum px-2 py-2 text-right whitespace-nowrap text-stone-700"
                  title={
                    row.farSe === null
                      ? `${row.farN} far trips`
                      : `${signed(row.farVsLine)} ± ${row.farSe.toFixed(1)} over ${row.farN} far trips`
                  }
                >
                  <Signed value={row.farVsLine} />{' '}
                  <span className="text-[0.6875rem] text-stone-400">n={row.farN}</span>
                </td>
                <td className="tnum px-2 py-2 text-right text-stone-500">{row.tz.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
