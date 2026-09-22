import type { TeamMeta, Try, TryChoice } from '../../types'
import { pct } from '../../lib/format'
import { TWO_POINT } from '../../lib/twopt'
import { BranchSplit } from '../decision/BranchSplit'
import { OptionsTable } from '../decision/OptionsTable'
import type { OptionRow } from '../decision/OptionsTable'
import { OutcomePanels } from '../decision/OutcomePanels'
import { TrySituationHeader } from './TrySituationHeader'

interface Props {
  play: Try
  team?: TeamMeta
}

/**
 * One try, reviewed, in the same order as a 4th down: the situation, what the
 * staff did set against what the model wanted, both options priced, then
 * what each one actually risked.
 *
 * Both options get their branches drawn, where the 4th-down card draws only
 * the go. A punt has one outcome; an extra point has two, and a miss is a
 * real branch of the decision rather than a footnote to it.
 */
export function TryCard({ play, team }: Props) {
  const recommended = TWO_POINT.model(play)
  const actual = TWO_POINT.actual(play)

  return (
    <article className="space-y-6 rounded-lg border border-stone-200 bg-white p-4 shadow-xs sm:p-6">
      <TrySituationHeader play={play} team={team} />

      <OutcomePanels rules={TWO_POINT} play={play} team={team} noun="this try" />

      <OptionsTable
        rows={TWO_POINT.choices.map(
          (choice): OptionRow => ({
            key: choice,
            label: TWO_POINT.copy[choice].label,
            wp: TWO_POINT.wp(play, choice),
            detail: detailFor(play, choice),
            model: choice === recommended,
            actual: choice === actual,
          }),
        )}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <BranchSplit
          heading="If they go for two"
          branches={[
            { label: 'Convert', weight: play.conv_2pt, wp: play.wp_2 },
            { label: 'Fail', weight: 1 - play.conv_2pt, wp: play.wp_0 },
          ]}
          expected={play.wp_go2}
        />
        <BranchSplit
          heading="If they kick"
          branches={[
            { label: 'Good', weight: play.conv_1pt, wp: play.wp_1 },
            { label: 'Miss', weight: 1 - play.conv_1pt, wp: play.wp_0 },
          ]}
          expected={play.wp_go1}
        />
      </div>

      <p className="border-t border-stone-100 pt-4 text-xs leading-relaxed text-stone-400">
        {play.desc}
      </p>
    </article>
  )
}

function detailFor(play: Try, choice: TryChoice): string {
  return choice === 'two'
    ? `converts ${pct(play.conv_2pt)} of the time`
    : `good ${pct(play.conv_1pt)} of the time`
}
