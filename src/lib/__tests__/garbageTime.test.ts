import { describe, expect, it } from 'vitest'
import {
  assertStatOrder,
  buildRows,
  emptyTotals,
  fantasyPoints,
  bandOf,
  DEFAULT_REMOVALS,
  garbageBins,
  leagueShares,
  removedBins,
  bandUsage,
  splitByBand,
  STAT_ORDER,
  teamBandShares,
  totals,
} from '../garbageTime'
import type { Totals } from '../garbageTime'
import { CLEAN_BIN, makeBins, makeFile, makePlayer, makeTeam } from './garbageFixtures'

function stats(overrides: Partial<Totals>): Totals {
  return { ...emptyTotals(), ...overrides }
}

describe('fantasyPoints', () => {
  it('scores a passing line the way nflverse does', () => {
    // 300 yards, 2 TD, 1 INT = 12 + 8 - 2
    const t = stats({ pass_yds: 300, pass_td: 2, int: 1 })
    expect(fantasyPoints(t, 1)).toBeCloseTo(18, 6)
  })

  it('scores a receiving line and counts receptions only in PPR', () => {
    const t = stats({ rec: 8, rec_yds: 100, rec_td: 1 })
    expect(fantasyPoints(t, 0)).toBeCloseTo(16, 6)
    expect(fantasyPoints(t, 0.5)).toBeCloseTo(20, 6)
    expect(fantasyPoints(t, 1)).toBeCloseTo(24, 6)
  })

  it('subtracts lost fumbles and can go negative', () => {
    const t = stats({ rush_yds: 5, fum_lost: 2, int: 1 })
    expect(fantasyPoints(t, 1)).toBeCloseTo(0.5 - 4 - 2, 6)
    expect(fantasyPoints(t, 1)).toBeLessThan(0)
  })

  it('counts two-point conversions and return touchdowns', () => {
    expect(fantasyPoints(stats({ two_pt_pass: 1, two_pt_score: 1 }), 1)).toBeCloseTo(4, 6)
    expect(fantasyPoints(stats({ st_td: 1 }), 1)).toBeCloseTo(6, 6)
  })

  it('differs between PPR and standard by exactly the reception count', () => {
    const t = stats({ rec: 91, rec_yds: 1200, rec_td: 7, rush_yds: 40 })
    expect(fantasyPoints(t, 1) - fantasyPoints(t, 0)).toBeCloseTo(t.rec, 6)
  })
})

describe('assertStatOrder', () => {
  it('accepts a file packed in the expected order', () => {
    expect(() => assertStatOrder(makeFile([]))).not.toThrow()
  })

  it('rejects a reordered file', () => {
    const file = makeFile([])
    file.stats = [STAT_ORDER[1], STAT_ORDER[0], ...STAT_ORDER.slice(2)]
    expect(() => assertStatOrder(file)).toThrow(/expects/)
  })

  it('rejects a truncated file', () => {
    const file = makeFile([])
    file.stats = STAT_ORDER.slice(0, 5)
    expect(() => assertStatOrder(file)).toThrow()
  })
})

describe('bandOf', () => {
  const bins = makeBins()
  const bandsAt = (t: number) => bins.map((b) => bandOf(b, t))

  it('calls a trailing bin garbage only when its whole span is under the threshold', () => {
    // 0.10 covers [0,.025) .. [.075,.10) — four bins, and not the fifth.
    expect(bandsAt(0.1).filter((b) => b === 'trailing')).toHaveLength(4)
    expect(bandOf(bins[3], 0.1)).toBe('trailing')
    expect(bandOf(bins[4], 0.1)).toBe('competitive')
  })

  it('mirrors the threshold onto the leading side', () => {
    // The leading mirror of wp < 0.10 is wp > 0.90: bins 21..24.
    const bands = bandsAt(0.1)
    expect(bands.map((b, i) => (b === 'leading' ? i : -1)).filter((i) => i >= 0)).toEqual([
      21, 22, 23, 24,
    ])
  })

  it('always calls the lump competitive, at every threshold', () => {
    for (let t = 0.025; t <= 0.3001; t += 0.025) {
      expect(bandOf(bins[CLEAN_BIN], t)).toBe('competitive')
    }
  })

  it('reaches every tail bin at the widest threshold', () => {
    const bands = bandsAt(0.3)
    expect(bands.filter((b) => b === 'trailing')).toHaveLength(12)
    expect(bands.filter((b) => b === 'leading')).toHaveLength(12)
  })

  it('takes only the first bin at the narrowest', () => {
    expect(bandsAt(0.025).filter((b) => b === 'trailing')).toHaveLength(1)
  })
})

