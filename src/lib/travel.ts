import type {
  FantasyPos,
  TeamAbbr,
  TeamGame,
  TravelSeasonFile,
  TravelStatKey,
} from '../types'
import { PPR } from './garbageTime'
import type { Format } from './garbageTime'

/**
 * Travel impact: what changes when a team plays away from home, and whether
 * how far it went changes it further.
 *
 * Pure and DOM-free. `scripts/build-travel.ts` runs `aggregate` over every
 * season to write the all-seasons file, and the page runs the same function
 * over one season's file, so the two views are the same arithmetic on
 * different inputs and cannot disagree.
 */

export const STAT_ORDER: TravelStatKey[] = [
  'pts_std',
  'rec',
  'pass_yds',
  'pass_td',
  'int',
  'rush_yds',
  'rush_td',
  'rec_yds',
  'rec_td',
]

/** The file declares its column order; anything else is a pipeline drift. */
export function assertStatOrder(file: TravelSeasonFile): void {
  const declared = file.stats.join(',')
  const expected = STAT_ORDER.join(',')
  if (declared !== expected) {
    throw new Error(`travel ${file.season}: stat order is [${declared}], expected [${expected}]`)
  }
}

/* ---------------------------------------------------------------------------
 * Cells: enough to give a mean and its standard error, and to be merged.
 * ------------------------------------------------------------------------- */

/** Count, sum and sum of squares — everything a mean and its error need. */
export interface Cell {
  n: number
  sum: number
  sumsq: number
}

export function emptyCell(): Cell {
  return { n: 0, sum: 0, sumsq: 0 }
}

export function addValue(cell: Cell, value: number): void {
  cell.n += 1
  cell.sum += value
  cell.sumsq += value * value
}

export function mergeCells(cells: Cell[]): Cell {
  const out = emptyCell()
  for (const c of cells) {
    out.n += c.n
    out.sum += c.sum
    out.sumsq += c.sumsq
  }
  return out
}

export function mean(cell: Cell): number | null {
  return cell.n > 0 ? cell.sum / cell.n : null
}

/**
 * Standard error of the mean, from the sample variance. Null under two
 * observations, where a spread cannot be estimated.
 *
 * This is a sample statistic over games that happened, not a model's
 * uncertainty, which is why the page shows it where the 4th-down page shows
 * nothing of the kind.
 */
export function se(cell: Cell): number | null {
  if (cell.n < 2) return null
  const variance = Math.max(0, (cell.sumsq - (cell.sum * cell.sum) / cell.n) / (cell.n - 1))
  return Math.sqrt(variance / cell.n)
}

/** The difference of two means and its standard error, treating them as independent. */
export function diff(a: Cell, b: Cell): { value: number; se: number | null } | null {
  const ma = mean(a)
  const mb = mean(b)
  if (ma === null || mb === null) return null
  const sa = se(a)
  const sb = se(b)
  return { value: ma - mb, se: sa === null || sb === null ? null : Math.hypot(sa, sb) }
}

/* ---------------------------------------------------------------------------
 * Metrics: what is measured about a team-game.
 * ------------------------------------------------------------------------- */

export type MetricKey =
  | 'win'
  | 'margin'
  | 'vs_line'
  | 'cover'
  | 'pf'
  | 'epa_play'
  | 'yards'
  | 'turnovers'
  | 'penalties'
  | 'sacks'

export interface Metric {
  key: MetricKey
  label: string
  /** Column heading; short because it sits above its own numbers. */
  short: string
  /** Null where the source has no value, so the game drops out of this cell only. */
  value: (game: TeamGame) => number | null
  format: (value: number) => string
  /** Whether a higher value is good for the team, for reading a difference. */
  better: 'high' | 'low'
}

export function margin(game: TeamGame): number {
  return game.pf - game.pa
}

/** 1, 0.5 for a tie, 0. */
export function win(game: TeamGame): number {
  const m = margin(game)
  return m > 0 ? 1 : m === 0 ? 0.5 : 0
}

/** Margin against the closing line: positive beat the number. */
export function vsLine(game: TeamGame): number {
  return margin(game) - game.line
}

