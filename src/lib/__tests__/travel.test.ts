import { describe, expect, it } from 'vitest'
import {
  addValue,
  aggregate,
  assertStatOrder,
  cover,
  diff,
  distanceBin,
  DISTANCE_EDGES,
  DISTANCE_LABELS,
  emptyCell,
  farBin,
  farCut,
  farShare,
  LENS,
  mean,
  mergeCells,
  playerCut,
  pointsPerGame,
  se,
  standouts,
  tripsCut,
  vsLine,
  win,
} from '../travel'
import type { TeamGame } from '../../types'
import { makeFile, makeGame, makePlayer, row } from './travelFixtures'

describe('cells', () => {
  it('gives a mean and the standard error of a hand-computed sample', () => {
    const c = emptyCell()
    for (const v of [2, 4, 4, 4, 5, 5, 7, 9]) addValue(c, v)
    // mean 5, sample variance 32/7, se = sqrt(32/7/8)
    expect(mean(c)).toBe(5)
    expect(se(c)).toBeCloseTo(Math.sqrt(32 / 7 / 8), 10)
  })

  it('has no mean with no games and no error with one', () => {
    expect(mean(emptyCell())).toBeNull()
    const one = emptyCell()
    addValue(one, 3)
    expect(mean(one)).toBe(3)
    expect(se(one)).toBeNull()
  })

  it('merges by summing, so a merged cell equals the cell of the union', () => {
    const a = emptyCell()
    const b = emptyCell()
    const all = emptyCell()
    for (const v of [1, 2, 3]) {
      addValue(a, v)
      addValue(all, v)
    }
    for (const v of [10, 20]) {
      addValue(b, v)
      addValue(all, v)
    }
    expect(mergeCells([a, b])).toEqual(all)
  })

  it('combines the errors of a difference in quadrature', () => {
    const a = emptyCell()
    const b = emptyCell()
    for (const v of [0, 2]) addValue(a, v)
    for (const v of [10, 14]) addValue(b, v)
    const d = diff(b, a)
    expect(d?.value).toBe(11)
    // se(a) = 1, se(b) = 2
    expect(d?.se).toBeCloseTo(Math.hypot(1, 2), 10)
  })
})

describe('game readings', () => {
  it('scores a tie as half a win and a push as half a cover', () => {
    expect(win(makeGame({ pf: 20, pa: 20 }))).toBe(0.5)
    expect(win(makeGame({ pf: 21, pa: 20 }))).toBe(1)
    expect(win(makeGame({ pf: 19, pa: 20 }))).toBe(0)
    // favoured by 3, won by exactly 3
    expect(vsLine(makeGame({ pf: 23, pa: 20, line: 3 }))).toBe(0)
    expect(cover(makeGame({ pf: 23, pa: 20, line: 3 }))).toBe(0.5)
    expect(cover(makeGame({ pf: 27, pa: 20, line: 3 }))).toBe(1)
  })

  it('measures the underdog against a negative line', () => {
    // a 7-point dog that lost by 3 beat the number by 4
    expect(vsLine(makeGame({ pf: 17, pa: 20, line: -7 }))).toBe(4)
  })
})

describe('distance bins', () => {
  it('puts zero miles at home and edges in the bin they open', () => {
    expect(distanceBin(0)).toBe(0)
    expect(distanceBin(1)).toBe(1)
    expect(distanceBin(249)).toBe(1)
    expect(distanceBin(250)).toBe(2)
    expect(distanceBin(999)).toBe(3)
    expect(distanceBin(1000)).toBe(4)
    expect(distanceBin(3000)).toBe(7)
    expect(distanceBin(5400)).toBe(7)
  })

  it('labels every bin', () => {
    expect(DISTANCE_LABELS).toHaveLength(DISTANCE_EDGES.length + 1)
  })

  it('cuts at a bin edge only', () => {
    expect(farBin(1000)).toBe(4)
    expect(() => farBin(1200)).toThrow()
  })

  it('conserves games across home, near and far', () => {
    const cells = DISTANCE_LABELS.map(() => emptyCell())
    for (const miles of [0, 0, 100, 600, 1200, 2500, 4000]) addValue(cells[distanceBin(miles)], 1)
    const far = farCut(cells, 1000)
    const trips = tripsCut(cells)
    expect(cells[0].n).toBe(2)
    expect(trips.n).toBe(5)
    expect(far.n).toBe(3)
    expect(farCut(cells, 250).n).toBe(4)
  })
})

