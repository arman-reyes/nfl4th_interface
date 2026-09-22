# Stage 1 of the two-point pipeline: pull every try — extra point or two-point
# attempt — from nflfastR, price both options with nfl4th, and write them out
# as one JSON file per team, plus the raw team metadata.
#
#   Rscript scripts/extract-2pt.R          # every season, 2015 to the current one
#   Rscript scripts/extract-2pt.R 2026     # or a season / range / list on the CLI
#   npm run data:index:twopt               # stage 2, adds the precomputed summaries
#
# Nothing here fits or approximates a model. add_2pt_probs() is nfl4th's own
# function; this script only selects its output columns and reshapes them.
#
# The shape mirrors scripts/extract.R on purpose: seasons are processed one at
# a time and reduced to tries immediately, and whatever seasons were asked for
# are merged into the team files rather than written over them, so a
# midseason top-up is a two-minute job and a single-season run cannot lose the
# rest.

library(nfl4th)
library(nflreadr)
library(dplyr)
library(purrr)
library(jsonlite)

# 2015 is the floor, and it is a modelling floor rather than a data one: that
# is the season the extra point moved back to the 15, and nfl4th prices every
# kick from there. Before 2015 the kick was a 99.5% snap from the 2, and the
# model would be pricing a decision that no staff faced.
SEASONS <- 2015:nflreadr::most_recent_season()

args <- commandArgs(trailingOnly = TRUE)
if (length(args) > 0) SEASONS <- sort(unique(unlist(lapply(args, \(a) eval(parse(text = a))))))

TEAM_DIR   <- "public/data/twopt/teams"
INDEX_PATH <- "public/data/twopt/index.json"

KEEP <- c(
  "game_id", "play_id", "desc", "season", "week", "qtr",
  "quarter_seconds_remaining", "posteam", "defteam", "yardline_100",
  "score_differential", "posteam_timeouts_remaining", "defteam_timeouts_remaining",
  "play_type", "posteam_home", "posteam_final_score", "defteam_final_score",
  "go_boost", "conv_1pt", "conv_2pt", "wp_0", "wp_1", "wp_2", "wp_go1", "wp_go2"
)

if (file.exists(INDEX_PATH)) {
  existing_index <- jsonlite::fromJSON(INDEX_PATH, simplifyVector = FALSE)
  if (!is.null(existing_index$fixture) && isTRUE(existing_index$fixture)) {
    stop(INDEX_PATH, " holds fixture data (npm run data:fixture). ",
         "Delete public/data/twopt/ and run a full extract instead of merging into it.")
  }
}

season_tries <- function(season) {
  message("Season ", season, ": loading play-by-play")
  # A try is any play that records a result for the kick or the two-point
  # attempt. A try wiped out by penalty records neither and is replayed, so
  # the attempt that stood is the one in the data.
  tries <- nflreadr::load_pbp(season) |>
    filter(!is.na(extra_point_result) | !is.na(two_point_conv_result))

  message("Season ", season, ": ", nrow(tries), " tries, computing probabilities")
  scored <- tries |>
    nfl4th::add_2pt_probs() |>
    filter(!is.na(posteam))

  # nfl4th prices nothing inside the last fifteen seconds or in overtime: a
  # try with the clock gone cannot change who wins. Those rows come back NA
  # and are dropped, and the log says how many.
  unscored <- scored |> filter(is.na(wp_go1))
  if (nrow(unscored) > 0) {
    message("Season ", season, ": dropping ", nrow(unscored), " tries nfl4th did not price across ",
            n_distinct(unscored$game_id), " games")
  }

  scored |>
    filter(!is.na(wp_go1)) |>
    mutate(
      # The headline number, restated the way nfl4th states go_boost for a
      # 4th down: the win probability points gained by going for two rather
      # than kicking. Its sign is the model's recommendation.
      go_boost = 100 * (wp_go2 - wp_go1),
      posteam_home = posteam == home_team,
      posteam_final_score = if_else(posteam == home_team, home_score, away_score),
      defteam_final_score = if_else(posteam == home_team, away_score, home_score)
    ) |>
    select(all_of(KEEP))
}

read_team <- function(tm) {
  path <- file.path(TEAM_DIR, paste0(tm, ".json"))
  if (!file.exists(path)) return(NULL)
  jsonlite::fromJSON(path) |>
    as_tibble() |>
    select(all_of(KEEP)) |>
    filter(!(season %in% SEASONS))
}

tries <- map(SEASONS, season_tries) |> list_rbind()
message("Total: ", nrow(tries), " tries across ", n_distinct(tries$posteam), " teams in ",
        paste(SEASONS, collapse = ", "))

dir.create(TEAM_DIR, recursive = TRUE, showWarnings = FALSE)

existing_teams <- sub("[.]json$", "", list.files(TEAM_DIR, pattern = "^[A-Z]{2,3}[.]json$"))
teams <- sort(union(existing_teams, unique(tries$posteam)))

walk(teams, function(tm) {
  merged <- bind_rows(read_team(tm), tries |> filter(posteam == tm)) |>
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

message("Wrote public/data/twopt/. Next: npm run data:index:twopt")
