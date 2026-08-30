import type { DecisionImpact } from '../lib/impact'
import { GAME_STATE_NOTE, IMPACT_FILL } from '../lib/impact'
import { points } from '../lib/format'

/**
 * How much a disagreement cost, and whether the game was still live enough for
 * it to matter. Segments are the cost tier; a decision taken in a game already
 * decided is drawn in grey, because at a 95%+ win probability it could not
 * change much and should not read like a considered call.
 */
export function ImpactMeter({ impact, showValue = true }: { impact: DecisionImpact; showValue?: boolean }) {
  const filled = IMPACT_FILL[impact.tier]
  const label = `${points(impact.cost)} points forfeited, ${impact.tier}, ${GAME_STATE_NOTE[impact.state]}`

  return (
    <span className="inline-flex flex-col items-end gap-1" title={label}>
      {showValue && (
        <span
          className={`tnum text-sm leading-none font-bold ${
            impact.inert ? 'text-stone-400' : 'text-amber-700'
          }`}
        >
          −{points(impact.cost)}
        </span>
      )}
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={`h-1.5 w-2.5 rounded-xs ${
              step > filled
                ? 'bg-stone-200'
                : impact.inert
                  ? 'bg-stone-400'
                  : 'bg-amber-600'
            }`}
          />
        ))}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
