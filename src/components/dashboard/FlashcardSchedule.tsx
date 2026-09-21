import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { dbService } from '../../services/db.service';
import { FlashcardSchedule as FlashcardScheduleData } from '../../types';
import { buildScheduleView } from '../../lib/scheduleView';
import { Tooltip } from '../ui/Tooltip';

import { useDashboardStore } from '../../store/useDashboardStore';

function FlashcardSchedule() {
  const schedule = useDashboardStore((s) => s.flashcardSchedule);
  const scheduleLoading = useDashboardStore((s) => s.scheduleLoading);
  const fetchFlashcardSchedule = useDashboardStore((s) => s.fetchFlashcardSchedule);

  useEffect(() => {
    fetchFlashcardSchedule();
  }, [fetchFlashcardSchedule]);

  if (!schedule && scheduleLoading) {
    return (
      <div className="bg-surface p-4 rounded-xl border border-border-base shadow-lg flex flex-col gap-2.5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-32 bg-[#222] rounded" />
        </div>
        <div className="flex flex-col gap-1 py-0.5">
          <div className="h-6 w-12 bg-[#222] rounded" />
          <div className="h-2.5 w-36 bg-[#222] rounded" />
        </div>
        <div className="flex items-start gap-0 divide-x divide-[#2A2A2A] py-1 border-y border-[#2A2A2A]">
          <div className="flex-1 pr-2 flex flex-col gap-1">
            <div className="h-2 w-6 bg-[#222] rounded" />
            <div className="h-4 w-10 bg-[#222] rounded" />
          </div>
          <div className="flex-1 px-2 flex flex-col gap-1">
            <div className="h-2 w-6 bg-[#222] rounded" />
            <div className="h-4 w-10 bg-[#222] rounded" />
          </div>
          <div className="flex-1 pl-2 flex flex-col gap-1">
            <div className="h-2 w-6 bg-[#222] rounded" />
            <div className="h-4 w-10 bg-[#222] rounded" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 h-10 items-end">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 bg-[#222] rounded-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="bg-surface p-4 rounded-xl border border-border-base shadow-lg flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-['Rajdhani'] font-bold text-xs text-text-primary uppercase tracking-widest flex items-center gap-1.5">
            <CalendarClock className="text-accent" size={12} />
            Flashcard Schedule
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
          <p className="text-xs font-['Rajdhani'] text-[#888] uppercase tracking-wider">
            Schedule unavailable
          </p>
          <button
            type="button"
            onClick={() => fetchFlashcardSchedule(true)}
            className="px-2.5 py-1 rounded text-[11px] font-['Rajdhani'] font-bold uppercase tracking-wider bg-[#222] hover:bg-[#2A2A2A] text-text-primary border border-border-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const view = buildScheduleView(schedule);

  return (
    <div className="bg-surface p-4 rounded-xl border border-border-base shadow-lg flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-['Rajdhani'] font-bold text-xs text-text-primary uppercase tracking-widest flex items-center gap-1.5">
          <CalendarClock className="text-accent" size={12} />
          Flashcard Schedule
        </h2>
      </div>

      {/* Hero: Due count + Cards Due Today + Notes */}
      <Link
        to="/flashcards"
        aria-label={`${view.hero} ${view.hero === 1 ? 'card' : 'cards'} due today. Open flashcards`}
        className="flex flex-col gap-0.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent group transition-opacity hover:opacity-90"
      >
        <div className="flex items-baseline gap-1.5">
          <span className="font-['JetBrains_Mono'] text-2xl font-bold text-accent leading-none">
            {view.hero}
          </span>
          <span className="font-['Rajdhani'] text-[10px] font-bold text-text-primary uppercase tracking-widest">
            CARDS DUE TODAY
          </span>
        </div>
        {view.notes.length > 0 && (
          <div className="flex flex-col gap-0.5 mt-0.5">
            {view.notes.map((note, idx) => (
              <p
                key={idx}
                className="font-['Rajdhani'] text-[10.5px] text-[#888] font-medium tracking-wide leading-tight"
              >
                {note}
              </p>
            ))}
          </div>
        )}
      </Link>

      {/* Count row: Due · New · Later */}
      <div className="flex items-start gap-0 divide-x divide-[#2A2A2A] py-1 border-y border-[#2A2A2A]">
        <div className="flex flex-col gap-0.5 flex-1 pr-2">
          <span className="font-['Rajdhani'] text-[#666] uppercase tracking-widest text-[8.5px] font-bold">
            Due
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-['JetBrains_Mono'] text-base font-bold text-accent leading-none">
              {schedule.due}
            </span>
            <span className="font-['Rajdhani'] text-accent font-bold text-[8.5px]">CARDS</span>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 flex-1 px-2">
          <span className="font-['Rajdhani'] text-[#666] uppercase tracking-widest text-[8.5px] font-bold">
            New
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-['JetBrains_Mono'] text-base font-bold text-text-primary leading-none">
              {schedule.new}
            </span>
            <span className="font-['Rajdhani'] text-[#888] font-bold text-[8.5px]">CARDS</span>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 flex-1 pl-2">
          <span className="font-['Rajdhani'] text-[#666] uppercase tracking-widest text-[8.5px] font-bold">
            Later
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-['JetBrains_Mono'] text-base font-bold text-[#888] leading-none">
              {schedule.future}
            </span>
            <span className="font-['Rajdhani'] text-[#666] font-bold text-[8.5px]">CARDS</span>
          </div>
        </div>
      </div>

      {/* 7-day strip */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="grid grid-cols-7 gap-1 min-w-0 w-full items-end">
          {view.bars.map((bar) => (
            <Tooltip
              key={bar.date}
              content={bar.fullLabel}
              position="top"
              className="w-full min-w-0 flex flex-col items-center"
            >
              <div className="flex flex-col items-center w-full min-w-0 cursor-default">
                <span
                  className={`font-['JetBrains_Mono'] text-[9px] leading-tight mb-0.5 truncate ${
                    bar.isToday ? 'text-accent font-bold' : 'text-[#888]'
                  }`}
                >
                  {bar.count}
                </span>
                <div className="w-full h-8 bg-[#161616] rounded-sm flex items-end p-0.5">
                  <div
                    className={`w-full rounded-sm transition-all duration-300 ${
                      bar.isToday
                        ? 'bg-accent shadow-[0_0_6px_rgba(0,255,65,0.25)]'
                        : 'bg-[#3A3A3A]'
                    }`}
                    style={{
                      height: bar.heightPct > 0 ? `${bar.heightPct}%` : '0%',
                    }}
                  />
                </div>
                <span
                  className={`font-['Rajdhani'] text-[8px] font-bold uppercase tracking-wider mt-0.5 truncate ${
                    bar.isToday ? 'text-accent' : 'text-[#666]'
                  }`}
                >
                  {bar.label}
                </span>
              </div>
            </Tooltip>
          ))}
        </div>

        {view.laterLabel && (
          <div className="text-right">
            <span className="font-['Rajdhani'] text-[#666] uppercase tracking-widest text-[8.5px] font-bold">
              {view.laterLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(FlashcardSchedule)
