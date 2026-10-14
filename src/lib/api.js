import { auth } from './firebase';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(message, code, extra) {
    super(message);
    this.code  = code  ?? null;
    this.extra = extra ?? null;
  }
}

// Callback registered by auth-provider to sign out of Firebase on session expiry.
let _onSessionExpired = null;
export function registerSessionExpiredCallback(cb) { _onSessionExpired = cb; }

async function getToken() {
  if (typeof window === "undefined") return null;
  try {
    return (await auth.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const { skipSessionExpired = false, ...fetchOptions } = options;
  const token = await getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...fetchOptions, headers });
  const data = await res.json();

  if (res.status === 401 && !skipSessionExpired) {
    // Expired or invalid token — sign out of Firebase and redirect to login.
    if (typeof window !== "undefined") {
      _onSessionExpired?.();
      window.location.href = "/login?expired=1";
    }
    throw new Error(data.message || "Session expired.");
  }

  if (res.status === 403 && data.code === "PASSWORD_CHANGE_REQUIRED") {
    if (typeof window !== "undefined") {
      window.location.href = "/change-password";
    }
    throw new Error(data.message || "Password change required.");
  }

  if (!res.ok) {
    throw new ApiError(data.message || "Something went wrong.", data.code ?? null, data);
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) =>
    request(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body) =>
    request(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
  // Change-password may return 401 for wrong current password on re-auth
  // (handled client-side via Firebase). The skipSessionExpired flag prevents
  // the 401 interceptor from redirecting to the login page in that case.
  changePassword: (body) =>
    request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(body),
      skipSessionExpired: true,
    }),

  // Authenticated OTP — send a 6-digit code to the logged-in user's registered email.
  otpSend: () =>
    request("/auth/otp/send", { method: "POST", body: JSON.stringify({}) }),

  // Authenticated OTP — verify the code; returns { otpToken } on success.
  otpVerify: (code) =>
    request("/auth/otp/verify", { method: "POST", body: JSON.stringify({ code }) }),

  // Forgot-password OTP — verify code for unauthenticated reset; returns { passwordResetToken }.
  forgotPasswordVerifyOtp: (email, code) =>
    request("/auth/forgot-password/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, code }),
      skipSessionExpired: true,
    }),

  // Forgot-password reset — consume passwordResetToken and update Firebase password.
  forgotPasswordReset: (email, newPassword, passwordResetToken) =>
    request("/auth/forgot-password/reset", {
      method: "POST",
      body: JSON.stringify({ email, newPassword, passwordResetToken }),
      skipSessionExpired: true,
    }),
};
