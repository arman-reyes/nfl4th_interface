/**
 * The colour and arrow for a signed difference: worse in red, better in green.
 *
 * The two colours are the middle step of the garbage-time rank ramp
 * (`garbage/rankTone.ts`), which was measured to clear 4.5:1 on white and on
 * the row hover tint. There is no magnitude ramp here because a difference
 * of means has no natural steps the way a rank move does — the standard
 * error beside it says how much to make of it.
 *
 * Red and green is the pairing colour-vision deficiency attacks, so direction
 * is never carried by colour alone: every value ships with its arrow and
 * keeps its sign.
 */
const WORSE = '#c7483a'
const BETTER = '#258260'

export interface SignTone {
  arrow: '▲' | '▼' | '—'
  /** Undefined at zero: ordinary ink, nothing to say. */
  color?: string
  /** For screen readers, where the arrow says nothing. */
  label: string
}

/** `better` says which direction is good, so a fall in turnovers reads green. */
export function signTone(value: number, better: 'high' | 'low' = 'high'): SignTone {
  if (value === 0) return { arrow: '—', label: 'no change' }
  const up = value > 0
  const good = better === 'high' ? up : !up
  return {
    arrow: up ? '▲' : '▼',
    color: good ? BETTER : WORSE,
    label: `${up ? 'up' : 'down'} ${Math.abs(value)}`,
  }
}
