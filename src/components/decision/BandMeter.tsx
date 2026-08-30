import type { Band } from '../../types'

const FILLED: Record<Band, number> = { 'coin flip': 1, lean: 2, clear: 3 }

/**
 * How strong the call is, as three segments rather than a number, so the
 * reader takes in the conviction before the arithmetic.
 */
export function BandMeter({ band }: { band: Band }) {
  const filled = FILLED[band]
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={`h-2.5 w-7 rounded-xs ${step <= filled ? 'bg-stone-900' : 'bg-stone-200'}`}
          />
        ))}
      </div>
      <span className="text-sm font-semibold tracking-[0.18em] text-stone-900 uppercase">
        {band}
      </span>
    </div>
  )
}
