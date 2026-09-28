import React, { useState } from 'react'
import { FlaskConical, Layers, BarChart3 } from 'lucide-react'
import { ContentCoverageDemo } from '../components/stats/demos/ContentCoverageDemo'
import { TosCoverageMatrixDemo } from '../components/stats/demos/TosCoverageMatrixDemo'
import { QuestionLengthDemo } from '../components/stats/demos/QuestionLengthDemo'
import { AnswerPositionDemo } from '../components/stats/demos/AnswerPositionDemo'
import { QuestionLengthAnovaDemo } from '../components/stats/demos/QuestionLengthAnovaDemo'
import { AnswerPositionContingencyDemo } from '../components/stats/demos/AnswerPositionContingencyDemo'
import { QuestionLengthZScoreDemo } from '../components/stats/demos/QuestionLengthZScoreDemo'
import { ResponseTimeDemo } from '../components/stats/demos/ResponseTimeDemo'

export default function Lab() {
  const [activeTab, setActiveTab] = useState<'tos' | 'eda'>('tos')

  return (
    <div className="h-full bg-transparent px-8 pb-8 pt-6 lg:px-12 lg:pb-12 lg:pt-6 overflow-y-auto show-scrollbar w-full flex flex-col gap-6">
      {/* Header */}
      <header className="shrink-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border-base pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <FlaskConical className="text-accent" size={32} />
            <h1 className="font-['Orbitron'] text-3xl lg:text-4xl font-bold text-text-primary tracking-wider uppercase">
              Data Lab
            </h1>
          </div>
          <p className="text-text-muted font-['Rajdhani'] text-lg uppercase tracking-widest">
            {activeTab === 'tos'
              ? 'PRC Table of Specifications Classification & Library Coverage'
              : 'EDA concepts, live on your review data.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-surface rounded-xl border border-border-base shrink-0">
          <button
            onClick={() => setActiveTab('tos')}
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
            onClick={() => setActiveTab('eda')}
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
    </div>
  )
}
