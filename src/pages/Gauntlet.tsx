import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { useGauntletStore, selectCurrentItem, saveSummarySnapshot } from '../store/useGauntletStore'
import { useLayoutStore } from '../store/useLayoutStore'
import { GauntletHome } from '../components/gauntlet/GauntletHome'
import { GauntletSetup } from '../components/gauntlet/GauntletSetup'
import { GauntletCountdown } from '../components/gauntlet/GauntletCountdown'
import { GauntletPauseModal } from '../components/gauntlet/GauntletPauseModal'
import { LeaveConfirmModal } from '../components/ui/LeaveConfirmModal'
import { ExplanationPanel } from '../components/ui/ExplanationPanel'
import { Tooltip } from '../components/ui/Tooltip'
import { LearnMode } from '../components/mcq/LearnMode'
import {
  LearnSettingsModal,
  type LearnSettings,
  loadGauntletLearnSettings,
  saveGauntletLearnSettings,
} from '../components/mcq/LearnSettingsModal'
import { shuffle } from '../lib/scrambler'
import { gauntletService } from '../services/gauntlet.service'
import { dbService } from '../services/db.service'
import { renderMath, renderPlainText, renderQuestionPreview } from '../lib/latex'
import { SUBJECT_LINE_COLOR } from '../lib/dashboardUtils'
import { formatTosBadge, getTosTopicGroupsBySubject } from '../lib/tosClassification'
import type { Card, MCQData, Subject } from '../types'
import type { QueueItem } from '../store/useGauntletStore'
import { AnimatePresence } from 'framer-motion'
import Toast from '../components/ui/Toast'
import { GetContextDropdown } from '../components/ui/GetContextDropdown'
import { useSound } from '../hooks/useSound'
import { useGauntletMusic, getTimedMusicRegion, getSurvivalMusicRegion } from '../hooks/useGauntletMusic'
import { VolumeControl } from '../components/ui/VolumeControl'
import {
  formatRunDuration,
  getSharedTopicPartnerSubject,
  GAUNTLET_SUBJECTS,
  TIMED_QUESTION_CAP_SEC,
  detectRankUp,
  type RankUpEvent,
  overallRating,
  defaultRating,
  TUNING,
} from '../lib/gauntlet'
import { GauntletRankUpModal } from '../components/gauntlet/GauntletRankUpModal'
import {
  Timer,
  Clock,
  Heart,
  XCircle,
  SkipForward,
  Award,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Copy,
  Sparkles,
  RotateCcw,
  SlidersHorizontal,
  Home,
  X,
  Brain,
  BookOpen,
  Settings2,
  Flag,
  Folder,
  Tag,
  Search,
  Loader2,
} from 'lucide-react'

export const LINGER_CORRECT_MS = 1800
export const LINGER_WRONG_MS = 1800
export const LINGER_SKIP_MS = 1800

// TEMP: replaced by GauntletPlay / GauntletSummary in Phase 2B-2 / 2B-3
interface RunPlaceholderProps {
  onOpenPause: () => void
  isModalOpen: boolean
  learnModeScope?: 'missed' | 'all' | null
  setLearnModeScope?: (val: 'missed' | 'all' | null) => void
  isLearningMissed?: boolean
  setIsLearningMissed?: (val: boolean) => void
}

interface RevealState {
  chosen: number | null
  correctIndex: number
  isWrong: boolean
  item: QueueItem
  mcq: MCQData
}

