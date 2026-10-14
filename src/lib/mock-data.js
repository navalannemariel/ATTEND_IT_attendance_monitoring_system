// Placeholder data so the dashboards show realistic content while there is
// no backend. Replace these with real API calls later.

export const ATTENDANCE_RECORDS = [
  { id: 1, student: "Andrea Santos", section: "Grade 10 - St. Peter", date: "2026-06-18", status: "Present", timeIn: "07:42 AM" },
  { id: 2, student: "Miguel Reyes", section: "Grade 10 - St. Peter", date: "2026-06-18", status: "Late", timeIn: "08:15 AM" },
  { id: 3, student: "Sofia Dela Cruz", section: "Grade 10 - St. Peter", date: "2026-06-18", status: "Absent", timeIn: "—" },
  { id: 4, student: "Gabriel Mendoza", section: "Grade 10 - St. Peter", date: "2026-06-18", status: "Present", timeIn: "07:38 AM" },
  { id: 5, student: "Isabella Garcia", section: "Grade 10 - St. Peter", date: "2026-06-18", status: "Present", timeIn: "07:51 AM" },
  { id: 6, student: "Lucas Aquino", section: "Grade 10 - St. Peter", date: "2026-06-18", status: "Excused", timeIn: "—" },
  { id: 7, student: "Chloe Ramos", section: "Grade 10 - St. Peter", date: "2026-06-17", status: "Present", timeIn: "07:45 AM" },
  { id: 8, student: "Nathan Villanueva", section: "Grade 10 - St. Peter", date: "2026-06-17", status: "Late", timeIn: "08:05 AM" },
];

export const CASES = [
  {
    id: "C-1024",
    student: "Miguel Reyes",
    section: "Grade 10 - St. Peter",
    type: "Frequent Tardiness",
    priority: "Medium",
    status: "Open",
    updated: "2026-06-17",
    guardian: "Mrs. Reyes",
    guardianContact: "+63 917 555 0102",
    period: "Last 30 days",
    attendanceRate: 82,
    absences: 4,
    lates: 9,
    reason:
      "Flagged for a rising pattern of tardiness — 9 late arrivals in the last 30 days, almost all during first period. The pattern began in early June and is increasing week over week.",
    riskFactors: [
      "9 late arrivals this month (up from 2 last month)",
      "Tardiness concentrated in first period",
      "Missed 2 first-period quizzes due to late arrival",
    ],
    history: [
      { date: "2026-06-17", status: "Late", note: "Arrived 08:15 (1st period)" },
      { date: "2026-06-16", status: "Late", note: "Arrived 08:10" },
      { date: "2026-06-12", status: "Late", note: "Arrived 08:20" },
      { date: "2026-06-10", status: "Absent", note: "No excuse submitted" },
    ],
    aiMeasures: [
      "Schedule a brief check-in to identify the cause of morning tardiness (transport, sleep, home routine).",
      "Set up a 2-week punctuality goal with daily first-period monitoring.",
      "Send an early parent advisory before the pattern escalates to absences.",
    ],
    recommendedAction: "Parent advisory + punctuality monitoring",
  },
  {
    id: "C-1023",
    student: "Sofia Dela Cruz",
    section: "Grade 9 - St. John",
    type: "Excessive Absences",
    priority: "High",
    status: "In Progress",
    updated: "2026-06-16",
    guardian: "Mr. & Mrs. Dela Cruz",
    guardianContact: "+63 918 555 0173",
    period: "Last 30 days",
    attendanceRate: 64,
    absences: 11,
    lates: 3,
    reason:
      "Flagged HIGH priority for excessive absences — 11 absences in the last 30 days, several consecutive. Attendance rate has dropped to 64%, below the 75% intervention threshold.",
    riskFactors: [
      "11 absences this month (attendance at 64%)",
      "3 consecutive absences in week of June 8",
      "No medical certificate or excuse for 6 of the absences",
      "Grades trending down alongside attendance",
    ],
    history: [
      { date: "2026-06-16", status: "Absent", note: "Unexcused" },
      { date: "2026-06-15", status: "Absent", note: "Unexcused" },
      { date: "2026-06-09", status: "Absent", note: "Unexcused (3-day streak)" },
      { date: "2026-06-04", status: "Excused", note: "Medical" },
    ],
    aiMeasures: [
      "Escalate to guidance for a parent conference — absence rate is below the intervention threshold.",
      "Request medical/home documentation for the unexcused streak.",
      "Create an attendance recovery plan with weekly follow-ups.",
      "Coordinate with subject teachers on make-up work to prevent academic fallout.",
    ],
    recommendedAction: "Refer for parent conference (urgent)",
  },
  {
    id: "C-1021",
    student: "Lucas Aquino",
    section: "Grade 10 - St. Peter",
    type: "Behavioral",
    priority: "Low",
    status: "Resolved",
    updated: "2026-06-12",
    guardian: "Mrs. Aquino",
    guardianContact: "+63 919 555 0144",
    period: "Last 30 days",
    attendanceRate: 95,
    absences: 1,
    lates: 2,
    reason:
      "Minor behavioral flag during class. Resolved after a counseling session; attendance remains strong at 95%.",
    riskFactors: ["Isolated incident", "No recurring pattern"],
    history: [
      { date: "2026-06-12", status: "Present", note: "Counseling session completed" },
      { date: "2026-06-05", status: "Late", note: "Arrived 08:05" },
    ],
    aiMeasures: [
      "Continue routine monitoring; no active intervention needed.",
      "Positive reinforcement to maintain good attendance.",
    ],
    recommendedAction: "Monitor",
  },
  {
    id: "C-1019",
    student: "Nathan Villanueva",
    section: "Grade 10 - St. Peter",
    type: "Frequent Tardiness",
    priority: "Medium",
    status: "Open",
    updated: "2026-06-15",
    guardian: "Mr. Villanueva",
    guardianContact: "+63 917 555 0188",
    period: "Last 30 days",
    attendanceRate: 86,
    absences: 2,
    lates: 7,
    reason:
      "Flagged for repeated tardiness — 7 late arrivals this month. Mostly Mondays, suggesting a weekend routine issue.",
    riskFactors: [
      "7 late arrivals this month",
      "Tardiness clustered on Mondays",
      "Attendance otherwise stable",
    ],
    history: [
      { date: "2026-06-15", status: "Late", note: "Monday, arrived 08:05" },
      { date: "2026-06-08", status: "Late", note: "Monday, arrived 08:12" },
      { date: "2026-06-01", status: "Late", note: "Monday, arrived 08:09" },
    ],
    aiMeasures: [
      "Discuss weekend-to-school routine with student and guardian.",
      "Set a Monday punctuality reminder.",
      "Re-evaluate in 2 weeks; escalate if the pattern continues.",
    ],
    recommendedAction: "Parent advisory + monitoring",
  },
];

