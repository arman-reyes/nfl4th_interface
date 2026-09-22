import { useCallback, useMemo, useState } from 'react'
import { ALL, applyFilter, playKey, reconcile, seasonsOf } from '../lib/filters'
import type { PlayFilter } from '../lib/filters'
import type { GameSummary } from '../lib/games'
import { playsInSeason } from '../lib/metrics'
import type { Situation, TeamAbbr } from '../types'
import { useAsync } from './useAsync'

/**
 * The drill-down as state: team, then season, week, quarter, then the one
 * play that is open.
 *
 * Both the 4th-down page and the two-point page walk exactly this path, so
 * the state lives here once and each page passes in its own loader. It is
 * held by App rather than by the page so that stepping out to the trends view
 * and back does not forget the team.
 */
export interface Drilldown<P extends Situation> {
  abbr: TeamAbbr | null
  plays: P[] | null
  loading: boolean
  error: Error | null
  /** The filter in force, or null until the team's plays have arrived. */
  filter: PlayFilter | null
  /** Plays matching the filter, in the order they were played. */
  visible: P[]
  /** How many plays the season holds, filter or no filter. */
  seasonCount: number
  selected: P | null
  /**
   * The seasons the banner offers. Until the team's plays arrive it is the
   * league's seasons, so the picker is never empty while a team is loading.
   */
  seasons: number[]
  chooseTeam: (abbr: TeamAbbr) => void
  clearTeam: () => void
  changeFilter: (filter: PlayFilter) => void
  changeSeason: (season: number) => void
  togglePlay: (play: P) => void
  clearSelection: () => void
  focusGame: (game: GameSummary) => void
}

export function useDrilldown<P extends Situation>(
  loadTeam: (abbr: TeamAbbr) => Promise<P[]>,
  leagueSeasons: number[],
): Drilldown<P> {
  const [abbr, setAbbr] = useState<TeamAbbr | null>(null)
  // What the user last asked for. The filter in force is derived from it during
  // render, because a team's real seasons and weeks are only known once that
  // team's data has arrived.
  const [intent, setIntent] = useState<PlayFilter | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const load = useCallback((key: string) => loadTeam(key), [loadTeam])
  const team = useAsync<P[]>(abbr, load)
  const plays = team.data

  const filter = useMemo(() => (plays ? reconcile(plays, intent) : null), [plays, intent])
  const visible = useMemo(
    () => (plays && filter ? applyFilter(plays, filter) : []),
    [plays, filter],
  )
  const seasonCount = useMemo(
    () => (plays && filter ? playsInSeason(plays, filter.season).length : 0),
    [plays, filter],
  )
  const selected = visible.find((p) => playKey(p) === selectedKey) ?? null
  const seasons = useMemo(
    () => (plays ? seasonsOf(plays) : leagueSeasons),
    [plays, leagueSeasons],
  )

  const chooseTeam = useCallback((next: TeamAbbr) => {
    setAbbr(next)
    setSelectedKey(null)
  }, [])

  const clearTeam = useCallback(() => setAbbr(null), [])

  const changeFilter = useCallback((next: PlayFilter) => {
    setIntent(next)
    setSelectedKey(null)
  }, [])

  /** A new season resets the week and quarter beneath it. */
  const changeSeason = useCallback(
    (season: number) => changeFilter({ season, week: ALL, qtr: ALL }),
    [changeFilter],
  )

  /** Tapping the open row again closes it, back to the summary. */
  const togglePlay = useCallback((play: P) => {
    const key = playKey(play)
    setSelectedKey((current) => (current === key ? null : key))
  }, [])

  const clearSelection = useCallback(() => setSelectedKey(null), [])

  /** Narrow the list to one game, and return to the summary. */
  const focusGame = useCallback(
    (game: GameSummary) => {
      if (!filter) return
      setIntent({ season: filter.season, week: game.week, qtr: ALL })
      setSelectedKey(null)
    },
    [filter],
  )

  return {
    abbr,
    plays,
    loading: team.loading,
    error: team.error,
    filter,
    visible,
    seasonCount,
    selected,
    seasons,
    chooseTeam,
    clearTeam,
    changeFilter,
    changeSeason,
    togglePlay,
    clearSelection,
    focusGame,
  }
}
