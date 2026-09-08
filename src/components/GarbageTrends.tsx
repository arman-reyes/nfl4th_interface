import { useMemo, useState } from 'react'
import { useGarbageSeasons, useGarbageTime } from '../hooks/useTeamData'
import {
  assertStatOrder,
  leagueShares,
  NO_REMOVALS,
  PPR,
  teamBandShares,
  teamRates,
  totals,
  totalsByBand,
} from '../lib/garbageTime'
import type { Format } from '../lib/garbageTime'
import type { GarbageTeam } from '../types'
import { SectionNav } from './SectionNav'
import { AboutButton } from './AboutButton'
import { GarbageAbout } from './garbage/GarbageAbout'
import { TeamPill } from './TeamPill'
import { PointsDonut } from './garbage/PointsDonut'
import { BandStatTable } from './garbage/BandStatTable'
import { TEAM_LINES } from './garbage/statLines'
import { TeamOpportunity } from './garbage/TeamOpportunity'
import { BandControls } from './garbage/BandControls'
import type { ViewName } from '../lib/routes'

interface Props {
  onNavigate: (view: ViewName) => void
  onBack: () => void
}

/**
 * Garbage time one level up: how much of it each offense actually played, and
 * what a single offense's season looks like with it taken out.
 *
 * The player page answers "was he propped up"; this one answers the question
 * underneath it — how much of this was available to him at all. A receiver on a
 * team that spent a fifth of its season four scores down had far more of it to
 * accumulate than one who never trailed, and no amount of looking at the player
 * shows that.
 */
export function GarbageTrends({ onNavigate, onBack }: Props) {
  const seasons = useGarbageSeasons()
  const [chosen, setChosen] = useState<number | null>(null)
  const [team, setTeam] = useState<string | null>(null)
  const [format, setFormat] = useState<Format>('ppr')
  const [threshold, setThreshold] = useState(0.1)
  const [aboutOpen, setAboutOpen] = useState(false)

  const list = seasons.data
  const season = chosen ?? list?.[0] ?? null
  const file = useGarbageTime(season)
  const data = file.data

  const model = useMemo(() => {
    if (!data) return null
    assertStatOrder(data)
    const rates = teamRates(data, threshold)
    // Alphabetical: the picker is for finding a team you already have in mind,
    // and a list that reshuffles itself every time the threshold moves is no
    // use for that. The chart above is where the ranking lives.
    const sorted = [...data.teams].sort((a, b) => a.team.localeCompare(b.team))
    // The default is a different question from the order, so it gets its own
    // answer: open on the offense that played the most garbage time, which is
    // the one worth looking at first.
    const mostGarbage = [...data.teams].sort(
      (a, b) => (rates.get(b.team) ?? 0) - (rates.get(a.team) ?? 0),
    )[0]
    return {
      rates,
      sorted,
      mostGarbage,
      shares: leagueShares(data, threshold),
      byTeam: teamBandShares(data, threshold),
    }
  }, [data, threshold])

  const selected: GarbageTeam | null = useMemo(() => {
    if (!data || !model) return null
    return data.teams.find((t) => t.team === team) ?? model.mostGarbage ?? null
  }, [data, model, team])

  const detail = useMemo(() => {
    if (!data || !selected) return null
    return {
      all: totals(selected.bins),
      byBand: totalsByBand(selected.bins, data.bins, threshold),
    }
  }, [data, selected, threshold])

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-3 py-5 sm:px-6 sm:py-8">
      <header>
        <div className="flex items-start justify-between gap-4">
          <SectionNav current="garbageTrends" onNavigate={onNavigate} />
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onBack}
              className="rounded border border-stone-300 px-2.5 py-1 text-xs font-semibold tracking-wide text-stone-600 uppercase hover:border-stone-500 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
            >
              Players
            </button>
            <AboutButton onClick={() => setAboutOpen(true)} tone="muted" />
          </div>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-stone-500">
          League trends: how much garbage time each offense played, and what one team&rsquo;s
          season looks like with it removed.
        </p>
      </header>

      {(seasons.loading || file.loading) && (
        <p className="px-3 py-16 text-center text-sm text-stone-500">Loading…</p>
      )}
      {seasons.error && (
        <p className="px-3 py-16 text-center text-sm text-red-700">{seasons.error.message}</p>
      )}
      {file.error && (
        <p className="px-3 py-16 text-center text-sm text-red-700">{file.error.message}</p>
      )}

      {data && model && season !== null && (
        <>
          <BandControls
            seasons={list ?? [season]}
            season={season}
            format={format}
            threshold={threshold}
            onSeason={setChosen}
            onFormat={setFormat}
            onThreshold={setThreshold}
            shares={model.shares}
          />

          <TeamOpportunity shares={model.byTeam} season={season} />

          <section className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
            <div>
              <h2 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">
                Team garbage time stats
              </h2>
              <p className="mt-1 text-[0.6875rem] text-stone-500">
                The whole offense, not just the players the rankings carry — so the totals are the
                team&rsquo;s real ones, split by the state of the game they happened in.
              </p>
            </div>

            <div
              role="group"
              aria-label="Team"
              className="flex flex-wrap gap-1.5 border-y border-stone-100 py-3"
            >
              {model.sorted.map((entry) => {
                const active = entry.team === selected?.team
                return (
                  <button
                    key={entry.team}
                    onClick={() => setTeam(entry.team)}
                    aria-pressed={active}
                    title={`${entry.team} — ${((model.rates.get(entry.team) ?? 0) * 100).toFixed(1)}% garbage time`}
                    className={`rounded focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1 focus-visible:outline-none ${
                      active ? 'ring-2 ring-stone-900 ring-offset-1' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    <TeamPill abbr={entry.team} size="md" />
                  </button>
                )
              })}
            </div>

            {selected && detail && (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
                <div>
                  <div className="flex items-baseline gap-2">
                    <TeamPill abbr={selected.team} size="md" />
                    <span className="tnum text-[0.6875rem] text-stone-500">
                      {((model.rates.get(selected.team) ?? 0) * 100).toFixed(1)}% of its offensive
                      plays in garbage time · {selected.games} games
                    </span>
                  </div>
                  <div className="mt-3">
                    <PointsDonut
                      rows={selected.bins}
                      label={`${selected.team} offense`}
                      file={data}
                      format={format}
                      threshold={threshold}
                      remove={NO_REMOVALS}
                    />
                  </div>
                </div>
                <div>
                  <BandStatTable
                    all={detail.all}
                    byBand={detail.byBand}
                    lines={TEAM_LINES}
                    ppr={PPR[format]}
                  />
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <GarbageAbout
        open={aboutOpen}
        file={data}
        seasons={list ?? []}
        onClose={() => setAboutOpen(false)}
      />
    </main>
  )
}
