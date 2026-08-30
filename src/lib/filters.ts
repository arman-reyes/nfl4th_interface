import type { Play } from '../types'

/**
 * The drill-down: team, then season, then week, then quarter, then the
 * individual 4th down. Each level offers only the values the level above
 * actually contains, so no filter can lead to an empty screen.
 */

export const ALL = 'all' as const
export type All = typeof ALL

export interface PlayFilter {
  season: number
  week: number | All
  qtr: number | All
}

/** Stable identity for a play. game_id alone repeats across a team's history. */
export function playKey(play: Play): string {
  return `${play.game_id}:${play.play_id}`
}

/**
 * nflverse numbers the postseason straight on from the regular season. Coaches
 * do not call it week 21.
 */
const POSTSEASON: Record<number, string> = {
  19: 'WC',
  20: 'DIV',
  21: 'CONF',
  22: 'SB',
}

export function weekLabel(week: number): string {
  return POSTSEASON[week] ?? String(week)
}

/** "Wk 7" in the regular season, "WC" / "DIV" / "CONF" / "SB" after it. */
export function weekShortLabel(week: number): string {
  return POSTSEASON[week] ?? `Wk ${week}`
}

export function weekLongLabel(week: number): string {
  const round: Record<number, string> = {
    19: 'Wild Card',
    20: 'Divisional',
    21: 'Conference',
    22: 'Super Bowl',
  }
  return round[week] ?? `Week ${week}`
}

export function quarterLabelShort(qtr: number): string {
  return qtr >= 5 ? 'OT' : `Q${qtr}`
}

function sortedUnique(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b)
}

export function seasonsOf(plays: Play[]): number[] {
  return sortedUnique(plays.map((p) => p.season)).reverse()
}

export function weeksOf(plays: Play[], season: number): number[] {
  return sortedUnique(plays.filter((p) => p.season === season).map((p) => p.week))
}

export function quartersOf(plays: Play[], season: number, week: number | All): number[] {
  return sortedUnique(
    plays.filter((p) => p.season === season && (week === ALL || p.week === week)).map((p) => p.qtr),
  )
}

/** Plays matching the filter, in the order they were played. */
export function applyFilter(plays: Play[], filter: PlayFilter): Play[] {
  return plays
    .filter(
      (p) =>
        p.season === filter.season &&
        (filter.week === ALL || p.week === filter.week) &&
        (filter.qtr === ALL || p.qtr === filter.qtr),
    )
    .sort(
      (a, b) =>
        a.week - b.week || a.qtr - b.qtr || b.quarter_seconds_remaining - a.quarter_seconds_remaining,
    )
}

/**
 * Repairs a filter against a team's actual data: keeps the current selection
 * where it still exists, and otherwise falls back to the newest season and to
 * "all". Called whenever the team changes, so switching teams never strands
 * the user on a week the new team did not play.
 */
export function reconcile(plays: Play[], filter: PlayFilter | null): PlayFilter {
  const seasons = seasonsOf(plays)
  const season = filter && seasons.includes(filter.season) ? filter.season : (seasons[0] ?? 0)
  const weeks = weeksOf(plays, season)
  const week = filter && filter.week !== ALL && weeks.includes(filter.week) ? filter.week : ALL
  const quarters = quartersOf(plays, season, week)
  const qtr = filter && filter.qtr !== ALL && quarters.includes(filter.qtr) ? filter.qtr : ALL
  return { season, week, qtr }
}

export interface GameGroup {
  gameId: string
  week: number
  opponent: string
  /** True when the team being viewed played this one at home. */
  home: boolean
  result: GameResult | null
  plays: Play[]
}

export interface GameResult {
  /** From the viewed team's side. */
  outcome: 'W' | 'L' | 'T'
  for: number
  against: number
}

/**
 * The final score from the viewed team's side. Every play in a team file has
 * that team as `posteam`, so the offence's columns are already the right way
 * round.
 */
export function gameResult(play: Play): GameResult | null {
  const scoreFor = play.posteam_final_score
  const scoreAgainst = play.defteam_final_score
  if (scoreFor == null || scoreAgainst == null) return null
  const outcome = scoreFor > scoreAgainst ? 'W' : scoreFor < scoreAgainst ? 'L' : 'T'
  return { outcome, for: scoreFor, against: scoreAgainst }
}

/**
 * The filtered plays, grouped into the games they came from.
 *
 * A flat list repeats the opponent on every row, and the opponent is already
 * half the situation line whenever the ball is in their half. Grouping states
 * it once per game and gives a long list something to navigate by.
 * Input order is preserved, so the groups come out in the order played.
 */
export function groupByGame(plays: Play[]): GameGroup[] {
  const groups: GameGroup[] = []
  for (const play of plays) {
    const last = groups.at(-1)
    if (last && last.gameId === play.game_id) {
      last.plays.push(play)
      continue
    }
    groups.push({
      gameId: play.game_id,
      week: play.week,
      opponent: play.defteam,
      home: play.posteam_home,
      result: gameResult(play),
      plays: [play],
    })
  }
  return groups
}
