import { useMemo, useState } from 'react'
import { useGarbageSeasons, useGarbageTime } from '../hooks/useTeamData'
import {
  assertStatOrder,
  buildRows,
  DEFAULT_REMOVALS,
  leagueShares,
  POSITIONS,
  STARTABLE,
  teamBandShares,
} from '../lib/garbageTime'
import type { Band, Format, PlayerRow, Removals } from '../lib/garbageTime'
import type { FantasyPos } from '../types'
import type { ViewName } from '../lib/routes'
import { SectionNav } from './SectionNav'
import { AboutButton } from './AboutButton'
import { GarbageAbout } from './garbage/GarbageAbout'
import { StatTile } from './summary/StatTile'
import { BandControls } from './garbage/BandControls'
import { Segmented } from './garbage/Segmented'
import { GarbageTable } from './garbage/GarbageTable'
import { rankTone } from './garbage/rankTone'
import type { SortKey } from './garbage/GarbageTable'

interface Props {
  /** Switches statistical display, from the heading dropdown. */
  onNavigate: (view: ViewName) => void
  onTrends: () => void
}

/**
 * The page shows a hundred at a position, by either ranking.
 *
 * Filtering on the actual rank alone would defeat the reason the file carries
 * more than a hundred: a player who is 105th on what he scored and 80th once
 * garbage time comes off is the whole point, and he would never appear.
 */
const SHOWN = 100
const shown = (row: PlayerRow) => row.actualRank <= SHOWN || row.remainingRank <= SHOWN

const SORTS: Record<SortKey, (a: PlayerRow, b: PlayerRow) => number> = {
  remaining: (a, b) => b.remaining - a.remaining,
  actual: (a, b) => b.actual - a.actual,
  delta: (a, b) => b.rankDelta - a.rankDelta,
  share: (a, b) => b.share - a.share,
}

/**
 * Fantasy rankings with garbage time taken out.
 *
 * Every number here is the same season a reader already knows, scored the same
 * way, with one subtraction: the plays that happened after the game stopped
 * being in doubt. The interesting column is not either ranking but the distance
 * between them.
 */
