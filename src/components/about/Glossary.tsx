import { Code } from './prose'

interface Entry {
  term: string
  body: React.ReactNode
}

/** Every derived quantity the interface shows, and how it is computed. */
const ENTRIES: Entry[] = [
  {
    term: 'Actual choice',
    body: (
      <>
        <Code>play_type</Code> of <Code>run</Code> or <Code>pass</Code> means they went for it,{' '}
        <Code>field_goal</Code> that they kicked, <Code>punt</Code> that they punted. Anything else
        — a penalty, an aborted snap, a kneel — carries no decision and is excluded from every
        statistic rather than counted as one.
      </>
    ),
  },
  {
    term: 'Model recommendation',
    body: (
      <>
        Go when <Code>go_boost</Code> is positive, otherwise the higher of <Code>fg_wp</Code> and{' '}
        <Code>punt_wp</Code>. Taken from the sign of <Code>go_boost</Code> rather than a raw argmax
        of the three, so the verdict can never contradict the headline number when rounding puts an
        argmax on the other side of a hairline gap.
      </>
    ),
  },
  {
    term: 'Strength band',
    body: (
      <>
        The magnitude of <Code>go_boost</Code>: under 1 point is a <em>coin flip</em>, 1–3 a{' '}
        <em>lean</em>, above 3 a <em>clear</em> call. Magnitude, not sign — a four-point edge for
        the punt is as clear a call as a four-point edge for going.
      </>
    ),
  },
  {
    term: 'Aggressiveness',
    body: (
      <>
        Of the 4th downs where the model recommended going, the share the staff actually went for.
        The most comparable single number across staffs, because it holds the situation fixed.
      </>
    ),
  },
  {
    term: 'Agreement',
    body: <>The share of all classifiable 4th downs where the actual choice matched the model.</>,
  },
  {
    term: 'Win probability forfeited',
    body: (
      <>
        Per play, the model&rsquo;s recommendation minus the chosen option, in percentage points.
        Measured against the recommendation rather than a raw argmax, so agreeing always costs
        exactly zero.
      </>
    ),
  },
  {
    term: 'Impact tier',
    body: (
      <>
        The forfeited points banded on the same 1-and-3 scale as the strength band: <em>minor</em>,{' '}
        <em>notable</em>, <em>costly</em>.
      </>
    ),
  },
  {
    term: 'Game state',
    body: (
      <>
        How live the game was, from the win probability carried by the model&rsquo;s own
        recommendation: <em>in doubt</em> inside 35–65%, <em>leaning</em> to 15/85,{' '}
        <em>lopsided</em> to 5/95, <em>decided</em> beyond it.
      </>
    ),
  },
  {
    term: 'Field goal distance',
    body: (
      <>
        <Code>yardline_100 + 17</Code> — ten yards of end zone plus a seven-yard snap. Context only;
        the make probability beside it is the model&rsquo;s own <Code>fg_make_prob</Code>.
      </>
    ),
  },
  {
    term: 'Win percentage',
    body: (
      <>
        <Code>(wins + 0.5 × ties) / games</Code>, the way the NFL counts it. Records cover every
        game in the data, postseason included, so a deep run raises both the games played and the
        wins.
      </>
    ),
  },
  {
    term: 'Correlation (r)',
    body: (
      <>
        On the league trends page, the Pearson correlation between a metric and win percentage
        across every team-season, quoted with n beside it. It is an association and nothing more:
        32 teams making their own calls is not an experiment, and the arrow can point the other way
        — a team that spends a season behind goes for it more.
      </>
    ),
  },
  {
    term: 'Game result',
    body: (
      <>
        <Code>home_score</Code> and <Code>away_score</Code> are the game&rsquo;s final score,
        restated from the offence&rsquo;s side. Shown as W/L/T from the viewed team&rsquo;s point of
        view.
      </>
    ),
  },
]

export function Glossary() {
  return (
    <dl className="space-y-4">
      {ENTRIES.map((entry) => (
        <div key={entry.term}>
          <dt className="text-sm font-bold text-stone-900">{entry.term}</dt>
          <dd className="mt-0.5 text-sm leading-relaxed text-stone-600">{entry.body}</dd>
        </div>
      ))}
    </dl>
  )
}