/** Look up a single case by its id. */
export function getCaseById(id) {
  return CASES.find((c) => c.id === id) ?? null;
}

export const USERS = [
  { id: "u-admin", name: "Admin User", email: "admin@hhca.edu.ph", role: "Administrator", status: "Active" },
  { id: "u-teacher", name: "Teacher User", email: "teacher@hhca.edu.ph", role: "Teacher", status: "Active" },
  { id: "u-guidance", name: "Guidance User", email: "guidance@hhca.edu.ph", role: "Guidance Counselor", status: "Active" },
  { id: "u-005", name: "Maria Lopez", email: "m.lopez@hhca.edu.ph", role: "Teacher", status: "Active" },
  { id: "u-006", name: "Jose Bautista", email: "j.bautista@hhca.edu.ph", role: "Teacher", status: "Inactive" },
];

export const CONFERENCES = [
  { id: "CF-31", student: "Sofia Dela Cruz", parent: "Mr. & Mrs. Dela Cruz", date: "2026-06-20", time: "10:00 AM", status: "Scheduled" },
  { id: "CF-32", student: "Ella Navarro", parent: "Mrs. Navarro", date: "2026-06-20", time: "01:00 PM", status: "Scheduled" },
  { id: "CF-30", student: "Miguel Reyes", parent: "Mrs. Reyes", date: "2026-06-23", time: "01:30 PM", status: "Scheduled" },
  { id: "CF-29", student: "Daniel Cruz", parent: "Mr. Cruz", date: "2026-06-25", time: "09:30 AM", status: "Scheduled" },
  { id: "CF-28", student: "Nathan Villanueva", parent: "Mr. Villanueva", date: "2026-06-19", time: "09:00 AM", status: "Confirmed" },
  { id: "CF-27", student: "Chloe Ramos", parent: "Mrs. Ramos", date: "2026-06-16", time: "11:00 AM", status: "Completed" },
  { id: "CF-25", student: "Lucas Aquino", parent: "Mrs. Aquino", date: "2026-06-14", time: "02:00 PM", status: "Completed" },
];

