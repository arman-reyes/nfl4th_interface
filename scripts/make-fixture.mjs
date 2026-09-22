/**
 * Generates stand-in 4th-down data for all 32 teams so the interface can be
 * built and reviewed before the real nfl4th output exists.
 *
 * THIS IS NOT THE MODEL. It is a crude closed-form stand-in that produces
 * fields of the right shape, scale, and internal consistency
 * (go_wp is the weighted average of its branches, go_boost is the gap to the
 * best alternative, and so on). Every file it writes is overwritten by the
 * R pipeline. index.json is stamped `"fixture": true`, which the UI surfaces.
 *
 *   node scripts/make-fixture.mjs
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { TEAMS } from './teams.mjs'

const SEASONS = [2020, 2021, 2022, 2023, 2024, 2025]
const GAMES_PER_SEASON = 17
const OUT = 'public/data'

/** Deterministic PRNG so successive runs produce the same fixture. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const logistic = (x) => 1 / (1 + Math.exp(-x))
const round = (x, d = 4) => Number(x.toFixed(d))

/** Rough expected points from a first down at `y` yards from the end zone. */
const ep = (y) => 6.05 - 0.068 * y

/**
 * Win probability for the team with the ball, given the score margin and the
 * field position it is about to hand over or keep. Margins matter more as the
 * clock drains, which is what `scale` encodes.
 */
function wp(margin, y, secondsLeft) {
  const scale = 4 + 10 * Math.sqrt(Math.max(secondsLeft, 0) / 3600)
  return logistic((margin + ep(y)) / scale)
}

/** Same situation seen from the defense, converted back to our win probability. */
const wpAfterTurnover = (margin, oppY, secondsLeft) => 1 - wp(-margin, oppY, secondsLeft)

const firstDownProb = (ytg) => logistic(0.78 - 0.26 * ytg)
const fgMakeProb = (distance) => logistic((57 - distance) / 4.5)

function goBranches(margin, y, ytg, secondsLeft) {
  const succeed = wp(margin, Math.max(y - ytg, 1), secondsLeft)
  const fail = wpAfterTurnover(margin, 100 - y, secondsLeft)
  const p = firstDownProb(ytg)
  return { p, succeed, fail, go: p * succeed + (1 - p) * fail }
}

function buildPlay(rand, posteam, defteam, season, week, gameId) {
  // Most 4th downs happen in your own half, but a real share are in scoring
  // territory, where the field-goal option exists and the punt one does not.
  const y =
    rand() < 0.32
      ? 1 + Math.floor(rand() ** 0.85 * 45)
      : 46 + Math.floor(rand() ** 0.8 * 54)
  const ydstogo = Math.min(Math.max(1, Math.round(1 + 9 * rand() ** 1.15)), Math.max(1, y - 1))
  const qtr = 1 + Math.floor(rand() * 4)
  const quarterSeconds = Math.round(rand() * 900)
  const secondsLeft = (4 - qtr) * 900 + quarterSeconds
  const margin = Math.round((rand() - 0.5) * 24)

  const branches = goBranches(margin, y, ydstogo, secondsLeft)

  const fgDistance = y + 17
  let fgMake = null
  let makeFgWp = null
  let missFgWp = null
  let fgWp = null
  if (fgDistance <= 63) {
    fgMake = fgMakeProb(fgDistance)
    makeFgWp = wpAfterTurnover(margin + 3, 75, secondsLeft)
    missFgWp = wpAfterTurnover(margin, 100 - Math.max(y + 7, 20), secondsLeft)
    fgWp = fgMake * makeFgWp + (1 - fgMake) * missFgWp
  }

  const puntWp = y >= 33 ? wpAfterTurnover(margin, Math.min(140 - y, 80), secondsLeft) : null

  const alternatives = [fgWp, puntWp].filter((v) => v !== null)
  const bestAlternative = Math.max(...alternatives)
  const goBoost = 100 * (branches.go - bestAlternative)

  const sweep = Array.from({ length: 10 }, (_, i) => goBranches(margin, y, i + 1, secondsLeft))

  return {
    game_id: gameId,
    desc: '',
    season,
    week,
    qtr,
    quarter_seconds_remaining: quarterSeconds,
    posteam,
    defteam,
    ydstogo,
    yardline_100: y,
    score_differential: margin,
    posteam_timeouts_remaining: 3 - Math.floor(rand() * 3.4),
    defteam_timeouts_remaining: 3 - Math.floor(rand() * 3.4),
    play_type: null,
    go_boost: round(goBoost, 3),
    first_down_prob: round(branches.p),
    wp_succeed: round(branches.succeed),
    wp_fail: round(branches.fail),
    go_wp: round(branches.go),
    fg_make_prob: fgMake === null ? null : round(fgMake),
    make_fg_wp: makeFgWp === null ? null : round(makeFgWp),
    miss_fg_wp: missFgWp === null ? null : round(missFgWp),
    fg_wp: fgWp === null ? null : round(fgWp),
    punt_wp: puntWp === null ? null : round(puntWp),
    sens_go_wp: sweep.map((s) => round(s.go)),
    sens_first_down_prob: sweep.map((s) => round(s.p)),
  }
}

