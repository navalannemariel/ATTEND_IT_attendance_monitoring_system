"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileDown, ScanLine } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { exportToPdf } from "@/lib/export";
import { cn } from "@/lib/utils";

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sectionLabel(section) {
  if (!section) return "";
  return section.gradeLevel ? `${section.gradeLevel} – ${section.name}` : section.name;
}

// ── Mini calendar (date picker only — no status coloring) ──────────────────
function MiniCalendar({ year, month, selectedDate, onSelect, onPrev, onNext }) {
  const todayStr    = toISODate(new Date());
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel  = new Date(year, month, 1).toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
        <div className="flex gap-1">
          <button type="button" onClick={onPrev}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={onNext}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-xs">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}
        {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day      = i + 1;
          const dateStr  = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday  = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={day}
              type="button"
              disabled={isFuture}
              onClick={() => onSelect(dateStr)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-[11px] transition-colors",
                isFuture
                  ? "cursor-not-allowed text-muted-foreground/30"
                  : "cursor-pointer text-foreground/80 hover:ring-1 hover:ring-primary/50",
                isSelected && "bg-primary font-semibold text-primary-foreground ring-2 ring-primary ring-offset-1",
                !isSelected && isToday && "ring-2 ring-primary ring-offset-1"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Gate Scan Records modal ─────────────────────────────────────────────────
// Admin-only. Pick a date, see which students in this section have a
// gate_scan record for that date and what time they scanned in.
function GateScanRecordsModal({ open, onClose, section }) {
  const today = useMemo(() => new Date(), []);
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(toISODate(today));
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!open || !section?._id || !selectedDate) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get(`/attendance?date=${selectedDate}&source=gate_scan&sectionId=${section._id}`)
      .then((data) => {
        if (cancelled) return;
        const rows = (Array.isArray(data) ? data : [])
          .slice()
          .sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));
        setRecords(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Could not load gate scan records.");
        setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, section?._id, selectedDate]);

  function prevMonth() {
    setCalMonth((m) => {
      if (m === 0) { setCalYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }

  function nextMonth() {
    const now = new Date();
    if (calYear > now.getFullYear() || (calYear === now.getFullYear() && calMonth >= now.getMonth())) return;
    setCalMonth((m) => {
      if (m === 11) { setCalYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }

  function handleGeneratePdf() {
    const label = sectionLabel(section);
    exportToPdf(
      `Gate Scan Records — ${label} — ${selectedDate}`,
      [
        { key: "studentName", label: "Name" },
        { key: "timeIn",      label: "Gate Time In" },
      ],
      records.map((r) => ({ studentName: r.studentName, timeIn: r.timeIn || "—" }))
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Gate Scan Records — ${sectionLabel(section)}`} size="xl">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr]">
        {/* Calendar */}
        <div className="sm:w-64">
          <MiniCalendar
            year={calYear}
            month={calMonth}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            onPrev={prevMonth}
            onNext={nextMonth}
          />
        </div>

        {/* Records table */}
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <ScanLine className="size-4 text-muted-foreground" />
              {selectedDate}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGeneratePdf}
              disabled={loading || records.length === 0}
              className="gap-1.5"
            >
              <FileDown className="size-3.5" />
              Generate PDF
            </Button>
          </div>

          {loading ? (
            <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : error ? (
            <div className="rounded-lg border border-dashed border-destructive/30 py-10 text-center text-sm text-destructive">
              {error}
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No gate scan records for this date.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Gate Time In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.map((r) => (
                    <tr key={r._id}>
                      <td className="px-3 py-2 font-medium text-foreground">{r.studentName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.timeIn || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

export { GateScanRecordsModal };
