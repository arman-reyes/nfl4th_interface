import { teamSurface } from '../lib/color'

type Size = 'sm' | 'md'

interface Props {
  abbr: string
  size?: Size
  title?: string
}

const SIZES: Record<Size, string> = {
  sm: 'px-1.5 py-px text-[0.6875rem]',
  md: 'px-2 py-0.5 text-sm',
}

/**
 * A team abbreviation as a colour chip.
 *
 * The stripe on the trailing edge is the team's secondary colour. Ten of the
 * 32 primaries are near-black, so without it Chicago, Seattle, Dallas,
 * Tennessee, New England and the Giants would all be the same navy pill.
 */
export function TeamPill({ abbr, size = 'sm', title }: Props) {
  const { background, color, accent } = teamSurface(abbr)
  return (
    <span
      title={title ?? abbr}
      style={{ background, color, boxShadow: `inset -3px 0 0 ${accent}` }}
      className={`tnum inline-flex items-center rounded-sm pr-2 font-bold tracking-wide ${SIZES[size]}`}
    >
      {abbr}
    </span>
  )
}

/** "4th & 3 at [KC] 38", with the side of the field as a pill. */
export function FieldSpotLabel({
  side,
  yard,
  size = 'sm',
}: {
  side: string | null
  yard: number
  size?: Size
}) {
  if (side === null) return <>the 50</>
  return (
    <span className="inline-flex items-center gap-1.5 align-baseline">
      <TeamPill abbr={side} size={size} />
      {yard}
    </span>
  )
}
