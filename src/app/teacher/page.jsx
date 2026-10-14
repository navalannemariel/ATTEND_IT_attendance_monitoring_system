"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { UserCheck, Clock, UserX, AlertTriangle, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, Cell, XAxis,
} from "recharts";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";
import { PageHeader, StatCard } from "@/components/dashboard/dashboard-ui";
import { NoClassBanner } from "@/components/dashboard/no-class-banner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { resolveAttendanceStatus, resolveStatsByStudent } from "@/lib/attendanceResolver";

function toISODate(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cap(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}


export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const [attendance,      setAttendance]      = useState([]);
  const [cases,           setCases]           = useState([]);
  const [students,        setStudents]        = useState([]);
  const [assessments,     setAssessments]     = useState([]);
  const [loading,         setLoading]         = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const today     = toISODate(new Date());
    // Stat cards and table only use today's records (filtered below), so widening
    // the window doesn't affect them. 60 days back covers retroactive attendance
    // corrections that bypass processAbsence (no ExcuseLetterCase created), and
    // captures any school year that started in late June or later (PH schedule).
    const attStart  = new Date();
    attStart.setDate(attStart.getDate() - 60);
    const weekStart = toISODate(attStart);
    const [att, caseList, studentList, assessmentList] = await Promise.all([
      api.get(`/attendance?scope=advisory&start=${weekStart}&end=${today}`).catch(() => []),
      api.get("/cases").catch(() => []),
      api.get("/users/students?scope=advisory").catch(() => []),
      // Persisted MCDM snapshots for this teacher's advisory students, one
      // batch call — never recomputed here, never N+1 per student.
      api.get("/users/students/assessments").catch(() => []),
    ]);
    setAttendance(Array.isArray(att) ? att : []);
    setCases(Array.isArray(caseList) ? caseList : []);
    setStudents(Array.isArray(studentList) ? studentList : []);
    setAssessments(Array.isArray(assessmentList) ? assessmentList : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 10_000);
    return () => clearInterval(id);
  }, [load]);

  if (!user) return null;

  const today      = toISODate(new Date());
  const firstName  = user.name.split(" ")[0];
  const hasAdvisory = !!(user.sectionId || user.section);

  // ── Today's stats ─────────────────────────────────────────────────────────
  const todayRecords = attendance.filter((r) => r.date && toISODate(new Date(r.date)) === today);
  const summary = resolveStatsByStudent(todayRecords);

  // Group today's raw records by student name for quick lookup.
  // Keys are lowercased so a gate_scan written before a name-case correction
  // still maps to the right student row.
  const todayByStudent = {};
  for (const r of todayRecords) {
    const name = (r.studentName ?? "").toLowerCase();
    if (!todayByStudent[name]) todayByStudent[name] = [];
    todayByStudent[name].push(r);
  }

  // One row per section student — Gate Scan column shows arrival time,
  // Room Scan column shows room-scan status; falls back to manual if no room scan.
  const todayRows = students.map((student) => {
    const recs      = todayByStudent[(student.name ?? "").toLowerCase()] ?? [];
    const gateRec   = recs.find((r) => r.source === "gate_scan");
    const roomRec   = recs
      .filter((r) => r.source === "room_scan")
      .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))[0] ?? null;
    const manualRec    = recs.find((r) => r.source === "manual");
    const autoAbsRec   = recs.find((r) => r.source === "auto_absent");
    // When both gate + room exist, use the resolver so that gate-present + room-late
    // → "present" (room-scan photo time doesn't override an on-time gate arrival).
    // When only a room scan exists (no gate), show its raw status — no gate means
    // we can't resolve tardiness, so the raw room status is the best signal.
    const resolved = resolveAttendanceStatus(recs);
    return {
      id:         student._id,
      name:       student.name,
      gateTime:   gateRec?.timeIn ?? "—",
      roomStatus: roomRec
        ? ((resolved && resolved !== "pending") ? resolved : roomRec.status)
        : (manualRec?.status ?? autoAbsRec?.status ?? null),
      isManual:   !roomRec && !!manualRec,
    };
  });
  const todayLabel = new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long", month: "short", day: "numeric",
  });

  // All non-resolved cases visible to teacher (guidance_manual cases not shown to teacher).
  // This remains the Case-based half of "Needs Attention" — every rule
  // (including the unexcused-absence warning) already runs live on the
  // backend on every attendance write and produces a real Case, so there is
  // no client-side threshold/incident computation here to duplicate that
  // decision. Left completely unchanged by the MCDM addition below.
  const needsAttentionCases = cases.filter((c) =>
    c.status !== "Resolved" && c.creationSource !== "guidance_manual"
  );

  // MCDM-based half of "Needs Attention" (Phase 12). Uses the EXISTING
  // persisted riskLevel label as-is — "Low" is excluded, everything else
  // (Moderate/High/Critical) qualifies. No new numeric threshold, no
  // recomputation: assessments came from the single batch call above. Joined
  // against `students` (already loaded) purely for display name — the batch
  // endpoint intentionally returns only studentId/overallScore/riskLevel.
  const studentNameById = new Map(students.map((s) => [String(s._id), s.name]));
  const mcdmAttentionEntries = assessments
    .filter((a) => a.riskLevel !== "Low")
    .map((a) => ({
      sid:          String(a.studentId),
      sName:        studentNameById.get(String(a.studentId)) ?? "—",
      overallScore: a.overallScore,
      riskLevel:    a.riskLevel,
    }));

  // ── This Week's Trend ──────────────────────────────────────────────────────
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return toISODate(d);
  });
  const trendData = last7.map((dateStr) => {
    const dayRecs  = attendance.filter((r) => r.date && toISODate(new Date(r.date)) === dateStr);
    const counts   = resolveStatsByStudent(dayRecs);
    const attended = counts.present + counts.late;
    const rate     = students.length > 0 ? Math.round((attended / students.length) * 100) : 0;
    return {
      day:     new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
      rate,
      hasData: dayRecs.length > 0,
    };
  });

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        subtitle="Your section's attendance overview at a glance."
      />

      <NoClassBanner />

      {!loading && !hasAdvisory && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          No advisory section assigned — dashboard shows your homeroom only. Contact the administrator to assign a section.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* ── LEFT: Today's Record (full height) ──────────────────────────── */}
        <Card className="flex flex-col">
          <CardHeader>
            <h2 className="font-heading text-base font-semibold text-foreground">
              Today&apos;s Record
            </h2>
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading…" : `${students.length} students · ${todayLabel}`}
            </p>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {loading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
            ) : students.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                No students in your advisory section.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">Student</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">Gate Scan</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">Room Scan</th>
                  </tr>
                </thead>
                <tbody>
                  {todayRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-foreground">{row.name}</td>
                      <td className="px-4 py-2.5 font-mono text-sm text-muted-foreground">
                        {row.gateTime}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.roomStatus ? (
                          <span className="flex items-center gap-1.5">
                            <span className={
                              row.roomStatus === "present" ? "text-xs font-semibold text-emerald-600" :
                              row.roomStatus === "late"    ? "text-xs font-semibold text-amber-600"   :
                              row.roomStatus === "absent"  ? "text-xs font-semibold text-red-500"     :
                              "text-xs font-semibold text-slate-500"
                            }>
                              {cap(row.roomStatus)}
                            </span>
                            {row.isManual && (
                              <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-400">
                                manual
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* ── RIGHT: Stats → Needs Attention → Week Trend ─────────────────── */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={UserCheck} label="Present" value={loading ? "—" : summary.present} tone="success" />
            <StatCard icon={Clock}     label="Late"    value={loading ? "—" : summary.late}    tone="warning" />
            <StatCard icon={UserX}     label="Absent"  value={loading ? "—" : summary.absent}  tone="danger" />
            <StatCard icon={UserCheck} label="Excused" value={loading ? "—" : summary.excused} tone="info" />
          </div>
          <NeedsAttentionCard
            cases={needsAttentionCases}
            mcdmAttentionEntries={mcdmAttentionEntries}
            loading={loading}
          />
          <WeekTrendCard trendData={trendData} loading={loading} />
        </div>

      </div>
    </>
  );
}

// ── Needs Attention card ──────────────────────────────────────────────────────
// Cases are grouped by student: one card entry per student, all active case
// types listed inside it so a student with 4 concerns shows as one row.

const CASE_LABELS = {
  habitual_tardiness:                  "Habitual Tardiness",
  cutting_classes:                     "Cutting Classes",
  absence_percentage:                  "High Absence Rate",
  consecutive_absences:                "Consecutive Absences",
  failed_excuse_letter:                "Repeated Failure — Excuse Letter",
  unexcused_absence_incidents:         "Unexcused Absence Incidents",
  unexcused_absence_incidents_warning: "Unexcused Absences (Early Warning)",
  teacher_referral:                    "Referred to Guidance",
};

function caseAccent(source) {
  if (source === "absence_percentage")
    return { bg: "bg-red-100", icon: "text-red-500", text: "text-red-600" };
  if (source === "habitual_tardiness" || source === "cutting_classes")
    return { bg: "bg-violet-100", icon: "text-violet-600", text: "text-violet-700" };
  if (source === "teacher_referral")
    return { bg: "bg-amber-100", icon: "text-amber-600", text: "text-amber-700" };
  return { bg: "bg-orange-100", icon: "text-orange-500", text: "text-orange-600" };
}

function NeedsAttentionCard({ cases, mcdmAttentionEntries = [], loading }) {
  // One map entry per student with an active concern, all their Case rows
  // grouped underneath — purely Case-derived, nothing computed client-side.
  const studentMap = new Map(); // sid -> { sid, sName, cases: [], mcdm: null }

  for (const c of cases) {
    const sid   = (c.student?._id ?? c.student)?.toString() ?? "__unknown__";
    const sName = typeof c.student === "object" ? (c.student?.name ?? "—") : "—";
    if (!studentMap.has(sid)) {
      studentMap.set(sid, { sid, sName, cases: [], mcdm: null });
    }
    studentMap.get(sid).cases.push(c);
  }

  // Second source: MCDM-attention students (Phase 12). A student already
  // present from the Case loop above gets the MCDM reason attached to that
  // SAME row (no duplicate row) — a student with only an MCDM reason gets a
  // new row with an empty cases[] array.
  for (const entry of mcdmAttentionEntries) {
    if (!studentMap.has(entry.sid)) {
      studentMap.set(entry.sid, { sid: entry.sid, sName: entry.sName, cases: [], mcdm: null });
    }
    studentMap.get(entry.sid).mcdm = entry;
  }

  const studentList  = Array.from(studentMap.values());
  const totalStudents = studentList.length;

  return (
    <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <h2 className="font-heading text-base font-semibold text-foreground">Needs Attention</h2>
            {!loading && totalStudents > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {totalStudents}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Attendance concerns detected for your advisory section.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : totalStudents === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No concerns detected.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {studentList.map(({ sid, sName, cases: sCases, mcdm }) => {
                const profileHref    = sid !== "__unknown__" ? `/teacher/learners/${sid}` : "#";
                const concernCount   = sCases.length + (mcdm ? 1 : 0);
                return (
                  <li key={sid} className="py-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Link
                        href={profileHref}
                        className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        {sName}
                      </Link>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {concernCount} active
                      </span>
                    </div>

                    <ul className="space-y-1">
                      {/* MCDM-based concern (Phase 12) — the persisted assessment
                          says Moderate or higher, independent of whether a Case
                          exists. Never a substitute for Case information below;
                          shown alongside it when both are present. */}
                      {mcdm && (
                        <li className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="size-3 shrink-0 text-violet-500" />
                            <span className="text-[11px] font-semibold text-foreground">
                              {mcdm.riskLevel} Attendance Risk
                            </span>
                          </div>
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            MCDM Score: {mcdm.overallScore}
                          </p>
                        </li>
                      )}

                      {/* Case-based concerns */}
                      {sCases.map((c) => {
                        const isHT = c.creationSource === "habitual_tardiness";
                        return (
                          <li key={c._id} className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="size-3 shrink-0 text-orange-500" />
                              <span className="text-[11px] font-semibold text-foreground">
                                {CASE_LABELS[c.creationSource] ?? c.creationSource}
                              </span>
                            </div>
                            {(c.triggerReason || isHT) && (
                              <p className="text-[11px] leading-snug text-muted-foreground">
                                {c.triggerReason ?? "3 or more lates this week"}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
  );
}

// ── This Week's Trend card ────────────────────────────────────────────────────

function WeekTrendCard({ trendData, loading }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="font-heading text-base font-semibold text-foreground">
            This Week&apos;s Trend
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Daily attendance rate for your section — last 7 days.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-2.5">
            <ResponsiveContainer width="100%" height={90}>
              <BarChart
                data={trendData}
                barCategoryGap="28%"
                margin={{ top: 2, right: 2, bottom: 0, left: 2 }}
              >
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Bar dataKey="rate" radius={[3, 3, 0, 0]}>
                  {trendData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        !d.hasData ? "#e2e8f0"
                        : d.rate >= 80 ? "#86efac"
                        : d.rate >= 60 ? "#fcd34d"
                        : "#fca5a5"
                      }
                    />
                  ))}
                </Bar>
                <Tooltip
                  cursor={{ fill: "rgba(100,116,139,0.06)" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = trendData.find((x) => x.day === label);
                    return (
                      <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] shadow-sm">
                        <p className="text-muted-foreground">{label}</p>
                        <p className="font-semibold text-slate-800">
                          {d?.hasData ? `${payload[0].value}% attended` : "No data"}
                        </p>
                      </div>
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-end gap-3 text-[10px] text-muted-foreground/70">
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-green-300" /> ≥80%
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-yellow-300" /> 60–79%
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-red-300" /> &lt;60%
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-slate-200" /> No data
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
