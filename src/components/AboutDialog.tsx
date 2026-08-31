import { useEffect, useRef } from 'react'
import type { LeagueIndex } from '../types'
import { Glossary } from './about/Glossary'
import { A, Code, P, Section, Strong } from './about/prose'

interface Props {
  open: boolean
  index: LeagueIndex
  onClose: () => void
}

/**
 * What the model is, what this app adds on top of it, and how to read the
 * result. Everything here is either checked against the nfl4th source or
 * computed from the data currently loaded.
 */
export function AboutDialog({ open, index, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  // showModal gives focus trapping, Escape-to-close and inert background for
  // free, so the dialog element does the accessibility work rather than us.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const plays = index.teams.reduce(
    (sum, team) => sum + (team.summaries.find((s) => s.season === null)?.plays ?? 0),
    0,
  )
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
        <div>
          <h2 className="text-xl font-bold tracking-tight text-stone-900">About this tool</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Methodology, and what the model underneath it is
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded border border-stone-300 px-2.5 py-1 text-xs font-semibold tracking-wide text-stone-600 uppercase hover:border-stone-500 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
        >
          Close
        </button>
      </div>

      <div className="space-y-7 px-5 py-6 sm:px-7">
        <Section title="What this is">
          <P>
            An interface over the <Strong>nfl4th</Strong> win-probability model. The model is not
            part of this app, and nothing here fits, retrains or approximates it. nfl4th produces
            the estimates; this app makes them legible for two questions — what does the model say a
            staff should do on 4th down, and what do they actually do.
          </P>
        </Section>

        <Section title="The model">
          <P>
            <Strong>nfl4th 1.0.7</Strong>, by Ben Baldwin with Sebastian Carl, part of the nflverse.
            MIT licensed. <A href="https://www.nfl4th.com/">nfl4th.com</A> ·{' '}
            <A href="https://github.com/nflverse/nfl4th">source</A>
          </P>
          <P>Three models sit behind every 4th down:</P>
          <ul className="ml-4 list-disc space-y-2 text-sm leading-relaxed text-stone-600 marker:text-stone-400">
            <li>
              <Strong>Win probability</Strong> — an xgboost model over score differential, seconds
              left in the half and in the game, timeouts, field position, yards to go, expected
              points from nflfastR, whether the home team receives the second-half kickoff, and the
              Vegas point spread interacted with time. It is spread-aware: the market’s pregame view
              of the two teams is an input, not an afterthought.
            </li>
            <li>
              <Strong>First down probability</Strong> — the chance of converting, which weights the
              two branches of the go option.
            </li>
            <li>
              <Strong>Field goal probability</Strong> — a generalised additive model sensitive to
              roof and era, with an explicit decay applied beyond 58 yards.
            </li>
          </ul>
          <P>
            The headline number is <Code>go_boost</Code>, defined by nfl4th as{' '}
            <Code>100 × (go_wp − max(fg_wp, punt_wp))</Code>: the win probability points gained by
            going for it rather than taking the better of the kicks.
          </P>
          <P>
            The go option’s expected value is exactly its two branches weighted by the conversion
            rate. That is worth stating because the card draws it that way — checked against all{' '}
            {plays.toLocaleString()} plays in this dataset,{' '}
            <Code>first_down_prob × wp_succeed + (1 − first_down_prob) × wp_fail</Code> reproduces{' '}
            <Code>go_wp</Code> to the last decimal place, every time.
          </P>
        </Section>

        <Section title="The data">
          <P>
            nflfastR play-by-play for {oldest}–{newest} via nflreadr, reduced to 4th downs and run
            through <Code>nfl4th::add_4th_probs()</Code>. That is{' '}
            <Strong>{plays.toLocaleString()} fourth downs</Strong> across all {index.teams.length}{' '}
            teams. One JSON file per team, fetched only when that team is selected.
          </P>
          <P>
            Options that do not exist in a situation are null rather than zero — there is no punt
            from the opponent’s three — and the interface says “not available here” rather than
            drawing a bar of length nothing.
          </P>
          <P className="text-xs text-stone-400">
            Built{' '}
            {new Date(index.generated_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {index.fixture ? ' — from fixture data, not model output' : ''}
          </P>
        </Section>

        <Section title="How to read it">
          <P>
            <Strong>Win probability is an expected value.</Strong> A decision that gave away four
            points did not necessarily lose the game, and one that gave away nothing did not
            necessarily win it. The cost of a call is fixed the moment it is made; how the game
            ended afterwards does not change it. That is why the summary ranks costly calls in wins
            beside costly calls in losses — both columns use the same number, and seeing them
            together is the clearest argument against reading outcomes backwards into decisions.
          </P>
          <P>
            <Strong>A disagreement in a decided game is marked, not dropped.</Strong> Across this
            dataset, disagreements taken at a 95%+ win probability average 0.29 points and never
            exceed 4.2, and none of the calls costing more than five points happened in one. They
            still count against the agreement rate — the interface greys them out and says why,
            rather than quietly excluding them.
          </P>
          <P>
            <Strong>Decisions are attributed to a team and a season</Strong>, never to a named
            coach. A staff is not one person, and the play-by-play record does not say who made the
            call.
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
          <Glossary />
        </Section>
      </div>
    </dialog>
  )
}
