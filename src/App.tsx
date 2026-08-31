import { useMemo, useState } from 'react'
import { useLeagueIndex, useTeamData } from './hooks/useTeamData'
import { ALL, applyFilter, playKey, reconcile } from './lib/filters'
import type { PlayFilter } from './lib/filters'
import { playsInSeason } from './lib/metrics'
import type { GameSummary } from './lib/games'
import type { Play, TeamAbbr } from './types'
import { ComparisonCard } from './components/ComparisonCard'
import { PlayFilters } from './components/PlayFilters'
import { PlayList } from './components/PlayList'
import { TeamBanner } from './components/TeamBanner'
import { TeamPicker } from './components/TeamPicker'
import { TeamSummary } from './components/TeamSummary'
import { AboutDialog } from './components/AboutDialog'

/**
 * The drill-down: team, season, week, quarter, then the individual 4th down.
 *
 * The team's season summary is the landing view and the resting state; picking
 * a play swaps it for that play's comparison, and clearing the selection —
 * from the back control, or by tapping the selected row again — brings it back.
 *
 * On a wide screen the list and the panel sit side by side. On a phone the
 * summary comes first and the list follows it, and selecting a play replaces
 * both.
 */
export default function App() {
  const index = useLeagueIndex()
  const [abbr, setAbbr] = useState<TeamAbbr | null>(null)
  // What the user last asked for. The filter in force is derived from it during
  // render, because a team's real seasons and weeks are only known once that
  // team's data has arrived.
  const [intent, setIntent] = useState<PlayFilter | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const team = useTeamData(abbr)

  const meta = index.data?.teams.find((t) => t.team_abbr === abbr)
  const plays = team.data
  const filter = useMemo(() => (plays ? reconcile(plays, intent) : null), [plays, intent])

  const visible = useMemo(
    () => (plays && filter ? applyFilter(plays, filter) : []),
    [plays, filter],
  )
  const seasonCount = useMemo(
    () => (plays && filter ? playsInSeason(plays, filter.season).length : 0),
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

  /** Tapping the open row again closes it, back to the summary. */
  function togglePlay(play: Play) {
    const key = playKey(play)
    setSelectedKey((current) => (current === key ? null : key))
  }

  /** Narrow the list to one game, and return to the summary. */
  function focusGame(game: GameSummary) {
    if (!filter) return
    setIntent({ season: filter.season, week: game.week, qtr: ALL })
    setSelectedKey(null)
  }

  if (index.loading) return <Centered>Loading league…</Centered>
  if (index.error) return <Centered tone="error">{index.error.message}</Centered>
  if (!index.data) return null

  if (!abbr || !meta) {
    return (
      <main className="mx-auto max-w-6xl px-3 py-8 sm:px-6 sm:py-12">
        <TeamPicker
          teams={index.data.teams}
          fixture={index.data.fixture}
          onSelect={chooseTeam}
          onAbout={() => setAboutOpen(true)}
        />
        <AboutDialog open={aboutOpen} index={index.data} onClose={() => setAboutOpen(false)} />
      </main>
    )
  }

  return (
    // On a wide screen the shell is pinned to the viewport and the two panes
    // scroll independently, so a long play list never scrolls the summary out
    // of reach and a tall summary is still fully readable. Pinning rather than
    // sizing to the viewport keeps the document itself out of the scroll
    // entirely. On a phone it is ordinary page flow.
    <div className="lg:fixed lg:inset-0 lg:flex lg:flex-col lg:overflow-hidden">
      <TeamBanner
        team={meta}
        season={filter?.season ?? index.data.seasons[0]}
        plays={seasonCount}
        onChangeTeam={() => setAbbr(null)}
        onAbout={() => setAboutOpen(true)}
      />

      <AboutDialog open={aboutOpen} index={index.data} onClose={() => setAboutOpen(false)} />

      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6 lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:pb-0">
        {team.loading && <Centered>Loading {abbr}…</Centered>}
        {team.error && <Centered tone="error">{team.error.message}</Centered>}

        {plays && filter && (
          // grid-rows-[minmax(0,1fr)] is what makes the panes scrollable: without
          // an explicit row track the row sizes to its content, so h-full on a
          // child resolves against the content height and clips nothing.
          <div className="grid gap-5 lg:h-full lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
            <div
              className={`order-2 min-w-0 space-y-3 lg:order-1 lg:h-full lg:min-h-0 lg:overflow-x-hidden lg:overflow-y-auto lg:pb-6 ${
                selected ? 'hidden lg:block' : ''
              }`}
            >
              <PlayFilters plays={plays} team={meta} filter={filter} onChange={changeFilter} />
              {visible.length !== seasonCount && (
                <p className="px-1 text-[0.6875rem] text-stone-500">
                  Showing {visible.length} of {seasonCount} this season.
                </p>
              )}
              <PlayList
                plays={visible}
                team={meta}
                selectedKey={selectedKey}
                onSelect={togglePlay}
              />
            </div>

            <div className="order-1 min-w-0 space-y-3 lg:order-2 lg:h-full lg:min-h-0 lg:overflow-x-hidden lg:overflow-y-auto lg:pb-6">
              {selected ? (
                <>
                  <button
                    onClick={() => setSelectedKey(null)}
                    className="text-sm font-semibold text-stone-500 hover:text-stone-900"
                  >
                    ← Season summary
                  </button>
                  <ComparisonCard play={selected} team={meta} />
                </>
              ) : (
                <TeamSummary
                  team={meta}
                  plays={plays}
                  season={filter.season}
                  onSelectGame={focusGame}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
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
