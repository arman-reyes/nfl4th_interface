import { useMemo, useState } from 'react'
import type { LeagueIndex } from '../types'
import { leagueSeasons, movement, seasonSpreads } from '../lib/league'
import type { LeagueMetric, Movement } from '../lib/league'
import { LeagueTrendPanel } from './trends/LeagueTrendPanel'
import { TeamMultiSelect } from './trends/TeamMultiSelect'
import { AboutButton } from './AboutButton'

interface Props {
  index: LeagueIndex
  /** The four panels, in reading order. */
  metrics: LeagueMetric[]
  /**
   * The paragraph above the panels, written from how far each metric's median
   * moved — one entry per metric, in the same order, null if it could not be
   * measured. Each page says what its own movement means.
   */
  intro: (movements: (Movement | null)[], seasons: number) => React.ReactNode
  /** Where the back link goes: "Teams". */
  backLabel: string
  onBack: () => void
  onAbout: () => void
}

/**
 * Where the league went, and how far apart its teams were while going there.
 *
 * The league is always drawn; teams are opt-in. A single team line means
 * nothing on its own — 38% aggressive is only high or low against what
 * everyone else was doing that year — so the band and the median stay behind
 * whatever is selected.
 */
export function LeagueTrends({ index, metrics, intro, backLabel, onBack, onAbout }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  // Shared so that hovering one panel moves the guide on all four.
  const [hover, setHover] = useState<number | null>(null)

  const seasons = useMemo(() => leagueSeasons(index), [index])
  const movements = useMemo(
    () => metrics.map((metric) => movement(seasonSpreads(index, metric))),
    [index, metrics],
  )

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
            ← {backLabel}
          </button>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            League trends
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">
            {seasons[0]}–{seasons.at(-1)}. Hover any season to read it off all four panels.
          </p>
        </div>
        <AboutButton onClick={onAbout} tone="muted" />
      </header>

      <Legend />

      <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm leading-relaxed text-stone-600 shadow-xs sm:p-5">
        {intro(movements, seasons.length)}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {metrics.map((metric) => (
          <LeagueTrendPanel
            key={metric.key}
            index={index}
            metric={metric}
            selected={selected}
            hover={hover}
            onHover={setHover}
          />
        ))}
      </div>

      <TeamMultiSelect
        teams={index.teams}
        selected={selected}
        onToggle={toggle}
        onClear={() => setSelected([])}
      />
    </main>
  )
}

/** What the two marks on every panel mean. */
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-stone-200 bg-white px-4 py-3 text-xs text-stone-600 shadow-xs">
      <span className="flex items-center gap-2">
        <svg width="26" height="10" aria-hidden className="shrink-0">
          <line
            x1="0"
            y1="5"
            x2="26"
            y2="5"
            stroke="#44403c"
            strokeWidth="1.75"
            strokeDasharray="5 3"
          />
        </svg>
        <span>
          <strong className="font-semibold text-stone-900">Median team</strong> that season
        </span>
      </span>
      <span className="flex items-center gap-2">
        <svg width="26" height="10" aria-hidden className="shrink-0">
          <line x1="0" y1="5" x2="26" y2="5" stroke="#0076B6" strokeWidth="2" />
        </svg>
        <span>
          <strong className="font-semibold text-stone-900">A selected team</strong>, in its own
          colour
        </span>
      </span>
      <span className="flex items-center gap-2">
        <svg width="26" height="12" aria-hidden className="shrink-0">
          <rect x="0" y="1" width="26" height="10" fill="#e7e5e4" />
        </svg>
        <span>
          <strong className="font-semibold text-stone-900">Middle half of the league</strong> — the
          25th to 75th percentile team. A wider band means the 32 were further apart.
        </span>
      </span>
    </div>
  )
}
