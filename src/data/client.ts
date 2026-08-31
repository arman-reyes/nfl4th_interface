import type { LeagueIndex, Play, QuizPlay, TeamAbbr } from '../types'

/**
 * The only place the app talks to storage.
 *
 * Everything behind `DataSource` is fetch-and-cache over static JSON today.
 * Swapping in a real API means writing another implementation of this
 * interface and changing the one export at the bottom of the file; no
 * component or hook knows where the data comes from.
 */
export interface DataSource {
  /** The 32 teams and their precomputed per-season summaries. Loaded once. */
  loadIndex(): Promise<LeagueIndex>
  /** One team's full play history. Fetched on selection, then cached. */
  loadTeamPlays(abbr: TeamAbbr): Promise<Play[]>
  /** A sample of 4th downs for the quiz, without their descriptions. */
  loadQuizPool(): Promise<QuizPlay[]>
}

const BASE = `${import.meta.env.BASE_URL}data`

/**
 * Deduplicating promise cache: a second caller for a team already in flight
 * joins the first request instead of issuing another. Failures are evicted so
 * a retry is possible.
 */
function memoize<K, V>(load: (key: K) => Promise<V>): (key: K) => Promise<V> {
  const cache = new Map<K, Promise<V>>()
  return (key: K) => {
    const hit = cache.get(key)
    if (hit) return hit
    const pending = load(key).catch((error: unknown) => {
      cache.delete(key)
      throw error
    })
    cache.set(key, pending)
    return pending
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`)
  }
  return (await response.json()) as T
}

const fetchIndex = memoize<'index', LeagueIndex>(() => getJson<LeagueIndex>(`${BASE}/index.json`))

const fetchTeam = memoize<TeamAbbr, Play[]>((abbr) =>
  getJson<Play[]>(`${BASE}/teams/${abbr}.json`),
)

const fetchQuiz = memoize<'quiz', QuizPlay[]>(() => getJson<QuizPlay[]>(`${BASE}/quiz.json`))

export const staticDataSource: DataSource = {
  loadIndex: () => fetchIndex('index'),
  loadTeamPlays: (abbr) => fetchTeam(abbr),
  loadQuizPool: () => fetchQuiz('quiz'),
}

export const dataSource: DataSource = staticDataSource
