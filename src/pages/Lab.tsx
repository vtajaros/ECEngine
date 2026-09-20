import React from 'react'
import { FlaskConical } from 'lucide-react'
import { ContentCoverageDemo } from '../components/stats/demos/ContentCoverageDemo'
import { QuestionLengthDemo } from '../components/stats/demos/QuestionLengthDemo'
import { AnswerPositionDemo } from '../components/stats/demos/AnswerPositionDemo'
import { QuestionLengthAnovaDemo } from '../components/stats/demos/QuestionLengthAnovaDemo'
import { AnswerPositionContingencyDemo } from '../components/stats/demos/AnswerPositionContingencyDemo'

export default function Lab() {
  return (
    <div className="h-full bg-engine-black px-8 pb-8 pt-6 lg:px-12 lg:pb-12 lg:pt-6 overflow-y-auto show-scrollbar w-full flex flex-col gap-6">
      {/* Header */}
      <header className="shrink-0 flex flex-col gap-1 border-b border-border-base pb-4">
        <div className="flex items-center gap-3">
          <FlaskConical className="text-accent" size={32} />
          <h1 className="font-['Orbitron'] text-3xl lg:text-4xl font-bold text-text-primary tracking-wider uppercase">
            Data Lab
          </h1>
        </div>
        <p className="text-text-muted font-['Rajdhani'] text-lg uppercase tracking-widest">
          EDA concepts, live on your review data.
        </p>
      </header>

      {/* Demos Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <ContentCoverageDemo />
        <QuestionLengthDemo />
        <AnswerPositionDemo />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-6">
        <QuestionLengthAnovaDemo />
        <AnswerPositionContingencyDemo />
      </div>
    </div>
  )
}
