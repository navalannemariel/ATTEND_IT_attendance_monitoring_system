"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Clock, CalendarClock, Hash, GraduationCap,
  ChevronLeft, ChevronRight, ChevronDown,
  Mail, Phone, Lock, CheckCircle2, AlertTriangle,
  UserCheck, UserX, CircleCheck, Forward,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/dashboard/dashboard-ui";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { resolveAttendanceStatus, resolveByDate, computeAttendanceRate } from "@/lib/attendanceResolver";

const CAL_DAY_CLASSES = {
  present: "bg-emerald-100 text-emerald-700 font-semibold",
  late:    "bg-amber-100 text-amber-700 font-semibold",
  absent:  "bg-red-100 text-red-700 font-semibold",
  excused: "bg-sky-100 text-sky-700 font-semibold",
  pending: "bg-slate-100 text-slate-500 font-semibold",
};

const SOURCE_LABEL = {
  guidance_manual:             "Created by Guidance",
  teacher_referral:            "Teacher Referral",
  absence_percentage:          "System — Absence Rate",
  consecutive_absences:        "System — Consecutive Absences",
  failed_excuse_letter:        "System — Excuse Letter Failure",
  habitual_tardiness:          "System — Habitual Tardiness",
  cutting_classes:             "System — Cutting Classes",
  unexcused_absence_incidents: "System — Unexcused Incidents",
};

// Prescriptive rule sources that count toward the "Needs attention" header badge.
const PRESCRIPTIVE_SOURCES = new Set([
  "habitual_tardiness",
  "consecutive_absences",
  "unexcused_absence_incidents",
  "unexcused_absence_incidents_warning",
  "absence_percentage",
]);

// Whether a Case belongs to the attendance/MCDM intervention workflow — used
// ONLY to decide Current Intervention (below), never standing.needsAttention.
// A manual teacher_referral/guidance_manual Case can be about anything (a
// peer conflict, grades, a family situation) — an arbitrary open Case must
// not flip the attendance model's "current intervention" display.
//
// Backward compatibility: Case.attendanceRelated didn't exist before this
// change. Older documents simply don't have the field. Rather than treating
// `undefined` as false (which would silently hide still-active OLD automatic
// cases from Current Intervention) or true (which would resurrect the
// original too-broad bug for old manual/referral cases), we fall back to the
// one thing that's always been reliably knowable: whether creationSource is
// one of the 5 automatic rule sources (reusing PRESCRIPTIVE_SOURCES — same
// set, same meaning). An old teacher_referral/guidance_manual Case with no
// explicit flag is NOT assumed attendance-related — that would mean
// inferring it from free text, which this fix exists to avoid.
function isAttendanceRelatedCase(c) {
  if (typeof c.attendanceRelated === "boolean") return c.attendanceRelated;
  return PRESCRIPTIVE_SOURCES.has(c.creationSource);
}

// Phase 8B — MCDM Assessment/Prescription (student-detail.jsx display only).
// Human-readable labels for the 4 normalized (0-1) criteria the persisted
// StudentAssessment already carries — no scoring/thresholds here, just labels.
const CRITERION_LABELS = {
  absence:            "Absence",
  consecutiveAbsence: "Consecutive Absence",
  tardiness:          "Tardiness",
  unexcusedIncidents: "Unexcused Incidents",
};

function joinAnd(arr) {
  if (arr.length <= 1) return arr[0] ?? "";
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")}, and ${arr[arr.length - 1]}`;
}

// Deterministic, display-only: reads the already-computed criteria values and
// names whichever is largest (ties included) — no new thresholds, no scoring.
function topContributingFactors(criteria) {
  const entries = Object.entries(criteria ?? {});
  if (entries.length === 0) return [];
  const max = Math.max(...entries.map(([, v]) => v));
  if (max <= 0) return [];
  return entries.filter(([, v]) => v === max).map(([key]) => CRITERION_LABELS[key] ?? key);
}


function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localDateStr(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return toISODate(d);
}

function weekKey(dateStr) {
  const d   = new Date(`${dateStr}T12:00:00`);
  const dow = d.getDay();
  const monday = new Date(d.getTime() + (dow === 0 ? -6 : 1 - dow) * 86400000);
  return toISODate(monday);
}

