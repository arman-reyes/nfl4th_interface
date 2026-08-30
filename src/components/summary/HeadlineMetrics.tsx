import type { TeamSummary } from '../../types'
import { pct, points } from '../../lib/format'

/** The three numbers that compare one staff to another. */
export function HeadlineMetrics({ summary }: { summary: TeamSummary }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Metric
        label="Aggressiveness"
        value={summary.aggressiveness === null ? '—' : pct(summary.aggressiveness)}
        note={`went on ${summary.go_taken} of ${summary.go_recommended} the model wanted`}
      />
      <Metric
        label="Agreement"
        value={summary.agreement === null ? '—' : pct(summary.agreement)}
        note={`of ${summary.decisions} decisions`}
      />
      <Metric
        label="Given up"
        value={points(summary.wp_forfeited_per_game, 1)}
        note="win prob points per game"
      />
      <Metric
        label="Season total"
        value={points(summary.wp_forfeited, 0)}
        note={`points across ${summary.games} games`}
      />
    </dl>
  )
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <dt className="text-[0.625rem] font-bold tracking-[0.14em] text-stone-500 uppercase">
        {label}
      </dt>
      <dd className="tnum mt-1 text-2xl leading-none font-bold text-stone-900">{value}</dd>
      <dd className="mt-1.5 text-[0.6875rem] leading-tight text-stone-500">{note}</dd>
    </div>
  )
}
