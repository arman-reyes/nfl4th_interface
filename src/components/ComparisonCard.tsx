import type { Choice, Play, TeamMeta } from '../types'
import { actualChoice, FOURTH_DOWN, modelChoice, wpOf } from '../lib/decision'
import { pct } from '../lib/format'
import { GoRisk } from './decision/GoRisk'
import { OptionsTable } from './decision/OptionsTable'
import type { OptionRow } from './decision/OptionsTable'
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

      <OutcomePanels rules={FOURTH_DOWN} play={play} team={team} noun="this 4th down" />

      <OptionsTable
        rows={FOURTH_DOWN.choices.map(
          (choice): OptionRow => ({
            key: choice,
            label: FOURTH_DOWN.copy[choice].label,
            wp: wpOf(play, choice),
            detail: detailFor(play, choice),
            model: choice === recommended,
            actual: choice === actual,
          }),
        )}
      />

      <GoRisk play={play} />

      <p className="border-t border-stone-100 pt-4 text-xs leading-relaxed text-stone-400">
        {play.desc}
      </p>
    </article>
  )
}

function detailFor(play: Play, choice: Choice): string | null {
  if (choice === 'go') return `converts ${pct(play.first_down_prob)} of the time`
  if (choice === 'fg') {
    if (play.fg_make_prob === null) return null
    return `${play.yardline_100 + 17} yards, ${pct(play.fg_make_prob)} make`
  }
  return null
}
