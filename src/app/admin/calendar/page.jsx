"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarOff, CalendarRange, ChevronLeft, ChevronRight,
  Flag, Loader2, Pencil, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/dashboard-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const DOW_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const TYPE_LABEL = { holiday: "Holiday", suspension: "Suspension", other: "Other", online_class: "Online Class" };

const TYPE_CELL = {
  holiday:      "bg-sky-50  hover:bg-sky-100  dark:bg-sky-950/50  dark:hover:bg-sky-900/60",
  suspension:   "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60",
  other:        "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-700/50",
  online_class: "bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/50 dark:hover:bg-violet-900/60",
};

const TYPE_TEXT = {
  holiday:      "text-sky-700    dark:text-sky-300",
  suspension:   "text-amber-700  dark:text-amber-300",
  other:        "text-slate-600  dark:text-slate-400",
  online_class: "text-violet-700 dark:text-violet-300",
};

const TYPE_CHIP = {
  holiday:      "bg-sky-100   text-sky-700   dark:bg-sky-900/60   dark:text-sky-300",
  suspension:   "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  other:        "bg-slate-100 text-slate-700 dark:bg-slate-700    dark:text-slate-300",
  online_class: "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
};

const TYPE_DOT = {
  holiday:      "bg-sky-500",
  suspension:   "bg-amber-500",
  other:        "bg-slate-400",
  online_class: "bg-violet-500",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function fmtLong(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function isoToInput(iso) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

// ── Month grid ────────────────────────────────────────────────────────────────

function MonthGrid({ year, month, dayMap, today, onDayClick }) {
  const cells = useMemo(() => {
    const firstDow    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < firstDow; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(
        `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      );
    }
    return out;
  }, [year, month]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {DOW_LABELS.map((d) => (
          <div key={d} className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border">
        {cells.map((dateStr, i) => {
          if (!dateStr) {
            return <div key={`empty-${i}`} className="min-h-[44px] bg-muted/10 dark:bg-muted/5" />;
          }
          const entry   = dayMap[dateStr] ?? null;
          const isToday = dateStr === today;
          const dom     = parseInt(dateStr.slice(8), 10);
          const cellBg  = entry
            ? (TYPE_CELL[entry.type] ?? TYPE_CELL.other)
            : "bg-card hover:bg-muted/30";
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onDayClick(dateStr, entry)}
              className={cn(
                "min-h-[44px] w-full p-1 text-left transition-colors",
                "focus:outline-none focus-visible:relative focus-visible:z-10",
                "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                cellBg,
              )}
            >
              <span className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                isToday ? "bg-primary text-primary-foreground" : "text-foreground/80",
              )}>
                {dom}
              </span>
              {entry && (
                <span className={cn(
                  "mt-0.5 block w-full truncate text-[9px] font-semibold leading-snug",
                  TYPE_TEXT[entry.type] ?? TYPE_TEXT.other,
                )}>
                  {entry.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Day detail / add modal ────────────────────────────────────────────────────

function DayModal({ dateStr, existing, today, onClose, onCreated, onDeleted, readOnly }) {
  const isToday = dateStr === today;
  const [type,       setType]       = useState("holiday");
  const [label,      setLabel]      = useState("");
  const [saving,     setSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!label.trim()) { toast.error("Label is required."); return; }
    setSaving(true);
    try {
      const body = { date: dateStr, type, label: label.trim() };
      const res  = await api.post("/calendar", body);
      toast.success("No-class day declared.");
      onCreated(res.day);
      onClose();
    } catch (err) {
      toast.error(err.message ?? "Could not declare.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/calendar/${existing._id}`);
      toast.success(`Removed: ${existing.label}`);
      onDeleted(existing._id);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={fmtLong(dateStr)}>
      {existing ? (
        confirmDel ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Remove{" "}
              <span className="font-semibold text-foreground">{existing.label}</span>?{" "}
              Attendance marking will be allowed again on this date.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDel(false)} disabled={deleting}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="size-4 animate-spin" /> : "Remove"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", TYPE_CHIP[existing.type] ?? TYPE_CHIP.other)}>
                {TYPE_LABEL[existing.type] ?? existing.type}
              </span>
              {isToday && (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Today</span>
              )}
            </div>
            <p className="text-base font-semibold text-foreground">{existing.label}</p>
            {existing.createdBy?.name && (
              <p className="text-xs text-muted-foreground">Added by {existing.createdBy.name}</p>
            )}
            {readOnly && (
              <p className="text-xs text-muted-foreground italic">
                Historical year — read-only.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose}>Close</Button>
              {!readOnly && (
                <Button variant="destructive" onClick={() => setConfirmDel(true)}>
                  <Trash2 className="size-4" /> Remove
                </Button>
              )}
            </div>
          </div>
        )
      ) : (
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dm-type">Type</Label>
              <Select id="dm-type" value={type} onChange={(e) => setType(e.target.value)} className="h-10">
                <option value="holiday">Holiday</option>
                <option value="suspension">Suspension</option>
                <option value="other">Other</option>
                <option value="online_class">Online Class</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dm-label">Label <span className="text-destructive">*</span></Label>
              <Input
                id="dm-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Independence Day"
                className="h-10"
                autoFocus
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarOff className="size-4" />}
              {type === "online_class" ? "Declare online class day" : "Declare no-class day"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────────

export default function SchoolCalendarPage() {
  const now = new Date();

  // Calendar
  const [days,    setDays]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate,     setSelectedDate]     = useState(null);
  const [selectedExisting, setSelectedExisting] = useState(null);

  // School years
  const [years,     setYears]     = useState([]);
  const [phLoading, setPhLoading] = useState(false);

  // End school year modal
  const [endOpen,    setEndOpen]    = useState(false);
  const [ending,     setEnding]     = useState(false);

  // Start school year modal
  const [startOpen,  setStartOpen]  = useState(false);
  const [newName,    setNewName]    = useState("");
  const [newStart,   setNewStart]   = useState("");
  const [newEnd,     setNewEnd]     = useState("");
  const [startErr,   setStartErr]   = useState("");
  const [starting,   setStarting]   = useState(false);

  // Edit dates modal
  const [editDatesOpen, setEditDatesOpen] = useState(false);
  const [editDatesForm, setEditDatesForm] = useState({ startDate: "", endDate: "" });
  const [editDatesErr,  setEditDatesErr]  = useState("");
  const [savingDates,   setSavingDates]   = useState(false);

  const today = todayStr();

  const dayMap = useMemo(
    () => Object.fromEntries(days.map((d) => [d.date, d])),
    [days]
  );

  const activeYear = years.find((y) => y.isActive) ?? null;

  const phYears = useMemo(() => {
    if (!activeYear) return [now.getFullYear()];
    const y1 = new Date(activeYear.startDate).getFullYear();
    const y2 = new Date(activeYear.endDate).getFullYear();
    return y1 === y2 ? [y1] : [y1, y2];
  }, [activeYear]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    try {
      const [calData, syData] = await Promise.all([
        api.get("/calendar"),
        api.get("/school-years"),
      ]);
      setDays(Array.isArray(calData) ? calData : []);
      setYears(Array.isArray(syData) ? syData : []);
    } catch {
      toast.error("Could not load calendar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── End school year ───────────────────────────────────────────────────────
  const handleEnd = async () => {
    if (!activeYear || ending) return;
    setEnding(true);
    try {
      await api.patch(`/school-years/${activeYear._id}/end`, {});
      toast.success(`${activeYear.name} has ended. Student records archived.`);
      setEndOpen(false);
      loadAll();
    } catch (err) {
      toast.error(err.message || "Could not end school year.");
    } finally {
      setEnding(false);
    }
  };

  // ── Start school year ────────────────────────────────────────────────────
  const openStart = () => {
    setNewName(""); setNewStart(""); setNewEnd(""); setStartErr("");
    setStartOpen(true);
  };

  const handleStart = async (e) => {
    e.preventDefault();
    if (!newName.trim())    { setStartErr("Name is required.");                   return; }
    if (!newStart)          { setStartErr("Start date is required.");              return; }
    if (!newEnd)            { setStartErr("End date is required.");                return; }
    if (newStart >= newEnd) { setStartErr("Start date must be before end date."); return; }
    if (starting) return;
    setStarting(true);
    setStartErr("");
    try {
      const created = await api.post("/school-years", {
        name: newName.trim(), startDate: newStart, endDate: newEnd,
      });
      await api.patch(`/school-years/${created._id}/activate`, {});
      toast.success(`${newName.trim()} is now the active school year.`);
      setStartOpen(false);
      loadAll();
    } catch (err) {
      setStartErr(err.message || "Could not start school year.");
    } finally {
      setStarting(false);
    }
  };

  // ── Calendar nav ──────────────────────────────────────────────────────────
  function prevMonth() {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  }
  function goToday() { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()); }

  function handleDayClick(dateStr, existing) {
    setSelectedDate(dateStr);
    setSelectedExisting(existing ?? null);
  }
  function closeDay() { setSelectedDate(null); setSelectedExisting(null); }
  function handleCreated(day) {
    setDays((prev) => [...prev, day].sort((a, b) => a.date.localeCompare(b.date)));
  }
  function handleDeleted(id) {
    setDays((prev) => prev.filter((d) => d._id !== id));
  }

  // ── PH Holidays ───────────────────────────────────────────────────────────
  async function handleLoadPH() {
    setPhLoading(true);
    try {
      let totalCreated = 0, totalSkipped = 0;
      const newDays = [];
      for (const y of phYears) {
        const res = await api.post("/calendar/load-ph-holidays", { year: y });
        totalCreated += res.created ?? 0;
        totalSkipped += res.skipped ?? 0;
        newDays.push(...(res.days ?? []));
      }
      if (totalCreated === 0) {
        toast.info(`All ${totalSkipped} Philippine holiday${totalSkipped !== 1 ? "s" : ""} already exist.`);
      } else {
        toast.success(
          totalSkipped > 0
            ? `${totalCreated} holiday${totalCreated !== 1 ? "s" : ""} added, ${totalSkipped} already existed.`
            : `${totalCreated} Philippine holiday${totalCreated !== 1 ? "s" : ""} added.`
        );
      }
      if (newDays.length > 0) {
        setDays((prev) => [...prev, ...newDays].sort((a, b) => a.date.localeCompare(b.date)));
      }
    } catch (err) {
      toast.error(err.message ?? "Could not load PH holidays.");
    } finally {
      setPhLoading(false);
    }
  }

  // ── Edit active year dates ────────────────────────────────────────────────
  const openEditDates = () => {
    if (!activeYear) return;
    setEditDatesForm({ startDate: isoToInput(activeYear.startDate), endDate: isoToInput(activeYear.endDate) });
    setEditDatesErr("");
    setEditDatesOpen(true);
  };

  const handleSaveDates = async (e) => {
    e.preventDefault();
    if (!editDatesForm.startDate || !editDatesForm.endDate) {
      setEditDatesErr("Both dates are required."); return;
    }
    if (editDatesForm.startDate >= editDatesForm.endDate) {
      setEditDatesErr("Start date must be before end date."); return;
    }
    if (savingDates) return;
    setSavingDates(true);
    try {
      const updated = await api.put(`/school-years/${activeYear._id}`, {
        startDate: editDatesForm.startDate,
        endDate:   editDatesForm.endDate,
      });
      setYears((prev) => prev.map((y) => y._id === updated._id ? updated : y));
      toast.success("School year dates updated.");
      setEditDatesOpen(false);
    } catch (err) {
      setEditDatesErr(err.message || "Could not save dates.");
    } finally {
      setSavingDates(false);
    }
  };

  const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth();

  return (
    <>
      <PageHeader
        title="School Calendar"
        subtitle="Manage academic year dates, holidays, suspensions, and school-year status."
      />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">

        {/* ══ Left panel — school year management ══════════════════════════════ */}
        <div className="space-y-4">

          {/* Active year card */}
          {loading ? (
            <div className="flex h-24 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : activeYear ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Active School Year
              </p>
              <p className="mt-1 text-base font-bold text-foreground leading-tight">{activeYear.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {fmtDate(activeYear.startDate)} → {fmtDate(activeYear.endDate)}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={openEditDates}
                  className="flex items-center gap-1 rounded-md border border-border bg-card/70 px-2.5 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-card hover:text-foreground"
                >
                  <Pencil className="size-3" />
                  Edit dates
                </button>
                <button
                  type="button"
                  onClick={() => setEndOpen(true)}
                  className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40"
                >
                  End School Year
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card p-4 text-center">
              <CalendarRange className="mx-auto size-6 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium text-muted-foreground">No active school year</p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">Start a school year to enable the calendar.</p>
              <button
                type="button"
                onClick={openStart}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Start School Year
              </button>
            </div>
          )}

        </div>

        {/* ══ Right panel — calendar ════════════════════════════════════════════ */}
        <div className="space-y-3">

          {/* Toolbar: month nav + PH Holidays */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="size-4" />
              </button>
              <h2 className="ml-1 text-sm font-semibold text-foreground">
                {MONTH_NAMES[calMonth]} {calYear}
              </h2>
              <button
                type="button"
                onClick={goToday}
                disabled={isCurrentMonth}
                className="ml-2 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
              >
                Today
              </button>
            </div>

            <button
              type="button"
              onClick={handleLoadPH}
              disabled={phLoading}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:hover:border-sky-800 dark:hover:bg-sky-950/30 dark:hover:text-sky-400 disabled:opacity-50 disabled:pointer-events-none"
            >
              {phLoading
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Flag className="size-3.5" />}
              Load PH Holidays {phYears.join(" & ")}
            </button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {[
              { type: "holiday",      label: "Holiday" },
              { type: "suspension",   label: "Suspension" },
              { type: "other",        label: "Other" },
              { type: "online_class", label: "Online Class" },
            ].map(({ type, label }) => (
              <span key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-2 shrink-0 rounded-full", TYPE_DOT[type])} />
                {label}
              </span>
            ))}
            <span className="ml-auto text-[11px] italic text-muted-foreground/60">
              Click any date to declare or view
            </span>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <MonthGrid
              year={calYear}
              month={calMonth}
              dayMap={dayMap}
              today={today}
              onDayClick={handleDayClick}
            />
          )}

        </div>
      </div>

      {/* ── Day detail / add modal ─────────────────────────────────────────── */}
      {selectedDate && (
        <DayModal
          dateStr={selectedDate}
          existing={selectedExisting}
          today={today}
          onClose={closeDay}
          onCreated={handleCreated}
          onDeleted={handleDeleted}
          readOnly={false}
        />
      )}

      {/* ── End school year modal ─────────────────────────────────────────── */}
      <Modal
        open={endOpen}
        onClose={() => { if (!ending) setEndOpen(false); }}
        title="End School Year"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            End <span className="font-semibold text-foreground">{activeYear?.name}</span>?
          </p>
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-red-800 dark:text-red-300">The following will happen immediately:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-xs text-red-700 dark:text-red-400">
              <li>All student records will be archived</li>
              <li>All sections will be removed</li>
              <li>The school year will become inactive</li>
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <strong>Not affected:</strong> attendance records, teacher accounts, guidance cases, and calendar events.
            You can start a new school year immediately after.
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" disabled={ending} onClick={() => setEndOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleEnd} disabled={ending}>
              {ending ? <><Loader2 className="size-4 animate-spin" />Ending…</> : "End School Year"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Start school year modal ───────────────────────────────────────── */}
      <Modal
        open={startOpen}
        onClose={() => { if (!starting) { setStartOpen(false); setStartErr(""); } }}
        title="Start School Year"
      >
        <form onSubmit={handleStart} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sy-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="sy-name"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setStartErr(""); }}
              placeholder="e.g. 2026–2027"
              className="h-11"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sy-start">Start Date <span className="text-destructive">*</span></Label>
              <Input id="sy-start" type="date" value={newStart} onChange={(e) => { setNewStart(e.target.value); setStartErr(""); }} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sy-end">End Date <span className="text-destructive">*</span></Label>
              <Input id="sy-end" type="date" value={newEnd} onChange={(e) => { setNewEnd(e.target.value); setStartErr(""); }} className="h-11" />
            </div>
          </div>
          {startErr && <p className="text-xs text-destructive">{startErr}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" disabled={starting} onClick={() => { setStartOpen(false); setStartErr(""); }}>Cancel</Button>
            <Button type="submit" disabled={starting}>
              {starting ? <><Loader2 className="size-4 animate-spin" />Starting…</> : "Start School Year"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit active year dates modal ───────────────────────────────────── */}
      <Modal
        open={editDatesOpen}
        onClose={() => { if (!savingDates) { setEditDatesOpen(false); setEditDatesErr(""); } }}
        title={`Edit Dates — ${activeYear?.name ?? ""}`}
      >
        <form onSubmit={handleSaveDates} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ed-start">Start Date</Label>
              <Input
                id="ed-start"
                type="date"
                value={editDatesForm.startDate}
                onChange={(e) => { setEditDatesForm((f) => ({ ...f, startDate: e.target.value })); setEditDatesErr(""); }}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-end">End Date</Label>
              <Input
                id="ed-end"
                type="date"
                value={editDatesForm.endDate}
                onChange={(e) => { setEditDatesForm((f) => ({ ...f, endDate: e.target.value })); setEditDatesErr(""); }}
                className="h-11"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Changing these dates affects how the prescriptive engine calculates the 20% absence
            threshold. Historical attendance records are not altered.
          </p>
          {editDatesErr && <p className="text-xs text-destructive">{editDatesErr}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" disabled={savingDates} onClick={() => { setEditDatesOpen(false); setEditDatesErr(""); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingDates}>
              {savingDates ? <><Loader2 className="size-4 animate-spin" />Saving…</> : "Save dates"}
            </Button>
          </div>
        </form>
      </Modal>

    </>
  );
}
