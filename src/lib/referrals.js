import { api } from "@/lib/api";
import { suggestConferenceSlots } from "@/lib/students";

/** Normalize a backend referral to the shape the UI components expect. */
export function normalizeReferral(r) {
  return {
    id:        r._id,
    caseId:    r.case?._id ?? r.case ?? null,
    studentId: r.student?._id ?? null,
    student:   r.student?.name ?? "",
    section:   r.student?.section ?? "",
    fromName:  r.fromUser?.name ?? "Teacher",
    reason:    r.reason ?? "",
    status:    r.status,
    date:      r.scheduledDate ?? null,
    time:      r.scheduledTime ?? null,
    guardian:  r.guardian ?? "",
    suggestedSlots: suggestConferenceSlots(),
    createdAt: r.createdAt,
  };
}

/** Teacher forwards a student/case to guidance. */
export async function addReferral({ studentId, caseId, guardian, reason }) {
  const data = await api.post("/referrals", {
    student:  studentId,
    reason:   (reason ?? "").trim(),
    caseId:   caseId  || null,
    guardian: guardian || "",
  });
  return data;
}

/** Guidance schedules a conference for this referral. */
export async function scheduleReferral(id, { date, time }) {
  return api.patch(`/referrals/${id}/schedule`, { scheduledDate: date, scheduledTime: time });
}
