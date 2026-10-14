import { signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { auth } from './firebase';
import { api } from './api';

export const ROLE_LABELS = {
  admin:    "Administrator",
  teacher:  "Teacher",
  guidance: "Guidance Counselor",
};

export const ROLE_HOME = {
  admin:    "/admin",
  teacher:  "/teacher",
  guidance: "/guidance",
};

// Backend uses "guidance_counselor" — map to "guidance" for web routes.
function normalizeRole(role) {
  if (role === "guidance_counselor") return "guidance";
  return role;
}

export function parseUser(raw) {
  return {
    id:             raw._id ?? raw.id ?? "",
    name:           raw.name ?? "",
    email:          raw.email ?? "",
    role:           normalizeRole(raw.role ?? ""),
    section:        raw.section ?? null,
    sectionId:      raw.sectionId ?? null,
    sectionName:    raw.sectionName ?? null,
    sectionGrade:   raw.sectionGrade ?? null,
    childName:         raw.childName ?? null,
    childSectionName:  raw.childSectionName ?? null,
    childSectionGrade: raw.childSectionGrade ?? null,
    studentId:         raw.studentId ?? null,
    isPasswordTemp:      raw.isPasswordTemp ?? false,
    privacyConsentGiven: raw.privacyConsentGiven ?? false,
    photoUrl:            raw.photoUrl ?? null,
  };
}

// Map raw Firebase Auth error codes to user-friendly messages.
export function getAuthErrorMessage(err) {
  switch (err?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    default:
      return err?.message ?? "Unable to sign in.";
  }
}

// Sign in with Firebase, then fetch the user profile from our backend.
// Throws on Firebase auth errors or backend rejection (inactive account, etc.).
export async function loginWithBackend(email, password) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
  try {
    const data = await api.get("/auth/me");
    return parseUser(data.user);
  } catch (err) {
    // Backend rejected (inactive, wrong role, etc.) — sign out of Firebase.
    await fbSignOut(auth).catch(() => {});
    throw err;
  }
}

// Get the current user profile from the backend (session restore on app mount).
// Returns null if not signed in or if the backend rejects the token.
export async function getSessionFromBackend() {
  if (!auth.currentUser) return null;
  try {
    const data = await api.get("/auth/me");
    return parseUser(data.user);
  } catch {
    await fbSignOut(auth).catch(() => {});
    return null;
  }
}

export async function logoutFromBackend() {
  await fbSignOut(auth).catch(() => {});
}

// Keep DEMO_CREDENTIALS for the quick-fill buttons on the login page.
export const DEMO_CREDENTIALS = [
  { email: "admin@hhca.edu.ph",    password: "admin1234",    role: "admin" },
  { email: "teacher@hhca.edu.ph",  password: "teacher1234",  role: "teacher" },
  { email: "guidance@hhca.edu.ph", password: "guidance1234", role: "guidance" },
];
