import type { GameSummary } from '../../lib/games'
import { costliest, tallyByOutcome } from '../../lib/games'
import { weekShortLabel } from '../../lib/filters'
import { points } from '../../lib/format'
import { TeamPill } from '../TeamPill'

/**
 * Where the 4th-down calls gave away the most, split by how the game ended.
 *
 * Both columns rank on the same number. That is the point of showing them
 * together: the cost of a decision is fixed at the moment it is made, and
 * knowing the result afterwards does not change it. The wins column is the
 * honest counterweight to the losses column, not a separate metric.
 */
export function GameImpact({
  games,
  onSelectGame,
}: {
  games: GameSummary[]
  onSelectGame: (game: GameSummary) => void
}) {
  const losses = costliest(games, 'L')
  const wins = costliest(games, 'W')
  const wonAnyway = tallyByOutcome(games, 'W')

  if (losses.length === 0 && wins.length === 0) {
    return (
      <section>
        <Heading />
        <p className="mt-3 text-sm text-stone-500">
          No decision this season went against the model while the game was live.
        </p>
      </section>
    )
  }

  return (
    <section>
      <Heading />
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Column
          title="In losses"
          caption="Most given up in a defeat"
          games={losses}
          onSelectGame={onSelectGame}
        />
        <Column
          title="In wins"
          caption={
            wonAnyway.withDisagreement > 0
              ? `Went against the model in ${wonAnyway.withDisagreement} of ${wonAnyway.games} wins`
              : 'Most given up in a win'
          }
          games={wins}
          onSelectGame={onSelectGame}
        />
      </div>
      <p className="mt-3 text-[0.6875rem] leading-relaxed text-stone-400">
        Win probability is an expected value. A game near the top of either column is one where the
        4th-down calls gave away the most — not one where the result would have been different.
        Calls taken at a 95%+ win probability are left out, since there was little left for them to
        change.
      </p>
    </section>
  )
}

function Heading() {
  return (
    <h3 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">
      Where the calls cost most
    </h3>
  )
}

interface ColumnProps {
  title: string
  caption: string
  games: GameSummary[]
  onSelectGame: (game: GameSummary) => void
}

function Column({ title, caption, games, onSelectGame }: ColumnProps) {
  const worst = games[0]?.forfeitedLive ?? 1

  return (
    <div>
      <h4 className="text-[0.6875rem] font-bold tracking-wide text-stone-700 uppercase">{title}</h4>
      <p className="text-[0.6875rem] text-stone-400">{caption}</p>
      {games.length === 0 ? (
        <p className="mt-2 text-xs text-stone-400">None.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {games.map((game) => (
            <li key={game.gameId}>
              <button
                onClick={() => onSelectGame(game)}
                className="flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
              >
                <span className="w-11 shrink-0 text-[0.6875rem] font-semibold text-stone-500">
                  {weekShortLabel(game.week)}
                </span>
                <span className="shrink-0 text-[0.6875rem] text-stone-400">
                  {game.home ? 'vs' : 'at'}
                </span>
                <TeamPill abbr={game.opponent} />
                <span className="tnum ml-auto flex shrink-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="hidden h-1.5 rounded-xs bg-amber-500 sm:block"
                    style={{ width: `${Math.max(6, (game.forfeitedLive / worst) * 44)}px` }}
                  />
                  <span className="w-9 text-right text-sm font-bold text-amber-700">
                    {points(game.forfeitedLive)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
