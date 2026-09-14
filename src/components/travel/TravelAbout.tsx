import { useEffect, useRef } from 'react'
import { A, Code, P, Section, Strong } from '../about/prose'
import { DISTANCE_LABELS } from '../../lib/travel'
import type { TravelAggregate } from '../../lib/travel'

interface Props {
  open: boolean
  /** What is loaded, so the dialog can quote its own counts. */
  agg: TravelAggregate | null
  seasons: number[]
  onClose: () => void
}

/**
 * The method behind the travel page.
 *
 * Its own dialog, like the garbage-time one: this page shares no data and no
 * model with the other two, and the question a reader brings here — is the
 * away number real — needs the confound spelled out before the tables mean
 * anything.
 */
export function TravelAbout({ open, agg, seasons, onClose }: Props) {
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
  const games = agg ? Math.round(agg.games / 2).toLocaleString('en-US') : 'every'

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
        <h2 className="text-xl font-bold tracking-tight text-stone-900">About travel impact</h2>
        <button
          onClick={onClose}
          className="shrink-0 rounded border border-stone-300 px-2.5 py-1 text-xs font-semibold tracking-wide text-stone-600 uppercase hover:border-stone-500 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
        >
          Close
        </button>
      </div>

      <div className="space-y-7 px-5 py-6 sm:px-7">
        <Section title="What is being measured">
          <P>
            Every regular-season game from {oldest} to {newest} — {games} of them — seen from each
            team&rsquo;s side: where it was played, how far that was from home, how many time zones
            away, what time it kicked off on the team&rsquo;s own clock, how many days of rest it
            had, and what happened. Both sides of every game are in the data, so the league-wide
            margin sums to zero by construction and every away deficit is some home team&rsquo;s
            edge.
          </P>
          <P>
            <Strong>Home</Strong> is the stadium a team played most of its home games in that
            season, so a relocation or a temporary home is a fact of the year rather than a
            special case. <Strong>Distance</Strong> is the great-circle distance from there to the
            venue. <Strong>Time zones</Strong> is the difference in UTC offset on the day, so
            daylight saving and Arizona are handled by the calendar rather than by hand.{' '}
            <Strong>Body clock</Strong> is the scheduled kickoff converted to the team&rsquo;s home
            time: a 1pm Eastern kickoff is 10am to a team from the Pacific.
          </P>
          <P>
            A neutral-site game — London, Germany, Mexico City, São Paulo — counts as a trip for{' '}
            <em>both</em> teams, each at its own distance. That is why the longest distance bin can
            show a margin of exactly zero: when both teams are in it, one&rsquo;s win is the
            other&rsquo;s loss.
          </P>
        </Section>

        <Section title="Why a raw away number cannot answer the question">
          <P>
            Teams do not travel at random. The four in the Pacific time zone cross more zones and
            fly further than anyone else in every season, so a table of results by distance is
            partly a table of how those four teams did. And a good team wins on the road too: the
            gap between a team&rsquo;s home and away margin is its home edge, but the level of
            both is the team.
          </P>
          <P>
            The <Strong>vs Line</Strong> column is the control. The closing spread already prices
            in both teams and the home field — it is the market&rsquo;s expectation of the margin —
            so the margin against it asks the sharper question: did teams that travelled far do{' '}
            <em>worse than expected</em>? If the market already knows that long trips cost
            something, the raw margin will show it and the vs-line margin will not. The gap
            between the two columns is itself a finding.
          </P>
          <P>
            The team table shows the raw split because a team&rsquo;s home and road records are
            what a reader will check it against, and its far column is against the line for the
            same reason as above.
          </P>
        </Section>

        <Section title="What stands out, and the within-team check">
          <P>
            The first panel lists every kind of trip whose margin against the line is at least two
            standard errors from zero over at least thirty team-games, across every lens at once.
            It is computed from whatever is loaded, so a single season usually shows nothing, and
            says so.
          </P>
          <P>
            Each entry carries a <Strong>within-team</Strong> figure: the same teams&rsquo; trips
            of that kind against their own other trips, averaged across the teams with at least ten
            of them. A bin can look bad because the teams that fill it are bad — the two-zones-east
            bin is seven Western teams — and this is the comparison that takes the team out of the
            answer. Where the two numbers agree, it is the trip.
          </P>
          <P>
            Over 1999–2025 four things stand out. Trips of exactly <Strong>two time zones east</Strong>{' '}
            lose to the line by two and a half points, in every era and within every one of the seven
            teams that make them, while three zones east — the trip everyone prepares for — is priced.{' '}
            <Strong>Road underdogs in the last month</Strong> are a point worse than the number.{' '}
            <Strong>Distance itself</Strong> was underpriced before 2011 and is not any more: the same
            far trips since 2020 beat the line. And the one distance bin the line misses,
            1,500–2,000 miles, is mostly the two-zone trips inside it.
          </P>
        </Section>

        <Section title="Reading the errors">
          <P>
            Every mean carries <Strong>± one standard error</Strong>, from the spread of the games
            in it. This is the one place on the site that draws error bars, and it is allowed
            because they are not invented: the 4th-down page shows a model&rsquo;s point estimates
            and has nothing honest to put around them, while these are averages over games that
            happened, and the games in a bin disagree with each other by an amount that can be
            measured.
          </P>
          <P>
            The rule of thumb is that a difference smaller than twice its error is not a
            difference. A single NFL game has a standard deviation of about fourteen points of
            margin, so a bin of a hundred games has an error near 1.4 points, and a
            single-season bin of a dozen far trips cannot resolve anything smaller than a
            touchdown. The all-seasons view exists because the aggregate is the only place the
            far bins get large enough to say something.
          </P>
          <P>
            A player&rsquo;s own split is a handful of games either way and carries no error on
            purpose — the line above the player table gives the position&rsquo;s split with its
            error, which is the number to read first.
          </P>
        </Section>

        <Section title="The bins">
          <P>
            Distance bins are {DISTANCE_LABELS.slice(1).join(', ').toLowerCase()}, with the far
            threshold snapping to their edges so that no bin is ever split. A short week is five
            days of rest or fewer; extra rest is nine or more, which is a bye or the week after a
            Thursday game. Season phase splits the last month by the line, because that is where
            the road underdog shows. The era lens uses a fixed 1,500-mile cut — its bins are
            summed at build time, so the slider cannot reach it — and the label says so. The
            offensive columns — EPA per play, yards, turnovers, penalties — come from
            nflverse&rsquo;s per-game team stats and are missing for a few games before 2003, which
            drop out of those columns only.
          </P>
          <P>
            Kickoff times are missing for 1999, so that season has no body-clock rows and the
            all-seasons body-clock lens is over {seasons.length - 1} seasons. The home-edge chart
            is one standard error either side of each season&rsquo;s home margin; a season is about
            270 games, so the band is wide and no single year should be read on its own. Player rows are the
            top 150 at each position by total points, kept only where they have at least eight
            games with one at home and one away.
          </P>
        </Section>

        <Section title="Sources and citations">
          <P>
            The schedule, the closing lines, the results and every stat are nflverse&rsquo;s. This
            page contributes the venue coordinates, the bucketing and the arithmetic on top.
          </P>
          <ul className="space-y-3 text-sm leading-relaxed text-stone-600">
            <li>
              Ho T, Carl S (2026). <em>nflreadr: Download &lsquo;nflverse&rsquo; Data.</em> R
              package version 1.5.1.{' '}
              <A href="https://doi.org/10.32614/CRAN.package.nflreadr">
                doi:10.32614/CRAN.package.nflreadr
              </A>
              <span className="mt-0.5 block text-xs text-stone-400">
                <Code>load_schedules()</Code> for the venues, rest days, lines and results;{' '}
                <Code>load_team_stats()</Code> and <Code>load_player_stats()</Code> for what
                happened on the field.
              </span>
            </li>
            <li>
              <A href="https://github.com/nflverse/nflverse-data">nflverse-data</A> — the release
              assets the package reads.
              <span className="mt-0.5 block text-xs text-stone-400">
                Schedules and weekly team and player stats, by season.
              </span>
            </li>
            <li>
              Stadium coordinates and time zones are curated in this repository (
              <Code>scripts/venues.csv</Code>), one row per nflverse <Code>stadium_id</Code>.
            </li>
          </ul>
          <P className="text-xs text-stone-400">
            Package documentation: <A href="https://nflreadr.nflverse.com">nflreadr</A> ·{' '}
            <A href="https://github.com/nflverse">nflverse on GitHub</A>. Not affiliated with or
            endorsed by the NFL or nflverse.
          </P>
        </Section>
      </div>
    </dialog>
  )
}