describe('removedBins', () => {
  const bins = makeBins()

  it('removes only what is checked', () => {
    const only = (r: Parameters<typeof removedBins>[2]) =>
      [...removedBins(bins, 0.1, r)].sort((a, b) => a - b)
    expect(only({ trailing: true, competitive: false, leading: false })).toEqual([0, 1, 2, 3])
    expect(only({ trailing: false, competitive: false, leading: true })).toEqual([21, 22, 23, 24])
    expect(only({ trailing: true, competitive: false, leading: true })).toEqual([
      0, 1, 2, 3, 21, 22, 23, 24,
    ])
  })

  it('removes nothing when nothing is checked', () => {
    expect(removedBins(bins, 0.1, { trailing: false, competitive: false, leading: false }).size).toBe(0)
  })

  it('removes every bin when all three are checked', () => {
    expect(removedBins(bins, 0.1, { trailing: true, competitive: true, leading: true }).size).toBe(
      bins.length,
    )
  })

  it('puts the lump in the competitive box, not a garbage one', () => {
    const competitive = removedBins(bins, 0.1, {
      trailing: false,
      competitive: true,
      leading: false,
    })
    expect(competitive.has(CLEAN_BIN)).toBe(true)
    // and the mid-tail bins the threshold does not reach
    expect(competitive.has(6)).toBe(true)
  })
})

describe('garbageBins', () => {
  const bins = makeBins()

  it('is both garbage bands, regardless of what is being removed', () => {
    expect([...garbageBins(bins, 0.1)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 21, 22, 23, 24])
  })

  it('never includes the lump', () => {
    for (let t = 0.025; t <= 0.3001; t += 0.025) {
      expect(garbageBins(bins, t).has(CLEAN_BIN)).toBe(false)
    }
  })
})

describe('totals', () => {
  it('ignores bins that are absent from a sparse player', () => {
    const p = makePlayer('a', 'WR', [[0, { rec: 3 }], [CLEAN_BIN, { rec: 40 }]])
    expect(totals(p.bins).rec).toBe(43)
  })

  it('skips excluded bins', () => {
    const p = makePlayer('a', 'WR', [[0, { rec: 3 }], [CLEAN_BIN, { rec: 40 }]])
    expect(totals(p.bins, new Set([0])).rec).toBe(40)
    expect(totals(p.bins, new Set([0, CLEAN_BIN])).rec).toBe(0)
  })
})

