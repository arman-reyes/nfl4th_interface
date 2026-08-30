import { useState } from 'react'
import { useLeagueIndex, useTeamData } from './hooks/useTeamData'
import { deviationGrid, summarize } from './lib/metrics'
import { pct, points } from './lib/format'
import type { TeamAbbr } from './types'

/**
 * Step 1 scaffold: a probe that exercises the data layer end to end.
 * Replaced by the real shell once the Decision Card lands.
 */
export default function App() {
  const [selected, setSelected] = useState<TeamAbbr | null>(null)
  const index = useLeagueIndex()
  const team = useTeamData(selected)

  const season = index.data?.seasons[0] ?? null
  const summary = team.data ? summarize(team.data, season) : null
  const grid = team.data ? deviationGrid(team.data) : []

  return (
    <div className="mx-auto max-w-4xl p-8 text-sm">
      <h1 className="text-lg font-semibold tracking-tight">4th Down Review — data layer probe</h1>
      {index.data?.fixture && (
        <p className="mt-1 text-xs font-medium text-amber-700">
          Fixture data. Replace public/data/ with the R output and run npm run data:index.
        </p>
      )}

      {index.loading && <p className="mt-4 text-stone-500">Loading index…</p>}
      {index.error && <p className="mt-4 text-red-700">{index.error.message}</p>}

      <div className="mt-6 flex flex-wrap gap-1">
        {index.data?.teams.map((t) => (
          <button
            key={t.team_abbr}
            onClick={() => setSelected(t.team_abbr)}
            className="rounded border border-stone-300 px-2 py-1 font-mono text-xs hover:bg-stone-200"
            style={
              selected === t.team_abbr
                ? { background: t.team_color, color: '#fff', borderColor: t.team_color }
                : undefined
            }
          >
            {t.team_abbr}
          </button>
        ))}
      </div>

      {team.loading && <p className="mt-6 text-stone-500">Fetching {selected}…</p>}
      {team.error && <p className="mt-6 text-red-700">{team.error.message}</p>}

      {summary && team.data && (
        <div className="tnum mt-6 space-y-1 font-mono text-xs">
          <p>
            {selected} — {team.data.length} plays loaded, {summary.decisions} decisions in {season}
          </p>
          <p>aggressiveness {summary.aggressiveness === null ? '—' : pct(summary.aggressiveness, 1)}</p>
          <p>agreement {summary.agreement === null ? '—' : pct(summary.agreement, 1)}</p>
          <p>
            wp forfeited {points(summary.wp_forfeited)} pts ({points(summary.wp_forfeited_per_game, 2)}
            /game)
          </p>
          <p className="pt-2">deviation grid (all seasons):</p>
          {grid.map((c) => (
            <p key={`${c.zone}-${c.band}`}>
              {c.zone.padEnd(10)} {c.band.padEnd(10)} n={String(c.decisions).padStart(4)}{' '}
              {c.rate === null ? '—' : pct(c.rate, 1)}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
