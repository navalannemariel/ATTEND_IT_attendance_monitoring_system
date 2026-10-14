// Tracks guidance counselor-entered case resolutions (override for static CASES data).
// Keyed by case ID → { note, resolvedAt }

const STORAGE_KEY = "hhca:case-resolutions";
const CHANGE_EVENT = "hhca:case-resolutions-changed";

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

/** Stable snapshot: { [caseId]: { note, resolvedAt } } */
export function getCaseResolutions() {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) { cachedRaw = null; cachedMap = EMPTY; return EMPTY; }
  if (raw === cachedRaw) return cachedMap;
  cachedRaw = raw;
  try { cachedMap = Object.freeze(JSON.parse(raw)); } catch { cachedMap = EMPTY; }
  return cachedMap;
}

export function getServerCaseResolutions() { return EMPTY; }

export function resolveCase(caseId, note = "") {
  const map = base();
  map[caseId] = { note: note.trim(), resolvedAt: Date.now() };
  persist(map);
}

export function subscribe(listener) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