/** 1, 0.5 for a push, 0. */
export function cover(game: TeamGame): number {
  const v = vsLine(game)
  return v > 0 ? 1 : v === 0 ? 0.5 : 0
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const plain = (digits: number) => (v: number) => v.toFixed(digits)

/**
 * A signed number with a real minus sign, and no sign at all on a value that
 * rounds to zero — "−0.0" claims a direction the digits do not show.
 */
export function signedText(v: number, digits = 1): string {
  const abs = Math.abs(v).toFixed(digits)
  if (Number(abs) === 0) return abs
  return `${v > 0 ? '+' : '−'}${abs}`
}
const signed = (digits: number) => (v: number) => signedText(v, digits)

export const METRICS: Metric[] = [
  { key: 'win', label: 'Win rate', short: 'Win %', value: win, format: pct, better: 'high' },
  { key: 'margin', label: 'Margin', short: 'Margin', value: margin, format: signed(1), better: 'high' },
  {
    key: 'vs_line',
    label: 'Margin vs. line',
    short: 'vs Line',
    value: vsLine,
    format: signed(1),
    better: 'high',
  },
  { key: 'cover', label: 'Cover rate', short: 'Cover %', value: cover, format: pct, better: 'high' },
  { key: 'pf', label: 'Points scored', short: 'Pts', value: (g) => g.pf, format: plain(1), better: 'high' },
  {
    key: 'epa_play',
    label: 'EPA per play',
    short: 'EPA/play',
    value: (g) => (g.epa === null || g.plays === null || g.plays === 0 ? null : g.epa / g.plays),
    format: signed(3),
    better: 'high',
  },
  {
    key: 'yards',
    label: 'Yards',
    short: 'Yards',
    value: (g) => (g.pass_yds === null || g.rush_yds === null ? null : g.pass_yds + g.rush_yds),
    format: plain(0),
    better: 'high',
  },
  {
    key: 'turnovers',
    label: 'Turnovers',
    short: 'TO',
    value: (g) => g.turnovers,
    format: plain(2),
    better: 'low',
  },
  {
    key: 'penalties',
    label: 'Penalties',
    short: 'Pen',
    value: (g) => g.penalties,
    format: plain(2),
    better: 'low',
  },
  { key: 'sacks', label: 'Sacks taken', short: 'Sacks', value: (g) => g.sacks, format: plain(2), better: 'low' },
]

export const METRIC: Record<MetricKey, Metric> = Object.fromEntries(
  METRICS.map((m) => [m.key, m]),
) as Record<MetricKey, Metric>

/* ---------------------------------------------------------------------------
 * Lenses: the ways a trip can be bucketed. Bin 0 of every lens is home.
 * ------------------------------------------------------------------------- */

export type Lens = 'distance' | 'tz' | 'body' | 'rest' | 'phase' | 'era'

export interface LensDef {
  key: Lens
  label: string
  /** What the bins are of, for the table's first column. */
  heading: string
  bins: string[]
  /** Null where the game cannot be placed — e.g. no kickoff time. */
  binOf: (game: TeamGame, season: number) => number | null
}

/** A game is at home when it was played at the team's base; a trip is anything else. */
export function isTrip(game: TeamGame): boolean {
  return game.miles > 0
}

/** Lower edges of the distance bins after home. Bin i (i ≥ 1) is [edge[i-1], edge[i]). */
export const DISTANCE_EDGES = [1, 250, 500, 1000, 1500, 2000, 3000]

export const DISTANCE_LABELS = [
  'Home',
  'Under 250 mi',
  '250–500 mi',
  '500–1,000 mi',
  '1,000–1,500 mi',
  '1,500–2,000 mi',
  '2,000–3,000 mi',
  '3,000 mi and over',
]

export function distanceBin(miles: number): number {
  if (miles <= 0) return 0
  let bin = 1
  while (bin < DISTANCE_EDGES.length && miles >= DISTANCE_EDGES[bin]) bin += 1
  return bin
}

const TZ_LABELS = [
  'Home',
  '3+ zones west',
  '2 zones west',
  '1 zone west',
  'Same zone, away',
  '1 zone east',
  '2 zones east',
  '3 zones east',
  '4+ zones east',
]

function tzBin(game: TeamGame): number {
  if (!isTrip(game)) return 0
  const z = Math.round(game.tz)
  if (z <= -3) return 1
  if (z >= 4) return 8
  return z + 4
}

const BODY_LABELS = [
  'Home',
  '10am or earlier',
  '11am–noon',
  '1–3pm',
  '4–6pm',
  '7pm or later',
]

function bodyBin(game: TeamGame): number | null {
  if (!isTrip(game)) return 0
  if (game.body_hour === null) return null
  const h = Math.floor(game.body_hour)
  if (h <= 10) return 1
  if (h <= 12) return 2
  if (h <= 15) return 3
  if (h <= 18) return 4
  return 5
}

const REST_LABELS = [
  'Home, short week',
  'Home, regular week',
  'Home, extra rest',
  'Away, short week',
  'Away, regular week',
  'Away, extra rest',
]

/** Under six days is a short week; nine or more is a bye or a Thursday-to-Sunday-week-after. */
function restClass(rest: number): number {
  return rest <= 5 ? 0 : rest <= 8 ? 1 : 2
}

function restBin(game: TeamGame): number {
  return (isTrip(game) ? 3 : 0) + restClass(game.rest)
}

/**
 * When in the season the trip fell. The last month is split by the line
 * because it is the road underdog — the team with nothing left to play for —
 * that the late-season number turns out to be about.
 */
const PHASE_LABELS = [
  'Home',
  'Away, weeks 1–4',
  'Away, weeks 5–13',
  'Away, weeks 14+, favoured',
  'Away, weeks 14+, underdog',
]

function phaseBin(game: TeamGame): number {
  if (!isTrip(game)) return 0
  if (game.week <= 4) return 1
  if (game.week <= 13) return 2
  return game.line >= 0 ? 3 : 4
}

/**
 * Distance by era, at a fixed 1,500-mile cut. The far threshold cannot reach
 * in here — the bins are summed at build time — so the cut is the one the
 * finding was made at, and the label says so.
 */
export const ERAS: [number, number][] = [
  [1999, 2010],
  [2011, 2019],
  [2020, 2025],
]
export const ERA_FAR = 1500

const ERA_LABELS = [
  'Home',
  ...ERAS.flatMap(([a, b]) => [`${a}–${b}, under 1,500 mi`, `${a}–${b}, 1,500+ mi`]),
]

function eraBin(game: TeamGame, season: number): number | null {
  if (!isTrip(game)) return 0
  const era = ERAS.findIndex(([a, b]) => season >= a && season <= b)
  if (era < 0) return null
  return 1 + era * 2 + (game.miles >= ERA_FAR ? 1 : 0)
}

export const LENSES: LensDef[] = [
  {
    key: 'distance',
    label: 'Distance',
    heading: 'Trip',
    bins: DISTANCE_LABELS,
    binOf: (g) => distanceBin(g.miles),
  },
  { key: 'tz', label: 'Time zones', heading: 'Zones crossed', bins: TZ_LABELS, binOf: tzBin },
  {
    key: 'body',
    label: 'Body clock',
    heading: 'Kickoff, home clock',
    bins: BODY_LABELS,
    binOf: bodyBin,
  },
  { key: 'rest', label: 'Rest', heading: 'Rest', bins: REST_LABELS, binOf: restBin },
  { key: 'phase', label: 'Season phase', heading: 'When', bins: PHASE_LABELS, binOf: phaseBin },
  { key: 'era', label: 'Era', heading: 'Era and distance', bins: ERA_LABELS, binOf: eraBin },
]

export const LENS: Record<Lens, LensDef> = Object.fromEntries(
  LENSES.map((l) => [l.key, l]),
) as Record<Lens, LensDef>

/**
 * The bins a distance threshold calls far, merged into one cell: every bin
 * whose lower edge is at or beyond it. Thresholds are bin edges, so no bin is
 * ever split.
 */
export function farBin(threshold: number): number {
  const i = DISTANCE_EDGES.indexOf(threshold)
  if (i < 0) throw new Error(`far threshold ${threshold} is not a bin edge`)
  return i + 1
}

export function farCut(cells: Cell[], threshold: number): Cell {
  return mergeCells(cells.slice(farBin(threshold)))
}

/** Every trip: the away cell, whatever the distance. */
export function tripsCut(cells: Cell[]): Cell {
  return mergeCells(cells.slice(1))
}

/* ---------------------------------------------------------------------------
 * The aggregate: everything the page draws, from one season or all of them.
 * ------------------------------------------------------------------------- */

export type MetricCells = Record<MetricKey, Cell[]>

export interface TeamSplit {
  team: TeamAbbr
  /** Seasons this team appears in. */
  seasons: number
  games: number
  /** Trips and total miles, for a per-season average. */
  trips: number
  miles: number
  /** Sum of |time zones crossed| over trips. */
  tzAbs: number
  /** By the schedule's own home/away, the honest W-L split. */
  site: Record<'home' | 'away' | 'neutral', Record<MetricKey, Cell>>
  /** By distance bin, so a far cut can be taken. */
  distance: MetricCells
  /**
   * Margin vs. line by every lens's bins, for the within-team check: a
   * team's own trips of one kind against its own other trips, which is the
   * comparison that takes the team out of the answer.
   */
  lensVsLine: Record<Lens, Cell[]>
}

/** One season's home and away cells, for the edge-over-time chart. */
export interface SeasonSplit {
  season: number
  home: Record<MetricKey, Cell>
  away: Record<MetricKey, Cell>
}

/** Games and stat sums for one player in one bin. */
export interface PlayerCell {
  n: number
  /** In STAT_ORDER. */
  sums: number[]
}

export interface PlayerSplit {
  id: string
  name: string
  pos: FantasyPos
  team: TeamAbbr
  seasons: number
  games: number
  /** Indexed by distance bin; 0 is home. */
  bins: PlayerCell[]
}

/** Fantasy points per game in each distance bin, one cell per scoring format. */
export type PositionCells = Record<FantasyPos, Record<Lens, Record<Format, Cell[]>>>

export interface TravelAggregate {
  seasons: number[]
  /** Team-games. */
  games: number
  byLens: Record<Lens, MetricCells>
  bySeason: SeasonSplit[]
  byTeam: TeamSplit[]
  byPosition: PositionCells
  players: PlayerSplit[]
}

/** What scripts/build-travel.ts writes: the aggregate of every published season. */
export interface TravelLeagueFile extends TravelAggregate {
  generated_at: string
}

export const POSITIONS: FantasyPos[] = ['QB', 'RB', 'WR', 'TE']
export const FORMATS: Format[] = ['standard', 'half', 'ppr']

function cellsFor(count: number): Cell[] {
  return Array.from({ length: count }, emptyCell)
}

function metricCells(count: number): MetricCells {
  return Object.fromEntries(METRICS.map((m) => [m.key, cellsFor(count)])) as MetricCells
}

function metricCell(): Record<MetricKey, Cell> {
  return Object.fromEntries(METRICS.map((m) => [m.key, emptyCell()])) as Record<MetricKey, Cell>
}

function emptyPlayerCell(): PlayerCell {
  return { n: 0, sums: STAT_ORDER.map(() => 0) }
}

export function mergePlayerCells(cells: PlayerCell[]): PlayerCell {
  const out = emptyPlayerCell()
  for (const c of cells) {
    out.n += c.n
    for (let i = 0; i < out.sums.length; i += 1) out.sums[i] += c.sums[i]
  }
  return out
}

const PTS = STAT_ORDER.indexOf('pts_std')
const REC = STAT_ORDER.indexOf('rec')

/** Fantasy points of one game row, in a format. */
export function rowPoints(stats: number[], format: Format): number {
  return stats[PTS] + PPR[format] * stats[REC]
}

/** Points per game of a player cell in a format, or null with no games. */
export function pointsPerGame(cell: PlayerCell, format: Format): number | null {
  return cell.n > 0 ? rowPoints(cell.sums, format) / cell.n : null
}

/** A counting stat per game, by key. */
export function statPerGame(cell: PlayerCell, key: TravelStatKey): number | null {
  return cell.n > 0 ? cell.sums[STAT_ORDER.indexOf(key)] / cell.n : null
}

export interface AggregateOptions {
  /** Players kept per position, best total points first. */
  keepPlayers?: number
}

/**
 * Sum every season given into one aggregate.
 *
 * Files are taken in season order whatever order they arrive in, so a
 * player's name and team are always those of his latest season.
 */
export function aggregate(
  input: TravelSeasonFile[],
  { keepPlayers = 150 }: AggregateOptions = {},
): TravelAggregate {
  const files = [...input].sort((a, b) => a.season - b.season)
  for (const file of files) assertStatOrder(file)

  const byLens = Object.fromEntries(
    LENSES.map((l) => [l.key, metricCells(l.bins.length)]),
  ) as Record<Lens, MetricCells>

  const teams = new Map<TeamAbbr, TeamSplit & { seasonSet: Set<number> }>()
  const teamOf = (abbr: TeamAbbr) => {
    let t = teams.get(abbr)
    if (!t) {
      t = {
        team: abbr,
        seasons: 0,
        games: 0,
        trips: 0,
        miles: 0,
        tzAbs: 0,
        site: { home: metricCell(), away: metricCell(), neutral: metricCell() },
        distance: metricCells(DISTANCE_LABELS.length),
        lensVsLine: Object.fromEntries(
          LENSES.map((l) => [l.key, cellsFor(l.bins.length)]),
        ) as Record<Lens, Cell[]>,
        seasonSet: new Set(),
      }
      teams.set(abbr, t)
    }
    return t
  }

  const byPosition = Object.fromEntries(
    POSITIONS.map((pos) => [
      pos,
      Object.fromEntries(
        LENSES.map((l) => [
          l.key,
          Object.fromEntries(FORMATS.map((f) => [f, cellsFor(l.bins.length)])),
        ]),
      ),
    ]),
  ) as PositionCells

  const players = new Map<string, PlayerSplit & { total: number; seasonSet: Set<number> }>()

  const bySeason: SeasonSplit[] = []
  let games = 0
  for (const file of files) {
    const seasonSplit: SeasonSplit = { season: file.season, home: metricCell(), away: metricCell() }
    bySeason.push(seasonSplit)
    for (const g of file.games) {
      games += 1
      const values = METRICS.map((m) => m.value(g))
      const vsLineValue = vsLine(g)
      const t = teamOf(g.team)
      for (const lens of LENSES) {
        const bin = lens.binOf(g, file.season)
        if (bin === null) continue
        METRICS.forEach((m, i) => {
          const v = values[i]
          if (v !== null) addValue(byLens[lens.key][m.key][bin], v)
        })
        addValue(t.lensVsLine[lens.key][bin], vsLineValue)
      }
      if (g.site !== 'neutral') {
        const side = seasonSplit[g.site]
        METRICS.forEach((m, i) => {
          const v = values[i]
          if (v !== null) addValue(side[m.key], v)
        })
      }

      t.seasonSet.add(file.season)
      t.games += 1
      if (isTrip(g)) {
        t.trips += 1
        t.miles += g.miles
        t.tzAbs += Math.abs(g.tz)
      }
      const dbin = distanceBin(g.miles)
      METRICS.forEach((m, i) => {
        const v = values[i]
        if (v === null) return
        addValue(t.site[g.site][m.key], v)
        addValue(t.distance[m.key][dbin], v)
      })
    }

    for (const p of file.players) {
      let acc = players.get(p.id)
      if (!acc) {
        acc = {
          id: p.id,
          name: p.name,
          pos: p.pos,
          team: p.team,
          seasons: 0,
          games: 0,
          bins: Array.from({ length: DISTANCE_LABELS.length }, emptyPlayerCell),
          total: 0,
          seasonSet: new Set(),
        }
        players.set(p.id, acc)
      }
      // Latest season wins, and files are in season order.
      acc.name = p.name
      acc.team = p.team
      acc.pos = p.pos
      acc.seasonSet.add(file.season)
      for (const row of p.rows) {
        const g = file.games[row[0]]
        if (!g) throw new Error(`travel ${file.season}: ${p.name} points at game ${row[0]}`)
        const stats = row.slice(1)
        if (stats.length !== STAT_ORDER.length) {
          throw new Error(`travel ${file.season}: ${p.name} has a ${stats.length}-wide stat row`)
        }
        acc.games += 1
        acc.total += stats[PTS]
        const cell = acc.bins[distanceBin(g.miles)]
        cell.n += 1
        for (let i = 0; i < stats.length; i += 1) cell.sums[i] += stats[i]

        for (const lens of LENSES) {
          const bin = lens.binOf(g, file.season)
          if (bin === null) continue
          for (const f of FORMATS) addValue(byPosition[p.pos][lens.key][f][bin], rowPoints(stats, f))
        }
      }
    }
  }

  const byTeam = [...teams.values()]
    .map(({ seasonSet, ...t }) => ({ ...t, seasons: seasonSet.size }))
    .sort((a, b) => a.team.localeCompare(b.team))

  const kept: PlayerSplit[] = []
  for (const pos of POSITIONS) {
    const atPos = [...players.values()]
      .filter((p) => p.pos === pos)
      .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id))
      .slice(0, keepPlayers)
    for (const { total: _total, seasonSet, ...p } of atPos) {
      kept.push({ ...p, seasons: seasonSet.size })
    }
  }

  return {
    seasons: files.map((f) => f.season),
    games,
    byLens,
    bySeason,
    byTeam,
    byPosition,
    players: kept,
  }
}