function buildSchoolDays(syStartStr, todayStr, noClassSet) {
  if (!syStartStr || !todayStr) return [];
  const days = [];
  const cur  = new Date(`${syStartStr}T00:00:00`);
  const end  = new Date(`${todayStr}T00:00:00`);
  while (cur <= end) {
    const ds  = toISODate(cur);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6 && !noClassSet.has(ds)) days.push(ds);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

function normalizeRecord(r) {
  return {
    id:      r._id,
    student: r.studentName ?? "",
    date:    localDateStr(r.date ?? ""),
    timeIn:  r.timeIn ?? "—",
    status:  cap(r.status),
    source:  r.source ?? "manual",
  };
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtWindow(start, end) {
  if (!start || !end) return null;
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

// ── AttendanceCalendar ─────────────────────────────────────────────────────────
// Shared for both roles. When interactive=true (Guidance), past/today weekdays
// become clickable; selectedDates highlights them; onToggle fires on click.
function AttendanceCalendar({ year, month, dataMap, loading, onPrev, onNext,
  interactive = false, selectedDates, onToggle }) {
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

      <div className={cn("grid grid-cols-7 gap-0.5 text-xs", loading && "opacity-60")}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
        ))}
        {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day       = i + 1;
          const dateStr   = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dow       = new Date(year, month, day).getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isToday   = dateStr === todayStr;
          const isFuture  = dateStr > todayStr;
          const status    = (dataMap[dateStr] ?? "").toLowerCase();
          const isSelected = interactive && selectedDates?.has(dateStr);
          const canSelect  = interactive && !isWeekend && !isFuture;

          const attendanceColor = isWeekend
            ? "text-muted-foreground/30"
            : (CAL_DAY_CLASSES[status] ?? "text-foreground/50");

          const colorClass = isSelected
            ? "bg-primary font-semibold text-primary-foreground ring-2 ring-primary ring-offset-1"
            : attendanceColor;

          const baseClass = "flex aspect-square items-center justify-center rounded-md text-[11px]";

          if (canSelect) {
            return (
              <button key={day} type="button" onClick={() => onToggle(dateStr)}
                className={cn(
                  baseClass, colorClass, "cursor-pointer transition-colors",
                  !isSelected && isToday && "ring-2 ring-primary ring-offset-1",
                  !isSelected && !isToday && "hover:ring-1 hover:ring-primary/50"
                )}>
                {day}
              </button>
            );
          }

          return (
            <div key={day} className={cn(
              baseClass, colorClass,
              interactive && isFuture && !isWeekend && "opacity-40",
              !isSelected && isToday && "ring-2 ring-primary ring-offset-1"
            )}>
              {day}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3">
        {[["bg-emerald-400","Present"],["bg-amber-400","Late"],["bg-red-400","Absent"],["bg-sky-400","Excused"]].map(([dot, label]) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-2 rounded-sm", dot)} />{label}
          </div>
        ))}
        {interactive && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-sm bg-primary" />Selected
          </div>
        )}
      </div>
    </div>
  );
}

