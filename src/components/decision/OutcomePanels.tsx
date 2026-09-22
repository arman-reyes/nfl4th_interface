import type { Situation, TeamMeta } from '../../types'
import { band } from '../../lib/decision'
import { pct, points } from '../../lib/format'
import { accentOnLight } from '../../lib/color'
import { GAME_STATE_NOTE, judgeDecision } from '../../lib/impact'
import type { DecisionImpact } from '../../lib/impact'
import type { DecisionRules } from '../../lib/rules'
import { BandMeter } from './BandMeter'

interface Props<P extends Situation, C extends string> {
  rules: DecisionRules<P, C>
  play: P
  team?: TeamMeta
  /** What the play is called when it carries no decision: "this 4th down". */
  noun: string
}

/**
 * The comparison, side by side: what happened, then what the model wanted.
 * What happened comes first because that is the thing being reviewed; the
 * model is the yardstick held up against it.
 *
 * Everything shown is read through the rules, so the same two panels review
 * a 4th down and a try.
 */
export function OutcomePanels<P extends Situation, C extends string>({
  rules,
  play,
  team,
  noun,
}: Props<P, C>) {
  const accent = team ? accentOnLight(team.team_abbr) : '#1c1917'
  const actual = rules.actual(play)
  const recommended = rules.model(play)
  const matched = actual !== null && actual === recommended
  const actualWp = actual === null ? null : rules.wp(play, actual)
  const modelWp = rules.wp(play, recommended)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Panel
          heading="On the field"
          headingColor={accent}
          rule={accent}
          verdict={actual === null ? 'NO CALL' : rules.copy[actual].past}
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
          // A neutral rule, so the coloured one is always the team's own half
          // of the comparison — including for the teams whose colour is black.
          rule="#a8a29e"
          verdict={rules.copy[recommended].verb}
          wp={modelWp}
          note={<BandMeter band={band(rules.boost(play))} />}
        />
      </div>

      <VerdictStrip
        matched={matched}
        noCall={actual === null}
        noun={noun}
        impact={judgeDecision(rules, play)}
        modelWp={modelWp}
      />
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
  noCall,
  noun,
  impact,
  modelWp,
}: {
  matched: boolean
  noCall: boolean
  noun: string
  impact: DecisionImpact | null
  modelWp: number | null
}) {
  if (noCall) {
    return (
      <p className="rounded-md bg-stone-100 px-4 py-3 text-sm text-stone-600">
        No decision to review — {noun} is excluded from agreement statistics.
      </p>
    )
  }
  if (matched || impact === null) {
    return (
      <p className="rounded-md bg-stone-900 px-4 py-3 text-sm font-semibold tracking-wide text-white uppercase">
        Agreed with the model
      </p>
    )
  }

  // A disagreement in a game already decided still disagreed, but at a 95%+ win
  // probability it could not change much, and reading it in amber alongside a
  // live-game call would overstate it.
  const tone = impact.inert
    ? 'bg-stone-100 text-stone-600 ring-stone-200'
    : 'bg-amber-50 text-amber-900 ring-amber-200'

  return (
    <div className={`tnum rounded-md px-4 py-3 text-sm ring-1 ring-inset ${tone}`}>
      <p className="font-semibold tracking-wide uppercase">
        Disagreed — cost {points(impact.cost)} points of win probability
      </p>
      <p className="mt-1 text-xs">
        {impact.inert ? (
          <>
            The game was already decided{modelWp === null ? '' : ` at ${pct(modelWp, 1)}`}, so there
            was little left for this call to change — though it still counts against the agreement
            rate.
          </>
        ) : (
          <>
            <span className="font-semibold capitalize">{impact.tier}</span>, with the{' '}
            {GAME_STATE_NOTE[impact.state]}.
          </>
        )}
      </p>
    </div>
  )
}
