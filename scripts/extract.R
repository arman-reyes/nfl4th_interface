# Stage 1 of the data pipeline: pull 4th downs from nfl4th and write them out
# as one JSON file per team, plus the raw team metadata.
#
#   Rscript scripts/extract.R              # every season, 2014 to the current one
#   Rscript scripts/extract.R 2026         # or a season / range / list on the CLI
#   npm run data:index                     # stage 2, adds the precomputed summaries
#
# Nothing here fits or approximates a model. add_4th_probs() is nfl4th's own
# function; this script only selects its output columns and reshapes them.
#
# Seasons are processed one at a time and reduced to 4th downs immediately,
# because a full play-by-play frame for a dozen seasons does not want to be in
# memory all at once.
#
# Whatever seasons were asked for are merged into the team files, not written
# over them: rows for those seasons are replaced and every other season is
# kept. That is what makes a midseason top-up a four-minute job rather than a
# fifty-minute rebuild, and it is also why running a single season by mistake
# cannot lose the rest.

library(nfl4th)
library(nflreadr)
library(dplyr)
library(purrr)
library(jsonlite)

# 2014 is nfl4th's floor: load_4th_pbp() refuses anything earlier, and the
# precomputed release assets start there too. nflreadr standardises historical
# team codes on the way through, so the pre-relocation seasons arrive as LA,
# LAC and LV rather than STL, SD and OAK, and a team file stays franchise-
# continuous without any mapping here.
SEASONS <- 2014:nflreadr::most_recent_season()

args <- commandArgs(trailingOnly = TRUE)
if (length(args) > 0) SEASONS <- sort(unique(unlist(lapply(args, \(a) eval(parse(text = a))))))

TEAM_DIR   <- "public/data/teams"
INDEX_PATH <- "public/data/index.json"

KEEP <- c(
  "game_id", "play_id", "desc", "season", "week", "qtr",
  "quarter_seconds_remaining", "posteam", "defteam", "ydstogo", "yardline_100",
  "score_differential", "posteam_timeouts_remaining", "defteam_timeouts_remaining",
  "play_type", "posteam_home", "posteam_final_score", "defteam_final_score",
  "go_boost", "first_down_prob", "wp_fail", "wp_succeed", "go_wp",
  "fg_make_prob", "make_fg_wp", "miss_fg_wp", "fg_wp", "punt_wp"
)

# A merge into fixture data would put real 2026 rows beside invented ones and
# stamp the whole thing as real. Refuse before anything is downloaded.
if (file.exists(INDEX_PATH)) {
  existing_index <- jsonlite::fromJSON(INDEX_PATH, simplifyVector = FALSE)
  if (!is.null(existing_index$fixture) && isTRUE(existing_index$fixture)) {
    stop(INDEX_PATH, " holds fixture data (npm run data:fixture). ",
         "Delete public/data/ and run a full extract instead of merging into it.")
  }
}

season_plays <- function(season) {
  message("Season ", season, ": loading play-by-play")
  fourth <- nflreadr::load_pbp(season) |>
    filter(down == 4)

  message("Season ", season, ": ", nrow(fourth), " fourth downs, computing probabilities")
  scored <- fourth |>
    nfl4th::add_4th_probs() |>
    filter(!is.na(posteam))

  # nfl4th's win probability takes the Vegas spread as an input, so a game the
  # schedule has no line for scores as NA and is dropped. Midseason that is
  # the first thing to look at if a week seems to be missing.
  unscored <- scored |> filter(is.na(go_boost))
  if (nrow(unscored) > 0) {
    message("Season ", season, ": dropping ", nrow(unscored), " fourth downs with no go_boost across ",
            n_distinct(unscored$game_id), " games (", paste(head(unique(unscored$game_id), 6), collapse = ", "),
            if (n_distinct(unscored$game_id) > 6) ", ..." else "", ")")
  }

  scored |>
    filter(!is.na(go_boost)) |>
    # home_score and away_score are the game's final scores, not the running
    # ones; restated from the offense's side so a team file needs no lookup to
    # say how the game it is looking at ended.
    mutate(
      posteam_home = posteam == home_team,
      posteam_final_score = if_else(posteam == home_team, home_score, away_score),
      defteam_final_score = if_else(posteam == home_team, away_score, home_score)
    ) |>
    select(all_of(KEEP))
}

# A team file as it stands on disk, minus the seasons about to be replaced.
# jsonlite reads the file back with the column types it wrote, so the frame
# binds cleanly with a fresh one and re-serialises byte for byte.
read_team <- function(tm) {
  path <- file.path(TEAM_DIR, paste0(tm, ".json"))
  if (!file.exists(path)) return(NULL)
  jsonlite::fromJSON(path) |>
    as_tibble() |>
    select(all_of(KEEP)) |>
    filter(!(season %in% SEASONS))
}

plays <- map(SEASONS, season_plays) |> list_rbind()
message("Total: ", nrow(plays), " fourth downs across ", n_distinct(plays$posteam), " teams in ",
        paste(SEASONS, collapse = ", "))

dir.create(TEAM_DIR, recursive = TRUE, showWarnings = FALSE)

# Every team with a file already, plus any the new seasons mention. The union
# matters midseason: a team on a bye has no plays in the fresh frame and must
# still keep its file.
existing_teams <- sub("[.]json$", "", list.files(TEAM_DIR, pattern = "^[A-Z]{2,3}[.]json$"))
teams <- sort(union(existing_teams, unique(plays$posteam)))

walk(teams, function(tm) {
  merged <- bind_rows(read_team(tm), plays |> filter(posteam == tm)) |>
    select(all_of(KEEP)) |>
    arrange(season, week, desc(qtr))
  stopifnot(identical(names(merged), KEEP),
            !anyDuplicated(merged[c("game_id", "play_id")]))
  write_json(merged, file.path(TEAM_DIR, paste0(tm, ".json")),
             auto_unbox = TRUE, na = "null", digits = 6)
})

nflreadr::load_teams() |>
  filter(team_abbr %in% teams) |>
  select(team_abbr, team_name, team_conf, team_division,
         team_color, team_color2) |>
  write_json(INDEX_PATH, auto_unbox = TRUE, na = "null")

message("Wrote public/data/. Next: npm run data:index")
