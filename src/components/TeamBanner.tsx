import type { TeamIndexEntry } from '../types'
import { teamSurface } from '../lib/color'
import { weekLongLabel } from '../lib/filters'
import { AboutButton } from './AboutButton'

interface Props {
  team: TeamIndexEntry
  season: number
  seasons: number[]
  plays: number
  /** What `plays` counts, plural: "fourth downs", "tries". */
  noun?: string
  /** The latest week in the data when the shown season is still being played. */
  throughWeek?: number | null
  onChangeSeason: (season: number) => void
  onChangeTeam: () => void
  onAbout: () => void
  onTrends: () => void
}

/**
 * Sticky identity: which team, which season, how many 4th downs in scope.
 *
 * The season lives here rather than above the play list because changing it
 * changes the summary, and the summary is what the reader is looking at. A
 * control further down the page means scrolling away from the thing it
 * alters and then scrolling back to see what it did.
 */
export function TeamBanner({
  team,
  season,
  seasons,
  plays,
  noun = 'fourth downs',
  throughWeek = null,
  onChangeSeason,
  onChangeTeam,
  onAbout,
  onTrends,
}: Props) {
  const surface = teamSurface(team.team_abbr)
  return (
    <div className="sticky top-0 z-20 shadow-sm">
      <div
        style={{ background: surface.background, color: surface.color }}
        className="mx-auto flex max-w-full items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3"
      >
        <span className="text-xl font-extrabold tracking-tight sm:text-2xl">{team.team_abbr}</span>
        <span className="hidden min-w-0 shrink truncate text-sm font-medium opacity-90 sm:inline sm:text-base">
          {team.team_name}
        </span>
        <div className="relative shrink-0">
          <select
            aria-label="Season"
            value={season}
            onChange={(event) => onChangeSeason(Number(event.target.value))}
            style={{ borderColor: surface.color, color: surface.color }}
            className="tnum appearance-none rounded border bg-transparent py-1 pr-7 pl-2 text-sm font-semibold opacity-90 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none sm:text-base"
          >
            {seasons.map((year) => (
              <option key={year} value={year} className="bg-white text-stone-900">
                {year}
              </option>
            ))}
          </select>
          {/* The native arrow inherits the platform's colour, not the team's,
              so it is suppressed and redrawn in the banner's own ink. */}
          <svg
            aria-hidden
            viewBox="0 0 10 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute top-1/2 right-2 h-1.5 w-2.5 -translate-y-1/2 opacity-80"
          >
            <path d="M1 1 5 5 9 1" />
          </svg>
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-medium opacity-70 sm:text-base">
          {plays} {noun}
          {throughWeek !== null && (
            <span className="opacity-80"> · in progress, through {weekLongLabel(season, throughWeek)}</span>
          )}
        </span>
        <button
          onClick={onTrends}
          style={{ borderColor: surface.color }}
          className="hidden shrink-0 rounded border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase opacity-90 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none sm:block"
        >
          Trends
        </button>
        <button
          onClick={onChangeTeam}
          style={{ borderColor: surface.color }}
          className="shrink-0 rounded border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase opacity-90 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none"
        >
          Change
        </button>
        <AboutButton onClick={onAbout} />
      </div>
      {/* The secondary colour, so teams with a near-black primary still read
          as themselves rather than as generic chrome. */}
      <div aria-hidden className="h-1" style={{ background: surface.accent }} />
    </div>
  )
}