describe('buildRows', () => {
  /** A receiver with garbage production spread across the trailing bins. */
  const wr = (id: string, clean: number, garbage: number) =>
    makePlayer(id, 'WR', [
      [0, { rec_yds: garbage * 10, plays: garbage }],
      [CLEAN_BIN, { rec_yds: clean * 10, plays: clean }],
    ])

  it('conserves points: remaining + removed always equals actual', () => {
    const file = makeFile([wr('a', 100, 60), wr('b', 150, 5), wr('c', 20, 90)])
    for (const format of ['standard', 'half', 'ppr'] as const) {
      for (const trailing of [false, true]) {
        for (const competitive of [false, true]) {
          for (const leading of [false, true]) {
            for (let threshold = 0.025; threshold <= 0.3001; threshold += 0.025) {
              const remove = { trailing, competitive, leading }
              for (const row of buildRows(file, { threshold, format, remove })) {
                expect(row.remaining + row.removed).toBeCloseTo(row.actual, 6)
              }
            }
          }
        }
      }
    }
  })

  it('removes nothing when no box is checked, and everything when all are', () => {
    const file = makeFile([wr('a', 100, 60), wr('b', 150, 5)])
    const at = (remove: { trailing: boolean; competitive: boolean; leading: boolean }) =>
      buildRows(file, { threshold: 0.1, format: 'ppr', remove })
    for (const row of at({ trailing: false, competitive: false, leading: false })) {
      expect(row.removed).toBeCloseTo(0, 6)
      expect(row.remaining).toBeCloseTo(row.actual, 6)
      expect(row.rankDelta).toBe(0)
    }
    for (const row of at({ trailing: true, competitive: true, leading: true })) {
      expect(row.remaining).toBeCloseTo(0, 6)
    }
  })

  it('can invert the question: remove competitive and only garbage time is left', () => {
    const file = makeFile([wr('a', 100, 60)])
    const [row] = buildRows(file, {
      threshold: 0.1,
      format: 'ppr',
      remove: { trailing: false, competitive: true, leading: true },
    })
    // 60 units of garbage-time receiving yards, at 0.1 points a yard.
    expect(row.remaining).toBeCloseTo(60, 6)
  })

  it('holds the garbage share steady no matter which boxes are checked', () => {
    const file = makeFile([wr('a', 100, 60)])
    const share = (remove: { trailing: boolean; competitive: boolean; leading: boolean }) =>
      buildRows(file, { threshold: 0.1, format: 'ppr', remove })[0].share
    const base = share(DEFAULT_REMOVALS)
    expect(share({ trailing: false, competitive: false, leading: false })).toBeCloseTo(base, 6)
    expect(share({ trailing: true, competitive: true, leading: true })).toBeCloseTo(base, 6)
  })

  it('ranks within position, not across the whole file', () => {
    const file = makeFile([
      makePlayer('qb1', 'QB', [[CLEAN_BIN, { pass_yds: 5000 }]]),
      makePlayer('qb2', 'QB', [[CLEAN_BIN, { pass_yds: 4000 }]]),
      makePlayer('wr1', 'WR', [[CLEAN_BIN, { rec_yds: 900 }]]),
      makePlayer('wr2', 'WR', [[CLEAN_BIN, { rec_yds: 500 }]]),
    ])
    const rows = buildRows(file, { threshold: 0.1, format: 'ppr', remove: DEFAULT_REMOVALS })
    const rank = Object.fromEntries(rows.map((r) => [r.player.id, r.actualRank]))
    expect(rank).toEqual({ qb1: 1, qb2: 2, wr1: 1, wr2: 2 })
  })

  it('breaks ties on id so the order never shuffles between renders', () => {
    const file = makeFile([wr('zeta', 100, 0), wr('alpha', 100, 0)])
    const settings = { threshold: 0.1, format: 'ppr' as const, remove: DEFAULT_REMOVALS }
    const first = buildRows(file, settings).map((r) => r.actualRank)
    const again = buildRows(file, settings).map((r) => r.actualRank)
    expect(first).toEqual(again)
    const byId = Object.fromEntries(buildRows(file, settings).map((r) => [r.player.id, r.actualRank]))
    expect(byId.alpha).toBe(1)
  })

  it('leaves a player with no garbage exactly where he was', () => {
    const file = makeFile([wr('a', 100, 0), wr('b', 90, 0)])
    for (const row of buildRows(file, { threshold: 0.1, format: 'ppr', remove: DEFAULT_REMOVALS })) {
      expect(row.garbage).toBe(0)
      expect(row.rankDelta).toBe(0)
    }
  })

  it('handles negative clean points and a share above 100%', () => {
    // Everything he did outside garbage time was throw an interception.
    const p = makePlayer('a', 'QB', [
      [0, { pass_yds: 200, pass_td: 2 }],
      [CLEAN_BIN, { int: 1 }],
    ])
    const [row] = buildRows(makeFile([p]), {
      threshold: 0.1,
      format: 'ppr',
      remove: DEFAULT_REMOVALS,
    })
    expect(row.remaining).toBeLessThan(0)
    expect(row.share).toBeGreaterThan(1)
    expect(row.remaining + row.removed).toBeCloseTo(row.actual, 6)
  })

  it('drops a player whose season was garbage time out of the starter tier', () => {
    // 40 WRs: the top one is pure garbage time, the rest are clean.
    const players = [
      wr('mirage', 1, 200),
      ...Array.from({ length: 40 }, (_, i) => wr(`clean${String(i).padStart(2, '0')}`, 100 - i, 0)),
    ]
    const rows = buildRows(makeFile(players), {
      threshold: 0.1,
      format: 'ppr',
      remove: DEFAULT_REMOVALS,
    })
    const target = rows.find((r) => r.player.id === 'mirage')
    expect(target?.actualRank).toBe(1)
    expect(target?.remainingRank).toBeGreaterThan(30)
    expect(target?.rankDelta).toBeGreaterThan(30)
  })

  it('lifts a player who never padded, because everyone around him did', () => {
    // The riser out-scores nobody until the padding comes off: each rival
    // out-earns him on actual points but is mostly garbage underneath.
    const players = [
      wr('riser', 100, 0),
      ...Array.from({ length: 20 }, (_, i) => wr(`padded${String(i).padStart(2, '0')}`, 50 - i, 80)),
    ]
    const rows = buildRows(makeFile(players), {
      threshold: 0.1,
      format: 'ppr',
      remove: DEFAULT_REMOVALS,
    })
    const riser = rows.find((r) => r.player.id === 'riser')
    expect(riser?.rankDelta).toBeLessThanOrEqual(-5)
    expect(riser?.remainingRank).toBeLessThan(riser!.actualRank)
  })

  it('still reports a player with only a couple of games', () => {
    const cameo = makePlayer('cameo', 'WR', [[0, { rec_yds: 2000 }]], { games: 2 })
    const [row] = buildRows(makeFile([cameo]), {
      threshold: 0.1,
      format: 'ppr',
      remove: DEFAULT_REMOVALS,
    })
    expect(row.actual).toBeCloseTo(200, 6)
    expect(row.remaining).toBeCloseTo(0, 6)
    expect(row.actualPerGame).toBeCloseTo(100, 6)
  })

  it('measures usage per band, so a receiver is not judged against a state he never played', () => {
    // KC ran a tenth of its snaps trailing and a twentieth leading.
    const teams = [makeTeam('KC', [[0, 100], [24, 50], [CLEAN_BIN, 850]])]
    // A receiver whose extra work is all while behind, and a back whose is all
    // while ahead. Pooled together they would look identically garbage-heavy.
    // Usage is measured from snaps, not yardage: he is in a game state whether
    // or not the ball came near him.
    const wr = makePlayer('wr', 'WR', [
      [0, { rec_yds: 100, tgt: 12, plays: 12, snaps: 30 }],
      [CLEAN_BIN, { rec_yds: 400, tgt: 40, plays: 40, snaps: 70 }],
    ])
    const rb = makePlayer('rb', 'RB', [
      [24, { rush_yds: 200, rush_att: 12, plays: 12, snaps: 30 }],
      [CLEAN_BIN, { rush_yds: 600, rush_att: 40, plays: 40, snaps: 70 }],
    ])
    const file = makeFile([wr, rb], teams)
    const shares = teamBandShares(file, 0.1)

    const forWr = bandUsage(wr, file, 0.1, shares)
    expect(forWr.trailing.playerShare).toBeCloseTo(0.3, 6)
    expect(forWr.trailing.teamShare).toBeCloseTo(0.1, 6)
    expect(forWr.trailing.lift).toBeCloseTo(3, 6)
    // and he is credited with no leading exposure at all
    expect(forWr.leading.playerShare).toBe(0)
    expect(forWr.leading.lift).toBe(0)

    const forRb = bandUsage(rb, file, 0.1, shares)
    expect(forRb.leading.playerShare).toBeCloseTo(0.3, 6)
    expect(forRb.leading.teamShare).toBeCloseTo(0.05, 6)
    expect(forRb.leading.lift).toBeCloseTo(6, 6)
    expect(forRb.trailing.playerShare).toBe(0)
    expect(forWr.trailing.basis).toBe('snaps')
  })

  it('falls back to touches on a season with no participation data', () => {
    const teams = [makeTeam('KC', [[0, 100], [CLEAN_BIN, 900]])]
    // Snaps and touches disagree on purpose: he played a third of his snaps
    // while behind but was thrown at in only a tenth of his touches there.
    const wr = makePlayer('wr', 'WR', [
      [0, { plays: 10, snaps: 30 }],
      [CLEAN_BIN, { plays: 90, snaps: 70 }],
    ])
    const withSnaps = makeFile([wr], teams, true)
    const without = makeFile([wr], teams, false)

    expect(bandUsage(wr, withSnaps, 0.1, teamBandShares(withSnaps, 0.1)).trailing).toMatchObject({
      playerShare: 0.3,
      basis: 'snaps',
    })
    expect(bandUsage(wr, without, 0.1, teamBandShares(without, 0.1)).trailing).toMatchObject({
      playerShare: 0.1,
      basis: 'touches',
    })
  })

  it('reports leading-garbage points even when they are not being stripped', () => {
    const rb = makePlayer('rb', 'RB', [
      [24, { rush_yds: 300, plays: 60 }],
      [CLEAN_BIN, { rush_yds: 700, plays: 140 }],
    ])
    const settings = { threshold: 0.1, format: 'ppr' as const, remove: DEFAULT_REMOVALS }
    const [row] = buildRows(makeFile([rb]), settings)
    expect(row.leading).toBeCloseTo(30, 6)
    // Not removed by default: his remaining total still has them.
    expect(row.remaining).toBeCloseTo(row.actual, 6)

    const [removed] = buildRows(makeFile([rb]), {
      ...settings,
      remove: { ...DEFAULT_REMOVALS, leading: true },
    })
    expect(removed.remaining).toBeCloseTo(70, 6)
  })
})

