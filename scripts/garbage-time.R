# Stage 1 of the garbage-time pipeline: rebuild every fantasy-relevant counting
# stat from play-by-play, bucketed by the win probability the offense faced when
# the play was snapped.
#
#   Rscript scripts/garbage-time.R              # the current season
#   Rscript scripts/garbage-time.R 2016:2025    # or a range / list on the CLI
#   npm run data:garbage:check                  # stage 2, sanity-prints the output
#
# Each season is its own file and seasons.json is rebuilt from the directory,
# so a run touches only the seasons it was given; a midseason top-up is a
# single-season run. The script exits non-zero if any requested season failed
# reconciliation, and leaves whatever file that season had before in place.
#
# Why bin rather than emit totals: the threshold that separates garbage time
# from football is a control in the browser, so no single cut can be baked in.
# Binning production by win probability lets the client cumulative-sum the bins
# below whatever the reader chose, from one static file and with no
# recomputation anywhere.
#
# The two-score margin gate is NOT a control, so it is applied here: a play that
# fails it lands in the neutral lump no matter how lopsided its win probability.
# That is what stops a reader sliding the threshold until a two-minute drill
# counts as garbage.
#
# Nothing here models anything. `wp` is nflfastR's own pre-snap win probability
# and every stat is a count of plays that already happened.
#
# Set GT_CACHE to a directory to cache each season's play-by-play as .rds, which
# makes a multi-season backfill resumable. Without it every season re-downloads.
# The current season is never cached: its play-by-play changes every week.

library(nflreadr)   # 1.5.1
library(dplyr)
library(purrr)
library(tidyr)
library(jsonlite)

# 1999 is nflfastR's floor for play-by-play carrying win probability. Older
# seasons have thinner player-id coverage, so rather than guess where the data
# becomes trustworthy we run them and let the reconciliation gate below decide:
# a season that cannot rebuild nflverse's own fantasy totals does not ship.
SEASONS <- nflreadr::most_recent_season()

MARGIN    <- 9      # points behind (or ahead) before a play can count as garbage
BIN_W     <- 0.025  # bin width across the extremes
EXTREME   <- 0.30   # bins are fine-grained only inside the tails
N_TAIL    <- 12     # EXTREME / BIN_W
CLEAN_BIN <- 12     # the single lump for neutral and margin-gated plays
TOP_N     <- 120    # per position, per selection rule

# Reconciliation tolerance against nflreadr::load_player_stats().
#
# Gating on the worst single player alone cannot tell a systemic bug from one of
# nflverse's own attribution quirks, so the share of players affected is gated
# too - a dropped stat category moves hundreds of players at once, while the
# known residuals move a handful. Those residuals are two irreducible cases: how
# nflverse splits yardage on a lateral, and whether it charges a fumble on an
# aborted snap. Both are worth at most one fumble or one lateral, never a
# touchdown, which is why the ceiling sits just above 2.
#
# 2025 lands at median 0, p95 0, max 0.9, 2 of 457 players.
# 2024 lands at median 0, p95 0, max 2.0, 7 of 446 players.
TOL_P95   <- 0.2
TOL_MAX   <- 2.5
TOL_SHARE <- 0.03

# The column order of every StatLine. The client asserts this on load; it is the
# one contract R and TypeScript share and nothing else can catch a drift.
STATS <- c("pass_att", "pass_cmp", "pass_yds", "pass_td", "int",
           "rush_att", "rush_yds", "rush_td",
           "tgt", "rec", "rec_yds", "rec_td",
           "fum_lost", "two_pt_pass", "two_pt_score", "st_td", "plays", "snaps")

# Per-play participation, which is what makes a real snap count possible, only
# exists from 2016. Older seasons ship snaps of zero and a `has_snaps` flag of
# false, and the interface asks a different question of them rather than
# printing a share of nothing.
FIRST_PARTICIPATION <- 2016

# Plays that can produce a fantasy stat. Gating on play_type rather than on
# pass_attempt/rush_attempt is deliberate and load-bearing: nflfastR leaves the
# attempt flags and the player-id columns populated on a play wiped out by
# penalty, and only play_type == "no_play" marks it. Kneels and spikes are
# included because they are official rushing attempts and incompletions, and
# kneels sit almost entirely in leading garbage time - dropping them would bias
# exactly the panel this page draws.
SCRIM <- c("pass", "run", "qb_kneel", "qb_spike")
KICKS <- c("kickoff", "punt", "field_goal", "extra_point")

