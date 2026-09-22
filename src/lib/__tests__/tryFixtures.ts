import type { Try } from '../../types'

/**
 * A neutral try: up six after the touchdown in the third quarter, kicked,
 * with the model a hair towards going for two. Override what a test cares
 * about. The win probabilities are internally consistent — each option is
 * its two branches weighted by its conversion rate — so a test that changes
 * one should change the others with it.
 */
export function makeTry(overrides: Partial<Try> = {}): Try {
  const conv_1pt = 0.94
  const conv_2pt = 0.48
  const wp_0 = 0.6
  const wp_1 = 0.64
  const wp_2 = 0.69
  const wp_go1 = conv_1pt * wp_1 + (1 - conv_1pt) * wp_0
  const wp_go2 = conv_2pt * wp_2 + (1 - conv_2pt) * wp_0
  return {
    game_id: '2024_05_LV_KC',
    play_id: 1234,
    desc: 'test try',
    season: 2024,
    week: 5,
    qtr: 3,
    quarter_seconds_remaining: 420,
    posteam: 'KC',
    defteam: 'LV',
    yardline_100: 15,
    score_differential: 6,
    posteam_timeouts_remaining: 3,
    defteam_timeouts_remaining: 3,
    play_type: 'extra_point',
    posteam_home: true,
    posteam_final_score: 27,
    defteam_final_score: 20,
    go_boost: 100 * (wp_go2 - wp_go1),
    conv_1pt,
    conv_2pt,
    wp_0,
    wp_1,
    wp_2,
    wp_go1,
    wp_go2,
    ...overrides,
  }
}