describe('splitByBand', () => {
  const bins = makeBins()
  // 10 pts hopeless, 40 competitive (30 in the lump, 10 at wp .15 while behind),
  // 20 with the game won.
  const p = makePlayer('a', 'WR', [
    [0, { rec_yds: 100 }],
    [6, { rec_yds: 100 }],
    [CLEAN_BIN, { rec_yds: 300 }],
    [24, { rec_yds: 200 }],
  ])

  it('splits a season into the three bands', () => {
    expect(splitByBand(p.bins, bins, 0.1, 1)).toEqual({
      trailing: 10,
      competitive: 40,
      leading: 20,
    })
  })

  it('always sums to the season total, at every threshold', () => {
    for (let t = 0.025; t <= 0.3001; t += 0.025) {
      const s = splitByBand(p.bins, bins, t, 1)
      expect(s.trailing + s.competitive + s.leading).toBeCloseTo(70, 6)
    }
  })

  it('moves a band from competitive to garbage as the threshold widens', () => {
    // Bin 6 spans wp .15-.175, so it is competitive at .10 and garbage at .175.
    expect(splitByBand(p.bins, bins, 0.1, 1).trailing).toBe(10)
    expect(splitByBand(p.bins, bins, 0.175, 1).trailing).toBe(20)
  })

  it('reports the leading band whether or not it is being removed', () => {
    // splitByBand takes no removals: the band is a fact about the game state,
    // and what a reader subtracts is a separate question.
    expect(splitByBand(p.bins, bins, 0.1, 1).leading).toBe(20)
  })

  it('scores each band in the chosen format', () => {
    const catcher = makePlayer('b', 'WR', [[0, { rec: 10, rec_yds: 100 }]])
    expect(splitByBand(catcher.bins, bins, 0.1, 0).trailing).toBe(10)
    expect(splitByBand(catcher.bins, bins, 0.1, 1).trailing).toBe(20)
  })

  it('keeps a negative band negative rather than clamping it', () => {
    const qb = makePlayer('c', 'QB', [
      [0, { pass_yds: 200, pass_td: 2 }],
      [CLEAN_BIN, { int: 2 }],
    ])
    const s = splitByBand(qb.bins, bins, 0.1, 1)
    expect(s.trailing).toBeCloseTo(16, 6)
    expect(s.competitive).toBeCloseTo(-4, 6)
  })
})

