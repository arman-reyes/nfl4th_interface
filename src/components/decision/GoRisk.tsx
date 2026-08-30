import type { Play } from '../../types'
import { pct } from '../../lib/format'

/**
 * What going for it actually risks: the two outcomes, and how the model
 * weights them. The split bar carries the weight; the two blocks underneath
 * carry the numbers, at a size that survives a narrow conversion probability.
 */
export function GoRisk({ play }: { play: Play }) {
  const convert = play.first_down_prob
  const fail = 1 - convert

  return (
    <section>
      <h3 className="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">
        If they go for it
      </h3>

      <div
        className="mt-3 flex h-3 overflow-hidden rounded-sm"
        role="img"
        aria-label={`Converts ${pct(convert)} of the time, fails ${pct(fail)} of the time`}
      >
        <div className="h-full bg-stone-900" style={{ width: `${convert * 100}%` }} />
        <div className="h-full bg-stone-300" style={{ width: `${fail * 100}%` }} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Branch
          label="Convert"
          weight={convert}
          wp={play.wp_succeed}
          className="border-stone-900"
        />
        <Branch label="Fail" weight={fail} wp={play.wp_fail} className="border-stone-300" />
      </div>

      <p className="tnum mt-3 text-sm text-stone-500">
        Weighted, that is a{' '}
        <span className="font-semibold text-stone-900">{pct(play.go_wp, 1)}</span> chance to win.
      </p>
    </section>
  )
}

interface BranchProps {
  label: string
  weight: number
  wp: number
  className: string
}

function Branch({ label, weight, wp, className }: BranchProps) {
  return (
    <div className={`border-l-3 pl-3 ${className}`}>
      <p className="tnum text-sm font-semibold tracking-wide text-stone-500 uppercase">
        {label} {pct(weight)}
      </p>
      <p className="tnum text-3xl font-semibold text-stone-900">{pct(wp, 1)}</p>
      <p className="text-xs text-stone-500">chance to win</p>
    </div>
  )
}
