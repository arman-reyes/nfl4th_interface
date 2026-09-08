import { BANDS, bandUsage, PPR, splitByBand } from '../../lib/garbageTime'
import type { Band, Format } from '../../lib/garbageTime'
import { BAND_STYLE } from './bandStyle'
import type { GarbagePlayer, GarbageTimeFile, TeamAbbr } from '../../types'

interface Props {
  player: GarbagePlayer
  file: GarbageTimeFile
  format: Format
  threshold: number
  teamShares: Map<TeamAbbr, Record<Band, number>>
}

const ROW_LABEL: Record<Band, string> = {
  trailing: 'Trailing',
  competitive: 'Competitive',
  leading: 'Leading',
}

/**
 * What a player's season was worth in each state of the game.
 *
 * Points, in points, is the thing being argued about — the row's bar gives the
 * three shares but a share cannot say whether 33% is seventy points or seven.
 * Per game is beside it because a season total quietly rewards availability, and
 * the two bands are only comparable once that is taken out.
 *
 * Trailing and leading are kept apart rather than pooled as "garbage time"
 * because they are opposite situations happening to different players: a
 * receiver piling up targets while his team is buried, a back grinding out
 * carries while his team runs the clock down. A player's two bands routinely
 * differ by a factor of four, so the pooled number described neither.
 *
 * Beside the points share sits his **snap** share, which is the comparison that
 * settles the argument: a third of his points earned on a fifth of his snaps is
 * a player feasting on a state, and a third earned on a third is a player who
 * was simply out there. Both are shares of his own season, so they read against
 * each other directly.
 *
 * Snaps come from nflverse participation, which lists the eleven offensive
 * players on every play, so a receiver who ran a route and was never looked at
 * still counts. That only exists from 2016; before it the column falls back to
 * touches and targets and the header says so, rather than calling two different
 * measurements by the same name.
 */
export function PlayerBands({ player, file, format, threshold, teamShares }: Props) {
  const points = splitByBand(player.bins, file.bins, threshold, PPR[format])
  const usage = bandUsage(player, file, threshold, teamShares)
  const total = BANDS.reduce((sum, band) => sum + points[band], 0)
  const games = Math.max(player.games, 1)

  const basis = usage.trailing.basis
  const basisLabel = basis === 'snaps' ? 'Snaps' : 'Touches'
  const snapTotal = BANDS.reduce((sum, band) => sum + usage[band].playerShare, 0)

  return (
    <div>
      <h4 className="text-[0.625rem] font-bold tracking-[0.14em] text-stone-500 uppercase">
        Points by game state
        <span className="tnum ml-2 font-semibold tracking-normal text-stone-400 normal-case">
          {player.games} games
        </span>
      </h4>
      <table className="mt-2 w-full text-[0.6875rem]">
        <thead>
          <tr className="text-stone-400">
            <th className="pb-1 text-left font-semibold"> </th>
            <th className="pb-1 text-right font-semibold">Points</th>
            <th className="pb-1 text-right font-semibold">Per game</th>
            <th className="pb-1 text-right font-semibold">Points %</th>
            <th className="pb-1 text-right font-semibold">{basisLabel} %</th>
          </tr>
        </thead>
        <tbody className="tnum">
          {BANDS.map((band) => (
            <tr key={band} className="border-t border-stone-200">
              <td className="py-1 text-left">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-xs"
                    style={{ background: BAND_STYLE[band].color }}
                  />
                  <span className="text-stone-600">{ROW_LABEL[band]}</span>
                </span>
              </td>
              <td className="py-1 text-right font-semibold text-stone-900">
                {points[band].toFixed(1)}
              </td>
              <td className="py-1 text-right text-stone-600">
                {(points[band] / games).toFixed(1)}
              </td>
              <td className="py-1 text-right font-medium text-stone-900">
                {total > 0 ? `${Math.round((points[band] / total) * 100)}%` : '—'}
              </td>
              <td className="py-1 text-right font-medium text-stone-900">
                {Math.round(usage[band].playerShare * 100)}%
              </td>
            </tr>
          ))}
          <tr className="border-t border-stone-300 font-semibold">
            <td className="py-1 text-left text-stone-900">Total</td>
            <td className="py-1 text-right text-stone-900">{total.toFixed(1)}</td>
            <td className="py-1 text-right text-stone-600">{(total / games).toFixed(1)}</td>
            <td className="py-1 text-right text-stone-900">{total > 0 ? '100%' : '—'}</td>
            <td className="py-1 text-right text-stone-900">{snapTotal > 0 ? '100%' : '—'}</td>
          </tr>
        </tbody>
      </table>

    </div>
  )
}
