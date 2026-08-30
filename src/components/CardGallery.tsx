import { useMemo, useState } from 'react'
import { DecisionCard } from './DecisionCard'
import { useLeagueIndex, useTeamData } from '../hooks/useTeamData'
import { actualChoice, agreed, band, modelChoice, wpForfeited } from '../lib/decision'
import type { Play } from '../types'

/**
 * Step 2 scaffold: picks out the situations that stress the card — a clear go,
 * a coin flip, a deviation, a spot with no punt and a spot with no field goal —
 * so the component can be judged on the hard cases rather than a typical one.
 * Replaced by the play list in step 4.
 */
interface Case {
  key: string
  label: string
  /** Plays eligible for this case. */
  where: (p: Play) => boolean
  /** Higher wins, so the gallery shows the most extreme example, not the first. */
  rank: (p: Play) => number
}

const CASES: Case[] = [
  { key: 'clear-go', label: 'Clear go', where: () => true, rank: (p) => p.go_boost },
  {
    key: 'coin-flip',
    label: 'Coin flip',
    where: (p) => band(p.go_boost) === 'coin flip',
    rank: (p) => -Math.abs(p.go_boost),
  },
  {
    key: 'clear-punt',
    label: 'Clear punt',
    where: (p) => modelChoice(p) === 'punt',
    rank: (p) => -p.go_boost,
  },
  {
    key: 'clear-kick',
    label: 'Clear kick',
    where: (p) => modelChoice(p) === 'fg',
    rank: (p) => -p.go_boost,
  },
  {
    key: 'deviation',
    label: 'Staff disagreed',
    where: (p) => agreed(p) === false,
    rank: (p) => wpForfeited(p) ?? 0,
  },
  {
    key: 'no-punt',
    label: 'No punt option',
    where: (p) => p.punt_wp === null,
    rank: (p) => Math.abs(p.go_boost),
  },
  {
    key: 'no-fg',
    label: 'No kick option',
    where: (p) => p.fg_wp === null,
    rank: (p) => Math.abs(p.go_boost),
  },
  {
    key: 'no-decision',
    label: 'No decision',
    where: (p) => actualChoice(p) === null,
    rank: (p) => Math.abs(p.go_boost),
  },
]

function pick(plays: Play[], match: Case | undefined): Play | null {
  if (!match) return null
  let best: Play | null = null
  for (const play of plays) {
    if (!match.where(play)) continue
    if (best === null || match.rank(play) > match.rank(best)) best = play
  }
  return best
}

export function CardGallery() {
  const index = useLeagueIndex()
  const [abbr, setAbbr] = useState('KC')
  const [caseKey, setCaseKey] = useState(CASES[0].key)
  const team = useTeamData(abbr)

  const meta = index.data?.teams.find((t) => t.team_abbr === abbr)
  const play = useMemo(() => {
    if (!team.data) return null
    return pick(team.data, CASES.find((c) => c.key === caseKey))
  }, [team.data, caseKey])

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-10">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={abbr}
          onChange={(e) => setAbbr(e.target.value)}
          className="rounded border border-stone-300 bg-white px-2 py-1.5 text-sm"
        >
          {index.data?.teams.map((t) => (
            <option key={t.team_abbr} value={t.team_abbr}>
              {t.team_abbr} — {t.team_name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1">
          {CASES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCaseKey(c.key)}
              className={`rounded border px-2.5 py-1.5 text-xs font-medium ${
                caseKey === c.key
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {index.data?.fixture && (
        <p className="text-xs font-medium text-amber-700">
          Fixture data — not model output.
        </p>
      )}

      {team.loading && <p className="text-sm text-stone-500">Loading {abbr}…</p>}
      {play ? (
        <DecisionCard play={play} team={meta} />
      ) : (
        team.data && <p className="text-sm text-stone-500">No play matching that case for {abbr}.</p>
      )}
    </div>
  )
}
