# Stage 1 of the data pipeline: pull six seasons of 4th downs from nfl4th and
# write them out as one JSON file per team, plus the raw team metadata.
#
#   Rscript scripts/extract.R
#   npm run data:index      # stage 2, adds the precomputed summaries
#
# Nothing here fits or approximates a model; add_4th_probs() has already run
# inside load_4th_pbp() and we are only selecting its output columns.

library(nfl4th)
library(nflreadr)
library(dplyr)
library(purrr)
library(jsonlite)

plays <- nfl4th::load_4th_pbp(2020:2025) |>
  filter(down == 4, !is.na(posteam), !is.na(go_boost)) |>
  select(game_id, desc, season, week, qtr, quarter_seconds_remaining,
         posteam, defteam, ydstogo, yardline_100, score_differential,
         posteam_timeouts_remaining, defteam_timeouts_remaining, play_type,
         go_boost, first_down_prob, wp_fail, wp_succeed, go_wp,
         fg_make_prob, make_fg_wp, miss_fg_wp, fg_wp, punt_wp)

dir.create("public/data/teams", recursive = TRUE, showWarnings = FALSE)

walk(unique(plays$posteam), function(tm) {
  plays |>
    filter(posteam == tm) |>
    write_json(sprintf("public/data/teams/%s.json", tm),
               auto_unbox = TRUE, na = "null")
})

nflreadr::load_teams() |>
  filter(team_abbr %in% unique(plays$posteam)) |>
  select(team_abbr, team_name, team_conf, team_division,
         team_color, team_color2) |>
  write_json("public/data/index.json", auto_unbox = TRUE, na = "null")

message("Wrote public/data/. Next: npm run data:index")
