import { pct } from '../../lib/format'

export interface Branch {
  /** "Convert", "Fail", "Good", "Miss". */
  label: string
  /** How likely this branch is, 0-1. The two branches sum to one. */
  weight: number
  /** Win probability if it happens. */
  wp: number
}

interface Props {
  heading: string
  /** The favourable branch first: it is drawn in ink, the other in grey. */
  branches: [Branch, Branch]
  /** The weighted expectation, which is the option's own win probability. */
  expected: number
}

/**
 * What an option actually risks: its two outcomes, and how the model weights
 * them. The split bar carries the weight; the two blocks underneath carry the
 * numbers, at a size that survives a narrow conversion probability.
 *
 * Going for it on 4th down, going for two and kicking the extra point are all
 * this shape, so the drawing lives here and each page names its branches.
 */
export function BranchSplit({ heading, branches, expected }: Props) {
  const [first, second] = branches

  return (
    <section>
      <h3 className="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">
        {heading}
      </h3>

      <div
        className="mt-3 flex h-3 overflow-hidden rounded-sm"
        role="img"
        aria-label={`${first.label} ${pct(first.weight)} of the time, ${second.label.toLowerCase()} ${pct(second.weight)} of the time`}
      >
        <div className="h-full bg-stone-900" style={{ width: `${first.weight * 100}%` }} />
        <div className="h-full bg-stone-300" style={{ width: `${second.weight * 100}%` }} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <BranchBlock branch={first} className="border-stone-900" />
        <BranchBlock branch={second} className="border-stone-300" />
      </div>

      <p className="tnum mt-3 text-sm text-stone-500">
        Weighted, that is a{' '}
        <span className="font-semibold text-stone-900">{pct(expected, 1)}</span> chance to win.
      </p>
    </section>
  )
}

function BranchBlock({ branch, className }: { branch: Branch; className: string }) {
  return (
    <div className={`border-l-3 pl-3 ${className}`}>
      <p className="tnum text-sm font-semibold tracking-wide text-stone-500 uppercase">
        {branch.label} {pct(branch.weight)}
      </p>
      <p className="tnum text-3xl font-semibold text-stone-900">{pct(branch.wp, 1)}</p>
      <p className="text-xs text-stone-500">chance to win</p>
    </div>
  )
}
