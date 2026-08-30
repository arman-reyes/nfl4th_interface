import { useMemo } from 'react'
import type { Play, TeamMeta } from '../types'
import { groupByGame, playKey, weekLongLabel } from '../lib/filters'
import { PlayRow } from './PlayRow'
import { TeamPill } from './TeamPill'

interface Props {
  plays: Play[]
  team: TeamMeta
  selectedKey: string | null
  onSelect: (play: Play) => void
}

/**
 * Every 4th down in the current filter, grouped by game. One tap opens the
 * comparison.
 */
export function PlayList({ plays, team, selectedKey, onSelect }: Props) {
  const games = useMemo(() => groupByGame(plays), [plays])

  if (plays.length === 0) {
    return <p className="px-1 py-6 text-sm text-stone-500">No 4th downs match this filter.</p>
  }

  return (
    <>
      <Legend />
      <ul className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        {games.map((game) => (
        <li key={game.gameId}>
          <h3 className="flex items-center gap-2 border-y border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-600 first:border-t-0">
            {weekLongLabel(game.week)}
            <span className="text-stone-400">vs</span>
            <TeamPill abbr={game.opponent} />
            <span className="ml-auto font-normal text-stone-400">
              {game.plays.length} 4th {game.plays.length === 1 ? 'down' : 'downs'}
            </span>
          </h3>
          <ul className="divide-y divide-stone-100">
            {game.plays.map((play) => {
              const key = playKey(play)
              return (
                <li key={key}>
                  <PlayRow
                    play={play}
                    team={team}
                    selected={key === selectedKey}
                    onSelect={() => onSelect(play)}
                  />
                </li>
              )
            })}
          </ul>
        </li>
        ))}
      </ul>
    </>
  )
}

/** What the right-hand column of each row is saying. */
function Legend() {
  return (
    <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[0.6875rem] text-stone-500">
      <span className="flex items-center gap-1">
        <span className="font-semibold text-stone-400">✓</span> agreed
      </span>
      <span className="flex items-center gap-1">
        <Swatch className="bg-amber-600" /> cost, 1 to 3 segments
      </span>
      <span className="flex items-center gap-1">
        <Swatch className="bg-stone-400" /> game already decided
      </span>
    </p>
  )
}

function Swatch({ className }: { className: string }) {
  return <span aria-hidden className={`h-1.5 w-2.5 rounded-xs ${className}`} />
}
