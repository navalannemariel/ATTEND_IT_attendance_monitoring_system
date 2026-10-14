"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Megaphone, GraduationCap, Users, UserCheck, ShieldCheck, User,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/dashboard/dashboard-ui";
import { NoClassBanner } from "@/components/dashboard/no-class-banner";
import { api } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";
import { resolveStatsByStudent } from "@/lib/attendanceResolver";

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Both Attendance.timeIn (student) and EmployeeAttendance.gateScanTime (teacher)
// are stored using toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
// which produces "HH:MM AM" / "HH:MM PM" — NOT an ISO timestamp.
// This single function handles all formats that can appear in those fields.
function formatLocaleTime(t) {
  if (!t || t === "—") return "—";
  const s = String(t);

  // "HH:MM AM" / "HH:MM PM" — primary format stored by the backend
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = parseInt(m12[2], 10);
    if (h < 0 || h > 12 || m < 0 || m > 59) return "—";
    const ap = m12[3].toUpperCase();
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    const disp = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${disp}`;
  }

  // "HH:MM" 24-hour — alternative format
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) return "—";
    const disp = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${disp}`;
  }

  // ISO timestamp fallback — require YYYY-MM-DDTHH prefix to avoid V8's
  // lenient single-token parsing (e.g. new Date("7") → valid date in V8).
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const ms = new Date(s).getTime();
    if (isNaN(ms)) return "—";
    const d = new Date(ms + 8 * 60 * 60 * 1000);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const disp = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${disp}`;
  }

  return "—";
}

// Returns minutes-from-midnight (0–1439) for chronological sorting.
// Returns -1 for any invalid/missing value so those rows sink to the
// bottom of a descending sort without throwing or breaking order.
function timeToMinutes(t) {
  if (!t || t === "—") return -1;
  const s = String(t);
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = parseInt(m12[2], 10);
    if (isNaN(h) || isNaN(m)) return -1;
    const ap = m12[3].toUpperCase();
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    if (isNaN(h) || isNaN(m)) return -1;
    return h * 60 + m;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const ms = new Date(s).getTime();
    if (isNaN(ms)) return -1;
    const d = new Date(ms + 8 * 60 * 60 * 1000);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
  return -1;
}

function formatDisplayDate() {
  return new Date().toLocaleDateString("en-PH", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function StatusDot({ color }) {
  const cls = {
    emerald: "bg-emerald-500",
    amber:   "bg-amber-500",
    red:     "bg-red-500",
    sky:     "bg-sky-500",
    slate:   "bg-slate-400",
  }[color];
  return <span className={`inline-block size-2 shrink-0 rounded-full ${cls}`} />;
}

function PeopleCard({ icon: Icon, iconBg, iconColor, count, label }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-4">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        <Icon className={`size-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold tabular-nums leading-none text-foreground">{count}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground/50">Total</p>
      </div>
    </div>
  );
}

const ATT_ROWS = [
  { label: "Present",  key: "present",  color: "emerald" },
  { label: "Late",     key: "late",     color: "amber"   },
  { label: "Absent",   key: "absent",   color: "red"     },
  { label: "Excused",  key: "excused",  color: "sky"     },
  { label: "Unmarked", key: "unmarked", color: "slate"   },
];

// Module-level cache — lives in JS module memory for the browser session.
// Survives client-side navigation; cleared on full page reload (F5).
// Date-keyed so yesterday's data never surfaces on a new school day.
let _dashboardCache = null;

