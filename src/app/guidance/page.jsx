"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  RefreshCw, FolderOpen, Users, CalendarCheck, ArrowRight,
  AlertTriangle, CircleCheck,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { NoClassBanner } from "@/components/dashboard/no-class-banner";
import { PageHeader } from "@/components/dashboard/dashboard-ui";
import {
  BarChart, Bar, ResponsiveContainer, Tooltip,
} from "recharts";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS    = 7 * ONE_DAY_MS;

// Readable label per creationSource
const SOURCE_LABEL = {
  habitual_tardiness:          "Habitual Tardiness",
  cutting_classes:             "Cutting Classes",
  absence_percentage:          "High Absence Rate",
  consecutive_absences:        "Consecutive Absences",
  failed_excuse_letter:        "Excuse Letter Failure",
  unexcused_absence_incidents: "Unexcused Absences",
  teacher_referral:            "Teacher Referral",
  guidance_manual:             "Manual Case",
};

function concernLabel(c) {
  // Use the case type field when it's been set to something meaningful by the system.
  // Fall back to the source label for generic/blank types.
  if (c.type && c.type !== "Attendance Concern" && c.type !== "Teacher Referral") {
    return c.type;
  }
  return SOURCE_LABEL[c.creationSource] ?? c.type ?? "Concern";
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
      {children}
    </p>
  );
}

function ChartTip({ active, payload, label, valueSuffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] shadow-sm">
      {label && <p className="mb-0.5 text-muted-foreground">{label}</p>}
      <p className="font-semibold text-slate-800">
        {payload[0]?.value != null ? `${payload[0].value}${valueSuffix}` : "—"}
      </p>
    </div>
  );
}

function NoDataState() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-[11px] text-muted-foreground/50">No data yet</p>
    </div>
  );
}

// ── Student concern group card ────────────────────────────────────────────────