const RunPlaceholder: React.FC<RunPlaceholderProps> = ({
  onOpenPause,
  isModalOpen,
  learnModeScope = null,
  setLearnModeScope,
  isLearningMissed = false,
  setIsLearningMissed,
}) => {
  const phase = useGauntletStore(s => s.phase)
  const config = useGauntletStore(s => s.config)
  const score = useGauntletStore(s => s.score)
  const streak = useGauntletStore(s => s.streak)
  const bestStreak = useGauntletStore(s => s.bestStreak)
  const livesLeft = useGauntletStore(s => s.livesLeft)
  const index = useGauntletStore(s => s.index)
  const queue = useGauntletStore(s => s.queue)
  const endsAt = useGauntletStore(s => s.endsAt)
  const questionShownAt = useGauntletStore(s => s.questionShownAt)
  const endReason = useGauntletStore(s => s.endReason)
  const savedRunId = useGauntletStore(s => s.savedRunId)
  const saveError = useGauntletStore(s => s.saveError)
  const rated = useGauntletStore(s => s.rated)
  const ratingsBefore = useGauntletStore(s => s.ratingsBefore)
  const ratings = useGauntletStore(s => s.ratings)
  const answers = useGauntletStore(s => s.answers)
  const durationMs = useGauntletStore(s => s.durationMs)
  const summarySoundPlayed = useGauntletStore(s => s.summarySoundPlayed)
  const rankUpShown = useGauntletStore(s => s.rankUpShown)

  const answer = useGauntletStore(s => s.answer)
  const skip = useGauntletStore(s => s.skip)
  const extendLinger = useGauntletStore(s => s.extendLinger)
  const skipsAvailable = useGauntletStore(s => s.skipsAvailable)
  const startRun = useGauntletStore(s => s.startRun)
  const openSetup = useGauntletStore(s => s.openSetup)
  const backToHome = useGauntletStore(s => s.backToHome)
  const feedback = useGauntletStore(s => s.feedback)
  const { play } = useSound()
  const music = useGauntletMusic()

  const [now, setNow] = useState(Date.now())
  const [revealState, setRevealState] = useState<RevealState | null>(null)
  const [shakeWrong, setShakeWrong] = useState(false)
  const [pulseHeart, setPulseHeart] = useState(false)

  const isUnlimitedSurvival = config.mode === 'survival' && config.perQuestionSec === 0
  const timeRemainingSec =
    config.mode === 'timed'
      ? Math.max(0, Math.ceil(((endsAt ?? 0) - now) / 1000))
      : isUnlimitedSurvival
      ? Math.floor((now - questionShownAt) / 1000)
      : Math.max(0, Math.ceil((config.perQuestionSec * 1000 - (now - questionShownAt)) / 1000))

  const timedQuestionRemainingSec =
    config.mode === 'timed'
      ? Math.max(0, Math.ceil((TIMED_QUESTION_CAP_SEC * 1000 - (now - questionShownAt)) / 1000))
      : 0
  const isUrgentQuestionCap =
    config.mode === 'timed' && timedQuestionRemainingSec <= 5

  // Rank-up splash state when transitioning to summary with promotions
  const [rankUpEvents, setRankUpEvents] = useState<RankUpEvent[]>([])
  const [currentRankUpIndex, setCurrentRankUpIndex] = useState(0)

  useEffect(() => {
    if (phase !== 'summary' || !rated) {
      if (phase !== 'summary') {
        setRankUpEvents([])
        setCurrentRankUpIndex(0)
      }
      return
    }

    if (rankUpShown) return

    useGauntletStore.setState({ rankUpShown: true })
    saveSummarySnapshot({ ...useGauntletStore.getState(), rankUpShown: true })

    const events: RankUpEvent[] = []
    // 1. Check each subject that was played or changed rating
    for (const s of GAUNTLET_SUBJECTS) {
      const before = ratingsBefore[s]?.rating ?? defaultRating().rating
      const after = ratings[s]?.rating ?? defaultRating().rating
      if (after > before) {
        const ev = detectRankUp(before, after, s)
        if (ev.isRankUp) {
          events.push(ev)
        }
      }
    }
    // 2. Also check overall rating rank up
    const overallBefore = overallRating(ratingsBefore).rating
    const overallAfter = overallRating(ratings).rating
    if (overallAfter > overallBefore) {
      const evOverall = detectRankUp(overallBefore, overallAfter)
      if (evOverall.isRankUp && !events.some(e => e.newTier.name === evOverall.newTier.name)) {
        events.push(evOverall)
      }
    }

    if (events.length > 0) {
      setRankUpEvents(events)
      setCurrentRankUpIndex(0)
    }
  }, [phase, rated, rankUpShown, ratingsBefore, ratings])

  // Summary review state (declared unconditionally at top of component)
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'wrong' | 'skipped_timeout' | 'correct'>('all')
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'all'>('all')
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null)
  const [explainingSeq, setExplainingSeq] = useState<number | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('Context copied to clipboard — paste into Gemini, ChatGPT, or Claude')
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  const [flaggedMap, setFlaggedMap] = useState<Record<string, { reason: string | null; flaggedAt: number }>>({})
  const [flagModalCard, setFlagModalCard] = useState<{ id: string; question: string } | null>(null)

  // Learn Settings state for Gauntlet summary
  const [learnSettings, setLearnSettings] = useState<LearnSettings>(loadGauntletLearnSettings)
  const [settingsModalScope, setSettingsModalScope] = useState<'missed' | 'all' | null>(null)
  const [preparedLearnCards, setPreparedLearnCards] = useState<Card[] | null>(null)

  const handleSettingsChange = (newSettings: LearnSettings) => {
    setLearnSettings(newSettings)
    saveGauntletLearnSettings(newSettings)
  }

  const handleOpenSettings = (scope: 'missed' | 'all') => {
    setSettingsModalScope(scope)
  }

  // TOS category editing state (in review summary)
  const [editingCategoryCardId, setEditingCategoryCardId] = useState<string | null>(null)
  const [categorySearch, setCategorySearch] = useState('')
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null)
  const [tosTopicOverrides, setTosTopicOverrides] = useState<Record<string, string | null>>({})
  const categoryPopoverRef = useRef<HTMLDivElement | null>(null)

  const missedCards = useMemo(() => {
    const map = new Map<string, Card>()
    for (const a of answers) {
      if (a.outcome !== 'correct' && a.item?.card) {
        if (!flaggedMap[a.item.card.id]) {
          map.set(a.item.card.id, a.item.card)
        }
      }
    }
    return Array.from(map.values())
  }, [answers, flaggedMap])

  const allSessionCards = useMemo(() => {
    const map = new Map<string, Card>()
    for (const a of answers) {
      if (a.item?.card) {
        if (!flaggedMap[a.item.card.id]) {
          map.set(a.item.card.id, a.item.card)
        }
      }
    }
    return Array.from(map.values())
  }, [answers, flaggedMap])

  useEffect(() => {
    if (phase !== 'summary' || answers.length === 0) return
    const cardIds = answers.map(a => a.item.card.id)
    if (typeof gauntletService?.getFlaggedQuestions === 'function') {
      const res = gauntletService.getFlaggedQuestions(cardIds)
      if (res && typeof res.then === 'function') {
        res
          .then(map => setFlaggedMap(map || {}))
          .catch(err => console.error('Failed to load flagged questions:', err))
      }
    }
  }, [phase, answers])

  // Close category popover on click outside
  useEffect(() => {
    if (!editingCategoryCardId) return
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryPopoverRef.current && !categoryPopoverRef.current.contains(e.target as Node)) {
        setEditingCategoryCardId(null)
        setCategorySearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingCategoryCardId])

  const handleGetContext = useCallback((mcq: MCQData) => {
    if (!mcq || !Array.isArray(mcq.choices)) return

    const template = `---
Please explain the correct answer to this multiple choice question:

QUESTION:
${mcq.question}

CHOICES:
A. ${mcq.choices[0] ?? ''}
B. ${mcq.choices[1] ?? ''}
C. ${mcq.choices[2] ?? ''}
D. ${mcq.choices[3] ?? ''}

CORRECT ANSWER: ${String.fromCharCode(65 + mcq.answer)}. ${mcq.choices[mcq.answer] ?? ''}

Please explain:
1. Why the correct answer is right
2. Why each of the other choices is wrong
3. Any relevant formula, law, or concept that applies
4. A memory tip or way to remember this for the board exam
---`

    navigator.clipboard.writeText(template).then(() => {
      setToastMessage('Context copied to clipboard — paste into Gemini, ChatGPT, or Claude')
      setShowToast(true)
    })
  }, [])

  const lastSoundRef = useRef<string | null>(null)
  const lastTickSecRef = useRef<number | null>(null)
  const [activeStreakBonus, setActiveStreakBonus] = useState<number | null>(null)
  const streakBonusTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!feedback) return
    if (feedback.streakBonus && feedback.streakBonus > 0) {
      setActiveStreakBonus(feedback.streakBonus)
      if (streakBonusTimerRef.current) clearTimeout(streakBonusTimerRef.current)
      streakBonusTimerRef.current = setTimeout(() => {
        setActiveStreakBonus(null)
      }, 2000)
    }
  }, [feedback])

  useEffect(() => {
    return () => {
      if (streakBonusTimerRef.current) clearTimeout(streakBonusTimerRef.current)
    }
  }, [])

  // Reset tick ref when question index changes
  useEffect(() => {
    lastTickSecRef.current = null
  }, [index])

  // Play 'tick' sound once per integer second at 5, 4, 3, 2, 1 (not 0)
  const tickSec =
    config.mode === 'timed'
      ? (timeRemainingSec <= 5 ? timeRemainingSec : timedQuestionRemainingSec <= 5 ? timedQuestionRemainingSec : null)
      : (!isUnlimitedSurvival && timeRemainingSec <= 5 ? timeRemainingSec : null)

  useEffect(() => {
    if (phase !== 'playing' || revealState !== null || isModalOpen) {
      lastTickSecRef.current = null
      return
    }

    if (tickSec === null || tickSec <= 0 || tickSec > 5) {
      lastTickSecRef.current = null
      return
    }

    if (lastTickSecRef.current !== tickSec) {
      lastTickSecRef.current = tickSec
      play('tick')
    }
  }, [tickSec, phase, revealState, isModalOpen, play])

  // Play sounds on answer reveal and timeout
  useEffect(() => {
    if (!revealState) return
    const key = `reveal-${revealState.item.card.id}-${revealState.chosen}`
    if (lastSoundRef.current === key) return
    lastSoundRef.current = key

    if (revealState.chosen === null) {
      // Skipped: outcome 'skipped' plays no sound
      return
    }
    if (revealState.isWrong) {
      play('wrong')
    } else {
      play('correct')
    }
  }, [revealState, play])

  useEffect(() => {
    if (!feedback) return
    if (feedback.outcome === 'timeout') {
      const key = `timeout-${feedback.id}`
      if (lastSoundRef.current === key) return
      lastSoundRef.current = key
      play('wrong')
    }
  }, [feedback, play])

  // Play plusOne sound when life bonus milestone/streak is triggered
  const lastLifeBonusSoundRef = useRef<string | null>(null)
  useEffect(() => {
    if (!feedback) return
    if (feedback.lifeBonus) {
      const key = `lifeBonus-${feedback.id}`
      if (lastLifeBonusSoundRef.current === key) return
      lastLifeBonusSoundRef.current = key
      play('plusOne')
    }
  }, [feedback, play])

  // Play sound when 5-streak bonus is triggered
  const lastStreakBonusSoundRef = useRef<string | null>(null)
  useEffect(() => {
    if (!feedback) return
    if (feedback.streakBonus && feedback.streakBonus > 0 && !feedback.lifeBonus) {
      const key = `streakBonus-${feedback.id}`
      if (lastStreakBonusSoundRef.current === key) return
      lastStreakBonusSoundRef.current = key
      play('roundComplete')
    }
  }, [feedback, play])

  // Play game over sound when lives run out (summary phase with endReason === 'lives')
  useEffect(() => {
    if (phase !== 'summary') {
      return
    }

    if (summarySoundPlayed) {
      return
    }

    useGauntletStore.setState({ summarySoundPlayed: true })
    saveSummarySnapshot({ ...useGauntletStore.getState(), summarySoundPlayed: true })

    if (endReason === 'lives') {
      play('gameOver')
    }
  }, [phase, endReason, summarySoundPlayed, play])

  // Adaptive background music regions based on run mode, progress, and summary
  const activeScope = learnModeScope ?? (isLearningMissed ? 'missed' : null)
  useEffect(() => {
    if (phase === 'summary') {
      if (activeScope) {
        music.stop()
        return
      }
      music.setState('combatOver')
      music.setLowHealth(false)
      return
    }

    if (phase !== 'playing') {
      music.setLowHealth(false)
      return
    }

    if (config.mode === 'timed') {
      const timeRemainingSec = Math.max(0, ((endsAt ?? 0) - now) / 1000)
      const targetRegion = getTimedMusicRegion(timeRemainingSec, config.durationSec)
      music.setState(targetRegion)
      music.setLowHealth(false)
    } else if (config.mode === 'survival') {
      const targetRegion = getSurvivalMusicRegion(livesLeft, config.lives)
      music.setState(targetRegion)
      music.setLowHealth(livesLeft === 1)
    }
  }, [phase, config.mode, config.durationSec, config.lives, endsAt, now, livesLeft, music])

  const lingerTimerRef = useRef<NodeJS.Timeout | null>(null)
  const shakeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const heartTimerRef = useRef<NodeJS.Timeout | null>(null)
  const prevLivesRef = useRef(livesLeft)

  // Pulse heart on life loss, play plusOne sound on life gain
  useEffect(() => {
    if (prevLivesRef.current > livesLeft) {
      setPulseHeart(true)
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current)
      heartTimerRef.current = setTimeout(() => setPulseHeart(false), 400)
    } else if (prevLivesRef.current < livesLeft && phase === 'playing' && !feedback?.lifeBonus) {
      play('plusOne')
    }
    prevLivesRef.current = livesLeft
  }, [livesLeft, phase, play, feedback])

  // Drive the clock and re-render countdown
  useEffect(() => {
    if (phase !== 'playing') return
    if (revealState === null) {
      setNow(Date.now())
    }
    const intervalId = setInterval(() => {
      // Freeze clock / timeouts while reveal linger is active
      if (revealState !== null) return

      const curNow = Date.now()
      setNow(curNow)
      const s = useGauntletStore.getState()
      if (s.phase !== 'playing' || s.pausedAt !== null) return

      if (s.config.mode === 'timed') {
        if (s.endsAt !== null && curNow >= s.endsAt) {
          s.expire()
        } else if (curNow - s.questionShownAt >= TIMED_QUESTION_CAP_SEC * 1000) {
          s.timeoutCurrent()
        }
      } else if (s.config.mode === 'survival') {
        if (s.config.perQuestionSec > 0 && curNow - s.questionShownAt >= s.config.perQuestionSec * 1000) {
          s.timeoutCurrent()
        }
      }
    }, 250)
    return () => clearInterval(intervalId)
  }, [phase, revealState])

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current)
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current)
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current)
    }
  }, [])

  // Handle answering choice with reveal linger (1800ms)
  const handleAnswer = useCallback(
    (choiceIdx: number) => {
      if (revealState !== null || isModalOpen) return
      const s = useGauntletStore.getState()
      if (s.phase !== 'playing' || s.pausedAt !== null) return
      const item = s.queue[s.index]
      if (!item) return
      const mcq = item.card.data as MCQData
      const isCorrect = choiceIdx === mcq.answer
      const isWrong = !isCorrect
      const lingerMs = isCorrect ? LINGER_CORRECT_MS : LINGER_WRONG_MS

      // Extend timer deadlines so linger consumes zero run time
      extendLinger(lingerMs)

      setRevealState({
        chosen: choiceIdx,
        correctIndex: mcq.answer,
        isWrong,
        item,
        mcq,
      })

      if (isWrong) {
        setShakeWrong(true)
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current)
        shakeTimerRef.current = setTimeout(() => setShakeWrong(false), 350)

        if (s.config.mode === 'survival') {
          setPulseHeart(true)
          if (heartTimerRef.current) clearTimeout(heartTimerRef.current)
          heartTimerRef.current = setTimeout(() => setPulseHeart(false), 400)
        }
      }

      if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current)
      lingerTimerRef.current = setTimeout(() => {
        setRevealState(null)
        setShakeWrong(false)
        setNow(Date.now())
        answer(choiceIdx)
      }, lingerMs)
    },
    [revealState, isModalOpen, extendLinger, answer],
  )

  // Handle skip with 1800ms reveal linger
  const handleSkip = useCallback(() => {
    if (revealState !== null || isModalOpen) return
    const s = useGauntletStore.getState()
    if (s.phase !== 'playing' || s.pausedAt !== null || s.skipsAvailable <= 0) return
    const item = s.queue[s.index]
    if (!item) return
    const mcq = item.card.data as MCQData

    // Extend timer deadlines by LINGER_SKIP_MS
    extendLinger(LINGER_SKIP_MS)

    setRevealState({
      chosen: null,
      correctIndex: mcq.answer,
      isWrong: false,
      item,
      mcq,
    })

    if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current)
    lingerTimerRef.current = setTimeout(() => {
      setRevealState(null)
      setNow(Date.now())
      skip()
    }, LINGER_SKIP_MS)
  }, [revealState, isModalOpen, extendLinger, skip])

  // Keyboard shortcuts 1-4 and A-D
  useEffect(() => {
    if (phase !== 'playing' || isModalOpen || revealState !== null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toUpperCase()
      let choiceIdx: number | null = null
      if (key === 'A' || key === '1') choiceIdx = 0
      else if (key === 'B' || key === '2') choiceIdx = 1
      else if (key === 'C' || key === '3') choiceIdx = 2
      else if (key === 'D' || key === '4') choiceIdx = 3

      if (choiceIdx !== null) {
        const s = useGauntletStore.getState()
        const item = s.queue[s.index]
        const mcq = item?.card.data as MCQData | undefined
        if (mcq && Array.isArray(mcq.choices) && choiceIdx < mcq.choices.length) {
          e.preventDefault()
          handleAnswer(choiceIdx)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, isModalOpen, revealState, handleAnswer])

  const activeCards = activeScope === 'all' ? allSessionCards : missedCards
  const cardsToLearn = preparedLearnCards ?? activeCards
  const modeLabel = config.mode === 'survival' ? 'Survival' : 'Timed'
  const learnTitle =
    activeScope === 'all'
      ? `Gauntlet ${modeLabel} — All Session Items`
      : `Gauntlet ${modeLabel} — Missed Items`

  const handleStartLearn = (scope: 'missed' | 'all') => {
    const baseCards = scope === 'all' ? allSessionCards : missedCards
    const finalCards = learnSettings.shuffleQuestions ? shuffle([...baseCards]) : baseCards
    setPreparedLearnCards(finalCards)
    setLearnModeScope?.(scope)
    setIsLearningMissed?.(true)
  }

  const handleStartFromSettings = () => {
    if (settingsModalScope) {
      const scope = settingsModalScope
      setSettingsModalScope(null)
      handleStartLearn(scope)
    }
  }

  const handleExitLearn = () => {
    setPreparedLearnCards(null)
    setLearnModeScope?.(null)
    setIsLearningMissed?.(false)
  }

  if (phase === 'summary') {
    if (activeScope && cardsToLearn.length > 0) {
      return (
        <div className="w-full h-full flex flex-col">
          <LearnMode
            cards={cardsToLearn}
            title={learnTitle}
            ttsEnabled={learnSettings.ttsEnabled}
            shuffleChoices={learnSettings.shuffleChoices}
            recordProgress={false}
            onComplete={() => {}}
            onExit={handleExitLearn}
          />
        </div>
      )
    }

    const reasonLabels = {
      time: 'Time Expired',
      lives: 'Game Over',
      queue: 'Queue Completed',
      quit: 'Run Forfeited',
    }

    const correctCount = answers.filter(a => a.outcome === 'correct').length
    const wrongCount = answers.filter(a => a.outcome === 'wrong' || a.outcome === 'timeout').length
    const pureWrongCount = answers.filter(a => a.outcome === 'wrong').length
    const skippedCount = answers.filter(a => a.outcome === 'skipped').length
    const skippedTimeoutCount = answers.filter(a => a.outcome === 'skipped' || a.outcome === 'timeout').length

    const filteredAnswers = answers.filter(a => {
      if (outcomeFilter === 'wrong' && a.outcome !== 'wrong') return false
      if (outcomeFilter === 'skipped_timeout' && a.outcome !== 'skipped' && a.outcome !== 'timeout') return false
      if (outcomeFilter === 'correct' && a.outcome !== 'correct') return false
      if (subjectFilter !== 'all' && a.item.subject !== subjectFilter) return false
      return true
    })

    const runDurationMs = durationMs > 0
      ? durationMs
      : answers.reduce((sum, a) => sum + (a.timeMs || 0), 0)

    return (
      <div className="max-w-6xl mx-auto w-full h-full max-h-full bg-surface rounded-2xl p-4 sm:p-5 border border-border-base flex flex-col lg:flex-row gap-4 lg:gap-5 shadow-2xl min-h-0 overflow-y-auto lg:overflow-hidden my-auto">
        {/* LEFT COLUMN: Fixed-width Stats & Actions Sidebar */}
        <div className="lg:w-80 shrink-0 flex flex-col gap-3 min-h-0 lg:overflow-y-auto pr-0.5">
          {/* Header */}
          <div className="text-center">
            <span className="text-[11px] font-['Rajdhani'] font-bold uppercase tracking-widest text-text-muted">
              {config.mode === 'survival' ? 'Survival Session Summary' : 'Gauntlet Run Summary'}
            </span>
            <h2
              className={`font-['Orbitron'] font-bold text-xl sm:text-2xl mt-0.5 tracking-wide ${
                endReason === 'lives' ? 'text-[#FF3333]' : 'text-accent'
              }`}
            >
              {endReason ? reasonLabels[endReason] : 'Run Complete'}
            </h2>
            {config.tosTopicId && (
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-[11px] font-['JetBrains_Mono']">
                  🎯 Topic Focus: {config.tosTopicId} · 0.4x Elo
                </span>
              </div>
            )}
          </div>

          {/* Score & Main Stats + Breakdown */}
          <div className="bg-surface-2 p-2.5 sm:p-3 rounded-xl border border-border-base flex flex-col gap-2">
            {/* Main Stats: 2x2 grid for survival (including Time Spent), 3-col for timed */}
            {config.mode === 'survival' ? (
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block">
                    Final Score
                  </span>
                  <span className="font-['JetBrains_Mono'] font-bold text-lg sm:text-xl text-accent">
                    {score.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block flex items-center justify-center gap-1">
                    <Clock size={10} className="text-text-muted" />
                    Time Spent
                  </span>
                  <span className="font-['JetBrains_Mono'] font-bold text-base sm:text-lg text-white">
                    {formatRunDuration(runDurationMs)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block">
                    Accuracy
                  </span>
                  <span className="font-['JetBrains_Mono'] font-bold text-base sm:text-lg text-text-primary">
                    {correctCount}/{answers.length}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block">
                    Best Streak
                  </span>
                  <span className="font-['JetBrains_Mono'] font-bold text-base sm:text-lg text-text-primary">
                    {bestStreak}
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block">
                    Final Score
                  </span>
                  <span className="font-['JetBrains_Mono'] font-bold text-xl sm:text-2xl text-accent">
                    {score.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block">
                    Accuracy
                  </span>
                  <span className="font-['JetBrains_Mono'] font-bold text-base sm:text-lg text-text-primary">
                    {correctCount}/{answers.length}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block">
                    Best Streak
                  </span>
                  <span className="font-['JetBrains_Mono'] font-bold text-base sm:text-lg text-text-primary">
                    {bestStreak}
                  </span>
                </div>
              </div>
            )}

            {/* Answer Breakdown Sub-row */}
            <div className="flex items-center justify-around text-[11px] sm:text-xs font-['JetBrains_Mono'] pt-1.5 border-t border-border-base/40">
              <span className="text-[#00FF41]">✓ {correctCount} Correct</span>
              <span className="text-[#ef4444]">✗ {wrongCount} Wrong</span>
              <span className="text-text-muted">↷ {skippedCount} Skipped</span>
            </div>
          </div>

          {/* Rating Deltas (if rated) */}
          {rated ? (
            <div className="flex flex-col gap-2 bg-surface-2/40 p-3 rounded-xl border border-border-base">
              <span className="text-[11px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Award size={13} className="text-accent" />
                Rating Changes
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                {GAUNTLET_SUBJECTS.filter(
                  s => config.subjects.includes(s) || (ratings[s]?.rating !== ratingsBefore[s]?.rating)
                ).map(s => {
                  const before = Math.round(ratingsBefore[s]?.rating ?? 1000)
                  const after = Math.round(ratings[s]?.rating ?? 1000)
                  const delta = after - before
                  const color = SUBJECT_LINE_COLOR[s]
                  const isSharedGain = !config.subjects.includes(s)
                  return (
                    <div key={s} className="flex items-center justify-between p-1.5 sm:p-2 rounded bg-surface border border-border-base text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-['Orbitron'] font-bold" style={{ color }}>{s}</span>
                        {isSharedGain && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-['Rajdhani'] font-bold text-accent bg-accent/10 border border-accent/30 uppercase">
                            Shared Topic
                          </span>
                        )}
                      </div>
                      <span className="font-['JetBrains_Mono'] text-text-primary">
                        {before} → {after}{' '}
                        <strong className={delta >= 0 ? 'text-[#00FF41]' : 'text-[#ef4444]'}>
                          ({delta >= 0 ? `+${delta}` : delta})
                        </strong>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-2 text-text-muted font-['Rajdhani'] text-xs uppercase tracking-wider">
              Unranked • Ratings Unchanged
            </div>
          )}

          {/* Save Status */}
          {savedRunId && (
            <div className="flex items-center justify-center gap-1.5 text-xs font-['JetBrains_Mono'] text-[#00FF41]">
              <CheckCircle2 size={13} />
              Run saved successfully
            </div>
          )}
          {/* Problem Topics in Run */}
          {(() => {
            const topicStats = new Map<string, { total: number; wrong: number }>()
            for (const a of answers) {
              const tid = a.item.card.tosTopicId
              if (!tid) continue
              const curr = topicStats.get(tid) || { total: 0, wrong: 0 }
              curr.total++
              if (a.outcome === 'wrong' || a.outcome === 'timeout') curr.wrong++
              topicStats.set(tid, curr)
            }
            const weakInRun = Array.from(topicStats.entries())
              .filter(([_, s]) => s.wrong > 0)
              .sort((a, b) => b[1].wrong - a[1].wrong)
              .slice(0, 3)

            if (weakInRun.length === 0) return null

            return (
              <div className="flex flex-col gap-1.5 bg-surface-2/40 p-2.5 rounded-xl border border-border-base">
                <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-warn flex items-center gap-1.5">
                  <AlertCircle size={12} className="text-warn" />
                  Struggling Topics (Focus Area)
                </span>
                <div className="flex flex-col gap-1">
                  {weakInRun.map(([tid, s]) => (
                    <div key={tid} className="flex items-center justify-between text-[11px] font-['JetBrains_Mono'] bg-surface px-2 py-1 rounded border border-border-base/50">
                      <Tooltip content={formatTosBadge(tid) || tid} position="top">
                        <span className="text-text-primary truncate max-w-[170px] cursor-default">
                          {formatTosBadge(tid) || tid}
                        </span>
                      </Tooltip>
                      <span className="text-danger font-bold shrink-0">
                        {s.wrong}/{s.total} missed
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Action Buttons: Stacked vertically in Left Sidebar */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border-base mt-auto">
            {missedCards.length > 0 && (
              <div className="flex items-center gap-1.5 w-full">
                <button
                  type="button"
                  data-testid="learn-missed-button"
                  onClick={() => handleStartLearn('missed')}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-accent text-black font-bold font-['Orbitron'] tracking-wider text-xs sm:text-sm hover:bg-[#00e63a] transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,255,65,0.25)]"
                >
                  <Brain size={14} />
                  LEARN MISSED ({missedCards.length})
                </button>
                <button
                  type="button"
                  data-testid="learn-missed-settings-button"
                  onClick={() => handleOpenSettings('missed')}
                  aria-label="Learn Missed Settings"
                  title="Learn Missed Settings"
                  className="self-stretch px-3 rounded-xl bg-surface-2 border border-border-base hover:border-accent text-text-muted hover:text-accent transition-all flex items-center justify-center shrink-0"
                >
                  <Settings2 size={16} />
                </button>
              </div>
            )}
            {allSessionCards.length > 0 && (
              <div className="flex items-center gap-1.5 w-full">
                <button
                  type="button"
                  data-testid="learn-all-button"
                  onClick={() => handleStartLearn('all')}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-bold font-['Orbitron'] tracking-wider text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
                    missedCards.length === 0
                      ? 'bg-accent text-black hover:bg-[#00e63a] shadow-[0_0_15px_rgba(0,255,65,0.25)]'
                      : 'bg-surface-2 border border-border-base hover:border-accent text-text-primary hover:text-accent'
                  }`}
                >
                  <BookOpen size={14} />
                  LEARN ALL ({allSessionCards.length})
                </button>
                <button
                  type="button"
                  data-testid="learn-all-settings-button"
                  onClick={() => handleOpenSettings('all')}
                  aria-label="Learn All Settings"
                  title="Learn All Settings"
                  className="self-stretch px-3 rounded-xl bg-surface-2 border border-border-base hover:border-accent text-text-muted hover:text-accent transition-all flex items-center justify-center shrink-0"
                >
                  <Settings2 size={16} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => void startRun(config)}
              className="w-full py-2.5 px-4 rounded-xl font-bold font-['Orbitron'] tracking-wider text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 bg-surface-2 border border-border-base hover:border-accent text-text-primary"
            >
              <RotateCcw size={14} />
              RUN IT BACK
            </button>
            <button
              type="button"
              onClick={() => openSetup(config.mode)}
              className="w-full py-2.5 px-4 rounded-xl bg-surface-2 border border-border-base hover:border-accent text-text-primary font-bold font-['Orbitron'] tracking-wider text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <SlidersHorizontal size={14} />
              NEW CONFIG
            </button>
            <button
              type="button"
              onClick={() => void backToHome()}
              className="w-full py-2.5 px-4 rounded-xl bg-surface border border-border-base hover:border-[#666] text-text-muted hover:text-white font-bold font-['Orbitron'] tracking-wider text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <Home size={14} />
              BACK TO HOME
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Pinned Filter Bar + Full-Height Scrollable Review List */}
        <div className="flex-1 min-w-0 flex flex-col gap-2.5 min-h-0 border-t lg:border-t-0 lg:border-l border-border-base/70 pt-3 lg:pt-0 lg:pl-5">
          {/* Pinned Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-base/50 pb-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
                Answer Review ({filteredAnswers.length}/{answers.length})
              </span>
              {missedCards.length > 0 && (
                <div className="inline-flex items-stretch rounded">
                  <button
                    type="button"
                    data-testid="learn-missed-header-button"
                    onClick={() => handleStartLearn('missed')}
                    className="px-2 py-0.5 rounded-l text-[10px] font-['Orbitron'] font-bold bg-accent/15 border-y border-l border-accent/40 text-accent hover:bg-accent/25 transition-colors flex items-center gap-1"
                  >
                    <Brain size={11} />
                    Learn {missedCards.length} Missed
                  </button>
                  <button
                    type="button"
                    data-testid="learn-missed-header-settings-button"
                    onClick={() => handleOpenSettings('missed')}
                    aria-label="Learn Missed Settings"
                    title="Learn Missed Settings"
                    className="px-1.5 py-0.5 rounded-r border border-accent/40 bg-accent/15 text-accent hover:bg-accent/25 transition-colors flex items-center justify-center"
                  >
                    <Settings2 size={10} />
                  </button>
                </div>
              )}
              {allSessionCards.length > 0 && (
                <div className="inline-flex items-stretch rounded">
                  <button
                    type="button"
                    data-testid="learn-all-header-button"
                    onClick={() => handleStartLearn('all')}
                    className="px-2 py-0.5 rounded-l text-[10px] font-['Orbitron'] font-bold bg-surface-2 border-y border-l border-border-base hover:border-accent text-text-muted hover:text-accent transition-colors flex items-center gap-1"
                  >
                    <BookOpen size={11} />
                    Learn All ({allSessionCards.length})
                  </button>
                  <button
                    type="button"
                    data-testid="learn-all-header-settings-button"
                    onClick={() => handleOpenSettings('all')}
                    aria-label="Learn All Settings"
                    title="Learn All Settings"
                    className="px-1.5 py-0.5 rounded-r border border-border-base hover:border-accent text-text-muted hover:text-accent bg-surface-2 transition-colors flex items-center justify-center"
                  >
                    <Settings2 size={10} />
                  </button>
                </div>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Outcome Filter Tabs */}
              <div className="inline-flex rounded-lg bg-surface-2 p-0.5 border border-border-base text-[11px] font-['Rajdhani'] font-bold">
                <button
                  type="button"
                  onClick={() => setOutcomeFilter('all')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    outcomeFilter === 'all'
                      ? 'bg-accent text-black font-extrabold shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  All ({answers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOutcomeFilter('wrong')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    outcomeFilter === 'wrong'
                      ? 'bg-[#ef4444] text-white font-extrabold shadow-sm'
                      : 'text-text-muted hover:text-[#ef4444]'
                  }`}
                >
                  Wrong ({pureWrongCount})
                </button>
                <button
                  type="button"
                  onClick={() => setOutcomeFilter('skipped_timeout')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    outcomeFilter === 'skipped_timeout'
                      ? 'bg-[#f59e0b] text-black font-extrabold shadow-sm'
                      : 'text-text-muted hover:text-[#f59e0b]'
                  }`}
                >
                  Skip/Time ({skippedTimeoutCount})
                </button>
                <button
                  type="button"
                  onClick={() => setOutcomeFilter('correct')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    outcomeFilter === 'correct'
                      ? 'bg-[#00FF41] text-black font-extrabold shadow-sm'
                      : 'text-text-muted hover:text-[#00FF41]'
                  }`}
                >
                  Correct ({correctCount})
                </button>
              </div>

              {/* Subject Filter Chips */}
              {config.subjects.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSubjectFilter('all')}
                    className={`px-2 py-0.5 rounded text-[10px] font-['Orbitron'] font-bold border transition-colors ${
                      subjectFilter === 'all'
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border-base bg-surface-2 text-text-muted hover:text-white'
                    }`}
                  >
                    ALL
                  </button>
                  {config.subjects.map(sub => {
                    const subColor = SUBJECT_LINE_COLOR[sub]
                    const isSelected = subjectFilter === sub
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setSubjectFilter(sub)}
                        className="px-2 py-0.5 rounded text-[10px] font-['Orbitron'] font-bold border transition-colors"
                        style={{
                          borderColor: isSelected ? subColor : 'rgba(255,255,255,0.1)',
                          backgroundColor: isSelected ? `${subColor}22` : undefined,
                          color: isSelected ? subColor : '#888',
                        }}
                      >
                        {sub}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Full-Height Scrollable Answers List */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-2">
            {filteredAnswers.length === 0 ? (
              <div className="py-6 text-center text-text-muted font-['Rajdhani'] text-xs uppercase tracking-wider">
                No answers match the selected filter
              </div>
            ) : (
              filteredAnswers.map(a => {
                const mcq = a.item.card.data as MCQData
                const isExpanded = expandedSeq === a.seq
                const isSlow = a.timeMs > 1.5 * a.item.parMs
                const isTooFast = a.outcome === 'wrong' && a.timeMs < 0.25 * a.item.parMs

                const correctLetter = String.fromCharCode(65 + mcq.answer)
                const pickedLetter = a.chosen !== null ? String.fromCharCode(65 + a.chosen) : '—'

                return (
                  <div
                    key={a.seq}
                    data-testid={`review-row-${a.seq}`}
                    className={`rounded-xl border transition-all ${
                      isExpanded
                        ? 'bg-surface-2 border-accent/60 shadow-md'
                        : 'bg-surface-2/60 hover:bg-surface-2 border-border-base'
                    }`}
                  >
                    {/* Summary Row */}
                    <div
                      data-testid={`review-row-summary-${a.seq}`}
                      className="p-3 flex items-center justify-between gap-2.5 cursor-pointer select-none"
                      onClick={() => setExpandedSeq(isExpanded ? null : a.seq)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Sequence */}
                        <span className="font-['JetBrains_Mono'] text-xs font-bold text-text-muted shrink-0 w-6">
                          #{a.seq + 1}
                        </span>

                        {/* Subject Badge */}
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-['Orbitron'] font-bold shrink-0"
                          style={{
                            color: SUBJECT_LINE_COLOR[a.item.subject],
                            border: `1px solid ${SUBJECT_LINE_COLOR[a.item.subject]}`,
                          }}
                        >
                          {a.item.subject}
                        </span>

                        {(() => {
                          const partner = getSharedTopicPartnerSubject(
                            a.item.subject,
                            a.item.card.tosTopicId,
                            a.item.card.tags
                          )
                          if (!partner) return null
                          const partnerColor = SUBJECT_LINE_COLOR[partner as keyof typeof SUBJECT_LINE_COLOR] ?? '#888'
                          return (
                            <Tooltip content={`Shared topic with ${partner}: Elo split 50/50`} position="top">
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-['Orbitron'] font-bold shrink-0 cursor-default"
                                style={{
                                  color: partnerColor,
                                  borderWidth: 1,
                                  borderStyle: 'solid',
                                  borderColor: `${partnerColor}66`,
                                  backgroundColor: `${partnerColor}18`,
                                }}
                              >
                                +{partner}
                              </span>
                            </Tooltip>
                          )
                        })()}

                        {(() => {
                          const effectiveTosId = tosTopicOverrides.hasOwnProperty(a.item.card.id)
                            ? tosTopicOverrides[a.item.card.id]
                            : a.item.card.tosTopicId
                          const tosLabel = effectiveTosId ? (formatTosBadge(effectiveTosId) || effectiveTosId) : null
                          return effectiveTosId ? (
                            <Tooltip content={tosLabel || effectiveTosId!} position="top">
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-['JetBrains_Mono'] font-bold border border-border-base bg-[#181818] text-[#888] shrink-0 cursor-default"
                              >
                                {effectiveTosId}
                              </span>
                            </Tooltip>
                          ) : null
                        })()}

                        {/* Deck & Card Location Badge */}
                        {a.item.card.deckName && (
                          <Tooltip
                            content={`Deck: ${a.item.card.deckName} • Card #${a.item.card.cardNumber ?? '?'}${a.item.card.totalInDeck ? `/${a.item.card.totalInDeck}` : ''}`}
                            position="top"
                          >
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-['JetBrains_Mono'] font-medium border border-border-base bg-[#141414] text-[#aaa] shrink-0 flex items-center gap-1 max-w-[130px] sm:max-w-[170px] cursor-default">
                              <Folder size={10} className="text-text-muted shrink-0" />
                              <span className="truncate">{a.item.card.deckName}</span>
                              <span className="text-accent shrink-0 font-bold">
                                #{a.item.card.cardNumber ?? '?'}
                              </span>
                            </span>
                          </Tooltip>
                        )}

                        {/* Outcome Icon */}
                        <span className="shrink-0">
                          {a.outcome === 'correct' && (
                            <CheckCircle2 size={16} className="text-[#00FF41]" />
                          )}
                          {a.outcome === 'wrong' && (
                            <XCircle size={16} className="text-[#ef4444]" />
                          )}
                          {a.outcome === 'skipped' && (
                            <SkipForward size={16} className="text-text-muted" />
                          )}
                          {a.outcome === 'timeout' && (
                            <Timer size={16} className="text-[#ef4444]" />
                          )}
                        </span>

                        {/* Truncated Question Text */}
                        <span
                          className="font-['Rajdhani'] font-semibold text-xs sm:text-sm text-text-primary truncate flex-1 min-w-0 [&_*]:inline"
                          dangerouslySetInnerHTML={{ __html: renderQuestionPreview(mcq.question ?? '') }}
                        />
                      </div>

                      {/* Right Meta Info */}
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-xs font-['JetBrains_Mono']">
                        {/* Choice Comparison */}
                        <div className="flex items-center gap-1 font-bold">
                          {a.outcome === 'correct' ? (
                            <span className="text-[#00FF41]">{correctLetter}</span>
                          ) : (
                            <>
                              <span className={a.chosen !== null ? 'text-[#ef4444]' : 'text-text-muted'}>
                                {pickedLetter}
                              </span>
                              <span className="text-text-muted text-[10px]">→</span>
                              <span className="text-[#00FF41]">{correctLetter}</span>
                            </>
                          )}
                        </div>

                        {/* Time vs Par */}
                        <span className="text-text-muted hidden sm:inline text-[11px]">
                          {(a.timeMs / 1000).toFixed(1)}s / {Math.round(a.item.parMs / 1000)}s
                        </span>

                        {/* Markers: SLOW / TOO FAST */}
                        {isSlow && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-['Orbitron'] font-bold bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30">
                            SLOW
                          </span>
                        )}
                        {isTooFast && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-['Orbitron'] font-bold bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30">
                            TOO FAST
                          </span>
                        )}
                        {flaggedMap[a.item.card.id] && (
                          <Tooltip content={flaggedMap[a.item.card.id]?.reason ? `Flagged: ${flaggedMap[a.item.card.id].reason}` : 'Flagged (Excluded from Gauntlet)'} position="top">
                            <span
                              data-testid={`flag-badge-${a.seq}`}
                              className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-['Orbitron'] font-bold bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30 flex items-center gap-1 cursor-default"
                            >
                              <Flag size={9} className="fill-[#ef4444]" />
                              FLAGGED
                            </span>
                          </Tooltip>
                        )}

                        {/* Points */}
                        <div className="flex items-center gap-1.5 justify-end">
                          {a.streakBonus && a.streakBonus > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-['Orbitron'] font-bold text-[#f59e0b] bg-[#f59e0b]/15 border border-[#f59e0b]/30">
                              +{a.streakBonus} STREAK
                            </span>
                          )}
                          <span
                            className={`font-bold w-12 text-right ${
                              a.points > 0
                                ? 'text-[#00FF41]'
                                : a.points < 0
                                ? 'text-[#ef4444]'
                                : 'text-text-muted'
                            }`}
                          >
                            {a.points > 0 ? `+${a.points}` : a.points}
                          </span>
                        </div>

                        {/* Expand Chevron */}
                        <ChevronDown
                          size={14}
                          className={`text-text-muted transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-border-base/60 flex flex-col gap-3">
                        {/* Deck Location Header */}
                        {a.item.card.deckName && (
                          <div className="flex items-center gap-2 text-xs font-['JetBrains_Mono'] text-text-muted pt-1">
                            <span className="flex items-center gap-1.5 text-accent font-semibold">
                              <Folder size={13} className="text-accent shrink-0" />
                              {a.item.card.deckName}
                            </span>
                            <span>•</span>
                            <span className="text-white font-medium">
                              Card #{a.item.card.cardNumber ?? '?'}{a.item.card.totalInDeck ? ` of ${a.item.card.totalInDeck}` : ''}
                            </span>
                          </div>
                        )}

                        {/* Full Question Text */}
                        <div
                          className="text-white font-['Rajdhani'] font-semibold text-sm sm:text-base leading-relaxed whitespace-pre-wrap mcq-question-text"
                          dangerouslySetInnerHTML={{ __html: renderMath(mcq.question ?? '') }}
                        />

                        {/* Question Diagram */}
                        {mcq.imagePath && (
                          <div className="max-w-md max-h-[220px] flex justify-center overflow-hidden rounded-lg border border-[#333] shadow-md my-1">
                            <img
                              src={`ece-app://${mcq.imagePath}`}
                              alt="Question diagram"
                              className="max-h-[220px] object-contain cursor-zoom-in"
                              onClick={e => {
                                e.stopPropagation()
                                setZoomedImage(mcq.imagePath!)
                              }}
                            />
                          </div>
                        )}

                        {/* Choices Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-1">
                          {Array.isArray(mcq.choices) &&
                            mcq.choices.map((choice, idx) => {
                              const isCorrect = idx === mcq.answer
                              const isPicked = a.chosen === idx
                              const renderFn = mcq.choicesPlainText?.[idx] ? renderPlainText : renderMath
                              const letter = String.fromCharCode(65 + idx)

                              let btnClass = 'border-[#222] bg-[#0e0e0e] text-[#555] opacity-60'
                              let badgeClass = 'border-[#333] text-[#444] bg-[#0a0a0a]'
                              let textClass = 'text-[#666]'

                              if (isCorrect) {
                                btnClass =
                                  'border-[#00FF41] bg-[rgba(0,255,65,0.08)] text-white shadow-[0_0_12px_rgba(0,255,65,0.15)]'
                                badgeClass = 'bg-[#00FF41] text-[#0D0D0D] border-[#00FF41] font-bold'
                                textClass = 'text-white font-semibold'
                              } else if (isPicked) {
                                btnClass =
                                  'border-[#ef4444] bg-[rgba(255,51,51,0.08)] text-[#ddd]'
                                badgeClass = 'bg-[#ef4444] text-[#0D0D0D] border-[#ef4444] font-bold'
                                textClass = 'text-[#aaa]'
                              }

                              let orderClass = ''
                              if (idx === 0) orderClass = 'order-1'
                              else if (idx === 1) orderClass = 'order-2 sm:order-3'
                              else if (idx === 2) orderClass = 'order-3 sm:order-2'
                              else if (idx === 3) orderClass = 'order-4'

                              return (
                                <div
                                  key={idx}
                                  className={`p-2.5 rounded-lg border flex items-center gap-2.5 text-xs font-['Rajdhani'] ${btnClass} ${orderClass}`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[11px] shrink-0 border ${badgeClass}`}
                                  >
                                    {letter}
                                  </span>
                                  <span
                                    className={`flex-1 break-words leading-snug mcq-choice-text ${textClass}`}
                                    dangerouslySetInnerHTML={{ __html: renderFn(choice) }}
                                  />
                                  {isCorrect && (
                                    <CheckCircle2 className="text-[#00FF41] shrink-0" size={16} />
                                  )}
                                  {isPicked && !isCorrect && (
                                    <XCircle className="text-[#ef4444] shrink-0" size={16} />
                                  )}
                                </div>
                              )
                            })}
                        </div>

                        {/* Solution Diagram */}
                        {mcq.solutionImagePath && (
                          <div className="p-3 bg-surface rounded-lg border border-border-base">
                            <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-text-muted block mb-1">
                              Solution Diagram
                            </span>
                            <div className="max-w-md max-h-[200px] flex justify-center overflow-hidden rounded border border-[#333]">
                              <img
                                src={`ece-app://${mcq.solutionImagePath}`}
                                alt="Solution diagram"
                                className="max-h-[200px] object-contain cursor-zoom-in"
                                onClick={e => {
                                  e.stopPropagation()
                                  setZoomedImage(mcq.solutionImagePath!)
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Explanation Text */}
                        {mcq.explanation && (
                          <div className="p-3 bg-surface rounded-lg border border-border-base">
                            <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-text-muted block mb-1">
                              Explanation
                            </span>
                            <div
                              className="text-text-primary text-xs font-['Rajdhani'] leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: renderMath(mcq.explanation) }}
                            />
                          </div>
                        )}

                        {/* TOS Category Changer */}
                        {(() => {
                          const cardId = a.item.card.id
                          const subject = a.item.subject
                          const currentTosId = tosTopicOverrides.hasOwnProperty(cardId)
                            ? tosTopicOverrides[cardId]
                            : a.item.card.tosTopicId
                          const isEditing = editingCategoryCardId === cardId
                          const isSaving = savingCategoryId === cardId

                          const topicGroups = isEditing
                            ? (() => {
                                const groups = getTosTopicGroupsBySubject(subject)
                                if (!categorySearch.trim()) return groups
                                const q = categorySearch.toLowerCase()
                                return groups
                                  .map((g) => ({
                                    ...g,
                                    subtopics: g.subtopics.filter(
                                      (st) =>
                                        st.code.toLowerCase().includes(q) ||
                                        st.name.toLowerCase().includes(q) ||
                                        st.title.toLowerCase().includes(q) ||
                                        st.id.toLowerCase().includes(q) ||
                                        g.parent.name.toLowerCase().includes(q)
                                    ),
                                  }))
                                  .filter((g) => g.subtopics.length > 0 || g.parent.name.toLowerCase().includes(q))
                              })()
                            : []

                          const handleSelectCategory = async (newTosTopicId: string | null) => {
                            setSavingCategoryId(cardId)
                            try {
                              await dbService.decks.batchUpdateCardTosTopic([{ id: cardId, tos_topic_id: newTosTopicId }])
                              setTosTopicOverrides(prev => ({ ...prev, [cardId]: newTosTopicId }))
                              setEditingCategoryCardId(null)
                              setCategorySearch('')
                              setToastMessage('TOS category updated')
                              setShowToast(true)
                            } catch (err) {
                              console.error('Failed to update TOS category:', err)
                            } finally {
                              setSavingCategoryId(null)
                            }
                          }

                          return (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (isEditing) {
                                    setEditingCategoryCardId(null)
                                    setCategorySearch('')
                                  } else {
                                    setEditingCategoryCardId(cardId)
                                    setCategorySearch('')
                                  }
                                }}
                                className={`px-2.5 py-1 rounded text-xs font-['Rajdhani'] font-bold flex items-center gap-1.5 transition-colors ${
                                  isEditing
                                    ? 'bg-accent/15 border border-accent/60 text-accent'
                                    : 'bg-surface border border-border-base hover:border-accent text-text-muted hover:text-accent'
                                }`}
                              >
                                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Tag size={12} />}
                                {currentTosId ? `Change Category (${currentTosId})` : 'Assign Category'}
                              </button>

                              {isEditing && (
                                <div
                                  ref={categoryPopoverRef}
                                  className="absolute z-50 bottom-full mb-2 left-0 w-72 bg-[#111] border border-[#333] rounded-xl shadow-2xl overflow-hidden"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* Search */}
                                  <div className="p-2 border-b border-[#222] flex items-center gap-2">
                                    <Search size={12} className="text-text-muted shrink-0" />
                                    <input
                                      autoFocus
                                      type="text"
                                      placeholder="Search topics…"
                                      value={categorySearch}
                                      onChange={(e) => setCategorySearch(e.target.value)}
                                      className="flex-1 bg-transparent text-[11px] text-text-primary font-['JetBrains_Mono'] outline-none placeholder-[#444]"
                                    />
                                  </div>

                                  {/* Clear option */}
                                  {currentTosId && (
                                    <button
                                      type="button"
                                      onClick={() => void handleSelectCategory(null)}
                                      className="w-full px-3 py-1.5 text-left text-[11px] font-['JetBrains_Mono'] text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors flex items-center gap-1.5"
                                    >
                                      <X size={11} /> Remove category
                                    </button>
                                  )}

                                  {/* Topic list */}
                                  <div className="max-h-48 overflow-y-auto show-scrollbar">
                                    {topicGroups.length === 0 ? (
                                      <div className="px-3 py-4 text-center text-[11px] text-text-muted font-['JetBrains_Mono']">
                                        No matching topics
                                      </div>
                                    ) : (
                                      topicGroups.map((group) => (
                                        <div key={group.parent.id}>
                                          {/* Parent header */}
                                          <div className="px-3 py-1 text-[9px] font-['JetBrains_Mono'] font-bold text-text-muted uppercase tracking-widest bg-[#0D0D0D] border-b border-[#1a1a1a]">
                                            {group.parent.code} {group.parent.title}
                                          </div>
                                          {/* Subtopics */}
                                          {group.subtopics.map((sub) => (
                                            <button
                                              key={sub.id}
                                              type="button"
                                              onClick={() => void handleSelectCategory(sub.id)}
                                              className={`w-full px-4 py-1.5 text-left text-[11px] font-['JetBrains_Mono'] hover:bg-accent/10 hover:text-accent transition-colors flex items-center justify-between gap-2 ${
                                                currentTosId === sub.id ? 'text-accent bg-accent/5' : 'text-[#aaa]'
                                              }`}
                                            >
                                              <span className="truncate">{sub.code} {sub.title}</span>
                                              {currentTosId === sub.id && <CheckCircle2 size={11} className="shrink-0 text-accent" />}
                                            </button>
                                          ))}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })()}

                        {/* Row Actions: Get Context + AI Explain + Flag Question */}
                        <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                          <GetContextDropdown
                            size="sm"
                            direction="up"
                            align="center"
                            testId={`get-context-${a.seq}`}
                            contextData={{
                              question: mcq.question,
                              choices: mcq.choices,
                              answer: mcq.answer,
                              explanation: mcq.explanation,
                              subject: a.item.subject,
                              tosTopicId: a.item.card.tosTopicId,
                              deckName: a.item.card.deckName,
                              cardNumber: a.item.card.cardNumber,
                              totalInDeck: a.item.card.totalInDeck,
                              image: (a.item.card as any).image ?? null,
                              solutionImage: (a.item.card as any).solutionImage ?? null,
                            }}
                            onCopied={(_type, msg) => {
                              setToastMessage(msg)
                              setShowToast(true)
                            }}
                          />

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              setExplainingSeq(explainingSeq === a.seq ? null : a.seq)
                            }}
                            className="px-2.5 py-1 rounded bg-surface border border-border-base hover:border-accent text-text-muted hover:text-accent text-xs font-['Rajdhani'] font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <Sparkles size={13} className="text-accent" />
                            {explainingSeq === a.seq ? 'Hide AI Explanation' : 'AI Explain'}
                          </button>

                          <button
                            type="button"
                            data-testid={`flag-btn-${a.seq}`}
                            onClick={e => {
                              e.stopPropagation()
                              setFlagModalCard({ id: a.item.card.id, question: mcq.question })
                            }}
                            className={`px-2.5 py-1 rounded text-xs font-['Rajdhani'] font-bold flex items-center gap-1.5 transition-colors ${
                              flaggedMap[a.item.card.id]
                                ? 'bg-[#ef4444]/20 border border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444]/30'
                                : 'bg-surface border border-border-base hover:border-amber-400 text-text-muted hover:text-amber-400'
                            }`}
                          >
                            <Flag size={13} className={flaggedMap[a.item.card.id] ? 'fill-[#ef4444]' : ''} />
                            {flaggedMap[a.item.card.id]
                              ? `Flagged${flaggedMap[a.item.card.id]?.reason ? ` (${flaggedMap[a.item.card.id].reason})` : ''}`
                              : 'Flag Question'}
                          </button>
                        </div>

                        {/* Inline ExplanationPanel */}
                        {explainingSeq === a.seq && (
                          <div className="mt-2" onClick={e => e.stopPropagation()}>
                            <ExplanationPanel
                              question={mcq.question}
                              choices={mcq.choices}
                              answerIndex={mcq.answer}
                              onClose={() => setExplainingSeq(null)}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Zoomed Image Modal */}
        {zoomedImage && (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setZoomedImage(null)}
          >
            <div className="relative max-w-4xl max-h-[85vh]">
              <img
                src={`ece-app://${zoomedImage}`}
                alt="Enlarged diagram"
                className="max-w-full max-h-[85vh] object-contain rounded-lg border border-[#333] shadow-2xl"
              />
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-surface border border-border-base text-text-muted hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Flag Modal */}
        {flagModalCard && (
          <div
            data-testid="flag-modal"
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setFlagModalCard(null)}
          >
            <div
              className="bg-surface border border-border-base rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border-base/60 pb-3">
                <div className="flex items-center gap-2">
                  <Flag size={18} className="text-[#ef4444]" />
                  <h3 className="font-['Orbitron'] font-bold text-base text-white">
                    {flaggedMap[flagModalCard.id] ? 'Manage Question Flag' : 'Flag Question'}
                  </h3>
                </div>
                <button
                  type="button"
                  data-testid="flag-modal-close-btn"
                  onClick={() => setFlagModalCard(null)}
                  className="p-1 rounded text-text-muted hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="text-xs text-text-muted font-['Rajdhani'] leading-relaxed">
                {flaggedMap[flagModalCard.id] ? (
                  <div>
                    <p className="text-text-primary mb-2">
                      This question is currently <strong>flagged and excluded</strong> from all Gauntlet modes.
                    </p>
                    {flaggedMap[flagModalCard.id]?.reason && (
                      <p className="p-2 rounded bg-surface-2 border border-border-base text-amber-400 font-mono text-[11px]">
                        Reason: {flaggedMap[flagModalCard.id].reason}
                      </p>
                    )}
                  </div>
                ) : (
                  <p>
                    Flag this question so it <strong>will not be picked</strong> as an MCQ in Gauntlet (timed or survival mode).
                  </p>
                )}
              </div>

              {flaggedMap[flagModalCard.id] ? (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-base/60">
                  <button
                    type="button"
                    onClick={() => setFlagModalCard(null)}
                    className="px-3 py-1.5 rounded-lg border border-border-base text-text-muted hover:text-white text-xs font-['Rajdhani'] font-bold"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    data-testid="unflag-confirm-btn"
                    onClick={async () => {
                      try {
                        await gauntletService.unflagQuestion(flagModalCard.id)
                        setFlaggedMap(prev => {
                          const next = { ...prev }
                          delete next[flagModalCard.id]
                          return next
                        })
                        setFlagModalCard(null)
                        setToastMessage('Question unflagged — restored to Gauntlet pool')
                        setShowToast(true)
                      } catch (err: any) {
                        console.error('Failed to unflag question:', err)
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-surface border border-accent text-accent hover:bg-accent/15 text-xs font-['Orbitron'] font-bold"
                  >
                    Unflag Question
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
                    Select a reason:
                  </span>
                  {[
                    'Error in question or choices',
                    'Missing image or diagram',
                    'Hard problem solving question',
                    'Other issue',
                  ].map(reason => (
                    <button
                      key={reason}
                      type="button"
                      data-testid={`flag-reason-${reason.replace(/\s+/g, '-').toLowerCase()}`}
                      onClick={async () => {
                        try {
                          await gauntletService.flagQuestion(flagModalCard.id, reason)
                          setFlaggedMap(prev => ({
                            ...prev,
                            [flagModalCard.id]: { reason, flaggedAt: Date.now() },
                          }))
                          setFlagModalCard(null)
                          setToastMessage('Question flagged — excluded from Gauntlet pool')
                          setShowToast(true)
                        } catch (err: any) {
                          console.error('Failed to flag question:', err)
                        }
                      }}
                      className="text-left p-2.5 rounded-xl border border-border-base bg-surface-2 hover:bg-surface-2/80 hover:border-amber-400 text-xs font-['Rajdhani'] font-semibold text-text-primary transition-all flex items-center justify-between group"
                    >
                      <span>{reason}</span>
                      <Flag size={12} className="text-text-muted group-hover:text-amber-400" />
                    </button>
                  ))}
                  <div className="flex justify-end pt-2 border-t border-border-base/60 mt-1">
                    <button
                      type="button"
                      onClick={() => setFlagModalCard(null)}
                      className="px-3 py-1.5 rounded-lg border border-border-base text-text-muted hover:text-white text-xs font-['Rajdhani'] font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Toast confirmation */}
        <AnimatePresence>
          {showToast && (
            <Toast
              message={toastMessage}
              onDismiss={() => setShowToast(false)}
            />
          )}
        </AnimatePresence>

        {/* Rank Up Splash Modal */}
        {rankUpEvents.length > 0 && currentRankUpIndex < rankUpEvents.length && (
          <GauntletRankUpModal
            isOpen={true}
            event={rankUpEvents[currentRankUpIndex]}
            onClose={() => {
              if (currentRankUpIndex + 1 < rankUpEvents.length) {
                setCurrentRankUpIndex(prev => prev + 1)
              } else {
                setRankUpEvents([])
              }
            }}
          />
        )}

        {/* Learn Settings Modal */}
        <LearnSettingsModal
          isOpen={settingsModalScope !== null}
          settings={learnSettings}
          minimal={true}
          onSettingsChange={handleSettingsChange}
          onStart={handleStartFromSettings}
          onClose={() => setSettingsModalScope(null)}
        />
      </div>
    )
  }

  // Phase === 'playing'
  const currentItem = revealState ? revealState.item : selectCurrentItem({ queue, index })
  const mcq = revealState ? revealState.mcq : (currentItem?.card.data as MCQData | undefined)

  const totalDurationForThisTimer =
    config.mode === 'timed' ? config.durationSec : config.perQuestionSec
  const timerPercent =
    isUnlimitedSurvival
      ? 100
      : totalDurationForThisTimer > 0
      ? Math.min(100, Math.max(0, (timeRemainingSec / totalDurationForThisTimer) * 100))
      : 0
  const isUrgentTimer = !isUnlimitedSurvival && timeRemainingSec <= 5

  const minutes = Math.floor(timeRemainingSec / 60)
  const seconds = timeRemainingSec % 60
  const timeFormatted =
    config.mode === 'timed'
      ? `${minutes}:${seconds.toString().padStart(2, '0')}`
      : isUnlimitedSurvival
      ? `∞ ${timeRemainingSec}s`
      : `${timeRemainingSec}s`

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col gap-4 my-auto">
      {/* HUD Header */}
      <div className="bg-surface rounded-xl p-3 border border-border-base flex items-center justify-between gap-3">
        {/* Left HUD: Mode, Index, Score, Streak, Lives */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="font-['Orbitron'] font-bold text-xs uppercase text-accent tracking-wider">
              {config.mode}
            </span>
            <span className="text-text-muted text-xs font-['JetBrains_Mono']">
              #{index + 1}
              {config.mode === 'timed'
                ? config.unlimitedItems
                  ? ' (Sprint)'
                  : `/${config.totalItems || queue.length}`
                : ''}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs font-['JetBrains_Mono'] text-text-primary">
            Score: <strong className="text-accent">{score}</strong>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-['JetBrains_Mono'] text-text-primary">
            <span>Streak:</span>
            <strong
              className={`transition-all ${
                activeStreakBonus
                  ? 'text-[#00FF41] drop-shadow-[0_0_8px_rgba(0,255,65,0.7)]'
                  : 'text-[#f59e0b]'
              }`}
            >
              {streak}
            </strong>
            {activeStreakBonus && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-['Orbitron'] font-bold text-[#00FF41] bg-[#00FF41]/20 border border-[#00FF41]/40 animate-pulse shadow-[0_0_10px_rgba(0,255,65,0.3)]">
                +{activeStreakBonus} BONUS
              </span>
            )}
          </div>

          {config.mode === 'survival' && (
            <div
              className={`flex items-center gap-1 text-xs font-['JetBrains_Mono'] text-[#ef4444] transition-all ${
                pulseHeart ? 'gauntlet-heart-pulse' : ''
              }`}
            >
              <Heart size={14} fill="currentColor" />
              <strong>{config.lives === 0 ? '∞' : livesLeft}</strong>
            </div>
          )}
        </div>

        {/* Right HUD: Timer + VolumeControl + Quit Run */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Per-question 1-minute hard cap badge in timed mode */}
          {config.mode === 'timed' && (
            <div
              className={`relative overflow-hidden flex items-center gap-1.5 font-['JetBrains_Mono'] font-bold text-xs bg-surface-2 px-2.5 py-1.5 rounded-lg border transition-all ${
                isUrgentQuestionCap
                  ? 'border-[#FF3333]/70 gauntlet-timer-shake text-[#FF3333] shadow-[0_0_12px_rgba(255,51,51,0.25)]'
                  : 'border-border-base text-text-muted'
              }`}
              title="Per-question hard cap (1 min max per question in Time Trial to protect fair streaks)"
            >
              <div
                className={`absolute left-0 bottom-0 h-0.5 transition-all duration-300 ${
                  isUrgentQuestionCap ? 'bg-[#FF3333]' : 'bg-accent/60'
                }`}
                style={{ width: `${Math.min(100, (timedQuestionRemainingSec / TIMED_QUESTION_CAP_SEC) * 100)}%` }}
              />
              <Clock
                size={13}
                className={isUrgentQuestionCap ? 'text-[#FF3333] animate-pulse' : 'text-accent'}
              />
              <span>Q: {timedQuestionRemainingSec}s</span>
            </div>
          )}

          {/* Timer Chip with Draining Progress Bar and <=5s Shake */}
          <div
            className={`relative overflow-hidden flex items-center gap-1.5 font-['JetBrains_Mono'] font-bold text-sm bg-surface-2 px-3 py-1.5 rounded-lg border transition-all ${
              isUrgentTimer
                ? 'border-[#FF3333]/70 gauntlet-timer-shake shadow-[0_0_12px_rgba(255,51,51,0.25)]'
                : 'border-border-base'
            }`}
          >
            {/* Subtle background drain tint */}
            <div
              className={`absolute left-0 top-0 bottom-0 opacity-15 pointer-events-none transition-all duration-300 ${
                isUrgentTimer ? 'bg-[#FF3333]' : 'bg-accent'
              }`}
              style={{ width: `${timerPercent}%` }}
            />
            {/* Draining progress bar track beneath */}
            <div
              className={`absolute left-0 bottom-0 h-1 transition-all duration-300 ${
                isUrgentTimer ? 'bg-[#FF3333]' : 'bg-accent'
              }`}
              style={{ width: `${timerPercent}%` }}
            />

            <Timer
              size={14}
              className={`relative z-10 ${
                isUrgentTimer ? 'text-[#FF3333] animate-pulse' : 'text-accent'
              }`}
            />
            <span
              className={`relative z-10 ${
                isUrgentTimer ? 'text-[#FF3333]' : 'text-text-primary'
              }`}
            >
              {timeFormatted}
            </span>
          </div>

          {/* Volume / Mute Control */}
          <VolumeControl className="text-text-muted hover:text-white" iconSize={16} />

          {/* Quit Button (Relocated outside Question Card) */}
          <button
            type="button"
            disabled={isModalOpen || revealState !== null}
            onClick={onOpenPause}
            className="px-2.5 py-1.5 rounded-lg text-xs font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted hover:text-[#FF3333] hover:bg-[#FF3333]/10 border border-border-base hover:border-[#FF3333]/40 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle size={14} />
            Quit
          </button>
        </div>
      </div>

      {/* Question Card */}
      {currentItem && mcq ? (
        <div
          className={`relative bg-surface-2 rounded-xl p-6 sm:p-7 border border-border-base flex flex-col gap-6 shadow-2xl transition-all overflow-hidden ${
            shakeWrong ? 'gauntlet-card-shake border-danger/80' : ''
          }`}
        >
          {/* Red edge flash overlay on wrong answer */}
          {shakeWrong && (
            <div
              aria-hidden="true"
              className="gauntlet-edge-flash absolute inset-0 pointer-events-none rounded-xl border-2 border-danger shadow-[inset_0_0_24px_rgba(255,51,51,0.5)] z-20"
            />
          )}

          {/* Question Meta */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-['Orbitron'] font-bold tracking-wider"
                style={{
                  color: SUBJECT_LINE_COLOR[currentItem.subject],
                  border: `1px solid ${SUBJECT_LINE_COLOR[currentItem.subject]}`,
                }}
              >
                {currentItem.subject}
              </span>
            </div>
          </div>

          {/* Question Text */}
          <div
            className="text-white font-['Rajdhani'] font-semibold text-lg leading-relaxed whitespace-pre-wrap mcq-question-text"
            dangerouslySetInnerHTML={{ __html: renderMath(mcq.question ?? '') }}
          />

          {/* Question Diagram / Image */}
          {mcq.imagePath && (
            <div className="w-full h-auto max-h-[300px] flex justify-center overflow-hidden rounded-lg border border-[#333] shadow-lg">
              <img
                src={`ece-app://${mcq.imagePath}`}
                alt="Question diagram"
                className="w-full h-full max-h-[300px] object-contain"
              />
            </div>
          )}

          {/* Choices in 2x2 Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.isArray(mcq.choices) &&
              mcq.choices.map((choice, i) => {
                const renderFn = mcq.choicesPlainText?.[i] ? renderPlainText : renderMath
                const letter = String.fromCharCode(65 + i)
                const isRevealed = revealState !== null
                const isCorrect = isRevealed && i === revealState.correctIndex
                const isPicked = isRevealed && revealState.chosen === i
                const isWrongPicked = isPicked && revealState.isWrong

                let btnStyle =
                  'border-[#2c2c2c] bg-[#121212] hover:bg-[#1c1c1c] hover:border-accent hover:shadow-[0_0_8px_rgba(0,255,65,0.2)] cursor-pointer text-text-muted'
                let prefixStyle =
                  'border-[#444] text-text-muted bg-surface/50 group-hover:border-accent group-hover:text-accent'
                let textStyle = 'text-text-primary'

                if (isRevealed) {
                  if (isCorrect) {
                    btnStyle =
                      'border-accent bg-[rgba(0,255,65,0.08)] shadow-[0_0_16px_rgba(0,255,65,0.22)] cursor-default'
                    prefixStyle = 'bg-accent text-[#0D0D0D] border-accent font-bold'
                    textStyle = 'text-white'
                  } else if (isWrongPicked) {
                    btnStyle =
                      'border-danger bg-[rgba(255,51,51,0.08)] shadow-[0_0_16px_rgba(255,51,51,0.22)] cursor-default'
                    prefixStyle = 'bg-danger text-[#0D0D0D] border-danger font-bold'
                    textStyle = 'text-[#aaa]'
                  } else {
                    btnStyle = 'border-[#222] bg-[#0e0e0e] opacity-50 cursor-default'
                    prefixStyle = 'border-[#333] text-[#444] bg-[#0a0a0a]'
                    textStyle = 'text-[#555]'
                  }
                }

                let orderClass = ''
                if (i === 0) orderClass = 'order-1'
                else if (i === 1) orderClass = 'order-2 md:order-3'
                else if (i === 2) orderClass = 'order-3 md:order-2'
                else if (i === 3) orderClass = 'order-4'

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isModalOpen || isRevealed}
                    onClick={() => handleAnswer(i)}
                    className={`w-full text-left py-4 px-4 rounded-xl border flex items-center transition-all group disabled:cursor-not-allowed ${btnStyle} ${orderClass}`}
                  >
                    <div
                      className={`w-6 h-6 flex items-center justify-center rounded border font-['Rajdhani'] font-bold text-sm mr-3 shrink-0 transition-colors ${prefixStyle}`}
                    >
                      {letter}
                    </div>
                    <div
                      className={`flex-1 text-base font-['Rajdhani'] font-semibold tracking-wide mcq-choice-text leading-snug ${textStyle}`}
                      dangerouslySetInnerHTML={{ __html: renderFn(choice) }}
                    />
                    {isRevealed && isCorrect && (
                      <CheckCircle2 className="text-accent ml-3 shrink-0" size={20} />
                    )}
                    {isRevealed && isWrongPicked && (
                      <XCircle className="text-danger ml-3 shrink-0" size={20} />
                    )}
                  </button>
                )
              })}
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-end pt-2 border-t border-border-base/60">
            <button
              type="button"
              disabled={isModalOpen || revealState !== null || skipsAvailable === 0}
              onClick={handleSkip}
              className="px-4 py-1.5 rounded-lg text-xs font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted hover:text-text-primary bg-surface-2 border border-border-base hover:border-accent transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SkipForward size={14} />
              SKIP ({skipsAvailable})
            </button>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-surface-2 rounded-xl border border-border-base text-text-muted font-['Rajdhani'] text-sm">
          Preparing question queue…
        </div>
      )}
    </div>
  )
}

export default function Gauntlet() {
  const phase = useGauntletStore(s => s.phase)
  const rated = useGauntletStore(s => s.rated)
  const loadHub = useGauntletStore(s => s.loadHub)
  const beginRun = useGauntletStore(s => s.beginRun)
  const cancelCountdown = useGauntletStore(s => s.cancelCountdown)
  const pauseRun = useGauntletStore(s => s.pauseRun)
  const resumeRun = useGauntletStore(s => s.resumeRun)
  const quit = useGauntletStore(s => s.quit)

  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false)
  const [learnModeScope, setLearnModeScope] = useState<'missed' | 'all' | null>(null)
  const [isLearningMissed, setIsLearningMissed] = useState(false)
  const isLearningActive = learnModeScope !== null || isLearningMissed
  const setForceCollapsed = useLayoutStore(s => s.setForceCollapsed)
  const music = useGauntletMusic()

  // Music lifecycle:
  // - Pre-run: continuous stealth ambient across home, setup, loading, and countdown.
  // - Playing: immediately shift gameplay floor to enemiesNearby.
  useEffect(() => {
    if (phase === 'home' || phase === 'setup' || phase === 'loading' || phase === 'countdown') {
      music.start('stealth')
    } else if (phase === 'playing') {
      music.setState('enemiesNearby')
    }
  }, [phase, music])

  // Stop music on page unmount
  useEffect(() => {
    return () => {
      music.stop()
    }
  }, [music])

  // Force sidebar collapse during countdown and playing without modifying saved preference,
  // but explicitly false whenever Learn Mode is active so the sidebar reappears.
  useEffect(() => {
    const shouldForceCollapse =
      !isLearningActive && (phase === 'countdown' || (phase === 'playing' && !isLearningActive))
    setForceCollapsed(shouldForceCollapse)
  }, [phase, isLearningActive, setForceCollapsed])

  // Reset learn mode when phase changes away from playing/summary
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'summary') {
      setIsLearningMissed(false)
      setLearnModeScope(null)
    }
  }, [phase])

  // Reset forceCollapsed on unmount
  useEffect(() => {
    return () => {
      useLayoutStore.getState().setForceCollapsed(false)
    }
  }, [])

  // Load hub data on mount
  useEffect(() => {
    void loadHub()
  }, [loadHub])

  // Reset to home on page unmount if not playing, countdown, or review summary
  useEffect(() => {
    return () => {
      const curPhase = useGauntletStore.getState().phase
      if (curPhase !== 'playing' && curPhase !== 'countdown' && curPhase !== 'summary') {
        useGauntletStore.getState().resetToHome()
      }
    }
  }, [])

  // Leave guard: useBlocker active while phase is 'countdown' or 'playing'
  const isBlocking = phase === 'countdown' || phase === 'playing'
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isBlocking && currentLocation.pathname !== nextLocation.pathname,
  )

  // When blocker triggers, pause the run if playing
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (phase === 'playing') {
        pauseRun()
      }
    }
  }, [blocker.state, phase, pauseRun])

  // Reset blocker on unmount if left blocked
  useEffect(() => {
    return () => {
      if (blocker.state === 'blocked') {
        blocker.reset()
      }
    }
  }, [blocker])

  // Esc key opens pause modal while playing
  useEffect(() => {
    if (phase !== 'playing') return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPauseModalOpen && blocker.state !== 'blocked') {
        e.preventDefault()
        pauseRun()
        setIsPauseModalOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, isPauseModalOpen, blocker.state, pauseRun])

  const handleOpenPause = useCallback(() => {
    pauseRun()
    setIsPauseModalOpen(true)
  }, [pauseRun])

  const handleResume = useCallback(() => {
    setIsPauseModalOpen(false)
    resumeRun()
  }, [resumeRun])

  const handleQuitFromPause = useCallback(() => {
    setIsPauseModalOpen(false)
    quit()
  }, [quit])

  const handleConfirmLeave = () => {
    if (phase === 'countdown') {
      cancelCountdown()
    } else {
      quit()
    }
    blocker.proceed?.()
  }

  const handleCancelLeave = () => {
    blocker.reset?.()
    if (phase === 'playing') {
      resumeRun()
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      {/* Screens based on phase */}
      {phase === 'home' && <GauntletHome />}

      {(phase === 'setup' || phase === 'loading') && <GauntletSetup />}

      {phase === 'countdown' && (
        <GauntletCountdown onBegin={beginRun} onCancel={cancelCountdown} />
      )}

      {(phase === 'playing' || phase === 'summary') && (
        <div className={`absolute inset-0 z-10 h-full flex flex-col ${
          isLearningActive ? 'p-0 overflow-hidden' : 'px-8 pb-4 pt-4 lg:px-12 lg:pb-6 lg:pt-4 gap-4 overflow-y-auto overflow-x-hidden'
        }`}>
          <RunPlaceholder
            onOpenPause={handleOpenPause}
            isModalOpen={isPauseModalOpen || blocker.state === 'blocked'}
            learnModeScope={learnModeScope}
            setLearnModeScope={setLearnModeScope}
            isLearningMissed={isLearningActive}
            setIsLearningMissed={setIsLearningMissed}
          />
        </div>
      )}

      {/* In-run Pause Modal */}
      <GauntletPauseModal
        isOpen={isPauseModalOpen}
        onResume={handleResume}
        onQuit={handleQuitFromPause}
      />

      {/* Navigation Blocker Confirm Modal */}
      <LeaveConfirmModal
        isOpen={blocker.state === 'blocked'}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
        isAbsolute
        message={`Quit this Gauntlet run? Your answers so far will be saved to your history${
          rated ? ' and counted toward your ratings' : ''
        }.`}
      />
    </div>
  )
}
