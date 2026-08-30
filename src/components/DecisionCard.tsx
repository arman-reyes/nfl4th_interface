import type { Play, TeamMeta } from '../types'
import { actualChoice, band, bestNonGo, modelChoice, wpForfeited } from '../lib/decision'
import { ActualCall } from './decision/ActualCall'
import { GoRisk } from './decision/GoRisk'
import { OptionBars } from './decision/OptionBars'
import { SituationHeader } from './decision/SituationHeader'
import { Verdict } from './decision/Verdict'

interface Props {
  play: Play
  team?: TeamMeta
  /** Hide the footer when the card is showing a hypothetical rather than a real play. */
  showActual?: boolean
}

/**
 * One 4th down, answered.
 *
 * Reading order is deliberate: situation, verdict, how strong, the three
 * options against each other, what going for it risks, and last what the staff
 * actually did. Someone glancing at it should be able to stop after the second
 * block and still have the answer.
 */
export function DecisionCard({ play, team, showActual = true }: Props) {
  const recommended = modelChoice(play)
  const actual = actualChoice(play)

  return (
    <article className="space-y-7 rounded-lg border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
      <SituationHeader play={play} team={team} />

      <Verdict
        recommended={recommended}
        band={band(play.go_boost)}
        gap={Math.abs(play.go_boost)}
        against={recommended === 'go' ? bestNonGo(play) : 'go'}
      />

      <OptionBars play={play} recommended={recommended} actual={showActual ? actual : null} />

      <GoRisk play={play} />

      {showActual && (
        <ActualCall
          play={play}
          actual={actual}
          recommended={recommended}
          forfeited={wpForfeited(play)}
          team={team}
        />
      )}
    </article>
  )
}
