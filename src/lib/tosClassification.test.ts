import { describe, it, expect } from 'vitest'
import {
  ALL_TOS_TOPICS,
  getTosTopicById,
  getTosTopicsBySubject,
  normalizeSubjectCode,
  formatTosBadge,
} from './tosClassification'

describe('tosClassification', () => {
  it('loads all 34 TOS topics across 4 subjects', () => {
    expect(ALL_TOS_TOPICS.length).toBe(34)
    const subjects = new Set(ALL_TOS_TOPICS.map(t => t.subject))
    expect(Array.from(subjects).sort()).toEqual(['ELECS', 'EST', 'GEAS', 'MATH'])
  })

  it('correctly normalizes subject names', () => {
    expect(normalizeSubjectCode('math')).toBe('MATH')
    expect(normalizeSubjectCode('Mathematics')).toBe('MATH')
    expect(normalizeSubjectCode('ELECS')).toBe('ELECS')
    expect(normalizeSubjectCode('Electronics Engineering')).toBe('ELECS')
    expect(normalizeSubjectCode('GEAS')).toBe('GEAS')
    expect(normalizeSubjectCode('EST')).toBe('EST')
    expect(normalizeSubjectCode('unknown')).toBeNull()
    expect(normalizeSubjectCode(null)).toBeNull()
  })

  it('retrieves topic by id (case insensitive)', () => {
    const topic = getTosTopicById('ELECS-1.0')
    expect(topic).not.toBeNull()
    expect(topic?.id).toBe('ELECS-1.0')
    expect(topic?.title).toBe('DC Electrical Circuits')
    expect(topic?.subject).toBe('ELECS')
    expect(topic?.fullLabel).toBe('ELECS 1.0 DC Electrical Circuits')

    const lowerTopic = getTosTopicById('elecs-1.0')
    expect(lowerTopic?.id).toBe('ELECS-1.0')
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
  })

  it('formats badge label cleanly', () => {
    expect(formatTosBadge('ELECS-1.0')).toBe('ELECS · 1.0 DC Electrical Circuits')
    expect(formatTosBadge('MATH-2.0')).toBe('MATH · 2.0 Integral Calculus')
    expect(formatTosBadge('INVALID')).toBeNull()
    expect(formatTosBadge(null)).toBeNull()
  })
})
