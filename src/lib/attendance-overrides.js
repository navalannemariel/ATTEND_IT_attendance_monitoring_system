// Manual attendance overrides — teacher-entered marks that take precedence
// over the deterministic mock data. Backed by localStorage. Replace with
// real API calls when a backend exists.

const STORAGE_KEY = "hhca:att-overrides";
const CHANGE_EVENT = "hhca:att-overrides-changed";

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

/** Stable snapshot for useSyncExternalStore. Keys: `"name::YYYY-MM-DD"` → status string. */
export function getOverrides() {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) { cachedRaw = null; cachedMap = EMPTY; return EMPTY; }
  if (raw === cachedRaw) return cachedMap;
  cachedRaw = raw;
  try { cachedMap = Object.freeze(JSON.parse(raw)); } catch { cachedMap = EMPTY; }
  return cachedMap;
}

export function getServerOverrides() { return EMPTY; }

/** Write a single student's status for a date. Pass null to clear the override. */
export function setOverride(name, dateStr, status) {
  const map = base();
  const key = `${name}::${dateStr}`;
  if (status == null) {
    delete map[key];
  } else {
    map[key] = status;
  }
  persist(map);
}

/** Write an entire day's roster at once (bulk attendance save). */
export function setBulkOverrides(entries) {
  const map = base();
  for (const { name, dateStr, status } of entries) {
    map[`${name}::${dateStr}`] = status;
  }
  persist(map);
}

/** Apply overrides to an array of attendance rows (mutates nothing — returns new array). */
export function applyOverrides(overrides, rows) {
  return rows.map((r) => {
    const key = `${r.student}::${r.date}`;
    const ov = overrides[key];
    return ov ? { ...r, status: ov, timeIn: ov === "Absent" || ov === "Excused" ? "—" : r.timeIn } : r;
  });
}

export function subscribe(listener) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
