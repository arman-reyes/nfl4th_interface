import { describe, expect, it } from 'vitest'
import {
  marginAfter,
  marginLabel,
  movedSpot,
  tryChoice,
  tryLine,
  tryModelChoice,
  tryWpForfeited,
  tryWpOf,
  TWO_POINT,
} from '../twopt'
import { band } from '../decision'
import { judgeDecision } from '../impact'
import { matrixWith, summarizeAllWith, summarizeWith } from '../metrics'
import { summarizeGamesWith } from '../games'
import { judgeWith, pickQuestionsWith, scoreRoundWith, seededRandom } from '../quiz'
import { makeTry } from './tryFixtures'

describe('tryChoice', () => {
  it('reads a kick off the extra point play type', () => {
    expect(tryChoice(makeTry({ play_type: 'extra_point' }))).toBe('kick')
  })

  it('reads a two-point try off a run or a pass', () => {
    expect(tryChoice(makeTry({ play_type: 'run' }))).toBe('two')
    expect(tryChoice(makeTry({ play_type: 'pass' }))).toBe('two')
  })

  it('returns null for anything the extract should never pass through', () => {
    expect(tryChoice(makeTry({ play_type: 'no_play' }))).toBeNull()
    expect(tryChoice(makeTry({ play_type: null }))).toBeNull()
  })
})

describe('tryModelChoice', () => {
  it('follows the sign of the headline number', () => {
    expect(tryModelChoice(makeTry({ go_boost: 0.3 }))).toBe('two')
    expect(tryModelChoice(makeTry({ go_boost: -0.3 }))).toBe('kick')
  })

  it('gives exactly zero to the kick, the default', () => {
    expect(tryModelChoice(makeTry({ go_boost: 0 }))).toBe('kick')
  })

  it('does not look at the raw win probabilities, so rounding cannot flip it', () => {
    // wp_go2 trails by a hair but the extract said go for two.
    expect(tryModelChoice(makeTry({ go_boost: 0.01, wp_go1: 0.6, wp_go2: 0.5999 }))).toBe('two')
  })
})

describe('tryWpOf and forfeited', () => {
  it('prices both options, which always exist', () => {
    const play = makeTry()
    expect(tryWpOf(play, 'kick')).toBeCloseTo(play.wp_go1, 10)
    expect(tryWpOf(play, 'two')).toBeCloseTo(play.wp_go2, 10)
  })

  it('costs nothing when the staff agreed with the model', () => {
    const play = makeTry({ play_type: 'extra_point', go_boost: -2 })
    expect(tryWpForfeited(play)).toBeCloseTo(0, 10)
  })

  it('is the gap to the better option in percentage points', () => {
    const play = makeTry({ play_type: 'extra_point', go_boost: 2, wp_go1: 0.6, wp_go2: 0.62 })
    expect(tryWpForfeited(play)).toBeCloseTo(2, 6)
  })

  it('is null for a try with no decision', () => {
    expect(tryWpForfeited(makeTry({ play_type: 'no_play' }))).toBeNull()
  })

  it('never goes negative when the staff beat the sign by a rounding hair', () => {
    const play = makeTry({ play_type: 'run', go_boost: 0.01, wp_go1: 0.6, wp_go2: 0.5999 })
    expect(tryWpForfeited(play)).toBe(0)
  })
})

describe('the score after the try', () => {
  it('adds the points to a differential stated after the touchdown', () => {
    const play = makeTry({ score_differential: -2 })
    expect(marginAfter(play, 0)).toBe(-2)
    expect(marginAfter(play, 1)).toBe(-1)
    expect(marginAfter(play, 2)).toBe(0)
  })

  it('reads out loud', () => {
    expect(marginLabel(7)).toBe('up 7')
    expect(marginLabel(0)).toBe('tied')
    expect(marginLabel(-1)).toBe('down 1')
    expect(tryLine(makeTry({ score_differential: 6 }))).toBe('Up 6 after the TD')
    expect(tryLine(makeTry({ score_differential: 0 }))).toBe('Tied after the TD')
    expect(tryLine(makeTry({ score_differential: -8 }))).toBe('Down 8 after the TD')
  })
})

describe('movedSpot', () => {
  it('says nothing about a try from the standard spot', () => {
    expect(movedSpot(makeTry({ play_type: 'extra_point', yardline_100: 15 }))).toBeNull()
    expect(movedSpot(makeTry({ play_type: 'pass', yardline_100: 2 }))).toBeNull()
  })

  it('reports a try a penalty moved', () => {
    expect(movedSpot(makeTry({ play_type: 'extra_point', yardline_100: 20 }))).toBe(20)
    expect(movedSpot(makeTry({ play_type: 'run', yardline_100: 1 }))).toBe(1)
  })
})

describe('the strength band on a try', () => {
  it('uses the same 1 and 3 point scale as a 4th down', () => {
    expect(band(TWO_POINT.boost(makeTry({ go_boost: 0.4 })))).toBe('coin flip')
    expect(band(TWO_POINT.boost(makeTry({ go_boost: -2 })))).toBe('lean')
    expect(band(TWO_POINT.boost(makeTry({ go_boost: 5 })))).toBe('clear')
  })
})

/** A try the model wanted gone for, kicked instead, costing `cost` points. */
function kickedAnyway(gameId: string, week: number, cost: number, bestWp: number, over: object = {}) {
  return makeTry({
    game_id: gameId,
    week,
    play_type: 'extra_point',
    go_boost: cost,
    wp_go2: bestWp,
    wp_go1: bestWp - cost / 100,
    ...over,
  })
}

