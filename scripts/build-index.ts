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
import type { LeagueIndex, Play, TeamIndexEntry, TeamMeta } from '../src/types.ts'

const INDEX_PATH = 'public/data/index.json'
const TEAM_DIR = 'public/data/teams'
const isFixture = process.argv.includes('--fixture')

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
const seasons = new Set<number>()

for (const team of meta) {
  const path = `${TEAM_DIR}/${team.team_abbr}.json`
  if (!existsSync(path)) {
    process.stderr.write(`skipping ${team.team_abbr}: no play file at ${path}\n`)
    continue
  }
  const plays = JSON.parse(readFileSync(path, 'utf-8')) as Play[]
  for (const play of plays) seasons.add(play.season)
  const summaries = summarizeAll(plays)
  teams.push({ ...team, summaries })

  const all = summaries[0]
  process.stdout.write(
    `${team.team_abbr.padEnd(4)}${String(all.decisions).padStart(5)} decisions  ` +
      `aggr ${((all.aggressiveness ?? 0) * 100).toFixed(1).padStart(5)}%  ` +
      `agree ${((all.agreement ?? 0) * 100).toFixed(1).padStart(5)}%\n`,
  )
}

const index: LeagueIndex = {
  generated_at: new Date().toISOString(),
  seasons: [...seasons].sort((a, b) => b - a),
  fixture: isFixture,
  teams: teams.sort((a, b) => a.team_abbr.localeCompare(b.team_abbr)),
}

writeFileSync(INDEX_PATH, JSON.stringify(index))
process.stdout.write(
  `\nWrote ${INDEX_PATH}: ${teams.length} teams, seasons ${index.seasons.at(-1)}-${index.seasons[0]}` +
    `${isFixture ? ' (FIXTURE DATA)' : ''}\n`,
)
