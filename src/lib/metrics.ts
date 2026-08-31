import type { Band, Choice, Play, TeamSummary } from '../types'
import { actualChoice, agreed, modelChoice, wpForfeited } from './decision'
import { gameResult } from './filters'
import { BANDS, FIELD_ZONES, fieldZone, playBand } from './zones'
import type { FieldZone } from './zones'

/**
 * Team tendency metrics. The build script and the browser both call these
 * functions, so the numbers on the league grid and the numbers on a team
 * profile can never drift apart.
 */

export function playsInSeason(plays: Play[], season: number | null): Play[] {
  return season === null ? plays : plays.filter((p) => p.season === season)
}

export function seasonsIn(plays: Play[]): number[] {
  return [...new Set(plays.map((p) => p.season))].sort((a, b) => b - a)
}

/**
 * Aggressiveness, agreement, and win probability forfeited over one scope.
 *
 * Only plays whose `play_type` maps to a decision are counted; a 4th-down
 * penalty tells us nothing about what the staff chose.
 */
export function summarize(plays: Play[], season: number | null): TeamSummary {
  const scoped = playsInSeason(plays, season)
  const games = new Set(scoped.map((p) => p.game_id)).size

  // One result per game, not per play. A team file holds several 4th downs
  // from the same game and every one of them carries that game's final score.
  const results = new Map<string, ReturnType<typeof gameResult>>()
  for (const play of scoped) {
    if (!results.has(play.game_id)) results.set(play.game_id, gameResult(play))
  }
  let wins = 0
  let losses = 0
  let ties = 0
  for (const result of results.values()) {
    if (result === null) continue
    if (result.outcome === 'W') wins += 1
    else if (result.outcome === 'L') losses += 1
    else ties += 1
  }

  let decisions = 0
  let matched = 0
  let goRecommended = 0
  let goTaken = 0
  let forfeited = 0

  for (const play of scoped) {
    const actual = actualChoice(play)
    if (actual === null) continue
    decisions += 1
    if (agreed(play)) matched += 1
    forfeited += wpForfeited(play) ?? 0
    if (modelChoice(play) === 'go') {
      goRecommended += 1
      if (actual === 'go') goTaken += 1
    }
  }

  return {
    season,
    games,
    plays: scoped.length,
    wins,
    losses,
    ties,
    decisions,
    go_recommended: goRecommended,
    go_taken: goTaken,
    aggressiveness: goRecommended > 0 ? goTaken / goRecommended : null,
    agreement: decisions > 0 ? matched / decisions : null,
    wp_forfeited: forfeited,
    wp_forfeited_per_game: games > 0 ? forfeited / games : 0,
  }
}

/** Every season the team has plays for, most recent first, plus an all row. */
export function summarizeAll(plays: Play[]): TeamSummary[] {
  return [summarize(plays, null), ...seasonsIn(plays).map((s) => summarize(plays, s))]
}

export interface DeviationCell {
  zone: FieldZone
  band: Band
  decisions: number
  deviations: number
  /** deviations / decisions, or null for an empty cell. */
  rate: number | null
  /** Win probability forfeited inside this cell, percentage points. */
  wp_forfeited: number
}

/**
 * The 4x3 deviation grid: field zone against the strength of the model's call.
 * A cell answers "when the model made this kind of call from here, how often
 * did this staff do something else, and what did it cost?"
 */
export function deviationGrid(plays: Play[]): DeviationCell[] {
  const cells = new Map<string, DeviationCell>()
  for (const zone of FIELD_ZONES) {
    for (const b of BANDS) {
      cells.set(`${zone}|${b}`, {
        zone,
        band: b,
        decisions: 0,
        deviations: 0,
        rate: null,
        wp_forfeited: 0,
      })
    }
  }

  for (const play of plays) {
    const match = agreed(play)
    if (match === null) continue
    const cell = cells.get(`${fieldZone(play)}|${playBand(play)}`)
    if (!cell) continue
    cell.decisions += 1
    if (!match) cell.deviations += 1
    cell.wp_forfeited += wpForfeited(play) ?? 0
  }

  for (const cell of cells.values()) {
    cell.rate = cell.decisions > 0 ? cell.deviations / cell.decisions : null
  }
  return [...cells.values()]
}

export const CHOICES: readonly Choice[] = ['go', 'fg', 'punt']

export interface MatrixRow {
  /** What the model recommended. */
  model: Choice
  total: number
  /** What the staff actually did, counted. */
  counts: Record<Choice, number>
}

/**
 * What the staff did against what the model asked for, as a 3x3 tally.
 *
 * The diagonal is agreement; everything off it is where a staff's habits show.
 * Reading a row answers the question a scout actually has: "when the model
 * wanted them to go, what did they do instead?"
 */
export function choiceMatrix(plays: Play[]): MatrixRow[] {
  const rows: MatrixRow[] = CHOICES.map((model) => ({
    model,
    total: 0,
    counts: { go: 0, fg: 0, punt: 0 },
  }))

  for (const play of plays) {
    const actual = actualChoice(play)
    if (actual === null) continue
    const row = rows.find((r) => r.model === modelChoice(play))
    if (!row) continue
    row.total += 1
    row.counts[actual] += 1
  }
  return rows
}
