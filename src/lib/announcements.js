// Client-side announcement store backed by localStorage.
// Admins create announcements; teachers and guidance counselors read them.
// A custom event keeps open tabs/components in sync after a write.

const STORAGE_KEY = "hhca:announcements";
const CHANGE_EVENT = "hhca:announcements-changed";

// Stable empty reference for SSR and error cases — required so
// useSyncExternalStore doesn't see a new array on every call.
const EMPTY = Object.freeze([]);

// Snapshot cache: getAnnouncements must return the SAME array reference
// until the underlying localStorage value actually changes, otherwise
// useSyncExternalStore loops infinitely.
let cachedRaw = null;
let cachedList = EMPTY;

function read() {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return EMPTY;
  }
}

function write(list) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getAnnouncements() {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  cachedList = read();
  return cachedList;
}

/** Stable snapshot for server rendering (no localStorage available). */
export function getServerAnnouncements() {
  return EMPTY;
}

export function addAnnouncement(input) {
  const announcement = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `a-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: input.title.trim(),
    body: input.body.trim(),
    image: input.image ?? null, // data URL or null
    authorName: input.authorName,
    createdAt: Date.now(),
  };
  write([announcement, ...read()]);
  return announcement;
}

export function deleteAnnouncement(id) {
  write(read().filter((a) => a.id !== id));
}

/** Subscribe to announcement changes (same-tab writes and other tabs). */
export function subscribe(listener) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
