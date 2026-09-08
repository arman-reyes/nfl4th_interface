import type { FantasyPos, StatKey } from '../../types'

/**
 * Which counting stats a table shows, per position and for a whole offense.
 *
 * Kept out of the component file so oxlint's fast-refresh rule stays happy, and
 * so a new position or a new stat is a data edit rather than a JSX one.
 */
export interface StatLineSpec {
  key: StatKey
  label: string
}

/** What is worth showing for each position. A team does all of it. */
export const POSITION_LINES: Record<FantasyPos, StatLineSpec[]> = {
  QB: [
    { key: 'pass_att', label: 'Att' },
    { key: 'pass_cmp', label: 'Cmp' },
    { key: 'pass_yds', label: 'Pass yds' },
    { key: 'pass_td', label: 'Pass TD' },
    { key: 'int', label: 'INT' },
    { key: 'rush_yds', label: 'Rush yds' },
    { key: 'rush_td', label: 'Rush TD' },
  ],
  RB: [
    { key: 'rush_att', label: 'Car' },
    { key: 'rush_yds', label: 'Rush yds' },
    { key: 'rush_td', label: 'Rush TD' },
    { key: 'rec', label: 'Rec' },
    { key: 'rec_yds', label: 'Rec yds' },
    { key: 'rec_td', label: 'Rec TD' },
  ],
  WR: [
    { key: 'tgt', label: 'Tgt' },
    { key: 'rec', label: 'Rec' },
    { key: 'rec_yds', label: 'Rec yds' },
    { key: 'rec_td', label: 'Rec TD' },
    { key: 'rush_yds', label: 'Rush yds' },
  ],
  TE: [
    { key: 'tgt', label: 'Tgt' },
    { key: 'rec', label: 'Rec' },
    { key: 'rec_yds', label: 'Rec yds' },
    { key: 'rec_td', label: 'Rec TD' },
    { key: 'rush_yds', label: 'Rush yds' },
  ],
}

export const TEAM_LINES: StatLineSpec[] = [
  { key: 'pass_att', label: 'Pass att' },
  { key: 'pass_yds', label: 'Pass yds' },
  { key: 'pass_td', label: 'Pass TD' },
  { key: 'int', label: 'INT' },
  { key: 'rush_att', label: 'Carries' },
  { key: 'rush_yds', label: 'Rush yds' },
  { key: 'rush_td', label: 'Rush TD' },
  { key: 'rec', label: 'Receptions' },
  { key: 'fum_lost', label: 'Fumbles lost' },
]
