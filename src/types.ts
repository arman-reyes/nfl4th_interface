/**
 * Shapes of the static data produced by the nfl4th R pipeline, plus the
 * derived types the UI works in. Everything the interface renders traces
 * back to one of these fields or to a documented computation in src/lib.
 */

/** Three-letter nflverse team abbreviation, e.g. "KC", "LA", "WAS". */
export type TeamAbbr = string

/**
 * One 4th-down play, exactly as emitted by `nfl4th::add_4th_probs()`.
 *
 * Win-probability fields (`*_wp`) are probabilities on a 0-1 scale.
 * `go_boost` is the only field already expressed in percentage points.
 *
 * `fg_*` and `punt_*` are null where the option does not exist for the
 * situation (a field goal from midfield, a punt from the 3), so every
 * consumer must treat them as optional rather than assume three options.
 */
export interface Play {
  game_id: string
  desc: string
  season: number
  week: number
  qtr: number
  quarter_seconds_remaining: number
  posteam: TeamAbbr
  defteam: TeamAbbr
  ydstogo: number
  /** Distance to the opponent's end zone: 1 = goal line, 99 = own 1. */
  yardline_100: number
  /** From the offense's perspective. */
  score_differential: number
  posteam_timeouts_remaining: number
  defteam_timeouts_remaining: number
  /** What the staff actually did. Mapped to a Choice by `actualChoice()`. */
  play_type: string | null

  /** Win probability gained by going for it, in percentage points. */
  go_boost: number
  first_down_prob: number
  wp_succeed: number
  wp_fail: number
  go_wp: number

  fg_make_prob: number | null
  make_fg_wp: number | null
  miss_fg_wp: number | null
  fg_wp: number | null

  punt_wp: number | null

  /**
   * Optional ydstogo sweep for the sensitivity strip: `go_wp` recomputed by
   * nfl4th for this exact situation at 1..10 yards to go, index 0 = 1 yard.
   * Field goal and punt win probabilities do not depend on ydstogo, so the
   * rest of the sweep is derived from the fields above.
   * Absent until the sensitivity companion script has been run.
   */
  sens_go_wp?: number[]
  /** First-down probability across the same 1..10 sweep. */
  sens_first_down_prob?: number[]
}

/** Team metadata, straight from `nflreadr::load_teams()`. */
export interface TeamMeta {
  team_abbr: TeamAbbr
  team_name: string
  team_conf: string
  team_division: string
  team_color: string
  team_color2: string
}

/**
 * Tendency metrics for one team over one scope. `season` is a year, or
 * `null` for the all-seasons row. Precomputed at build time by
 * scripts/build-index.mjs using exactly the functions in src/lib/metrics.ts.
 */
export interface TeamSummary {
  season: number | null
  games: number
  /** 4th downs whose play_type maps to a decision. */
  decisions: number
  /** Of those, how many the model wanted the offense to go for. */
  go_recommended: number
  /** Of those go_recommended plays, how many they actually went for. */
  go_taken: number
  /** go_taken / go_recommended, or null when there were no opportunities. */
  aggressiveness: number | null
  /** Share of decisions matching the model's top option. */
  agreement: number | null
  /** Total win probability given up vs. the best option, percentage points. */
  wp_forfeited: number
  wp_forfeited_per_game: number
}

export interface TeamIndexEntry extends TeamMeta {
  /** Most recent season first; the all-seasons row has `season: null`. */
  summaries: TeamSummary[]
}

export interface LeagueIndex {
  generated_at: string
  /** Descending. */
  seasons: number[]
  /** True when the underlying play files are generated fixtures, not R output. */
  fixture: boolean
  teams: TeamIndexEntry[]
}

/** The three things a staff can do on 4th down. */
export type Choice = 'go' | 'fg' | 'punt'

/** How strongly the model holds its recommendation. */
export type Band = 'coin flip' | 'lean' | 'clear'