/** Conferences scheduled on a given date. */
export function getConferencesForDate(dateStr) {
  return CONFERENCES.filter((c) => c.date === dateStr);
}

/** Unique dates that have at least one conference (for calendar dots). */
export const CONFERENCE_DATES = [...new Set(CONFERENCES.map((c) => c.date))];

export const ATTENDANCE_SUMMARY = {
  present: 412,
  late: 38,
  absent: 21,
  excused: 14,
};

// ── Calendar-driven attendance ────────────────────────────────────────────
// Deterministic generated attendance so any past/selected date has data to
// show and export. Swap for real API queries when a backend exists.

export const STUDENT_ROSTER = [
  { name: "Andrea Santos", section: "Grade 10 - St. Peter" },
  { name: "Miguel Reyes", section: "Grade 10 - St. Peter" },
  { name: "Sofia Dela Cruz", section: "Grade 10 - St. Peter" },
  { name: "Gabriel Mendoza", section: "Grade 10 - St. Peter" },
  { name: "Isabella Garcia", section: "Grade 10 - St. Peter" },
  { name: "Lucas Aquino", section: "Grade 10 - St. Peter" },
  { name: "Chloe Ramos", section: "Grade 10 - St. Peter" },
  { name: "Nathan Villanueva", section: "Grade 10 - St. Peter" },
  { name: "Ella Navarro", section: "Grade 10 - St. Peter" },
  { name: "Daniel Cruz", section: "Grade 10 - St. Peter" },
];

/** Format a Date as a local "YYYY-MM-DD" string. */
export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function statusFor(name, dateStr) {
  const h = hashCode(name + dateStr);
  const r = h % 100;
  if (r < 80)
    return { status: "Present", timeIn: `07:${String(35 + (h % 20)).padStart(2, "0")} AM` };
  if (r < 90)
    return { status: "Late", timeIn: `08:${String(5 + (h % 15)).padStart(2, "0")} AM` };
  if (r < 96) return { status: "Absent", timeIn: "—" };
  return { status: "Excused", timeIn: "—" };
}

/** Attendance rows for a single student for a specific month (most recent first). */
export function getAttendanceForStudentInMonth(name, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const out = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toISODate(new Date(year, month, d));
    const dow = new Date(`${dateStr}T00:00:00`).getDay();
    if (dow === 0 || dow === 6) continue;
    const { status, timeIn } = statusFor(name, dateStr);
    out.push({ id: `${name}-${dateStr}`, date: dateStr, student: name, timeIn, status });
  }
  return out.reverse();
}

/**
 * Attendance rows for a single student over the last `days` calendar days
 * (most recent first). Reuses the same deterministic logic as the roster, so
 * any student — seeded or admin-added — gets stable, realistic history.
 * Weekends are skipped (no classes).
 */
export function getAttendanceForStudent(name, days = 30) {
  const out = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const dateStr = toISODate(d);
    const { status, timeIn } = statusFor(name, dateStr);
    out.push({ id: `${name}-${dateStr}`, date: dateStr, student: name, timeIn, status });
  }
  return out;
}

/** Attendance rows for one date. Weekends return [] (no classes). */
export function getAttendanceForDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return [];
  return STUDENT_ROSTER.map((s, i) => {
    const { status, timeIn } = statusFor(s.name, dateStr);
    return {
      id: `${dateStr}-${i}`,
      date: dateStr,
      student: s.name,
      section: s.section,
      timeIn,
      status,
    };
  });
}

/** Attendance rows for a whole month (month is 0-based). */
export function getAttendanceForMonth(year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  let out = [];
  for (let d = 1; d <= days; d++) {
    out = out.concat(getAttendanceForDate(toISODate(new Date(year, month, d))));
  }
  return out;
}

/** Attendance rows for a whole year. */
export function getAttendanceForYear(year) {
  let out = [];
  for (let m = 0; m < 12; m++) out = out.concat(getAttendanceForMonth(year, m));
  return out;
}

/** Count rows by status for the summary chips. */
export function summarize(rows) {
  return rows.reduce(
    (acc, r) => {
      const key = r.status.toLowerCase();
      if (key in acc) acc[key] += 1;
      return acc;
    },
    { present: 0, late: 0, absent: 0, excused: 0 }
  );
}
