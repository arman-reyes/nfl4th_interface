import { removedBins, totals } from '../../lib/garbageTime'
import type { PlayerRow, Removals } from '../../lib/garbageTime'
import type { GarbageTimeFile } from '../../types'
import { StatSplitTable } from './StatSplitTable'
import { POSITION_LINES } from './statLines'

interface Props {
  row: PlayerRow
  file: GarbageTimeFile
  threshold: number
  remove: Removals
  /** Where the player's team ranks in the league for garbage-time exposure. */
  teamRank: number
}

function ordinal(n: number): string {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/**
 * One player opened up: which counting stats the removals took, and how much of
 * that was his team's situation rather than his own.
 *
 * There is deliberately no chart of the three bands here. The row that opened
 * this panel already draws them — as a stacked bar in the table, as a labelled
 * bar on a card — so a donut underneath would be the same split a second time,
 * a few pixels below the first. What a reader cannot get from that row is which
 * catches and yards and touchdowns the removals actually took, which is what
 * this panel is for.
 *
 * The team-context line sits beside the table on a wide screen rather than
 * under it, so the table keeps a readable measure instead of stretching its
 * four number columns across the page.
 */
// No `format` here: the panel shows counting stats, which are the same whatever
// a reception is worth, and the per-game points were already scored upstream.
export function PlayerDetail({ row, file, threshold, remove, teamRank }: Props) {
  const gone = removedBins(file.bins, threshold, remove)
  const all = totals(row.player.bins)
  const kept = totals(row.player.bins, gone)

  return (
    <div className="border-t border-stone-200 bg-stone-50 px-3 py-4 sm:px-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-8">
        <div>
          <h4 className="text-[0.625rem] font-bold tracking-[0.14em] text-stone-500 uppercase">
            Actual and remaining
          </h4>
          <div className="mt-2">
            <StatSplitTable
              all={all}
              kept={kept}
              lines={POSITION_LINES[row.player.pos]}
              perGame={{
                label: 'Per game',
                actual: row.actualPerGame,
                remaining: row.remainingPerGame,
              }}
            />
          </div>
        </div>

        <p className="text-[0.6875rem] leading-relaxed text-stone-600 lg:self-center">
          <span className="tnum font-semibold text-stone-900">
            {row.player.team} ran {(row.teamGarbageRate * 100).toFixed(1)}% of its offensive plays
            in garbage time
          </span>{' '}
          — {ordinal(teamRank)} most in the league.{' '}
          {row.usageLift >= 1.25 ? (
            <>
              He was there for{' '}
              <span className="tnum font-semibold">{row.usageLift.toFixed(1)}×</span> his
              team&rsquo;s share of it, so this is about how he was used, not only who he played
              for.
            </>
          ) : row.usageLift <= 0.8 ? (
            <>
              He saw <span className="tnum font-semibold">{row.usageLift.toFixed(1)}×</span> his
              team&rsquo;s share of it — less garbage time than his own offense played.
            </>
          ) : (
            <>
              He took roughly his team&rsquo;s share of it, so a large cut here is largely the
              situation he was in rather than a verdict on him.
            </>
          )}
        </p>
      </div>
    </div>
  )
}
