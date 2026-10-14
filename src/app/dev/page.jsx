"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, FlaskConical, CheckCircle2, AlertTriangle, PlusCircle } from "lucide-react";

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const RULE_LABEL = {
  habitual_tardiness:          "Habitual Tardiness",
  consecutive_absences:        "Consecutive Absences",
  absence_percentage:          "High Absence Rate",
  unexcused_absence_incidents: "Unexcused Absences",
};

function TriggeredRule({ rule, studentId, asOfDate }) {
  const isHT = rule.ruleTriggered === "habitual_tardiness";
  const [state, setState] = useState(null); // null | "loading" | { created, message } | { error }

  const createCase = useCallback(async () => {
    setState("loading");
    try {
      const data = await api.post("/dev/create-case", { studentId, asOfDate });
      setState({ created: data.created, message: data.message });
    } catch (e) {
      setState({ error: e.message ?? "Failed to create case." });
    }
  }, [studentId, asOfDate]);

  return (
    <li className="rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {RULE_LABEL[rule.ruleTriggered] ?? rule.ruleTriggered}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{rule.details}</p>
        </div>
      </div>

      {/* Create Case action — habitual_tardiness only */}
      {isHT && (
        <div className="pl-5">
          {!state && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={createCase}>
              <PlusCircle className="size-3.5" />
              Create Case
            </Button>
          )}
          {state === "loading" && (
            <p className="text-xs text-muted-foreground">Creating…</p>
          )}
          {state?.message && (
            <div className={cn(
              "rounded-md px-2.5 py-1.5 text-xs",
              state.created
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
            )}>
              {state.created ? "✓ " : "ℹ "}{state.message}
            </div>
          )}
          {state?.error && (
            <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
          )}
        </div>
      )}
    </li>
  );
}

export default function DevPage() {
  // Unlike the admin/teacher/guidance dashboards, this page isn't wrapped in
  // DashboardShell, so nothing else here was waiting for Firebase to finish
  // restoring the session before firing API calls. On a fresh/hard load, the
  // student-list request could go out before auth.currentUser was populated,
  // get a 401, and trip the app's session-expired redirect even though the
  // user was genuinely logged in. Wait for the same auth-ready signal
  // DashboardShell already uses before fetching anything.
  const { user, loading: authLoading } = useAuth();

  const [students, setStudents] = useState([]);
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null);
  const [asOfDate, setAsOfDate] = useState(todayLocal);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (authLoading || !user) return;
    api.get("/users/students").then((data) => {
      setStudents(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [authLoading, user]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return students;
    return students.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.section ?? "").toLowerCase().includes(q) ||
      (s.studentNumber ?? "").toLowerCase().includes(q)
    );
  }, [students, search]);

  const runCheck = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await api.post("/dev/prescriptive-check", {
        studentId: selected._id,
        asOfDate,
      });
      setResult(data);
    } catch (e) {
      setError(e.message ?? "Request failed.");
    } finally {
      setLoading(false);
    }
  }, [selected, asOfDate]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Header */}
        <div className="flex items-center gap-2.5">
          <FlaskConical className="size-5 text-violet-500" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Prescriptive Engine Tester</h1>
            <p className="text-xs text-muted-foreground">
              Dev only — evaluate rules as of any date. Habitual tardiness cases can be created from here to test the full teacher flow.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">

          {/* Student picker */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Student</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search name, section, ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-sm h-9"
              />
            </div>
            <div className="h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {filtered.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No students found.</p>
              ) : (
                filtered.map((s) => (
                  <button
                    key={s._id}
                    onClick={() => { setSelected(s); setResult(null); }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                      selected?._id === s._id && "bg-violet-50 dark:bg-violet-950/40"
                    )}
                  >
                    <span className="font-medium text-foreground">{s.name}</span>
                    {s.section && (
                      <span className="ml-1.5 text-[11px] text-muted-foreground">{s.section}</span>
                    )}
                  </button>
                ))
              )}
            </div>
            {selected && (
              <p className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">
                Selected: {selected.name}
              </p>
            )}
          </div>

          {/* Date + Run */}
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Evaluate as of date</p>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => { setAsOfDate(e.target.value); setResult(null); }}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <p className="text-[11px] text-muted-foreground">
                The engine treats this date as "today" — habitual tardiness checks the Mon–Fri week containing this date.
              </p>
            </div>

            <Button
              onClick={runCheck}
              disabled={!selected || loading}
              className="w-full"
            >
              {loading ? "Running…" : "Run Check"}
            </Button>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">
                Results for{" "}
                <span className="text-violet-600 dark:text-violet-400">{result.studentName}</span>
                {result.asOfDate && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    as of {result.asOfDate}
                  </span>
                )}
              </p>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                result.triggered.length > 0
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
              )}>
                {result.triggered.length} rule{result.triggered.length !== 1 ? "s" : ""} triggered
              </span>
            </div>

            {result.triggered.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-emerald-500" />
                No rules triggered for this date.
              </div>
            ) : (
              <ul className="space-y-2">
                {result.triggered.map((rule, i) => (
                  <TriggeredRule
                    key={i}
                    rule={rule}
                    studentId={selected?._id}
                    asOfDate={result.asOfDate}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
