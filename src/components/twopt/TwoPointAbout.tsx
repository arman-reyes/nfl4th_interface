import { useEffect, useRef } from 'react'
import type { LeagueIndex } from '../../types'
import { A, Code, P, Section, Strong } from '../about/prose'

interface Props {
  open: boolean
  index: LeagueIndex
  onClose: () => void
}

/**
 * What the model prices on a try, where the data came from, and how to read
 * a page where most of the calls are coin flips.
 *
 * A separate dialog from the 4th-down one. The model is the same family and
 * the arithmetic is the same shape, but the decision is a different one with
 * its own floor, its own caveats and its own distribution, and a reader
 * asking about tries should not have to find that inside a page about punts.
 */
export function TwoPointAbout({ open, index, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  // showModal gives focus trapping, Escape-to-close and inert background for
  // free, so the dialog element does the accessibility work rather than us.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const all = index.teams.map((team) => team.summaries.find((s) => s.season === null))
  const tries = all.reduce((sum, s) => sum + (s?.plays ?? 0), 0)
  const decisions = all.reduce((sum, s) => sum + (s?.decisions ?? 0), 0)
  const saidTwo = all.reduce((sum, s) => sum + (s?.go_recommended ?? 0), 0)
  const wentTwo = all.reduce((sum, s) => sum + (s?.go_taken ?? 0), 0)
  const oldest = index.seasons.at(-1)
  const newest = index.seasons[0]

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className="m-auto max-h-[85dvh] w-[min(46rem,92vw)] rounded-lg bg-white p-0 text-stone-800 shadow-2xl backdrop:bg-stone-900/50"
    >
      <div className="sticky top-0 flex items-baseline justify-between gap-4 border-b border-stone-200 bg-white px-5 py-4 sm:px-7">
        <h2 className="text-xl font-bold tracking-tight text-stone-900">About</h2>
        <button
          onClick={onClose}
          className="shrink-0 rounded border border-stone-300 px-2.5 py-1 text-xs font-semibold tracking-wide text-stone-600 uppercase hover:border-stone-500 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
        >
          Close
        </button>
      </div>

      <div className="space-y-7 px-5 py-6 sm:px-7">
        <Section title="What is this?">
          <P>
            The decision after every touchdown — kick the extra point, or go for two — reviewed
            the same way this site reviews 4th downs. The <Strong>nfl4th</Strong> model prices both
            options in win probability; this page shows what each staff did against that, one try
            at a time and across a season.
          </P>
        </Section>

        <Section title="The model">
          <P>
            <Strong>nfl4th 1.0.7</Strong>, by Ben Baldwin with Sebastian Carl, part of the nflverse.
            MIT licensed. <A href="https://www.nfl4th.com/">nfl4th.com</A> ·{' '}
            <A href="https://github.com/nflverse/nfl4th">source</A>. The function is{' '}
            <Code>add_2pt_probs()</Code>, and three models sit behind it:
          </P>
          <ul className="ml-4 list-disc space-y-2 text-sm leading-relaxed text-stone-600 marker:text-stone-400">
            <li>
              <Strong>Extra point probability</Strong> — the same field-goal model the 4th-down
              page uses, evaluated at the 15. Roof and era move it; it sits around 94% in a dome
              and a little lower outdoors.
            </li>
            <li>
              <Strong>Two-point probability</Strong> — an xgboost model over era, roof, the Vegas
              spread and total. It is a property of the game, not of the play call: the model does
              not see who is on the field or what was run.
            </li>
            <li>
              <Strong>Win probability</Strong> — the same spread-aware model as the 4th-down page,
              evaluated three times: with the try scoring nothing, one, or two, and the opponent
              taking the kickoff first-and-ten at its own 25.
            </li>
          </ul>
          <P>
            Each option is then its two branches weighted by the conversion rate —{' '}
            <Code>wp_go1 = conv_1pt × wp_1 + (1 − conv_1pt) × wp_0</Code> for the kick and the same
            with two for the try — and the headline number is <Code>100 × (wp_go2 − wp_go1)</Code>:
            the win probability points gained by going for two rather than kicking. The card draws
            both options as their branches because that is exactly how they are priced.
          </P>
          <P>
            <Strong>The spot is not an input.</Strong> nfl4th prices every kick from the 15 and
            every two-point try from the 2. A penalty that moves a try — a kick from the 20, a two
            from the 1 — is shown on the card, but the model priced the standard try.
          </P>
        </Section>

        <Section title="The data">
          <P>
            nflfastR play-by-play for {oldest}–{newest} via nflreadr, reduced to every play that
            recorded an extra point or a two-point result, and run through{' '}
            <Code>add_2pt_probs()</Code>. That is <Strong>{tries.toLocaleString()} tries</Strong>{' '}
            across all {index.teams.length} teams. A try wiped out by a penalty records no result
            and is replayed, so the attempt that stood is the one in the data.
          </P>
          <P>
            <Strong>2015 is the floor, and it is a modelling floor.</Strong> That is the season the
            extra point moved back to the 15. Before it the kick was a 99.5% snap from the 2, the
            model would be pricing a decision no staff faced, and the 4th-down page&rsquo;s 2014
            has no counterpart here.
          </P>
          <P>
            nfl4th prices nothing in the last fifteen seconds of a game or in overtime — a try
            with the clock gone cannot change who wins — so those few tries a season are left out
            rather than shown at a made-up value.
          </P>
          <P className="text-xs text-stone-400">
            Built{' '}
            {new Date(index.generated_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {index.in_progress
              ? ` — ${index.in_progress.season} season in progress, through week ${index.in_progress.through_week}`
              : ''}
            {index.fixture ? ' — from fixture data, not model output' : ''}
          </P>
        </Section>

        <Section title="How to read it">
          <P>
            <Strong>Most tries are coin flips.</Strong> An extra point is worth about 0.94 points
            and a two-point try about 1.0, so with a game still open the two options usually sit
            within a fraction of a win-probability point of each other, and the strength band
            says so. The calls worth stopping at are the leans and the clear ones, which come late
            in games where a particular margin matters — down two with four minutes left, up
            fourteen with a quarter to play.
          </P>
          <P>
            <Strong>Aggressiveness reads low for everyone, and that is the finding.</Strong> Across
            this data the model preferred going for two on{' '}
            <span className="tnum">
              {decisions > 0 ? Math.round((saidTwo / decisions) * 100) : 0}%
            </span>{' '}
            of tries — most of them by a hair — and staffs went for two on{' '}
            <span className="tnum">{saidTwo > 0 ? Math.round((wentTwo / saidTwo) * 100) : 0}%</span>{' '}
            of those. The kick is the default, and a coin flip does not move a staff off a
            default. Read the number beside the strength band, and beside the cost: a staff that
            kicks every coin flip gives up almost nothing, and the page will say so.
          </P>
          <P>
            <Strong>Win probability is an expected value.</Strong> A two that failed and cost the
            game was still the right call if it was the right call at the snap, and a kick that
            went in did not become right because it went in. The cost of a call is fixed the
            moment it is made; how the try went, and how the game ended, do not change it. That is
            why the reveal on the quiz never shows the result.
          </P>
          <P>
            <Strong>A disagreement in a decided game is marked, not dropped.</Strong> At a 95%+
            win probability a try changes almost nothing, and the interface greys those out and
            says why rather than quietly excluding them.
          </P>
        </Section>

        <Section title="What is deliberately absent">
          <P>
            nfl4th produces point estimates. There are no confidence intervals or error bars
            anywhere in this interface, because any drawn here would be invented. Uncertainty is
            expressed only through the strength band — how large the edge is — and never as a
            fabricated range around a number.
          </P>
        </Section>

        <Section title="Every number, defined">
          <dl className="space-y-4">
            {GLOSSARY.map((entry) => (
              <div key={entry.term}>
                <dt className="text-sm font-bold text-stone-900">{entry.term}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-stone-600">{entry.body}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </dialog>
  )
}

const GLOSSARY: { term: string; body: React.ReactNode }[] = [
  {
    term: 'Actual choice',
    body: (
      <>
        <Code>play_type</Code> of <Code>extra_point</Code> means they kicked; <Code>run</Code> or{' '}
        <Code>pass</Code> means they went for two. Every try is one or the other.
      </>
    ),
  },
  {
    term: 'Model recommendation',
    body: (
      <>
        Go for two when <Code>100 × (wp_go2 − wp_go1)</Code> is positive, otherwise kick. Taken
        from the sign of the headline number rather than a raw comparison of the two, so the
        verdict can never contradict it when rounding puts them a hair apart.
      </>
    ),
  },
  {
    term: 'Strength band',
    body: (
      <>
        The magnitude of that number, on the same scale as a 4th down: under 1 point is a{' '}
        <em>coin flip</em>, 1–3 a <em>lean</em>, above 3 a <em>clear</em> call.
      </>
    ),
  },
  {
    term: 'Aggressiveness',
    body: (
      <>
        Of the tries where the model preferred going for two, the share the staff actually went
        for two on. The most comparable single number across staffs, because it holds the
        situation fixed.
      </>
    ),
  },
  {
    term: 'Agreement',
    body: <>The share of all tries where the actual choice matched the model.</>,
  },
  {
    term: 'Win probability forfeited',
    body: (
      <>
        Per try, the model&rsquo;s option minus the chosen option, in percentage points. Agreeing
        always costs exactly zero.
      </>
    ),
  },
  {
    term: 'Impact tier',
    body: (
      <>
        The forfeited points banded on the same 1-and-3 scale: <em>minor</em>, <em>notable</em>,{' '}
        <em>costly</em>.
      </>
    ),
  },
  {
    term: 'Game state',
    body: (
      <>
        How live the game was, from the win probability carried by the model&rsquo;s own
        recommendation: <em>in doubt</em> inside 35–65%, <em>leaning</em> to 15/85,{' '}
        <em>lopsided</em> to 5/95, <em>decided</em> beyond it.
      </>
    ),
  },
  {
    term: 'Score after the TD',
    body: (
      <>
        <Code>score_differential</Code> on the try row, which nflfastR states after the touchdown
        and before the try. &ldquo;Up 6&rdquo; means the kick makes it seven and the two makes it
        eight — the card and the list both say which.
      </>
    ),
  },
  {
    term: 'Game result',
    body: (
      <>
        <Code>home_score</Code> and <Code>away_score</Code> are the game&rsquo;s final score,
        restated from the offense&rsquo;s side. Shown as W/L/T from the viewed team&rsquo;s point of
        view.
      </>
    ),
  },
]
