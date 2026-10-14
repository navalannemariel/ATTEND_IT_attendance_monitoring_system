"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, BookOpen, Clock, Users, CalendarX } from "lucide-react";
import { resolveAttendanceStatus } from "@/lib/attendanceResolver";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtTime(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh   = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDays(daysOfWeek) {
  if (!daysOfWeek?.length) return "—";
  return daysOfWeek.map((d) => DAY_LABELS[d]).join(" / ");
}

// ── Mini calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({ year, month, selectedDate, onSelect, onPrev, onNext, syStart, syEnd }) {
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
          const day        = i + 1;
          const dateStr    = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday    = dateStr === todayStr;
          const isFuture   = dateStr > todayStr;
          const isOutsideSY = (syStart && dateStr < syStart) || (syEnd && dateStr > syEnd);
          const isDisabled  = isFuture || isOutsideSY;
          const isSelected  = dateStr === selectedDate;

          return (
            <button
              key={day}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(dateStr)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-[11px] transition-colors",
                isDisabled
                  ? "cursor-not-allowed text-muted-foreground/25"
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

// ── Attendance modal helpers ──────────────────────────────────────────────────

const STATUS_CFG = {
  present:  { label: "Present",        cls: "text-emerald-600" },
  late:     { label: "Late",           cls: "text-amber-600"   },
  absent:   { label: "Absent",         cls: "text-red-600"     },
  excused:  { label: "Excused",        cls: "text-blue-600"    },
  pending:  { label: "Not yet marked", cls: "text-muted-foreground" },
};

const NCD_STYLE = {
  holiday:    "bg-emerald-50 ring-emerald-200 text-emerald-800",
  suspension: "bg-amber-50 ring-amber-200 text-amber-800",
  other:      "bg-slate-50 ring-slate-200 text-slate-700",
};

// Resolves a single student's attendance status for the given display mode.
// mode 'room_scan' | 'resolved' — uses resolveAttendanceStatus (mirrors teacher/attendance).
//   When room_scan mode returns 'pending' (gate absent but room scan exists),
//   fall back to the room_scan record's own status so subject teachers see a real value.
// mode 'fallback' — no room scan and no manual/auto_absent; show gate_scan status directly
//   (resolveAttendanceStatus would return 'pending' for gate-only, which is misleading here).
// "Juan dela Cruz" → "Dela Cruz, Juan"
function surnameFirst(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const surname = parts[parts.length - 1];
  const given   = parts.slice(0, -1).join(" ");
  return `${surname}, ${given}`;
}

function resolveStudentStatus(recs, mode) {
  if (!recs.length) return null;
  if (mode === "fallback") {
    const gate = recs.find((r) => r.source === "gate_scan");
    return gate?.status ?? null;
  }
  // 'room_scan' or 'resolved'
  const status = resolveAttendanceStatus(recs);
  if (status === "pending" && mode === "room_scan") {
    const roomRec = recs
      .filter((r) => r.source === "room_scan")
      .sort((a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0))[0];
    return roomRec?.status ?? null;
  }
  return status || null;
}

function StatusChip({ status }) {
  const cfg = STATUS_CFG[status];
  if (!cfg) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <span className={cn("text-sm font-medium", cfg.cls)}>
      {cfg.label}
    </span>
  );
}

// ── Subject attendance modal ──────────────────────────────────────────────────

function SubjectAttendanceModal({ context, open, onClose }) {
  const today = new Date();
  const [calYear,      setCalYear]      = useState(today.getFullYear());
  const [calMonth,     setCalMonth]     = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(toISODate(today));
  const [rows,         setRows]         = useState([]);    // [{ name, status: string|null }]
  const [sourceMode,   setSourceMode]   = useState(null);  // 'room_scan'|'resolved'|'fallback'|'outside_sy'
  const [noClassInfo,  setNoClassInfo]  = useState(null);  // { label, type } | null
  const [syBounds,     setSyBounds]     = useState({ start: null, end: null });
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  // Stable caches for the modal session
  const noClassDaysRef  = useRef(null);
  const rosterRef       = useRef(null); // { sectionId: string, students: [] }
  const schoolYearRef   = useRef(null); // { start: string|null, end: string|null }

  useEffect(() => {
    if (!open || !context) return;
    setLoading(true);
    setError(null);
    setRows([]);
    setSourceMode(null);
    setNoClassInfo(null);

    const bySection = (r) => String(r.sectionId) === context.sectionId;

    // Roster: cached per section
    const rosterPromise =
      rosterRef.current?.sectionId === context.sectionId
        ? Promise.resolve(rosterRef.current.students)
        : api.get(`/users/students?sectionId=${context.sectionId}`)
            .then((d) => {
              const surname = (name) => name.trim().split(/\s+/).slice(-1)[0].toLowerCase();
              const students = Array.isArray(d)
                ? d.slice().sort((a, b) => surname(a.name).localeCompare(surname(b.name)))
                : [];
              rosterRef.current = { sectionId: context.sectionId, students };
              return students;
            })
            .catch(() => []);

    // Calendar no-class days: cached for modal lifetime
    const calPromise =
      noClassDaysRef.current !== null
        ? Promise.resolve(noClassDaysRef.current)
        : api.get("/calendar")
            .then((d) => {
              noClassDaysRef.current = Array.isArray(d) ? d : [];
              return noClassDaysRef.current;
            })
            .catch(() => { noClassDaysRef.current = []; return []; });

    // School year bounds: cached for modal lifetime
    const syPromise =
      schoolYearRef.current !== null
        ? Promise.resolve(schoolYearRef.current)
        : api.get("/school-years")
            .then((ys) => {
              const active = Array.isArray(ys) ? ys.find((y) => y.isActive) : null;
              const sy = {
                start: active?.startDate?.slice(0, 10) ?? null,
                end:   active?.endDate?.slice(0, 10)   ?? null,
              };
              schoolYearRef.current = sy;
              setSyBounds(sy);
              return sy;
            })
            .catch(() => {
              const sy = { start: null, end: null };
              schoolYearRef.current = sy;
              return sy;
            });

    // Attendance: all sources for this date
    const attPromise = api.get(`/attendance?date=${selectedDate}`);

    Promise.all([rosterPromise, calPromise, syPromise, attPromise])
      .then(([students, ncdList, sy, attData]) => {
        // Dates outside the active school year — no attendance data exists
        if ((sy.start && selectedDate < sy.start) || (sy.end && selectedDate > sy.end)) {
          setSourceMode("outside_sy");
          return;
        }

        // Flag NCD but continue processing — records may exist from before the suspension was declared
        const ncd = ncdList.find((d) => d.date === selectedDate);
        if (ncd) setNoClassInfo({ label: ncd.label, type: ncd.type });

        // Filter records to this section (teacher API has no server-side sectionId filter)
        const recs = (Array.isArray(attData) ? attData : []).filter(bySection);

        // Determine display mode — mirrors teacher/attendance source logic:
        //   room_scan present             → Mode 1: resolved, no warning
        //   no room_scan + manual/auto_absent → Mode 3: already corrected, no warning
        //   no room_scan, no resolution   → Mode 2: gate scan fallback, show warning
        const hasRoomScan = recs.some((r) => r.source === "room_scan");
        const hasResolved = !hasRoomScan && recs.some(
          (r) => r.source === "manual" || r.source === "auto_absent"
        );
        const mode = hasRoomScan ? "room_scan" : hasResolved ? "resolved" : "fallback";
        setSourceMode(mode);

        // Group records by student name
        const byName = {};
        for (const r of recs) {
          const n = r.studentName ?? "";
          if (!n) continue;
          if (!byName[n]) byName[n] = [];
          byName[n].push(r);
        }

        // One row per enrolled student — no record → status null (renders as "—")
        setRows(
          students.map((s) => ({
            name:   s.name,
            gender: s.gender ?? null,
            status: resolveStudentStatus(byName[s.name] ?? [], mode),
          }))
        );
      })
      .catch((err) => setError(err.message || "Could not load records."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, context?.id, selectedDate]);

  function prevMonth() {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    if (calYear > now.getFullYear() || (calYear === now.getFullYear() && calMonth >= now.getMonth())) return;
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  }

  if (!context) return null;

  const fmtDate = (str) => {
    if (!str) return "";
    try {
      return new Date(`${str}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });
    } catch { return str; }
  };

  return (
    <Modal open={open} onClose={onClose} title={context.label} size="xl">
      <div className="flex gap-6">
        {/* Calendar panel */}
        <div className="w-56 shrink-0 rounded-xl border border-border bg-card p-3 shadow-sm">
          <MiniCalendar
            year={calYear} month={calMonth} selectedDate={selectedDate}
            onSelect={setSelectedDate} onPrev={prevMonth} onNext={nextMonth}
            syStart={syBounds.start} syEnd={syBounds.end}
          />
        </div>

        {/* Attendance panel */}
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{fmtDate(selectedDate)}</p>

          {/* Gate scan fallback note — only shown when there are actual gate scan records to display */}
          {!loading && sourceMode === "fallback" && rows.some((r) => r.status !== null) && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-200">
              Room Scan is not available. Here is the Gate Scan attendance.
            </p>
          )}

          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : sourceMode === "outside_sy" ? (
            <div className="rounded-xl bg-slate-50 px-4 py-5 ring-1 ring-slate-200 text-slate-700">
              <div className="flex items-center gap-2">
                <CalendarX className="size-4 shrink-0 text-slate-400" />
                <p className="font-semibold text-sm">Outside school year</p>
              </div>
              <p className="mt-1 pl-6 text-xs opacity-70">This date is not part of the active school year.</p>
            </div>
          ) : (
            <>
              {noClassInfo && (
                <div className={cn("mb-4 rounded-xl px-4 py-3 ring-1", NCD_STYLE[noClassInfo.type] ?? NCD_STYLE.other)}>
                  <div className="flex items-center gap-2">
                    <CalendarX className="size-4 shrink-0" />
                    <p className="font-semibold text-sm">{noClassInfo.label}</p>
                  </div>
                  <p className="mt-1 pl-6 text-xs opacity-70">No classes are held on this date.</p>
                </div>
              )}
              {rows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Users className="size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No students enrolled in this section.</p>
                </div>
              ) : !rows.some((r) => r.status !== null) ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Users className="size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    {noClassInfo
                      ? "No attendance was recorded before the suspension."
                      : "No attendance records for this date."}
                  </p>
                </div>
              ) : (
            (() => {
              const males   = rows.filter((r) => r.gender === "male");
              const females = rows.filter((r) => r.gender === "female");
              const noGender = rows.filter((r) => !r.gender);
              const groups = [
                ...(males.length   ? [{ label: "Male",   list: males   }] : []),
                ...(females.length ? [{ label: "Female", list: females }] : []),
                ...(noGender.length ? [{ label: "—",     list: noGender }] : []),
              ];
              return (
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="grid grid-cols-[1fr_110px] border-b border-border bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Student</span>
                    <span>Status</span>
                  </div>
                  <div className="max-h-[55vh] overflow-y-auto divide-y divide-border">
                    {groups.map((g) => (
                      <div key={g.label}>
                        {groups.length > 1 && (
                          <div className="bg-muted/30 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {g.label}
                          </div>
                        )}
                        {g.list.map((r) => (
                          <div key={r.name} className="grid grid-cols-[1fr_110px] items-center px-4 py-2.5 border-t border-border first:border-t-0">
                            <p className="truncate text-sm font-medium text-foreground">{surnameFirst(r.name)}</p>
                            <StatusChip status={r.status} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Schedule card ─────────────────────────────────────────────────────────────

function ScheduleCard({ context, onClick }) {
  const start = fmtTime(context.startTime);
  const end   = fmtTime(context.endTime);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full rounded-2xl border bg-card p-5 text-left shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        context.isCurrent
          ? "border-primary/50 ring-2 ring-primary/20"
          : "border-border"
      )}
    >
      {context.isCurrent && (
        <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
          NOW
        </span>
      )}

      <div className="mb-3 flex items-start gap-3">
        <div className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          context.isCurrent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}>
          <BookOpen className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground leading-tight">
            {context.subjectName}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{context.sectionName}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3 shrink-0" />
        <span>{formatDays(context.daysOfWeek)}</span>
        {start && end && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span>{start} – {end}</span>
          </>
        )}
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [contexts, setContexts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [active,   setActive]   = useState(null);

  useEffect(() => {
    api.get("/subjects/my-teaching-context")
      .then((data) => setContexts(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || "Could not load schedule."))
      .finally(() => setLoading(false));
  }, []);

  const subjects = contexts.filter((c) => c.type === "subject");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Click a subject card to view attendance records for any date.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
          Loading schedule…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : subjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <BookOpen className="mx-auto mb-3 size-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">No subjects assigned yet.</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Ask your administrator to assign you to subjects.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((ctx) => (
            <ScheduleCard key={ctx.id} context={ctx} onClick={() => setActive(ctx)} />
          ))}
        </div>
      )}

      <SubjectAttendanceModal
        context={active}
        open={!!active}
        onClose={() => setActive(null)}
      />
    </div>
  );
}
