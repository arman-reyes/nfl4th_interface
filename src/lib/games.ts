import type { Play } from '../types'
import { actualChoice } from './decision'
import { decisionImpact } from './impact'
import { gameResult } from './filters'
import type { GameResult } from './filters'

/**
 * Per-game roll-ups of the 4th-down decisions.
 *
 * Win probability is additive in the same currency across a game, so summing
 * what each decision gave away answers "how much did the 4th downs cost here"
 * without inventing anything. It does *not* answer whether the game would have
 * been won: win probability is an expected value, and a game high on this list
 * is one where the calls gave away the most, not one that was demonstrably
 * thrown away.
 */
export interface GameSummary {
  gameId: string
  season: number
  week: number
  opponent: string
  home: boolean
  result: GameResult | null
  /** 4th downs whose play_type maps to a decision. */
  decisions: number
  disagreements: number
  /** Win probability given up across the game, in percentage points. */
  forfeited: number
  /**
   * The part of that given up while the game was still live. Calls taken at a
   * 95%+ win probability are excluded, because at that point there was little
   * left for them to change; they stay in `forfeited`.
   */
  forfeitedLive: number
}

export function summarizeGames(plays: Play[]): GameSummary[] {
  const byGame = new Map<string, GameSummary>()

  for (const play of plays) {
    let game = byGame.get(play.game_id)
    if (!game) {
      game = {
        gameId: play.game_id,
        season: play.season,
        week: play.week,
        opponent: play.defteam,
        home: play.posteam_home,
        result: gameResult(play),
        decisions: 0,
        disagreements: 0,
        forfeited: 0,
        forfeitedLive: 0,
      }
      byGame.set(play.game_id, game)
    }

    if (actualChoice(play) === null) continue
    game.decisions += 1

    const impact = decisionImpact(play)
    if (impact === null) continue
    game.disagreements += 1
    game.forfeited += impact.cost
    if (!impact.inert) game.forfeitedLive += impact.cost
  }

  return [...byGame.values()].sort((a, b) => a.week - b.week)
}

/**
 * The games where the calls gave away the most while the game was live,
 * restricted to one outcome. Games that gave away nothing are left out.
 */
export function costliest(
  games: GameSummary[],
  outcome: GameResult['outcome'],
  limit = 4,
): GameSummary[] {
  return games
    .filter((g) => g.result?.outcome === outcome && g.forfeitedLive > 0)
    .sort((a, b) => b.forfeitedLive - a.forfeitedLive)
    .slice(0, limit)
}

export interface GameTally {
  games: number
  /** Games with at least one decision that went against the model. */
  withDisagreement: number
}

/** How often the staff went against the model at all, by outcome. */
export function tallyByOutcome(games: GameSummary[], outcome: GameResult['outcome']): GameTally {
  const scoped = games.filter((g) => g.result?.outcome === outcome)
  return {
    games: scoped.length,
    withDisagreement: scoped.filter((g) => g.disagreements > 0).length,
  }
}
