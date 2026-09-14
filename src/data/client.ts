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
  /** Seasons the garbage-time pipeline has published. Loaded once. */
  loadGarbageSeasons(): Promise<GarbageSeasons>
  /** One season of fantasy production binned by win probability. */
  loadGarbageTime(season: number): Promise<GarbageTimeFile>
  /** Seasons the travel pipeline has published. Loaded once. */
  loadTravelSeasons(): Promise<TravelSeasons>
  /** One season of team-games and player games with their trips. */
  loadTravelSeason(season: number): Promise<TravelSeasonFile>
  /** Every published season aggregated, the travel page's resting state. */
  loadTravelLeague(): Promise<TravelLeagueFile>
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

const fetchGarbageSeasons = memoize<'seasons', GarbageSeasons>(() =>
  getJson<GarbageSeasons>(`${BASE}/garbage/seasons.json`),
)

const fetchGarbage = memoize<number, GarbageTimeFile>((season) =>
  getJson<GarbageTimeFile>(`${BASE}/garbage/${season}.json`),
)

const fetchTravelSeasons = memoize<'seasons', TravelSeasons>(() =>
  getJson<TravelSeasons>(`${BASE}/travel/seasons.json`),
)

const fetchTravelSeason = memoize<number, TravelSeasonFile>((season) =>
  getJson<TravelSeasonFile>(`${BASE}/travel/${season}.json`),
)

const fetchTravelLeague = memoize<'league', TravelLeagueFile>(() =>
  getJson<TravelLeagueFile>(`${BASE}/travel/league.json`),
)

export const staticDataSource: DataSource = {
  loadIndex: () => fetchIndex('index'),
  loadTeamPlays: (abbr) => fetchTeam(abbr),
  loadQuizPool: () => fetchQuiz('quiz'),
  loadGarbageSeasons: () => fetchGarbageSeasons('seasons'),
  loadGarbageTime: (season) => fetchGarbage(season),
  loadTravelSeasons: () => fetchTravelSeasons('seasons'),
  loadTravelSeason: (season) => fetchTravelSeason(season),
  loadTravelLeague: () => fetchTravelLeague('league'),
}

export const dataSource: DataSource = staticDataSource
