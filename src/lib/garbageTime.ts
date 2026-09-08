import type {
  BinRow,
  FantasyPos,
  GarbageBin,
  GarbagePlayer,
  GarbageTimeFile,
  StatKey,
  StatLine,
  TeamAbbr,
} from '../types'

/**
 * Fantasy rankings with chosen kinds of production removed.
 *
 * The pipeline ships counting stats bucketed by the win probability the offense
 * faced at the snap; everything here is arithmetic over those buckets. Nothing
 * in this file fetches, and nothing renders — the page and the build-time check
 * script both run these same functions, so what a reader sees and what the
 * pipeline reports cannot drift apart.
 */

/**
 * The order every StatLine is packed in. Must match `GarbageTimeFile.stats`.
 * Positional encoding is what keeps the file small; this constant plus
 * `assertStatOrder` is what keeps it safe.
 */
export const STAT_ORDER: StatKey[] = [
  'pass_att',
  'pass_cmp',
  'pass_yds',
  'pass_td',
  'int',
  'rush_att',
  'rush_yds',
  'rush_td',
  'tgt',
  'rec',
  'rec_yds',
  'rec_td',
  'fum_lost',
  'two_pt_pass',
  'two_pt_score',
  'st_td',
  'plays',
  'snaps',
]

export type Totals = Record<StatKey, number>

/** A zeroed line, so summation never has to special-case the first addend. */
export function emptyTotals(): Totals {
  const t = {} as Totals
  for (const k of STAT_ORDER) t[k] = 0
  return t
}

/**
 * Fails loudly if the pipeline and this module disagree about column order.
 *
 * A reordered tuple would not throw anywhere else — it would silently score
 * rushing yards as passing attempts and produce a page that looks plausible and
 * is entirely wrong. This is the only thing standing between that and a deploy.
 */
export function assertStatOrder(file: GarbageTimeFile): void {
  const got = file.stats
  if (got.length !== STAT_ORDER.length || got.some((k, i) => k !== STAT_ORDER[i])) {
    throw new Error(
      `garbage-time data is packed as [${got.join(', ')}] but this build expects ` +
        `[${STAT_ORDER.join(', ')}]. Rerun scripts/garbage-time.R.`,
    )
  }
}

export type Format = 'standard' | 'half' | 'ppr'

/** Points per reception. The only thing that varies between formats. */
export const PPR: Record<Format, number> = { standard: 0, half: 0.5, ppr: 1 }

export const FORMAT_LABEL: Record<Format, string> = {
  standard: 'Standard',
  half: 'Half PPR',
  ppr: 'PPR',
}

/**
 * Fantasy points for a stat line.
 *
 * At `ppr = 1` this reproduces nflverse's own `fantasy_points_ppr` exactly, so
 * the actual column on this page matches any public leaderboard a reader might
 * check it against. Standard scoring is the same formula with receptions worth
 * nothing, which is why the components ship rather than precomputed points.
 */
export function fantasyPoints(t: Totals, ppr: number): number {
  return (
    0.04 * t.pass_yds +
    4 * t.pass_td -
    2 * t.int +
    2 * t.two_pt_pass +
    0.1 * t.rush_yds +
    6 * t.rush_td +
    0.1 * t.rec_yds +
    6 * t.rec_td +
    ppr * t.rec +
    2 * t.two_pt_score +
    6 * t.st_td -
    2 * t.fum_lost
  )
}

/** Adds a packed StatLine into a Totals in place. */
export function addLine(into: Totals, line: StatLine): Totals {
  for (let i = 0; i < STAT_ORDER.length; i += 1) into[STAT_ORDER[i]] += line[i] ?? 0
  return into
}

/* --------------------------------------------------------------------------
 * Bands
 * ----------------------------------------------------------------------- */

/**
 * The three states a play can be in, along the win-probability axis: the game
 * out of reach, the game in doubt, the game already won.
 */
export type Band = 'trailing' | 'competitive' | 'leading'

/** Axis order, so a legend or a donut reads left to right the same way. */
export const BANDS: Band[] = ['trailing', 'competitive', 'leading']

