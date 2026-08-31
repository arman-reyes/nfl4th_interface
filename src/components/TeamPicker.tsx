import type { TeamIndexEntry, TeamAbbr } from '../types'
import { teamSurface } from '../lib/color'
import { AboutButton } from './AboutButton'

interface Props {
  teams: TeamIndexEntry[]
  /** True when the loaded data is generated fixtures rather than model output. */
  fixture: boolean
  onSelect: (abbr: TeamAbbr) => void
  onAbout: () => void
}

const CONFERENCES = ['AFC', 'NFC'] as const

/** Step one of the drill-down: whose 4th downs are we looking at. */
export function TeamPicker({ teams, fixture, onSelect, onAbout }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            4th Down Stats
          </h1>
          <AboutButton onClick={onAbout} tone="muted" />
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Pick a team to review every 4th down they faced, and what the models from{' '}
          <a
            href="https://nfl4th.com"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-stone-700 underline decoration-stone-400 underline-offset-2 transition-colors hover:text-stone-900"
          >
            nfl4th
          </a>{' '}
          would have done.
        </p>
        {fixture && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 ring-1 ring-amber-200 ring-inset">
            Fixture data — generated stand-ins, not nfl4th output. Run the R pipeline and{' '}
            <code>npm run data:index</code> to replace it.
          </p>
        )}
      </div>

      {CONFERENCES.map((conf) => (
        <section key={conf}>
          <h2 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">{conf}</h2>
          <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {teams
              .filter((t) => t.team_conf === conf)
              .map((team) => {
                const surface = teamSurface(team.team_abbr)
                return (
                  <li key={team.team_abbr}>
                    <button
                      onClick={() => onSelect(team.team_abbr)}
                      style={{
                        background: surface.background,
                        color: surface.color,
                        boxShadow: `inset 0 -5px 0 ${surface.accent}`,
                      }}
                      title={team.team_name}
                      className="flex h-16 w-full flex-col items-center justify-center rounded-md text-base font-bold tracking-wide transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 focus-visible:outline-none sm:h-20 sm:text-lg"
                    >
                      {team.team_abbr}
                      <span className="mt-0.5 max-w-full truncate px-1 text-[0.625rem] font-medium opacity-95">
                        {team.team_name.split(' ').at(-1)}
                      </span>
                    </button>
                  </li>
                )
              })}
          </ul>
        </section>
      ))}
    </div>
  )
}
