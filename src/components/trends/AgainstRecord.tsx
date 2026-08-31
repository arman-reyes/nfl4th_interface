import { useMemo, useState } from 'react'
import type { LeagueIndex } from '../../types'
import { LEAGUE_METRICS } from '../../lib/league'
import type { LeagueMetric } from '../../lib/league'
import { effectSize, metricAgainstRecord, pearson } from '../../lib/trends'
import { RecordScatter } from './RecordScatter'

interface Props {
  index: LeagueIndex
}

/** Metrics worth setting against a record. "How often the model said go" is a
 *  property of the situations a team faced, so it is left out. */
const CHOICES = LEAGUE_METRICS.filter((m) => m.key !== 'saidGo')

/**
 * Whether any of this shows up in the standings.
 *
 * The honest answer is that a 17-game record cannot resolve it — which is a
 * statement about the instrument, not about the decisions. So the panel leads
 * with the size of the thing in wins, which needs no correlation to be true,
 * and only then shows the correlation with the arithmetic that explains it.
 */
export function AgainstRecord({ index }: Props) {
  const [metric, setMetric] = useState<LeagueMetric>(
    CHOICES.find((m) => m.key === 'forfeitedPerGame') ?? CHOICES[0],
  )

  const effect = useMemo(() => effectSize(index), [index])
  const pairs = useMemo(() => metricAgainstRecord(index, metric), [index, metric])
  const r = useMemo(() => pearson(pairs), [pairs])
  // Decision quality alone cannot move r past the ceiling. A correlation bigger
  // than that is measuring something else, which is the interesting case.
  const exceedsCeiling = Math.abs(r ?? 0) > effect.ceiling

  return (
    <section className="space-y-4 rounded-lg border border-stone-200 bg-white p-3 shadow-xs sm:p-5">
      <h3 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">
        Does it show up in the standings?
      </h3>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          value={effect.meanWins.toFixed(2)}
          unit="wins"
          label="Given up per team-season, on average"
        />
        <Stat value={effect.maxWins.toFixed(2)} unit="wins" label="Worst team-season in the data" />
        <Stat
          value={r === null ? '—' : r.toFixed(2)}
          unit="r"
          label={`Against record, n = ${effect.n} team-seasons`}
          muted
        />
      </dl>

      <div className="space-y-2 text-sm leading-relaxed text-stone-600">
        <p>
          Team-seasons differ by{' '}
          <strong className="font-semibold text-stone-900">{effect.sdWins.toFixed(2)} wins</strong>{' '}
          in what their 4th-down calls give up, while actual win totals differ by{' '}
          <strong className="font-semibold text-stone-900">
            {effect.sdActualWins.toFixed(1)} wins
          </strong>
          . So even if 4th downs were the only thing separating two teams, the correlation could not
          get past{' '}
          <span className="tnum font-semibold text-stone-900">±{effect.ceiling.toFixed(2)}</span> —
          against a standard error of{' '}
          <span className="tnum font-semibold text-stone-900">
            {effect.standardError.toFixed(2)}
          </span>{' '}
          at this sample size.
        </p>
        <p>
          {exceedsCeiling ? (
            <>
              Which makes the{' '}
              <span className="tnum font-semibold text-stone-900">{(r ?? 0).toFixed(2)}</span> below
              the interesting part: it is bigger than decision quality could produce, so it is
              mostly measuring the other direction. Teams that spend a season behind go for it more,
              and teams that spend a season behind lose. The chart is picking up the scoreboard, not
              the coaching.
            </>
          ) : (
            <>
              The measured{' '}
              <span className="tnum font-semibold text-stone-900">{(r ?? 0).toFixed(2)}</span> sits
              inside that noise floor. A flat cloud here is the predicted result, not evidence
              against the model.
            </>
          )}
        </p>
        <p>
          That is not the same as nothing.{' '}
          <strong className="font-semibold text-stone-900">
            {effect.meanWins.toFixed(2)} wins a season
          </strong>{' '}
          is the size of the thing, stated directly. Win probability points are expected wins by
          definition — a hundred points is one win — so the cost does not need a correlation to be
          real. What a 17-game record cannot do is resolve it against roster quality, injuries,
          turnovers and schedule.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CHOICES.map((choice) => (
          <button
            key={choice.key}
            onClick={() => setMetric(choice)}
            aria-pressed={choice.key === metric.key}
            className={`rounded border px-2 py-1 text-xs font-semibold ${
              choice.key === metric.key
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>

      <RecordScatter pairs={pairs} metric={metric} />
    </section>
  )
}

function Stat({
  value,
  unit,
  label,
  muted,
}: {
  value: string
  unit: string
  label: string
  muted?: boolean
}) {
  return (
    <div className="rounded-md border border-stone-200 p-3">
      <dt className="sr-only">{label}</dt>
      <dd
        className={`tnum text-2xl leading-none font-bold ${muted ? 'text-stone-500' : 'text-stone-900'}`}
      >
        {value}
        <span className="ml-1 text-xs font-medium text-stone-400">{unit}</span>
      </dd>
      <dd className="mt-1.5 text-[0.6875rem] leading-tight text-stone-500">{label}</dd>
    </div>
  )
}