export const BAND_LABEL: Record<Band, string> = {
  trailing: 'Garbage time points when trailing',
  competitive: 'Competitive points',
  leading: 'Garbage time points when leading',
}

/** Which kinds of production the reader has asked to take out of the total. */
export type Removals = Record<Band, boolean>

/**
 * Trailing garbage only.
 *
 * That is how the phrase is normally used — the losing team piling up yards
 * against a defense that has stopped caring — and it is the question the page
 * opens on. The other two are one click away.
 */
export const DEFAULT_REMOVALS: Removals = {
  trailing: true,
  competitive: false,
  leading: false,
}

/** Nothing removed — for a view that only describes the bands, not a subtraction. */
export const NO_REMOVALS: Removals = {
  trailing: false,
  competitive: false,
  leading: false,
}

/**
 * The band a bin sits in at this threshold.
 *
 * A trailing bin qualifies when its whole span is at or below the threshold,
 * which is why the threshold control snaps to bin edges: a cut inside a bin
 * cannot be answered by summing bins, and splitting one would mean inventing
 * plays that are not in the data. Leading is the mirror. Everything else — the
 * neutral lump, and the tail bins the threshold does not reach — is competitive
 * football.
 */
export function bandOf(bin: GarbageBin, threshold: number): Band {
  const epsilon = 1e-9
  if (bin.side === 'trailing' && bin.hi <= threshold + epsilon) return 'trailing'
  if (bin.side === 'leading' && bin.lo >= 1 - threshold - epsilon) return 'leading'
  return 'competitive'
}

/** Bins whose points the reader has asked to remove. */
export function removedBins(bins: GarbageBin[], threshold: number, remove: Removals): Set<number> {
  const out = new Set<number>()
  bins.forEach((bin, i) => {
    if (remove[bandOf(bin, threshold)]) out.add(i)
  })
  return out
}

/**
 * Both garbage-time bands, whether or not they are being removed.
 *
 * The garbage share a player carries is a fact about his season and the
 * threshold; what a reader chooses to subtract is a separate question. Keeping
 * them apart is what stops the share column moving every time a checkbox does.
 */
export function garbageBins(bins: GarbageBin[], threshold: number): Set<number> {
  const out = new Set<number>()
  bins.forEach((bin, i) => {
    if (bandOf(bin, threshold) !== 'competitive') out.add(i)
  })
  return out
}

/**
 * Sums sparse bin rows, optionally skipping some bins.
 *
 * Takes the rows rather than a player so a team's offense can be summed the
 * same way — the two are packed identically, and the page shows both.
 */
export function totals(rows: BinRow[], exclude?: Set<number>): Totals {
  const t = emptyTotals()
  for (const [bin, line] of rows) {
    if (exclude?.has(bin)) continue
    addLine(t, line)
  }
  return t
}

/**
 * Counting stats split three ways along the win-probability axis.
 *
 * The same grouping the points split uses, kept whole rather than scored, so a
 * table can say how many of a team's catches and yards and touchdowns happened
 * in each game state — a question points alone cannot answer.
 */
export function totalsByBand(
  rows: BinRow[],
  bins: GarbageBin[],
  threshold: number,
): Record<Band, Totals> {
  const out: Record<Band, Totals> = {
    trailing: emptyTotals(),
    competitive: emptyTotals(),
    leading: emptyTotals(),
  }
  for (const [bin, line] of rows) {
    const band = bins[bin] ? bandOf(bins[bin], threshold) : 'competitive'
    addLine(out[band], line)
  }
  return out
}

export type BandSplit = Record<Band, number>

/**
 * Points split three ways, for a player or a team.
 *
 * Scored from the same band totals the stat table reads, so the donut and the
 * table can never disagree about which band a play landed in.
 */
export function splitByBand(
  rows: BinRow[],
  bins: GarbageBin[],
  threshold: number,
  ppr: number,
): BandSplit {
  const totals = totalsByBand(rows, bins, threshold)
  return {
    trailing: fantasyPoints(totals.trailing, ppr),
    competitive: fantasyPoints(totals.competitive, ppr),
    leading: fantasyPoints(totals.leading, ppr),
  }
}

