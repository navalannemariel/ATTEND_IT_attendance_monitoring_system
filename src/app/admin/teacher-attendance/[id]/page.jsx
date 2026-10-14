"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function fmtDate(str) {
  if (!str) return "—";
  try {
    return new Date(`${str}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
  } catch { return str; }
}

function fmtMonthLabel(yyyyMM) {
  if (!yyyyMM) return "";
  try {
    return new Date(`${yyyyMM}-01T12:00:00`).toLocaleString("en-US", { month: "long", year: "numeric" });
  } catch { return yyyyMM; }
}

function SummaryCard({ label, value, highlight }) {
  return (
    <div className={cn("rounded-xl p-4 ring-1", highlight ? "bg-primary/5 ring-primary/20" : "bg-card ring-black/5")}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", highlight ? "text-primary" : "text-foreground")}>
        {value ?? "—"}
      </p>
    </div>
  );
}

function lateCell(r) {
  if (r.minutesLate != null) {
    return (
      <span className="font-medium text-amber-600">
        {r.minutesLate} {r.minutesLate === 1 ? "min" : "mins"} late
      </span>
    );
  }
  if (r.status === "late")    return <span className="font-medium text-amber-600">Late</span>;
  if (r.status === "present") return <span className="font-medium text-emerald-600">On Time</span>;
  if (r.status === "absent")  return <span className="font-medium text-red-600">Absent</span>;
  if (r.status === "excused") return <span className="font-medium text-blue-600">Excused</span>;
  return <span className="text-muted-foreground/40">—</span>;
}

function generateMonthlyPdf(teacher, section, schoolYear, reportLabel, records) {
  const totalLate = records.reduce((sum, r) => sum + (r.minutesLate ?? 0), 0);
  const syLabel   = schoolYear ? schoolYear.name : "—";

  const rows = records.map((r, i) => {
    let lateText;
    if (r.minutesLate != null)   lateText = `${r.minutesLate} ${r.minutesLate === 1 ? "min" : "mins"} late`;
    else if (r.status === "late")    lateText = "Late";
    else if (r.status === "present") lateText = "On Time";
    else if (r.status === "absent")  lateText = "Absent";
    else if (r.status === "excused") lateText = "Excused";
    else lateText = "—";

    const lateClass = (r.minutesLate != null || r.status === "late") ? "late-val" : "";
    return `<tr>
      <td>${i + 1}</td>
      <td>${fmtDate(r.date)}</td>
      <td class="mono">${r.gateScanTime ?? "—"}</td>
      <td class="${lateClass}">${lateText}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${teacher} — ${reportLabel} Attendance</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; padding: 32px 40px; }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .sub { color: #666; font-size: 12px; margin-bottom: 20px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; }
    .meta-item label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #888; display: block; }
    .meta-item span { font-size: 12px; color: #111; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f3f4f6; }
    th { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 8px 10px; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
    .mono { font-family: monospace; }
    .late-val { color: #92400e; font-weight: 600; }
    .total-row td { font-weight: 700; background: #f9fafb; }
    .footer { margin-top: 28px; font-size: 10px; color: #aaa; text-align: right; }
    @media print { body { padding: 20px 28px; } }
  </style>
</head>
<body>
  <h1>${teacher} — Monthly Attendance Record</h1>
  <p class="sub">${reportLabel}</p>
  <div class="meta">
    <div class="meta-item"><label>Teacher</label><span>${teacher}</span></div>
    <div class="meta-item"><label>Period</label><span>${reportLabel}</span></div>
    ${section ? `<div class="meta-item"><label>Advisory Section</label><span>${section}</span></div>` : ""}
    <div class="meta-item"><label>School Year</label><span>${syLabel}</span></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Date</th><th>Gate Time</th><th>Late</th></tr></thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="3" style="text-align:right;padding-right:12px">Cumulative Late (${reportLabel})</td>
        <td>${totalLate > 0 ? `${totalLate} min${totalLate !== 1 ? "s" : ""}` : "—"}</td>
      </tr>
    </tbody>
  </table>
  <p class="footer">Generated ${new Date().toLocaleString()}</p>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

export default function TeacherDetailPage() {
  const { id }       = useParams();
  const searchParams = useSearchParams();
  const syId         = searchParams?.get("syId") ?? null;

  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [reportMonth, setReportMonth] = useState("");

  useEffect(() => {
    if (!id) return;
    const url = syId ? `/employee-attendance/${id}?syId=${syId}` : `/employee-attendance/${id}`;
    api.get(url)
      .then(setData)
      .catch(() => setError("Could not load teacher attendance."))
      .finally(() => setLoading(false));
  }, [id, syId]);

  if (loading) return (
    <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );

  if (error || !data) return (
    <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
      {error ?? "Teacher not found."}
    </div>
  );

  const { teacher, section, summary, records, schoolYear } = data;

  const manilaToday = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const cumulativeLateMinutes = records.reduce((sum, r) => sum + (r.minutesLate ?? 0), 0);

  const availableMonths = [...new Set(records.map(r => r.date.slice(0, 7)))].sort().reverse();

  const displayRecords = reportMonth
    ? records.filter(r => r.date.startsWith(reportMonth))
    : records;

  const reportLabel = reportMonth
    ? fmtMonthLabel(reportMonth)
    : (schoolYear ? `SY ${schoolYear.name}` : "All Records");

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link
          href="/admin/teacher-attendance"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Teacher Attendance
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{teacher}</h1>
        {section && (
          <p className="mt-0.5 text-sm text-muted-foreground">{section}</p>
        )}
        {schoolYear && (
          <p className="mt-1 text-xs text-muted-foreground/60">
            School Year {schoolYear.name} · {schoolYear.startDate} – {schoolYear.endDate}
          </p>
        )}
      </div>

      {/* No school year configured */}
      {!schoolYear && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No active school year configured. Attendance counts will not be calculated until a school year is set up.
        </div>
      )}

      {/* School year not yet started */}
      {schoolYear && records.length === 0 && manilaToday < schoolYear.startDate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          School days have not started yet for {schoolYear.name}. Attendance records will appear once the school year begins.
        </div>
      )}

      {/* School year started but teacher has no records */}
      {schoolYear && records.length === 0 && manilaToday >= schoolYear.startDate && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No attendance records found for this teacher.
        </div>
      )}

      {/* Summary cards */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Attendance Summary
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Present"         value={summary.present} />
          <SummaryCard label="Late"            value={summary.late} />
          <SummaryCard label="Absent"          value={summary.absent} />
          <SummaryCard label="Cumulative Late" value={`${cumulativeLateMinutes} min`} highlight />
        </div>
      </div>

      {/* Attendance History */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Attendance History
          </h2>
          {availableMonths.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={reportMonth}
                onChange={e => setReportMonth(e.target.value)}
                className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All months</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{fmtMonthLabel(m)}</option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateMonthlyPdf(teacher, section, schoolYear, reportLabel, displayRecords)}
              >
                <Printer className="size-3.5" />
                Monthly Record
              </Button>
            </div>
          )}
        </div>

        {records.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-black/5">
            No attendance records found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-black/5">
            <div className="hidden grid-cols-[1fr_120px_160px] items-center gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
              <span>Date</span>
              <span>Gate Time</span>
              <span>Late</span>
            </div>
            {displayRecords.map((r, i) => (
              <div
                key={r.date}
                className={cn(
                  "grid grid-cols-1 gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[1fr_120px_160px] sm:items-center",
                  i < displayRecords.length - 1 && "border-b border-slate-100"
                )}
              >
                <span className="text-sm font-medium text-foreground">{fmtDate(r.date)}</span>
                <span className="font-mono text-sm tabular-nums text-foreground">
                  {r.gateScanTime ?? <span className="text-muted-foreground/40">—</span>}
                </span>
                <span className="mt-0.5 text-sm sm:mt-0">
                  {lateCell(r)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