// ── MarkInterventionModal ─────────────────────────────────────────────────────
function MarkInterventionModal({ open, onClose, studentId, activeCases, onSuccess }) {
  const [checked, setChecked] = useState(new Set());
  const [note,    setNote]    = useState("");
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (open) {
      setChecked(new Set(activeCases.map((c) => c._id)));
      setNote("");
      setSaving(false);
    }
  }, [open, activeCases]);

  function toggle(id) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (checked.size === 0 || !note.trim()) return;
    setSaving(true);
    try {
      await api.post("/cases/mark-intervention", {
        studentId,
        interventionNote: note.trim(),
        caseIds: [...checked],
      });
      toast.success(`${checked.size} case${checked.size > 1 ? "s" : ""} resolved.`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message ?? "Failed to mark intervention.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Mark Intervention Done">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Select the cases this intervention addresses. All selected cases will be marked Resolved.
        </p>
        <div className="space-y-2">
          {activeCases.map((c) => (
            <label key={c._id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 hover:bg-muted/40">
              <input
                type="checkbox"
                checked={checked.has(c._id)}
                onChange={() => toggle(c._id)}
                className="mt-0.5 size-4 rounded border-input"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{c.type}</p>
                <p className="text-xs text-muted-foreground">{SOURCE_LABEL[c.creationSource] ?? c.creationSource}</p>
                {c.triggerReason && (
                  <p className="mt-1 text-xs text-foreground/70 leading-snug">{c.triggerReason}</p>
                )}
              </div>
            </label>
          ))}
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">
            Intervention note <span className="font-normal text-muted-foreground">(required)</span>
          </p>
          <textarea
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            rows={4}
            placeholder="Describe what was done — talked with the student, parent contacted, follow-up scheduled…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || checked.size === 0 || !note.trim()}>
            <CheckCircle2 className="size-4" />
            {saving ? "Saving…" : `Mark ${checked.size} Case${checked.size !== 1 ? "s" : ""} Done`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── ReferToGuidanceModal ──────────────────────────────────────────────────────
// Two modes:
//   existing-case → link referral to one of the student's active Cases
//   other-matter  → enter a new concern; backend creates a teacher_referral Case
const OPEN_REFERRAL_STATUSES = ["Pending Review", "Accepted", "Pending", "Forwarded", "Scheduled"];

function ReferToGuidanceModal({ open, onClose, studentName, activeCases, referrals, onSubmit, saving }) {
  const hasActive = activeCases.length > 0;

  function caseHasPendingReferral(caseId) {
    return referrals.some((r) => {
      const refCaseId = r.case?._id ?? r.case;
      return refCaseId && String(refCaseId) === String(caseId) &&
        OPEN_REFERRAL_STATUSES.includes(r.status);
    });
  }

  // mode is null until user selects; auto-set to other-matter when no active cases
  const [mode,               setMode]               = useState(null);
  const [selectedCaseId,     setSelectedCaseId]     = useState("");
  const [note,               setNote]               = useState("");
  const [concern,            setConcern]            = useState("");
  // Explicit checkbox — never inferred from `concern`'s free text. Defaults
  // unchecked: a new "Other Matter" referral is not assumed attendance-related.
  const [attendanceRelated,  setAttendanceRelated]  = useState(false);

  useEffect(() => {
    if (open) {
      setMode(hasActive ? null : "other-matter");
      setSelectedCaseId("");
      setNote("");
      setConcern("");
      setAttendanceRelated(false);
    }
  }, [open, hasActive]);

  const selectedCaseIsBlocked = mode === "existing-case" && selectedCaseId && caseHasPendingReferral(selectedCaseId);

  const canSubmit = !saving && !selectedCaseIsBlocked && (
    (mode === "existing-case" && selectedCaseId) ||
    (mode === "other-matter"  && concern.trim())
  );

  function handleSubmit() {
    if (!canSubmit) return;
    if (mode === "existing-case") {
      // No new Case is created — the linked Case's own attendanceRelated
      // (set when IT was created) applies. Nothing to send here.
      onSubmit({ existingCaseId: selectedCaseId, reason: note.trim() || undefined });
    } else {
      onSubmit({ reason: concern.trim(), attendanceRelated });
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Refer to Guidance">
      <div className="space-y-4">
        {/* Mode selector — only shown when there are active cases */}
        {hasActive && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "existing-case", label: "Existing Case",  desc: "Link referral to an active case" },
              { key: "other-matter",  label: "Other Matter",   desc: "New concern not in the case list" },
            ].map(({ key, label, desc }) => (
              <button key={key} type="button"
                onClick={() => setMode(key)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-all",
                  mode === key
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border bg-background hover:bg-muted/50"
                )}>
                <p className={cn("text-sm font-semibold", mode === key ? "text-primary" : "text-foreground")}>{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* Existing Case mode */}
        {mode === "existing-case" && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Select a case to link this referral to:</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {activeCases.map((c) => {
                const blocked = caseHasPendingReferral(c._id);
                return (
                  <li key={c._id}>
                    <label className={cn(
                      "flex items-start gap-3 px-3 py-2.5",
                      blocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/40"
                    )}>
                      <input type="radio" name="referCase"
                        value={c._id}
                        checked={selectedCaseId === c._id}
                        onChange={() => !blocked && setSelectedCaseId(c._id)}
                        disabled={blocked}
                        className="mt-0.5 size-4 accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{c.type}</p>
                        <p className="text-xs text-muted-foreground">{SOURCE_LABEL[c.creationSource] ?? c.creationSource}</p>
                      </div>
                      {blocked && (
                        <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          Referral pending
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">
                Note to guidance <span className="font-normal text-muted-foreground">(optional)</span>
              </p>
              <textarea
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                rows={3}
                placeholder={`Add context about ${studentName}'s situation…`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
        )}

        {/* Other Matter mode */}
        {mode === "other-matter" && (
          <div className="space-y-2.5">
            <p className="mb-1.5 text-sm font-medium text-foreground">
              Describe your concern <span className="font-normal text-muted-foreground">(required)</span>
            </p>
            <textarea
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              rows={4}
              placeholder={`What concern would you like to refer about ${studentName}?`}
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              disabled={saving}
              autoFocus={!hasActive}
            />
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={attendanceRelated}
                onChange={(e) => setAttendanceRelated(e.target.checked)}
                disabled={saving}
              />
              This concern is attendance-related
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            <Forward className="size-4" />
            {saving ? "Referring…" : "Refer to Guidance"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function StudentDetail({ student, user, mode = "teacher", backHref }) {
  const studentId  = student._id ?? student.id;
  const isGuidance = mode === "guidance";
  const isTeacher  = mode === "teacher";

  // Attendance
  const [recentRaw,  setRecentRaw]  = useState([]);
  const [attLoading, setAttLoading] = useState(true);
  const [calYear,    setCalYear]    = useState(() => new Date().getFullYear());
  const [calMonth,   setCalMonth]   = useState(() => new Date().getMonth());
  const [calDataMap, setCalDataMap] = useState({});
  const [calLoading, setCalLoading] = useState(false);

  // School year (needed for prescriptive rule calculations)
  const [activeYear, setActiveYear] = useState(null);
  const [noClassSet, setNoClassSet] = useState(() => new Set());

  // Parent info
  const [parentInfo, setParentInfo] = useState(null);

  // Cases (both roles)
  const [cases,        setCases]        = useState([]);
  const [casesLoading, setCasesLoading] = useState(true);

  // Referrals (both roles)
  const [referrals, setReferrals] = useState([]);

  // Guidance notes (guidance only)
  const [notes,        setNotes]        = useState([]);
  const [notesLoading, setNotesLoading] = useState(isGuidance);

  // MCDM Assessment (Phase 8B) — read-only snapshot from GET .../assessment.
  // 'loading' | 'ready' | 'unavailable' (no assessment generated yet, a normal
  // state) | 'error' (an actual API failure) — never allowed to break the rest
  // of this page.
  const [assessment,       setAssessment]       = useState(null);
  const [assessmentStatus, setAssessmentStatus] = useState("loading");

  // Case accordions — Sets allow multiple panels open simultaneously
  const [openCaseIds,   setOpenCaseIds]   = useState(() => new Set());
  const [openHistIds,   setOpenHistIds]   = useState(() => new Set());
  const [noteForCaseId, setNoteForCaseId] = useState(null);

  // Guidance: interactive calendar date selection
  const [selDates,  setSelDates]  = useState(() => new Set());
  const [markStatus, setMarkStatus] = useState("Excused");
  const [markSaving, setMarkSaving] = useState(false);

  // Mark Intervention modal (guidance)
  const [interventionOpen, setInterventionOpen] = useState(false);

  // Refer to Guidance dialog (teacher)
  const [referOpen,   setReferOpen]   = useState(false);
  const [referSaving, setReferSaving] = useState(false);

  // Per-case note adding (guidance) — noteForCaseId doubles as the "adding" flag
  const [noteDraft,  setNoteDraft]  = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const today = useMemo(() => toISODate(new Date()), []);


  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    api.get("/school-years")
      .then((years) => {
        const active = (Array.isArray(years) ? years : []).find((y) => y.isActive);
        setActiveYear(active ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/calendar")
      .then((days) => setNoClassSet(new Set((Array.isArray(days) ? days : []).filter((d) => d.type !== "online_class").map((d) => d.date))))
      .catch(() => {});
  }, []);

  const loadAttendance = useCallback(() => {
    if (!student.name) return;
    setAttLoading(true);
    api.get(`/attendance?studentName=${encodeURIComponent(student.name)}`)
      .then((data) => setRecentRaw(Array.isArray(data) ? data : []))
      .catch(() => setRecentRaw([]))
      .finally(() => setAttLoading(false));
  }, [student.name]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  const loadCalendar = useCallback(() => {
    if (!student.name) return;
    setCalLoading(true);
    const monthStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
    api.get(`/attendance?studentName=${encodeURIComponent(student.name)}&month=${monthStr}`)
      .then((data) => {
        const recs = Array.isArray(data) ? data : [];
        const byDate = {};
        for (const r of recs) {
          const d = localDateStr(r.date ?? "");
          if (!d) continue;
          if (!byDate[d]) byDate[d] = [];
          byDate[d].push(r);
        }
        const map = {};
        for (const [d, dayRecs] of Object.entries(byDate)) {
          map[d] = resolveAttendanceStatus(dayRecs) ?? "";
        }
        setCalDataMap(map);
      })
      .catch(() => setCalDataMap({}))
      .finally(() => setCalLoading(false));
  }, [student.name, calYear, calMonth]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  useEffect(() => {
    if (!studentId) return;
    api.get(`/users/parent-of/${studentId}`)
      .then((data) => setParentInfo(data))
      .catch(() => setParentInfo(null));
  }, [studentId]);

  const loadCases = useCallback(() => {
    if (!studentId) return;
    setCasesLoading(true);
    api.get(`/cases?studentId=${studentId}`)
      .then((data) => setCases(Array.isArray(data) ? data : []))
      .catch(() => setCases([]))
      .finally(() => setCasesLoading(false));
  }, [studentId]);

  useEffect(() => { loadCases(); }, [loadCases]);

  const loadReferrals = useCallback(() => {
    if (!studentId) return;
    api.get(`/referrals?studentId=${studentId}`)
      .then((data) => setReferrals(Array.isArray(data) ? data : []))
      .catch(() => setReferrals([]));
  }, [studentId]);

  useEffect(() => { loadReferrals(); }, [loadReferrals]);

  const loadNotes = useCallback(() => {
    if (!isGuidance || !studentId) return;
    setNotesLoading(true);
    api.get(`/guidance-notes?studentId=${studentId}`)
      .then((data) => setNotes(Array.isArray(data) ? data : []))
      .catch(() => setNotes([]))
      .finally(() => setNotesLoading(false));
  }, [isGuidance, studentId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // Reads the persisted MCDM snapshot as-is — no recomputation in the browser.
  // A 404 for "no assessment generated yet" (a normal state for many students)
  // is distinguished from any other failure so the two can be messaged
  // differently, without needing to touch the shared api.js error type.
  const loadAssessment = useCallback(() => {
    if (!studentId) return;
    setAssessmentStatus("loading");
    api.get(`/users/students/${studentId}/assessment`)
      .then((data) => {
        setAssessment(data);
        setAssessmentStatus("ready");
      })
      .catch((err) => {
        setAssessment(null);
        setAssessmentStatus(
          err?.message === "No assessment available for this student yet." ? "unavailable" : "error"
        );
      });
  }, [studentId]);

  useEffect(() => { loadAssessment(); }, [loadAssessment]);

  // ── Derived values ────────────────────────────────────────────────────────

  const activeRecommendations = useMemo(() => {
    if (casesLoading) return [];
    return cases.filter(
      (c) => c.status !== "Resolved" && PRESCRIPTIVE_SOURCES.has(c.creationSource)
    );
  }, [cases, casesLoading]);

  const standing = useMemo(() => {
    const resolvedByDate = recentRaw.length > 0 ? resolveByDate(recentRaw, "date") : {};
    // Exclude NCD dates — records remain in DB but the day is not a countable school day
    const schoolDayResolved = noClassSet.size > 0
      ? Object.fromEntries(Object.entries(resolvedByDate).filter(([d]) => !noClassSet.has(d)))
      : resolvedByDate;
    const { present, late, absent, excused } = computeAttendanceRate(schoolDayResolved);
    const counts = { present, late, absent, excused };

    // Denominator: elapsed school days from S.Y. start through today, excluding
    // weekends and declared no-class days. Matches buildSchoolDays so rate and
    // calendar share the same "school day" definition.
    const syStart = activeYear?.startDate ? localDateStr(new Date(activeYear.startDate)) : null;
    const elapsed = syStart ? buildSchoolDays(syStart, today, noClassSet).length : 0;
    // "—" only when the S.Y. hasn't started yet (elapsed === 0 / no active year).
    // finalized === 0 with elapsed > 0 means no absences recorded yet → 100%.
    const finalized = present + late + absent;
    const rate = elapsed === 0
      ? null
      : finalized === 0
        ? 100
        : Math.round(((present + late) / elapsed) * 100);

    const history = recentRaw.length > 0 ? recentRaw.map(normalizeRecord) : [];
    return { history, counts, total: Object.keys(schoolDayResolved).length, rate, needsAttention: activeRecommendations.length > 0 };
  }, [recentRaw, activeRecommendations, noClassSet, activeYear, today]);

  // activeCases: ALL non-resolved Cases, any creationSource (automatic rule,
  // teacher_referral, or guidance_manual alike) — moved up from its render-time
  // declaration below so currentIntervention can use it. Deliberately NOT
  // standing.needsAttention/activeRecommendations, which are intentionally
  // scoped to automatic prescriptive-rule sources only for the "Needs
  // attention" header badge and must stay that way.
  const activeCases = cases.filter((c) => c.status !== "Resolved");

  // activeAttendanceCases: the subset of activeCases relevant to the MCDM
  // intervention workflow specifically (see isAttendanceRelatedCase above).
  // NOT the same thing as activeCases — a non-attendance manual/referral Case
  // stays in activeCases (still shown in the Active Cases panel, still usable
  // for "link to existing case", etc.) but is excluded here. Memoized (rather
  // than a plain filter like activeCases) because currentIntervention below
  // depends on it — a fresh array reference every render would defeat that
  // memoization.
  const activeAttendanceCases = useMemo(
    () => cases.filter((c) => c.status !== "Resolved" && isAttendanceRelatedCase(c)),
    [cases]
  );

  // "Current Intervention" — a DERIVED, display-only value. Never written back
  // to StudentAssessment; the persisted MCDM ranking (assessment.interventions)
  // is never mutated. While the student has at least one active,
  // attendance-related Case, the current intervention is the model's own
  // #1-ranked pick. Once no such Case remains active, it falls back to
  // Monitoring — not because a rule maps 1:1 to an MCDM intervention name (no
  // such mapping exists in the data model: 5 rule types, 4 interventions, no
  // clean correspondence), but because "nothing attendance-related is
  // currently open for this student" is itself the honest signal for
  // "routine monitoring is the actionable state right now." The full model
  // ranking is always shown unchanged alongside it, so a genuinely elevated
  // but not-yet-triggered profile (high MCDM score, zero Case) is still
  // visible in full below.
  const currentIntervention = useMemo(() => {
    const interventions = assessment?.interventions;
    if (assessmentStatus !== "ready" || !interventions?.length) return null;
    if (activeAttendanceCases.length > 0) {
      return interventions.find((iv) => iv.rank === 1) ?? interventions[0];
    }
    return interventions.find((iv) => iv.name === "Monitoring") ?? interventions[interventions.length - 1];
  }, [assessmentStatus, assessment, activeAttendanceCases]);

  const consecutiveAbsences = useMemo(() => {
    const byDateRecs = {};
    for (const r of recentRaw) {
      const d = localDateStr(r.date ?? "");
      if (!d) continue;
      if (!byDateRecs[d]) byDateRecs[d] = [];
      byDateRecs[d].push(r);
    }
    const byDate = {};
    for (const [d, recs] of Object.entries(byDateRecs)) {
      byDate[d] = resolveAttendanceStatus(recs);
    }
    const syStart = activeYear?.startDate ? localDateStr(new Date(activeYear.startDate)) : null;
    if (!syStart) return 0;
    const allSchoolDays = buildSchoolDays(syStart, today, noClassSet);
    let count = 0;
    for (let i = allSchoolDays.length - 1; i >= 0; i--) {
      if (byDate[allSchoolDays[i]] === "absent") count++;
      else break;
    }
    return count;
  }, [recentRaw, activeYear, today, noClassSet]);

  const resolvedCases = cases.filter((c) => c.status === "Resolved" && c.creationSource !== "unexcused_absence_incidents_warning");

  const initials = student.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  // ── Handlers ─────────────────────────────────────────────────────────────

  function prevMonth() {
    // Do not navigate before the active school year's start month.
    if (activeYear?.startDate) {
      const syStart = new Date(activeYear.startDate);
      if (calYear < syStart.getFullYear() ||
          (calYear === syStart.getFullYear() && calMonth <= syStart.getMonth())) return;
    }
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    // Do not navigate past the active school year's end month (or today if no active year).
    const limit    = activeYear?.endDate ? new Date(activeYear.endDate) : new Date();
    const maxYear  = limit.getFullYear();
    const maxMonth = limit.getMonth();
    if (calYear > maxYear || (calYear === maxYear && calMonth >= maxMonth)) return;
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  }

  function toggleDate(dateStr) {
    setSelDates((prev) => {
      const next = new Set(prev);
      next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr);
      return next;
    });
  }

  async function handleMarkDates() {
    if (selDates.size === 0) return;
    setMarkSaving(true);
    try {
      await Promise.all(
        [...selDates].map((date) =>
          api.patch("/attendance/correct", {
            studentName: student.name,
            section:     student.section ?? "",
            date,
            newStatus:   markStatus.toLowerCase(),
          })
        )
      );
      toast.success(`${selDates.size} date${selDates.size > 1 ? "s" : ""} marked as ${markStatus}.`);
      setSelDates(new Set());
      loadAttendance();
      loadCalendar();
    } catch (err) {
      toast.error(err.message ?? "Failed to save.");
    } finally {
      setMarkSaving(false);
    }
  }

  async function handleRefer({ existingCaseId, reason, attendanceRelated }) {
    setReferSaving(true);
    try {
      const body = { student: studentId, reason };
      if (existingCaseId) body.existingCaseId = existingCaseId;
      // Only meaningful for a brand-new "Other Matter" Case — omitted entirely
      // for existing-case mode, where no new Case is created.
      if (attendanceRelated !== undefined) body.attendanceRelated = attendanceRelated;
      await api.post("/referrals", body);
      toast.success("Referred to guidance.");
      setReferOpen(false);
      loadCases();
      loadReferrals();
    } catch (err) {
      toast.error(err.message ?? "Failed to create referral.");
    } finally {
      setReferSaving(false);
    }
  }

  async function handleSaveNote() {
    if (!noteDraft.trim() || !noteForCaseId) return;
    setNoteSaving(true);
    try {
      const created = await api.post("/guidance-notes", {
        studentId,
        note: noteDraft.trim(),
        cases: [noteForCaseId],
      });
      setNotes((prev) => [created, ...prev]);
      setNoteDraft("");
      setNoteForCaseId(null);
      toast.success("Note saved.");
    } catch (err) {
      toast.error(err.message ?? "Failed to save note.");
    } finally {
      setNoteSaving(false);
    }
  }

  // ── Active Cases panel (shared, used in right column) ─────────────────────
  const activeCasesPanel = (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-base font-semibold text-foreground">Active Cases</h2>
          {isGuidance && activeCases.length > 0 && (
            <Button size="sm" onClick={() => setInterventionOpen(true)}>
              <CheckCircle2 className="size-4" />Mark Intervention Done
            </Button>
          )}
          {isTeacher && activeCases.some((c) => c.creationSource === "habitual_tardiness") && (
            <Button size="sm" onClick={() => setInterventionOpen(true)}>
              <CheckCircle2 className="size-4" />Mark Intervention Done
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {casesLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : activeCases.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CircleCheck className="size-6 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">No active cases</p>
            <p className="text-xs text-muted-foreground">No open concerns for this student.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {activeCases.map((c) => {
              const isOpen = openCaseIds.has(c._id);
              const refMatch = referrals.find((r) => {
                const refCaseId = r.case?._id ?? r.case;
                return refCaseId && String(refCaseId) === String(c._id);
              });
              const caseNotes = notes.filter((n) =>
                Array.isArray(n.cases) && n.cases.some((cId) => String(cId) === String(c._id))
              );

              return (
                <li key={c._id}>
                  <button type="button"
                    className="-mx-1 flex w-full items-center gap-3 rounded-lg px-1 py-3 text-left transition-colors hover:bg-muted/40"
                    onClick={() => setOpenCaseIds((prev) => { const s = new Set(prev); s.has(c._id) ? s.delete(c._id) : s.add(c._id); return s; })}>
                    <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{c.type}</p>
                      <p className="text-xs text-muted-foreground">{SOURCE_LABEL[c.creationSource] ?? c.creationSource}</p>
                    </div>
                    <StatusBadge value={c.status} />
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </button>

                  {isOpen && (
                    <div className="mb-4 ml-7 space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                      {/* Case details */}
                      <div className="space-y-2 text-xs">
                        {(c.triggerReason || c.reason) && (
                          <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Trigger</p>
                            <p className="leading-relaxed text-foreground/90">{c.triggerReason || c.reason}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                          <div>
                            <span className="text-muted-foreground">Opened · </span>
                            <span className="text-foreground">{fmtDate(c.createdAt)}</span>
                          </div>
                          {c.triggerWindowStart && c.triggerWindowEnd && (
                            <div>
                              <span className="text-muted-foreground">Week · </span>
                              <span className="text-foreground">{fmtWindow(c.triggerWindowStart, c.triggerWindowEnd)}</span>
                            </div>
                          )}
                          {refMatch && (
                            <div className="sm:col-span-2">
                              <span className="text-muted-foreground">Referred by · </span>
                              <span className="text-foreground">{refMatch.fromUser?.name ?? "Teacher"}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Guidance only: Case Notes */}
                      {isGuidance && (
                        <div className="space-y-2 border-t border-border pt-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Lock className="size-3 text-muted-foreground" />
                              <p className="text-xs font-semibold text-foreground">Case Notes</p>
                              <span className="text-[10px] text-muted-foreground">(Guidance only)</span>
                            </div>
                            {noteForCaseId !== c._id && (
                              <button type="button" onClick={() => { setNoteForCaseId(c._id); setNoteDraft(""); }}
                                className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                                + Add note
                              </button>
                            )}
                          </div>

                          {noteForCaseId === c._id && (
                            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-2">
                              <textarea
                                className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                rows={3}
                                placeholder="Add a note about this case…"
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                autoFocus
                                disabled={noteSaving}
                              />
                              <div className="flex justify-end gap-1.5">
                                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]"
                                  onClick={() => { setNoteForCaseId(null); setNoteDraft(""); }} disabled={noteSaving}>
                                  Cancel
                                </Button>
                                <Button size="sm" className="h-6 px-2 text-[11px]"
                                  onClick={handleSaveNote} disabled={noteSaving || !noteDraft.trim()}>
                                  {noteSaving ? "Saving…" : "Save"}
                                </Button>
                              </div>
                            </div>
                          )}

                          {notesLoading ? (
                            <p className="text-xs text-muted-foreground">Loading notes…</p>
                          ) : caseNotes.length === 0 && noteForCaseId !== c._id ? (
                            <p className="text-xs italic text-muted-foreground">No notes for this case yet.</p>
                          ) : (
                            <ul className="divide-y divide-border">
                              {caseNotes.map((n, i) => (
                                <li key={n._id ?? i} className="py-2 first:pt-0 last:pb-0">
                                  <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                                    <span className="text-xs font-semibold text-foreground">
                                      {n.createdAt ? new Date(n.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                                    </span>
                                    <span>·</span>
                                    <span>{n.counselorName ?? "Guidance Counselor"}</span>
                                  </div>
                                  <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-line">{n.note}</p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Modals */}
      {isGuidance && (
        <MarkInterventionModal
          open={interventionOpen}
          onClose={() => setInterventionOpen(false)}
          studentId={studentId}
          activeCases={activeCases}
          onSuccess={() => { loadCases(); loadNotes(); setOpenCaseIds(new Set()); }}
        />
      )}
      {isTeacher && (
        <MarkInterventionModal
          open={interventionOpen}
          onClose={() => setInterventionOpen(false)}
          studentId={studentId}
          activeCases={activeCases.filter((c) => c.creationSource === "habitual_tardiness")}
          onSuccess={() => { loadCases(); setOpenCaseIds(new Set()); }}
        />
      )}
      {isTeacher && (
        <ReferToGuidanceModal
          open={referOpen}
          onClose={() => setReferOpen(false)}
          studentName={student.name}
          activeCases={activeCases}
          referrals={referrals}
          onSubmit={handleRefer}
          saving={referSaving}
        />
      )}

      {/* Back */}
      <Link href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
        <ArrowLeft className="size-4" />Back
      </Link>

      {/* Student header */}
      <Card>
        <CardContent className="flex flex-wrap items-start gap-5 pt-5">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-rose-700 text-xl font-bold text-primary-foreground shadow-sm">
            {initials}
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold text-foreground">{student.name}{student.suffix ? ` ${student.suffix}` : ""}</h1>
              {student.status && (
                <StatusBadge value={student.status === "inactive" ? "Disabled" : cap(student.status)} />
              )}
              {!attLoading && standing.needsAttention && <StatusBadge value="Needs attention" />}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="size-4 text-primary/70" />{student.section || "No section"}
              </span>
              {student.studentNumber && (
                <span className="inline-flex items-center gap-1.5">
                  <Hash className="size-4 text-primary/70" />{student.studentNumber}
                </span>
              )}
            </div>
            {parentInfo && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                <span className="text-muted-foreground">
                  {parentInfo.guardianRelationship === "guardian"
                    ? "Guardian"
                    : parentInfo.guardianRelationship === "parent"
                      ? "Parent"
                      : "Parent / Guardian"}
                </span>
                <span className="font-medium text-foreground">
                  {parentInfo.name}{parentInfo.suffix ? ` ${parentInfo.suffix}` : ""}
                </span>
                {parentInfo.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3 text-primary/60" />{parentInfo.email}
                  </span>
                )}
                {parentInfo.mobileNumber && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3 text-primary/60" />{parentInfo.mobileNumber}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Teacher-only: Refer to Guidance action */}
          {isTeacher && (
            <Button size="sm" className="shrink-0 self-start" onClick={() => setReferOpen(true)}>
              <Forward className="size-4" />Refer to Guidance
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Attendance stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: UserCheck,     label: "Attendance Rate",      value: attLoading ? "—" : standing.rate === null ? "—" : `${standing.rate}%`, tone: "bg-emerald-100 text-emerald-700" },
          { icon: UserX,         label: "Total Absences",       value: attLoading ? "—" : standing.counts.absent,                            tone: "bg-red-100 text-red-700" },
          { icon: Clock,         label: "Late Arrivals",        value: attLoading ? "—" : standing.counts.late,                              tone: "bg-amber-100 text-amber-700" },
          { icon: CalendarClock, label: "Consecutive Absences", value: attLoading ? "—" : consecutiveAbsences,                               tone: "bg-orange-100 text-orange-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-card p-4 text-center ring-1 ring-black/5">
            <span className={cn("mx-auto mb-2 flex size-9 items-center justify-center rounded-xl", s.tone)}>
              <s.icon className="size-4" />
            </span>
            <p className="text-xl font-bold tabular-nums text-foreground">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Main 2-column grid: Calendar (left) | Cases + optional AI (right) */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left: Attendance Calendar */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="font-heading text-base font-semibold text-foreground">Attendance Calendar</h2>
            {isGuidance && (
              <p className="text-xs text-muted-foreground">Click weekdays to select dates and mark attendance.</p>
            )}
          </CardHeader>
          <CardContent>
            <AttendanceCalendar
              year={calYear} month={calMonth}
              dataMap={calDataMap} loading={calLoading}
              onPrev={prevMonth} onNext={nextMonth}
              interactive={isGuidance}
              selectedDates={selDates}
              onToggle={toggleDate}
            />

            {/* Guidance: apply controls, shown only when dates are selected */}
            {isGuidance && selDates.size > 0 && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">
                    {selDates.size} date{selDates.size > 1 ? "s" : ""} selected
                  </p>
                  <button type="button"
                    onClick={() => setSelDates(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground">
                    Clear
                  </button>
                </div>
                <div className="flex gap-2">
                  {["Excused", "Late"].map((s) => (
                    <button key={s} type="button" onClick={() => setMarkStatus(s)}
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-all",
                        markStatus === s
                          ? s === "Excused"
                            ? "border-sky-300 bg-sky-50 text-sky-700 ring-2 ring-sky-300"
                            : "border-amber-300 bg-amber-50 text-amber-700 ring-2 ring-amber-300"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      )}>
                      {s}
                    </button>
                  ))}
                </div>
                <Button className="w-full" onClick={handleMarkDates} disabled={markSaving}>
                  <CheckCircle2 className="size-4" />
                  {markSaving
                    ? "Saving…"
                    : `Mark ${selDates.size} date${selDates.size > 1 ? "s" : ""} as ${markStatus}`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column: Assessment + Prescription (both roles) stacked above Active Cases */}
        <div className="flex flex-col gap-4">
          {/* Assessment — current MCDM standing. Distinct from Active Cases
              (why a Case was opened) and from Prescription (what's recommended). */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-base font-semibold text-foreground">Attendance Assessment</h2>
                {assessmentStatus === "ready" && <StatusBadge value={assessment.riskLevel} />}
              </div>
            </CardHeader>
            <CardContent>
              {assessmentStatus === "loading" && (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
              {assessmentStatus === "unavailable" && (
                <p className="text-sm text-muted-foreground">No assessment has been generated for this student yet.</p>
              )}
              {assessmentStatus === "error" && (
                <p className="text-sm text-muted-foreground">Assessment is temporarily unavailable.</p>
              )}
              {assessmentStatus === "ready" && (
                <div className="space-y-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums text-foreground">{assessment.overallScore}</span>
                    <span className="text-xs text-muted-foreground">/ 100 · weighted across 4 attendance criteria</span>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(CRITERION_LABELS).map(([key, label]) => {
                      const pct = Math.round((assessment.criteria?.[key] ?? 0) * 100);
                      return (
                        <div key={key} className="flex items-center gap-3 text-xs">
                          <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
                          <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-9 shrink-0 text-right font-medium tabular-nums text-foreground">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {(() => {
                      const top = topContributingFactors(assessment.criteria);
                      const base = "Based on four attendance criteria — absence, consecutive absence, tardiness, and unexcused incidents.";
                      return top.length === 0
                        ? `${base} No single criterion is currently elevated.`
                        : `${base} The largest contributor${top.length > 1 ? "s are" : " is"} ${joinAnd(top)}.`;
                    })()}
                  </p>

                  <p className="text-[11px] text-muted-foreground">
                    Updated {new Date(assessment.computedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prescription — ranked interventions from the same MCDM assessment.
              Order comes straight from the backend's `rank` field, unmodified. */}
          <Card>
            <CardHeader className="pb-2">
              <h2 className="font-heading text-base font-semibold text-foreground">Recommended Interventions</h2>
              <p className="text-xs text-muted-foreground">Ranked by the attendance scoring model, based on the assessment above.</p>
            </CardHeader>
            <CardContent>
              {assessmentStatus === "loading" && (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
              {assessmentStatus === "unavailable" && (
                <p className="text-sm text-muted-foreground">No recommendations yet — an assessment hasn&apos;t been generated for this student.</p>
              )}
              {assessmentStatus === "error" && (
                <p className="text-sm text-muted-foreground">Recommendations are temporarily unavailable.</p>
              )}
              {assessmentStatus === "ready" && (
                <div className="space-y-4">
                  {/* Current Intervention — derived from Case status, not persisted.
                      See the currentIntervention useMemo for the full rationale. */}
                  {currentIntervention && (
                    <div className="rounded-lg bg-primary/5 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Current Intervention
                      </p>
                      <p className="text-sm font-semibold text-foreground">{currentIntervention.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {activeAttendanceCases.length > 0
                          ? "Based on the active case below."
                          : "No active attendance case — routine monitoring."}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Full ranking
                    </p>
                    <ul className="divide-y divide-border">
                      {(assessment.interventions ?? []).map((iv) => (
                        <li key={iv.name} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                          <span className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                            iv.name === currentIntervention?.name
                              ? "bg-primary text-primary-foreground"
                              : "bg-primary/10 text-primary"
                          )}>
                            {iv.rank}
                          </span>
                          <span className="flex-1 text-sm text-foreground">{iv.name}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">score {iv.score}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Cases panel — the Trigger layer: why a Case was opened. */}
          {activeCasesPanel}
        </div>
      </div>

      {/* Case History */}
      {resolvedCases.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <h2 className="font-heading text-base font-semibold text-foreground">Case History</h2>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {resolvedCases.map((c) => {
                const isOpen = openHistIds.has(c._id);
                return (
                  <li key={c._id}>
                    <button type="button"
                      className="-mx-1 flex w-full items-center gap-3 rounded-lg px-1 py-3 text-left transition-colors hover:bg-muted/40"
                      onClick={() => setOpenHistIds((prev) => { const s = new Set(prev); s.has(c._id) ? s.delete(c._id) : s.add(c._id); return s; })}>
                      <CircleCheck className="size-4 shrink-0 text-emerald-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{c.type}</p>
                        <p className="text-xs text-muted-foreground">
                          Resolved · {c.resolvedAt ? fmtDate(c.resolvedAt) : fmtDate(c.updatedAt)}
                        </p>
                      </div>
                      <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                    </button>

                    {isOpen && (
                      <div className="mb-4 ml-7 space-y-2 rounded-xl border border-border bg-muted/30 p-3 text-xs">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Source</p>
                          <p className="text-foreground">{SOURCE_LABEL[c.creationSource] ?? c.creationSource}</p>
                        </div>
                        {(c.triggerReason || c.reason) && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Trigger</p>
                            <p className="leading-relaxed text-foreground/90">{c.triggerReason || c.reason}</p>
                          </div>
                        )}
                        {c.resolutionNote && (
                          <div className="rounded-lg bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Intervention Note</p>
                            <p className="leading-relaxed text-emerald-900">{c.resolutionNote}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