describe('teamBandShares', () => {
  it('splits each team by its own snap count, not the league total', () => {
    const file = makeFile(
      [],
      [
        makeTeam('KC', [[0, 100], [24, 100], [CLEAN_BIN, 800]]),
        makeTeam('LV', [[0, 300], [CLEAN_BIN, 700]]),
      ],
    )
    const shares = teamBandShares(file, 0.1)
    expect(shares.get('KC')).toEqual({ trailing: 0.1, competitive: 0.8, leading: 0.1 })
    expect(shares.get('LV')).toEqual({ trailing: 0.3, competitive: 0.7, leading: 0 })
  })

  it('has each team three shares sum to one', () => {
    const file = makeFile(
      [],
      [makeTeam('KC', [[0, 37], [6, 11], [20, 5], [24, 9], [CLEAN_BIN, 438]])],
    )
    for (let t = 0.025; t <= 0.3001; t += 0.025) {
      const bands = teamBandShares(file, t).get('KC')!
      expect(bands.trailing + bands.competitive + bands.leading).toBeCloseTo(1, 9)
    }
  })

  it('survives a team with no plays rather than dividing by zero', () => {
    const shares = teamBandShares(makeFile([], [makeTeam('KC', [])]), 0.1)
    expect(shares.get('KC')).toEqual({ trailing: 0, competitive: 0, leading: 0 })
  })
})

describe('leagueShares', () => {
  it('reports each garbage band as a share of offensive plays', () => {
    const file = makeFile(
      [],
      [
        makeTeam('KC', [[0, 100], [24, 100], [CLEAN_BIN, 800]]),
        makeTeam('LV', [[0, 300], [CLEAN_BIN, 700]]),
      ],
    )
    const shares = leagueShares(file, 0.1)
    expect(shares.trailing).toBeCloseTo(0.2, 6)
    expect(shares.leading).toBeCloseTo(0.05, 6)
  })
})
