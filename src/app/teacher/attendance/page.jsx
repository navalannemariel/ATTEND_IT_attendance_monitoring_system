"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckSquare, Square, Printer, Save, Users, CalendarDays,
  ChevronDown, ChevronLeft, ChevronRight, FileSpreadsheet,
  CalendarOff, ShieldAlert, Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatusBadge } from "@/components/dashboard/dashboard-ui";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { AttendanceStatusPicker } from "@/components/ui/attendance-status-picker";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { exportToExcel } from "@/lib/export";
import { exportSF2ToXLSX } from "@/lib/exportSF2";
import { resolveAttendanceStatus } from "@/lib/attendanceResolver";

// ── Utilities ─────────────────────────────────────────────────────────────────

function toISODate(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cap(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sortByGenderThenSurname(a, b) {
  const gOrder = (g) => g === "male" ? 0 : g === "female" ? 1 : 2;
  const gDiff  = gOrder(a.gender) - gOrder(b.gender);
  if (gDiff !== 0) return gDiff;
  const surname = (n = "") => { const p = n.trim().split(/\s+/); return p[p.length - 1].toLowerCase(); };
  return surname(a.name).localeCompare(surname(b.name));
}

function formatLastFirst(full = "") {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  const last        = parts[parts.length - 1];
  const firstMiddle = parts.slice(0, -1).join(" ");
  return `${last}, ${firstMiddle}`;
}

// ── Shared constants ──────────────────────────────────────────────────────────

const today       = toISODate(new Date());
const NON_PRESENT = ["absent", "late", "excused"];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_ABBR   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const EXPORT_COLUMNS = [
  { key: "date",    label: "Date" },
  { key: "student", label: "Student" },
  { key: "section", label: "Section" },
  { key: "timeIn",  label: "Time In" },
  { key: "status",  label: "Status" },
];

function prepareExportRows(recs) {
  return recs
    .map((r) => ({
      date:    toISODate(new Date(r.date)),
      student: r.studentName ?? r.student ?? "",
      section: r.section ?? "",
      timeIn:  r.timeIn ?? "—",
      status:  cap(r.status ?? ""),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.student.localeCompare(b.student));
}

// ── Print roster ──────────────────────────────────────────────────────────────

function openPrintRoster(students, dateStr) {
  const section = students[0]?.section ?? "";
  const rows = students
    .map(
      (s, i) => `<tr>
        <td>${i + 1}</td>
        <td>${formatLastFirst(s.name)}</td>
        <td class="cb">&#9744;</td>
        <td class="cb">&#9744;</td>
        <td class="cb">&#9744;</td>
        <td class="cb">&#9744;</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Attendance Roster — ${dateStr}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
  h2 { margin: 0 0 2px; font-size: 18px; }
  p.sub { margin: 0 0 16px; color: #555; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 7px 10px; text-align: left; }
  th { background: #f0f0f0; font-weight: 600; }
  .cb { text-align: center; width: 64px; }
</style>
</head>
<body>
<h2>Attendance Roster</h2>
<p class="sub">Date: ${dateStr} &nbsp;·&nbsp; ${section}</p>
<table>
  <thead>
    <tr>
      <th>#</th><th>Student</th>
      <th class="cb">Present</th>
      <th class="cb">Late</th>
      <th class="cb">Absent</th>
      <th class="cb">Excused</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }
}

// ── Page shell ────────────────────────────────────────────────────────────────

const TABS         = [{ key: "mark", label: "Mark Attendance" }, { key: "records", label: "Records" }];
const VISIBLE_TABS = TABS.filter((t) => t.key === "records");

export default function AttendancePage() {
  const [tab, setTab] = useState("records");

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Monthly overview of your advisory section's attendance."
      />
      {VISIBLE_TABS.length > 1 && (
        <div className="flex w-fit gap-1 rounded-xl bg-slate-100 p-1">
          {VISIBLE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "relative rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                tab === t.key ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === "mark"    && <MarkAttendanceTab />}
      {tab === "records" && <MonthlyStudentGrid />}
    </>
  );
}

// ── Mark Attendance tab (today only) ─────────────────────────────────────────

function MarkAttendanceTab() {
  const [students,    setStudents]    = useState([]);
  const [marks,       setMarks]       = useState({});
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [noClassInfo, setNoClassInfo] = useState(null);

  useEffect(() => {
    api.get("/calendar/today")
      .then((d) => setNoClassInfo(d?.isNoClassDay ? d : false))
      .catch(() => setNoClassInfo(false));
  }, []);

  useEffect(() => {
    api.get("/users/students")
      .then((d) => setStudents(Array.isArray(d) ? d.slice().sort(sortByGenderThenSurname) : []))
      .catch(() => setStudents([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get(`/attendance?date=${today}`)
      .then((data) => {
        // Group all records per student then resolve — a student may have both
        // a gate_scan and a room_scan record; the raw last-wins loop would pick
        // the wrong status (e.g. room_scan:late overriding gate_scan:present).
        const byStudent = {};
        (Array.isArray(data) ? data : []).forEach((r) => {
          const name = r.studentName;
          if (!name) return;
          if (!byStudent[name]) byStudent[name] = [];
          byStudent[name].push(r);
        });
        const existing = {};
        for (const [name, recs] of Object.entries(byStudent)) {
          const resolved = resolveAttendanceStatus(recs);
          if (resolved && resolved !== "pending") existing[name] = resolved;
        }
        setMarks(existing);
      })
      .catch(() => setMarks({}))
      .finally(() => setLoading(false));
  }, []);

  function setMark(name, status) { setMarks((prev) => ({ ...prev, [name]: status })); }
  function togglePresent(name) {
    setMarks((prev) => ({ ...prev, [name]: prev[name] === "present" ? null : "present" }));
  }
  function markAllPresent() {
    const all = {};
    students.forEach((s) => { all[s.name] = "present"; });
    setMarks(all);
  }

  async function handleSave() {
    const records = students
      .filter((s) => marks[s.name])
      .map((s) => ({ studentName: s.name, section: s.section ?? "", status: marks[s.name] }));
    if (records.length === 0) { toast.error("No students marked — nothing to save."); return; }
    setSaving(true);
    try {
      const { saved } = await api.post("/attendance", { date: today, records });
      toast.success(`Saved ${saved} attendance record${saved !== 1 ? "s" : ""}.`);
    } catch (err) {
      toast.error(err.message ?? "Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  }

  const markedCount = students.filter((s) => marks[s.name]).length;
  const todayLabel  = new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  if (noClassInfo && noClassInfo.type !== "online_class") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm dark:border-amber-800 dark:bg-amber-950">
        <CalendarOff className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-semibold text-amber-800 dark:text-amber-200">
            No classes today — {noClassInfo.label}
          </p>
          <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/80">
            Attendance marking is disabled for no-class days.
          </p>
        </div>
      </div>
    );
  }

  const blockedInSection = students.filter((s) => s.admissionBlocked);

  return (
    <div className="space-y-4">
      {noClassInfo?.type === "online_class" && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <Monitor className="size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">
              Online Class Day — {noClassInfo.label}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Physical scanning is disabled. Record attendance manually using the form below.
            </p>
          </div>
        </div>
      )}
      {blockedInSection.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-500" />
          <div>
            <p className="font-semibold">
              {blockedInSection.length === 1
                ? `${blockedInSection[0].name} is blocked from admission`
                : `${blockedInSection.length} students are blocked from admission`}
            </p>
            <p className="mt-0.5 text-xs text-red-700">
              Contact the Guidance Counselor to clear the block before admitting them to class.
            </p>
          </div>
        </div>
      )}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{todayLabel}</span>
            <span className="text-xs text-muted-foreground">{markedCount} / {students.length} marked</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={markAllPresent} disabled={loading}>
              <Users className="size-4" /> Mark All Present
            </Button>
            <Button variant="outline" size="sm" onClick={() => openPrintRoster(students, today)}>
              <Printer className="size-4" /> Print Roster
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || loading}>
              <Save className="size-4" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-heading text-base font-semibold text-foreground">{todayLabel}</h2>
          <p className="text-sm text-muted-foreground">
            Check = Present. Uncheck to choose Absent / Late / Excused. Unmarked students are not saved.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : students.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No students found.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {students.map((s) => {
                const status     = marks[s.name] ?? null;
                const isPresent  = status === "present";
                return (
                  <li key={s._id} className="flex flex-wrap items-center gap-3 py-3">
                    <button type="button" onClick={() => togglePresent(s.name)}
                      className="flex shrink-0 items-center text-primary"
                      aria-label={isPresent ? "Unmark present" : "Mark present"}>
                      {isPresent
                        ? <CheckSquare className="size-5" />
                        : <Square className="size-5 text-slate-300" />}
                    </button>
                    <span className="flex flex-1 min-w-40 flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      {formatLastFirst(s.name)}
                      {s.admissionBlocked && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                          <ShieldAlert className="size-2.5" />Blocked
                        </span>
                      )}
                    </span>
                    {status && <StatusBadge value={status} />}
                    {!status && <span className="text-xs text-muted-foreground">No record</span>}
                    {!isPresent && (
                      <div className="flex gap-1.5">
                        {NON_PRESENT.map((opt) => (
                          <button key={opt} type="button"
                            onClick={() => setMark(s.name, status === opt ? null : opt)}
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition-colors",
                              status === opt
                                ? "bg-amber-100 text-amber-700 ring-amber-300"
                                : "bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100"
                            )}>
                            {cap(opt)}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Export preview modal ──────────────────────────────────────────────────────

const PREVIEW_MAX = 10;

function ExportPreviewModal({ preview, onClose }) {
  function handleDownload() {
    exportToExcel(preview.filename, EXPORT_COLUMNS, preview.rows);
    toast.success(`Excel downloaded — ${preview.rows.length} record${preview.rows.length !== 1 ? "s" : ""}.`);
    onClose();
  }

  const shown = preview?.rows?.slice(0, PREVIEW_MAX) ?? [];

  return (
    <Modal open={!!preview} onClose={onClose} title={preview?.title ?? "Export Preview"} size="lg">
      {preview?.loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading records…</p>
      ) : preview && (
        <div className="space-y-4 py-1">
          {/* Summary */}
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              <strong className="text-foreground">{preview.rows.length}</strong>{" "}
              record{preview.rows.length !== 1 ? "s" : ""} will be exported
              {preview.subtitle ? ` · ${preview.subtitle}` : ""}
            </p>
          </div>

          {/* Preview table */}
          {shown.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    {["Date","Student","Section","Time In","Status"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {shown.map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-mono text-foreground">{row.date}</td>
                      <td className="px-3 py-1.5 text-foreground">{row.student}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.section || "—"}</td>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{row.timeIn}</td>
                      <td className="px-3 py-1.5">
                        <StatusBadge value={row.status.toLowerCase()} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > PREVIEW_MAX && (
                <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-muted-foreground">
                  Showing first {PREVIEW_MAX} of {preview.rows.length} records — all will be included in the file.
                </p>
              )}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No records to export for this period.</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleDownload} disabled={preview.rows.length === 0}>
              <FileSpreadsheet className="size-4" /> Download Excel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Month picker dropdown ─────────────────────────────────────────────────────

function MonthPicker({ year, monthIdx, onSelect }) {
  const [open,       setOpen]       = useState(false);
  const [pickerYear, setPickerYear] = useState(year);

  function handleOpen() { setPickerYear(year); setOpen(true); }

  return (
    <div className="relative">
      {open && (
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
      )}
      <button
        type="button"
        onClick={handleOpen}
        className="relative z-20 flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-slate-100"
      >
        {MONTH_NAMES[monthIdx]} {year}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {/* Year row */}
          <div className="mb-2.5 flex items-center justify-between">
            <button type="button" onClick={() => setPickerYear((y) => y - 1)}
              className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold">{pickerYear}</span>
            <button type="button" onClick={() => setPickerYear((y) => y + 1)}
              className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
              <ChevronRight className="size-4" />
            </button>
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-3 gap-1">
            {MONTH_ABBR.map((abbr, i) => (
              <button key={abbr} type="button"
                onClick={() => { onSelect(pickerYear, i); setOpen(false); }}
                className={cn(
                  "rounded-lg py-1.5 text-xs font-medium transition-colors",
                  i === monthIdx && pickerYear === year
                    ? "bg-primary text-primary-foreground"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                )}>
                {abbr}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Grid helpers ──────────────────────────────────────────────────────────────

function CellDot({ cat }) {
  if (cat === "green")        return <span className="mx-auto block size-2.5 rounded-full bg-emerald-500" />;
  if (cat === "red")          return <span className="mx-auto block size-2.5 rounded-full bg-red-500" />;
  if (cat === "sky")          return <span className="mx-auto block size-2.5 rounded-full bg-sky-500" />;
  if (cat === "no_class")     return <span className="mx-auto block size-2.5 rounded-full bg-amber-400" />;
  if (cat === "pending")      return <span className="mx-auto block size-2.5 rounded-full bg-slate-400" />;
  return <span className="text-[11px] leading-none text-slate-300">—</span>;
}

function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full shrink-0", color)} />
      {label}
    </span>
  );
}

// ── Monthly student attendance grid ───────────────────────────────────────────

function MonthlyStudentGrid() {
  const now = new Date();
  const [year,          setYear]          = useState(now.getFullYear());
  const [monthIdx,      setMonthIdx]      = useState(now.getMonth());
  const [students,      setStudents]      = useState([]);
  const [records,       setRecords]       = useState([]);
  const [noClassDays,   setNoClassDays]   = useState([]);
  const [schoolYear,    setSchoolYear]    = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false); // silent reload after save — table stays mounted
  const [detailCell,    setDetailCell]    = useState(null);
  const [editMode,      setEditMode]      = useState(false);
  const [exportPreview, setExportPreview] = useState(null);
  const [view,          setView]          = useState("monthly"); // "monthly" | "yearly"
  const [yearRecords,   setYearRecords]   = useState([]);
  const [yearLoading,   setYearLoading]   = useState(false);
  const [yearLoaded,    setYearLoaded]    = useState(false);

  // Spacer column: callback ref fires when the container actually mounts (after
  // loading + data are ready), so clientWidth is non-zero when we measure.
  const [spacerW,   setSpacerW]   = useState(0);
  const observerRef       = useRef(null);
  const scrollContainerRef = useRef(null); // live reference to the scroll container DOM node
  const savedScrollRef     = useRef(0);    // scroll position captured before a data reload

  // Crosshair highlight — tracked via refs so hover updates never trigger re-renders
  const attTableRef = useRef(null);
  const hovRowRef   = useRef(null);
  const hovColRef   = useRef(null);

  function clearCrosshair() {
    const t = attTableRef.current;
    if (!t) return;
    t.querySelectorAll(".att-hov-name,.att-hov-header,.att-hov-cell").forEach((el) =>
      el.classList.remove("att-hov-name", "att-hov-header", "att-hov-cell")
    );
    hovRowRef.current = null;
    hovColRef.current = null;
  }

  function updateCrosshair(rowId, colId) {
    const t = attTableRef.current;
    if (!t) return;
    if (rowId === hovRowRef.current && colId === hovColRef.current) return;
    clearCrosshair();
    hovRowRef.current = rowId;
    hovColRef.current = colId;
    const tr   = t.querySelector(`tr[data-row="${rowId}"]`);
    // Name cell: first td in the row (the sticky one, has no data-col)
    const name = tr?.querySelector("td:not([data-col])");
    if (name) name.classList.add("att-hov-name");
    // Date header: th in thead with matching data-col
    const header = t.querySelector(`thead th[data-col="${colId}"]`);
    if (header) header.classList.add("att-hov-header");
    // Hovered attendance cell
    const cell = tr?.querySelector(`td[data-col="${colId}"]`);
    if (cell) cell.classList.add("att-hov-cell");
  }

  function handleTableOver(e) {
    const td = e.target.closest("td[data-col]");
    const tr = e.target.closest("tr[data-row]");
    if (!td || !tr) { clearCrosshair(); return; }
    updateCrosshair(tr.dataset.row, td.dataset.col);
  }

  const gridRef = useCallback((el) => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    scrollContainerRef.current = el;
    if (!el) return;
    const update = () => setSpacerW(Math.max(0, el.clientWidth - 192 - 36));
    update();
    observerRef.current = new ResizeObserver(update);
    observerRef.current.observe(el);
    // Restore the horizontal scroll position that was saved before the reload.
    // The container is remounted fresh on every loading→false transition, so
    // scrollLeft resets to 0 unless we reinstate it here.
    if (savedScrollRef.current > 0) {
      el.scrollLeft = savedScrollRef.current;
      savedScrollRef.current = 0;
    }
  }, []);

  const monthStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;

  // Load students & school year once
  useEffect(() => {
    Promise.all([
      api.get("/users/students?scope=advisory").catch(() => []),
      api.get("/school-years").catch(() => []),
    ]).then(([studs, ys]) => {
      setStudents(Array.isArray(studs) ? studs.slice().sort(sortByGenderThenSurname) : []);
      const active = Array.isArray(ys) ? (ys.find((y) => y.isActive) ?? null) : null;
      setSchoolYear(active);
    });
  }, []);

  // Load records + no-class days whenever month changes.
  // Pass silent=true from save callbacks so the table stays mounted and scroll is preserved.
  const loadRecords = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [recs, cal] = await Promise.all([
        api.get(`/attendance?month=${monthStr}&scope=advisory`).catch(() => []),
        api.get("/calendar").catch(() => []),
      ]);
      setRecords(Array.isArray(recs) ? recs : []);
      setNoClassDays(Array.isArray(cal) ? cal : []);
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [monthStr]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // Weekdays (Mon–Fri) in the selected month, clipped to the active school year's date range
  const weekdays = useMemo(() => {
    const syStart = schoolYear?.startDate?.slice(0, 10) ?? null;
    const syEnd   = schoolYear?.endDate?.slice(0, 10)   ?? null;
    const days = [];
    const dim  = new Date(year, monthIdx + 1, 0).getDate();
    for (let d = 1; d <= dim; d++) {
      const ds  = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (syStart && ds < syStart) continue;
      if (syEnd   && ds > syEnd)   continue;
      const dow = new Date(`${ds}T12:00:00+08:00`).getUTCDay();
      if (dow !== 0 && dow !== 6) days.push(ds);
    }
    return days;
  }, [year, monthIdx, schoolYear]);

  const weekStartDates = useMemo(
    () => new Set(weekdays.filter((ds) => new Date(`${ds}T12:00:00+08:00`).getUTCDay() === 1)),
    [weekdays]
  );
  const noClassTypeMap = useMemo(() => new Map(noClassDays.map((d) => [d.date, d.type])), [noClassDays]);
  // noClassSet excludes online_class days — those are still school days where attendance is required.
  const noClassSet = useMemo(
    () => new Set(noClassDays.filter((d) => d.type !== "online_class").map((d) => d.date)),
    [noClassDays],
  );
  const syStart    = schoolYear?.startDate?.slice(0, 10) ?? null;
  const syEnd      = schoolYear?.endDate?.slice(0, 10)   ?? null;
  const todayStr   = toISODate(new Date());

  // Map: studentName → { dateStr → { status, timeIn } }
  const byStudentDate = useMemo(() => {
    // Group by (studentName, date) then resolve each group.
    const grouped = {};
    for (const r of records) {
      const ds = toISODate(new Date(r.date));
      const sn = r.studentName ?? r.student ?? "";
      if (!sn || !ds) continue;
      const key = `${sn}__${ds}`;
      if (!grouped[key]) grouped[key] = { sn, ds, recs: [] };
      grouped[key].recs.push(r);
    }
    const map = {};
    for (const { sn, ds, recs } of Object.values(grouped)) {
      const status = resolveAttendanceStatus(recs) ?? "";
      const winner = recs.find((r) => (r.status ?? "").toLowerCase() === status) ?? recs[0];
      if (!map[sn]) map[sn] = {};
      map[sn][ds] = { status, timeIn: winner?.timeIn ?? "—" };
    }
    return map;
  }, [records]);

  function cellCat(ds, studentName) {
    if (noClassSet.has(ds)) return "no_class";
    if ((syStart && ds < syStart) || (syEnd && ds > syEnd)) return "outside_sy";
    if (ds > todayStr) return "future";
    const rec = byStudentDate[studentName]?.[ds];
    if (!rec) return "no_record";
    const s = rec.status;
    if (s === "present" || s === "late") return "green";
    if (s === "absent")                  return "red";
    if (s === "excused")                 return "sky";
    if (s === "pending")                 return "pending";
    return "no_record";
  }

  function prevMonth() {
    if (monthIdx === 0) { setYear((y) => y - 1); setMonthIdx(11); }
    else setMonthIdx((m) => m - 1);
  }
  function nextMonth() {
    if (monthIdx === 11) { setYear((y) => y + 1); setMonthIdx(0); }
    else setMonthIdx((m) => m + 1);
  }

  async function handleMonthlyExport() {
    try {
      // Fetch school info from settings (read-only, accessible to all roles)
      const settingsArr = await api.get("/settings").catch(() => []);
      const getVal = (key) => (Array.isArray(settingsArr) ? settingsArr : []).find((s) => s.key === key)?.value ?? "";
      const schoolInfo = { name: getVal("school_name"), id: getVal("school_id") };

      // Build ALL weekdays in the selected month with inSchoolYear + isNCD flags
      const DOW_SF2   = ["SU", "M", "T", "W", "TH", "F", "SA"];
      const monthPad  = String(monthIdx + 1).padStart(2, "0");
      const daysInMon = new Date(year, monthIdx + 1, 0).getDate();
      const dates     = [];
      for (let d = 1; d <= daysInMon; d++) {
        const dateStr = `${year}-${monthPad}-${String(d).padStart(2, "0")}`;
        const dow     = new Date(`${dateStr}T12:00:00+08:00`).getUTCDay();
        if (dow === 0 || dow === 6) continue;
        const inSchoolYear = (!syStart || dateStr >= syStart) && (!syEnd || dateStr <= syEnd);
        dates.push({ day: d, date: dateStr, weekday: DOW_SF2[dow],
          isNCD: noClassSet.has(dateStr), ncdType: null, ncdLabel: null, inSchoolYear });
      }

      // Per-student daily status + totals
      const processStudent = (student) => {
        const byDate = byStudentDate[student.name] ?? {};
        const daily  = {};
        let totalPresent = 0, totalAbsent = 0;
        for (const d of dates) {
          let status;
          if (!d.inSchoolYear) status = "outside_sy";
          else if (d.isNCD)    status = "ncd";
          else                 status = byDate[d.date]?.status ?? "no_record";
          daily[d.date] = status;
          if (status === "present" || status === "late")        totalPresent++;
          else if (status === "absent" || status === "excused") totalAbsent++;
        }
        return { name: student.name, daily, totalPresent, totalAbsent };
      };

      await exportSF2ToXLSX({
        schoolInfo,
        schoolYear: { name: schoolYear?.name ?? "" },
        section:    { name: students[0]?.section ?? "", gradeLevel: "" },
        monthName:  MONTH_NAMES[monthIdx].toUpperCase(),
        calYear:    year,
        dates,
        schoolDayCount: dates.filter((d) => d.inSchoolYear && !d.isNCD).length,
        students: {
          male:   students.filter((s) => s.gender === "male").map(processStudent),
          female: students.filter((s) => s.gender !== "male").map(processStudent),
        },
      });
    } catch (err) {
      toast.error(err?.message ?? "Export failed.");
    }
  }

  async function handleYearExport() {
    const syName = schoolYear?.name ?? "";
    setExportPreview({
      title:   `School Year Export${syName ? ` — ${syName}` : ""}`,
      subtitle: syName,
      filename: "",
      rows:    [],
      loading: true,
    });
    try {
      const allRecs = await api.get("/attendance?scope=advisory").catch(() => []);
      const rows    = prepareExportRows(Array.isArray(allRecs) ? allRecs : []);
      const safeName = syName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "") || "school-year";
      setExportPreview((prev) => ({
        ...prev,
        filename: `attendance-${safeName}`,
        rows,
        loading:  false,
      }));
    } catch {
      toast.error("Could not load school year records.");
      setExportPreview(null);
    }
  }

  const loadYearRecords = useCallback(async () => {
    if (yearLoaded) return;
    setYearLoading(true);
    try {
      const recs = await api.get("/attendance?scope=advisory").catch(() => []);
      setYearRecords(Array.isArray(recs) ? recs : []);
      setYearLoaded(true);
    } finally {
      setYearLoading(false);
    }
  }, [yearLoaded]);

  function handleViewChange(v) {
    setView(v);
    if (v === "yearly") loadYearRecords();
  }

  const syMonths = useMemo(() => {
    if (!schoolYear?.startDate || !schoolYear?.endDate) return [];
    const start = new Date(schoolYear.startDate);
    const end   = new Date(schoolYear.endDate);
    const months = [];
    let y = start.getFullYear();
    let m = start.getMonth(); // 0-indexed
    while (true) {
      const first = new Date(y, m, 1);
      if (first > end) break;
      months.push({ year: y, monthIdx: m, label: MONTH_ABBR[m], key: `${y}-${String(m + 1).padStart(2, "0")}` });
      m++;
      if (m > 11) { m = 0; y++; }
    }
    return months;
  }, [schoolYear]);

  const yearlySummary = useMemo(() => {
    if (!schoolYear?.startDate || !schoolYear?.endDate || yearRecords.length === 0) return {};
    const syStart = schoolYear.startDate.slice(0, 10);
    const syEnd   = schoolYear.endDate.slice(0, 10);
    const byStudentMonthDate = {};
    for (const r of yearRecords) {
      const ds = toISODate(new Date(r.date));
      const sn = r.studentName ?? r.student ?? "";
      if (!sn || !ds) continue;
      if (ds < syStart || ds > syEnd) continue;
      const dow = new Date(`${ds}T12:00:00+08:00`).getUTCDay();
      if (dow === 0 || dow === 6) continue;
      if (noClassSet.has(ds)) continue;
      const mkey = ds.slice(0, 7);
      if (!byStudentMonthDate[sn])             byStudentMonthDate[sn]            = {};
      if (!byStudentMonthDate[sn][mkey])       byStudentMonthDate[sn][mkey]      = {};
      if (!byStudentMonthDate[sn][mkey][ds])   byStudentMonthDate[sn][mkey][ds]  = [];
      byStudentMonthDate[sn][mkey][ds].push(r);
    }
    const summary = {};
    for (const sn of Object.keys(byStudentMonthDate)) {
      summary[sn] = {};
      for (const [mkey, byDate] of Object.entries(byStudentMonthDate[sn])) {
        let present = 0, absent = 0;
        for (const recs of Object.values(byDate)) {
          const status = resolveAttendanceStatus(recs);
          if (status === "present" || status === "late")        present++;
          else if (status === "absent" || status === "excused") absent++;
        }
        summary[sn][mkey] = { present, absent };
      }
    }
    return summary;
  }, [yearRecords, noClassSet, schoolYear]);

  return (
    <div className="space-y-4">
      {/* Navigator + view toggle + export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {view === "monthly" ? (
            <>
              <button type="button" onClick={prevMonth}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                <ChevronLeft className="size-5" />
              </button>
              <MonthPicker
                year={year}
                monthIdx={monthIdx}
                onSelect={(y, mi) => { setYear(y); setMonthIdx(mi); }}
              />
              <button type="button" onClick={nextMonth}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                <ChevronRight className="size-5" />
              </button>
            </>
          ) : (
            <span className="px-2 text-sm font-semibold text-foreground">
              {schoolYear?.name ?? "School Year"} — Full Year
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleMonthlyExport} disabled={loading}>
            <FileSpreadsheet className="size-4" /> Export
          </Button>
        </div>
      </div>

      {view === "monthly" && (loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : students.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No students found in your advisory section.
        </p>
      ) : (
        <div ref={gridRef} className="overflow-x-auto rounded-2xl bg-card shadow-sm ring-1 ring-black/5">
              <table ref={attTableRef} className="min-w-max border-collapse text-sm"
                onMouseOver={handleTableOver} onMouseLeave={clearCrosshair}>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="sticky left-0 z-10 min-w-48 border-r border-slate-100 bg-slate-50/70 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Student
                    </th>
                    {weekdays.map((ds) => {
                      const d       = new Date(`${ds}T12:00:00+08:00`);
                      const dayNum  = d.getUTCDate();
                      const dow     = d.getUTCDay();
                      const ncdType = noClassTypeMap.get(ds);
                      return (
                        <th key={ds} data-col={ds} className={cn(
                          "w-9 min-w-9 px-0.5 py-2 text-center text-xs font-semibold",
                          ncdType === "no_class" ? "text-amber-500" : "text-muted-foreground",
                          weekStartDates.has(ds) && "att-week-start"
                        )}>
                          <div>{dayNum}</div>
                          <div className="text-[9px] font-normal opacity-60">{DAY_ABBR[dow]}</div>
                        </th>
                      );
                    })}
                    <th aria-hidden="true" style={{ minWidth: spacerW }} />
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: "male",   label: "Male",   group: students.filter((s) => s.gender === "male")   },
                    { key: "female", label: "Female", group: students.filter((s) => s.gender === "female") },
                  ].flatMap(({ key, label, group }) => {
                    if (group.length === 0) return [];
                    return [
                      <tr key={`hdr-${key}`} className="border-y border-slate-100 bg-slate-50">
                        <td className="sticky left-0 z-10 bg-slate-50 border-r border-slate-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {label}
                        </td>
                        {weekdays.map((ds) => (
                          <td key={ds} className={cn(weekStartDates.has(ds) && "att-week-start")} />
                        ))}
                        <td aria-hidden="true" />
                      </tr>,
                      ...group.map((student, si) => (
                        <tr key={student._id} data-row={student._id}
                          className={si < group.length - 1 ? "border-b border-slate-50" : ""}>
                          <td className="sticky left-0 z-10 min-w-48 border-r border-slate-100 bg-card px-4 py-2">
                            <Link
                              href={`/teacher/learners/${student._id}`}
                              className="text-sm font-medium text-foreground hover:text-primary hover:underline"
                            >
                              {formatLastFirst(student.name)}
                            </Link>
                          </td>
                          {weekdays.map((ds) => {
                            const cat      = cellCat(ds, student.name);
                            const rec      = byStudentDate[student.name]?.[ds];
                            const isActive = cat !== "outside_sy" && cat !== "future";
                            const isPast   = ds < todayStr && !noClassSet.has(ds)
                              && (!syStart || ds >= syStart) && (!syEnd || ds <= syEnd);
                            return (
                              <td key={ds} data-col={ds}
                                className={cn(
                                  "px-0.5 py-2 text-center",
                                  isActive && "cursor-pointer hover:bg-slate-50",
                                  weekStartDates.has(ds) && "att-week-start"
                                )}
                                onClick={() => {
                                  if (!isActive) return;
                                  const ncdType = noClassTypeMap.get(ds) ?? null;
                                  setDetailCell({ student, date: ds, cat, rec, isPast, ncdType });
                                  setEditMode((isPast || ds === todayStr) && cat !== "no_class" && cat !== "outside_sy");
                                }}
                              >
                                <CellDot cat={cat} />
                              </td>
                            );
                          })}
                          <td aria-hidden="true" />
                        </tr>
                      )),
                    ];
                  })}
                </tbody>
              </table>
        </div>
      ))}


      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        <LegendDot color="bg-emerald-500" label="Present / Late" />
        <LegendDot color="bg-red-500"     label="Absent" />
        <LegendDot color="bg-sky-500"     label="Excused" />
        <LegendDot color="bg-amber-400"   label="No Class Day" />
        <LegendDot color="bg-violet-400"  label="Online Class" />
        <LegendDot color="bg-slate-400"   label="Pending (needs confirmation)" />
        <span>— = No record / Future / Outside school year</span>
      </div>

      {/* Cell detail modal — edit picker expands inline when Edit is clicked */}
      <Modal
        open={!!detailCell}
        onClose={() => { setDetailCell(null); setEditMode(false); }}
        title="Attendance Detail"
      >
        {detailCell && (
          <div className="space-y-3 py-1 text-sm">
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 space-y-1.5">
              <p>
                <span className="text-muted-foreground">Student: </span>
                <strong>{formatLastFirst(detailCell.student.name)}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Date: </span>
                <strong>
                  {new Date(`${detailCell.date}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "long", month: "long", day: "numeric", year: "numeric",
                  })}
                </strong>
              </p>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                {detailCell.cat === "no_class" ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-amber-600">No Class Day</span>
                    {detailCell.rec && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <StatusBadge value={detailCell.rec.status} />
                      </>
                    )}
                  </div>
                ) : detailCell.ncdType === "online_class" ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-violet-600">Online Class Day</span>
                    {detailCell.rec && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <StatusBadge value={detailCell.rec.status} />
                      </>
                    )}
                  </div>
                ) : detailCell.rec ? (
                  <StatusBadge value={detailCell.rec.status} />
                ) : (
                  <span className="italic text-muted-foreground">No record</span>
                )}
              </div>
              {detailCell.rec?.timeIn && detailCell.rec.timeIn !== "—" && (
                <p>
                  <span className="text-muted-foreground">Time In: </span>
                  <strong>{detailCell.rec.timeIn}</strong>
                </p>
              )}
            </div>

            {editMode ? (
              <AttendanceStatusPicker
                mode="student"
                currentStatus={detailCell.rec?.status ?? null}
                allowToggleOff
                onSave={async (newStatus) => {
                  try {
                    await api.patch("/attendance/correct", {
                      studentName: detailCell.student.name,
                      section:     detailCell.student.section ?? "",
                      date:        detailCell.date,
                      newStatus,
                    });
                    toast.success(newStatus === null ? "Attendance record removed." : `Updated to ${cap(newStatus)}.`);
                    // Silent reload: table stays mounted so both horizontal and vertical
                    // scroll positions are preserved naturally.
                    loadRecords(true);
                    setDetailCell(null);
                    setEditMode(false);
                  } catch (err) {
                    toast.error(err.message ?? "Could not save correction.");
                    throw err;
                  }
                }}
                onCancel={() => setEditMode(false)}
              />
            ) : (
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setDetailCell(null)}>Close</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Export preview modal */}
      <ExportPreviewModal
        preview={exportPreview}
        onClose={() => setExportPreview(null)}
      />
    </div>
  );
}
