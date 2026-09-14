/**
 * Builds public/data/index.json: the 32 teams, their colors, and their
 * precomputed per-season tendency metrics.
 *
 * Run this after the R pipeline has written the raw team metadata to
 * public/data/index.json and the per-team play files to public/data/teams/.
 *
 *   npm run data:index            # real data
 *   npm run data:fixture          # regenerate fixtures, then build the index
 *
 * Why precompute: the league overview needs a headline metric for all 32
 * teams at once, and the app is only allowed to fetch the selected team's
 * file. Computing these in the browser would mean loading every team file on
 * the landing screen. The metrics come from src/lib/metrics.ts, the same
 * module the team profile uses at runtime, so the two cannot disagree.
 *
 * The script is idempotent: it accepts either the raw array that R writes or
 * an index it has already built.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { summarizeAll } from '../src/lib/metrics.ts'
import { actualChoice } from '../src/lib/decision.ts'
import { postseasonRound } from '../src/lib/filters.ts'
import type {
  LeagueIndex,
  Play,
  QuizPlay,
  SeasonProgress,
  TeamIndexEntry,
  TeamMeta,
} from '../src/types.ts'

const INDEX_PATH = 'public/data/index.json'
const QUIZ_PATH = 'public/data/quiz.json'
const TEAM_DIR = 'public/data/teams'
const isFixture = process.argv.includes('--fixture')

/**
 * How many 4th downs to keep for the quiz. Enough that consecutive rounds do
 * not repeat, small enough to be one quick request.
 */
const QUIZ_POOL = 400

/** Deterministic shuffle, so the pool is stable across rebuilds. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  let state = seed >>> 0
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0
    const j = state % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function readTeamMeta(): TeamMeta[] {
  const raw: unknown = JSON.parse(readFileSync(INDEX_PATH, 'utf-8'))
  const entries = Array.isArray(raw) ? raw : (raw as LeagueIndex).teams
  return (entries as TeamIndexEntry[]).map((t) => ({
    team_abbr: t.team_abbr,
    team_name: t.team_name,
    team_conf: t.team_conf,
    team_division: t.team_division,
    team_color: t.team_color,
    team_color2: t.team_color2,
  }))
}

const meta = readTeamMeta()
const teams: TeamIndexEntry[] = []
/** Latest week seen per season, across every team. */
const lastWeek = new Map<number, number>()
const quizCandidates: Play[] = []

for (const team of meta) {
  const path = `${TEAM_DIR}/${team.team_abbr}.json`
  if (!existsSync(path)) {
    process.stderr.write(`skipping ${team.team_abbr}: no play file at ${path}\n`)
    continue
  }
  const plays = JSON.parse(readFileSync(path, 'utf-8')) as Play[]
  for (const play of plays) {
    lastWeek.set(play.season, Math.max(lastWeek.get(play.season) ?? 0, play.week))
  }
  // Only plays that carried a real decision can be asked about.
  quizCandidates.push(...plays.filter((p) => actualChoice(p) !== null))
  const summaries = summarizeAll(plays)
  teams.push({ ...team, summaries })

  const all = summaries[0]
  process.stdout.write(
    `${team.team_abbr.padEnd(4)}${String(all.decisions).padStart(5)} decisions  ` +
      `aggr ${((all.aggressiveness ?? 0) * 100).toFixed(1).padStart(5)}%  ` +
      `agree ${((all.agreement ?? 0) * 100).toFixed(1).padStart(5)}%\n`,
  )
}

const seasons = [...lastWeek.keys()].sort((a, b) => b - a)

// The newest season is still being played until a Super Bowl play is in the
// data. Someone always has a 4th down in the Super Bowl, so the union of the
// team files sees it the week it happens.
const newest = seasons[0]
const inProgress: SeasonProgress | null =
  newest !== undefined && postseasonRound(newest, lastWeek.get(newest) ?? 0) !== 3
    ? { season: newest, through_week: lastWeek.get(newest) ?? 0 }
    : null

const index: LeagueIndex = {
  generated_at: new Date().toISOString(),
  seasons,
  fixture: isFixture,
  in_progress: inProgress,
  teams: teams.sort((a, b) => a.team_abbr.localeCompare(b.team_abbr)),
}

writeFileSync(INDEX_PATH, JSON.stringify(index))

// The quiz pool: a uniform random sample of real 4th downs, minus the play
// description, which narrates the outcome the quiz must not reveal. The
// season in progress stays out: the shuffle is seeded over the whole
// candidate list, so adding a week's plays would deal a different quiz every
// week of the season. Its plays join the pool once the season is complete.
const completed = quizCandidates.filter((p) => p.season !== inProgress?.season)
const pool: QuizPlay[] = seededShuffle(completed, 20260830)
  .slice(0, QUIZ_POOL)
  .map(({ desc: _desc, ...rest }) => rest)
writeFileSync(QUIZ_PATH, JSON.stringify(pool))
process.stdout.write(
  `Wrote ${QUIZ_PATH}: ${pool.length} of ${completed.length} decisions` +
    `${inProgress ? ` (${quizCandidates.length - completed.length} from ${inProgress.season} held back)` : ''}\n`,
)
process.stdout.write(
  `\nWrote ${INDEX_PATH}: ${teams.length} teams, seasons ${index.seasons.at(-1)}-${index.seasons[0]}` +
    `${inProgress ? ` (${inProgress.season} in progress, through week ${inProgress.through_week})` : ''}` +
    `${isFixture ? ' (FIXTURE DATA)' : ''}\n`,
)
