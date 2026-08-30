import type { Choice, Play, TeamMeta } from '../../types'
import { CHOICE_VERB } from '../../lib/decision'
import { pointsGap } from '../../lib/format'

interface Props {
  play: Play
  actual: Choice | null
  recommended: Choice
  forfeited: number | null
  team?: TeamMeta
}

const PAST_TENSE: Record<Choice, string> = {
  go: 'went for it',
  fg: 'kicked',
  punt: 'punted',
}

/** What the staff did, shown only when the card came from a real play. */
export function ActualCall({ play, actual, recommended, forfeited, team }: Props) {
  const name = team?.team_name ?? play.posteam

  if (actual === null) {
    return (
      <footer className="border-t border-stone-200 pt-4 text-sm text-stone-500">
        Recorded as{' '}
        <span className="font-medium text-stone-700">
          {play.play_type?.replace(/_/g, ' ') ?? 'no play type'}
        </span>
        , which carries no decision, so this 4th down is excluded from agreement statistics.
      </footer>
    )
  }

  const matched = actual === recommended
  const cost = forfeited ?? 0

  return (
    <footer className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-stone-200 pt-4">
      <p className="text-base text-stone-600">
        <span className="font-semibold text-stone-900">{name}</span> {PAST_TENSE[actual]}.
      </p>
      {matched ? (
        <p className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          Matched the model
        </p>
      ) : (
        <p className="tnum text-sm text-stone-600">
          <span className="font-semibold tracking-wide text-amber-700 uppercase">
            Model said {CHOICE_VERB[recommended]}
          </span>
          <span className="mx-2 text-stone-300">·</span>
          cost <span className="font-semibold text-stone-900">{pointsGap(cost)}</span> points of
          win probability
        </p>
      )}
    </footer>
  )
}