export default function AdminDashboardPage() {
  const { user } = useAuth();

  // Snapshot the cache at mount time. If it's for today, seed state from it
  // so return visits show real data immediately instead of blanking the UI.
  const _today0 = todayLocal();
  const _seed   = _dashboardCache?.date === _today0 ? _dashboardCache : null;

  const [allUsers,     setAllUsers]     = useState(() => _seed?.allUsers     ?? []);
  const [todayAtt,     setTodayAtt]     = useState(() => _seed?.todayAtt     ?? []);
  const [teacherAtt,   setTeacherAtt]   = useState(() => _seed?.teacherAtt   ?? null);
  const [noClassToday, setNoClassToday] = useState(() => _seed?.noClassToday ?? false);
  // loading=true only when there is no prior data — shows the skeleton state.
  // Return visits start with loading=false and refresh silently in the background.
  const [loading,      setLoading]      = useState(() => _seed === null);

  const load = useCallback(async () => {
    const today = todayLocal();
    const results = await Promise.allSettled([
      api.get("/users"),
      api.get(`/attendance?date=${today}`),
      api.get(`/employee-attendance?date=${today}`),
      api.get("/calendar/today"),
    ]);
    const [usersR, attR, tAttR, calR] = results;

    // Derive new values only from successful responses.
    // Failed endpoints leave the currently-displayed data unchanged.
    const newUsers = usersR.status === "fulfilled" && Array.isArray(usersR.value)
      ? usersR.value : null;
    const newAtt   = attR.status === "fulfilled" && Array.isArray(attR.value)
      ? attR.value : null;
    const newTAtt  = tAttR.status === "fulfilled" && Array.isArray(tAttR.value?.teachers)
      ? tAttR.value : null;
    const newNoCls = calR.status === "fulfilled" && calR.value != null
      ? calR.value.isNoClassDay === true : null;

    if (newUsers  !== null) setAllUsers(newUsers);
    if (newAtt    !== null) setTodayAtt(newAtt);
    if (newTAtt   !== null) setTeacherAtt(newTAtt);
    if (newNoCls  !== null) setNoClassToday(newNoCls);

    // Persist successful data so the next navigation return is instant.
    _dashboardCache = {
      date:         today,
      allUsers:     newUsers  ?? _dashboardCache?.allUsers     ?? [],
      todayAtt:     newAtt    ?? _dashboardCache?.todayAtt     ?? [],
      teacherAtt:   newTAtt   ?? _dashboardCache?.teacherAtt   ?? null,
      noClassToday: newNoCls  ?? _dashboardCache?.noClassToday ?? false,
    };

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  // People counts
  const peopleCounts = useMemo(() => {
    const c = { student: 0, teacher: 0, guidance_counselor: 0, admin: 0 };
    for (const u of allUsers) {
      if (!u.deletedAt && c[u.role] !== undefined) c[u.role]++;
    }
    return c;
  }, [allUsers]);

  // Gate scans — merged students + teachers, newest first.
  // timeMin is minutes-from-midnight so student and teacher keys are
  // directly comparable (both derive from the same locale time format).
  const allGateScans = useMemo(() => {
    const studentScans = todayAtt
      .filter((r) => r.source === "gate_scan")
      .map((r) => ({
        key:     `s-${r._id ?? r.studentName + r.timeIn}`,
        timeMin: timeToMinutes(r.timeIn),
        timeStr: formatLocaleTime(r.timeIn),
        name:    r.studentName,
        role:    "Student",
      }));

    const teacherScans = (teacherAtt?.teachers ?? [])
      .filter((t) => t.gateScanTime != null)
      .map((t) => ({
        key:     `t-${t.employeeId}`,
        timeMin: timeToMinutes(t.gateScanTime),
        timeStr: formatLocaleTime(t.gateScanTime),
        name:    t.teacher,
        role:    "Teacher",
      }));

    return [...studentScans, ...teacherScans].sort((a, b) => b.timeMin - a.timeMin);
  }, [todayAtt, teacherAtt]);

  // Student attendance stats
  const studentStats = useMemo(() => {
    const counts    = resolveStatsByStudent(todayAtt);
    const finalized = counts.present + counts.late + counts.absent + counts.excused;
    return { ...counts, unmarked: Math.max(0, peopleCounts.student - finalized) };
  }, [todayAtt, peopleCounts.student]);

  const studentTotalMarked = studentStats.present + studentStats.late + studentStats.absent + studentStats.excused;

  // Teacher attendance stats
  const teacherStats = useMemo(() => {
    const counts = { present: 0, late: 0, absent: 0, excused: 0, unmarked: 0 };
    for (const t of (teacherAtt?.teachers ?? [])) {
      if      (t.status === "present")  counts.present++;
      else if (t.status === "late")     counts.late++;
      else if (t.status === "absent")   counts.absent++;
      else if (t.status === "excused")  counts.excused++;
      else                              counts.unmarked++;
    }
    return counts;
  }, [teacherAtt]);

  const teacherTotalMarked = teacherStats.present + teacherStats.late + teacherStats.absent + teacherStats.excused;

  if (!user) return null;
  const totalPeople = Object.values(peopleCounts).reduce((s, n) => s + n, 0);

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        subtitle="System overview for the attendance monitoring system."
        actions={
          <Link href="/admin/announcements" className={buttonVariants({ size: "sm" })}>
            <Megaphone className="size-4" />
            New Announcement
          </Link>
        }
      />

      <NoClassBanner />

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">

        {/* ── Gate Scans Today ─────────────────────────────────────────────── */}
        <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Card header */}
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Gate Scans Today</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                List of individuals who performed gate scans today
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              {loading ? "—" : allGateScans.length}
              <span className="font-normal">Total Gate Scans</span>
            </span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 440 }}>
            {loading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
            ) : allGateScans.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No gate scans recorded today.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur-sm">
                  <tr className="border-b border-border">
                    <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                    <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                    <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allGateScans.map((scan) => (
                    <tr key={scan.key} className="transition-colors hover:bg-muted/30">
                      <td className="px-5 py-3 tabular-nums text-xs text-muted-foreground">{scan.timeStr}</td>
                      <td className="px-5 py-3 font-medium text-foreground">{scan.name}</td>
                      <td className="px-5 py-3">
                        {scan.role === "Teacher" ? (
                          <span className="flex items-center gap-1.5 text-sm font-medium text-orange-500 dark:text-orange-400">
                            <Users className="size-3.5 shrink-0" />
                            Teacher
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                            <User className="size-3.5 shrink-0" />
                            Student
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                          Gate Scan
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">

          {/* Today's Attendance */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-5">
            <div className="mb-4">
              <h2 className="text-base font-bold text-foreground">
                Today&apos;s Attendance{" "}
                <span className="text-sm font-normal text-muted-foreground">({formatDisplayDate()})</span>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Attendance count for today</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Students column */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-950/40">
                    <GraduationCap className="size-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">Students</span>
                </div>
                <div className="space-y-2">
                  {ATT_ROWS.map(({ label, key, color }) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <StatusDot color={color} />
                        {label}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {loading ? "—" : studentStats[key]}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-lg bg-sky-50 px-3 py-2 dark:bg-sky-950/30">
                  <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-400">Total Students Marked</span>
                  <span className="text-base font-bold tabular-nums text-sky-700 dark:text-sky-400">
                    {loading ? "—" : studentTotalMarked}
                  </span>
                </div>
              </div>

              {/* Teachers column */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/40">
                    <Users className="size-4 text-orange-500 dark:text-orange-400" />
                  </div>
                  <span className="text-sm font-semibold text-orange-500 dark:text-orange-400">Teachers</span>
                </div>
                <div className="space-y-2">
                  {ATT_ROWS.map(({ label, key, color }) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <StatusDot color={color} />
                        {label}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {loading ? "—" : teacherStats[key]}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-lg bg-orange-50 px-3 py-2 dark:bg-orange-950/30">
                  <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400">Total Teachers Marked</span>
                  <span className="text-base font-bold tabular-nums text-orange-600 dark:text-orange-400">
                    {loading ? "—" : teacherTotalMarked}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* People Overview */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-5">
            <div className="mb-4">
              <h2 className="text-base font-bold text-foreground">People Overview</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Total people in the system</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <PeopleCard
                icon={GraduationCap}
                iconBg="bg-sky-100 dark:bg-sky-950/40"
                iconColor="text-sky-600 dark:text-sky-400"
                count={loading ? "—" : peopleCounts.student}
                label="Students"
              />
              <PeopleCard
                icon={Users}
                iconBg="bg-orange-100 dark:bg-orange-950/40"
                iconColor="text-orange-500 dark:text-orange-400"
                count={loading ? "—" : peopleCounts.teacher}
                label="Teachers"
              />
              <PeopleCard
                icon={UserCheck}
                iconBg="bg-violet-100 dark:bg-violet-950/40"
                iconColor="text-violet-600 dark:text-violet-400"
                count={loading ? "—" : peopleCounts.guidance_counselor}
                label="Guidance"
              />
              <PeopleCard
                icon={ShieldCheck}
                iconBg="bg-red-100 dark:bg-red-950/40"
                iconColor="text-red-600 dark:text-red-400"
                count={loading ? "—" : peopleCounts.admin}
                label="Administrators"
              />
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
              <span className="text-3xl font-bold tabular-nums text-foreground">
                {loading ? "—" : totalPeople}
              </span>
              <span className="text-sm text-muted-foreground">Total People</span>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
