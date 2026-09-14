import { LENS, mean, se, signedText, standouts, STANDOUT_MIN_GAMES, STANDOUT_Z } from '../../lib/travel'
import type { Lens, Standout, TravelAggregate } from '../../lib/travel'
import { signTone } from './signTone'

interface Props {
  agg: TravelAggregate
  /** Which lens the trip table is showing, so a standout can point at it. */
  onLens: (lens: Lens) => void
}

/** What each standout is evidence of, in a line. Keyed on lens and label. */
const READING: Record<string, string> = {
  'tz:2 zones east':
    'Pacific teams in the Central zone and Mountain teams in the Eastern: the trip everyone treats as routine. Three zones east is priced; two is not.',
  'phase:Away, weeks 14+, underdog':
    'A road underdog in the last month is worse than the number says — the team with nothing left to play for, away from home.',
  'era:1999–2010, 1,500+ mi':
    'Distance used to be underpriced. It is not any more: the same trips since 2020 beat the line.',
  'distance:1,500–2,000 mi':
    'The one distance bin the line misses, and mostly the two-zone trips inside it.',
}

function Value({ value, digits = 1 }: { value: number | null; digits?: number }) {
  if (value === null) return <span className="text-stone-400">—</span>
  const tone = signTone(Math.round(value * 10 ** digits))
  return (
    <span className="font-semibold" style={tone.color ? { color: tone.color } : undefined}>
      {signedText(value, digits)}
    </span>
  )
}

function Row({ item, onLens }: { item: Standout; onLens: (lens: Lens) => void }) {
  const lens = LENS[item.lens]
  const m = mean(item.vsLine)
  const err = se(item.vsLine)
  const c = mean(item.cover)
  const reading = READING[`${item.lens}:${item.label}`]
  return (
    <li className="border-b border-stone-100 px-3 py-3 last:border-b-0 sm:px-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <button
          onClick={() => onLens(item.lens)}
          className="text-left text-sm font-semibold text-stone-900 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
          title={`Show the ${lens.label.toLowerCase()} lens`}
        >
          {item.label}
        </button>
        <span className="text-[0.625rem] font-bold tracking-[0.14em] text-stone-400 uppercase">
          {lens.label}
        </span>
        <span className="tnum ml-auto text-[0.6875rem] text-stone-400">
          {item.vsLine.n.toLocaleString('en-US')} team-games
        </span>
      </div>
      <dl className="tnum mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[0.8125rem] sm:grid-cols-4">
        <div>
          <dt className="text-[0.625rem] font-bold tracking-[0.14em] text-stone-500 uppercase">
            vs line
          </dt>
          <dd className="text-stone-700">
            <Value value={m} />
            {err !== null && <span className="text-stone-400"> ±{err.toFixed(1)}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-[0.625rem] font-bold tracking-[0.14em] text-stone-500 uppercase">
            Within team
          </dt>
          <dd className="text-stone-700" title="The same teams' trips of this kind against their other trips, so team quality is out of the answer.">
            {item.within ? (
              <>
                <Value value={item.within.value} />
                <span className="text-stone-400">
                  {' '}
                  ±{item.within.se.toFixed(1)} · {item.within.teams} teams
                </span>
              </>
            ) : (
              <span className="text-stone-400">too few per team</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[0.625rem] font-bold tracking-[0.14em] text-stone-500 uppercase">
            Raw margin
          </dt>
          <dd className="text-stone-700">{mean(item.margin) === null ? '—' : signedText(mean(item.margin)!, 1)}</dd>
        </div>
        <div>
          <dt className="text-[0.625rem] font-bold tracking-[0.14em] text-stone-500 uppercase">
            Cover rate
          </dt>
          <dd className="text-stone-700">{c === null ? '—' : `${(c * 100).toFixed(1)}%`}</dd>
        </div>
      </dl>
      {reading && <p className="mt-1.5 text-[0.75rem] leading-snug text-stone-500">{reading}</p>}
    </li>
  )
}

/**
 * The bins the line did not price, surfaced rather than left for the reader
 * to find in the tables.
 *
 * The test is against the line, not the raw margin, because the raw margin
 * of any trip is mostly home-field advantage and the teams who make it. Each
 * standout carries a within-team figure — the same teams' trips of this kind
 * against their other trips — which is the number that says it is the trip
 * and not the travellers.
 *
 * Computed live from whatever is loaded. A single season almost never
 * produces one, and the empty state says why rather than pretending.
 */
export function Standouts({ agg, onLens }: Props) {
  const items = standouts(agg)
  return (
    <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
      <div className="border-b border-stone-200 bg-stone-50 px-3 py-2 sm:px-4">
        <h2 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">
          What stands out
        </h2>
        <p className="mt-0.5 text-[0.625rem] text-stone-400">
          Every kind of trip whose margin against the closing line is {STANDOUT_Z}+ standard errors
          from zero, over at least {STANDOUT_MIN_GAMES} team-games. The line already prices the
          teams and the home field; what is left is the trip.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-stone-500">
          Nothing is more than {STANDOUT_Z} standard errors from the line at this sample size (
          {agg.games.toLocaleString('en-US')} team-games). A single season&rsquo;s far bins are
          a dozen games each; the all-seasons view has the counts to resolve an effect under a
          field goal.
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <Row key={`${item.lens}:${item.bin}`} item={item} onLens={onLens} />
          ))}
        </ul>
      )}
    </section>
  )
}
