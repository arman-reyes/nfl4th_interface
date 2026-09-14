/**
 * Stage 2 of the travel pipeline: read every season R wrote back through the
 * same module the page uses, and write the all-seasons aggregate.
 *
 *   npm run data:travel
 *
 * Why precompute: the aggregate is the page's resting state, and fetching
 * twenty-seven season files to draw it would be over a megabyte on landing.
 * `aggregate` in src/lib/travel.ts is what the page runs on a single season,
 * so the number it shows for one year and the number this writes for all of
 * them are the same arithmetic on different inputs.
 *
 * The checks here are the ones R cannot make: that the files are shaped the
 * way the client expects, and that the venue arithmetic produced trips a
 * reader would recognise.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import {
  aggregate,
  assertStatOrder,
  DISTANCE_LABELS,
  farCut,
  homeAwayFar,
  mean,
  METRIC,
  perSeason,
  se,
  STAT_ORDER,
} from '../src/lib/travel.ts'
import type { TravelLeagueFile } from '../src/lib/travel.ts'
import type { TravelSeasonFile, TravelSeasons } from '../src/types.ts'

const DIR = 'public/data/travel'
const OUT = `${DIR}/league.json`
const FAR = 1000

if (!existsSync(`${DIR}/seasons.json`)) {
  process.stderr.write(`no ${DIR}/seasons.json — run scripts/travel.R first\n`)
  process.exit(1)
}
const published = JSON.parse(readFileSync(`${DIR}/seasons.json`, 'utf-8')) as TravelSeasons
process.stdout.write(`Published seasons: ${published.join(', ')}\n\n`)

const fmt = (v: number | null, digits = 1) => (v === null ? '—' : v.toFixed(digits))
const signed = (v: number | null, digits = 1) =>
  v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`

let failures = 0
const files: TravelSeasonFile[] = []

for (const season of published) {
  const path = `${DIR}/${season}.json`
  if (!existsSync(path)) {
    process.stderr.write(`FAIL ${season}: listed in seasons.json but ${path} is missing\n`)
    failures += 1
    continue
  }
  const file = JSON.parse(readFileSync(path, 'utf-8')) as TravelSeasonFile
  const problems: string[] = []

  try {
    assertStatOrder(file)
  } catch (error) {
    problems.push((error as Error).message)
  }

  const venues = new Set(file.venues.map((v) => v.id))
  const bases = new Map(file.bases.map((b) => [b.team, b]))
  let twoSided = 0
  const byGame = new Map<string, number>()
  for (const g of file.games) {
    if (!venues.has(g.venue)) problems.push(`${g.game_id}: venue ${g.venue} not in file`)
    if (!bases.has(g.team)) problems.push(`${g.game_id}: ${g.team} has no base`)
    const atBase = g.venue === bases.get(g.team)?.venue
    if (atBase && g.miles !== 0) problems.push(`${g.game_id}: ${g.team} at its base, ${g.miles} mi`)
    if (!atBase && g.miles === 0) problems.push(`${g.game_id}: ${g.team} away from base, 0 mi`)
    byGame.set(g.game_id, (byGame.get(g.game_id) ?? 0) + 1)
  }
  for (const [id, count] of byGame) {
    if (count === 2) twoSided += 1
    else problems.push(`${id}: ${count} side(s), expected 2`)
  }

  // Every player row must be a full tuple, pointing at a real game. A
  // length-one row silently unboxed by jsonlite would read as a number here.
  for (const p of file.players) {
    for (const row of p.rows) {
      if (!Array.isArray(row) || row.length !== STAT_ORDER.length + 1) {
        problems.push(`${p.name}: stat row is ${JSON.stringify(row)}`)
        break
      }
      if (!file.games[row[0]]) {
        problems.push(`${p.name}: row points at game ${row[0]}`)
        break
      }
    }
  }

  if (problems.length > 0) {
    failures += 1
    process.stderr.write(`FAIL ${season}:\n  ${problems.slice(0, 8).join('\n  ')}\n`)
    if (problems.length > 8) process.stderr.write(`  … and ${problems.length - 8} more\n`)
    continue
  }

  files.push(file)
  const one = aggregate([file])
  const m = homeAwayFar(one.byLens.distance.margin, FAR)
  const w = homeAwayFar(one.byLens.distance.win, FAR)
  const statless = file.games.filter((g) => g.plays === null).length
  process.stdout.write(
    `${season}: ${twoSided} games, ${file.players.length} players` +
      `${file.has_kickoff ? '' : ', no kickoff times'}` +
      `${statless > 0 ? `, ${statless} team-games without offence` : ''}\n` +
      `  home margin ${signed(mean(m.home))} (win ${fmt((mean(w.home) ?? 0) * 100, 1)}%)` +
      `, away ${signed(mean(m.away))}, ${FAR}+ mi ${signed(mean(m.far))} ± ${fmt(se(m.far))} over ${m.far.n}\n`,
  )
}

if (failures > 0) {
  process.stderr.write(`\n${failures} season(s) failed; league.json not written\n`)
  process.exit(1)
}

const agg = aggregate(files)
const out: TravelLeagueFile = {
  generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  ...agg,
}
// Sums of squares carry float noise the page never reads; four places is
// plenty for a mean and its error and halves the file.
writeFileSync(
  OUT,
  JSON.stringify(out, (_key, value: unknown) =>
    typeof value === 'number' && !Number.isInteger(value) ? Math.round(value * 1e4) / 1e4 : value,
  ),
)

process.stdout.write(`\nAll seasons, ${agg.games} team-games:\n`)
for (const key of ['win', 'margin', 'vs_line', 'cover'] as const) {
  const cells = agg.byLens.distance[key]
  const metric = METRIC[key]
  process.stdout.write(`  ${metric.label.padEnd(16)}`)
  DISTANCE_LABELS.forEach((label, i) => {
    const v = mean(cells[i])
    process.stdout.write(` ${label.split(' ')[0].padStart(6)}=${v === null ? '—' : metric.format(v)}`)
  })
  process.stdout.write('\n')
}
const far = farCut(agg.byLens.distance.vs_line, FAR)
process.stdout.write(
  `  ${FAR}+ mi vs line: ${signed(mean(far), 2)} ± ${fmt(se(far), 2)} over ${far.n} team-games\n`,
)

// The venue arithmetic, made visible: each team's base and its longest trip.
// Wrong coordinates show up here as a base in the wrong city or a trip that
// no team in that division could take.
process.stdout.write('\nTeams, per season:\n')
const latest = files.reduce((a, b) => (b.season > a.season ? b : a))
for (const t of agg.byTeam) {
  const p = perSeason(t)
  const base = latest.bases.find((b) => b.team === t.team)
  let longest = { miles: 0, name: '' }
  for (const f of files) {
    for (const g of f.games) {
      if (g.team === t.team && g.miles > longest.miles) {
        longest = { miles: g.miles, name: f.venues.find((v) => v.id === g.venue)?.name ?? g.venue }
      }
    }
  }
  process.stdout.write(
    `  ${t.team.padEnd(4)} ${String(Math.round(p.miles)).padStart(6)} mi/season, ` +
      `${p.tz.toFixed(2)} zones/trip, ${t.seasons} seasons, ` +
      `base ${(base?.name ?? '—').padEnd(32)} longest ${longest.miles} mi to ${longest.name}\n`,
  )
}

const size = readFileSync(OUT).length
process.stdout.write(`\nWrote ${OUT}: ${agg.byTeam.length} teams, ${agg.players.length} players, ${Math.round(size / 1024)} KB\n`)