export function GarbageTimePage({ onNavigate, onTrends }: Props) {
  const seasons = useGarbageSeasons()
  /** Null until the reader picks one; the newest published season stands in. */
  const [chosen, setChosen] = useState<number | null>(null)
  const [pos, setPos] = useState<FantasyPos>('WR')
  const [format, setFormat] = useState<Format>('ppr')
  const [threshold, setThreshold] = useState(0.1)
  const [remove, setRemove] = useState<Removals>(DEFAULT_REMOVALS)
  const [sort, setSort] = useState<SortKey>('actual')
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set())
  const [aboutOpen, setAboutOpen] = useState(false)

  const list = seasons.data
  const season = chosen ?? list?.[0] ?? null

  const file = useGarbageTime(season)
  const data = file.data

  const settings = useMemo(() => ({ threshold, format, remove }), [threshold, format, remove])

  const model = useMemo(() => {
    if (!data) return null
    assertStatOrder(data)
    const teamShares = teamBandShares(data, settings.threshold)
    return {
      rows: buildRows(data, settings),
      shares: leagueShares(data, settings.threshold),
      teamShares,
    }
  }, [data, settings])

  const atPosition = useMemo(
    () =>
      (model?.rows ?? [])
        .filter((row) => row.player.pos === pos && shown(row))
        .sort(SORTS[sort]),
    [model, pos, sort],
  )

  const headline = useMemo(() => {
    if (atPosition.length === 0) return null
    const startable = atPosition.filter((r) => r.actualRank <= STARTABLE[pos])
    const faller = [...startable].sort((a, b) => b.rankDelta - a.rankDelta)[0]
    const riser = [...atPosition].sort((a, b) => a.rankDelta - b.rankDelta)[0]
    const points = atPosition.reduce((sum, r) => sum + Math.max(r.actual, 0), 0)
    const cut = atPosition.reduce((sum, r) => sum + Math.max(r.removed, 0), 0)
    return { faller, riser, share: points > 0 ? cut / points : 0 }
  }, [atPosition, pos])

    /**
   * The value, colour and rank line for a mover tile.
   *
   * The arrow is derived from the sign rather than hard-coded per tile, because
   * with nothing checked every delta is zero and a tile that always says "▼ 0"
   * is claiming a fall that did not happen.
   */
  function moverTile(row: PlayerRow | undefined) {
    if (!row) return { value: '—' }
    const tone = rankTone(row.rankDelta)
    return {
      value: row.rankDelta === 0 ? '—' : `${tone.arrow} ${Math.abs(row.rankDelta)}`,
      valueColor: tone.color,
      benchmark: `${pos}${row.actualRank} → ${pos}${row.remainingRank}`,
    }
  }

  function changePosition(next: FantasyPos) {
    setPos(next)
    // The open rows belonged to the position being left; carrying them over
    // would leave panels open for players no longer in the table.
    setOpenIds(new Set())
  }

  function toggleOpen(id: string) {
    setOpenIds((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-3 py-5 sm:px-6 sm:py-8">
      <header>
        <div className="flex items-start justify-between gap-4">
          <SectionNav current="garbage" onNavigate={onNavigate} />
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onTrends}
              className="rounded border border-stone-300 px-2.5 py-1 text-xs font-semibold tracking-wide text-stone-600 uppercase hover:border-stone-500 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
            >
              League Stats
            </button>
            <AboutButton onClick={() => setAboutOpen(true)} tone="muted" />
          </div>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-stone-500">
          Every fantasy ranking counts the fourth quarter of a blowout the same as the first
          quarter of a one-score game. This one does not: pick a threshold, and the plays that
          happened after the game stopped being in doubt come out.
        </p>
      </header>

      {(seasons.loading || file.loading) && (
        <p className="px-3 py-16 text-center text-sm text-stone-500">Loading…</p>
      )}
      {seasons.error && (
        <p className="px-3 py-16 text-center text-sm text-red-700">{seasons.error.message}</p>
      )}
      {file.error && (
        <p className="px-3 py-16 text-center text-sm text-red-700">{file.error.message}</p>
      )}

      {data && model && season !== null && (
        <>
          <BandControls
            seasons={list ?? [season]}
            season={season}
            format={format}
            threshold={threshold}
            remove={remove}
            shares={model.shares}
            onSeason={(next) => {
              setChosen(next)
              setOpenIds(new Set())
            }}
            onFormat={setFormat}
            onThreshold={setThreshold}
            onRemove={(band: Band, on: boolean) =>
              setRemove((current) => ({ ...current, [band]: on }))
            }
          >
            <Segmented
              label="Position"
              value={pos}
              options={POSITIONS.map((p) => ({ value: p, label: p }))}
              onChange={changePosition}
            />
          </BandControls>

          {headline && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                label={`${pos} points removed`}
                value={`${(headline.share * 100).toFixed(1)}%`}
                note={`Of everything the top ${SHOWN} ${pos}s scored in ${season}.`}
              />
              <StatTile
                label="Biggest faller"
                {...moverTile(headline.faller)}
                note={headline.faller?.player.name ?? 'No starter moved.'}
              />
              <StatTile
                label="Biggest riser"
                {...moverTile(headline.riser)}
                note={headline.riser?.player.name ?? 'No one moved up.'}
              />
              <StatTile
                label="Garbage-time plays"
                value={`${((model.shares.trailing + model.shares.leading) * 100).toFixed(1)}%`}
                note={`Of all ${season} offensive plays. Each snap counts once, for whichever offense was on the field.`}
                benchmark={`${(model.shares.trailing * 100).toFixed(1)}% trailing · ${(
                  model.shares.leading * 100
                ).toFixed(1)}% leading`}
              />
            </dl>
          )}

          <GarbageTable
            rows={atPosition}
            file={data}
            format={format}
            threshold={threshold}
            remove={remove}
            sort={sort}
            openIds={openIds}
            teamShares={model.teamShares}
            onSort={setSort}
            onToggle={toggleOpen}
            onCollapseAll={() => setOpenIds(new Set())}
          />


        </>
      )}

      <GarbageAbout
        open={aboutOpen}
        file={data}
        seasons={list ?? []}
        onClose={() => setAboutOpen(false)}
      />
    </main>
  )
}
