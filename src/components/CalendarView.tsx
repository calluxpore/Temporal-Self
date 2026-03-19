import { useMemo, useState } from 'react';
import type { Memory } from '../types/memory';

interface CalendarViewProps {
  memories: Memory[];
  onMemoryClick: (e: React.MouseEvent, memory: Memory) => void;
  onDateFilter: (from: string | null, to: string | null) => void;
  selectedDateFrom: string | null;
  selectedDateTo: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function CalendarView({
  memories,
  onMemoryClick,
  onDateFilter,
  selectedDateFrom,
  selectedDateTo,
}: CalendarViewProps) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const { days, firstWeekday } = useMemo(() => {
    const y = cursor.year;
    const m = cursor.month;
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const firstWeekday = first.getDay();
    const daysInMonth = last.getDate();
    const days: { date: string; day: number; count: number }[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const count = memories.filter((mem) => mem.date === date).length;
      days.push({ date, day: i, count });
    }
    return { days, firstWeekday };
  }, [cursor.year, cursor.month, memories]);

  const memoriesByDate = useMemo(() => {
    const map = new Map<string, Memory[]>();
    for (const m of memories) {
      const list = map.get(m.date) ?? [];
      list.push(m);
      map.set(m.date, list);
    }
    return map;
  }, [memories]);

  const prevMonth = () => {
    setCursor((c) =>
      c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }
    );
  };
  const nextMonth = () => {
    setCursor((c) =>
      c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }
    );
  };

  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-1 border-b border-border pb-1.5">
        <button
          type="button"
          onClick={prevMonth}
          className="touch-target flex h-8 w-8 items-center justify-center rounded text-text-muted hover:text-accent"
          aria-label="Previous month"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="font-mono text-xs font-medium text-text-primary">
          {MONTHS[cursor.month]} {cursor.year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="touch-target flex h-8 w-8 items-center justify-center rounded text-text-muted hover:text-accent"
          aria-label="Next month"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px text-center font-mono text-[10px] text-text-muted">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={`day-${i}`} className="py-0.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: firstWeekday }, (_, i) => (
          <div key={`pad-${i}`} className="aspect-square" />
        ))}
        {days.map(({ date, day, count }) => {
          const hasMemories = count > 0;
          return (
            <div
              key={date}
              className="relative aspect-square min-h-[28px] rounded border border-transparent bg-surface-elevated/50 p-0.5"
            >
              <button
                type="button"
                onClick={() => onDateFilter(date, date)}
                className={`flex h-full w-full flex-col items-center justify-center rounded text-[10px] transition-colors ${
                  hasMemories ? 'text-accent hover:bg-accent-glow' : 'text-text-muted hover:bg-surface-elevated'
                } ${selectedDateFrom === date ? 'ring-1 ring-accent' : ''}`}
                title={hasMemories ? `${count} memory(ies) – click to filter` : 'Click to filter by this date'}
              >
                <span>{day}</span>
                {count > 0 && <span className="text-[8px] opacity-80">{count}</span>}
              </button>
            </div>
          );
        })}
      </div>
      {selectedDateFrom && selectedDateTo && selectedDateFrom === selectedDateTo && (() => {
        const list = memoriesByDate.get(selectedDateFrom) ?? [];
        if (list.length === 0) return null;
        return (
          <div key="day-list" className="mt-3 border-t border-border pt-2">
            <div className="font-mono mb-1 text-[10px] text-text-muted">
              {list.length} memory(ies) on {selectedDateFrom}
            </div>
            <ul className="max-h-32 space-y-0.5 overflow-y-auto">
              {list.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={(e) => onMemoryClick(e, m)}
                    className="font-mono w-full truncate text-left text-[11px] text-text-primary hover:text-accent"
                  >
                    {m.title || 'Untitled'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}
    </div>
  );
}