function StudentConcernCard({ group }) {
  const { studentId, name, section, activeCases } = group;
  const count = activeCases.length;

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground truncate">{name}</p>
            <span className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              count >= 3 ? "bg-red-100 text-red-700" : count === 2 ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
            )}>
              {count} active
            </span>
          </div>
          {section && (
            <p className="text-xs text-muted-foreground mt-0.5">{section}</p>
          )}
        </div>
      </div>

      {/* Active case list */}
      <ul className="mt-3 space-y-1">
        {activeCases.map((c) => (
          <li key={c._id} className="flex items-center gap-1.5 text-sm">
            <AlertTriangle className="size-3.5 shrink-0 text-orange-500" />
            <span className="font-semibold text-foreground">{concernLabel(c)}</span>
          </li>
        ))}
      </ul>

      {/* Action */}
      <div className="mt-4">
        <Link
          href={`/guidance/students/${studentId}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          View Student <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GuidanceDashboardPage() {
  const { user } = useAuth();

  const [cases,     setCases]     = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadData = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    Promise.all([
      api.get("/cases").catch(() => []),
      api.get("/referrals").catch(() => []),
    ]).then(([cs, refs]) => {
      setCases(Array.isArray(cs) ? cs : []);
      setReferrals(Array.isArray(refs) ? refs : []);
    }).catch((err) => {
      setLoadError(err.message ?? "Failed to load data.");
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(() => loadData(true), 10_000);
    return () => clearInterval(id);
  }, [loadData]);

  // ── Left side: group active cases by student ──────────────────────────────

  const studentGroups = useMemo(() => {
    // habitual_tardiness is handled by the teacher/adviser first — only appears
    // here after the teacher explicitly refers it via the referral flow.
    const activeCases = cases.filter((c) => c.status !== "Resolved" && c.creationSource !== "habitual_tardiness");
    const byStudent   = new Map();
    for (const c of activeCases) {
      const sid = String(c.student?._id ?? c.student ?? "unknown");
      if (!byStudent.has(sid)) {
        byStudent.set(sid, {
          studentId:   sid,
          name:        c.student?.name    ?? "—",
          section:     c.student?.section ?? "",
          activeCases: [],
        });
      }
      byStudent.get(sid).activeCases.push(c);
    }
    // Sort: most active concerns first, then alphabetically
    return Array.from(byStudent.values()).sort(
      (a, b) => b.activeCases.length - a.activeCases.length || a.name.localeCompare(b.name)
    );
  }, [cases]);

  // ── Right side stats ──────────────────────────────────────────────────────

  const activeCaseCount = useMemo(() => cases.filter((c) => c.status !== "Resolved" && c.creationSource !== "habitual_tardiness").length, [cases]);

  const resolvedThisMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    return cases.filter((c) => {
      if (c.status !== "Resolved") return false;
      if (c.creationSource === "habitual_tardiness") return false;
      const d = new Date(c.updatedAt ?? c.createdAt);
      return d.getFullYear() === y && d.getMonth() === m;
    }).length;
  }, [cases]);

  // Active cases broken down by concern type for the bar chart
  const activeByConcern = useMemo(() => {
    const counts = {};
    for (const c of cases) {
      if (c.status === "Resolved") continue;
      if (c.creationSource === "habitual_tardiness") continue;
      const src = c.creationSource ?? "guidance_manual";
      counts[src] = (counts[src] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([src, n]) => ({ src, label: SOURCE_LABEL[src] ?? src, n }))
      .sort((a, b) => b.n - a.n);
  }, [cases]);

  const referralTrend = useMemo(() => {
    const now   = Date.now();
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const wEnd   = now - (7 - i) * WEEK_MS;
      const wStart = now - (8 - i) * WEEK_MS;
      const d      = new Date(wStart);
      return { label: `${d.getMonth() + 1}/${d.getDate()}`, wStart, wEnd, n: 0 };
    });
    for (const r of referrals) {
      if (!r.createdAt) continue;
      const t = new Date(r.createdAt).getTime();
      for (const w of weeks) {
        if (t >= w.wStart && t < w.wEnd) { w.n++; break; }
      }
    }
    const nowDate   = new Date();
    const tm = nowDate.getMonth(), ty = nowDate.getFullYear();
    const lm = tm === 0 ? 11 : tm - 1;
    const ly = tm === 0 ? ty - 1 : ty;
    let thisMonth = 0, lastMonth = 0;
    for (const r of referrals) {
      if (!r.createdAt) continue;
      const d = new Date(r.createdAt);
      if (d.getFullYear() === ty && d.getMonth() === tm) thisMonth++;
      if (d.getFullYear() === ly && d.getMonth() === lm) lastMonth++;
    }
    const diff      = thisMonth - lastMonth;
    const diffLabel = diff === 0
      ? "same as last month"
      : `${diff > 0 ? "+" : ""}${diff} vs last month`;
    return { bars: weeks, thisMonth, diffLabel };
  }, [referrals]);


  if (!user) return null;

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <NoClassBanner />

      {/* Header */}
      <PageHeader
        title={`${greeting}, ${user.name.split(" ")[0]}`}
        subtitle="Your guidance caseload and referral overview."
        actions={
          <button
            onClick={loadData}
            disabled={loading}
            aria-label="Refresh"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
        }
      />

      {loadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError} —{" "}
          <button className="underline" onClick={loadData}>Try again</button>
        </p>
      )}

      {/* Two-column layout */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* ── LEFT: Needs Attention (2/3) ───────────────────────────────── */}
        <section className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Needs Attention</SectionLabel>
            {!loading && studentGroups.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {studentGroups.length} student{studentGroups.length !== 1 ? "s" : ""} · {activeCaseCount} active concern{activeCaseCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/60" />
              ))}
            </div>
          ) : studentGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-12 text-center">
              <CircleCheck className="size-7 text-emerald-500" />
              <p className="text-sm font-medium text-foreground">All caught up</p>
              <p className="text-xs text-muted-foreground max-w-[22rem]">
                There are no active student concerns requiring your attention right now.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {studentGroups.map((group) => (
                <StudentConcernCard key={group.studentId} group={group} />
              ))}
            </div>
          )}
        </section>

        {/* ── RIGHT: Overview (1/3) ─────────────────────────────────────── */}
        <section className="space-y-4">
          <SectionLabel>Overview</SectionLabel>

          {/* Stat chips */}
          <div className="space-y-2">
            {[
              { icon: Users,         label: "Students Needing Attention", value: studentGroups.length, bg: "bg-red-50 text-red-700",      ring: "ring-red-200"     },
              { icon: FolderOpen,    label: "Active Cases",               value: activeCaseCount,      bg: "bg-amber-50 text-amber-700",  ring: "ring-amber-200"   },
              { icon: CalendarCheck, label: "Resolved This Month",        value: resolvedThisMonth,    bg: "bg-emerald-50 text-emerald-700", ring: "ring-emerald-200" },
            ].map(({ icon: Icon, label, value, bg, ring }) => (
              <div key={label} className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1",
                bg, ring
              )}>
                <Icon className="size-4 shrink-0 opacity-70" />
                <span className="flex-1 text-sm">{label}</span>
                <span className="text-lg font-bold tabular-nums">{loading ? "—" : value}</span>
              </div>
            ))}
          </div>

          {/* Referrals Trend */}
          {!loading && (
            <div className="rounded-xl border border-border bg-card p-4">
              <SectionLabel>Referrals Trend</SectionLabel>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground leading-none">
                {referralTrend.thisMonth}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground mb-3">{referralTrend.diffLabel}</p>
              <div style={{ height: 72 }}>
                {referralTrend.bars.every((b) => b.n === 0) ? (
                  <NoDataState />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={referralTrend.bars} barCategoryGap="32%" margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
                      <Bar dataKey="n" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                      <Tooltip
                        content={({ active, payload, label }) => (
                          <ChartTip active={active} payload={payload} label={`Wk of ${label}`} />
                        )}
                        cursor={{ fill: "rgba(100,116,139,0.06)" }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* Active Cases by Concern */}
          {!loading && activeByConcern.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <SectionLabel>Active Cases by Concern</SectionLabel>
              <div className="mt-3 space-y-2">
                {activeByConcern.map(({ src, label, n }) => {
                  const max = activeByConcern[0].n;
                  const pct = Math.round((n / max) * 100);
                  return (
                    <div key={src}>
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-foreground/80 leading-tight">{label}</span>
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground">{n}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/60"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

      </div>
    </>
  );
}
