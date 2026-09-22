import { useMemo } from 'react'
import type { Situation } from '../types'
import { groupByGame, playKey, weekLongLabel } from '../lib/filters'
import type { GameResult } from '../lib/filters'
import { TeamPill } from './TeamPill'

interface Props<P extends Situation> {
  plays: P[]
  selectedKey: string | null
  onSelect: (play: P) => void
  /** What a play is called on this page, singular and plural: "4th down". */
  noun: [string, string]
  /** One row. The list owns the grouping and the selection; the row owns its content. */
  row: (play: P, selected: boolean, onSelect: () => void) => React.ReactNode
}

/**
 * Every decision in the current filter, grouped by game. One tap opens the
 * comparison. The list is the same for a 4th down and a try; only the row is
 * different, so the row comes in as a render function.
 */
export function PlayList<P extends Situation>({ plays, selectedKey, onSelect, noun, row }: Props<P>) {
  const games = useMemo(() => groupByGame(plays), [plays])

  if (plays.length === 0) {
    return <p className="px-1 py-6 text-sm text-stone-500">No {noun[1]} match this filter.</p>
  }

  return (
    <>
      <Legend />
      <ul className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        {games.map((game) => (
        <li key={game.gameId}>
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-600 first:border-t-0">
            {weekLongLabel(game.season, game.week)}
            <span className="font-normal text-stone-400">{game.home ? 'vs' : 'at'}</span>
            <TeamPill abbr={game.opponent} />
            {game.result && <Result result={game.result} />}
            <span className="ml-auto font-normal text-stone-400">
              {game.plays.length} {game.plays.length === 1 ? noun[0] : noun[1]}
            </span>
          </h3>
          <ul className="divide-y divide-stone-100">
            {game.plays.map((play) => {
              const key = playKey(play)
              return <li key={key}>{row(play, key === selectedKey, () => onSelect(play))}</li>
            })}
          </ul>
        </li>
        ))}
      </ul>
    </>
  )
}

// Deliberately neutral. A green W sitting next to the cost meter would invite
// reading the result as a verdict on the decision, and the whole point of
// judging a 4th down on win probability is that it does not depend on how the
// game happened to end.
const OUTCOME_TONE: Record<GameResult['outcome'], string> = {
  W: 'bg-stone-800 text-white',
  L: 'bg-stone-200 text-stone-600',
  T: 'bg-stone-300 text-stone-700',
}

/** The final score, from the viewed team's side. */
function Result({ result }: { result: GameResult }) {
  return (
    <span
      className="tnum inline-flex items-center gap-1"
      title={`Final: ${result.for}-${result.against}`}
    >
      <span
        className={`rounded-xs px-1 py-px text-[0.625rem] font-bold ${OUTCOME_TONE[result.outcome]}`}
      >
        {result.outcome}
      </span>
      <span className="font-semibold text-stone-500">
        {result.for}–{result.against}
      </span>
    </span>
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