/* ---------------------------------------------------------------------------
 * Readings off an aggregate.
 * ------------------------------------------------------------------------- */

/** Share of trips at or beyond the threshold. */
export function farShare(agg: TravelAggregate, threshold: number): number {
  const cells = agg.byLens.distance.win
  const trips = tripsCut(cells).n
  return trips > 0 ? farCut(cells, threshold).n / trips : 0
}

/** Home, every trip, and the far trips, for one metric. */
export function homeAwayFar(
  cells: Cell[],
  threshold: number,
): { home: Cell; away: Cell; far: Cell } {
  return { home: cells[0], away: tripsCut(cells), far: farCut(cells, threshold) }
}

/** A player's home, away and far cells. */
export function playerCut(
  player: PlayerSplit,
  threshold: number,
): { home: PlayerCell; away: PlayerCell; far: PlayerCell } {
  return {
    home: player.bins[0],
    away: mergePlayerCells(player.bins.slice(1)),
    far: mergePlayerCells(player.bins.slice(farBin(threshold))),
  }
}

/** Trips per season and miles per season for a team. */
export function perSeason(team: TeamSplit): { trips: number; miles: number; tz: number } {
  const s = Math.max(1, team.seasons)
  return { trips: team.trips / s, miles: team.miles / s, tz: team.trips > 0 ? team.tzAbs / team.trips : 0 }
}

