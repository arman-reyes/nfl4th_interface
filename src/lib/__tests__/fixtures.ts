import type { Play } from '../../types'

/** A neutral 4th-down play; override the fields a test cares about. */
export function makePlay(overrides: Partial<Play> = {}): Play {
  return {
    game_id: '2024_05_LV_KC',
    play_id: 1234,
    desc: 'test play',
    season: 2024,
    week: 5,
    qtr: 3,
    quarter_seconds_remaining: 420,
    posteam: 'KC',
    defteam: 'LV',
    ydstogo: 4,
    yardline_100: 55,
    score_differential: 0,
    posteam_timeouts_remaining: 3,
    defteam_timeouts_remaining: 3,
    play_type: 'punt',
    go_boost: -1.5,
    first_down_prob: 0.48,
    wp_succeed: 0.62,
    wp_fail: 0.38,
    go_wp: 0.4952,
    fg_make_prob: null,
    make_fg_wp: null,
    miss_fg_wp: null,
    fg_wp: null,
    punt_wp: 0.5102,
    ...overrides,
  }
}
