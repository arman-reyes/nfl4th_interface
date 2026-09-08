import type { ReactNode } from 'react'
import { BAND_LABEL, BANDS, FORMAT_LABEL } from '../../lib/garbageTime'
import type { Band, Format, Removals } from '../../lib/garbageTime'
import { Segmented } from './Segmented'

interface Props {
  seasons: number[]
  season: number
  format: Format
  threshold: number
  /**
   * Omit both of these on a view that only describes the bands rather than
   * subtracting them — the trends page has no Remaining column for the
   * checkboxes to change, so offering them there would be a control with no
   * effect on anything the reader can see.
   */
  remove?: Removals
  onRemove?: (band: Band, on: boolean) => void
  /** Share of the league's offensive plays in each garbage band, at this threshold. */
  shares: { trailing: number; leading: number }
  onSeason: (season: number) => void
  onFormat: (format: Format) => void
  onThreshold: (threshold: number) => void
  /** Extra controls for the row, e.g. the position tabs on the player page. */
  children?: ReactNode
}

/** What each band costs a reader who removes it, in their own words. */
const BAND_NOTE: Record<Band, string> = {
  trailing: 'Two scores behind with the game gone.',
  competitive: 'Everything scored while the game was still in doubt.',
  leading: 'Two scores up with the game decided.',
}

/**
 * The removal checkboxes, as their own component with required props.
 *
 * Split out rather than guarded inline because this project does not run
 * TypeScript in strict mode: an inline `{remove && ...}` around JSX that indexes
 * `remove` compiles clean even though the compiler cannot see the guard holds.
 * Requiring the props here means the safety is in the type, not in a reader's
 * memory.
 */
function RemovalGroup({
  remove,
  onRemove,
}: {
  remove: Removals
  onRemove: (band: Band, on: boolean) => void
}) {
  const nothingLeft = BANDS.every((band) => remove[band])
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-stone-900">Remove points from total</legend>
      <p className="mt-0.5 text-[0.6875rem] leading-tight text-stone-500">
        Changes the Remaining column only. The garbage share and the team rates follow the
        threshold, not these.
      </p>
      <div className="mt-2 space-y-1.5">
        {BANDS.map((band) => (
          <label key={band} className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={remove[band]}
              onChange={(event) => onRemove(band, event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-stone-900"
            />
            <span className="min-w-0 text-[0.8125rem] leading-tight text-stone-700">
              {BAND_LABEL[band]}
              <span className="mt-0.5 block text-[0.625rem] leading-tight text-stone-400">
                {BAND_NOTE[band]}
              </span>
            </span>
          </label>
        ))}
      </div>
      {nothingLeft && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-[0.6875rem] leading-tight text-amber-900 ring-1 ring-amber-200 ring-inset">
          Everything is removed, so every Remaining total is zero and the ranking below carries no
          information. Uncheck one.
        </p>
      )}
    </fieldset>
  )
}

/**
 * Everything the reader can change about the question.
 *
 * Where both are present, the threshold and the removals sit side by side
 * because they do different jobs and the difference is easy to miss: the slider
 * decides what counts as garbage time everywhere on the page, while the
 * checkboxes only decide what comes out of the Remaining column.
 */
export function BandControls({
  seasons,
  season,
  format,
  threshold,
  remove,
  shares,
  onSeason,
  onFormat,
  onThreshold,
  onRemove,
  children,
}: Props) {
  const removals = remove !== undefined && onRemove !== undefined

  return (
    <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {children}
        <Segmented
          label="Scoring format"
          value={format}
          options={(['standard', 'half', 'ppr'] as Format[]).map((f) => ({
            value: f,
            label: FORMAT_LABEL[f],
          }))}
          onChange={onFormat}
        />
        {seasons.length > 1 && (
          <label className="flex items-center gap-2 text-xs font-semibold tracking-wide text-stone-600 uppercase">
            Season
            <select
              value={season}
              onChange={(event) => onSeason(Number(event.target.value))}
              className="tnum rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm font-semibold text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
            >
              {seasons.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div
        className={`grid gap-5 border-t border-stone-200 pt-4 sm:gap-8 ${
          removals ? 'sm:grid-cols-2' : ''
        }`}
      >
        <div>
          <label htmlFor="gt-threshold" className="block text-sm font-semibold text-stone-900">
            Garbage time is win probability under{' '}
            <span className="tnum">{Math.round(threshold * 100)}%</span>
          </label>
          <input
            id="gt-threshold"
            type="range"
            min={0.025}
            max={0.3}
            // Snapped to the bin edges the data ships in: a cut inside a bin
            // cannot be answered by summing bins, and splitting one would mean
            // inventing plays that are not in the file.
            step={0.025}
            value={threshold}
            onChange={(event) => onThreshold(Number(event.target.value))}
            className="mt-2 w-full accent-stone-900"
          />
          <p className="tnum mt-1 text-[0.6875rem] leading-tight text-stone-500">
            {(shares.trailing * 100).toFixed(1)}% of {season} offensive plays came while trailing by
            two scores, {(shares.leading * 100).toFixed(1)}% while leading by two.
          </p>
        </div>

        {remove !== undefined && onRemove !== undefined && (
          <RemovalGroup remove={remove} onRemove={onRemove} />
        )}
      </div>
    </div>
  )
}
