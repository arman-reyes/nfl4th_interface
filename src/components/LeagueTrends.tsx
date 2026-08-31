import { useMemo, useState } from 'react'
import type { LeagueIndex } from '../types'
import type { TrendMetricKey } from '../lib/trends'
import { buildSeries, metricByKey, TREND_METRICS, trendSeasons } from '../lib/trends'
import { TrendChart } from './trends/TrendChart'
import { TeamMultiSelect } from './trends/TeamMultiSelect'
import { RecordScatter } from './trends/RecordScatter'
import { AboutButton } from './AboutButton'

interface Props {
  index: LeagueIndex
  onBack: () => void
  onAbout: () => void
}

/** Default selection: enough lines to compare, few enough to read. */
const OPENING = ['BAL', 'PHI', 'PIT']

export function LeagueTrends({ index, onBack, onAbout }: Props) {
  const [metricKey, setMetricKey] = useState<TrendMetricKey>('aggressiveness')
  const [selected, setSelected] = useState<string[]>(OPENING)

  const metric = metricByKey(metricKey)
  const seasons = useMemo(() => trendSeasons(index), [index])
  const all = useMemo(() => buildSeries(index, metric), [index, metric])
  const chosen = useMemo(() => all.filter((s) => selected.includes(s.abbr)), [all, selected])

  function toggle(abbr: string) {
    setSelected((current) =>
      current.includes(abbr) ? current.filter((a) => a !== abbr) : [...current, abbr],
    )
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-3 py-5 sm:px-6 sm:py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="text-sm font-semibold text-stone-500 hover:text-stone-900"
          >
            ← Teams
          </button>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            League trends
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">
            {seasons[0]}–{seasons.at(-1)}, every team. Pick teams to draw in colour; the rest stay
            as grey context, with the league median dashed. Hover a season for the value and that
            team&rsquo;s record.
          </p>
        </div>
        <AboutButton onClick={onAbout} tone="muted" />
      </header>

      <div className="flex flex-wrap gap-1.5">
        {TREND_METRICS.map((option) => (
          <button
            key={option.key}
            onClick={() => setMetricKey(option.key)}
            aria-pressed={option.key === metricKey}
            className={`rounded border px-2.5 py-1 text-sm font-semibold ${
              option.key === metricKey
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-xs sm:p-5">
        <TrendChart seasons={seasons} all={all} selected={chosen} metric={metric} />
        <p className="mt-2 text-xs leading-relaxed text-stone-500">{metric.note}</p>
      </section>

      <TeamMultiSelect
        teams={index.teams}
        selected={selected}
        onToggle={toggle}
        onClear={() => setSelected([])}
      />

      <RecordScatter all={all} selected={chosen} metric={metric} />
    </main>
  )
}