/* --------------------------------------------------------------------------
 * Ranking
 * ----------------------------------------------------------------------- */

/**
 * Roughly a 12-team league: 1 QB, 2 RB, 3 WR, 1 TE, plus flex pressure.
 *
 * Used to pick which players the headline tiles talk about — a fall out of the
 * hundredth spot is not news, a fall out of a starting lineup is.
 */
export const STARTABLE: Record<FantasyPos, number> = { QB: 12, RB: 24, WR: 30, TE: 12 }

export const POSITIONS: FantasyPos[] = ['QB', 'RB', 'WR', 'TE']

export interface Settings {
  threshold: number
  format: Format
  remove: Removals
}

export interface PlayerRow {
  player: GarbagePlayer
  /** Everything he did, at the chosen scoring format. */
  actual: number
  /** What is left once the checked bands are taken out. */
  remaining: number
  /** actual − remaining. */
  removed: number
  /**
   * Points from either garbage-time band, whichever ones are being removed.
   * A property of his season and the threshold, not of the checkboxes.
   */
  garbage: number
  /** garbage ÷ actual, unclamped — a losing competitive line pushes it over 1. */
  share: number
  /** Points earned while winning big, reported whether or not they are removed. */
  leading: number
  actualRank: number
  remainingRank: number
  /** remainingRank − actualRank. Positive means he falls once points come out. */
  rankDelta: number
  actualPerGame: number
  remainingPerGame: number
}

/** Per-team share of offensive plays that fell in either garbage band. */
export function teamRates(file: GarbageTimeFile, threshold: number): Map<TeamAbbr, number> {
  const garbage = garbageBins(file.bins, threshold)
  const out = new Map<TeamAbbr, number>()
  for (const team of file.teams) {
    let all = 0
    let bad = 0
    for (const [bin, n] of team.plays) {
      all += n
      if (garbage.has(bin)) bad += n
    }
    out.set(team.team, all > 0 ? bad / all : 0)
  }
  return out
}

/**
 * Each team's offensive plays split three ways, as shares of its own season.
 *
 * Shares rather than counts because teams do not run the same number of plays,
 * and the question is what proportion of a season happened in each state. The
 * denominator is the true snap count, not the summed stat lines, which count a
 * snap once per role.
 */
export function teamBandShares(
  file: GarbageTimeFile,
  threshold: number,
): Map<TeamAbbr, Record<Band, number>> {
  const out = new Map<TeamAbbr, Record<Band, number>>()
  for (const team of file.teams) {
    const counts: Record<Band, number> = { trailing: 0, competitive: 0, leading: 0 }
    let all = 0
    for (const [bin, n] of team.plays) {
      all += n
      counts[file.bins[bin] ? bandOf(file.bins[bin], threshold) : 'competitive'] += n
    }
    out.set(
      team.team,
      all > 0
        ? {
            trailing: counts.trailing / all,
            competitive: counts.competitive / all,
            leading: counts.leading / all,
          }
        : counts,
    )
  }
  return out
}

export interface BandUsage {
  /**
   * Share of his snaps that fell in this band — or of his touches and targets
   * on a season with no participation data. `basis` says which.
   */
  playerShare: number
  /** Share of his team's offensive snaps that fell in it. */
  teamShare: number
  /**
   * playerShare ÷ teamShare. Above 1 means he was on the field for more of this
   * state than his offense played of it — the difference between a bad team's
   * WR1 and a WR4 who only appears in mop-up.
   */
  lift: number
  /** What playerShare counts. Snaps where they exist, touches otherwise. */
  basis: 'snaps' | 'touches'
}

/**
 * How a player was used in each state of the game, against how much of it his
 * offense played.
 *
 * Split by band rather than pooled, because trailing and leading garbage are
 * opposite situations that happen to different players: a receiver piles up
 * targets while his team is buried, a back gets carries while his team runs
 * the clock out. A single "garbage time" rate averages a receiver's real
 * exposure with a leading band he was never on the field for, and reports a
 * number that describes neither.
 */
