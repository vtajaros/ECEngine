import { describe, it, expect } from 'vitest';
import { buildScheduleView, parseLocalDate, formatShortWeekday, formatFullDate } from './scheduleView';
import { FlashcardSchedule } from '../types';

function createSchedule(overrides: Partial<FlashcardSchedule> = {}): FlashcardSchedule {
  return {
    today: '2026-09-19',
    total: 0,
    new: 0,
    due: 0,
    future: 0,
    later: 0,
    days: [
      { date: '2026-09-19', count: 0 },
      { date: '2026-09-20', count: 0 },
      { date: '2026-09-21', count: 0 },
      { date: '2026-09-22', count: 0 },
      { date: '2026-09-23', count: 0 },
      { date: '2026-09-24', count: 0 },
      { date: '2026-09-25', count: 0 },
    ],
    ...overrides,
  };
}

describe('scheduleView Pure View-Model', () => {
  describe('Hero and Notes branches', () => {
    it('sets hero to s.due and notes to empty when s.due > 0', () => {
      const s = createSchedule({
        total: 10,
        due: 5,
        new: 3,
        future: 2,
        days: [
          { date: '2026-09-19', count: 5 },
          { date: '2026-09-20', count: 2 },
          { date: '2026-09-21', count: 0 },
          { date: '2026-09-22', count: 0 },
          { date: '2026-09-23', count: 0 },
          { date: '2026-09-24', count: 0 },
          { date: '2026-09-25', count: 0 },
        ],
      });
      const view = buildScheduleView(s);
      expect(view.hero).toBe(5);
      expect(view.notes).toEqual([]);
    });

    it('displays ["No flashcards yet"] when s.total === 0', () => {
      const s = createSchedule({ total: 0, due: 0, new: 0, future: 0 });
      const view = buildScheduleView(s);
      expect(view.hero).toBe(0);
      expect(view.notes).toEqual(['No flashcards yet']);
    });

    it('displays new cards available with proper singular/plural when s.due === 0 and s.new > 0', () => {
      const singleNew = createSchedule({ total: 1, due: 0, new: 1, future: 0 });
      expect(buildScheduleView(singleNew).notes).toEqual([
        'No cards due today',
        '1 new card available',
      ]);

      const multiNew = createSchedule({ total: 5, due: 0, new: 5, future: 0 });
      expect(buildScheduleView(multiNew).notes).toEqual([
        'No cards due today',
        '5 new cards available',
      ]);
    });

    it('displays review tomorrow when days[1].count > 0 with singular/plural', () => {
      const singleTomorrow = createSchedule({
        total: 1,
        due: 0,
        new: 0,
        future: 1,
        days: [
          { date: '2026-09-19', count: 0 },
          { date: '2026-09-20', count: 1 },
          { date: '2026-09-21', count: 0 },
          { date: '2026-09-22', count: 0 },
          { date: '2026-09-23', count: 0 },
          { date: '2026-09-24', count: 0 },
          { date: '2026-09-25', count: 0 },
        ],
      });
      expect(buildScheduleView(singleTomorrow).notes).toEqual([
        'No cards due today',
        'Next review: 1 card tomorrow',
      ]);

      const multiTomorrow = createSchedule({
        total: 4,
        due: 0,
        new: 0,
        future: 4,
        days: [
          { date: '2026-09-19', count: 0 },
          { date: '2026-09-20', count: 4 },
          { date: '2026-09-21', count: 0 },
          { date: '2026-09-22', count: 0 },
          { date: '2026-09-23', count: 0 },
          { date: '2026-09-24', count: 0 },
          { date: '2026-09-25', count: 0 },
        ],
      });
      expect(buildScheduleView(multiTomorrow).notes).toEqual([
        'No cards due today',
        'Next review: 4 cards tomorrow',
      ]);
    });

    it('displays the first later day with cards when tomorrow has 0', () => {
      const laterDaySingle = createSchedule({
        total: 1,
        due: 0,
        new: 0,
        future: 1,
        days: [
          { date: '2026-09-19', count: 0 },
          { date: '2026-09-20', count: 0 },
          { date: '2026-09-21', count: 1 },
          { date: '2026-09-22', count: 0 },
          { date: '2026-09-23', count: 0 },
          { date: '2026-09-24', count: 0 },
          { date: '2026-09-25', count: 0 },
        ],
      });
      expect(buildScheduleView(laterDaySingle).notes).toEqual([
        'No cards due today',
        'Next review: 1 card on Mon, Sep 21',
      ]);

      const laterDayMulti = createSchedule({
        total: 7,
        due: 0,
        new: 0,
        future: 7,
        days: [
          { date: '2026-09-19', count: 0 },
          { date: '2026-09-20', count: 0 },
          { date: '2026-09-21', count: 0 },
          { date: '2026-09-22', count: 7 },
          { date: '2026-09-23', count: 0 },
          { date: '2026-09-24', count: 0 },
          { date: '2026-09-25', count: 0 },
        ],
      });
      expect(buildScheduleView(laterDayMulti).notes).toEqual([
        'No cards due today',
        'Next review: 7 cards on Tue, Sep 22',
      ]);
    });

    it('displays "Next review: {n} card(s) later" when days[1..6] are empty and later > 0', () => {
      const laterSingle = createSchedule({
        total: 1,
        due: 0,
        new: 0,
        future: 1,
        later: 1,
      });
      expect(buildScheduleView(laterSingle).notes).toEqual([
        'No cards due today',
        'Next review: 1 card later',
      ]);

      const laterMulti = createSchedule({
        total: 6,
        due: 0,
        new: 0,
        future: 6,
        later: 6,
      });
      expect(buildScheduleView(laterMulti).notes).toEqual([
        'No cards due today',
        'Next review: 6 cards later',
      ]);
    });

    it('prioritizes new cards over future reviews when both are present and due === 0 (max 2 lines)', () => {
      const mixed = createSchedule({
        total: 8,
        due: 0,
        new: 5,
        future: 3,
        days: [
          { date: '2026-09-19', count: 0 },
          { date: '2026-09-20', count: 3 },
          { date: '2026-09-21', count: 0 },
          { date: '2026-09-22', count: 0 },
          { date: '2026-09-23', count: 0 },
          { date: '2026-09-24', count: 0 },
          { date: '2026-09-25', count: 0 },
        ],
      });
      const view = buildScheduleView(mixed);
      expect(view.notes).toHaveLength(2);
      expect(view.notes).toEqual(['No cards due today', '5 new cards available']);
    });
  });

  describe('Bars and heightPct scaling', () => {
    it('returns heightPct = 0 for zero counts, and at least 12 for non-zero counts', () => {
      const s = createSchedule({
        days: [
          { date: '2026-09-19', count: 0 },
          { date: '2026-09-20', count: 100 },
          { date: '2026-09-21', count: 50 },
          { date: '2026-09-22', count: 10 },
          { date: '2026-09-23', count: 1 },
          { date: '2026-09-24', count: 0 },
          { date: '2026-09-25', count: 0 },
        ],
      });

      const view = buildScheduleView(s);

      expect(view.bars[0].heightPct).toBe(0);
      expect(view.bars[1].heightPct).toBe(100);
      expect(view.bars[2].heightPct).toBe(50);
      // 10/100 = 10%, clamped to at least 12
      expect(view.bars[3].heightPct).toBe(12);
      // 1/100 = 1%, clamped to at least 12
      expect(view.bars[4].heightPct).toBe(12);
      expect(view.bars[5].heightPct).toBe(0);
      expect(view.bars[6].heightPct).toBe(0);
    });

    it('returns 0 heightPct for all bars when all counts are 0', () => {
      const s = createSchedule();
      const view = buildScheduleView(s);
      view.bars.forEach((bar) => {
        expect(bar.heightPct).toBe(0);
        expect(bar.count).toBe(0);
      });
    });

    it('correctly sets isToday, label, and fullLabel', () => {
      const s = createSchedule();
      const view = buildScheduleView(s);

      expect(view.bars).toHaveLength(7);
      expect(view.bars[0].isToday).toBe(true);
      expect(view.bars[0].label).toBe('Today');
      expect(view.bars[0].fullLabel).toBe('Sat, Sep 19');

      expect(view.bars[1].isToday).toBe(false);
      expect(view.bars[1].label).toBe('Sun');
      expect(view.bars[1].fullLabel).toBe('Sun, Sep 20');

      expect(view.bars[2].label).toBe('Mon');
      expect(view.bars[2].fullLabel).toBe('Mon, Sep 21');

      expect(view.bars[3].label).toBe('Tue');
      expect(view.bars[3].fullLabel).toBe('Tue, Sep 22');

      expect(view.bars[4].label).toBe('Wed');
      expect(view.bars[4].fullLabel).toBe('Wed, Sep 23');

      expect(view.bars[5].label).toBe('Thu');
      expect(view.bars[5].fullLabel).toBe('Thu, Sep 24');

      expect(view.bars[6].label).toBe('Fri');
      expect(view.bars[6].fullLabel).toBe('Fri, Sep 25');
    });
  });

  describe('Date boundary formatting and timezones', () => {
    it('formats month boundary (2026-09-30 -> 2026-10-01) correctly', () => {
      const s = createSchedule({
        today: '2026-09-30',
        days: [
          { date: '2026-09-30', count: 0 },
          { date: '2026-10-01', count: 0 },
          { date: '2026-10-02', count: 0 },
          { date: '2026-10-03', count: 0 },
          { date: '2026-10-04', count: 0 },
          { date: '2026-10-05', count: 0 },
          { date: '2026-10-06', count: 0 },
        ],
      });

      const view = buildScheduleView(s);
      expect(view.bars[0].label).toBe('Today');
      expect(view.bars[0].fullLabel).toBe('Wed, Sep 30');

      expect(view.bars[1].label).toBe('Thu');
      expect(view.bars[1].fullLabel).toBe('Thu, Oct 1');
    });

    it('formats year boundary (2026-12-31 -> 2027-01-01) correctly', () => {
      const s = createSchedule({
        today: '2026-12-31',
        days: [
          { date: '2026-12-31', count: 0 },
          { date: '2027-01-01', count: 0 },
          { date: '2027-01-02', count: 0 },
          { date: '2027-01-03', count: 0 },
          { date: '2027-01-04', count: 0 },
          { date: '2027-01-05', count: 0 },
          { date: '2027-01-06', count: 0 },
        ],
      });

      const view = buildScheduleView(s);
      expect(view.bars[0].label).toBe('Today');
      expect(view.bars[0].fullLabel).toBe('Thu, Dec 31');

      expect(view.bars[1].label).toBe('Fri');
      expect(view.bars[1].fullLabel).toBe('Fri, Jan 1');
    });

    it('parseLocalDate creates date from year, month-1, day preventing UTC shifts', () => {
      const date = parseLocalDate('2026-09-19');
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(8); // September (0-indexed)
      expect(date.getDate()).toBe(19);

      expect(formatShortWeekday('2026-09-19')).toBe('Sat');
      expect(formatFullDate('2026-09-19')).toBe('Sat, Sep 19');
    });
  });

  describe('laterLabel', () => {
    it('returns null when later === 0', () => {
      const s = createSchedule({ later: 0 });
      expect(buildScheduleView(s).laterLabel).toBeNull();
    });

    it('returns +{n} later when later > 0', () => {
      const s = createSchedule({ later: 5 });
      expect(buildScheduleView(s).laterLabel).toBe('+5 later');
    });
  });
});
