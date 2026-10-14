"use client";

import { StudentDetail } from "@/components/dashboard/student-detail";

export function GuidanceStudentProfile({ student, backHref = "/guidance/students" }) {
  return <StudentDetail student={student} mode="guidance" backHref={backHref} />;
}
