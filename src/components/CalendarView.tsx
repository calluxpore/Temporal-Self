import { useMemo, useState } from 'react';
import type { Memory } from '../types/memory';
import { memoryNoteDisplayName } from '../utils/vaultMarkdown';

interface CalendarViewProps {
  memories: Memory[];
  onMemoryClick: (e: React.MouseEvent, memory: Memory) => void;
  onDateFilter: (from: string | null, to: string | null) => void;
  selectedDateFrom: string | null;
  selectedDateTo: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type CalendarMonth = { year: number; month: number };
type MonthGrid = {
  key: string;
  year: number;
  month: number;
  title: string;
  firstWeekday: number;
  days: { date: string; day: number; count: number }[];
};

function addMonth(base: CalendarMonth, delta: number): CalendarMonth {
  const dt = new Date(base.year, base.month + delta, 1);
  return { year: dt.getFullYear(), month: dt.getMonth() };
}

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

  const memoriesByDate = useMemo(() => {
    const map = new Map<string, Memory[]>();
    for (const m of memories) {
      const list = map.get(m.date) ?? [];
      list.push(m);
      map.set(m.date, list);
    }
    return map;
  }, [memories]);

  const countsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of memories) {
      map.set(m.date, (map.get(m.date) ?? 0) + 1);
    }
    return map;
  }, [memories]);

  const monthGrids = useMemo<MonthGrid[]>(() => {
    const months = [addMonth(cursor, -1), cursor, addMonth(cursor, 1)];
    return months.map(({ year, month }) => {
      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);
      const firstWeekday = first.getDay();
      const daysInMonth = last.getDate();
      const days: { date: string; day: number; count: number }[] = [];
      for (let i = 1; i <= daysInMonth; i++) {
        const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        days.push({ date, day: i, count: countsByDate.get(date) ?? 0 });
      }
      return {
        key: `${year}-${String(month + 1).padStart(2, '0')}`,
        year,
        month,
        title: `${MONTHS[month]} ${year}`,
        firstWeekday,
        days,
      };
    });
  }, [cursor, countsByDate]);

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
    <div className="py-1">
      <div className="flex items-center justify-between gap-1 border-b border-border pb-1">
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
        <span className="font-mono text-xs font-medium text-text-primary">3-month view</span>
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
      <div className="mt-1 grid h-[min(67vh,600px)] grid-rows-3 gap-1">
        {monthGrids.map((grid, i) => {
          const isCurrent = i === 1;
          const usedSlots = grid.firstWeekday + grid.days.length;
          const trailingSlots = Math.max(0, 42 - usedSlots);
          return (
            <div
              key={grid.key}
              className={`min-h-0 rounded-lg border bg-surface-elevated/40 p-1 ${
                isCurrent ? 'border-accent ring-1 ring-accent/50' : 'border-border'
              }`}
            >
              <div className="mb-0.5 text-center font-mono text-[10px] font-medium leading-none text-text-primary">{grid.title}</div>
              <div className="grid grid-cols-7 gap-px text-center font-mono text-[9px] leading-none text-text-muted">
                {WEEKDAY_LABELS.map((d, idx) => (
                  <div key={`${grid.key}-wd-${idx}`} className="py-0.5">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid h-[calc(100%-30px)] min-h-0 grid-cols-7 auto-rows-fr gap-px">
                {Array.from({ length: grid.firstWeekday }, (_, padIdx) => (
                  <div key={`${grid.key}-pad-${padIdx}`} className="min-h-0" />
                ))}
                {grid.days.map(({ date, day, count }) => {
                  const hasMemories = count > 0;
                  const isSelected = selectedDateFrom === date && selectedDateTo === date;
                  return (
                    <div
                      key={date}
                      className="relative min-h-0 rounded border border-transparent bg-surface-elevated/50 p-[1px]"
                    >
                      <button
                        type="button"
                        onClick={() => onDateFilter(date, date)}
                        className={`relative flex h-full w-full min-h-0 items-center justify-center rounded text-[9px] leading-none transition-colors ${
                          hasMemories
                            ? 'cursor-pointer text-accent hover:bg-accent-glow'
                            : 'cursor-pointer text-text-muted hover:bg-surface-elevated'
                        } ${isSelected ? 'ring-1 ring-accent' : ''}`}
                        title={hasMemories ? `${count} memory(ies) – click to filter` : 'Click to filter by this date'}
                      >
                        <span>{day}</span>
                        <span
                          aria-hidden
                          className={`absolute bottom-[1px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                            hasMemories ? 'bg-accent/90' : 'bg-transparent'
                          }`}
                        />
                        {count > 0 && <span className="absolute top-[1px] right-[1px] text-[7px] leading-none opacity-80">{count}</span>}
                      </button>
                    </div>
                  );
                })}
                {Array.from({ length: trailingSlots }, (_, tailIdx) => (
                  <div key={`${grid.key}-tail-${tailIdx}`} className="min-h-0" />
                ))}
              </div>
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
            <ul className="max-h-[min(40vh,360px)] space-y-0.5 overflow-y-auto">
              {list.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={(e) => onMemoryClick(e, m)}
                    className="font-mono w-full truncate text-left text-[11px] text-text-primary hover:text-accent"
                  >
                    {memoryNoteDisplayName(m)}
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
