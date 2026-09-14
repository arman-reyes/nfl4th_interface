/**
 * Top up the site with the current season's games, midseason.
 *
 *   npm run data:update                       # current season, both pipelines
 *   npm run data:update -- --season 2026      # a specific season
 *   npm run data:update -- --deploy           # ...and push the data to S3
 *   npm run data:update -- --only garbage     # one pipeline (fourth | garbage)
 *
 * Run it Tuesday morning: nflverse rebuilds its play-by-play overnight after
 * the last game of the week. Run earlier and the newest week is partial.
 *
 * Both R scripts already merge a single season into what is on disk, so this
 * only sequences them, rebuilds the derived files, validates, builds, and -
 * when asked - syncs dist/data/ to the bucket and invalidates the edge cache.
 * A failure anywhere stops it before the deploy. Code changes are not
 * deployed here; those follow deploymentREADME.md.
 *
 * The bucket and distribution are deliberately not in the repo. --deploy reads
 * NFL4TH_S3_BUCKET and NFL4TH_CF_DISTRIBUTION from the environment or from
 * .env.deploy.local (gitignored) in the project root.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const INDEX_PATH = 'public/data/index.json'
const SEASONS_PATH = 'public/data/garbage/seasons.json'
const ENV_PATH = '.env.deploy.local'
const win = process.platform === 'win32'

function fail(message) {
  process.stderr.write(`\nupdate-season: ${message}\n`)
  process.exit(1)
}

const { values: opts } = parseArgs({
  options: {
    season: { type: 'string' },
    deploy: { type: 'boolean', default: false },
    only: { type: 'string' },
  },
})
if (opts.only && !['fourth', 'garbage'].includes(opts.only)) {
  fail(`--only must be "fourth" or "garbage", not "${opts.only}"`)
}
const runFourth = opts.only !== 'garbage'
const runGarbage = opts.only !== 'fourth'

// Resolved up front so a missing setting fails now, not after the pipeline.
let target = null
if (opts.deploy) {
  if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH)
  const bucket = process.env.NFL4TH_S3_BUCKET
  const distribution = process.env.NFL4TH_CF_DISTRIBUTION
  if (!bucket || !distribution) {
    fail(`--deploy needs NFL4TH_S3_BUCKET and NFL4TH_CF_DISTRIBUTION, in the environment or in ${ENV_PATH}`)
  }
  target = { bucket, distribution }
}

/**
 * Run a command with inherited stdio and stop on any failure. Rscript, node
 * and aws resolve to real executables, so they run without a shell and their
 * arguments arrive intact. npm on Windows is a .cmd shim that only the shell
 * can start, and the shell does no quoting - so it is only ever given a bare
 * script name.
 */
function run(cmd, args, { shell = false } = {}) {
  process.stdout.write(`\n$ ${cmd} ${args.join(' ')}\n`)
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell })
  if (result.error) fail(`${cmd}: ${result.error.message}`)
  if (result.status !== 0) fail(`${cmd} exited ${result.status}`)
}

