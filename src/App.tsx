import { useState } from 'react'
import { useLeagueIndex, useTwoPointIndex } from './hooks/useTeamData'
import { useDrilldown } from './hooks/useDrilldown'
import { useRoute } from './hooks/useRoute'
import { dataSource } from './data/client'
import { FOURTH_DOWN } from './lib/decision'
import { TWO_POINT } from './lib/twopt'
import { LEAGUE_METRICS, TWO_POINT_METRICS } from './lib/league'
import type { Movement } from './lib/league'
import type { Play, Try } from './types'
import { ComparisonCard } from './components/ComparisonCard'
import { PlayRow } from './components/PlayRow'
import { TeamExplorer, Centered } from './components/TeamExplorer'
import { TeamPicker } from './components/TeamPicker'
import { AboutDialog } from './components/AboutDialog'
import { LeagueTrends } from './components/LeagueTrends'
import { QuizPage } from './components/QuizPage'
import { QuizSituation } from './components/quiz/QuizSituation'
import { FOURTH_DOWN_QUIZ, TWO_POINT_QUIZ } from './components/quiz/copy'
import { GarbageTimePage } from './components/GarbageTimePage'
import { GarbageTrends } from './components/GarbageTrends'
import { TryCard } from './components/twopt/TryCard'
import { TryRow } from './components/twopt/TryRow'
import { TryQuizSituation } from './components/twopt/TryQuizSituation'
import { TwoPointAbout } from './components/twopt/TwoPointAbout'

/** A stable empty list, so a drill-down with no index yet does not re-derive every render. */
const NO_SEASONS: number[] = []

/**
 * The router, and the state that has to outlive a page.
 *
 * The top-level view comes from the URL so every page can be linked to and the
 * back button works. Everything below it — the team, the filters, the open
 * play, the controls on the garbage-time page — stays in state, because those
 * are a session rather than a place. The two drill-downs are held here rather
 * than inside their pages so that stepping out to a trends view or the quiz
 * and back does not forget the team.
 *
 * The 4th-down page and the two-point page are the same experience over
 * different decisions: the same picker, banner, list, summary, trends and
 * quiz, each handed that page's rules, data and words.
 */
export default function App() {
  const index = useLeagueIndex()
  const [view, navigate] = useRoute()
  const onTwoPoint = view === 'twopt' || view === 'twoptTrends' || view === 'twoptQuiz'
  const twoIndex = useTwoPointIndex(onTwoPoint)
  const fourth = useDrilldown<Play>(dataSource.loadTeamPlays, index.data?.seasons ?? NO_SEASONS)
  const two = useDrilldown<Try>(dataSource.loadTwoPointTeam, twoIndex.data?.seasons ?? NO_SEASONS)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [twoAboutOpen, setTwoAboutOpen] = useState(false)

  if (index.loading) return <Centered>Loading league…</Centered>
  if (index.error) return <Centered tone="error">{index.error.message}</Centered>
  if (!index.data) return null

  const about = (
    <AboutDialog open={aboutOpen} index={index.data} onClose={() => setAboutOpen(false)} />
  )
  const openAbout = () => setAboutOpen(true)
  const toTeams = () => navigate('teams')

  if (view === 'garbage') {
    return (
      <>
        <GarbageTimePage onNavigate={navigate} onTrends={() => navigate('garbageTrends')} />
        {about}
      </>
    )
  }

  if (view === 'garbageTrends') {
    return (
      <>
        <GarbageTrends onNavigate={navigate} onBack={() => navigate('garbage')} />
        {about}
      </>
    )
  }

  // --- the two-point page and its sub-views --------------------------------

  if (onTwoPoint) {
    if (twoIndex.loading) return <Centered>Loading tries…</Centered>
    if (twoIndex.error) return <Centered tone="error">{twoIndex.error.message}</Centered>
    if (!twoIndex.data) return null
    const data = twoIndex.data
    const twoAbout = (
      <TwoPointAbout open={twoAboutOpen} index={data} onClose={() => setTwoAboutOpen(false)} />
    )
    const openTwoAbout = () => setTwoAboutOpen(true)
    const toTries = () => navigate('twopt')

    if (view === 'twoptQuiz') {
      return (
        <>
          <QuizPage
            index={data}
            rules={TWO_POINT}
            copy={TWO_POINT_QUIZ}
            loadPool={dataSource.loadTwoPointQuizPool}
            situation={(play, compact) => <TryQuizSituation play={play} compact={compact} />}
            onBack={toTries}
            onAbout={openTwoAbout}
          />
          {twoAbout}
        </>
      )
    }

    if (view === 'twoptTrends') {
      return (
        <>
          <LeagueTrends
            index={data}
            metrics={TWO_POINT_METRICS}
            intro={twoPointIntro}
            backLabel="Teams"
            onBack={toTries}
            onAbout={openTwoAbout}
          />
          {twoAbout}
        </>
      )
    }

    const meta = data.teams.find((t) => t.team_abbr === two.abbr)
    if (!two.abbr || !meta) {
      return (
        <main className="mx-auto max-w-6xl px-3 py-8 sm:px-6 sm:py-12">
          <TeamPicker
            teams={data.teams}
            fixture={data.fixture}
            current="twopt"
            intro={
              <>
                Pick a team to review every try they faced — extra point or two — and what the
                model from <Nfl4th /> would have done.
              </>
            }
            quiz={{
              title: 'Think you know when to go for two?',
              blurb:
                'Ten real tries, twenty seconds each — then see how you score against the model.',
            }}
            onSelect={two.chooseTeam}
            onAbout={openTwoAbout}
            onTrends={() => navigate('twoptTrends')}
            onQuiz={() => navigate('twoptQuiz')}
            onNavigate={navigate}
          />
          {twoAbout}
        </main>
      )
    }

    return (
      <>
        <TeamExplorer<Try, 'kick' | 'two'>
          index={data}
          team={meta}
          rules={TWO_POINT}
          drill={two}
          noun={['try', 'tries']}
          bannerNoun="tries"
          verb="went for two"
          row={(play, selected, onSelect) => (
            <TryRow play={play} team={meta} selected={selected} onSelect={onSelect} />
          )}
          card={(play) => <TryCard play={play} team={meta} />}
          onAbout={openTwoAbout}
          onTrends={() => navigate('twoptTrends')}
        />
        {twoAbout}
      </>
    )
  }

  // --- the 4th-down page and its sub-views ---------------------------------

  if (view === 'quiz') {
    return (
      <>
        <QuizPage
          index={index.data}
          rules={FOURTH_DOWN}
          copy={FOURTH_DOWN_QUIZ}
          loadPool={dataSource.loadQuizPool}
          situation={(play, compact) => <QuizSituation play={play} compact={compact} />}
          onBack={toTeams}
          onAbout={openAbout}
        />
        {about}
      </>
    )
  }

  if (view === 'trends') {
    return (
      <>
        <LeagueTrends
          index={index.data}
          metrics={LEAGUE_METRICS}
          intro={fourthDownIntro}
          backLabel="Teams"
          onBack={toTeams}
          onAbout={openAbout}
        />
        {about}
      </>
    )
  }

  const meta = index.data.teams.find((t) => t.team_abbr === fourth.abbr)
  if (!fourth.abbr || !meta) {
    return (
      <main className="mx-auto max-w-6xl px-3 py-8 sm:px-6 sm:py-12">
        <TeamPicker
          teams={index.data.teams}
          fixture={index.data.fixture}
          current="teams"
          intro={
            <>
              Pick a team to review every 4th down they faced, and what the models from <Nfl4th />{' '}
              would have done.
            </>
          }
          quiz={{
            title: 'Think you can make the right call on 4th down?',
            blurb:
              'Ten real situations, twenty seconds each — then see how you score against the model.',
          }}
          onSelect={fourth.chooseTeam}
          onAbout={openAbout}
          onTrends={() => navigate('trends')}
          onQuiz={() => navigate('quiz')}
          onNavigate={navigate}
        />
        {about}
      </main>
    )
  }

  return (
    <>
      <TeamExplorer<Play, 'go' | 'fg' | 'punt'>
        index={index.data}
        team={meta}
        rules={FOURTH_DOWN}
        drill={fourth}
        noun={['4th down', '4th downs']}
        bannerNoun="fourth downs"
        verb="went"
        row={(play, selected, onSelect) => (
          <PlayRow play={play} team={meta} selected={selected} onSelect={onSelect} />
        )}
        card={(play) => <ComparisonCard play={play} team={meta} />}
        onAbout={openAbout}
        onTrends={() => navigate('trends')}
      />
      {about}
    </>
  )
}

