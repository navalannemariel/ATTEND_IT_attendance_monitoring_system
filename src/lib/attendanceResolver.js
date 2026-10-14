// src/lib/attendanceResolver.js
//
// Single source of truth for resolving a student's attendance status from
// multiple source records on the same day.
//
// Policy: gate scan alone is NOT enough to be Present — it only proves the
// student entered the school. Room scan is the second required signal. Both
// a gate scan AND a room scan must exist before the day can resolve to a
// final Present/Late automatically. Either one alone (or neither) resolves
// to 'pending' until Guidance/Adviser manually confirms/corrects it, or the
// end-of-day auto-absent sweep finalizes it to 'absent'.
//
// Priority:  Manual  >  (Gate + Room combined)  >  Auto-absent  >  pending
//
// Exception: Gate Late + Room Present → Late (tardiness is preserved over room
//            present, because the gate timestamp proves the student arrived
//            after the cutoff even if the teacher marked them present in class).

/**
 * Resolves the canonical attendance status for one student on one day.
 *
 * @param {Array<{source: string, status: string}>} records
 *   All attendance records for this student on this calendar date.
 * @returns {'present'|'late'|'absent'|'excused'|'pending'|null}
 *   null only when records is empty (no sweep has run yet / truly no data).
 *   'pending' when some evidence exists (a gate scan or a room scan, but not
 *   both, and no manual/auto-absent record) — not yet a final status.
 */
export function resolveAttendanceStatus(records) {
  if (!records || records.length === 0) return null;

  // ── 1. Manual always wins ─────────────────────────────────────────────────
  const manual = records.find((r) => r.source === "manual");
  if (manual) return (manual.status ?? "").toLowerCase();

  // ── 2. Gate scan AND room scan both required for an automatic final status ──
  const gate     = records.find((r) => r.source === "gate_scan");
  const roomRecs = records.filter((r) => r.source === "room_scan");
  const roomStatus = _resolveRoomRecords(roomRecs);

  if (gate && roomStatus !== null) {
    const gs = (gate.status ?? "").toLowerCase();
    // Gate Late  + Room Present → Late    (gate arrival time is authoritative for tardiness)
    if (gs === "late"    && roomStatus === "present") return "late";
    // Gate Present + Room Late  → Present (gate proved on-time; room-scan photo time is irrelevant)
    if (gs === "present" && roomStatus === "late")    return "present";
    return roomStatus;
  }

  // ── 3. Auto-absent fallback ───────────────────────────────────────────────
  const auto = records.find((r) => r.source === "auto_absent");
  if (auto) return "absent";

  // ── 4. One signal present but not both, and not yet swept — pending ───────
  if (gate || roomStatus !== null) return "pending";

  return null;
}

/**
 * From multiple room_scan records in one day, returns the status of the
 * homeroom / first-period scan (earliest createdAt).
 */
function _resolveRoomRecords(roomRecs) {
  if (!roomRecs || roomRecs.length === 0) return null;
  const sorted = [...roomRecs].sort(
    (a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0)
  );
  return (sorted[0].status ?? "").toLowerCase();
}

/**
 * Groups a flat array of records by (studentName, dateStr) and resolves
 * each group to a single canonical status.
 *
 * Returns an object keyed by studentName → resolved status for today.
 * Used by dashboard stat-card computation.
 *
 * @param {Array}  records    Flat attendance records (all students, one date)
 * @param {string} nameKey    Field holding student name (default: 'studentName')
 * @returns {{ present: number, late: number, absent: number, excused: number }}
 */
export function resolveStatsByStudent(records, nameKey = "studentName") {
  const byStudent = {};
  for (const r of records) {
    const name = r[nameKey] ?? r.student ?? "";
    if (!byStudent[name]) byStudent[name] = [];
    byStudent[name].push(r);
  }

  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const recs of Object.values(byStudent)) {
    const status = resolveAttendanceStatus(recs);
    if (status && counts[status] !== undefined) counts[status]++;
  }
  return counts;
}

/**
 * Groups records by date and resolves each day. Returns a map of
 * { dateStr → resolvedStatus } for a single student's history.
 *
 * @param {Array}  records   Attendance records for one student (multiple dates)
 * @param {string} dateKey   Field holding the date (default: 'date')
 * @returns {Object}  { [dateStr]: 'present'|'late'|'absent'|'excused'|null }
 */
export function resolveByDate(records, dateKey = "date") {
  const byDate = {};
  for (const r of records) {
    const raw = r[dateKey];
    const d   = raw instanceof Date
      ? raw.toISOString().slice(0, 10)
      : String(raw ?? "").slice(0, 10);
    if (!d) continue;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(r);
  }

  const result = {};
  for (const [d, dayRecs] of Object.entries(byDate)) {
    result[d] = resolveAttendanceStatus(dayRecs);
  }
  return result;
}

/**
 * Computes attendance rate from a map of { dateStr → resolvedStatus }.
 * Rate = (present + late) / (present + late + absent) × 100
 * Excused days are excluded from the denominator.
 *
 * @param {Object} resolvedByDate
 * @returns {{ present: number, late: number, absent: number, excused: number, rate: number|null }}
 */
export function computeAttendanceRate(resolvedByDate) {
  let present = 0, late = 0, absent = 0, excused = 0;
  for (const status of Object.values(resolvedByDate)) {
    if (status === "present")      present++;
    else if (status === "late")    late++;
    else if (status === "absent")  absent++;
    else if (status === "excused") excused++;
  }
  const denom = present + late + absent;
  const rate  = denom > 0 ? Math.round(((present + late) / denom) * 100) : null;
  return { present, late, absent, excused, rate };
}