z <- function(x) ifelse(is.na(x), 0, x)

# The play type a row should be scored as, or NA for rows that score nothing.
#
# A play wiped out by penalty is filed as no_play, and every yardage column on it
# is NA - measured across 2024 and 2025, not a single nullified play carries
# yardage. That is what makes the second clause safe: it recovers the rare row
# that is filed as no_play but whose yardage stands anyway (a fake punt out of
# punt formation, one such play in 2024) without letting a single nullified play
# back in.
effective_type <- function(d) {
  dplyr::case_when(
    d$play_type %in% SCRIM ~ d$play_type,
    d$play_type == "no_play" & !is.na(d$rushing_yards) ~ "run",
    d$play_type == "no_play" & !is.na(d$passing_yards) ~ "pass",
    d$play_type == "no_play" & !is.na(d$receiving_yards) ~ "pass",
    TRUE ~ NA_character_
  )
}

# Bin index for a play, given the win probability of the team the player plays
# for and that team's score differential.
bin_of <- function(wp, margin) {
  dplyr::case_when(
    is.na(wp) | abs(margin) < MARGIN ~ CLEAN_BIN,
    wp < EXTREME       ~ pmin(as.integer(floor(wp / BIN_W)), N_TAIL - 1L),
    wp > (1 - EXTREME) ~ CLEAN_BIN + 1L +
                         pmin(as.integer(floor((wp - (1 - EXTREME)) / BIN_W)), N_TAIL - 1L),
    TRUE ~ CLEAN_BIN
  )
}

# The bin table the client reads. Index matches every BinRow index.
bin_table <- function() {
  low  <- map(seq_len(N_TAIL) - 1L, \(i) list(lo = i * BIN_W, hi = (i + 1) * BIN_W, side = "trailing"))
  high <- map(seq_len(N_TAIL) - 1L, \(i) list(lo = (1 - EXTREME) + i * BIN_W,
                                              hi = (1 - EXTREME) + (i + 1) * BIN_W,
                                              side = "leading"))
  c(low, list(list(lo = 0, hi = 1, side = "clean")), high)
}

# The cache file for a season, or "" when the season must not be cached: no
# GT_CACHE, or a season still being played, whose data is stale by next week.
cache_file <- function(season, kind) {
  cache <- Sys.getenv("GT_CACHE", "")
  if (!nzchar(cache) || season >= nflreadr::most_recent_season()) return("")
  file.path(cache, sprintf("%s_%d.rds", kind, season))
}

season_pbp <- function(season) {
  f <- cache_file(season, "pbp")
  if (nzchar(f) && file.exists(f)) return(readRDS(f))
  d <- nflreadr::load_pbp(season) |> filter(season_type == "REG")
  if (nzchar(f)) {
    dir.create(dirname(f), recursive = TRUE, showWarnings = FALSE)
    saveRDS(d, f)
  }
  d
}

season_participation <- function(season) {
  if (season < FIRST_PARTICIPATION) return(NULL)
  f <- cache_file(season, "part")
  if (nzchar(f) && file.exists(f)) return(readRDS(f))
  d <- tryCatch(
    nflreadr::load_participation(season) |>
      select(game_id = nflverse_game_id, play_id, offense_players),
    error = function(e) NULL
  )
  if (!is.null(d) && nzchar(f)) {
    dir.create(dirname(f), recursive = TRUE, showWarnings = FALSE)
    saveRDS(d, f)
  }
  d
}

# Snaps played, per player per bin.
#
# The only honest snap count available: participation lists the eleven players
# on the field for each play, so a player is credited whether or not the ball
# came near him. Everything else in this file counts touches and targets, which
# is a different question — a receiver can play a whole quarter of garbage time
# and be thrown at once.
snap_rows <- function(pbp, season) {
  part <- season_participation(season)
  empty <- tibble(id = character(), team = character(), bin = integer(), snaps = numeric())
  if (is.null(part)) return(empty)
  joined <- pbp |>
    filter(!is.na(ptype)) |>
    select(game_id, play_id, team = posteam, bin) |>
    inner_join(part, by = c("game_id", "play_id")) |>
    filter(!is.na(offense_players), offense_players != "")
  if (nrow(joined) == 0) return(empty)
  joined |>
    mutate(id = strsplit(offense_players, ";")) |>
    tidyr::unnest(id) |>
    filter(!is.na(id), id != "") |>
    count(id, team, bin, name = "snaps")
}