export function bandUsage(
  player: GarbagePlayer,
  file: GarbageTimeFile,
  threshold: number,
  teamShares: Map<TeamAbbr, Record<Band, number>>,
): Record<Band, BandUsage> {
  const mine = totalsByBand(player.bins, file.bins, threshold)
  // Snaps are the honest denominator: a receiver is in a game state whether or
  // not the ball came near him. Touches are the fallback for the seasons that
  // predate participation data, and `basis` tells the interface which it got so
  // it can label the column truthfully rather than calling both "snaps".
  const key: StatKey = file.has_snaps ? 'snaps' : 'plays'
  const basis = file.has_snaps ? 'snaps' : 'touches'
  const whole = BANDS.reduce((sum, band) => sum + mine[band][key], 0)
  const team = teamShares.get(player.team)
  const out = {} as Record<Band, BandUsage>
  for (const band of BANDS) {
    const playerShare = whole > 0 ? mine[band][key] / whole : 0
    const teamShare = team?.[band] ?? 0
    out[band] = {
      playerShare,
      teamShare,
      lift: teamShare > 0 ? playerShare / teamShare : 0,
      basis,
    }
  }
  return out
}

/**
 * The share of the league's offensive plays in each garbage band.
 *
 * Reported separately because the two are separate checkboxes, and because the
 * split is the reader's cheapest sanity check on where the threshold sits.
 */
export function leagueShares(
  file: GarbageTimeFile,
  threshold: number,
): { trailing: number; leading: number } {
  let all = 0
  let trailing = 0
  let leading = 0
  for (const team of file.teams) {
    for (const [bin, n] of team.plays) {
      all += n
      const band = file.bins[bin] ? bandOf(file.bins[bin], threshold) : 'competitive'
      if (band === 'trailing') trailing += n
      if (band === 'leading') leading += n
    }
  }
  return all > 0 ? { trailing: trailing / all, leading: leading / all } : { trailing: 0, leading: 0 }
}

/**
 * Every player in the file, ranked within his own position twice — once on what
 * he actually scored and once with the chosen bands removed.
 *
 * Ranks are within position because a tight end's forty points and a
 * quarterback's forty points are not the same achievement. Ties break on id so
 * the order is stable across renders and across reloads.
 */
export function buildRows(file: GarbageTimeFile, s: Settings): PlayerRow[] {
  const ppr = PPR[s.format]
  const removed = removedBins(file.bins, s.threshold, s.remove)

  const partial = file.players.map((player) => {
    const all = totals(player.bins)
    const actual = fantasyPoints(all, ppr)
    const remaining = fantasyPoints(totals(player.bins, removed), ppr)
    const split = splitByBand(player.bins, file.bins, s.threshold, ppr)
    const games = Math.max(player.games, 1)
    const garbagePoints = split.trailing + split.leading
    return {
      player,
      actual,
      remaining,
      removed: actual - remaining,
      garbage: garbagePoints,
      share: actual > 0 ? garbagePoints / actual : 0,
      leading: split.leading,
      actualRank: 0,
      remainingRank: 0,
      rankDelta: 0,
      actualPerGame: actual / games,
      remainingPerGame: remaining / games,
    }
  })

  for (const pos of POSITIONS) {
    const group = partial.filter((r) => r.player.pos === pos)
    const rank = (
      key: 'actual' | 'remaining',
      assign: (r: (typeof partial)[number], n: number) => void,
    ) => {
      ;[...group]
        .sort((a, b) => b[key] - a[key] || a.player.id.localeCompare(b.player.id))
        .forEach((r, i) => assign(r, i + 1))
    }
    rank('actual', (r, n) => (r.actualRank = n))
    rank('remaining', (r, n) => (r.remainingRank = n))
  }

  return partial.map((r) => {
    r.rankDelta = r.remainingRank - r.actualRank
    return r
  })
}
