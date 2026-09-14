import { STAT_ORDER } from '../travel'
import type {
  FantasyPos,
  PlayerGameRow,
  TeamGame,
  TravelPlayer,
  TravelSeasonFile,
  TravelStatKey,
} from '../../types'

/** A team-game with sensible defaults: a home game, a one-score win, a full stat line. */
export function makeGame(overrides: Partial<TeamGame> = {}): TeamGame {
  const site = overrides.site ?? (overrides.miles ? 'away' : 'home')
  return {
    game_id: '2024_01_X_Y',
    week: 1,
    team: 'KC',
    opp: 'DEN',
    site,
    venue: 'KAN00',
    miles: 0,
    tz: 0,
    body_hour: 13,
    rest: 7,
    opp_rest: 7,
    weekday: 'Sun',
    pf: 24,
    pa: 20,
    line: 3,
    pass_yds: 250,
    rush_yds: 100,
    plays: 60,
    epa: 6,
    turnovers: 1,
    penalties: 5,
    pen_yds: 40,
    sacks: 2,
    ...overrides,
  }
}

/** A player game row from named stats, pointing at a game index. */
export function row(game: number, stats: Partial<Record<TravelStatKey, number>>): PlayerGameRow {
  return [game, ...STAT_ORDER.map((k) => stats[k] ?? 0)]
}

export function makePlayer(
  id: string,
  pos: FantasyPos,
  rows: PlayerGameRow[],
  overrides: Partial<TravelPlayer> = {},
): TravelPlayer {
  return { id, name: `Player ${id}`, pos, team: 'KC', rows, ...overrides }
}

export function makeFile(
  games: TeamGame[],
  players: TravelPlayer[] = [],
  overrides: Partial<TravelSeasonFile> = {},
): TravelSeasonFile {
  return {
    generated_at: '2026-01-01T00:00:00Z',
    season: 2024,
    has_kickoff: true,
    stats: [...STAT_ORDER],
    venues: [{ id: 'KAN00', name: 'Arrowhead', lat: 39, lon: -94, country: 'US' }],
    bases: [{ team: 'KC', venue: 'KAN00', name: 'Arrowhead' }],
    games,
    players,
    ...overrides,
  }
}
