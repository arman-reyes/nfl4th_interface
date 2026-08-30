import type { Band, Choice } from '../../types'
import { CHOICE_PHRASE, CHOICE_VERB } from '../../lib/decision'
import { pointsGap } from '../../lib/format'
import { BandMeter } from './BandMeter'

interface Props {
  recommended: Choice
  band: Band
  /** Magnitude of go_boost: the gap between going and the best alternative. */
  gap: number
  /** The option the gap is measured against, or null if there was no other. */
  against: Choice | null
}

/**
 * The loudest thing on the screen. One word, then how strongly the model
 * holds it, then the exact number — in that order, because the reader should
 * have the answer before they reach any arithmetic.
 */
export function Verdict({ recommended, band, gap, against }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <p className="text-7xl leading-none font-extrabold tracking-tighter text-stone-900 sm:text-8xl">
        {CHOICE_VERB[recommended]}
      </p>
      <div className="space-y-2 pb-1">
        <BandMeter band={band} />
        <p className="tnum text-base text-stone-600">
          {against === null ? (
            <>the only option available</>
          ) : (
            <>
              {band === 'coin flip' && (
                <span className="font-medium text-stone-900">Barely. </span>
              )}
              <span className="font-semibold text-stone-900">{pointsGap(gap)}</span> points of win
              probability over <span className="font-medium">{CHOICE_PHRASE[against]}</span>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
