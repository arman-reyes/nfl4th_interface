import type { TeamIndexEntry } from '../types'
import { teamSurface } from '../lib/color'
import { AboutButton } from './AboutButton'

interface Props {
  team: TeamIndexEntry
  season: number
  plays: number
  onChangeTeam: () => void
  onAbout: () => void
  onTrends: () => void
}

/** Sticky identity: which team, which season, how many 4th downs in scope. */
export function TeamBanner({ team, season, plays, onChangeTeam, onAbout, onTrends }: Props) {
  const surface = teamSurface(team.team_abbr)
  return (
    <div className="sticky top-0 z-20 shadow-sm">
      <div
        style={{ background: surface.background, color: surface.color }}
        className="mx-auto flex max-w-full items-center gap-3 px-3 py-2.5 sm:px-6 sm:py-3"
      >
        <span className="text-xl font-extrabold tracking-tight sm:text-2xl">{team.team_abbr}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium opacity-90 sm:text-base">
          <span className="hidden sm:inline">{team.team_name} · </span>
          {season}
          <span className="opacity-70"> · {plays} fourth downs</span>
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