describe('other lenses', () => {
  it('bins time zones east and west with home apart from a same-zone trip', () => {
    const tz = (g: TeamGame) => LENS.tz.binOf(g, 2024)
    expect(tz(makeGame({ miles: 0, tz: 0 }))).toBe(0)
    expect(tz(makeGame({ miles: 400, tz: 0 }))).toBe(4)
    expect(tz(makeGame({ miles: 2400, tz: -3 }))).toBe(1)
    expect(tz(makeGame({ miles: 2400, tz: 3 }))).toBe(7)
    expect(tz(makeGame({ miles: 4000, tz: 6 }))).toBe(8)
  })

  it('cannot bin a trip by body clock without a kickoff time', () => {
    const body = (g: TeamGame) => LENS.body.binOf(g, 2024)
    expect(body(makeGame({ miles: 500, body_hour: null }))).toBeNull()
    expect(body(makeGame({ miles: 500, body_hour: 10 }))).toBe(1)
    expect(body(makeGame({ miles: 500, body_hour: 13.25 }))).toBe(3)
    expect(body(makeGame({ miles: 500, body_hour: 20.25 }))).toBe(5)
    // home is home whatever the clock says, and whether it says anything
    expect(body(makeGame({ miles: 0, body_hour: null }))).toBe(0)
  })

  it('splits rest by site', () => {
    const rest = (g: TeamGame) => LENS.rest.binOf(g, 2024)
    expect(rest(makeGame({ miles: 0, rest: 4 }))).toBe(0)
    expect(rest(makeGame({ miles: 0, rest: 7 }))).toBe(1)
    expect(rest(makeGame({ miles: 0, rest: 14 }))).toBe(2)
    expect(rest(makeGame({ miles: 900, rest: 4 }))).toBe(3)
    expect(rest(makeGame({ miles: 900, rest: 14 }))).toBe(5)
  })
})

describe('aggregate', () => {
  const games = [
    makeGame({ game_id: 'g1', pf: 30, pa: 20, line: 3 }),
    makeGame({ game_id: 'g2', miles: 1200, tz: -2, pf: 17, pa: 24, line: -1, plays: null, epa: null }),
    makeGame({ game_id: 'g3', miles: 300, pf: 21, pa: 21, line: 0 }),
  ]
  const players = [
    makePlayer('a', 'WR', [
      row(0, { pts_std: 10, rec: 5, rec_yds: 100 }),
      row(1, { pts_std: 4, rec: 2, rec_yds: 40 }),
      row(2, { pts_std: 6, rec: 3, rec_yds: 60 }),
    ]),
  ]
  const file = makeFile(games, players)

  it('refuses a file whose stat order drifted', () => {
    expect(() => assertStatOrder(makeFile([], [], { stats: ['rec', 'pts_std'] }))).toThrow(
      /stat order/,
    )
  })

  it('bins games by every lens at once', () => {
    const agg = aggregate([file])
    expect(agg.games).toBe(3)
    const win = agg.byLens.distance.win
    expect(win[0].n).toBe(1)
    expect(mean(win[0])).toBe(1)
    expect(win[2].n).toBe(1) // 300 miles
    expect(mean(win[2])).toBe(0.5) // the tie
    expect(win[4].n).toBe(1) // 1200 miles
    expect(agg.byLens.tz.win[2].n).toBe(1) // two zones west
  })

  it('drops a game from a metric it has no value for, and only that metric', () => {
    const agg = aggregate([file])
    expect(agg.byLens.distance.epa_play[4].n).toBe(0)
    expect(agg.byLens.distance.margin[4].n).toBe(1)
    expect(mean(agg.byLens.distance.margin[4])).toBe(-7)
  })

  it('keeps the schedule split and the distance split on each team', () => {
    const agg = aggregate([file])
    const kc = agg.byTeam.find((t) => t.team === 'KC')
    expect(kc?.games).toBe(3)
    expect(kc?.trips).toBe(2)
    expect(kc?.miles).toBe(1500)
    expect(kc?.tzAbs).toBe(2)
    expect(kc?.site.home.margin.n).toBe(1)
    expect(kc?.site.away.margin.n).toBe(2)
    expect(mean(kc!.site.away.margin)).toBe(-3.5)
  })

  it('splits a player by the trip of the game he played', () => {
    const agg = aggregate([file])
    const a = agg.players.find((p) => p.id === 'a')!
    const cut = playerCut(a, 1000)
    expect(cut.home.n).toBe(1)
    expect(cut.away.n).toBe(2)
    expect(cut.far.n).toBe(1)
    expect(pointsPerGame(cut.home, 'standard')).toBe(10)
    expect(pointsPerGame(cut.home, 'ppr')).toBe(15)
    expect(pointsPerGame(cut.away, 'half')).toBe((4 + 1 + 6 + 1.5) / 2)
    expect(pointsPerGame(cut.far, 'ppr')).toBe(6)
  })

  it('carries the position split with the same games', () => {
    const agg = aggregate([file])
    const wr = agg.byPosition.WR.distance.ppr
    expect(wr[0].n).toBe(1)
    expect(mean(wr[0])).toBe(15)
    expect(tripsCut(wr).n).toBe(2)
  })

  it('aggregates two seasons to the same thing as one file of both', () => {
    const later = makeFile(
      [makeGame({ game_id: 'h1', miles: 2200, tz: 3, pf: 10, pa: 31, line: -4 })],
      [makePlayer('a', 'WR', [row(0, { pts_std: 2, rec: 1 })], { name: 'Renamed', team: 'DEN' })],
      { season: 2025 },
    )
    const two = aggregate([later, file])
    const one = aggregate([
      makeFile([...games, ...later.games], [
        makePlayer('a', 'WR', [...players[0].rows, row(3, { pts_std: 2, rec: 1 })], {
          name: 'Renamed',
          team: 'DEN',
        }),
      ]),
    ])
    expect(two.byLens).toEqual(one.byLens)
    expect(two.byPosition).toEqual(one.byPosition)
    expect(two.players[0].bins).toEqual(one.players[0].bins)
    // and the later season names him
    expect(two.players[0].name).toBe('Renamed')
    expect(two.players[0].team).toBe('DEN')
    expect(two.players[0].seasons).toBe(2)
    expect(two.byTeam[0].seasons).toBe(2)
    expect(two.seasons).toEqual([2024, 2025])
  })

  it('keeps only the best players at a position', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      makePlayer(`p${i}`, 'RB', [row(0, { pts_std: i })]),
    )
    const agg = aggregate([makeFile(games, many)], { keepPlayers: 2 })
    expect(agg.players.map((p) => p.id)).toEqual(['p4', 'p3'])
  })

  it('reads the far share off the distance cells', () => {
    expect(farShare(aggregate([file]), 1000)).toBe(0.5)
    expect(farShare(aggregate([file]), 250)).toBe(1)
  })
})

