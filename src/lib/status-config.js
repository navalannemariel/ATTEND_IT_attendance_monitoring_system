/**
 * Canonical status configuration for the entire web app.
 *
 * Keys cover both raw API values (lowercase/underscore: "pending", "no_show")
 * and display-string aliases (Title Case: "Pending", "In Progress") so that
 * StatusBadge works whether the caller passes an API key or an already-formatted
 * label (e.g. from DataTable rows that capitalise before storing in row objects).
 *
 * Tones map to the semantic palette in badge.jsx:
 *   success → emerald   warning → amber    danger → red
 *   info    → sky       violet  → violet   neutral → muted gray
 */
export const STATUS_CONFIG = {
  // ── Attendance (API keys) ───────────────────────────────────────────────────
  present: { label: "Present", tone: "success" },
  late:    { label: "Late",    tone: "warning" },
  absent:  { label: "Absent",  tone: "danger"  },
  excused: { label: "Excused", tone: "info"    },

  // ── Attendance (display-string aliases for DataTable badge columns) ─────────
  Present: { label: "Present", tone: "success" },
  Late:    { label: "Late",    tone: "warning" },
  Absent:  { label: "Absent",  tone: "danger"  },
  Excused: { label: "Excused", tone: "info"    },

  // ── Appointments / conferences (API keys) ───────────────────────────────────
  // "pending" is neutral (gray) — awaiting action, no urgency implied by color.
  // "completed" is success (emerald) — positive outcome, not blue.
  // "suggested_new_time" is violet — distinct from all other statuses.
  // "needs_rescheduling" is warning (amber) — requires action.
  // "cancelled" is neutral (gray) — terminal, no action needed.
  // "no_show" is danger (red) — negative outcome.
  pending:            { label: "Pending",           tone: "neutral" },
  confirmed:          { label: "Confirmed",          tone: "success" },
  completed:          { label: "Completed",          tone: "success" },
  no_show:            { label: "No-show",            tone: "danger"  },
  rejected:           { label: "Rejected",           tone: "danger"  },
  cancelled:          { label: "Cancelled",          tone: "neutral" },
  suggested_new_time: { label: "New time suggested", tone: "violet"  },
  needs_rescheduling: { label: "Needs rebook",       tone: "warning" },

  // ── Appointments (display-string aliases) ───────────────────────────────────
  Pending:            { label: "Pending",           tone: "neutral" },
  Confirmed:          { label: "Confirmed",          tone: "success" },
  Completed:          { label: "Completed",          tone: "success" },
  Cancelled:          { label: "Cancelled",          tone: "neutral" },
  Rejected:           { label: "Rejected",           tone: "danger"  },

  // ── Correction requests (API keys) ─────────────────────────────────────────
  approved: { label: "Approved", tone: "success" },

  // ── Case priority ───────────────────────────────────────────────────────────
  High:   { label: "High",   tone: "danger"  },
  Medium: { label: "Medium", tone: "warning" },
  Low:    { label: "Low",    tone: "neutral" },

  // ── MCDM risk level (StudentAssessment.riskLevel — Phase 8B) ────────────────
  // "Low"/"High" above are reused as-is (same word, same meaning). "Moderate"
  // and "Critical" are the two values Case priority doesn't already cover.
  Moderate: { label: "Moderate", tone: "warning" },
  Critical: { label: "Critical", tone: "danger"  },

  // ── Referral / case statuses ────────────────────────────────────────────────
  "Pending Review": { label: "Pending Review", tone: "warning" },
  Accepted:         { label: "Accepted",        tone: "success" },
  Forwarded:        { label: "Forwarded",        tone: "warning" },
  Scheduled:        { label: "Scheduled",        tone: "info"    },
  Resolved:         { label: "Resolved",         tone: "success" },
  // Case lifecycle statuses (Active → Pending → Resolved)
  // "Active" also appears in account-status context; warning tone suits both
  // (new case needs attention; active account with a concern also needs action).
  Active:       { label: "Active",     tone: "warning" },
  // "Pending" also covers appointment status (gray); case Pending uses info (sky)
  // so the Status dropdown shows a distinct colour for in-progress cases.
  // Both display as "Pending" — the context disambiguates.
  CasePending:  { label: "Pending",    tone: "info"    },

  // ── Face enrollment ─────────────────────────────────────────────────────────
  "Face Enrolled":    { label: "Face Enrolled",    tone: "success" },
  "No Face Enrolled": { label: "No Face Enrolled", tone: "neutral" },

  // ── Account / user status ───────────────────────────────────────────────────
  Active:           { label: "Active",           tone: "success" },
  Inactive:         { label: "Inactive",         tone: "neutral" },
  Disabled:         { label: "Disabled",         tone: "danger"  },
  "Needs attention":{ label: "Needs attention",  tone: "warning" },

  // ── Employee gate/homeroom scan compliance ──────────────────────────────────
  complete: { label: "Complete", tone: "success" },
  missing:  { label: "Missing",  tone: "danger"  },
};

/** Label string for a given status value (API key or display string). */
export function statusLabel(value) {
  return STATUS_CONFIG[value]?.label ?? value;
}

/** Badge tone for a given status value (API key or display string). */
export function statusTone(value) {
  return STATUS_CONFIG[value]?.tone ?? "neutral";
}
