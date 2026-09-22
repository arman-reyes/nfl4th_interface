import type { Play } from '../../types'
import { BranchSplit } from './BranchSplit'

/** What going for it on 4th down actually risks: convert, or hand it over. */
export function GoRisk({ play }: { play: Play }) {
  const convert = play.first_down_prob
  return (
    <BranchSplit
      heading="If they go for it"
      branches={[
        { label: 'Convert', weight: convert, wp: play.wp_succeed },
        { label: 'Fail', weight: 1 - convert, wp: play.wp_fail },
      ]}
      expected={play.go_wp}
    />
  )
}
