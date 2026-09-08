/**
 * Stage 2 of the garbage-time pipeline: read what R wrote back through the same
 * module the page uses, and print what a reader would see.
 *
 *   npm run data:garbage:check
 *   npm run data:garbage:check -- 2019     # one season
 *
 * This is the check that catches a mistake the R script cannot see. The R side
 * proves its stats rebuild nflverse's own totals; this side proves the file it
 * emitted is shaped the way the client expects and that the client's arithmetic
 * over it holds up. Importing from src/lib is the point — if these numbers are
 * right, the page's numbers are the same numbers.
 */
import { existsSync, readFileSync } from 'node:fs'
import {
  assertStatOrder,
  buildRows,
  emptyTotals,
  fantasyPoints,
  DEFAULT_REMOVALS,
  leagueShares,
  POSITIONS,
  totals,
} from '../src/lib/garbageTime.ts'
import type { GarbageSeasons, GarbageTimeFile } from '../src/types.ts'

const DIR = 'public/data/garbage'
const THRESHOLD = 0.1

const requested = process.argv.slice(2).filter((a) => /^\d{4}$/.test(a)).map(Number)
if (!existsSync(`${DIR}/seasons.json`)) {
  process.stderr.write(`no ${DIR}/seasons.json — run scripts/garbage-time.R first\n`)
  process.exit(1)
}
const published = JSON.parse(readFileSync(`${DIR}/seasons.json`, 'utf-8')) as GarbageSeasons
const seasons = requested.length > 0 ? requested : published

process.stdout.write(`Published seasons: ${published.join(', ')}\n`)

let failures = 0

for (const season of seasons) {
  const path = `${DIR}/${season}.json`
  if (!existsSync(path)) {
    process.stderr.write(`FAIL ${season}: listed in seasons.json but ${path} is missing\n`)
    failures += 1
    continue
  }
  const file = JSON.parse(readFileSync(path, 'utf-8')) as GarbageTimeFile

  try {
    assertStatOrder(file)
  } catch (error) {
    process.stderr.write(`FAIL ${season}: ${(error as Error).message}\n`)
    failures += 1
    continue
  }

  // Every StatLine must be a full tuple. A length-one line silently unboxed by
  // jsonlite would read as a number here and score as zero everywhere.
  const width = file.stats.length
  const malformed = file.players.flatMap((p) =>
    p.bins.filter(([, line]) => !Array.isArray(line) || line.length !== width),
  ).length
  if (malformed > 0) {
    process.stderr.write(`FAIL ${season}: ${malformed} malformed stat lines\n`)
    failures += 1
    continue
  }

  // Conservation, on the real file rather than a fixture.
  const rows = buildRows(file, { threshold: THRESHOLD, format: 'ppr', remove: DEFAULT_REMOVALS })
  const drift = rows.filter((r) => Math.abs(r.remaining + r.removed - r.actual) > 1e-6).length
  if (drift > 0) {
    process.stderr.write(`FAIL ${season}: ${drift} players where clean + garbage != actual\n`)
    failures += 1
    continue
  }

  // PPR minus standard is the reception count, everywhere, by construction.
  const std = buildRows(file, { threshold: THRESHOLD, format: 'standard', remove: DEFAULT_REMOVALS })
  const byId = new Map(std.map((r) => [r.player.id, r]))
  const scoringDrift = rows.filter((r) => {
    const recs = totals(r.player.bins).rec
    return Math.abs(r.actual - (byId.get(r.player.id)?.actual ?? 0) - recs) > 1e-6
  }).length
  if (scoringDrift > 0) {
    process.stderr.write(`FAIL ${season}: ${scoringDrift} players where PPR - standard != receptions\n`)
    failures += 1
    continue
  }

  // Snaps come from nflverse participation, which is not perfect: on a handful
  // of plays it lists the wrong quarterback's personnel grouping, so a player
  // can be charged with more touches in a band than snaps. Reported rather than
  // failed - it is upstream data, it is rare, and hiding it would be worse than
  // saying how rare.
  if (file.has_snaps) {
    const snapsAt = file.stats.indexOf('snaps')
    const playsAt = file.stats.indexOf('plays')
    let bands = 0
    let short = 0
    for (const player of file.players) {
      const agg = new Map<string, { plays: number; snaps: number }>()
      for (const [bin, line] of player.bins) {
        const side = file.bins[bin]?.side ?? 'clean'
        const at = agg.get(side) ?? { plays: 0, snaps: 0 }
        at.plays += line[playsAt] ?? 0
        at.snaps += line[snapsAt] ?? 0
        agg.set(side, at)
      }
      for (const at of agg.values()) {
        if (at.plays === 0 && at.snaps === 0) continue
        bands += 1
        if (at.plays > at.snaps) short += 1
      }
    }
    if (short > 0) {
      process.stdout.write(
        `  participation gaps: ${short} of ${bands} player-bands ` +
          `(${((short / bands) * 100).toFixed(2)}%) show more touches than snaps
`,
      )
    }
  }

  const shares = leagueShares(file, THRESHOLD)
  const rate = shares.trailing + shares.leading
  process.stdout.write(
    `\n=== ${season} ${file.complete ? '' : `(through week ${file.through_week}) `}` +
      `· ${file.players.length} players · ${(rate * 100).toFixed(1)}% of plays garbage ===\n`,
  )

  if (requested.length > 0 || season === published[0]) {
    for (const pos of POSITIONS) {
      const at = rows
        .filter((r) => r.player.pos === pos && (r.actualRank <= 100 || r.remainingRank <= 100))
        .sort((a, b) => b.rankDelta - a.rankDelta)
        .slice(0, 5)
      process.stdout.write(`\n  ${pos} — biggest falls at wp < ${THRESHOLD}, PPR\n`)
      for (const r of at) {
        process.stdout.write(
          `    ${r.player.name.padEnd(22)} ${r.player.team.padEnd(4)}` +
            `${r.actual.toFixed(1).padStart(7)} → ${r.remaining.toFixed(1).padStart(7)}  ` +
            `${pos}${String(r.actualRank).padEnd(3)} → ${pos}${String(r.remainingRank).padEnd(4)}` +
            `${`${Math.round(r.share * 100)}%`.padStart(5)} garbage
`,
        )
      }
    }
  }
}

// A spot-check a human can read: the scoring formula on a known line.
const sample = { ...emptyTotals(), pass_yds: 300, pass_td: 2, int: 1 }
process.stdout.write(
  `
300 pass yds, 2 TD, 1 INT scores ${fantasyPoints(sample, 1).toFixed(1)} (expected 18.0)
`,
)

if (failures > 0) {
  process.stderr.write(`\n${failures} season(s) failed validation\n`)
  process.exit(1)
}
process.stdout.write(`\nAll ${seasons.length} season(s) validated.\n`)