/* ---------------------------------------------------------------------------
 * What stands out: the bins the line did not price.
 * ------------------------------------------------------------------------- */

export interface Standout {
  lens: Lens
  bin: number
  label: string
  /** Margin vs. line. */
  vsLine: Cell
  margin: Cell
  cover: Cell
  /** Mean over its standard error. */
  z: number
  /**
   * The same bin measured within each team — its trips of this kind against
   * its other trips — averaged across teams with enough of them. Null where
   * fewer than two teams qualify. This is the number that says the finding is
   * not "the teams that make these trips are bad".
   */
  within: { value: number; se: number; teams: number } | null
}

/** A standout needs this many games; under it a single blowout can make one. */
export const STANDOUT_MIN_GAMES = 30
/** ...and this many standard errors from the line. */
export const STANDOUT_Z = 2
/** A team joins the within-team check with this many games in the bin. */
const WITHIN_MIN_GAMES = 10

function withinTeam(agg: TravelAggregate, lens: Lens, bin: number): Standout['within'] {
  let sum = 0
  let weight = 0
  let teams = 0
  for (const t of agg.byTeam) {
    const cells = t.lensVsLine[lens]
    const here = cells[bin]
    if (here.n < WITHIN_MIN_GAMES) continue
    const others = mergeCells(cells.filter((_, i) => i !== bin && i !== 0))
    const d = diff(here, others)
    if (!d || d.se === null || d.se === 0) continue
    const w = 1 / (d.se * d.se)
    sum += d.value * w
    weight += w
    teams += 1
  }
  if (teams < 2) return null
  return { value: sum / weight, se: 1 / Math.sqrt(weight), teams }
}

/**
 * Every trip bin, across every lens, whose margin against the line sits at
 * least `STANDOUT_Z` errors from zero — most extreme first. Home bins are
 * left out: the home edge is the page's first number, not a finding.
 *
 * With a single season loaded this is usually empty, and that is the honest
 * answer: a season's far bins are a dozen games each.
 */
export function standouts(agg: TravelAggregate): Standout[] {
  const out: Standout[] = []
  for (const lens of LENSES) {
    const cells = agg.byLens[lens.key]
    lens.bins.forEach((label, bin) => {
      if (bin === 0) return
      const cell = cells.vs_line[bin]
      const m = mean(cell)
      const err = se(cell)
      if (cell.n < STANDOUT_MIN_GAMES || m === null || err === null || err === 0) return
      const z = m / err
      if (Math.abs(z) < STANDOUT_Z) return
      out.push({
        lens: lens.key,
        bin,
        label,
        vsLine: cell,
        margin: cells.margin[bin],
        cover: cells.cover[bin],
        z,
        within: withinTeam(agg, lens.key, bin),
      })
    })
  }
  return out.sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
}
