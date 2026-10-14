// Client-side user store backed by localStorage (mock — swap for a real API).
// Supports add / edit / delete / enable-disable, seeded on first use.

const STORAGE_KEY = "hhca:users";
const CHANGE_EVENT = "hhca:users-changed";

// Employees are staff; students are tracked separately.
export const STUDENT_ROLE = "Student";
export const EMPLOYEE_ROLES = ["Teacher", "Guidance Counselor", "Administrator"];

export const isStudent = (user) => user.role === STUDENT_ROLE;
export const isEmployee = (user) => user.role !== STUDENT_ROLE;

const SEED = Object.freeze([
  { id: "u-admin", name: "Admin User", email: "admin@hhca.edu.ph", role: "Administrator", status: "Active" },
  { id: "u-teacher", name: "Teacher User", email: "teacher@hhca.edu.ph", role: "Teacher", status: "Active" },
  { id: "u-guidance", name: "Guidance User", email: "guidance@hhca.edu.ph", role: "Guidance Counselor", status: "Active" },
  { id: "u-005", name: "Maria Lopez", email: "m.lopez@hhca.edu.ph", role: "Teacher", status: "Active" },
  { id: "u-006", name: "Jose Bautista", email: "j.bautista@hhca.edu.ph", role: "Teacher", status: "Disabled" },
  { id: "u-101", name: "Andrea Santos", email: "a.santos@hhca.edu.ph", role: "Student", section: "Grade 10 - St. Peter", status: "Active" },
  { id: "u-102", name: "Miguel Reyes", email: "m.reyes@hhca.edu.ph", role: "Student", section: "Grade 10 - St. Peter", status: "Active" },
  { id: "u-103", name: "Sofia Dela Cruz", email: "s.delacruz@hhca.edu.ph", role: "Student", section: "Grade 9 - St. John", status: "Active" },
  { id: "u-104", name: "Gabriel Mendoza", email: "g.mendoza@hhca.edu.ph", role: "Student", section: "Grade 10 - St. Peter", status: "Active" },
  { id: "u-105", name: "Isabella Garcia", email: "i.garcia@hhca.edu.ph", role: "Student", section: "Grade 10 - St. Peter", status: "Active" },
  { id: "u-106", name: "Lucas Aquino", email: "l.aquino@hhca.edu.ph", role: "Student", section: "Grade 10 - St. Peter", status: "Active" },
  { id: "u-107", name: "Chloe Ramos", email: "c.ramos@hhca.edu.ph", role: "Student", section: "Grade 10 - St. Peter", status: "Active" },
  { id: "u-108", name: "Nathan Villanueva", email: "n.villanueva@hhca.edu.ph", role: "Student", section: "Grade 10 - St. Peter", status: "Active" },
  { id: "u-109", name: "Ella Navarro", email: "e.navarro@hhca.edu.ph", role: "Student", section: "Grade 10 - St. Peter", status: "Active" },
  { id: "u-110", name: "Daniel Cruz", email: "d.cruz@hhca.edu.ph", role: "Student", section: "Grade 10 - St. Peter", status: "Active" },
]);

let cachedRaw = "__init__";
let cachedList = SEED;

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `u-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// The current list as a fresh, mutable array (seed clone when nothing stored).
function base() {
  if (typeof window === "undefined") return SEED.map((u) => ({ ...u }));
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return SEED.map((u) => ({ ...u }));
  try {
    return JSON.parse(raw);
  } catch {
    return SEED.map((u) => ({ ...u }));
  }
}

function persist(list) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Stable snapshot for useSyncExternalStore (same ref until storage changes).
export function getUsers() {
  if (typeof window === "undefined") return SEED;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    if (cachedRaw === null) return cachedList;
    cachedRaw = null;
    cachedList = SEED;
    return SEED;
  }
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    cachedList = JSON.parse(raw);
  } catch {
    cachedList = SEED;
  }
  return cachedList;
}

export function getServerUsers() {
  return SEED;
}

export function addUser({ name, email, role, section }) {
  const user = {
    id: uid(),
    name: name.trim(),
    email: email.trim(),
    role,
    status: "Active",
  };
  if (role === STUDENT_ROLE) user.section = (section ?? "").trim();
  persist([user, ...base()]);
  return user;
}

export function updateUser(id, patch) {
  persist(base().map((u) => (u.id === id ? { ...u, ...patch } : u)));
}

export function deleteUser(id) {
  persist(base().filter((u) => u.id !== id));
}

export function toggleUserStatus(id) {
  persist(
    base().map((u) =>
      u.id === id
        ? { ...u, status: u.status === "Disabled" ? "Active" : "Disabled" }
        : u
    )
  );
}

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
