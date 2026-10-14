"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, History, PowerOff, Trash2, UserPlus, Check, Printer } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AttendanceStatusPicker } from "@/components/ui/attendance-status-picker";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Utilities ─────────────────────────────────────────────────────────────────

function sortByGenderThenSurname(a, b) {
  const gOrder = (g) => g === "male" ? 0 : g === "female" ? 1 : 2;
  const gDiff  = gOrder(a.gender) - gOrder(b.gender);
  if (gDiff !== 0) return gDiff;
  const surname = (n = "") => { const p = n.trim().split(/\s+/); return p[p.length - 1].toLowerCase(); };
  return surname(a.teacher ?? a.name ?? "").localeCompare(surname(b.teacher ?? b.name ?? ""));
}

function toISODate(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  } catch { return iso; }
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "Asia/Manila",
      month: "long", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch { return iso; }
}

// ── Status chip ───────────────────────────────────────────────────────────────

const STATUS_CFG = {
  present:          { label: "Present",         cls: "text-emerald-600" },
  late:             { label: "Late",            cls: "text-amber-600"   },
  absent:           { label: "Absent",          cls: "text-red-600"     },
  excused:          { label: "Excused",         cls: "text-blue-600"    },
  no_record:        { label: "Not yet scanned", cls: "text-muted-foreground" },
};

