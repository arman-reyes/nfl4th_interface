import { describe, expect, it } from 'vitest'
import { pathFor, SECTIONS, sectionOf, viewAt } from '../routes'
import type { ViewName } from '../routes'

const VIEWS: ViewName[] = [
  'teams',
  'trends',
  'quiz',
  'twopt',
  'twoptTrends',
  'twoptQuiz',
  'garbage',
  'garbageTrends',
]

describe('routes', () => {
  it('round-trips every view', () => {
    for (const view of VIEWS) expect(viewAt(pathFor(view))).toBe(view)
  })

  it('puts the garbage-time page where the brief asked for it', () => {
    expect(pathFor('garbage')).toBe('/garbagetime')
    expect(viewAt('/garbagetime')).toBe('garbage')
  })

  it('tolerates a trailing slash', () => {
    expect(viewAt('/garbagetime/')).toBe('garbage')
    expect(viewAt('/')).toBe('teams')
  })

  it('is case-insensitive, because a shared link may not be', () => {
    expect(viewAt('/GarbageTime')).toBe('garbage')
  })

  it('falls back to the team picker rather than a blank page', () => {
    expect(viewAt('/nope')).toBe('teams')
    expect(viewAt('/garbagetime/extra')).toBe('teams')
    expect(viewAt('')).toBe('teams')
  })
})

describe('sections', () => {
  it('lists the statistical displays, 4th downs first and the two nfl4th pages together', () => {
    expect(SECTIONS.map((s) => s.view)).toEqual(['teams', 'twopt', 'garbage'])
  })

  it('gives every section a real route', () => {
    for (const section of SECTIONS) expect(viewAt(pathFor(section.view))).toBe(section.view)
  })

  it('gives every section a title and a blurb, so the menu is never bare', () => {
    for (const section of SECTIONS) {
      expect(section.title.length).toBeGreaterThan(0)
      expect(section.blurb.length).toBeGreaterThan(0)
    }
  })

  it('resolves a section from its own view', () => {
    expect(sectionOf('garbage').title).toBe('Garbage Time')
    expect(sectionOf('teams').title).toBe('4th Down Stats')
  })

  it('files each sub-view under the page whose data it reads', () => {
    expect(sectionOf('trends').view).toBe('teams')
    expect(sectionOf('quiz').view).toBe('teams')
    expect(sectionOf('twoptTrends').view).toBe('twopt')
    expect(sectionOf('twoptQuiz').view).toBe('twopt')
    expect(sectionOf('garbageTrends').view).toBe('garbage')
  })

  it('nests the two-point trends and quiz under their own page', () => {
    expect(pathFor('twopt')).toBe('/twopoint')
    expect(viewAt('/twopoint/trends')).toBe('twoptTrends')
    expect(viewAt('/twopoint/quiz')).toBe('twoptQuiz')
    expect(viewAt('/TwoPoint')).toBe('twopt')
    expect(sectionOf('twopt').title).toBe('2-Point Stats')
  })

  it('nests garbage-time trends under its own page', () => {
    expect(pathFor('garbageTrends')).toBe('/garbagetime/trends')
    expect(viewAt('/garbagetime/trends')).toBe('garbageTrends')
    // and the parent still resolves, rather than being swallowed by the child
    expect(viewAt('/garbagetime')).toBe('garbage')
  })
})
