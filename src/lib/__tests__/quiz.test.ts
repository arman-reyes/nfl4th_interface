import { describe, expect, it } from 'vitest'
import { judge, pickQuestions, scoreRound, seededRandom } from '../quiz'
import type { Answer } from '../quiz'
import { modelChoice } from '../decision'
import { makePlay } from './fixtures'
import type { QuizPlay } from '../../types'

/** A play the model wants gone for, worth `edge` points over the punt. */
function goPlay(id: number, edge = 4): QuizPlay {
  const { desc: _desc, ...facts } = makePlay({
    play_id: id,
    go_boost: edge,
    go_wp: 0.5 + edge / 100,
    punt_wp: 0.5,
    fg_wp: null,
  })
  return facts
}

/** A play the model wants punted. */
function puntPlay(id: number, edge = 4): QuizPlay {
  const { desc: _desc, ...facts } = makePlay({
    play_id: id,
    go_boost: -edge,
    go_wp: 0.5 - edge / 100,
    punt_wp: 0.5,
    fg_wp: null,
  })
  return facts
}

describe('seededRandom', () => {
  it('repeats for the same seed and differs for another', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    const c = seededRandom(43)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(seededRandom(42)()).not.toBe(c())
  })

  it('stays inside 0 and 1', () => {
    const random = seededRandom(7)
    for (let i = 0; i < 200; i += 1) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('pickQuestions', () => {
  const pool = [
    ...Array.from({ length: 20 }, (_, i) => goPlay(i)),
    ...Array.from({ length: 20 }, (_, i) => puntPlay(100 + i)),
  ]

  it('draws a full round', () => {
    expect(pickQuestions(pool, seededRandom(1))).toHaveLength(10)
  })

  it('mixes in four the model would go for, so aggressiveness has a denominator', () => {
    const round = pickQuestions(pool, seededRandom(1))
    expect(round.filter((p) => modelChoice(p) === 'go')).toHaveLength(4)
  })

  it('never repeats a question inside a round', () => {
    const round = pickQuestions(pool, seededRandom(3))
    expect(new Set(round.map((p) => p.play_id)).size).toBe(10)
  })

  it('draws a different ten from a different seed', () => {
    const first = pickQuestions(pool, seededRandom(1)).map((p) => p.play_id)
    const second = pickQuestions(pool, seededRandom(2)).map((p) => p.play_id)
    expect(first).not.toEqual(second)
  })

  it('still fills a round when the pool is short of go situations', () => {
    const lopsided = Array.from({ length: 12 }, (_, i) => puntPlay(i))
    expect(pickQuestions(lopsided, seededRandom(1))).toHaveLength(10)
  })
})

describe('judge', () => {
  it('costs nothing when the call matches', () => {
    const verdict = judge({ play: goPlay(1), choice: 'go' })
    expect(verdict?.matched).toBe(true)
    expect(verdict?.cost).toBeCloseTo(0, 10)
  })

  it('costs the gap to the model when it does not', () => {
    const verdict = judge({ play: goPlay(1, 4), choice: 'punt' })
    expect(verdict?.matched).toBe(false)
    expect(verdict?.cost).toBeCloseTo(4, 6)
  })

  it('is null when the clock ran out', () => {
    expect(judge({ play: goPlay(1), choice: null })).toBeNull()
  })
})

describe('scoreRound', () => {
  const answers: Answer[] = [
    { play: goPlay(1, 4), choice: 'go' },
    { play: goPlay(2, 6), choice: 'punt' },
    { play: puntPlay(3, 5), choice: 'punt' },
    { play: puntPlay(4, 3), choice: null },
  ]

  it('counts only the calls actually made', () => {
    const score = scoreRound(answers)
    expect(score.decisions).toBe(3)
    expect(score.timedOut).toBe(1)
  })

  it('measures aggressiveness against what the model wanted', () => {
    const score = scoreRound(answers)
    expect(score.goRecommended).toBe(2)
    expect(score.goTaken).toBe(1)
    expect(score.aggressiveness).toBeCloseTo(0.5, 10)
  })

  it('measures agreement across the calls made', () => {
    expect(scoreRound(answers).agreement).toBeCloseTo(2 / 3, 10)
  })

  it('sums what was given up, and averages it per call', () => {
    const score = scoreRound(answers)
    expect(score.forfeited).toBeCloseTo(6, 6)
    expect(score.forfeitedPerDecision).toBeCloseTo(2, 6)
  })

  it('reports nulls rather than zeros when a rate has no denominator', () => {
    const score = scoreRound([{ play: goPlay(1), choice: null }])
    expect(score.agreement).toBeNull()
    expect(score.aggressiveness).toBeNull()
  })
})

describe('scoring an option the model cannot price', () => {
  /** Inside the opponent's 30 nfl4th prices no punt, so punt_wp is null. */
  const noPunt: QuizPlay = (() => {
    const { desc: _desc, ...facts } = makePlay({
      go_boost: 2,
      go_wp: 0.62,
      fg_wp: 0.6,
      punt_wp: null,
    })
    return facts
  })()

  it('is not scoreable', () => {
    expect(judge({ play: noPunt, choice: 'punt' })).toBeNull()
  })

  it('is not counted as a timeout, which would overstate the clock running out', () => {
    const score = scoreRound([{ play: noPunt, choice: 'punt' }])
    expect(score.timedOut).toBe(0)
    expect(score.decisions).toBe(0)
  })

  it('leaves the aggressiveness and matrix denominators agreeing', () => {
    // A round with one unscoreable call and one good one.
    const answers: Answer[] = [
      { play: noPunt, choice: 'punt' },
      { play: goPlay(9, 5), choice: 'go' },
    ]
    const score = scoreRound(answers)
    expect(score.decisions).toBe(1)
    expect(score.goRecommended).toBe(1)
  })
})
