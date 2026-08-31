import { useMemo } from 'react'
import type { Choice, LeagueIndex, PlayFacts } from '../../types'
import { pct, points } from '../../lib/format'
import type { Answer } from '../../lib/quiz'
import { scoreRound } from '../../lib/quiz'
import { StatTile } from '../summary/StatTile'
import { DecisionMatrix } from '../summary/DecisionMatrix'

interface Props {
  /** Every call this session, across all rounds. */
  all: Answer[]
  /** Just the round that finished. */
  round: Answer[]
  rounds: number
  index: LeagueIndex
  onAgain: () => void
  onBack: () => void
}

/** The median across the 32 staffs, for something to be measured against. */
function leagueMedian(index: LeagueIndex, pick: (abbr: string) => number | null): number | null {
  const values = index.teams
    .map((team) => pick(team.team_abbr))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)
  if (values.length === 0) return null
  return values[Math.floor(values.length / 2)]
}

/**
 * The reader's record, over every round they have played.
 *
 * Cumulative on purpose: ten calls is far too few to say anything about anyone,
 * and the honest way to make the numbers mean more is to answer more of them.
 */
export function QuizResults({ all, round, rounds, index, onAgain, onBack }: Props) {
  const score = useMemo(() => scoreRound(all), [all])
  const lastRound = useMemo(() => scoreRound(round), [round])

  const benchmarks = useMemo(() => {
    const allSeasons = (abbr: string) =>
      index.teams.find((t) => t.team_abbr === abbr)?.summaries.find((s) => s.season === null) ?? null
    return {
      aggressiveness: leagueMedian(index, (a) => allSeasons(a)?.aggressiveness ?? null),
      agreement: leagueMedian(index, (a) => allSeasons(a)?.agreement ?? null),
    }
  }, [index])

  // The matrix renders from the plays plus a lookup of what the reader called.
  const calls = useMemo(() => {
    const map = new Map<PlayFacts, Choice | null>()
    for (const answer of all) map.set(answer.play, answer.choice)
    return map
  }, [all])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          {rounds === 1 ? 'Your ten calls' : `Your ${all.length} calls`}
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          {rounds > 1 && (
            <>
              Across {rounds} rounds, scored together.{' '}
              {lastRound.decisions > 0 && (
                <>
                  This round: {lastRound.matched} of {lastRound.decisions} matched.{' '}
                </>
              )}
            </>
          )}
          Scored the same way every coaching staff in this tool is scored.
          {score.timedOut > 0 &&
            ` ${score.timedOut} ran out of time and ${score.timedOut === 1 ? 'is' : 'are'} left out, the way a penalty would be.`}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Aggressiveness"
          value={score.aggressiveness === null ? '—' : pct(score.aggressiveness)}
          note={`went on ${score.goTaken} of ${score.goRecommended} the model wanted`}
          benchmark={
            benchmarks.aggressiveness === null
              ? undefined
              : `NFL staffs: ${pct(benchmarks.aggressiveness)}`
          }
        />
        <StatTile
          label="Agreement"
          value={score.agreement === null ? '—' : pct(score.agreement)}
          note={`of ${score.decisions} calls`}
          benchmark={
            benchmarks.agreement === null ? undefined : `NFL staffs: ${pct(benchmarks.agreement)}`
          }
        />
        <StatTile
          label="Given up"
          value={points(score.forfeited)}
          note={`win prob points across ${score.decisions} calls`}
        />
        <StatTile
          label="Per call"
          value={points(score.forfeitedPerDecision, 2)}
          note="points given up on average"
        />
      </dl>

      <DecisionMatrix
        plays={all.map((a) => a.play)}
        choiceOf={(play) => calls.get(play) ?? null}
        heading="Your calls against the model"
      />

      <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm leading-relaxed text-stone-600 shadow-xs">
        {score.aggressiveness !== null && benchmarks.aggressiveness !== null && (
          <>
            {score.aggressiveness > benchmarks.aggressiveness ? (
              <>
                You have gone for it more often than the median NFL staff has over the last twelve
                seasons.{' '}
              </>
            ) : (
              <>
                You have gone for it less often than the median NFL staff has over the last twelve
                seasons — the usual result, and the reason the league has spent a decade moving.{' '}
              </>
            )}
          </>
        )}
        {score.decisions < 30 ? (
          <>
            {score.decisions} calls is still a small sample. Another round or two makes these
            numbers worth something — a full NFL season is about 130.
          </>
        ) : (
          <>
            {score.decisions} calls is getting close to a real sample; an NFL team faces about 130
            in a season.
          </>
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onAgain}
          className="rounded-lg bg-stone-900 px-5 py-3 text-sm font-bold tracking-wide text-white uppercase hover:bg-stone-700 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Ten more
        </button>
        <button
          onClick={onBack}
          className="rounded-lg border border-stone-300 px-5 py-3 text-sm font-bold tracking-wide text-stone-600 uppercase hover:border-stone-500 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
        >
          Back to teams
        </button>
      </div>
    </div>
  )
}
