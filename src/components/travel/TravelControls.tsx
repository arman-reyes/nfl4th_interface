import { DISTANCE_EDGES, LENSES } from '../../lib/travel'
import type { Lens } from '../../lib/travel'
import { Segmented } from '../garbage/Segmented'

/** The all-seasons view: the page's resting state. */
export const ALL_SEASONS = 'all'
export type SeasonChoice = number | typeof ALL_SEASONS

interface Props {
  seasons: number[]
  season: SeasonChoice
  lens: Lens
  /** Miles at which a trip counts as far. Always one of the bin edges. */
  threshold: number
  /** Share of trips the threshold calls far, for the readout. */
  farShare: number
  onSeason: (next: SeasonChoice) => void
  onLens: (next: Lens) => void
  onThreshold: (next: number) => void
}

/** The thresholds the slider can land on: every bin edge after the first. */
const THRESHOLDS = DISTANCE_EDGES.slice(1)

const miles = (n: number) => `${n.toLocaleString('en-US')} mi`

/**
 * Everything the reader can change about the question.
 *
 * The lens decides what the trip table is bucketed by. The far threshold is
 * a second control rather than a bin of its own because the headline tiles,
 * the team table and the player table all need one cut — "far" — and a reader
 * should be able to move it and watch all three follow.
 */
export function TravelControls({
  seasons,
  season,
  lens,
  threshold,
  farShare,
  onSeason,
  onLens,
  onThreshold,
}: Props) {
  const step = THRESHOLDS.indexOf(threshold)

  return (
    <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Segmented
          label="Lens"
          value={lens}
          options={LENSES.map((l) => ({ value: l.key, label: l.label }))}
          onChange={onLens}
        />
        <label className="flex items-center gap-2 text-xs font-semibold tracking-wide text-stone-600 uppercase">
          Season
          <select
            value={season}
            onChange={(event) => {
              const v = event.target.value
              onSeason(v === ALL_SEASONS ? ALL_SEASONS : Number(v))
            }}
            className="tnum rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm font-semibold text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
          >
            <option value={ALL_SEASONS}>
              All seasons{seasons.length > 0 ? ` (${seasons.at(-1)}–${seasons[0]})` : ''}
            </option>
            {seasons.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="border-t border-stone-200 pt-4">
        <label htmlFor="travel-far" className="block text-sm font-semibold text-stone-900">
          A trip is far from <span className="tnum">{miles(threshold)}</span>
        </label>
        <input
          id="travel-far"
          type="range"
          min={0}
          max={THRESHOLDS.length - 1}
          // Snapped to the bin edges the data is bucketed at: a cut inside a
          // bin cannot be answered by summing bins.
          step={1}
          value={step}
          onChange={(event) => onThreshold(THRESHOLDS[Number(event.target.value)])}
          className="mt-2 w-full accent-stone-900"
        />
        <p className="tnum mt-1 text-[0.6875rem] leading-tight text-stone-500">
          {(farShare * 100).toFixed(1)}% of trips are that far or further. The threshold sets the
          &ldquo;far&rdquo; column everywhere on the page; the lens only changes the trip table.
        </p>
      </div>
    </div>
  )
}
