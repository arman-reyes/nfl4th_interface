import type { Band, Play, TeamSummary } from '../types'
import { actualChoice, agreed, modelChoice, wpForfeited } from './decision'
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
