// Outcome notes for conferences (keyed by conference ID, works for both
// static CF-XX conferences and dynamic REF-XX ones from referrals).
// Backed by localStorage. Replace with real API calls when a backend exists.

const STORAGE_KEY = "hhca:conf-outcomes";
const CHANGE_EVENT = "hhca:conf-outcomes-changed";

const EMPTY = Object.freeze({});
let cachedRaw = null;
let cachedMap = EMPTY;

function base() {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function persist(map) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Stable snapshot: { [conferenceId]: { note, at } } */
export function getConferenceOutcomes() {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) { cachedRaw = null; cachedMap = EMPTY; return EMPTY; }
  if (raw === cachedRaw) return cachedMap;
  cachedRaw = raw;
  try { cachedMap = Object.freeze(JSON.parse(raw)); } catch { cachedMap = EMPTY; }
  return cachedMap;
}

export function getServerConferenceOutcomes() { return EMPTY; }

/**
 * @param {string} conferenceId
 * @param {{ outcomeType: "held"|"noshow"|"rescheduled", note: string, caseAction: "close"|"monitor"|"followup"|null }} data
 */
export function saveConferenceOutcome(conferenceId, data) {
  const map = base();
  map[conferenceId] = { ...data, note: (data.note ?? "").trim(), completed: true, at: Date.now() };
  persist(map);
}

export function subscribe(listener) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
