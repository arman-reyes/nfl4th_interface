/**
 * The places this site has, and the URLs they live at.
 *
 * Pure and DOM-free so it can be tested without a browser, and so `useRoute`
 * stays small enough to read in one go. There is exactly one level of routing
 * and no parameters, which is why there is no router library here.
 */

export type ViewName =
  | 'teams'
  | 'trends'
  | 'quiz'
  | 'twopt'
  | 'twoptTrends'
  | 'twoptQuiz'
  | 'garbage'
  | 'garbageTrends'

/** '/' must be the teams entry: it is where an unrecognised path lands. */
const PATHS: Record<ViewName, string> = {
  teams: '/',
  trends: '/trends',
  quiz: '/quiz',
  twopt: '/twopoint',
  twoptTrends: '/twopoint/trends',
  twoptQuiz: '/twopoint/quiz',
  garbage: '/garbagetime',
  garbageTrends: '/garbagetime/trends',
}

// Optional-chained so this module can be imported from a plain node script
// (the build-time checks do) rather than only from a Vite bundle.
const BASE = import.meta.env?.BASE_URL ?? '/'

/** Strips the deploy base and any trailing slash, leaving a leading '/'. */
function normalise(pathname: string): string {
  let path = pathname
  if (BASE !== '/' && path.startsWith(BASE)) path = path.slice(BASE.length - 1)
  if (!path.startsWith('/')) path = `/${path}`
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path.toLowerCase()
}

/**
 * The view a URL is asking for. Anything unrecognised is the landing view, so a
 * stale link or a typo shows the team picker rather than a blank page.
 */
export function viewAt(pathname: string): ViewName {
  const path = normalise(pathname)
  const hit = (Object.keys(PATHS) as ViewName[]).find((v) => PATHS[v] === path)
  return hit ?? 'teams'
}

/** The URL for a view, including the deploy base. */
export function pathFor(view: ViewName): string {
  const path = PATHS[view]
  if (BASE === '/') return path
  return path === '/' ? BASE : `${BASE.replace(/\/$/, '')}${path}`
}

/**
 * The top-level statistical displays, in the order the switcher lists them.
 *
 * This is the registry a new page is added to — one entry here puts it in the
 * heading dropdown on every other page, and nothing else needs to know it
 * exists. League trends and the quiz are deliberately absent: they are ways of
 * reading the 4th-down data rather than separate bodies of it, and they hang
 * off that page's own header.
 */
export interface Section {
  view: ViewName
  title: string
  /** One line on what the page answers, shown under the title in the menu. */
  blurb: string
}

export const SECTIONS: Section[] = [
  {
    view: 'teams',
    title: '4th Down Stats',
    blurb: 'Every 4th down a team faced, and what the model would have done instead.',
  },
  {
    view: 'twopt',
    title: '2-Point Stats',
    blurb: 'Every extra point and two-point try a team faced, and what the model would have done instead.',
  },
  {
    view: 'garbage',
    title: 'Garbage Time',
    blurb: 'Fantasy rankings with the plays that happened after the game was decided taken out.',
  },
]

/**
 * Which section's heading a view sits under.
 *
 * Sub-views belong to the page whose data they read: league trends and the quiz
 * are 4th-down views, the two-point page has both of its own, and garbage time
 * has trends of its own. Anything unrecognised falls back to the landing
 * section.
 */
const PARENT: Partial<Record<ViewName, ViewName>> = {
  trends: 'teams',
  quiz: 'teams',
  twoptTrends: 'twopt',
  twoptQuiz: 'twopt',
  garbageTrends: 'garbage',
}

export function sectionOf(view: ViewName): Section {
  const owner = PARENT[view] ?? view
  return SECTIONS.find((s) => s.view === owner) ?? SECTIONS[0]
}
