import { STAT_ORDER } from '../garbageTime'
import type {
  FantasyPos,
  GarbageBin,
  GarbagePlayer,
  GarbageTeam,
  GarbageTimeFile,
  StatKey,
  StatLine,
} from '../../types'

/** The same 25-bin layout the pipeline emits: 12 trailing, the lump, 12 leading. */
export function makeBins(): GarbageBin[] {
  const width = 0.025
  const tail = 12
  const trailing: GarbageBin[] = Array.from({ length: tail }, (_, i) => ({
    lo: i * width,
    hi: (i + 1) * width,
    side: 'trailing',
  }))
  const leading: GarbageBin[] = Array.from({ length: tail }, (_, i) => ({
    lo: 0.7 + i * width,
    hi: 0.7 + (i + 1) * width,
    side: 'leading',
  }))
  return [...trailing, { lo: 0, hi: 1, side: 'clean' }, ...leading]
}

export const CLEAN_BIN = 12

/** A packed StatLine from named stats, so a test never counts commas. */
export function line(stats: Partial<Record<StatKey, number>>): StatLine {
  return STAT_ORDER.map((k) => stats[k] ?? 0)
}

export function makePlayer(
  id: string,
  pos: FantasyPos,
  bins: [number, Partial<Record<StatKey, number>>][],
  overrides: Partial<GarbagePlayer> = {},
): GarbagePlayer {
  return {
    id,
    name: `Player ${id}`,
    pos,
    team: 'KC',
    games: 17,
    bins: bins.map(([bin, stats]) => [bin, line(stats)]),
    ...overrides,
  }
}

export function makeTeam(
  team: string,
  plays: [number, number][],
  bins: [number, Partial<Record<StatKey, number>>][] = [],
): GarbageTeam {
  return { team, games: 17, plays, bins: bins.map(([bin, stats]) => [bin, line(stats)]) }
}

export function makeFile(
  players: GarbagePlayer[],
  teams: GarbageTeam[] = [makeTeam('KC', [[0, 100], [CLEAN_BIN, 900]])],
  hasSnaps = true,
): GarbageTimeFile {
  return {
    generated_at: '2026-01-01T00:00:00Z',
    season: 2025,
    through_week: 18,
    complete: true,
    has_snaps: hasSnaps,
    bins: makeBins(),
    clean_bin: CLEAN_BIN,
    margin: 9,
    stats: [...STAT_ORDER],
    players,
    teams,
  }
}
