// Phase 9: this file previously also exported getStudentStanding()
// (rate/absence-count derived "needsAttention" boolean) and prescriptiveFor()
// (a hardcoded absences/lates >= N recommendation-text ladder) — an
// independent, unused-in-production reimplementation of exactly the
// risk/recommendation decision the backend's MCDM assessment now owns.
// Neither had any real importer (verified — only this file's mock-driven
// dev fixtures ever called them), so both were removed outright rather than
// left as dead duplicate logic. suggestConferenceSlots below is unrelated
// (pure date-slot generation, no attendance data) and is still used by
// lib/referrals.js.

import { toISODate } from "@/lib/mock-data";

/**
 * AI-prescribed conference slots: a few appropriate date + time options that
 * guidance can choose from based on their availability. Picks upcoming
 * weekdays at school-friendly times, skipping weekends. (Stand-in for the AI
 * model's scheduling suggestion until it's connected.)
 */
export function suggestConferenceSlots(count = 4) {
  const times = ["09:00", "10:30", "13:30", "15:00"];
  const slots = [];
  const today = new Date();
  let offset = 1;
  while (slots.length < count && offset < 30) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    offset++;
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue; // no weekends
    slots.push({ date: toISODate(day), time: times[slots.length % times.length] });
  }
  return slots;
}
