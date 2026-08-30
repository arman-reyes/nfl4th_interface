import { useMemo, useState } from 'react'
import { useLeagueIndex, useTeamData } from './hooks/useTeamData'
import { ALL, applyFilter, playKey, reconcile } from './lib/filters'
import type { PlayFilter } from './lib/filters'
import type { Play, TeamAbbr } from './types'
import { ComparisonCard } from './components/ComparisonCard'
import { PlayFilters } from './components/PlayFilters'
import { PlayList } from './components/PlayList'
import { TeamBanner } from './components/TeamBanner'
import { TeamPicker } from './components/TeamPicker'

/**
 * The drill-down: team, season, week, quarter, then the individual 4th down.
 *
 * On a wide screen the list and the comparison sit side by side. On a phone
 * they are two steps: the list, and then the comparison with a way back.
 */
export default function App() {
  const index = useLeagueIndex()
  const [abbr, setAbbr] = useState<TeamAbbr | null>(null)
  // What the user last asked for. The filter actually in force is derived from
  // it during render, because a team's real seasons and weeks are only known
  // once that team's data has arrived — and switching teams must not strand
  // the user on a week the new team did not play.
  const [intent, setIntent] = useState<PlayFilter | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const team = useTeamData(abbr)

  const meta = index.data?.teams.find((t) => t.team_abbr === abbr)
  const plays = team.data
  const filter = useMemo(() => (plays ? reconcile(plays, intent) : null), [plays, intent])

  const visible = useMemo(
    () => (plays && filter ? applyFilter(plays, filter) : []),
    [plays, filter],
  )
  const selected = visible.find((p) => playKey(p) === selectedKey) ?? null

  function chooseTeam(next: TeamAbbr) {
    setAbbr(next)
    setSelectedKey(null)
  }

  function changeFilter(next: PlayFilter) {
    setIntent(next)
    setSelectedKey(null)
  }

  if (index.loading) return <Centered>Loading league…</Centered>
  if (index.error) return <Centered tone="error">{index.error.message}</Centered>
  if (!index.data) return null

  if (!abbr || !meta) {
    return (
      <main className="mx-auto max-w-6xl px-3 py-8 sm:px-6 sm:py-12">
        <TeamPicker teams={index.data.teams} fixture={index.data.fixture} onSelect={chooseTeam} />
      </main>
    )
  }

  return (
    <>
      <TeamBanner
        team={meta}
        season={filter?.season ?? index.data.seasons[0]}
        plays={visible.length}
        onChangeTeam={() => setAbbr(null)}
      />

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
        {team.loading && <Centered>Loading {abbr}…</Centered>}
        {team.error && <Centered tone="error">{team.error.message}</Centered>}

        {plays && filter && (
          <div className="space-y-4">
            <div className={selected ? 'hidden lg:block' : ''}>
              <PlayFilters plays={plays} team={meta} filter={filter} onChange={changeFilter} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
              <div className={selected ? 'hidden lg:block' : ''}>
                <PlayList
                  plays={visible}
                  team={meta}
                  selectedKey={selectedKey}
                  onSelect={(play: Play) => setSelectedKey(playKey(play))}
                />
              </div>

              <div className="lg:sticky lg:top-20">
                {selected ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedKey(null)}
                      className="text-sm font-semibold text-stone-500 hover:text-stone-900 lg:hidden"
                    >
                      ← All 4th downs
                    </button>
                    <ComparisonCard play={selected} team={meta} />
                  </div>
                ) : (
                  <Empty count={visible.length} filtered={filter.week !== ALL || filter.qtr !== ALL} />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}

function Centered({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
  return (
    <p
      className={`px-3 py-16 text-center text-sm ${
        tone === 'error' ? 'text-red-700' : 'text-stone-500'
      }`}
    >
      {children}
    </p>
  )
}

function Empty({ count, filtered }: { count: number; filtered: boolean }) {
  return (
    <div className="hidden rounded-lg border border-dashed border-stone-300 p-10 text-center lg:block">
      <p className="text-sm text-stone-500">
        {count} 4th {count === 1 ? 'down' : 'downs'}
        {filtered ? ' in this filter' : ' this season'}. Pick one to see what the model would have
        done.
      </p>
    </div>
  )
}