function StatusChip({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status ?? "—", cls: "text-muted-foreground" };
  return (
    <span className={cn("text-sm font-medium", cfg.cls)}>
      {cfg.label}
    </span>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_ABBR   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

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
  if (cat === "blue")         return <span className="mx-auto block size-2.5 rounded-full bg-blue-400" />;
  if (cat === "no_class")     return <span className="mx-auto block size-2.5 rounded-full bg-amber-400" />;
  if (cat === "online_class") return <span className="mx-auto block size-2.5 rounded-full bg-violet-500" />;
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

// ── Generate Substitute Account modal ────────────────────────────────────────

function GenerateSubstituteModal({ open, onClose }) {
  const today = toISODate(new Date());

  const [teachers,          setTeachers]          = useState([]);
  const [sections,          setSections]          = useState([]);
  const [assignedDate,      setAssignedDate]      = useState(today);
  const [absentTeacherId,   setAbsentTeacherId]   = useState("");
  const [subTeacherId,      setSubTeacherId]      = useState("");
  const [credentials,       setCredentials]       = useState(null);  // { email, password, sequenceLabel, assignment }
  const [showPassword,      setShowPassword]      = useState(false);
  const [copied,            setCopied]            = useState(false);
  const [saving,            setSaving]            = useState(false);

  // Load teachers + sections once on open
  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.get("/substitutes/teachers").catch(() => []),
      api.get("/sections").catch(() => []),
    ]).then(([t, s]) => { setTeachers(t); setSections(Array.isArray(s) ? s : []); });
  }, [open]);

  // Derive section from adviser match (client-side, sections already loaded)
  const section = useMemo(() => {
    if (!absentTeacherId || !sections.length) return null;
    const s = sections.find((sec) => {
      const advId = sec.adviser?._id ?? sec.adviser;
      return String(advId) === String(absentTeacherId);
    });
    return s ? { name: s.name, gradeLevel: s.gradeLevel } : null;
  }, [absentTeacherId, sections]);

  function reset() {
    setAssignedDate(today);
    setAbsentTeacherId("");
    setSubTeacherId("");
    setCredentials(null);
    setShowPassword(false);
    setCopied(false);
  }

  function handleClose() { reset(); onClose(); }

  async function handleGenerate() {
    if (!absentTeacherId || !subTeacherId || !assignedDate) return;
    setSaving(true);
    try {
      const res = await api.post("/substitutes", { absentTeacherId, substituteTeacherId: subTeacherId, assignedDate });
      setCredentials(res);
    } catch (err) {
      toast.error(err.message ?? "Failed to generate account.");
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials() {
    const text = `ID: ${credentials.credentials.sequenceLabel}\nEmail: ${credentials.credentials.email}\nPassword: ${credentials.credentials.password}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const availableSubs = teachers.filter((t) => t._id !== absentTeacherId);

  return (
    <Modal open={open} onClose={handleClose} title="Generate Temporary Account">
      {!credentials ? (
        <div className="space-y-4 py-1">
          {/* Date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Date of Absence
            </label>
            <input
              type="date"
              value={assignedDate}
              onChange={(e) => setAssignedDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Absent teacher */}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Absent Teacher
            </label>
            <select
              value={absentTeacherId}
              onChange={(e) => { setAbsentTeacherId(e.target.value); setSubTeacherId(""); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Select teacher —</option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Section (read-only) */}
          {absentTeacherId && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-xs text-muted-foreground">Advisory Section: </span>
              {section
                ? <span className="font-medium">{section.gradeLevel} {section.name}</span>
                : <span className="italic text-muted-foreground">No advisory section in active school year</span>}
            </div>
          )}

          {/* Substitute teacher */}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Substitute Teacher
            </label>
            <select
              value={subTeacherId}
              onChange={(e) => setSubTeacherId(e.target.value)}
              disabled={!absentTeacherId}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">— Select substitute —</option>
              {availableSubs.map((t) => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
            <Button
              size="sm"
              disabled={!absentTeacherId || !subTeacherId || !section || saving}
              onClick={handleGenerate}
            >
              {saving ? "Generating…" : "Generate Account"}
            </Button>
          </div>
        </div>
      ) : (
        /* Credentials display */
        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/40">
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">Account created successfully</p>
            <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-500">
              {credentials.assignment.sequenceLabel} · {credentials.assignment.assignedSectionName}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            These credentials are shown <strong>once only</strong>. Copy or share them before closing.
          </p>

          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2.5 text-sm">
            <div className="flex items-baseline gap-3">
              <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Login Email
              </span>
              <span className="font-mono font-medium text-foreground break-all">
                {credentials.credentials.email}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Password
              </span>
              <span className="font-mono tracking-widest text-base font-medium text-foreground">
                {showPassword ? credentials.credentials.password : "••••••••••"}
              </span>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>

          {credentials.sentTo ? (
            <p className="text-xs text-muted-foreground">
              Credentials emailed to <strong>{credentials.sentTo}</strong>.
            </p>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              No email address on file for this substitute teacher — share credentials manually.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            This account will be automatically deactivated after the attendance cutoff on{" "}
            <strong>{credentials.assignment.assignedDate}</strong>.
          </p>

          <div className="flex flex-wrap gap-2 justify-end pt-1">
            <Button variant="outline" size="sm" onClick={copyCredentials} className="gap-1.5">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy Credentials"}
            </Button>
            <Button size="sm" onClick={handleClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Substitute History modal ──────────────────────────────────────────────────

const STATUS_BADGE = {
  active:      "bg-emerald-100 text-emerald-700 ring-emerald-200",
  deactivated: "bg-slate-100 text-slate-500 ring-slate-200",
};

const STATUS_LABEL = {
  present: "Present",
  late:    "Late",
  absent:  "Absent",
  excused: "Excused",
};
const STATUS_COLOR = {
  present: "text-emerald-700",
  late:    "text-amber-700",
  absent:  "text-red-700",
  excused: "text-blue-700",
};
const SOURCE_DISPLAY = {
  room_scan:   "Room Scan",
  manual:      "Manual",
  manual_edit: "Manual",
};

function generatePdf(assignment, records, scannedAt) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${assignment.sequenceLabel} — Substitute Attendance</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; padding: 32px 40px; }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .sub { color: #666; font-size: 12px; margin-bottom: 20px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; }
    .meta-item { }
    .meta-item.full { grid-column: span 2; }
    .meta-item label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #888; display: block; }
    .meta-item span { font-size: 12px; color: #111; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f3f4f6; }
    th { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 8px 10px; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }
    .present { background:#d1fae5; color:#065f46; }
    .late    { background:#fef3c7; color:#92400e; }
    .absent  { background:#fee2e2; color:#991b1b; }
    .excused { background:#dbeafe; color:#1e40af; }
    .footer { margin-top: 28px; font-size: 10px; color: #aaa; text-align: right; }
    @media print { body { padding: 20px 28px; } }
  </style>
</head>
<body>
  <h1>Substitute Attendance Report</h1>
  <p class="sub">${assignment.sequenceLabel}</p>
  <div class="meta">
    <div class="meta-item"><label>Date</label><span>${fmtDate(assignment.assignedDate)}</span></div>
    <div class="meta-item"><label>Section</label><span>${assignment.assignedSectionName ?? "—"}</span></div>
    <div class="meta-item"><label>Absent Teacher</label><span>${assignment.absentTeacher?.name ?? "—"}</span></div>
    <div class="meta-item"><label>Substitute</label><span>${assignment.substituteTeacher?.name ?? "—"}</span></div>
    ${scannedAt ? `<div class="meta-item full"><label>Room Scan Time</label><span>${fmtDateTime(scannedAt)}</span></div>` : ""}
  </div>
  <table>
    <thead><tr><th>#</th><th>Student</th><th>Gate Scan</th><th>Room Scan</th><th>Source</th></tr></thead>
    <tbody>${records.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.studentName ?? "—"}</td>
        <td>${r.gateTimeIn ?? "—"}</td>
        <td><span class="badge ${r.status ?? ""}">${STATUS_LABEL[r.status] ?? "—"}</span></td>
        <td>${r.substituteAssignmentId ? (SOURCE_DISPLAY[r.source] ?? r.source ?? "—") : "—"}</td>
      </tr>`).join("")}
    </tbody>
  </table>
  <p class="footer">Generated ${new Date().toLocaleString()}</p>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

// Detail modal — shows all records for one assignment + PDF button
function AssignmentDetailModal({ open, onClose, assignment, records, loadingRecords, scannedAt }) {
  if (!assignment) return null;

  return (
    <Modal open={open} onClose={onClose} title={assignment.sequenceLabel} size="xl">
      {/* Header info */}
      <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
        <div>
          <span className="text-xs text-muted-foreground">Date</span>
          <p className="font-medium">{fmtDate(assignment.assignedDate)}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Section</span>
          <p className="font-medium">{assignment.assignedSectionName ?? "—"}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Absent Teacher</span>
          <p className="font-medium">{assignment.absentTeacher?.name ?? "—"}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Substitute</span>
          <p className="font-medium">{assignment.substituteTeacher?.name ?? "—"}</p>
        </div>
        {scannedAt && (
          <div className="col-span-2">
            <span className="text-xs text-muted-foreground">Room Scan</span>
            <p className="font-medium">{fmtDateTime(scannedAt)}</p>
          </div>
        )}
      </div>

      {/* Records table */}
      {loadingRecords ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading records…</p>
      ) : !records || records.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No attendance records captured.</p>
      ) : (
        <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
              <tr className="text-left">
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">#</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Student</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Gate Scan</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Room Scan</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {records.map((r, i) => (
                <tr key={r._id ?? i} className="hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.studentName}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.gateTimeIn ?? "—"}</td>
                  <td className={cn("px-3 py-2 font-semibold capitalize", STATUS_COLOR[r.status] ?? "text-muted-foreground")}>
                    {STATUS_LABEL[r.status] ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.substituteAssignmentId ? (SOURCE_DISPLAY[r.source] ?? r.source ?? "—") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {records ? `${records.length} record${records.length !== 1 ? "s" : ""}` : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          {records && records.length > 0 && (
            <Button size="sm" onClick={() => generatePdf(assignment, records, scannedAt)}>
              <Printer className="size-4" />
              Generate PDF
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function SubstituteHistoryModal({ open, onClose }) {
  const [history,         setHistory]         = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [actioning,       setActioning]       = useState(null); // id of row being acted on
  const [detailAsgn,      setDetailAsgn]      = useState(null);
  const [detailRecords,   setDetailRecords]   = useState(null);
  const [detailScannedAt, setDetailScannedAt] = useState(null);
  const [loadingDetail,   setLoadingDetail]   = useState(false);

  const load = useCallback(() => {
    if (!open) return;
    setLoading(true);
    api.get("/substitutes")
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => { load(); }, [load]);

  async function handleDeactivate(a) {
    setActioning(a._id);
    try {
      await api.patch(`/substitutes/${a._id}/deactivate`);
      toast.success(`${a.sequenceLabel} deactivated.`);
      load();
    } catch (err) {
      toast.error(err.message ?? "Failed to deactivate.");
    } finally {
      setActioning(null);
    }
  }

  async function handleDelete(a) {
    if (!window.confirm(`Delete ${a.sequenceLabel}? This will permanently remove the assignment and its temporary account.`)) return;
    setActioning(a._id);
    try {
      await api.delete(`/substitutes/${a._id}`);
      toast.success(`${a.sequenceLabel} deleted.`);
      load();
    } catch (err) {
      toast.error(err.message ?? "Failed to delete.");
    } finally {
      setActioning(null);
    }
  }

  async function openDetail(asgn) {
    setDetailAsgn(asgn);
    setDetailRecords(null);
    setDetailScannedAt(null);
    setLoadingDetail(true);
    try {
      const { records, scannedAt } = await api.get(`/substitutes/${asgn._id}/attendance`);
      setDetailRecords(records);
      setDetailScannedAt(scannedAt ?? null);
    } catch {
      setDetailRecords([]);
      setDetailScannedAt(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Substitute Account History">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : history.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No substitute accounts have been generated yet.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {history.map((a) => (
              <div key={a._id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">{a.sequenceLabel}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", STATUS_BADGE[a.status] ?? STATUS_BADGE.deactivated)}>
                      {a.status === "active" ? "Active" : "Deactivated"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fmtDate(a.assignedDate)} · {a.assignedSectionName || "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/80">
                    Absent: <span className="font-medium">{a.absentTeacher?.name ?? "—"}</span>
                    {" · "}
                    Sub: <span className="font-medium">{a.substituteTeacher?.name ?? "—"}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.attendanceCaptured} record{a.attendanceCaptured !== 1 ? "s" : ""} captured
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {a.status === "active" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actioning === a._id}
                        onClick={() => handleDeactivate(a)}
                        className="h-7 gap-1 px-2 text-xs text-amber-600 hover:text-amber-700 border-amber-200 hover:border-amber-300"
                      >
                        <PowerOff className="size-3" />
                        Deactivate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actioning === a._id}
                        onClick={() => handleDelete(a)}
                        className="h-7 gap-1 px-2 text-xs text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDetail(a)}
                    className="h-7 px-2 text-xs"
                  >
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <AssignmentDetailModal
        open={!!detailAsgn}
        onClose={() => setDetailAsgn(null)}
        assignment={detailAsgn}
        records={detailRecords}
        loadingRecords={loadingDetail}
        scannedAt={detailScannedAt}
      />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeacherAttendancePage() {
  const router   = useRouter();
  const now      = new Date();
  const [year,         setYear]         = useState(now.getFullYear());
  const [monthIdx,     setMonthIdx]     = useState(now.getMonth());
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [detailCell,   setDetailCell]   = useState(null);
  const [editMode,     setEditMode]     = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showHistory,  setShowHistory]  = useState(false);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [allYears,     setAllYears]     = useState([]);
  const [selectedSyId, setSelectedSyId] = useState(null);

  // Spacer column: callback ref fires when the container actually mounts (after
  // loading + data are ready), so clientWidth is non-zero when we measure.
  const [spacerW,   setSpacerW]   = useState(0);
  const observerRef = useRef(null);
  const gridRef = useCallback((el) => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    if (!el) return;
    const update = () => setSpacerW(Math.max(0, el.clientWidth - 192 - 36));
    update();
    observerRef.current = new ResizeObserver(update);
    observerRef.current.observe(el);
  }, []);

  const monthStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;

  // Load all school years once on mount; default to the active SY.
  useEffect(() => {
    api.get("/school-years")
      .then((years) => {
        const arr = Array.isArray(years) ? years : [];
        setAllYears(arr);
        const active = arr.find((y) => y.isActive);
        if (active) setSelectedSyId(active._id);
      })
      .catch(() => {});
  }, []);

  // When the SY selector changes, snap the month view to the SY's start month.
  function handleSyChange(newSyId) {
    setSelectedSyId(newSyId || null);
    const sy = allYears.find((y) => y._id === newSyId);
    if (sy?.startDate) {
      const d = new Date(sy.startDate);
      setYear(d.getFullYear());
      setMonthIdx(d.getMonth());
    }
  }

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ month: monthStr });
    if (selectedSyId) params.set("syId", selectedSyId);
    api.get(`/employee-attendance?${params}`)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [monthStr, refreshKey, selectedSyId]);

  const noClassDays      = data?.noClassDays ?? [];
  const schoolYear       = data?.schoolYear  ?? null;
  const selectedYear     = allYears.find((y) => y._id === selectedSyId) ?? null;
  const isViewingArchived = selectedYear ? !selectedYear.isActive : false;
  const teachers    = useMemo(
    () => (data?.teachers ?? []).slice().sort(sortByGenderThenSurname),
    [data],
  );
  // All weekdays in the queried month — backend byDate handles what to show per cell.
  // Historical months (outside the active SY) still render their columns so
  // closed-year records remain visible as read-only entries.
  const weekdays = useMemo(() => data?.weekdays ?? [], [data]);

  const noClassTypeMap = useMemo(() => new Map(noClassDays.map((d) => [d.date, d.type])), [noClassDays]);
  // noClassSet excludes online_class days — those are school days where attendance is still required.
  const noClassSet = useMemo(
    () => new Set(noClassDays.filter((d) => d.type !== "online_class").map((d) => d.date)),
    [noClassDays],
  );
  const todayStr   = toISODate(new Date());

  function cellCat(ds, byDate) {
    const cell = byDate?.[ds];
    if (cell == null) return "dash";
    const s = cell.status;
    if (s === "no_class") return "no_class";
    // Online class day with no attendance yet — show violet placeholder dot.
    if (cell.isOnlineClassDay && s == null) return "online_class";
    if (s == null) return "dash";
    if (s === "present" || s === "late") return "green";
    if (s === "absent") return "red";
    if (s === "excused") return "blue";
    return "dash";
  }

  function prevMonth() {
    if (monthIdx === 0) { setYear((y) => y - 1); setMonthIdx(11); }
    else setMonthIdx((m) => m - 1);
  }
  function nextMonth() {
    if (monthIdx === 11) { setYear((y) => y + 1); setMonthIdx(0); }
    else setMonthIdx((m) => m + 1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Teacher Attendance</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Monthly overview — click a teacher name for their full record</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowHistory(true)}>
            <History className="size-4" />
            Substitute History
          </Button>
          <Button size="sm" onClick={() => setShowGenerate(true)}>
            <UserPlus className="size-4" />
            Generate Substitute
          </Button>
        </div>
      </div>

      {/* School Year selector */}
      {allYears.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">School Year</span>
          <select
            value={selectedSyId ?? ""}
            onChange={(e) => handleSyChange(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— None —</option>
            {allYears.map((sy) => (
              <option key={sy._id} value={sy._id}>
                {sy.name}
                {sy.isActive ? " (Active)" : " (Inactive)"}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Archived SY notice */}
      {isViewingArchived && selectedYear && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
          Viewing history for <strong>{selectedYear.name}</strong> — this school year is closed and all records are read-only.
        </div>
      )}

      {/* Month navigator */}
      <div className="flex items-center gap-1">
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
      </div>

      {/* School year notice */}
      {!loading && !schoolYear && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No active school year configured. Set up a school year to start tracking teacher attendance.
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
          Loading…
        </div>
      ) : (
        <div ref={gridRef} className="overflow-x-auto rounded-2xl bg-card shadow-sm ring-1 ring-black/5">
              <table className="min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="sticky left-0 z-10 min-w-48 border-r border-slate-100 bg-slate-50/70 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Teacher
                    </th>
                    {weekdays.map((ds) => {
                      const d       = new Date(`${ds}T12:00:00+08:00`);
                      const dayNum  = d.getUTCDate();
                      const dow     = d.getUTCDay();
                      const ncdType = noClassTypeMap.get(ds);
                      return (
                        <th key={ds} className={cn(
                          "w-9 min-w-9 px-0.5 py-2 text-center text-xs font-semibold",
                          ncdType === "online_class" ? "text-violet-500"
                            : ncdType ? "text-amber-500"
                            : "text-muted-foreground"
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
                  {teachers.length === 0 ? (
                    <tr>
                      <td colSpan={weekdays.length + 2}
                        className="py-10 text-center text-sm text-muted-foreground">
                        No teachers found.
                      </td>
                    </tr>
                  ) : teachers.map((t, ti) => (
                    <tr key={String(t.employeeId)}
                      className={ti < teachers.length - 1 ? "border-b border-slate-50" : ""}>
                      {/* Sticky teacher name */}
                      <td className="sticky left-0 z-10 min-w-48 border-r border-slate-100 bg-card px-4 py-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/teacher-attendance/${t.employeeId}${selectedSyId ? `?syId=${selectedSyId}` : ""}`)}
                          className="text-left text-sm font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {t.teacher}
                        </button>
                      </td>
                      {/* Attendance cells */}
                      {weekdays.map((ds) => {
                        const cat  = cellCat(ds, t.byDate);
                        const cell = t.byDate?.[ds];
                        const clickable = cell != null;
                        return (
                          <td key={ds}
                            className={cn(
                              "px-0.5 py-2 text-center",
                              clickable && "cursor-pointer hover:bg-slate-50"
                            )}
                            onClick={() => {
                              if (!clickable) return;
                              setDetailCell({ teacher: t.teacher, employeeId: t.employeeId, date: ds, cat, cell });
                              setEditMode(!cell?.readonly && cat !== "no_class" && ds <= todayStr);
                            }}
                          >
                            <CellDot cat={cat} />
                          </td>
                        );
                      })}
                      <td aria-hidden="true" />
                    </tr>
                  ))}
                </tbody>
              </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        <LegendDot color="bg-emerald-500" label="Present / Late" />
        <LegendDot color="bg-red-500"     label="Absent" />
        <LegendDot color="bg-blue-400"    label="Excused" />
        <LegendDot color="bg-amber-400"   label="No Class Day" />
        <LegendDot color="bg-violet-500"  label="Online Class" />
        <span>— = No record / Future / Outside school year</span>
      </div>


      {/* Cell detail modal — edit picker expands inline when Edit is clicked */}
      <Modal
        open={!!detailCell}
        onClose={() => { setDetailCell(null); setEditMode(false); }}
        title="Teacher Attendance Detail"
      >
        {detailCell && (
          <div className="space-y-3 py-1 text-sm">
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 space-y-1.5">
              <p>
                <span className="text-muted-foreground">Teacher: </span>
                <strong>{detailCell.teacher}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Date: </span>
                <strong>{fmtDate(detailCell.date)}</strong>
              </p>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                {detailCell.cat === "no_class"
                  ? <span className="font-medium text-amber-600">No Class Day</span>
                  : detailCell.cell?.status
                  ? <StatusChip status={detailCell.cell.status} />
                  : <span className="italic text-muted-foreground">No record</span>}
                {detailCell.cell?.isOnlineClassDay && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/60 dark:text-violet-300">
                    Online Class Day
                  </span>
                )}
              </div>
              {detailCell.cell?.gateScanTime && (
                <p>
                  <span className="text-muted-foreground">Gate Scan: </span>
                  <strong className="font-mono">{detailCell.cell.gateScanTime}</strong>
                </p>
              )}
              {detailCell.cell?.minutesLate != null && (
                <p>
                  <span className="text-muted-foreground">Minutes Late: </span>
                  <strong className="text-amber-600">{detailCell.cell.minutesLate} min</strong>
                </p>
              )}
              {detailCell.cell?.homeroomScanTime && (
                <p>
                  <span className="text-muted-foreground">Homeroom Scan: </span>
                  <strong className="font-mono">{detailCell.cell.homeroomScanTime}</strong>
                </p>
              )}
            </div>
            {detailCell.cell?.isOnlineClassDay && (
              <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                Physical scanning is disabled on online class days. Attendance must be recorded manually.
              </p>
            )}
            {detailCell.cell?.readonly && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                This record is from a previous school year and is read-only.
              </p>
            )}
            {detailCell.cell?.manualStatus && (
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                Status manually overridden by admin.
              </p>
            )}

            {editMode ? (
              <AttendanceStatusPicker
                mode="teacher"
                currentStatus={detailCell.cell?.status ?? null}
                onSave={async (newStatus) => {
                  try {
                    await api.patch("/employee-attendance/correct", {
                      employeeId: detailCell.employeeId,
                      date:       detailCell.date,
                      newStatus,
                    });
                    toast.success("Teacher attendance updated.");
                    setRefreshKey((k) => k + 1);
                    setDetailCell(null);
                    setEditMode(false);
                  } catch (err) {
                    toast.error(err.message ?? "Failed to save.");
                    throw err;
                  }
                }}
                onCancel={() => setEditMode(false)}
              />
            ) : (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline"
                  onClick={() => router.push(`/admin/teacher-attendance/${detailCell.employeeId}${selectedSyId ? `?syId=${selectedSyId}` : ""}`)}>
                  Full Record
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDetailCell(null)}>Close</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <GenerateSubstituteModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
      />
      <SubstituteHistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </div>
  );
}
