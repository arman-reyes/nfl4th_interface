/**
 * How a rank change is drawn: red for a fall, green for a rise, gaining colour
 * as the move gets bigger.
 *
 * The ramp holds lightness still and raises **chroma**, from a dusty, barely
 * coloured step for the ordinary shuffling to a vivid one for the moves worth
 * stopping at. Lightness is held because it cannot move: this is 11px text, so
 * every step needs 4.5:1 against the row and against its hover tint, and that
 * floor sits at roughly a mid-tone. A genuinely light grey — stone-400, say — is
 * 2.5:1 and illegal here however good it would look. With lightness pinned,
 * saturation is the only axis left, and it happens to be the right one: it is
 * what the eye reads as intensity.
 *
 * **Red and green is the one pairing colour-vision deficiency attacks**, so it
 * is used only because direction is never carried by colour alone — every value
 * ships with an arrow and keeps its sign. Measured, not assumed:
 *
 * | step | fall | rise | AA | normal ΔE | CVD ΔE |
 * |---|---|---|---|---|---|
 * | 1-4 | `#a85f57` | `#417f68` | 4.53 | 16.2 | 4.7 |
 * | 5-11 | `#c7483a` | `#258260` | 4.55 | 24.9 | 8.3 |
 * | 12+ | `#df2712` | `#0b8458` | 4.53 | 31.2 | 11.0 |
 *
 * The faintest step is deliberately at the edge of the palette's rules and no
 * further. Below about 32% saturation the two tints stop being separable even
 * with full colour vision (normal ΔE falls under 15), at which point the tint is
 * decoration that has stopped doing its job — so that is where the floor is set.
 * Its colour-vision separation is low by design and nothing rests on it: a move
 * of one to four places is the noise, and its arrow already says which way.
 */

/** Reds for a fall, dusty to vivid. */
const FALLING = ['#a85f57', '#c7483a', '#df2712']

/** The mirror for a rise. */
const RISING = ['#417f68', '#258260', '#0b8458']

/**
 * Where each step begins, taken from the real distribution of rank changes
 * rather than picked: across 8,810 player-seasons at the default settings, two
 * thirds of moves are four places or fewer, and only the top 5% reach twelve.
 * So the dusty, recessive tone is the ordinary noise, and the vivid one means
 * "this is one of the biggest moves on the board".
 */
const STEPS = [5, 12]

export interface RankTone {
  /** '▼' for a fall, '▲' for a rise, '—' when the rank held. */
  arrow: string
  /** Text colour, or undefined when there is nothing to signal. */
  color?: string
  /** Screen-reader wording, since the arrow alone reads as punctuation. */
  label: string
}

export function rankTone(delta: number): RankTone {
  if (delta === 0) return { arrow: '—', label: 'no change in rank' }
  const magnitude = Math.abs(delta)
  const step = STEPS.filter((edge) => magnitude >= edge).length
  const falls = delta > 0
  return {
    arrow: falls ? '▼' : '▲',
    color: (falls ? FALLING : RISING)[step],
    label: `${falls ? 'down' : 'up'} ${magnitude} place${magnitude === 1 ? '' : 's'}`,
  }
}