/** A staff's choice: conservative by default, nudged by the model's edge. */
function decide(play, rand, alpha) {
  const goable = play.fg_wp !== null || play.punt_wp !== null
  const pGo = logistic(alpha + 0.22 * play.go_boost - 0.9 - 0.13 * play.ydstogo)
  if (!goable || rand() < pGo) return rand() < 0.55 ? 'run' : 'pass'
  if (play.fg_wp !== null && (play.punt_wp === null || play.fg_wp > play.punt_wp - 0.02)) {
    return 'field_goal'
  }
  return 'punt'
}

function describe(play) {
  const side = play.yardline_100 <= 50 ? play.defteam : play.posteam
  const yard = play.yardline_100 <= 50 ? play.yardline_100 : 100 - play.yardline_100
  const spot = `${side} ${yard}`
  switch (play.play_type) {
    case 'punt':
      return `(${Math.floor(play.quarter_seconds_remaining / 60)}:00) Punt from ${spot}.`
    case 'field_goal':
      return `(${Math.floor(play.quarter_seconds_remaining / 60)}:00) ${play.yardline_100 + 17} yard field goal attempt.`
    case 'run':
      return `(${Math.floor(play.quarter_seconds_remaining / 60)}:00) Rush up the middle from ${spot}.`
    case 'pass':
      return `(${Math.floor(play.quarter_seconds_remaining / 60)}:00) Pass to the right from ${spot}.`
    default:
      return `(${Math.floor(play.quarter_seconds_remaining / 60)}:00) No play.`
  }
}

/* ---------------------------------------------------------------------------
 * Tries: the same stand-in idea for the two-point page. Each touchdown gets
 * a try priced from the margin and the clock, with the extra point a 94% kick
 * and the two-point try a coin flip, so the page has the right shape of data
 * — mostly hairline calls, a few clear ones late — before the R output exists.
 * ------------------------------------------------------------------------- */

/** Win probability after the try, with the opponent taking the kickoff. */
const wpAfterTry = (margin, secondsLeft) => wpAfterTurnover(margin, 75, secondsLeft)

function buildTry(rand, posteam, defteam, season, week, gameId, playId) {
  const qtr = 1 + Math.floor(rand() * 4)
  const quarterSeconds = Math.round(rand() * 900)
  const secondsLeft = (4 - qtr) * 900 + quarterSeconds
  // The margin after the touchdown: two-score games are common, ties less so.
  const margin = Math.round((rand() - 0.5) * 30)
  const conv_1pt = round(0.94 + (rand() - 0.5) * 0.02)
  const conv_2pt = round(0.48 + (rand() - 0.5) * 0.1)
  const wp_0 = round(wpAfterTry(margin, secondsLeft))
  const wp_1 = round(wpAfterTry(margin + 1, secondsLeft))
  const wp_2 = round(wpAfterTry(margin + 2, secondsLeft))
  const wp_go1 = round(conv_1pt * wp_1 + (1 - conv_1pt) * wp_0)
  const wp_go2 = round(conv_2pt * wp_2 + (1 - conv_2pt) * wp_0)
  return {
    game_id: gameId,
    play_id: playId,
    desc: '',
    season,
    week,
    qtr,
    quarter_seconds_remaining: quarterSeconds,
    posteam,
    defteam,
    yardline_100: 15,
    score_differential: margin,
    posteam_timeouts_remaining: 3 - Math.floor(rand() * 3.4),
    defteam_timeouts_remaining: 3 - Math.floor(rand() * 3.4),
    play_type: null,
    go_boost: round(100 * (wp_go2 - wp_go1), 3),
    conv_1pt,
    conv_2pt,
    wp_0,
    wp_1,
    wp_2,
    wp_go1,
    wp_go2,
  }
}

