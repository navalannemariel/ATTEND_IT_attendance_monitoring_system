"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { PageHeader, DataTable } from "@/components/dashboard/dashboard-ui";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";

const SOURCE_LABELS = {
  guidance_manual:             "Guidance Counselor",
  teacher_referral:            "Teacher Referral",
  absence_percentage:          "System (Absence Rate)",
  consecutive_absences:        "System (Consecutive Absences)",
  failed_excuse_letter:        "System (Failed Excuse Letters)",
  unexcused_absence_incidents: "System (Unexcused Absences)",
};

function createdByLabel(c) {
  if (c.createdBy?.name) return c.createdBy.name;
  return SOURCE_LABELS[c.creationSource] ?? "—";
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function GuidanceCasesPage() {
  const [cases,   setCases]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/cases")
      .then((data) => setCases(Array.isArray(data) ? data : []))
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, []);

  const rows = cases.map((c) => ({
    id:            c._id,
    studentId:     c.student?._id,
    student:       c.student?.name ?? "—",
    type:          c.type,
    priority:      c.priority,
    status:        c.status,
    createdBy:     createdByLabel(c),
    triggerReason: c.triggerReason ?? c.reason ?? "—",
    filed:         fmtDate(c.createdAt),
  }));

  return (
    <>
      <PageHeader
        title="Cases"
        subtitle="Student cases referred to guidance and counseling."
      />

      <DataTable
        columns={[
          { key: "student",   label: "Student" },
          { key: "type",      label: "Type" },
          { key: "priority",  label: "Priority",  badge: true },
          { key: "status",    label: "Status",    badge: true },
          { key: "createdBy", label: "Created By" },
          {
            key: "triggerReason", label: "Trigger Reason",
            render: (row) => (
              <span className="block max-w-[220px] truncate text-xs text-muted-foreground" title={row.triggerReason}>
                {row.triggerReason}
              </span>
            ),
          },
          { key: "filed", label: "Date Filed" },
          {
            key: "actions", label: "",
            render: (row) => row.studentId ? (
              <Link
                href={`/guidance/students/${row.studentId}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Eye className="size-4" />
                View student
              </Link>
            ) : null,
          },
        ]}
        rows={rows}
        empty={loading ? "Loading…" : "No cases found."}
      />
    </>
  );
}
