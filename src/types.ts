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
  /** Unique within a game; game_id + play_id is the stable key for a play. */
  play_id: number
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

  /** True when the offense was the home team in this game. */
  posteam_home: boolean
  /**
   * The game's *final* score, restated from the offense's side, so a team file
   * can say how a game ended without a second lookup. Null only for a game
   * with no recorded result.
   */
  posteam_final_score: number | null
  defteam_final_score: number | null

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
  /** Every 4th down in scope, including those carrying no decision. */
  plays: number
  /** The team's record over the scope, from games with a recorded result. */
  wins: number
  losses: number
  ties: number
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
  /**
   * The newest season while it is still being played: absent or null once
   * its Super Bowl is in the data. Optional because a reader can hold an
   * index built before the field existed for up to an hour after a deploy.
   */
  in_progress?: SeasonProgress | null
  teams: TeamIndexEntry[]
}

export interface SeasonProgress {
  season: number
  /** The latest week with a play in the data; midweek that week is partial. */
  through_week: number
}

/** The three things a staff can do on 4th down. */
export type Choice = 'go' | 'fg' | 'punt'

/** How strongly the model holds its recommendation. */
export type Band = 'coin flip' | 'lean' | 'clear'

/**
 * Everything a 4th-down decision is judged on: the play without its narration.
 *
 * The decision rules take this rather than a full `Play`, because none of them
 * look at `desc` — and the quiz pool ships without it on purpose. The
 * description narrates what actually happened, and the argument of this whole
 * tool is that a decision is judged on what was knowable at the snap.
 */
export type PlayFacts = Omit<Play, 'desc'>

/** A play in the quiz pool: the facts, with the outcome withheld. */
export type QuizPlay = PlayFacts

/* ---------------------------------------------------------------------------
 * Garbage time: fantasy production binned by pre-snap win probability.
 *
 * The threshold that separates garbage time from football is a control in the
 * browser, so the pipeline cannot emit totals at a fixed cut. It emits each
 * player's counting stats bucketed into narrow win-probability bins instead,
 * and the client cumulative-sums the bins below (or above) whatever the reader
 * chose. See scripts/garbage-time.R.
 * ------------------------------------------------------------------------- */

/** Which end of the win-probability scale a bin sits at. */
export type BinSide = 'trailing' | 'clean' | 'leading'

/**
 * One win-probability bucket, `lo` inclusive and `hi` exclusive.
 *
 * Exactly one bin has side 'clean'. It is the lump for everything between the
 * two extremes *and* for every play that failed the two-score margin gate —
 * which is fixed, and therefore applied in R rather than here. That is what
 * keeps the threshold control honest: no setting can make a two-minute drill
 * count as garbage.
 */
export interface GarbageBin {
  lo: number
  hi: number
  side: BinSide
}

/**
 * Column order of every StatLine. The file declares its own order and
 * `assertStatOrder` checks it against this on load, because the order is the
 * only contract the R script and this code share.
 */
export type StatKey =
  | 'pass_att'
  | 'pass_cmp'
  | 'pass_yds'
  | 'pass_td'
  | 'int'
  | 'rush_att'
  | 'rush_yds'
  | 'rush_td'
  | 'tgt'
  | 'rec'
  | 'rec_yds'
  | 'rec_td'
  | 'fum_lost'
  | 'two_pt_pass'
  | 'two_pt_score'
  | 'st_td'
  /** Touches and targets — what he was charged with, not what he played. */
  | 'plays'
  /**
   * Snaps he was on the field for.
   *
   * From nflverse participation, which lists the eleven offensive players on
   * each play, so it counts a receiver who ran a route and was never looked at.
   * Only exists from 2016; earlier seasons carry zero and set `has_snaps` false.
   */
  | 'snaps'

/**
 * Counting stats for one player in one bin, positionally encoded in StatKey
 * order. A tuple rather than an object on purpose: repeating seventeen key
 * names across ~4,600 bin rows would cost more bytes than the numbers do.
 */
export type StatLine = number[]

/** `[bin index, stats]`. Sparse and ascending; empty bins are absent. */
export type BinRow = [number, StatLine]

export type FantasyPos = 'QB' | 'RB' | 'WR' | 'TE'

export interface GarbagePlayer {
  /** gsis_id. */
  id: string
  name: string
  pos: FantasyPos
  /** The team he took the most snaps for this season, not his current one. */
  team: TeamAbbr
  /** Games in which he was charged with an attempt, target or fumble. */
  games: number
  bins: BinRow[]
}

/**
 * A team's offensive plays per bin: the opportunity denominator.
 *
 * A large garbage share means little on its own — a player on a team that spent
 * a third of the season losing by four scores had far more chance to accumulate
 * it. This is what lets the page say so instead of blaming the player.
 */
export interface GarbageTeam {
  team: TeamAbbr
  games: number
  /**
   * `[bin index, offensive plays]`. Sparse and ascending.
   *
   * The true snap count, and the denominator for every rate on the page. It is
   * not derivable from `bins` below, which sums a snap across roles — a
   * completion is an attempt and a target at once.
   */
  plays: [number, number][]
  /** The whole offense's counting stats per bin, packed like a player's. */
  bins: BinRow[]
}

export interface GarbageTimeFile {
  generated_at: string
  season: number
  /** Highest regular-season week present, so an in-progress season says so. */
  through_week: number
  complete: boolean
  /** False before 2016, where per-play participation does not exist. */
  has_snaps: boolean
  /** Index matches every BinRow and GarbageTeam.plays index. */
  bins: GarbageBin[]
  /** Index of the single 'clean' lump bin. */
  clean_bin: number
  /** Points a team must trail or lead by before a play can count as garbage. */
  margin: number
  stats: StatKey[]
  players: GarbagePlayer[]
  teams: GarbageTeam[]
}

/** Seasons that passed the pipeline's reconciliation gate, descending. */
export type GarbageSeasons = number[]
