import { removedBins, totals } from '../../lib/garbageTime'
import type { Band, Format, PlayerRow, Removals } from '../../lib/garbageTime'
import type { GarbageTimeFile, TeamAbbr } from '../../types'
import { StatSplitTable } from './StatSplitTable'
import { POSITION_LINES } from './statLines'
import { PlayerBands } from './PlayerBands'

interface Props {
  row: PlayerRow
  file: GarbageTimeFile
  format: Format
  threshold: number
  remove: Removals
  /** Each team's share of its own snaps in each band. */
  teamShares: Map<TeamAbbr, Record<Band, number>>
}

/**
 * One player opened up: which counting stats the removals took, and how he was
 * used in each state of the game.
 *
 * There is deliberately no chart of the three bands here. The row that opened
 * this panel already draws them — as a stacked bar in the table, as a labelled
 * bar on a card — so a donut underneath would be the same split a second time,
 * a few pixels below the first. What a reader cannot get from that row is which
 * catches and yards and touchdowns the removals took, and what his season was
 * actually worth in each state of the game — the bar gives three shares, but a
 * share cannot say whether a third of a season is seventy points or seven.
 */
export function PlayerDetail({
  row,
  file,
  format,
  threshold,
  remove,
  teamShares,
}: Props) {
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

        <PlayerBands
          player={row.player}
          file={file}
          format={format}
          threshold={threshold}
          teamShares={teamShares}
        />
      </div>
    </div>
  )
}
