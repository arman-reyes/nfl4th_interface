import { useMemo } from 'react'
import type { Play, TeamIndexEntry } from '../types'
import { playsInSeason, summarize } from '../lib/metrics'
import { summarizeGames } from '../lib/games'
import type { GameSummary } from '../lib/games'
import { accentOnLight } from '../lib/color'
import { HeadlineMetrics } from './summary/HeadlineMetrics'
import { DecisionMatrix } from './summary/DecisionMatrix'
import { GameImpact } from './summary/GameImpact'

interface Props {
  team: TeamIndexEntry
  /** All of the team's plays; scoped to the season here. */
  plays: Play[]
  season: number
  onSelectGame: (game: GameSummary) => void
}

/**
 * The team's season, and the landing view for a team.
 *
 * Scoped to the season rather than to the week and quarter filters: those
 * narrow the list on the left so a play can be found, while this answers what
 * the staff did across the year.
 */
export function TeamSummary({ team, plays, season, onSelectGame }: Props) {
  const scoped = useMemo(() => playsInSeason(plays, season), [plays, season])
  const summary = useMemo(() => summarize(plays, season), [plays, season])
  const games = useMemo(() => summarizeGames(scoped), [scoped])
  const accent = accentOnLight(team.team_abbr)

  return (
    <div className="space-y-6 rounded-lg border border-stone-200 bg-white p-4 shadow-xs sm:p-6">
      <header className="border-b border-stone-200 pb-4">
        <p
          className="text-xs font-bold tracking-[0.18em] uppercase"
          style={{ color: accent }}
        >
          {season} season
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          {team.team_name}
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          {summary.decisions} decisions from {scoped.length} 4th downs across {summary.games} games.
          Pick one on the left to see what the model would have done.
        </p>
      </header>

      <HeadlineMetrics summary={summary} />
      <DecisionMatrix plays={scoped} />
      <GameImpact games={games} onSelectGame={onSelectGame} />
    </div>
  )
}