# Every fantasy event in a season, as (player, bin, counting stats).
#
# Each slice encodes an attribution rule checked against load_player_stats();
# the comments record the ones that are not obvious from the column names.
events <- function(pbp) {
  o  <- pbp |> filter(!is.na(ptype), z(two_point_attempt) == 0)
  tp <- pbp |> filter(z(two_point_attempt) == 1, two_point_conv_result == "success")

  bind_rows(
    # passing_yards is NA on every incompletion, so the coalesce is not
    # defensive - without it sum() returns NA for every passer alive.
    # Sacks are excluded: nflfastR sets pass_attempt on them, but they are not
    # official attempts and no standard format scores the lost yardage.
    o |> filter(ptype %in% c("pass", "qb_spike"), z(sack) == 0, !is.na(passer_player_id)) |>
      group_by(id = passer_player_id, team = posteam, bin) |>
      summarise(pass_att = n(), pass_cmp = sum(z(complete_pass)),
                pass_yds = sum(z(passing_yards)), pass_td = sum(z(pass_touchdown)),
                int = sum(z(interception)), .groups = "drop"),

    o |> filter(ptype %in% c("run", "qb_kneel"), !is.na(rusher_player_id)) |>
      group_by(id = rusher_player_id, team = posteam, bin) |>
      summarise(rush_att = n(), rush_yds = sum(z(rushing_yards)), .groups = "drop"),

    o |> filter(ptype == "pass", z(sack) == 0, !is.na(receiver_player_id)) |>
      group_by(id = receiver_player_id, team = posteam, bin) |>
      summarise(tgt = n(), rec = sum(z(complete_pass)),
                rec_yds = sum(z(receiving_yards)), .groups = "drop"),

    # On a lateral, receiving_yards holds only the yardage to the original
    # receiver; the rest belongs to whoever took the pitch. Yards only - a
    # lateral is not an extra reception or carry.
    o |> filter(!is.na(lateral_receiver_player_id)) |>
      group_by(id = lateral_receiver_player_id, team = posteam, bin) |>
      summarise(rec_yds = sum(z(lateral_receiving_yards)), .groups = "drop"),
    o |> filter(!is.na(lateral_rusher_player_id)) |>
      group_by(id = lateral_rusher_player_id, team = posteam, bin) |>
      summarise(rush_yds = sum(z(lateral_rushing_yards)), .groups = "drop"),

    # Scores go to td_player_id, the only column that follows a lateral to the
    # player who actually crossed the line and the only one that credits a
    # teammate recovering a fumble in the end zone.
    #
    # There is deliberately no td_team check here. It reads as an obvious guard
    # against crediting a pick-six to a receiver, but pass_touchdown and
    # rush_touchdown are already offensive-only markers - a pick-six sets
    # return_touchdown instead - so it guards nothing, and td_team is unreliable
    # in the older seasons: in 2002 a Jacksonville back's rushing touchdowns
    # carry td_team values of NYJ, PHI, HOU and WAS. Requiring the match threw
    # away six of his nine scores.
    o |> filter(z(rush_touchdown) == 1, !is.na(td_player_id)) |>
      group_by(id = td_player_id, team = posteam, bin) |> summarise(rush_td = n(), .groups = "drop"),
    o |> filter(z(pass_touchdown) == 1, !is.na(td_player_id)) |>
      group_by(id = td_player_id, team = posteam, bin) |> summarise(rec_td = n(), .groups = "drop"),

    # nflverse charges a lost fumble only to the play's rusher, receiver or
    # sacked passer. A player who fumbles after taking a lateral is charged
    # nothing, so matching their totals means matching that rule. Excluding
    # aborted snaps was tried and is wrong - nflverse charges those to the
    # player who lost the ball like any other fumble.
    o |> filter(z(fumble_lost) == 1, fumbled_1_team == posteam,
                !is.na(fumbled_1_player_id),
                fumbled_1_player_id == coalesce(rusher_player_id, "~") |
                  fumbled_1_player_id == coalesce(receiver_player_id, "~") |
                  (z(sack) == 1 & fumbled_1_player_id == coalesce(passer_player_id, "~"))) |>
      group_by(id = fumbled_1_player_id, team = posteam, bin) |> summarise(fum_lost = n(), .groups = "drop"),

    # Two-point tries carry no yardage and count as no attempt, so they are
    # excluded from every slice above and contribute only here.
    tp |> filter(!is.na(passer_player_id)) |>
      group_by(id = passer_player_id, team = posteam, bin) |> summarise(two_pt_pass = n(), .groups = "drop"),
    tp |> mutate(sid = coalesce(receiver_player_id, rusher_player_id)) |> filter(!is.na(sid)) |>
      group_by(id = sid, team = posteam, bin) |> summarise(two_pt_score = n(), .groups = "drop")
  ) |>
    mutate(st_td = 0) |>
    group_by(id, team, bin) |>
    summarise(across(everything(), \(x) sum(z(x))), .groups = "drop") |>
    mutate(plays = pass_att + rush_att + tgt)
}