const tries = [
  // Week 1, a loss: model said two twice, they kicked both; one in garbage time.
  kickedAnyway('g1', 1, 4, 0.5, { posteam_final_score: 17, defteam_final_score: 24 }),
  kickedAnyway('g1', 1, 0.5, 0.98, { posteam_final_score: 17, defteam_final_score: 24 }),
  // Week 2, a win: model said two, they went for it.
  makeTry({
    game_id: 'g2',
    week: 2,
    play_type: 'pass',
    go_boost: 2,
    wp_go2: 0.55,
    wp_go1: 0.53,
    posteam_final_score: 28,
    defteam_final_score: 14,
  }),
  // Week 3, a win: model said kick, they kicked.
  makeTry({
    game_id: 'g3',
    week: 3,
    play_type: 'extra_point',
    go_boost: -1.5,
    wp_go2: 0.485,
    wp_go1: 0.5,
    posteam_final_score: 20,
    defteam_final_score: 10,
  }),
  // A different season, to prove scoping works.
  makeTry({ game_id: 'g4', season: 2023, play_type: 'run', go_boost: -3 }),
]

describe('team summary through the try rules', () => {
  it('counts aggressiveness as going for two when the model preferred it', () => {
    const s = summarizeWith(TWO_POINT, tries, 2024)
    expect(s.decisions).toBe(4)
    expect(s.go_recommended).toBe(3)
    expect(s.go_taken).toBe(1)
    expect(s.aggressiveness).toBeCloseTo(1 / 3, 10)
  })

  it('measures agreement and cost the same way as a 4th down', () => {
    const s = summarizeWith(TWO_POINT, tries, 2024)
    expect(s.agreement).toBeCloseTo(0.5, 10)
    expect(s.wp_forfeited).toBeCloseTo(4.5, 6)
    expect(s.games).toBe(3)
    expect(s.wp_forfeited_per_game).toBeCloseTo(1.5, 6)
  })

  it('leads with the all-seasons row, then seasons newest first', () => {
    expect(summarizeAllWith(TWO_POINT, tries).map((s) => s.season)).toEqual([null, 2024, 2023])
  })
})

describe('the 2x2 matrix', () => {
  it('has a row and a column per try choice, kick first', () => {
    const rows = matrixWith(TWO_POINT, [])
    expect(rows.map((r) => r.model)).toEqual(['kick', 'two'])
    expect(Object.keys(rows[0].counts)).toEqual(['kick', 'two'])
  })

  it('tallies what the staff did against what the model asked', () => {
    const row = matrixWith(TWO_POINT, tries).find((r) => r.model === 'two')
    expect(row?.total).toBe(3)
    expect(row?.counts.kick).toBe(2)
    expect(row?.counts.two).toBe(1)
  })
})

describe('game roll-ups through the try rules', () => {
  it('sums what the tries gave away, and separates the live part', () => {
    const [g1] = summarizeGamesWith(TWO_POINT, tries.filter((t) => t.season === 2024))
    expect(g1.decisions).toBe(2)
    expect(g1.disagreements).toBe(2)
    expect(g1.forfeited).toBeCloseTo(4.5, 6)
    // The half-point call came at a 98% win probability and is inert.
    expect(g1.forfeitedLive).toBeCloseTo(4, 6)
  })

  it('judges a try on the model recommendation’s own win probability', () => {
    const impact = judgeDecision(TWO_POINT, tries[1])
    expect(impact?.inert).toBe(true)
    expect(impact?.state).toBe('decided')
    expect(judgeDecision(TWO_POINT, tries[2])).toBeNull()
  })
})

describe('the quiz through the try rules', () => {
  const pool = [
    ...Array.from({ length: 20 }, (_, i) => makeTry({ play_id: i, go_boost: 2 })),
    ...Array.from({ length: 20 }, (_, i) => makeTry({ play_id: 100 + i, go_boost: -2 })),
  ]

  it('deals four the model would go for two on', () => {
    const picked = pickQuestionsWith(TWO_POINT, pool, seededRandom(3))
    expect(picked).toHaveLength(10)
    expect(picked.filter((p) => tryModelChoice(p) === 'two')).toHaveLength(4)
  })

  it('scores a call the way a staff is scored', () => {
    const play = makeTry({ go_boost: 2, wp_go2: 0.55, wp_go1: 0.53 })
    expect(judgeWith(TWO_POINT, { play, choice: 'two' })).toEqual({
      model: 'two',
      matched: true,
      cost: 0,
    })
    expect(judgeWith(TWO_POINT, { play, choice: 'kick' })?.cost).toBeCloseTo(2, 6)
    expect(judgeWith(TWO_POINT, { play, choice: null })).toBeNull()
  })

  it('counts aggressiveness as going for two', () => {
    const play = makeTry({ go_boost: 2, wp_go2: 0.55, wp_go1: 0.53 })
    const score = scoreRoundWith(TWO_POINT, [
      { play, choice: 'two' },
      { play, choice: 'kick' },
      { play, choice: null },
    ])
    expect(score.decisions).toBe(2)
    expect(score.timedOut).toBe(1)
    expect(score.goRecommended).toBe(2)
    expect(score.goTaken).toBe(1)
    expect(score.forfeited).toBeCloseTo(2, 6)
  })
})

describe('the rules object', () => {
  it('names both choices, two as the aggressive one', () => {
    expect(TWO_POINT.choices).toEqual(['kick', 'two'])
    expect(TWO_POINT.aggressive).toBe('two')
    for (const choice of TWO_POINT.choices) {
      const copy = TWO_POINT.copy[choice]
      expect(copy.verb.length).toBeGreaterThan(0)
      expect(copy.label.length).toBeGreaterThan(0)
      expect(copy.did.length).toBeGreaterThan(0)
      expect(copy.past.length).toBeGreaterThan(0)
    }
  })
})
