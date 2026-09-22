import { useMemo } from 'react'
import type { Situation, TeamIndexEntry } from '../types'
import { playsInSeason, summarizeWith } from '../lib/metrics'
import { summarizeGamesWith } from '../lib/games'
import type { GameSummary } from '../lib/games'
import type { DecisionRules } from '../lib/rules'
import { accentOnLight } from '../lib/color'
import { HeadlineMetrics } from './summary/HeadlineMetrics'
import { DecisionMatrix } from './summary/DecisionMatrix'
import { GameImpact } from './summary/GameImpact'

interface Props<P extends Situation, C extends string> {
  team: TeamIndexEntry
  rules: DecisionRules<P, C>
  /** All of the team's plays; scoped to the season here. */
  plays: P[]
  season: number
  /** What a play is called on this page, plural: "4th downs", "tries". */
  noun: string
  /** What taking the aggressive option is called, for the headline tile. */
  verb: string
  onSelectGame: (game: GameSummary) => void
}

/**
 * The team's season, and the landing view for a team.
 *
 * Scoped to the season rather than to the week and quarter filters: those
 * narrow the list on the left so a play can be found, while this answers what
 * the staff did across the year.
 */
export function TeamSummary<P extends Situation, C extends string>({
  team,
  rules,
  plays,
  season,
  noun,
  verb,
  onSelectGame,
}: Props<P, C>) {
  const scoped = useMemo(() => playsInSeason(plays, season), [plays, season])
  const summary = useMemo(() => summarizeWith(rules, plays, season), [rules, plays, season])
  const games = useMemo(() => summarizeGamesWith(rules, scoped), [rules, scoped])
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
          {summary.decisions} decisions from {scoped.length} {noun} across {summary.games} games.
          Pick one on the left to see what the model would have done.
        </p>
      </header>

      <HeadlineMetrics summary={summary} verb={verb} />
      <DecisionMatrix rules={rules} plays={scoped} />
      <GameImpact games={games} onSelectGame={onSelectGame} />
    </div>
  )
}
