# Stage 1 of the travel pipeline: every regular-season team-game since 1999
# with how far the team travelled to play it, and what happened when it got
# there - the result, the betting line it was measured against, its offensive
# stat line, and the per-game production of its skill players.
#
#   Rscript scripts/travel.R              # SEASONS below
#   Rscript scripts/travel.R 2016:2025    # or a range / list on the CLI
#   npm run data:travel                   # stage 2, aggregates every season
#
# No play-by-play is needed. nflreadr's schedule carries the venue, the rest
# days, the closing spread and the final score; its team and player stat tables
# are per game and join on game_id. What the schedule does not carry is where a
# venue *is*, so scripts/venues.csv holds a hand-curated latitude, longitude and
# IANA time zone for every stadium_id that has hosted a game - 62 of them - and
# this script refuses to run if a season names one it does not know.
#
# Nothing here is modelled. Distance is the great-circle distance from the
# team's home stadium that season to the venue; time zones crossed is the
# difference in UTC offset on the day of the game, so daylight saving and
# Arizona are handled by the tz database rather than by a table of exceptions.

library(nflreadr)   # 1.5.1
library(dplyr)
library(purrr)
library(jsonlite)

# 1999 is the floor of nflreadr's schedules with betting lines. Kickoff times
# are missing for that one season, so its rows carry a null body-clock hour and
# the file says so with `has_kickoff`.
SEASONS <- 1999:2025

POSITIONS <- c("QB", "RB", "WR", "TE")
MIN_GAMES <- 4     # a player needs this many games in a season to be kept

# The column order of every player game row after the game index. The client
# asserts this on load; it is the one contract R and TypeScript share.
STATS <- c("pts_std", "rec", "pass_yds", "pass_td", "int",
           "rush_yds", "rush_td", "rec_yds", "rec_td")

# A team's home base is the modal venue of its home games that season. Below
# this share of them the modal venue is not a base - it would mean a season
# spent scattered across grounds, which has not happened, and the gate exists
# so it cannot happen silently.
MIN_BASE_SHARE <- 0.5

# Share of team-games allowed to be missing an offensive stat line. nflverse's
# team stats are complete from 2003. Before that a handful of games are absent
# (two in 1999, two in 2000) and the Jaguars' home games of 2001 and 2002 have
# no JAX row at all - and the visitor's row in those games carries both teams'
# plays lumped together, so a game missing either side is nulled on both. A
# season that loses more than this is a broken join, not a gap in the source.
MAX_STATLESS <- 0.04   # 2001 lands at 16 of 496

venues <- read.csv("scripts/venues.csv", stringsAsFactors = FALSE)
stopifnot(!anyDuplicated(venues$stadium_id))

z <- function(x) ifelse(is.na(x), 0, x)

# Great-circle miles between two points.
haversine <- function(lat1, lon1, lat2, lon2) {
  to_rad <- pi / 180
  dlat <- (lat2 - lat1) * to_rad
  dlon <- (lon2 - lon1) * to_rad
  a <- sin(dlat / 2)^2 + cos(lat1 * to_rad) * cos(lat2 * to_rad) * sin(dlon / 2)^2
  2 * 3958.8 * asin(pmin(1, sqrt(a)))
}

# UTC offset in hours of each (date, tz) pair, at noon local time on that date.
# Vectorised over both because a season's rows span many venues; the tz
# database does the daylight-saving arithmetic.
utc_offset <- function(dates, tzs) {
  tzs <- rep_len(tzs, length(dates))
  key <- paste(dates, tzs)
  uniq <- !duplicated(key)
  off <- vapply(which(uniq), function(i) {
    stamp <- as.POSIXct(paste(dates[i], "12:00"), tz = tzs[i])
    raw <- format(stamp, "%z")                      # "-0500"
    sign <- if (substr(raw, 1, 1) == "-") -1 else 1
    sign * (as.numeric(substr(raw, 2, 3)) + as.numeric(substr(raw, 4, 5)) / 60)
  }, numeric(1))
  unname(setNames(off, key[uniq])[key])
}