# nflverse's fantasy_points_ppr, reproduced exactly. PPR minus standard is the
# reception count, so the client can score any format from these components.
ppr_of <- function(d) {
  0.04 * d$pass_yds + 4 * d$pass_td - 2 * d$int + 2 * d$two_pt_pass +
    0.1 * d$rush_yds + 6 * d$rush_td +
    0.1 * d$rec_yds + 6 * d$rec_td + 1 * d$rec + 2 * d$two_pt_score +
    6 * d$st_td - 2 * d$fum_lost
}

player_stats <- function(season) {
  ps <- nflreadr::load_player_stats(season)
  if ("season_type" %in% names(ps)) ps <- filter(ps, season_type == "REG")
  idcol <- if ("player_id" %in% names(ps)) "player_id" else "gsis_id"
  ps |> rename(id = all_of(idcol))
}

# Special-teams touchdowns, counted by nflverse and located by the play-by-play.
#
# How many a player scored comes from load_player_stats because nflverse's own
# rule for what counts is not reconstructable from the play-by-play: a kickoff
# recovered in the end zone by the kicking team counts, a muffed punt recovered
# the same way does not, and `return_touchdown` covers interception and fumble
# returns that are defensive scores. Rather than guess at that rule, take the
# count as given and use the play-by-play only to say which bin each one fell
# in. Any the play-by-play cannot place lands in the neutral lump, which is the
# conservative direction - an unplaced score is never called garbage.
st_rows <- function(pbp, ps) {
  official <- ps |> group_by(id) |>
    summarise(n = sum(z(special_teams_tds)), .groups = "drop") |> filter(n > 0)
  if (nrow(official) == 0) return(tibble(id = character(), bin = integer(), st_td = numeric()))

  cand <- pbp |>
    filter(z(touchdown) == 1, play_type %in% KICKS, !is.na(td_player_id)) |>
    # A returner plays for whichever team scored, which is not always posteam:
    # nflfastR makes posteam the receiving team on a kickoff and the punting
    # team on a punt. Read win probability from the scoring team's side.
    mutate(own = td_team == posteam,
           bin = bin_of(if_else(own, wp, def_wp),
                        if_else(own, score_differential, -score_differential))) |>
    filter(td_player_id %in% official$id) |>
    select(id = td_player_id, team = td_team, bin)

  pmap(official, function(id, n) {
    rows <- cand[cand$id == id, ]
    if (nrow(rows) >= n) return(tibble(id = id, team = rows$team[seq_len(n)],
                                       bin = rows$bin[seq_len(n)], st_td = 1))
    tibble(id = id,
           team = c(rows$team, rep(NA_character_, n - nrow(rows))),
           bin = c(rows$bin, rep(CLEAN_BIN, n - nrow(rows))),
           st_td = 1)
  }) |> list_rbind() |> group_by(id, team, bin) |>
    summarise(st_td = sum(st_td), .groups = "drop")
}

# Abort the season unless the binned stats rebuild nflverse's own totals. This
# is the check that catches a silently dropped or misattributed stat category,
# and it is the arbiter of which seasons are fit to publish.
reconcile <- function(ev, ps, keep) {
  mine <- ev |> filter(id %in% keep) |> group_by(id) |>
    summarise(across(all_of(STATS), sum), .groups = "drop")
  mine$mine <- ppr_of(mine)

  off <- ps |> group_by(id) |>
    summarise(off = sum(z(fantasy_points_ppr)), .groups = "drop")

  cmp <- inner_join(mine, off, by = "id") |> mutate(d = abs(mine - off)) |> arrange(desc(d))
  p95 <- unname(quantile(cmp$d, 0.95))
  share <- mean(cmp$d > 0.01)
  message(sprintf("  reconcile: %d players | median %.3f | p95 %.3f | max %.3f | off: %d (%.1f%%)",
                  nrow(cmp), median(cmp$d), p95, max(cmp$d), sum(cmp$d > 0.01), 100 * share))
  if (any(cmp$d > 0.01)) {
    worst <- cmp |> filter(d > 0.01) |> head(8)
    for (i in seq_len(nrow(worst))) {
      message(sprintf("    %s  mine %.1f  official %.1f  diff %+.1f",
                      worst$id[i], worst$mine[i], worst$off[i], worst$mine[i] - worst$off[i]))
    }
  }
  if (p95 > TOL_P95 || max(cmp$d) > TOL_MAX || share > TOL_SHARE) {
    stop(sprintf("fails reconciliation (p95 %.3f/%.2f, max %.3f/%.2f, share %.3f/%.2f)",
                 p95, TOL_P95, max(cmp$d), TOL_MAX, share, TOL_SHARE))
  }
  invisible(TRUE)
}

