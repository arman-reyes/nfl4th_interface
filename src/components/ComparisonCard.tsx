import type { Play, TeamMeta } from '../types'
import { actualChoice, band, modelChoice, wpForfeited } from '../lib/decision'
import { GoRisk } from './decision/GoRisk'
import { OptionsTable } from './decision/OptionsTable'
import { OutcomePanels } from './decision/OutcomePanels'
import { SituationHeader } from './decision/SituationHeader'

interface Props {
  play: Play
  team?: TeamMeta
}

/**
 * One 4th down, reviewed.
 *
 * Reading order is the review itself: the situation, what the staff did set
 * against what the model wanted, then every option priced row by row, then
 * what going for it actually risked.
 */
export function ComparisonCard({ play, team }: Props) {
  const recommended = modelChoice(play)
  const actual = actualChoice(play)

  return (
    <article className="space-y-6 rounded-lg border border-stone-200 bg-white p-4 shadow-xs sm:p-6">
      <SituationHeader play={play} team={team} />

      <OutcomePanels
        play={play}
        team={team}
        actual={actual}
        recommended={recommended}
        band={band(play.go_boost)}
        forfeited={wpForfeited(play)}
      />

      <OptionsTable play={play} recommended={recommended} actual={actual} />

      <GoRisk play={play} />

      <p className="border-t border-stone-100 pt-4 text-xs leading-relaxed text-stone-400">
        {play.desc}
      </p>
    </article>
  )
}