function Nfl4th() {
  return (
    <a
      href="https://www.nfl4th.com/"
      target="_blank"
      rel="noreferrer"
      className="font-medium text-stone-700 underline decoration-stone-400 underline-offset-2 transition-colors hover:text-stone-900"
    >
      nfl4th
    </a>
  )
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`

/** The 4th-down story: the model's advice barely moved, and the league did. */
function fourthDownIntro([aggressiveness, saidGo]: (Movement | null)[], seasons: number) {
  if (!aggressiveness || !saidGo) return null
  return (
    <>
      Across these {seasons} seasons the median team went from going for it on{' '}
      <strong className="tnum font-semibold text-stone-900">{pct(aggressiveness.first.p50)}</strong>{' '}
      of the 4th downs where the model said go, to{' '}
      <strong className="tnum font-semibold text-stone-900">{pct(aggressiveness.last.p50)}</strong>
      . Over the same stretch, how often the model said go barely moved —{' '}
      <span className="tnum">{pct(saidGo.first.p50)}</span> to{' '}
      <span className="tnum">{pct(saidGo.last.p50)}</span>. The opportunity was always there;
      what changed is what teams did with it.
    </>
  )
}

/**
 * The two-point story, which is that there is not one: a decade after the
 * kick moved back, the league goes for two about as rarely as it did the
 * first year, while the model has preferred two on most tries throughout.
 */
function twoPointIntro([aggressiveness, saidTwo, , cost]: (Movement | null)[], seasons: number) {
  if (!aggressiveness || !saidTwo || !cost) return null
  return (
    <>
      Across these {seasons} seasons the median team went for two on{' '}
      <strong className="tnum font-semibold text-stone-900">{pct(aggressiveness.first.p50)}</strong>{' '}
      of the tries where the model preferred it, and{' '}
      <strong className="tnum font-semibold text-stone-900">{pct(aggressiveness.last.p50)}</strong>{' '}
      by the end — where 4th downs moved, tries did not. The model preferred two on{' '}
      <span className="tnum">{pct(saidTwo.first.p50)}</span> to{' '}
      <span className="tnum">{pct(saidTwo.last.p50)}</span> of tries the whole way, most of them
      by a hair — and a coin flip does not move a staff off the kick. What it costs has held at
      about <span className="tnum">{cost.last.p50.toFixed(1)}</span> points of win probability a
      game.
    </>
  )
}
