"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toISODate } from "@/lib/mock-data";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Lightweight month calendar (no dependencies).
 * Props:
 *  - selected: "YYYY-MM-DD" string of the picked day
 *  - onSelect: (isoString) => void
 *  - marked: array of "YYYY-MM-DD" strings to flag with a dot (optional)
 *  - onMonthChange: ({ year, month }) => void — called when user navigates months (optional)
 */
export function Calendar({ selected, onSelect, marked = [], onMonthChange }) {
  const base = selected ? new Date(`${selected}T00:00:00`) : new Date();
  const [view, setView] = useState({
    year: base.getFullYear(),
    month: base.getMonth(),
  });
  const markedSet = new Set(marked);

  const todayISO = toISODate(new Date());
  const startWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prev = () =>
    setView((v) => {
      const next = v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 };
      onMonthChange?.(next);
      return next;
    });
  const next = () =>
    setView((v) => {
      const next = v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 };
      onMonthChange?.(next);
      return next;
    });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-heading text-sm font-semibold text-foreground">
          {MONTHS[view.month]} {view.year}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous month"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next month"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={`b-${i}`} />;
          const iso = toISODate(new Date(view.year, view.month, d));
          const dow = new Date(view.year, view.month, d).getDay();
          const weekend = dow === 0 || dow === 6;
          const isSelected = iso === selected;
          const isToday = iso === todayISO;
          const isMarked = markedSet.has(iso);

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-lg text-sm transition-colors",
                isSelected
                  ? "bg-primary font-semibold text-primary-foreground"
                  : isToday
                    ? "bg-primary/10 font-semibold text-primary"
                    : weekend
                      ? "text-slate-300 hover:bg-slate-100"
                      : "text-foreground hover:bg-slate-100"
              )}
            >
              {d}
              {isMarked && (
                <span
                  className={cn(
                    "absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full",
                    isSelected ? "bg-white" : "bg-primary"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