build_season <- function(season) {
  message(sprintf("== %d", season))

  sched <- load_schedules(season) |>
    filter(game_type == "REG") |>
    # The schedule keeps the codes of the day (STL, SD, OAK); the stat tables and
    # the app's colour table use the franchise's current one.
    mutate(home_team = clean_team_abbrs(home_team),
           away_team = clean_team_abbrs(away_team))

  if (anyNA(sched$home_score) || anyNA(sched$away_score)) {
    stop("season has games without a final score; is it still in progress?")
  }
  if (anyNA(sched$spread_line)) stop("season has games without a spread line")
  if (anyNA(sched$home_rest) || anyNA(sched$away_rest)) stop("season has games without rest days")

  unknown <- setdiff(unique(sched$stadium_id), venues$stadium_id)
  if (length(unknown) > 0) {
    stop("venues missing from scripts/venues.csv: ",
         paste(sprintf("%s (%s)", unknown,
                       sched$stadium[match(unknown, sched$stadium_id)]), collapse = ", "))
  }

  # One row per team per game, from that team's side.
  common <- function(d) d |> transmute(game_id, week, gameday, weekday, gametime,
                                       venue = stadium_id, neutral = location == "Neutral")
  long <- bind_rows(
    common(sched) |> mutate(team = sched$home_team, opp = sched$away_team,
                            site = if_else(neutral, "neutral", "home"),
                            pf = sched$home_score, pa = sched$away_score,
                            line = sched$spread_line,
                            rest = sched$home_rest, opp_rest = sched$away_rest),
    common(sched) |> mutate(team = sched$away_team, opp = sched$home_team,
                            site = if_else(neutral, "neutral", "away"),
                            pf = sched$away_score, pa = sched$home_score,
                            line = -sched$spread_line,
                            rest = sched$away_rest, opp_rest = sched$home_rest)
  ) |> select(-neutral) |> arrange(week, game_id, desc(site == "home"))

  # Home base: the venue a team played most of its home games in. Relocations
  # and temporary homes (the 2005 Saints, the Bills in Toronto) fall out of this
  # with no hand mapping, because the base is a fact of each season.
  home_games <- long |> filter(site == "home") |> count(team, venue)
  bases <- home_games |> group_by(team) |>
    mutate(share = n / sum(n)) |>
    slice_max(n, n = 1, with_ties = FALSE) |>
    ungroup() |> select(team, base = venue, base_share = share)
  weak <- bases |> filter(base_share < MIN_BASE_SHARE)
  if (nrow(weak) > 0) {
    stop("no clear home base for ", paste(weak$team, collapse = ", "))
  }
  homeless <- setdiff(unique(long$team), bases$team)
  if (length(homeless) > 0) stop("teams with no home games: ", paste(homeless, collapse = ", "))

  v <- venues |> select(stadium_id, lat, lon, tz)
  long <- long |>
    left_join(bases |> select(team, base), by = "team") |>
    left_join(v |> rename(venue = stadium_id, v_lat = lat, v_lon = lon, v_tz = tz), by = "venue") |>
    left_join(v |> rename(base = stadium_id, b_lat = lat, b_lon = lon, b_tz = tz), by = "base") |>
    mutate(
      miles = round(haversine(b_lat, b_lon, v_lat, v_lon)),
      tz = utc_offset(gameday, v_tz) - utc_offset(gameday, b_tz),
      # Kickoff on the team's own clock: the schedule's time is Eastern.
      kickoff = as.numeric(substr(gametime, 1, 2)) + as.numeric(substr(gametime, 4, 5)) / 60,
      body_hour = round(kickoff + utc_offset(gameday, b_tz) - utc_offset(gameday, "America/New_York"), 2),
      weekday = substr(weekday, 1, 3)
    )

  # Offence from the per-game team stats. Sacks count as plays because they are
  # dropbacks the EPA already charges for.
  ts <- load_team_stats(season) |>
    filter(season_type == "REG") |>
    transmute(game_id, team,
              pass_yds = z(passing_yards), rush_yds = z(rushing_yards),
              plays = z(attempts) + z(carries) + z(sacks_suffered),
              epa = round(z(passing_epa) + z(rushing_epa), 3),
              turnovers = z(passing_interceptions) + z(fumbles_lost_total),
              penalties = z(penalties), pen_yds = z(penalty_yards),
              sacks = z(sacks_suffered))
  if (anyDuplicated(ts[, c("game_id", "team")])) stop("team stats carry duplicate game rows")
  long <- long |> left_join(ts, by = c("game_id", "team"))
  broken <- unique(long$game_id[is.na(long$plays)])
  long <- long |> mutate(across(pass_yds:sacks, \(x) if_else(game_id %in% broken, NA, x)))
  statless <- sum(is.na(long$plays))
  if (statless / nrow(long) > MAX_STATLESS) {
    stop(sprintf("%d of %d team-games have no offensive stat line", statless, nrow(long)))
  }
  if (statless > 0) message(sprintf("  %d team-game(s) without an offensive stat line", statless))

  games <- long |>
    transmute(game_id, week, team, opp, site, venue, miles, tz, body_hour,
              rest, opp_rest, weekday, pf, pa, line,
              pass_yds, rush_yds, plays, epa, turnovers, penalties, pen_yds, sacks) |>
    mutate(idx = row_number() - 1L)   # the index a player row points at

  # Skill players, one row per game, pointed at the game row so the client can
  # read the trip off the team's row instead of carrying it twice.
  ps <- load_player_stats(season) |>
    filter(season_type == "REG", !is.na(player_id), position %in% POSITIONS) |>
    transmute(id = player_id, name = player_display_name, pos = position, team, week, game_id,
              pts_std = z(fantasy_points), rec = z(receptions),
              pass_yds = z(passing_yards), pass_td = z(passing_tds), int = z(passing_interceptions),
              rush_yds = z(rushing_yards), rush_td = z(rushing_tds),
              rec_yds = z(receiving_yards), rec_td = z(receiving_tds)) |>
    inner_join(games |> select(game_id, team, idx), by = c("game_id", "team"))
  if (anyDuplicated(ps[, c("id", "game_id")])) stop("player stats carry duplicate game rows")

  counted <- ps |> count(id, name = "games") |> filter(games >= MIN_GAMES)
  ps <- ps |> semi_join(counted, by = "id") |> arrange(id, week)
  latest <- ps |> group_by(id) |> slice_max(week, n = 1, with_ties = FALSE) |>
    ungroup() |> select(id, name, pos, team)
  totals <- ps |> group_by(id) |> summarise(total = sum(pts_std), .groups = "drop")
  roster <- latest |> left_join(totals, by = "id") |> arrange(pos, desc(total), id)
  by_id <- split(ps, ps$id)

  player_json <- pmap(roster |> select(id, name, pos, team), function(id, name, pos, team) {
    r <- by_id[[id]]
    list(id = id, name = name, pos = pos, team = team,
         # [game index, 9 stats]. I() keeps jsonlite from unboxing a length-1
         # vector, which cannot happen at this width but costs nothing to forbid.
         rows = map(seq_len(nrow(r)), \(i) I(c(r$idx[i], as.numeric(unlist(r[i, STATS]))))))
  })

  used <- venues |> filter(stadium_id %in% unique(games$venue)) |>
    transmute(id = stadium_id, name, lat, lon, country)
  base_json <- bases |> left_join(venues |> select(stadium_id, name), by = c("base" = "stadium_id")) |>
    transmute(team, venue = base, name) |> arrange(team)

  out <- list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    season = season,
    has_kickoff = !all(is.na(games$body_hour)),
    stats = STATS,
    venues = used,
    bases = base_json,
    games = games |> select(-idx),
    players = player_json
  )

  path <- sprintf("public/data/travel/%d.json", season)
  write_json(out, path, auto_unbox = TRUE, na = "null", digits = 4, dataframe = "rows")
  message(sprintf("  wrote %s: %d team-games, %d players, %d venues, %.0f KB",
                  path, nrow(games), length(player_json), nrow(used), file.size(path) / 1024))
  season
}

args <- commandArgs(trailingOnly = TRUE)
if (length(args) > 0) SEASONS <- sort(unique(unlist(lapply(args, \(a) eval(parse(text = a))))))

dir.create("public/data/travel", recursive = TRUE, showWarnings = FALSE)
message("Seasons: ", paste(SEASONS, collapse = ", "))
done <- keep(SEASONS, function(s) {
  tryCatch({ build_season(s); TRUE },
           error = function(e) { message("  SKIPPED ", s, ": ", conditionMessage(e)); FALSE })
})

# Only seasons that passed every gate are offered to the app.
existing <- as.integer(sub("\\.json$", "",
                           list.files("public/data/travel", pattern = "^\\d{4}\\.json$")))
write_json(sort(existing, decreasing = TRUE), "public/data/travel/seasons.json")
message("\nWrote public/data/travel/. Shipped: ", paste(sort(existing, decreasing = TRUE), collapse = ", "))