describe('phase and era lenses', () => {
  it('splits the last month of the season by the line', () => {
    const phase = (g: TeamGame) => LENS.phase.binOf(g, 2024)
    expect(phase(makeGame({ miles: 0, week: 16 }))).toBe(0)
    expect(phase(makeGame({ miles: 500, week: 3 }))).toBe(1)
    expect(phase(makeGame({ miles: 500, week: 9 }))).toBe(2)
    expect(phase(makeGame({ miles: 500, week: 15, line: 3 }))).toBe(3)
    expect(phase(makeGame({ miles: 500, week: 15, line: -3 }))).toBe(4)
  })

  it('bins a trip by era and a fixed far cut, and nothing outside the eras', () => {
    const g = makeGame({ miles: 1600 })
    expect(LENS.era.binOf(g, 2005)).toBe(2)
    expect(LENS.era.binOf(makeGame({ miles: 400 }), 2005)).toBe(1)
    expect(LENS.era.binOf(g, 2015)).toBe(4)
    expect(LENS.era.binOf(g, 2024)).toBe(6)
    expect(LENS.era.binOf(g, 1990)).toBeNull()
    expect(LENS.era.binOf(makeGame({ miles: 0 }), 1990)).toBe(0)
  })
})

describe('by season and standouts', () => {
  it('keeps each season home and away, without neutral games', () => {
    const agg = aggregate([
      makeFile([
        makeGame({ game_id: 'a', pf: 30, pa: 20 }),
        makeGame({ game_id: 'b', miles: 500, site: 'away', pf: 20, pa: 30 }),
        makeGame({ game_id: 'c', miles: 3000, site: 'neutral', pf: 20, pa: 30 }),
      ]),
    ])
    expect(agg.bySeason).toHaveLength(1)
    expect(agg.bySeason[0].season).toBe(2024)
    expect(mean(agg.bySeason[0].home.margin)).toBe(10)
    expect(agg.bySeason[0].away.margin.n).toBe(1)
  })

  it('finds a bin the line did not price, and checks it within the team', () => {
    // 40 trips two zones east losing to the line by 7 on average; 40 same-zone
    // trips landing near it — for each of two teams.
    const games: TeamGame[] = []
    for (const team of ['SEA', 'SF']) {
      for (let i = 0; i < 40; i += 1) {
        games.push(makeGame({ game_id: `${team}-e${i}`, team, miles: 1800, tz: 2, pf: 9 + (i % 3), pa: 20, line: -3 }))
        games.push(makeGame({ game_id: `${team}-s${i}`, team, miles: 300, tz: 0, pf: 17 + (i % 3), pa: 20, line: -2 }))
      }
    }
    const agg = aggregate([makeFile(games)])
    const found = standouts(agg)
    const east2 = found.find((s) => s.lens === 'tz' && s.label === '2 zones east')
    expect(east2).toBeDefined()
    expect(mean(east2!.vsLine)).toBeCloseTo(-7.025, 6)
    expect(east2!.within?.teams).toBe(2)
    expect(east2!.within?.value).toBeCloseTo(-7, 6)
    // and nothing that is on the line
    expect(found.find((s) => s.lens === 'tz' && s.label === 'Same zone, away')).toBeUndefined()
  })

  it('reports nothing under the minimum count', () => {
    const games = Array.from({ length: 10 }, (_, i) =>
      makeGame({ game_id: `g${i}`, miles: 1800, tz: 2, pf: 10, pa: 20, line: -3 }),
    )
    expect(standouts(aggregate([makeFile(games)]))).toEqual([])
  })
})
