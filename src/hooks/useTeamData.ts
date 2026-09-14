import { useCallback } from 'react'
import { dataSource } from '../data/client'
import type {
  GarbageSeasons,
  GarbageTimeFile,
  LeagueIndex,
  Play,
  QuizPlay,
  TeamAbbr,
  TravelSeasonFile,
  TravelSeasons,
} from '../types'
import type { TravelLeagueFile } from '../lib/travel'
import { useAsync } from './useAsync'
import type { AsyncState } from './useAsync'

/**
 * One team's plays. Passing null selects nothing and fetches nothing, so only
 * the team the user is actually looking at is ever requested.
 */
export function useTeamData(abbr: TeamAbbr | null): AsyncState<Play[]> {
  const load = useCallback((key: string) => dataSource.loadTeamPlays(key), [])
  return useAsync<Play[]>(abbr, load)
}

/** The league index. Loaded once at startup and cached for the session. */
export function useLeagueIndex(): AsyncState<LeagueIndex> {
  const load = useCallback(() => dataSource.loadIndex(), [])
  return useAsync<LeagueIndex>('index', load)
}

/** The quiz pool. Loaded once, on the quiz page only. */
export function useQuizPool(): AsyncState<QuizPlay[]> {
  const load = useCallback(() => dataSource.loadQuizPool(), [])
  return useAsync<QuizPlay[]>('quiz', load)
}

/** The seasons the garbage-time pipeline published. Loaded on that page only. */
export function useGarbageSeasons(): AsyncState<GarbageSeasons> {
  const load = useCallback(() => dataSource.loadGarbageSeasons(), [])
  return useAsync<GarbageSeasons>('garbage-seasons', load)
}

/**
 * One season of binned fantasy production. Passing null fetches nothing, so the
 * page can wait for the season list before asking for a year that may not exist.
 */
export function useGarbageTime(season: number | null): AsyncState<GarbageTimeFile> {
  const load = useCallback((key: string) => dataSource.loadGarbageTime(Number(key)), [])
  return useAsync<GarbageTimeFile>(season === null ? null : String(season), load)
}

/** The seasons the travel pipeline published. Loaded on that page only. */
export function useTravelSeasons(): AsyncState<TravelSeasons> {
  const load = useCallback(() => dataSource.loadTravelSeasons(), [])
  return useAsync<TravelSeasons>('travel-seasons', load)
}

/** One season of trips. Null fetches nothing, which is the all-seasons view. */
export function useTravelSeason(season: number | null): AsyncState<TravelSeasonFile> {
  const load = useCallback((key: string) => dataSource.loadTravelSeason(Number(key)), [])
  return useAsync<TravelSeasonFile>(season === null ? null : String(season), load)
}

/** Every season at once, precomputed. Loaded once; it is the page's first view. */
export function useTravelLeague(): AsyncState<TravelLeagueFile> {
  const load = useCallback(() => dataSource.loadTravelLeague(), [])
  return useAsync<TravelLeagueFile>('travel-league', load)
}
