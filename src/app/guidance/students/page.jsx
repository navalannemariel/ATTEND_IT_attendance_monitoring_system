"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-ui";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";

// Phase 9: this page previously computed its own "needs attention" signal
// here via `rate < 75 || absences >= 6` against every attendance record for
// every student — an independent, hardcoded risk decision that duplicated
// (and disagreed with) both the backend's rule thresholds and the MCDM
// assessment. Removed. Case-derived signals (below) are the only
// attention/priority indicator this list shows now. Showing the real MCDM
// assessment per row would require one GET /assessment call per student in
// the list — a genuine N+1 problem — so that is deliberately NOT done here;
// see the Phase 9 report for that finding instead of a workaround.

function activeCaseFor(studentId, cases) {
  const active = cases.filter((c) => (c.student?._id === studentId || c.student === studentId) && c.status !== "Resolved");
  if (active.length === 0) return null;
  const order = { High: 0, Medium: 1, Low: 2 };
  return active.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9))[0];
}

export default function GuidanceStudentsPage() {
  const [students,    setStudents]    = useState([]);
  const [cases,       setCases]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [query,       setQuery]       = useState("");
  const [section,     setSection]     = useState("all");
  const [filter,      setFilter]      = useState("all");

  useEffect(() => {
    async function load() {
      const [studs, cs] = await Promise.all([
        api.get("/users/students").catch(() => []),
        api.get("/cases").catch(() => []),
      ]);
      setStudents(Array.isArray(studs) ? studs : []);
      setCases(Array.isArray(cs)       ? cs    : []);
      setLoading(false);
    }
    load();
  }, []);

  const sections = useMemo(
    () => [...new Set(students.map((s) => s.section).filter(Boolean))].sort(),
    [students]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter((s) => {
        if (q && !s.name.toLowerCase().includes(q)) return false;
        if (section !== "all" && s.section !== section) return false;
        return true;
      })
      .map((s) => {
        const activeCase = activeCaseFor(s._id, cases);
        return { ...s, id: s._id, activeCase };
      })
      .filter((s) => {
        if (filter === "case") return !!s.activeCase;
        return true;
      })
      .sort((a, b) => {
        const aScore = a.activeCase ? 0 : 1;
        const bScore = b.activeCase ? 0 : 1;
        if (aScore !== bScore) return aScore - bScore;
        return a.name.localeCompare(b.name);
      });
  }, [students, cases, query, section, filter]);

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="All students — open a profile to view attendance history, cases, and referral notes."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="h-11 pl-9"
          />
        </div>
        <Select value={section} onChange={(e) => setSection(e.target.value)} className="h-11 w-auto min-w-44">
          <option value="all">All sections</option>
          {sections.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-11 w-auto min-w-44">
          <option value="all">All students</option>
          <option value="case">Has active case</option>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
          No students match your filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-black/5">
          {rows.map((row, i) => (
            <Link
              key={row.id}
              href={`/guidance/students/${row.id}`}
              className={`flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50 ${
                i < rows.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              <span className="font-medium text-foreground">{row.name}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
