import { useCallback } from 'react'
import { dataSource } from '../data/client'
import type { LeagueIndex, Play, QuizPlay, TeamAbbr } from '../types'
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
