import { describe, it, expect } from 'vitest'
import {
  ALL_PARENT_TOS_TOPICS,
  ALL_TOS_SUBTOPICS,
  ALL_TOS_TOPICS,
  getTosTopicById,
  getTosTopicsBySubject,
  getTosParentTopicsBySubject,
  getTosTopicGroupsBySubject,
  normalizeSubjectCode,
  formatTosBadge,
} from './tosClassification'

describe('tosClassification', () => {
  it('loads 34 parent topics and 181 decimal subtopics (total 215 items)', () => {
    expect(ALL_PARENT_TOS_TOPICS.length).toBe(34)
    expect(ALL_TOS_SUBTOPICS.length).toBe(181)
    expect(ALL_TOS_TOPICS.length).toBe(215)

    const subjects = new Set(ALL_PARENT_TOS_TOPICS.map(t => t.subject))
    expect(Array.from(subjects).sort()).toEqual(['ELECS', 'EST', 'GEAS', 'MATH'])
  })

  it('correctly normalizes subject names', () => {
    expect(normalizeSubjectCode('math')).toBe('MATH')
    expect(normalizeSubjectCode('Mathematics')).toBe('MATH')
    expect(normalizeSubjectCode('ELECS')).toBe('ELECS')
    expect(normalizeSubjectCode('Electronics Engineering')).toBe('ELECS')
    expect(normalizeSubjectCode('Electronics Systems & Technologies')).toBe('EST')
    expect(normalizeSubjectCode('Electronics Systems and Technologies')).toBe('EST')
    expect(normalizeSubjectCode('GEAS')).toBe('GEAS')
    expect(normalizeSubjectCode('EST')).toBe('EST')
    expect(normalizeSubjectCode('unknown')).toBeNull()
    expect(normalizeSubjectCode(null)).toBeNull()
  })

  it('retrieves parent topic by id (case insensitive)', () => {
    const topic = getTosTopicById('ELECS-1.0')
    expect(topic).not.toBeNull()
    expect(topic?.id).toBe('ELECS-1.0')
    expect(topic?.title).toBe('DC Electrical Circuits')
    expect(topic?.subject).toBe('ELECS')
    expect(topic?.fullLabel).toBe('ELECS 1.0 DC Electrical Circuits')
    expect(topic?.isSubtopic).toBe(false)

    const lowerTopic = getTosTopicById('elecs-1.0')
    expect(lowerTopic?.id).toBe('ELECS-1.0')
  })

  it('retrieves decimal subtopic by id (case insensitive)', () => {
    const subtopic = getTosTopicById('MATH-1.4')
    expect(subtopic).not.toBeNull()
    expect(subtopic?.id).toBe('MATH-1.4')
    expect(subtopic?.title).toBe('Parametric Equations')
    expect(subtopic?.subject).toBe('MATH')
    expect(subtopic?.code).toBe('1.4')
    expect(subtopic?.parentTopicId).toBe('MATH-1.0')
    expect(subtopic?.isSubtopic).toBe(true)
    expect(subtopic?.fullLabel).toBe('MATH 1.4 Parametric Equations')

    const lowerSub = getTosTopicById('math-1.4')
    expect(lowerSub?.id).toBe('MATH-1.4')
  })

  it('filters topics by subject', () => {
    const mathTopics = getTosTopicsBySubject('MATH')
    expect(mathTopics.length).toBe(8)
    expect(mathTopics.every(t => t.subject === 'MATH')).toBe(true)

    const elecsTopics = getTosTopicsBySubject('ELECS')
    expect(elecsTopics.length).toBe(9)
    expect(elecsTopics.every(t => t.subject === 'ELECS')).toBe(true)

    const geasTopics = getTosTopicsBySubject('GEAS')
    expect(geasTopics.length).toBe(11)

    const estTopics = getTosTopicsBySubject('EST')
    expect(estTopics.length).toBe(6)

    // With includeSubtopics
    const allMathItems = getTosTopicsBySubject('MATH', { includeSubtopics: true })
    expect(allMathItems.length).toBe(8 + 32)
  })

  it('returns grouped topics and subtopics for dropdowns', () => {
    const mathGroups = getTosTopicGroupsBySubject('MATH')
    expect(mathGroups.length).toBe(8)

    const diffCalcGroup = mathGroups.find(g => g.parent.id === 'MATH-1.0')
    expect(diffCalcGroup).toBeDefined()
    expect(diffCalcGroup?.parent.title).toBe('Differential Calculus')
    expect(diffCalcGroup?.subtopics.length).toBe(5)
    expect(diffCalcGroup?.subtopics.map(s => s.id)).toEqual([
      'MATH-1.1',
      'MATH-1.2',
      'MATH-1.3',
      'MATH-1.4',
      'MATH-1.5',
    ])
  })

  it('formats badge label cleanly for both parent topics and subtopics', () => {
    expect(formatTosBadge('ELECS-1.0')).toBe('ELECS · 1.0 DC Electrical Circuits')
    expect(formatTosBadge('MATH-2.0')).toBe('MATH · 2.0 Integral Calculus')
    expect(formatTosBadge('MATH-1.4')).toBe('MATH · 1.4 Parametric Equations')
    expect(formatTosBadge('ELECS-2.3')).toBe('ELECS · 2.3 Resonance')
    expect(formatTosBadge('INVALID')).toBeNull()
    expect(formatTosBadge(null)).toBeNull()
  })
})