/** A staff's choice on a try: the kick unless the edge for two is real. */
function decideTry(play, rand, alpha) {
  const pTwo = logistic(alpha + 0.6 * play.go_boost - 2.6)
  if (rand() < pTwo) {
    play.yardline_100 = 2
    return rand() < 0.7 ? 'pass' : 'run'
  }
  return 'extra_point'
}

function describeTry(play) {
  const m = Math.floor(play.quarter_seconds_remaining / 60)
  return play.play_type === 'extra_point'
    ? `(${m}:00) Extra point is GOOD.`
    : `(${m}:00) TWO-POINT CONVERSION ATTEMPT. ${play.play_type === 'pass' ? 'Pass' : 'Rush'} from ${play.defteam} 2.`
}

rmSync(`${OUT}/teams`, { recursive: true, force: true })
mkdirSync(`${OUT}/teams`, { recursive: true })
rmSync(`${OUT}/twopt/teams`, { recursive: true, force: true })
mkdirSync(`${OUT}/twopt/teams`, { recursive: true })

TEAMS.forEach((team, index) => {
  const rand = rng(2654435761 + index * 7919)
  // Latent staff aggressiveness, spread across the league.
  const alpha = -1.7 + 2.3 * ((index * 13) % 32) / 31
  const plays = []
  const tries = []

  for (const season of SEASONS) {
    for (let game = 0; game < GAMES_PER_SEASON; game += 1) {
      const week = game + 1
      let opponent = TEAMS[Math.floor(rand() * TEAMS.length)].team_abbr
      while (opponent === team.team_abbr) {
        opponent = TEAMS[Math.floor(rand() * TEAMS.length)].team_abbr
      }
      const gameId = `${season}_${String(week).padStart(2, '0')}_${opponent}_${team.team_abbr}`
      const count = 2 + Math.floor(rand() * 6)
      for (let i = 0; i < count; i += 1) {
        const play = buildPlay(rand, team.team_abbr, opponent, season, week, gameId)
        // A small share of 4th downs are penalties or aborted snaps and carry
        // no decision; the app must drop them from agreement statistics.
        play.play_type = rand() < 0.03 ? 'no_play' : decide(play, rand, alpha)
        play.desc = describe(play)
        plays.push(play)
      }
      // A touchdown or three a game, each followed by a try.
      const touchdowns = 1 + Math.floor(rand() * 3.5)
      for (let i = 0; i < touchdowns; i += 1) {
        const t = buildTry(rand, team.team_abbr, opponent, season, week, gameId, 100 + i)
        t.play_type = decideTry(t, rand, alpha)
        t.desc = describeTry(t)
        tries.push(t)
      }
    }
  }

  plays.sort((a, b) => a.season - b.season || a.week - b.week || b.qtr - a.qtr)
  writeFileSync(`${OUT}/teams/${team.team_abbr}.json`, JSON.stringify(plays))
  tries.sort((a, b) => a.season - b.season || a.week - b.week || b.qtr - a.qtr)
  writeFileSync(`${OUT}/twopt/teams/${team.team_abbr}.json`, JSON.stringify(tries))
  process.stdout.write(
    `${team.team_abbr} ${String(plays.length).padStart(4)} plays  ${String(tries.length).padStart(4)} tries\n`,
  )
})

writeFileSync(`${OUT}/index.json`, JSON.stringify(TEAMS, null, 2))
writeFileSync(`${OUT}/twopt/index.json`, JSON.stringify(TEAMS, null, 2))
process.stdout.write('\nWrote fixture team files and the raw index.json for both pipelines\n')
process.stdout.write('Next: npm run data:index && npm run data:index:twopt\n')
