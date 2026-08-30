import type { Band, Choice, Play, TeamMeta } from '../../types'
import { CHOICE_VERB } from '../../lib/decision'
import { pct, pointsGap } from '../../lib/format'
import { accentOnLight } from '../../lib/color'
import { BandMeter } from './BandMeter'

interface Props {
  play: Play
  team?: TeamMeta
  actual: Choice | null
  recommended: Choice
  band: Band
  forfeited: number | null
}

const PAST_TENSE: Record<Choice, string> = {
  go: 'WENT FOR IT',
  fg: 'KICKED',
  punt: 'PUNTED',
}

/**
 * The comparison, side by side: what happened, then what the model wanted.
 * What happened comes first because that is the thing being reviewed; the
 * model is the yardstick held up against it.
 */
export function OutcomePanels({ play, team, actual, recommended, band, forfeited }: Props) {
  const accent = team ? accentOnLight(team) : '#1c1917'
  const matched = actual !== null && actual === recommended
  const actualWp = actual === null ? null : actual === 'go' ? play.go_wp : actual === 'fg' ? play.fg_wp : play.punt_wp
  const modelWp = recommended === 'go' ? play.go_wp : recommended === 'fg' ? play.fg_wp : play.punt_wp

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Panel
          heading="On the field"
          headingColor={accent}
          rule={accent}
          verdict={actual === null ? 'NO CALL' : PAST_TENSE[actual]}
          wp={actualWp}
          note={
            actual === null
              ? `recorded as ${play.play_type?.replace(/_/g, ' ') ?? 'no play type'}`
              : `${team?.team_name ?? play.posteam}, ${play.season}`
          }
        />
        <Panel
          heading="Model"
          headingColor="#57534e"
          rule="#1c1917"
          verdict={CHOICE_VERB[recommended]}
          wp={modelWp}
          note={<BandMeter band={band} />}
        />
      </div>

      <VerdictStrip matched={matched} actual={actual} forfeited={forfeited} />
    </div>
  )
}

interface PanelProps {
  heading: string
  headingColor: string
  rule: string
  verdict: string
  wp: number | null
  note: React.ReactNode
}

function Panel({ heading, headingColor, rule, verdict, wp, note }: PanelProps) {
  return (
    <section
      className="rounded-md border border-stone-200 border-l-4 bg-white p-4 sm:p-5"
      style={{ borderLeftColor: rule }}
    >
      <h3
        className="text-xs font-bold tracking-[0.18em] uppercase"
        style={{ color: headingColor }}
      >
        {heading}
      </h3>
      <p className="mt-1.5 text-4xl leading-none font-extrabold tracking-tighter text-stone-900 sm:text-5xl">
        {verdict}
      </p>
      <p className="tnum mt-2 text-lg font-semibold text-stone-700">
        {wp === null ? '—' : pct(wp, 1)}
        <span className="ml-1.5 text-sm font-normal text-stone-500">chance to win</span>
      </p>
      <div className="mt-3 text-sm text-stone-500">{note}</div>
    </section>
  )
}

function VerdictStrip({
  matched,
  actual,
  forfeited,
}: {
  matched: boolean
  actual: Choice | null
  forfeited: number | null
}) {
  if (actual === null) {
    return (
      <p className="rounded-md bg-stone-100 px-4 py-3 text-sm text-stone-600">
        No decision to review — this 4th down is excluded from agreement statistics.
      </p>
    )
  }
  if (matched) {
    return (
      <p className="rounded-md bg-stone-900 px-4 py-3 text-sm font-semibold tracking-wide text-white uppercase">
        Agreed with the model
      </p>
    )
  }
  return (
    <p className="tnum rounded-md bg-amber-50 px-4 py-3 text-sm font-semibold tracking-wide text-amber-900 uppercase ring-1 ring-amber-200 ring-inset">
      Disagreed — cost {pointsGap(forfeited ?? 0)} points of win probability
    </p>
  )
}
