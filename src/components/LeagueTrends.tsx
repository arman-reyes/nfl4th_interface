import { useMemo } from 'react'
import type { LeagueIndex } from '../types'
import { LEAGUE_METRICS, movement, seasonSpreads } from '../lib/league'
import { LeagueTrendPanel } from './trends/LeagueTrendPanel'
import { AgainstRecord } from './trends/AgainstRecord'
import { AboutButton } from './AboutButton'

interface Props {
  index: LeagueIndex
  onBack: () => void
  onAbout: () => void
}

/**
 * The league, not the teams.
 *
 * Individual team lines were dropped from this view: thirty-two of them is
 * spaghetti, and one of them out of context says nothing. What is worth seeing
 * here is where the league went, and how far apart its teams are while going
 * there.
 */
export function LeagueTrends({ index, onBack, onAbout }: Props) {
  const seasons = useMemo(() => [...index.seasons].sort((a, b) => a - b), [index])

  // The headline is the contrast between the first two panels: what the model
  // asked for barely moved, while what teams did about it roughly doubled.
  const aggressiveness = useMemo(() => movement(seasonSpreads(index, LEAGUE_METRICS[0])), [index])
  const saidGo = useMemo(() => movement(seasonSpreads(index, LEAGUE_METRICS[1])), [index])

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
            {seasons[0]}–{seasons.at(-1)}. Each line is the median team; the band behind it is the
            middle half of the league, which says whether the 32 moved together or came apart.
          </p>
        </div>
        <AboutButton onClick={onAbout} tone="muted" />
      </header>

      {aggressiveness && saidGo && (
        <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm leading-relaxed text-stone-600 shadow-xs sm:p-5">
          Across these twelve seasons the median team went from going for it on{' '}
          <strong className="tnum font-semibold text-stone-900">
            {(aggressiveness.first.p50 * 100).toFixed(0)}%
          </strong>{' '}
          of the 4th downs where the model said go, to{' '}
          <strong className="tnum font-semibold text-stone-900">
            {(aggressiveness.last.p50 * 100).toFixed(0)}%
          </strong>
          . Over the same stretch, how often the model said go barely moved —{' '}
          <span className="tnum">{(saidGo.first.p50 * 100).toFixed(0)}%</span> to{' '}
          <span className="tnum">{(saidGo.last.p50 * 100).toFixed(0)}%</span>. The opportunity was
          always there; what changed is what teams did with it.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {LEAGUE_METRICS.map((metric) => (
          <LeagueTrendPanel key={metric.key} index={index} metric={metric} />
        ))}
      </div>

      <AgainstRecord index={index} />
    </main>
  )
}
