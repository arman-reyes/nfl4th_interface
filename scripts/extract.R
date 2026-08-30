# Stage 1 of the data pipeline: pull 4th downs from nfl4th and write them out
# as one JSON file per team, plus the raw team metadata.
#
#   Rscript scripts/extract.R
#   npm run data:index      # stage 2, adds the precomputed summaries
#
# Nothing here fits or approximates a model. add_4th_probs() is nfl4th's own
# function; this script only selects its output columns and reshapes them.
#
# Seasons are processed one at a time and reduced to 4th downs immediately,
# because a full play-by-play frame for six seasons does not want to be in
# memory all at once.

library(nfl4th)
library(nflreadr)
library(dplyr)
library(purrr)
library(jsonlite)

SEASONS <- 2020:2025

KEEP <- c(
  "game_id", "play_id", "desc", "season", "week", "qtr",
  "quarter_seconds_remaining", "posteam", "defteam", "ydstogo", "yardline_100",
  "score_differential", "posteam_timeouts_remaining", "defteam_timeouts_remaining",
  "play_type", "go_boost", "first_down_prob", "wp_fail", "wp_succeed", "go_wp",
  "fg_make_prob", "make_fg_wp", "miss_fg_wp", "fg_wp", "punt_wp"
)

season_plays <- function(season) {
  message("Season ", season, ": loading play-by-play")
  fourth <- nflreadr::load_pbp(season) |>
    filter(down == 4)

  message("Season ", season, ": ", nrow(fourth), " fourth downs, computing probabilities")
  fourth |>
    nfl4th::add_4th_probs() |>
    filter(!is.na(posteam), !is.na(go_boost)) |>
    select(all_of(KEEP))
}

plays <- map(SEASONS, season_plays) |> list_rbind()
message("Total: ", nrow(plays), " fourth downs across ", n_distinct(plays$posteam), " teams")

dir.create("public/data/teams", recursive = TRUE, showWarnings = FALSE)

walk(sort(unique(plays$posteam)), function(tm) {
  plays |>
    filter(posteam == tm) |>
    arrange(season, week, desc(qtr)) |>
    write_json(sprintf("public/data/teams/%s.json", tm),
               auto_unbox = TRUE, na = "null", digits = 6)
})

nflreadr::load_teams() |>
  filter(team_abbr %in% unique(plays$posteam)) |>
  select(team_abbr, team_name, team_conf, team_division,
         team_color, team_color2) |>
  write_json("public/data/index.json", auto_unbox = TRUE, na = "null")

message("Wrote public/data/. Next: npm run data:index")