function npm(script) {
  run(win ? 'npm.cmd' : 'npm', ['run', script], { shell: win })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function readIndex() {
  if (!existsSync(INDEX_PATH)) fail(`${INDEX_PATH} is missing; run the full pipeline first (README.md)`)
  const index = readJson(INDEX_PATH)
  if (Array.isArray(index)) fail(`${INDEX_PATH} is the raw R output; run npm run data:index first`)
  return index
}

// --- which season -----------------------------------------------------------

let season = opts.season ? Number(opts.season) : NaN
if (opts.season && !Number.isInteger(season)) fail(`--season must be a year, not "${opts.season}"`)
if (!opts.season) {
  const probe = spawnSync('Rscript', ['-e', 'cat(nflreadr::most_recent_season())'], {
    encoding: 'utf-8',
  })
  if (probe.error || probe.status !== 0) {
    fail(`could not ask nflreadr for the current season: ${probe.stderr || probe.error?.message}`)
  }
  season = Number(probe.stdout.trim())
}
process.stdout.write(`Updating the ${season} season${opts.only ? ` (${opts.only} only)` : ''}\n`)

// Never merge real rows into fixture data. extract.R checks this too, but
// catching it here is free and comes before a four-minute download.
if (readIndex().fixture) {
  fail(`${INDEX_PATH} holds fixture data (npm run data:fixture); delete public/data/ and run the full pipeline`)
}

// --- 4th downs --------------------------------------------------------------

if (runFourth) {
  run('Rscript', ['scripts/extract.R', String(season)])
  run('node', ['--import', 'tsx', 'scripts/build-index.ts'])

  const index = readIndex()
  if (index.fixture) fail('index.json came out stamped as fixture data')
  if (!index.seasons.includes(season)) {
    fail(`index.json has no ${season} season after the extract - nothing scored? see the extract log`)
  }
}

// --- garbage time -----------------------------------------------------------

if (runGarbage) {
  // Exits non-zero itself when the season fails reconciliation, and leaves
  // the previous file for that season in place.
  run('Rscript', ['scripts/garbage-time.R', String(season)])
  run('node', ['--import', 'tsx', 'scripts/check-garbage.ts', String(season)])

  const seasons = readJson(SEASONS_PATH)
  if (!seasons.includes(season)) fail(`${SEASONS_PATH} does not list ${season}`)
}

// --- verify and build -------------------------------------------------------

npm('lint')
npm('test')
npm('build') // runs tsc -b first

// --- deploy -----------------------------------------------------------------

/**
 * The seasons a JSON file lists on the live site, or null if it is not there.
 * A partial refresh is only ever allowed to add: the sync below cannot delete
 * a file, but it does overwrite index.json and seasons.json, and one of those
 * listing fewer seasons than the site does now would hide every missing
 * season from readers even though its file is still in the bucket.
 */
function liveSeasons(bucket, key, pick) {
  const got = spawnSync('aws', ['s3', 'cp', `s3://${bucket}/${key}`, '-'], { encoding: 'utf-8' })
  if (got.error) fail(`aws: ${got.error.message}`)
  if (got.status !== 0) return null
  return pick(JSON.parse(got.stdout))
}

if (target) {
  const checks = [
    ['data/index.json', (d) => d.seasons, readIndex().seasons],
    ['data/garbage/seasons.json', (d) => d, readJson(SEASONS_PATH)],
  ]
  for (const [key, pick, local] of checks) {
    const live = liveSeasons(target.bucket, key, pick)
    const missing = (live ?? []).filter((s) => !local.includes(s))
    if (missing.length > 0) {
      fail(
        `${key} on the live site lists ${missing.join(', ')} and the local copy does not - ` +
          `public/data/ is missing seasons; restore them (dist/data/ from the last build ` +
          `is a full copy) before deploying`,
      )
    }
  }

  // A partial refresh, so no --delete: nothing upstream has gone away, and
  // the sync must never remove a season file. The data files are named, not
  // hashed, so they get an hour at the edge plus the invalidation below.
  run('aws', [
    's3',
    'sync',
    'dist/data/',
    `s3://${target.bucket}/data/`,
    '--exclude',
    'travel/*',
    '--cache-control',
    'public, max-age=3600, must-revalidate',
    '--content-type',
    'application/json',
  ])
  run('aws', [
    'cloudfront',
    'create-invalidation',
    '--distribution-id',
    target.distribution,
    '--paths',
    '/data/*',
  ])
}

// --- summary ----------------------------------------------------------------

const index = readIndex()
const fourthDowns = index.teams.reduce(
  (sum, team) => sum + (team.summaries.find((s) => s.season === season)?.plays ?? 0),
  0,
)
const progress = index.in_progress
const lines = [`\n${season} season update`]
if (runFourth) {
  lines.push(
    `  4th downs:     ${fourthDowns} plays across ${index.teams.length} teams` +
      (progress?.season === season
        ? `, in progress through week ${progress.through_week}`
        : ', season complete'),
  )
}
if (runGarbage) {
  const gt = readJson(`public/data/garbage/${season}.json`)
  lines.push(
    `  garbage time:  ${gt.players.length} players, through week ${gt.through_week}` +
      `${gt.complete ? ', season complete' : ', in progress'}${gt.has_snaps ? '' : ', no snap counts yet'}`,
  )
}
lines.push(
  target
    ? '  deployed:      data synced and /data/* invalidated'
    : '  deployed:      no - rerun with --deploy, or follow deploymentREADME.md steps 6-8',
)
process.stdout.write(lines.join('\n') + '\n')