build_season <- function(season) {
  message("Season ", season, ": loading play-by-play")
  pbp <- season_pbp(season) |> filter(!is.na(posteam))
  pbp <- pbp |> mutate(bin = bin_of(wp, score_differential), ptype = effective_type(pbp))
  message("  ", nrow(pbp), " regular-season plays")

  ps <- player_stats(season)
  # Every event carries the offense it happened for, so the same attribution
  # produces the player rows and the team rows and the two cannot disagree.
  snaps <- snap_rows(pbp, season)
  message("  ", nrow(snaps), " player-bin snap rows",
          if (nrow(snaps) == 0) " (no participation data for this season)" else "")
  ev_team <- bind_rows(events(pbp), st_rows(pbp, ps), snaps) |>
    group_by(id, team, bin) |> summarise(across(everything(), \(x) sum(z(x))), .groups = "drop")
  ev <- ev_team |> group_by(id, bin) |>
    summarise(across(all_of(STATS), sum), .groups = "drop")
  na_wp <- pbp |> filter(!is.na(ptype), is.na(wp)) |> nrow()
  message("  ", nrow(ev), " player-bin rows; ", na_wp, " scrimmage plays had no win probability")

  # Season-scoped, so a 2016 file labels players with their 2016 position and
  # not whatever they play today. FB and HB are RB for fantasy purposes.
  roster <- nflreadr::load_rosters(season) |>
    transmute(id = gsis_id, name = full_name,
              pos = case_when(position %in% c("FB", "HB") ~ "RB", TRUE ~ position)) |>
    filter(!is.na(id), pos %in% c("QB", "RB", "WR", "TE")) |>
    distinct(id, .keep_all = TRUE)

  totals <- ev |> group_by(id) |> summarise(across(all_of(STATS), sum), .groups = "drop")
  totals$actual <- ppr_of(totals)
  # The most aggressive cleaning the UI can ask for: everything but the lump.
  cleanest <- ev |> filter(bin == CLEAN_BIN) |> group_by(id) |>
    summarise(across(all_of(STATS), sum), .groups = "drop")
  cleanest$clean <- ppr_of(cleanest)

  ranked <- totals |> select(id, actual) |>
    left_join(select(cleanest, id, clean), by = "id") |>
    mutate(clean = z(clean)) |>
    inner_join(roster, by = "id")

  # Top by actual points alone would structurally exclude the players this page
  # is about at the other end - someone 108th on actual but 82nd once cleaned is
  # exactly the story, and he would not be in the file. Take the union.
  keep <- bind_rows(
    ranked |> group_by(pos) |> slice_max(actual, n = TOP_N, with_ties = FALSE) |> ungroup(),
    ranked |> group_by(pos) |> slice_max(clean,  n = TOP_N, with_ties = FALSE) |> ungroup()
  ) |> distinct(id, .keep_all = TRUE)

  reconcile(ev, ps, keep$id)

  # Modal posteam, not latest_team, which is wrong for anyone since traded.
  home <- bind_rows(
    pbp |> filter(!is.na(passer_player_id))   |> transmute(id = passer_player_id, posteam, game_id),
    pbp |> filter(!is.na(rusher_player_id))   |> transmute(id = rusher_player_id, posteam, game_id),
    pbp |> filter(!is.na(receiver_player_id)) |> transmute(id = receiver_player_id, posteam, game_id)
  )
  team_of <- home |> count(id, posteam) |> group_by(id) |>
    slice_max(n, n = 1, with_ties = FALSE) |> ungroup() |> select(id, team = posteam)
  games_of <- home |> distinct(id, game_id) |> count(id, name = "games")

  # Best actual scorer first within each position, so the file has a sensible
  # order even before the client ranks it.
  players <- keep |> select(id, name, pos, actual) |>
    left_join(team_of, by = "id") |> left_join(games_of, by = "id") |>
    mutate(team = coalesce(team, "UNK"), games = z(games)) |>
    arrange(pos, desc(actual), id) |>
    select(id, name, pos, team, games)

  rows_of <- ev |> filter(id %in% keep$id) |> arrange(id, bin)
  by_id <- split(rows_of, rows_of$id)

  player_json <- pmap(players, function(id, name, pos, team, games) {
    r <- by_id[[id]]
    list(id = id, name = name, pos = pos, team = team, games = games,
         # [bin, [17 stats]]. I() keeps jsonlite from unboxing a length-1 vector
         # and quietly turning a StatLine into a scalar.
         bins = map(seq_len(nrow(r)), \(i)
                    list(r$bin[i], I(as.numeric(unlist(r[i, STATS]))))))
  })

  # Two things per team, because they answer different questions and only one
  # of them can be counted from the events. `plays` is the true snap count and
  # is the denominator for every rate on the page; the stat lines are the sum of
  # everything the offense did, which double-counts a snap across roles (a
  # completion is an attempt and a target) and so cannot stand in for it.
  team_plays <- pbp |> filter(!is.na(ptype)) |> count(posteam, bin)
  team_games <- pbp |> distinct(posteam, game_id) |> count(posteam, name = "games")
  team_stats <- ev_team |> filter(!is.na(team)) |> group_by(team, bin) |>
    summarise(across(all_of(STATS), sum), .groups = "drop") |> arrange(team, bin)

  team_json <- team_plays |> group_by(posteam) |>
    group_map(\(d, k) {
      lines <- team_stats[team_stats$team == k$posteam, ]
      list(
        team = k$posteam,
        games = team_games$games[team_games$posteam == k$posteam],
        plays = map(seq_len(nrow(d)), \(i) list(d$bin[i], d$n[i])),
        bins = map(seq_len(nrow(lines)), \(i)
                   list(lines$bin[i], I(as.numeric(unlist(lines[i, STATS])))))
      )
    })

  # Complete means every regular-season game has a result, read from the
  # schedule rather than inferred from the last week seen: the regular season
  # was 17 weeks through 2020 and 18 since, and midweek the newest week is
  # only partly played.
  weeks <- sort(unique(pbp$week))
  reg <- nflreadr::load_schedules(season) |> filter(game_type == "REG")
  complete <- nrow(reg) > 0 && all(!is.na(reg$result))
  message("  through week ", max(weeks), if (complete) " (season complete)" else " (season in progress)")
  out <- list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    season = season,
    through_week = max(weeks),
    complete = complete,
    has_snaps = nrow(snaps) > 0,
    bins = bin_table(),
    clean_bin = CLEAN_BIN,
    margin = MARGIN,
    stats = STATS,
    players = player_json,
    teams = team_json
  )

  path <- sprintf("public/data/garbage/%d.json", season)
  write_json(out, path, auto_unbox = TRUE, na = "null", digits = 4)
  message(sprintf("  wrote %s: %d players, %d bin rows, %.0f KB",
                  path, length(player_json), nrow(rows_of), file.size(path) / 1024))
  season
}

args <- commandArgs(trailingOnly = TRUE)
if (length(args) > 0) SEASONS <- sort(unique(unlist(lapply(args, \(a) eval(parse(text = a))))))

dir.create("public/data/garbage", recursive = TRUE, showWarnings = FALSE)
message("Seasons: ", paste(SEASONS, collapse = ", "))
done <- keep(SEASONS, function(s) {
  ok <- tryCatch({ build_season(s); TRUE },
                 error = function(e) { message("  SKIPPED ", s, ": ", conditionMessage(e)); FALSE })
  ok
})

# Only seasons that reconciled are offered to the app.
existing <- as.integer(sub("\\.json$", "",
                           list.files("public/data/garbage", pattern = "^\\d{4}\\.json$")))
write_json(sort(existing, decreasing = TRUE), "public/data/garbage/seasons.json")
message("\nWrote public/data/garbage/. Shipped: ", paste(sort(existing, decreasing = TRUE), collapse = ", "))
if (length(done) < length(SEASONS)) {
  message("Failed reconciliation: ", paste(setdiff(SEASONS, done), collapse = ", "))
  quit(save = "no", status = 1)
}
