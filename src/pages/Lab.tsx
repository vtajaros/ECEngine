import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FlaskConical, Layers, BarChart3, Swords } from 'lucide-react'
import { ContentCoverageDemo } from '../components/stats/demos/ContentCoverageDemo'
import { TosCoverageMatrixDemo } from '../components/stats/demos/TosCoverageMatrixDemo'
import { QuestionLengthDemo } from '../components/stats/demos/QuestionLengthDemo'
import { AnswerPositionDemo } from '../components/stats/demos/AnswerPositionDemo'
import { QuestionLengthAnovaDemo } from '../components/stats/demos/QuestionLengthAnovaDemo'
import { AnswerPositionContingencyDemo } from '../components/stats/demos/AnswerPositionContingencyDemo'
import { QuestionLengthZScoreDemo } from '../components/stats/demos/QuestionLengthZScoreDemo'
import { ResponseTimeDemo } from '../components/stats/demos/ResponseTimeDemo'
import { GauntletSpeedParDemo } from '../components/stats/demos/gauntlet/GauntletSpeedParDemo'
import { GauntletCoverageDensityDemo } from '../components/stats/demos/gauntlet/GauntletCoverageDensityDemo'
import { GauntletEnduranceStreakDemo } from '../components/stats/demos/gauntlet/GauntletEnduranceStreakDemo'
import { GauntletTopicAccuracyDemo, type ActiveDrillSession } from '../components/stats/demos/gauntlet/GauntletTopicAccuracyDemo'
import { LearnMode } from '../components/mcq/LearnMode'
import { dbService } from '../services/db.service'

export default function Lab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<'tos' | 'eda' | 'gauntlet'>(
    initialTab === 'gauntlet' || initialTab === 'eda' || initialTab === 'tos' ? initialTab : 'tos'
  )
  const [activeDrillSession, setActiveDrillSession] = useState<ActiveDrillSession | null>(null)

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'gauntlet' || tabParam === 'eda' || tabParam === 'tos') {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  const handleTabChange = (tab: 'tos' | 'eda' | 'gauntlet') => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  if (activeDrillSession) {
    return (
      <div className="w-full h-full flex flex-col overflow-y-auto">
        <LearnMode
          cards={activeDrillSession.cards}
          title={activeDrillSession.title}
          subject={activeDrillSession.subject}
          ttsEnabled={activeDrillSession.ttsEnabled}
          shuffleChoices={activeDrillSession.shuffleChoices}
          onComplete={(sessionStats) => {
            const total = activeDrillSession.cards.length || (sessionStats.correct + sessionStats.wrong)
            dbService.saveExamSession({
              topicId: null,
              mode: 'learn',
              score: sessionStats.correct,
              total,
              answers: JSON.stringify({
                deckTitle: activeDrillSession.title,
                deckDescription: `Topic Drill: ${activeDrillSession.title}`,
                subject: activeDrillSession.subject,
                correctFirstTry: sessionStats.correct,
                wrongFirstTry: sessionStats.wrong,
                bookmarkedCount: sessionStats.bookmarked,
              }),
            }).catch(err => {
              console.warn('Failed to save topic drill exam session:', err)
            })
          }}
          onExit={() => {
            setActiveDrillSession(null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="h-full bg-transparent px-8 pb-8 pt-6 lg:px-12 lg:pb-12 lg:pt-6 overflow-y-auto show-scrollbar w-full flex flex-col gap-6">
      {/* Header */}
      <header className="shrink-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border-base pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <FlaskConical className="text-accent" size={32} />
            <h1 className="font-['Orbitron'] text-3xl lg:text-4xl font-bold text-text-primary tracking-wider uppercase">
              Analytics
            </h1>
          </div>
          <p className="text-text-muted font-['Rajdhani'] text-lg uppercase tracking-widest">
            {activeTab === 'tos'
              ? 'PRC Table of Specifications Classification & Library Coverage'
              : activeTab === 'eda'
              ? 'EDA concepts, live on your review data.'
              : 'Gauntlet speed-run performance, Elo trajectory & ToS mastery.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-surface rounded-xl border border-border-base shrink-0">
          <button
            onClick={() => handleTabChange('tos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-['Rajdhani'] uppercase tracking-wider font-bold transition-all ${
              activeTab === 'tos'
                ? 'bg-accent/15 text-accent border border-accent/40 shadow-[0_0_12px_rgba(0,255,65,0.2)]'
                : 'text-text-muted hover:text-text-primary border border-transparent'
            }`}
          >
            <Layers size={15} />
            <span>ToS Matrix</span>
          </button>
          <button
            onClick={() => handleTabChange('gauntlet')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-['Rajdhani'] uppercase tracking-wider font-bold transition-all ${
              activeTab === 'gauntlet'
                ? 'bg-accent/15 text-accent border border-accent/40 shadow-[0_0_12px_rgba(0,255,65,0.2)]'
                : 'text-text-muted hover:text-text-primary border border-transparent'
            }`}
          >
            <Swords size={15} />
            <span>Mastery Analytics</span>
          </button>
          <button
            onClick={() => handleTabChange('eda')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-['Rajdhani'] uppercase tracking-wider font-bold transition-all ${
              activeTab === 'eda'
                ? 'bg-accent/15 text-accent border border-accent/40 shadow-[0_0_12px_rgba(0,255,65,0.2)]'
                : 'text-text-muted hover:text-text-primary border border-transparent'
            }`}
          >
            <BarChart3 size={15} />
            <span>Statistical EDA</span>
          </button>
        </div>
      </header>

      {/* Tab 1: ToS Matrix */}
      {activeTab === 'tos' && <TosCoverageMatrixDemo />}

      {/* Tab 2: Statistical EDA Charts & Graphs */}
      {activeTab === 'eda' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-200">
            <ContentCoverageDemo />
            <QuestionLengthDemo />
            <AnswerPositionDemo />
            <QuestionLengthAnovaDemo />
            <AnswerPositionContingencyDemo />
            <QuestionLengthZScoreDemo />
          </div>

          <div className="grid grid-cols-1 gap-6 pb-6 animate-in fade-in duration-200">
            <ResponseTimeDemo />
          </div>
        </>
      )}

      {/* Tab 3: Gauntlet Analytics & Performance EDA */}
      {activeTab === 'gauntlet' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          {/* Row 1: Dedicated Competency Mastery, Weak Areas & Topic Accuracy Diagnostic Matrix */}
          <GauntletTopicAccuracyDemo onStartSession={setActiveDrillSession} />

          {/* Row 2: Speed vs Par Pacing + Endurance & Streak Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GauntletSpeedParDemo />
            <GauntletEnduranceStreakDemo />
          </div>

          {/* Row 3: Full-width Topic Coverage Density */}
          <div className="pb-6">
            <GauntletCoverageDensityDemo />
          </div>
        </div>
      )}
    </div>
  )
}
