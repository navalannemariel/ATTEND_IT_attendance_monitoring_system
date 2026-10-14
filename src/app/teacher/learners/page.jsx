"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-ui";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

export default function LearnerStatusPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState("");
  const [status,   setStatus]   = useState("all");

  useEffect(() => {
    api.get("/users/students?scope=advisory")
      .then((studs) => setStudents(Array.isArray(studs) ? studs : []))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false;
      if (status !== "all" && s.status !== status) return false;
      return true;
    }).map((s) => ({ ...s, id: s._id }));
  }, [students, query, status]);

  return (
    <>
      <PageHeader
        title="Student Status"
        subtitle="Search a student and open their record to review attendance and recommendations."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="h-11 pl-9"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-11 w-auto min-w-36"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
          Loading students…
        </div>
      ) : !loading && !(user?.sectionId || user?.section) ? (
        <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
          No advisory section assigned — contact the administrator.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
          No students match your filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-black/5">
          {rows.map((row, i) => (
            <Link
              key={row.id ?? i}
              href={`/teacher/learners/${row.id}`}
              className={`flex items-center px-4 py-3 text-sm hover:bg-slate-50 ${
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
