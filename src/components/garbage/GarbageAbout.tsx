import { useEffect, useRef } from 'react'
import { A, Code, P, Section, Strong } from '../about/prose'
import type { GarbageTimeFile } from '../../types'

interface Props {
  open: boolean
  /** The season currently loaded, so the dialog can quote its own numbers. */
  file: GarbageTimeFile | null
  seasons: number[]
  onClose: () => void
}

/**
 * The method behind the garbage-time page.
 *
 * A separate dialog from the 4th-down one on purpose: they share no data, no
 * model and no argument, and pointing the reader at a page about fourth-down
 * decisions from here would answer a question nobody asked.
 */
export function GarbageAbout({ open, file, seasons, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  // showModal gives focus trapping, Escape-to-close and inert background for
  // free, so the dialog element does the accessibility work rather than us.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const newest = seasons[0]
  const oldest = seasons.at(-1)

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
        <h2 className="text-xl font-bold tracking-tight text-stone-900">
          About garbage time
        </h2>
        <button
          onClick={onClose}
          className="shrink-0 rounded border border-stone-300 px-2.5 py-1 text-xs font-semibold tracking-wide text-stone-600 uppercase hover:border-stone-500 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
        >
          Close
        </button>
      </div>

      <div className="space-y-7 px-5 py-6 sm:px-7">
        <Section title="What counts as garbage time">
          <P>
            A play is garbage time when the offense&rsquo;s win probability{' '}
            <Strong>before the snap</Strong> was under the threshold <em>and</em> it was at least
            two scores behind — or the mirror of that, at least two scores ahead. Both conditions
            have to hold.
          </P>
          <P>
            The second one is what keeps a two-minute drill out. Trailing by eight with a minute
            left is a low win probability and the most contested football there is; only 3% of
            sub-10% plays are one-score games, and their median is 1.3 minutes left at exactly
            eight points down. Requiring two scores removes them at a cost of 0.4% of all snaps.
          </P>
          <P>
            Win probability is read <Strong>before the play</Strong>, so a sixty-yard touchdown
            cannot argue itself out of the situation it was thrown in. It is nflfastR&rsquo;s{' '}
            <Code>wp</Code> and not <Code>vegas_wp</Code>: the second folds in the closing betting
            line, which would make a bad team&rsquo;s garbage time start earlier than its own play
            warranted.
          </P>
        </Section>

        <Section title="The two bands are not symmetric">
          <P>
            Plays with the offense hopeless are about <Strong>three-quarters passes</Strong>. Plays
            with it comfortably ahead are mostly runs — around 40% passes against a league average
            near 55%.
          </P>
          <P>
            So removing only the trailing band takes points away from quarterbacks and receivers
            while leaving a running back&rsquo;s clock-killing carries alone. Left unsaid, the page
            would &ldquo;discover&rdquo; that receivers pad their numbers and running backs do not,
            which would be an artefact of the choice rather than a finding. That is why the leading
            band is measured, shown, and one checkbox away from coming out too.
          </P>
        </Section>

        <Section title="How to read it">
          <P>
            <Strong>Ranks move for two reasons.</Strong> Removing points removes them from
            everyone, so a player who never padded can still fall if the players around him did —
            and can climb for the same reason, without having done anything himself. A rank change
            is a statement about a group, not a discovery about one man.
          </P>
          <P>
            <Strong>Win probability is a model,</Strong> and its tails are where models are least
            sure of themselves. That is why the threshold is a control rather than a constant: a
            name that moves at every setting is telling you something, and one that only moves at
            30% is not.
          </P>
          <P>
            <Strong>Garbage-time points are real points.</Strong> They were really scored and they
            really won fantasy matches. The page says where a season came from; it does not say the
            season did not happen. A large garbage share is also partly the team&rsquo;s — an
            offense that spent a fifth of its season four scores down had far more of it available
            — which is what the per-team rates and the usage comparison are for.
          </P>
        </Section>

        <Section title="The data">
          <P>
            nflfastR play-by-play for the regular seasons of {oldest}–{newest}, loaded with
            nflreadr. Every fantasy counting stat is rebuilt from the plays themselves and bucketed
            by the win probability the offense faced, 25 buckets per season, so the threshold can
            move in the browser without refetching anything.
          </P>
          <P>
            Scoring reproduces nflverse&rsquo;s own <Code>fantasy_points_ppr</Code> exactly, which
            is how the Actual column can be checked against any public leaderboard. Every season is
            verified against <Code>load_player_stats()</Code> before it ships and a season that
            cannot rebuild those totals is left out rather than published — which is why{' '}
            {seasons.length} seasons are here and 1999&ndash;2001 and 2011 are not.
          </P>
          <P>
            <Strong>Snaps</Strong> come from nflverse participation, which lists the eleven
            offensive players on each play, so a receiver who ran a route and was never looked at
            still counts as having been there. It exists from 2016 only; before that the panel
            falls back to touches and targets and says so. It is close to but not perfectly clean —
            the passer is listed on 99.8% of pass plays, and on about 0.1% of player-bands a player
            is charged with more touches than snaps, almost always a quarterback on a team that
            changed starters.
          </P>
          {file && (
            <P className="text-xs text-stone-400">
              {file.season} data built{' '}
              {new Date(file.generated_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              {file.complete ? '' : ` — season in progress, through week ${file.through_week}`}
            </P>
          )}
        </Section>

        <Section title="Sources and citations">
          <P>
            The play-by-play, the win-probability model and the fantasy-point definitions are all
            nflverse&rsquo;s. This page contributes only the bucketing and the arithmetic on top.
          </P>
          <ul className="space-y-3 text-sm leading-relaxed text-stone-600">
            <li>
              Carl S, Baldwin B (2026).{' '}
              <em>nflfastR: Functions to Efficiently Access NFL Play by Play Data.</em> R package
              version 5.2.0.{' '}
              <A href="https://doi.org/10.32614/CRAN.package.nflfastR">
                doi:10.32614/CRAN.package.nflfastR
              </A>
              <span className="mt-0.5 block text-xs text-stone-400">
                Source of the play-by-play and of the <Code>wp</Code> win-probability model this
                page thresholds on.
              </span>
            </li>
            <li>
              Ho T, Carl S (2026). <em>nflreadr: Download &lsquo;nflverse&rsquo; Data.</em> R
              package version 1.5.1.{' '}
              <A href="https://doi.org/10.32614/CRAN.package.nflreadr">
                doi:10.32614/CRAN.package.nflreadr
              </A>
              <span className="mt-0.5 block text-xs text-stone-400">
                Used to load the play-by-play, the season rosters, and the official player stats
                every season is reconciled against.
              </span>
            </li>
            <li>
              <A href="https://github.com/nflverse/nflverse-data">nflverse-data</A> — the release
              assets both packages read.
              <span className="mt-0.5 block text-xs text-stone-400">
                Play-by-play, weekly player stats and rosters, by season.
              </span>
            </li>
          </ul>
          <P className="text-xs text-stone-400">
            Package documentation: <A href="https://www.nflfastr.com/">nflfastR</A> ·{' '}
            <A href="https://nflreadr.nflverse.com">nflreadr</A> ·{' '}
            <A href="https://github.com/nflverse">nflverse on GitHub</A>. Not affiliated with or
            endorsed by the NFL or nflverse.
          </P>
        </Section>
      </div>
    </dialog>
  )
}
