import { FlashcardSchedule } from '../types';

export interface ScheduleBar {
  date: string;
  label: string;
  fullLabel: string;
  count: number;
  heightPct: number;
  isToday: boolean;
}

export interface ScheduleViewModel {
  hero: number;
  notes: string[];
  bars: ScheduleBar[];
  laterLabel: string | null;
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

export function formatShortWeekday(dateStr: string): string {
  return weekdayFormatter.format(parseLocalDate(dateStr));
}

export function formatFullDate(dateStr: string): string {
  return fullDateFormatter.format(parseLocalDate(dateStr));
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

export function buildScheduleView(s: FlashcardSchedule): ScheduleViewModel {
  const hero = s.due;
  const notes: string[] = [];

  if (s.due === 0) {
    if (s.total === 0) {
      notes.push('No flashcards yet');
    } else {
      notes.push('No cards due today');
      if (s.new > 0) {
        notes.push(`${s.new} ${plural(s.new, 'new card', 'new cards')} available`);
      } else if (s.future > 0) {
        if (s.days[1] && s.days[1].count > 0) {
          const count = s.days[1].count;
          notes.push(`Next review: ${count} ${plural(count, 'card', 'cards')} tomorrow`);
        } else {
          const firstLaterDay = s.days.slice(2).find((d) => d.count > 0);
          if (firstLaterDay) {
            const count = firstLaterDay.count;
            const dateStr = formatFullDate(firstLaterDay.date);
            notes.push(`Next review: ${count} ${plural(count, 'card', 'cards')} on ${dateStr}`);
          } else {
            const count = s.later > 0 ? s.later : s.future;
            notes.push(`Next review: ${count} ${plural(count, 'card', 'cards')} later`);
          }
        }
      }
    }
  }

  const maxCount = Math.max(...s.days.map((d) => d.count), 0);

  const bars: ScheduleBar[] = s.days.map((day, index) => {
    const isToday = index === 0;
    const label = isToday ? 'Today' : formatShortWeekday(day.date);
    const fullLabel = formatFullDate(day.date);
    const heightPct =
      day.count === 0
        ? 0
        : Math.max(12, Math.round((day.count / (maxCount || 1)) * 100));

    return {
      date: day.date,
      label,
      fullLabel,
      count: day.count,
      heightPct,
      isToday,
    };
  });

  const laterLabel = s.later > 0 ? `+${s.later} later` : null;

  return {
    hero,
    notes,
    bars,
    laterLabel,
  };
}
