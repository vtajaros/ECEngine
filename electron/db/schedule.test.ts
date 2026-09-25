import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { getFlashcardSchedule, SM2_CARD_TYPES } from './schedule';
import { getCardsWithProgress } from './database';

describe('Flashcard Schedule Data Layer', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT DEFAULT '{}',
        difficulty TEXT,
        tags TEXT,
        tos_topic_id TEXT,
        is_custom BOOLEAN DEFAULT 0,
        order_index INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS progress (
        card_id TEXT PRIMARY KEY,
        ease_factor REAL DEFAULT 2.5,
        interval INTEGER DEFAULT 1,
        repetitions INTEGER DEFAULT 0,
        next_review TEXT,
        last_reviewed TEXT,
        correct_count INTEGER DEFAULT 0,
        total_count INTEGER DEFAULT 0,
        last_result TEXT
      );
    `);

    db.prepare('INSERT INTO topics (id, name, subject) VALUES (?, ?, ?)').run(
      'topic-1',
      'Electronics Topic 1',
      'ELECS'
    );
  });

  const insertCard = (id: string, topicId = 'topic-1', type = 'flashcard') => {
    db.prepare(
      'INSERT INTO cards (id, topic_id, type) VALUES (?, ?, ?)'
    ).run(id, topicId, type);
  };

  const insertProgress = (cardId: string, nextReview: string | null) => {
    db.prepare(
      'INSERT INTO progress (card_id, next_review) VALUES (?, ?)'
    ).run(cardId, nextReview);
  };

  // 1. 5 new, 0 due, 0 future
  it('case 1: 5 new, 0 due, 0 future', () => {
    for (let i = 1; i <= 5; i++) {
      insertCard(`c${i}`);
    }

    const schedule = getFlashcardSchedule(db, { today: '2026-09-19' });

    expect(schedule.today).toBe('2026-09-19');
    expect(schedule.total).toBe(5);
    expect(schedule.new).toBe(5);
    expect(schedule.due).toBe(0);
    expect(schedule.future).toBe(0);
    expect(schedule.later).toBe(0);
    expect(schedule.days).toHaveLength(7);
    schedule.days.forEach((day) => expect(day.count).toBe(0));

    // Invariants
    expect(schedule.total).toBe(schedule.new + schedule.due + schedule.future);
    expect(schedule.future).toBe(
      schedule.days.slice(1).reduce((sum, d) => sum + d.count, 0) + schedule.later
    );
  });

  // 2. 8 due today + 3 due yesterday => due 11
  it('case 2: 8 due today + 3 due yesterday => due 11', () => {
    for (let i = 1; i <= 8; i++) {
      insertCard(`today-${i}`);
      insertProgress(`today-${i}`, '2026-09-19');
    }
    for (let i = 1; i <= 3; i++) {
      insertCard(`yesterday-${i}`);
      insertProgress(`yesterday-${i}`, '2026-09-18');
    }

    const schedule = getFlashcardSchedule(db, { today: '2026-09-19' });

    expect(schedule.today).toBe('2026-09-19');
    expect(schedule.total).toBe(11);
    expect(schedule.new).toBe(0);
    expect(schedule.due).toBe(11);
    expect(schedule.future).toBe(0);
    expect(schedule.later).toBe(0);
    expect(schedule.days[0]).toEqual({ date: '2026-09-19', count: 11 });
    schedule.days.slice(1).forEach((d) => expect(d.count).toBe(0));

    // Invariants
    expect(schedule.total).toBe(schedule.new + schedule.due + schedule.future);
    expect(schedule.future).toBe(
      schedule.days.slice(1).reduce((sum, d) => sum + d.count, 0) + schedule.later
    );
  });

  // 3. 5 tomorrow + 7 in 3 days => not due; appear in days[1] and days[3]
  it('case 3: 5 tomorrow + 7 in 3 days => not due; appear in days[1] and days[3]', () => {
    for (let i = 1; i <= 5; i++) {
      insertCard(`tomorrow-${i}`);
      insertProgress(`tomorrow-${i}`, '2026-09-20');
    }
    for (let i = 1; i <= 7; i++) {
      insertCard(`d3-${i}`);
      insertProgress(`d3-${i}`, '2026-09-22');
    }

    const schedule = getFlashcardSchedule(db, { today: '2026-09-19' });

    expect(schedule.today).toBe('2026-09-19');
    expect(schedule.total).toBe(12);
    expect(schedule.new).toBe(0);
    expect(schedule.due).toBe(0);
    expect(schedule.future).toBe(12);
    expect(schedule.later).toBe(0);

    expect(schedule.days[0]).toEqual({ date: '2026-09-19', count: 0 });
    expect(schedule.days[1]).toEqual({ date: '2026-09-20', count: 5 });
    expect(schedule.days[2]).toEqual({ date: '2026-09-21', count: 0 });
    expect(schedule.days[3]).toEqual({ date: '2026-09-22', count: 7 });
    expect(schedule.days[4]).toEqual({ date: '2026-09-23', count: 0 });
    expect(schedule.days[5]).toEqual({ date: '2026-09-24', count: 0 });
    expect(schedule.days[6]).toEqual({ date: '2026-09-25', count: 0 });

    // Invariants
    expect(schedule.total).toBe(schedule.new + schedule.due + schedule.future);
    expect(schedule.future).toBe(
      schedule.days.slice(1).reduce((sum, d) => sum + d.count, 0) + schedule.later
    );
  });

  // 4. mixed: 5 new, 8 today, 4 tomorrow, 3 in three days
  it('case 4: mixed: 5 new, 8 today, 4 tomorrow, 3 in three days', () => {
    for (let i = 1; i <= 5; i++) {
      insertCard(`new-${i}`);
    }
    for (let i = 1; i <= 8; i++) {
      insertCard(`today-${i}`);
      insertProgress(`today-${i}`, '2026-09-19');
    }
    for (let i = 1; i <= 4; i++) {
      insertCard(`tomorrow-${i}`);
      insertProgress(`tomorrow-${i}`, '2026-09-20');
    }
    for (let i = 1; i <= 3; i++) {
      insertCard(`d3-${i}`);
      insertProgress(`d3-${i}`, '2026-09-22');
    }

    const schedule = getFlashcardSchedule(db, { today: '2026-09-19' });

    expect(schedule.today).toBe('2026-09-19');
    expect(schedule.total).toBe(20);
    expect(schedule.new).toBe(5);
    expect(schedule.due).toBe(8);
    expect(schedule.future).toBe(7);
    expect(schedule.later).toBe(0);

    expect(schedule.days[0]).toEqual({ date: '2026-09-19', count: 8 });
    expect(schedule.days[1]).toEqual({ date: '2026-09-20', count: 4 });
    expect(schedule.days[2]).toEqual({ date: '2026-09-21', count: 0 });
    expect(schedule.days[3]).toEqual({ date: '2026-09-22', count: 3 });
    expect(schedule.days[4]).toEqual({ date: '2026-09-23', count: 0 });
    expect(schedule.days[5]).toEqual({ date: '2026-09-24', count: 0 });
    expect(schedule.days[6]).toEqual({ date: '2026-09-25', count: 0 });

    // Invariants
    expect(schedule.total).toBe(schedule.new + schedule.due + schedule.future);
    expect(schedule.future).toBe(
      schedule.days.slice(1).reduce((sum, d) => sum + d.count, 0) + schedule.later
    );
  });

  // 5. empty DB => zeros, days zero-filled with 7 entries
  it('case 5: empty DB => zeros, days zero-filled with 7 entries', () => {
    const schedule = getFlashcardSchedule(db, { today: '2026-09-19' });

    expect(schedule.today).toBe('2026-09-19');
    expect(schedule.total).toBe(0);
    expect(schedule.new).toBe(0);
    expect(schedule.due).toBe(0);
    expect(schedule.future).toBe(0);
    expect(schedule.later).toBe(0);
    expect(schedule.days).toHaveLength(7);
    schedule.days.forEach((d) => expect(d.count).toBe(0));

    // Invariants
    expect(schedule.total).toBe(schedule.new + schedule.due + schedule.future);
    expect(schedule.future).toBe(
      schedule.days.slice(1).reduce((sum, d) => sum + d.count, 0) + schedule.later
    );
  });

  // 6. edge cases: next_review = '' counts as NEW; a progress row with NULL next_review counts as NEW;
  //    next_review exactly = today is due; MCQ/formula cards (per SM2_CARD_TYPES) are excluded;
  //    a date beyond today+6 goes in later
  it('case 6: edge cases', () => {
    // next_review = '' counts as NEW
    insertCard('c_empty');
    insertProgress('c_empty', '');

    // progress row with NULL next_review counts as NEW
    insertCard('c_null');
    insertProgress('c_null', null);

    // next_review exactly = today is due
    insertCard('c_today');
    insertProgress('c_today', '2026-09-19');

    // MCQ/formula cards excluded per SM2_CARD_TYPES
    insertCard('c_mcq', 'topic-1', 'mcq');
    insertProgress('c_mcq', '2026-09-19');

    insertCard('c_formula', 'topic-1', 'formula');
    insertProgress('c_formula', '2026-09-19');

    // date beyond today+6 goes in later
    insertCard('c_later');
    insertProgress('c_later', '2026-09-28');

    const schedule = getFlashcardSchedule(db, { today: '2026-09-19' });

    // Only 4 flashcards should be considered
    expect(schedule.total).toBe(4);
    expect(schedule.new).toBe(2);
    expect(schedule.due).toBe(1);
    expect(schedule.future).toBe(1);
    expect(schedule.later).toBe(1);

    expect(schedule.days[0]).toEqual({ date: '2026-09-19', count: 1 });
    schedule.days.slice(1).forEach((d) => expect(d.count).toBe(0));

    // Invariants
    expect(schedule.total).toBe(schedule.new + schedule.due + schedule.future);
    expect(schedule.future).toBe(
      schedule.days.slice(1).reduce((sum, d) => sum + d.count, 0) + schedule.later
    );
  });

  // 7. PARITY: on a mixed fixture (relative dates via date('now','localtime', '+N day')),
  //    new + due === sum over topics of getCardsWithProgress(topicId, {dueOnly:true}, db).length,
  //    restricted to the same card types.
  it('case 7: parity with getCardsWithProgress across multiple topics', () => {
    db.prepare('INSERT INTO topics (id, name, subject) VALUES (?, ?, ?)').run(
      'topic-2',
      'Electronics Topic 2',
      'ELECS'
    );
    db.prepare('INSERT INTO topics (id, name, subject) VALUES (?, ?, ?)').run(
      'topic-3',
      'Electronics Topic 3',
      'ELECS'
    );

    // Topic 1:
    // 3 new flashcards
    insertCard('t1_new1', 'topic-1', 'flashcard');
    insertCard('t1_new2', 'topic-1', 'flashcard');
    insertCard('t1_new3', 'topic-1', 'flashcard');
    // 2 due today
    insertCard('t1_due1', 'topic-1', 'flashcard');
    db.prepare("INSERT INTO progress (card_id, next_review) VALUES (?, date('now', 'localtime'))").run('t1_due1');
    insertCard('t1_due2', 'topic-1', 'flashcard');
    db.prepare("INSERT INTO progress (card_id, next_review) VALUES (?, date('now', 'localtime'))").run('t1_due2');
    // 1 overdue
    insertCard('t1_overdue', 'topic-1', 'flashcard');
    db.prepare("INSERT INTO progress (card_id, next_review) VALUES (?, date('now', 'localtime', '-2 day'))").run('t1_overdue');
    // 2 future
    insertCard('t1_fut1', 'topic-1', 'flashcard');
    db.prepare("INSERT INTO progress (card_id, next_review) VALUES (?, date('now', 'localtime', '+2 day'))").run('t1_fut1');
    insertCard('t1_fut2', 'topic-1', 'flashcard');
    db.prepare("INSERT INTO progress (card_id, next_review) VALUES (?, date('now', 'localtime', '+4 day'))").run('t1_fut2');
    // 2 mcq cards (one due, one new - must not be counted in flashcard schedule)
    insertCard('t1_mcq1', 'topic-1', 'mcq');
    db.prepare("INSERT INTO progress (card_id, next_review) VALUES (?, date('now', 'localtime'))").run('t1_mcq1');
    insertCard('t1_mcq2', 'topic-1', 'mcq');

    // Topic 2:
    // 2 new flashcards (empty string)
    insertCard('t2_empty1', 'topic-2', 'flashcard');
    insertProgress('t2_empty1', '');
    insertCard('t2_empty2', 'topic-2', 'flashcard');
    insertProgress('t2_empty2', '');
    // 1 due today
    insertCard('t2_due1', 'topic-2', 'flashcard');
    db.prepare("INSERT INTO progress (card_id, next_review) VALUES (?, date('now', 'localtime'))").run('t2_due1');
    // 1 future in window (+1 day)
    insertCard('t2_fut1', 'topic-2', 'flashcard');
    db.prepare("INSERT INTO progress (card_id, next_review) VALUES (?, date('now', 'localtime', '+1 day'))").run('t2_fut1');
    // 1 future beyond window (+10 days)
    insertCard('t2_fut_later', 'topic-2', 'flashcard');
    db.prepare("INSERT INTO progress (card_id, next_review) VALUES (?, date('now', 'localtime', '+10 day'))").run('t2_fut_later');
    // 1 formula card (due)
    insertCard('t2_form1', 'topic-2', 'formula');
    db.prepare("INSERT INTO progress (card_id, next_review) VALUES (?, date('now', 'localtime'))").run('t2_form1');

    // Topic 3:
    // 1 future (+3 days)
    insertCard('t3_fut1', 'topic-3', 'flashcard');
    db.prepare("INSERT INTO progress (card_id, next_review) VALUES (?, date('now', 'localtime', '+3 day'))").run('t3_fut1');

    // Call getFlashcardSchedule without opts.today (uses real SQLite clock)
    const schedule = getFlashcardSchedule(db);

    const topicIds = ['topic-1', 'topic-2', 'topic-3'];
    let totalDueFromQueue = 0;

    for (const topicId of topicIds) {
      const queueCards = getCardsWithProgress(topicId, { dueOnly: true }, db);
      const filteredQueue = queueCards.filter((c) =>
        (SM2_CARD_TYPES as readonly string[]).includes(c.type)
      );
      totalDueFromQueue += filteredQueue.length;
    }

    // Parity assertion
    expect(schedule.new + schedule.due).toBe(totalDueFromQueue);

    // Invariants
    expect(schedule.total).toBe(schedule.new + schedule.due + schedule.future);
    expect(schedule.future).toBe(
      schedule.days.slice(1).reduce((sum, d) => sum + d.count, 0) + schedule.later
    );
  });
});
