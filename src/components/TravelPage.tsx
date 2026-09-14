import { useMemo, useState } from 'react'
import { useTravelLeague, useTravelSeason, useTravelSeasons } from '../hooks/useTeamData'
import { aggregate, farShare, homeAwayFar, mean, se, signedText } from '../lib/travel'
import type { Lens, TravelAggregate } from '../lib/travel'
import type { Format } from '../lib/garbageTime'
import type { FantasyPos } from '../types'
import type { ViewName } from '../lib/routes'
import { SectionNav } from './SectionNav'
import { AboutButton } from './AboutButton'
import { StatTile } from './summary/StatTile'
import { ALL_SEASONS, TravelControls } from './travel/TravelControls'
import type { SeasonChoice } from './travel/TravelControls'
import { TripTable } from './travel/TripTable'
import { TeamTravelTable } from './travel/TeamTravelTable'
import type { TeamSortKey } from './travel/TeamTravelTable'
import { PlayerTravelTable } from './travel/PlayerTravelTable'
import type { PlayerSortKey } from './travel/PlayerTravelTable'
import { TravelAbout } from './travel/TravelAbout'
import { Standouts } from './travel/Standouts'
import { HomeEdgeChart } from './travel/HomeEdgeChart'
import { signTone } from './travel/signTone'

interface Props {
  /** Switches statistical display, from the heading dropdown. */
  onNavigate: (view: ViewName) => void
}

const signed = (v: number | null, digits = 1) => (v === null ? '—' : signedText(v, digits))
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`)
const err = (v: number | null, digits = 1) => (v === null ? '' : ` ± ${v.toFixed(digits)}`)

/**
 * Travel impact: does playing away — and how far away — change what a team
 * and its players do?
 *
 * The all-seasons aggregate is the resting state, because the far bins are
 * only large enough to read in the aggregate; a season is a drill-down. Both
 * views come out of the same `aggregate` function, one from a file the build
 * wrote and one computed here, so they cannot disagree.
 */
export function TravelPage({ onNavigate }: Props) {
  const seasons = useTravelSeasons()
  const league = useTravelLeague()
  const [chosen, setChosen] = useState<SeasonChoice>(ALL_SEASONS)
  const [lens, setLens] = useState<Lens>('distance')
  const [threshold, setThreshold] = useState(1000)
  const [pos, setPos] = useState<FantasyPos>('WR')
  const [format, setFormat] = useState<Format>('ppr')
  const [teamSort, setTeamSort] = useState<TeamSortKey>('gap')
  const [playerSort, setPlayerSort] = useState<PlayerSortKey>('total')
  const [aboutOpen, setAboutOpen] = useState(false)

  const season = useTravelSeason(chosen === ALL_SEASONS ? null : chosen)

  const agg: TravelAggregate | null = useMemo(() => {
    if (chosen === ALL_SEASONS) return league.data
    return season.data ? aggregate([season.data]) : null
  }, [chosen, league.data, season.data])

  const headline = useMemo(() => {
    if (!agg) return null
    const w = homeAwayFar(agg.byLens.distance.win, threshold)
    const m = homeAwayFar(agg.byLens.distance.margin, threshold)
    const v = homeAwayFar(agg.byLens.distance.vs_line, threshold)
    const international = agg.byLens.tz.win[8].n
    return {
      homeWin: mean(w.home),
      awayWin: mean(w.away),
      farWin: mean(w.far),
      homeMargin: mean(m.home),
      homeMarginSe: se(m.home),
      farVsLine: mean(v.far),
      farVsLineSe: se(v.far),
      farN: v.far.n,
      farShare: farShare(agg, threshold),
      trips: w.away.n,
      international,
    }
  }, [agg, threshold])

  const loading = seasons.loading || league.loading || season.loading
  const error = seasons.error ?? league.error ?? season.error
  const scope = chosen === ALL_SEASONS ? `${agg?.seasons.at(0)}–${agg?.seasons.at(-1)}` : String(chosen)
  const farTone = headline?.farVsLine == null ? null : signTone(Math.round(headline.farVsLine * 10))

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-3 py-5 sm:px-6 sm:py-8">
      <header>
        <div className="flex items-start justify-between gap-4">
          <SectionNav current="travel" onNavigate={onNavigate} />
          <div className="flex shrink-0 items-center gap-2">
            <AboutButton onClick={() => setAboutOpen(true)} tone="muted" />
          </div>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-stone-500">
          Home teams win more; that much is known. This asks the next question: once a team has
          left home, does going further — more miles, more time zones, an earlier body clock, a
          shorter week — cost anything more, once the betting line has had its say. Mostly it does
          not. Where it does is listed first.
        </p>
      </header>

      {loading && <p className="px-3 py-16 text-center text-sm text-stone-500">Loading…</p>}
      {error && <p className="px-3 py-16 text-center text-sm text-red-700">{error.message}</p>}

      {agg && headline && !loading && (
        <>
          <TravelControls
            seasons={seasons.data ?? []}
            season={chosen}
            lens={lens}
            threshold={threshold}
            farShare={headline.farShare}
            onSeason={setChosen}
            onLens={setLens}
            onThreshold={setThreshold}
          />

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Home margin"
              value={signed(headline.homeMargin)}
              note={`Average margin at home, ${scope}${err(headline.homeMarginSe)}. Away is the mirror image.`}
              benchmark={`Home win rate ${pct(headline.homeWin)}`}
            />
            <StatTile
              label="Win rate on trips"
              value={pct(headline.awayWin)}
              note={`Every game away from the home stadium, including neutral sites.`}
              benchmark={`${pct(headline.farWin)} on trips of ${threshold.toLocaleString('en-US')}+ mi`}
            />
            <StatTile
              label={`${threshold.toLocaleString('en-US')}+ mi vs line`}
              value={signed(headline.farVsLine)}
              valueColor={farTone?.color}
              note={`Margin against the closing spread on far trips${err(headline.farVsLineSe)}. Zero means the line already had it priced.`}
              benchmark={`${headline.farN.toLocaleString('en-US')} team-games`}
            />
            <StatTile
              label="Far trips"
              value={pct(headline.farShare)}
              note={`Of ${headline.trips.toLocaleString('en-US')} trips were ${threshold.toLocaleString('en-US')} mi or further.`}
              benchmark={
                headline.international > 0
                  ? `${headline.international} team-games four or more zones east`
                  : 'No international games'
              }
            />
          </dl>

          <Standouts agg={agg} onLens={setLens} />

          {agg.bySeason.length >= 3 && <HomeEdgeChart seasons={agg.bySeason} />}

          <TripTable agg={agg} lens={lens} threshold={threshold} />

          <TeamTravelTable agg={agg} threshold={threshold} sort={teamSort} onSort={setTeamSort} />

          <PlayerTravelTable
            agg={agg}
            pos={pos}
            format={format}
            threshold={threshold}
            sort={playerSort}
            onPos={setPos}
            onFormat={setFormat}
            onSort={setPlayerSort}
          />
        </>
      )}

      <TravelAbout
        open={aboutOpen}
        agg={agg}
        seasons={seasons.data ?? []}
        onClose={() => setAboutOpen(false)}
      />
    </main>
  )
}
