import type { TeamSummary } from '../../types'
import { pct, points } from '../../lib/format'
import { StatTile } from './StatTile'

/** The three numbers that compare one staff to another. */
export function HeadlineMetrics({ summary }: { summary: TeamSummary }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label="Aggressiveness"
        value={summary.aggressiveness === null ? '—' : pct(summary.aggressiveness)}
        note={`went on ${summary.go_taken} of ${summary.go_recommended} the model wanted`}
      />
      <StatTile
        label="Agreement"
        value={summary.agreement === null ? '—' : pct(summary.agreement)}
        note={`of ${summary.decisions} decisions`}
      />
      <StatTile
        label="Given up"
        value={points(summary.wp_forfeited_per_game, 1)}
        note="win prob points per game"
      />
      <StatTile
        label="Season total"
        value={points(summary.wp_forfeited, 0)}
        note={`points across ${summary.games} games`}
      />
    </dl>
  )
}
