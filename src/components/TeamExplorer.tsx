import type { LeagueIndex, Situation, TeamIndexEntry } from '../types'
import type { Drilldown } from '../hooks/useDrilldown'
import { playKey } from '../lib/filters'
import type { DecisionRules } from '../lib/rules'
import { PlayFilters } from './PlayFilters'
import { PlayList } from './PlayList'
import { TeamBanner } from './TeamBanner'
import { TeamSummary } from './TeamSummary'

interface Props<P extends Situation, C extends string> {
  index: LeagueIndex
  team: TeamIndexEntry
  rules: DecisionRules<P, C>
  drill: Drilldown<P>
  /** What a play is called on this page, singular and plural: "4th down". */
  noun: [string, string]
  /** The count in the banner: "fourth downs", "tries". */
  bannerNoun: string
  /** What taking the aggressive option is called: "went", "went for two". */
  verb: string
  /** One row of the list; the list owns grouping and selection. */
  row: (play: P, selected: boolean, onSelect: () => void) => React.ReactNode
  /** The open play, reviewed. */
  card: (play: P) => React.ReactNode
  onAbout: () => void
  onTrends: () => void
}

/**
 * A team's season: the banner, the filters and the list on the left, and the
 * summary or the open play on the right.
 *
 * The team's season summary is the landing view and the resting state; picking
 * a play swaps it for that play's comparison, and clearing the selection —
 * from the back control, or by tapping the selected row again — brings it back.
 *
 * On a wide screen the list and the panel sit side by side. On a phone the
 * summary comes first and the list follows it, and selecting a play replaces
 * both.
 *
 * Nothing here knows whether it is showing 4th downs or tries. The rules say
 * how to score them, the row and the card say how to draw them, and the
 * drill-down state comes in from App so it survives a trip to the trends view.
 */
export function TeamExplorer<P extends Situation, C extends string>({
  index,
  team,
  rules,
  drill,
  noun,
  bannerNoun,
  verb,
  row,
  card,
  onAbout,
  onTrends,
}: Props<P, C>) {
  const { plays, filter, visible, seasonCount, selected } = drill

  return (
    // On a wide screen the shell is pinned to the viewport and the two panes
    // scroll independently, so a long play list never scrolls the summary out
    // of reach and a tall summary is still fully readable. Pinning rather than
    // sizing to the viewport keeps the document itself out of the scroll
    // entirely. On a phone it is ordinary page flow.
    <div className="lg:fixed lg:inset-0 lg:flex lg:flex-col lg:overflow-hidden">
      <TeamBanner
        team={team}
        season={filter?.season ?? index.seasons[0]}
        seasons={drill.seasons}
        plays={seasonCount}
        noun={bannerNoun}
        throughWeek={
          index.in_progress && index.in_progress.season === filter?.season
            ? index.in_progress.through_week
            : null
        }
        onChangeSeason={drill.changeSeason}
        onChangeTeam={drill.clearTeam}
        onAbout={onAbout}
        onTrends={onTrends}
      />

      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6 lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:pb-0">
        {drill.loading && <Centered>Loading {drill.abbr}…</Centered>}
        {drill.error && <Centered tone="error">{drill.error.message}</Centered>}

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
              <PlayFilters plays={plays} team={team} filter={filter} onChange={drill.changeFilter} />
              {visible.length !== seasonCount && (
                <p className="px-1 text-[0.6875rem] text-stone-500">
                  Showing {visible.length} of {seasonCount} this season.
                </p>
              )}
              <PlayList
                plays={visible}
                selectedKey={selected ? playKey(selected) : null}
                onSelect={drill.togglePlay}
                noun={noun}
                row={row}
              />
            </div>

            <div className="order-1 min-w-0 space-y-3 lg:order-2 lg:h-full lg:min-h-0 lg:overflow-x-hidden lg:overflow-y-auto lg:pb-6">
              {selected ? (
                <>
                  <button
                    onClick={drill.clearSelection}
                    className="text-sm font-semibold text-stone-500 hover:text-stone-900"
                  >
                    ← Season summary
                  </button>
                  {card(selected)}
                </>
              ) : (
                <TeamSummary
                  team={team}
                  rules={rules}
                  plays={plays}
                  season={filter.season}
                  noun={noun[1]}
                  verb={verb}
                  onSelectGame={drill.focusGame}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export function Centered({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
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
