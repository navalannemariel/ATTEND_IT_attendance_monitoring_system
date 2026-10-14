"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StudentDetail } from "@/components/dashboard/student-detail";
import { api } from "@/lib/api";

export default function GuidanceStudentDetailPage() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/users/${id}`)
      .then((data) => setStudent(data))
      .catch((err) => setError(err.message ?? "Failed to load student."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (error || !student) {
    return (
      <div className="space-y-4">
        <Link href="/guidance/students" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" />
          Back to Students
        </Link>
        <p className="text-sm text-muted-foreground">{error ?? "Student not found."}</p>
      </div>
    );
  }

  return <StudentDetail student={student} mode="guidance" backHref="/guidance/students" />;
}
