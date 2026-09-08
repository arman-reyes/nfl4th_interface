import type { TeamIndexEntry, TeamAbbr } from '../types'
import type { ViewName } from '../lib/routes'
import { teamSurface } from '../lib/color'
import { AboutButton } from './AboutButton'
import { SectionNav } from './SectionNav'

interface Props {
  teams: TeamIndexEntry[]
  /** True when the loaded data is generated fixtures rather than model output. */
  fixture: boolean
  onSelect: (abbr: TeamAbbr) => void
  onAbout: () => void
  onTrends: () => void
  onQuiz: () => void
  /** Switches statistical display, from the heading dropdown. */
  onNavigate: (view: ViewName) => void
}

const CONFERENCES = ['AFC', 'NFC'] as const
/** The order the NFL prints them in, not alphabetical. */
const DIVISIONS = ['East', 'North', 'South', 'West'] as const

/** Step one of the drill-down: whose 4th downs are we looking at. */
export function TeamPicker({
  teams,
  fixture,
  onSelect,
  onAbout,
  onTrends,
  onQuiz,
  onNavigate,
}: Props) {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-start justify-between gap-4">
          <SectionNav current="teams" onNavigate={onNavigate} />
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onTrends}
              className="rounded border border-stone-300 px-2.5 py-1 text-xs font-semibold tracking-wide text-stone-600 uppercase hover:border-stone-500 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
            >
              League trends
            </button>
            <AboutButton onClick={onAbout} tone="muted" />
          </div>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Pick a team to review every 4th down they faced, and what the models from{' '}
          <a
            href="https://www.nfl4th.com/"
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
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            {DIVISIONS.map((division) => (
              <div key={division}>
                <h3 className="text-[0.625rem] font-bold tracking-[0.14em] text-stone-400 uppercase">
                  {division}
                </h3>
                <ul className="mt-1.5 space-y-1.5">
                  {teams
                    .filter((t) => t.team_division === `${conf} ${division}`)
                    .map((team) => (
                      <li key={team.team_abbr}>
                        <TeamTile team={team} onSelect={onSelect} />
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}

      <button
        onClick={onQuiz}
        className="group w-full rounded-lg bg-stone-900 px-5 py-6 text-left transition-colors hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 focus-visible:outline-none sm:px-7 sm:py-7"
      >
        <span className="block text-xl font-extrabold tracking-tight text-white sm:text-2xl">
          Think you can make the right call on 4th down?
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-sm text-stone-300">
          Ten real situations, twenty seconds each — then see how you score against the model.
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </span>
      </button>
    </div>
  )
}

/**
 * One team, laid out like a standings row rather than a square: the division
 * columns are wider than they are tall, so the abbreviation and the nickname
 * sit on one line.
 */
function TeamTile({
  team,
  onSelect,
}: {
  team: TeamIndexEntry
  onSelect: (abbr: TeamAbbr) => void
}) {
  const surface = teamSurface(team.team_abbr)
  return (
    <button
      onClick={() => onSelect(team.team_abbr)}
      style={{
        background: surface.background,
        color: surface.color,
        boxShadow: `inset 5px 0 0 ${surface.accent}`,
      }}
      title={team.team_name}
      className="flex w-full items-baseline gap-2 rounded-md py-2 pr-2.5 pl-3.5 text-left transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <span className="text-sm font-bold tracking-wide sm:text-base">{team.team_abbr}</span>
      <span className="min-w-0 truncate text-[0.6875rem] font-medium opacity-90">
        {team.team_name.split(' ').at(-1)}
      </span>
    </button>
  )
}
