"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { Eye, EyeOff, Loader2, Lock, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { AuthCardShell } from "@/components/auth-card-shell";
import { useAuth } from "@/components/auth-provider";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/api";
import { ROLE_HOME } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// sessionStorage keys shared with verify-otp page
const SS_MASKED  = "hhca_otp_masked_email";
const SS_RESEND  = "hhca_otp_next_resend_at";
const SS_EXPIRES = "hhca_otp_code_expires_at";
const SS_TOKEN   = "hhca_otp_token";

const REQUIREMENTS = [
  { key: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { key: "upper",  label: "Uppercase letter",       test: (p) => /[A-Z]/.test(p) },
  { key: "lower",  label: "Lowercase letter",       test: (p) => /[a-z]/.test(p) },
  { key: "number", label: "Number",                 test: (p) => /[0-9]/.test(p) },
];

function maskEmail(email) {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at < 0) return email;
  const local  = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return (local[0] ?? "*") + "*" + domain;
  return local[0] + "*".repeat(Math.min(local.length - 2, 4)) + local[local.length - 1] + domain;
}

function ssSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch {}
}

// Phases: 'loading' | 'otp_sending' | 'current_pwd' | 'new_pwd'
export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, loading: authLoading, updateUser } = useAuth();

  const [phase,        setPhase]        = useState("loading");
  const [sendOtpError, setSendOtpError] = useState(null);
  // track whether the current password has been verified (non-temp flow)
  const reauthed = useRef(false);

  // ── Phase detection ────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }

    try {
      if (sessionStorage.getItem(SS_TOKEN)) { setPhase("new_pwd"); return; }
    } catch {}

    setPhase(user.isPasswordTemp ? "otp_sending" : "current_pwd");
  }, [authLoading, user, router]);

  // ── Auto-send OTP (temp-user flow) ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== "otp_sending") return;
    let cancelled = false;

    (async () => {
      try {
        const data = await api.otpSend();
        if (cancelled) return;
        ssSet(SS_MASKED,  data.maskedEmail);
        ssSet(SS_RESEND,  data.nextResendAt);
        ssSet(SS_EXPIRES, data.codeExpiresAt);
        router.replace("/verify-otp?ctx=temp");
      } catch (err) {
        if (cancelled) return;
        if (err?.code === "OTP_COOLDOWN") {
          // An OTP was already sent; navigate to verify page with existing state.
          try {
            if (!sessionStorage.getItem(SS_MASKED) && user?.email) {
              ssSet(SS_MASKED, maskEmail(user.email));
            }
            if (err?.extra?.cooldownEnds) ssSet(SS_RESEND, err.extra.cooldownEnds);
          } catch {}
          router.replace("/verify-otp?ctx=temp");
        } else {
          setSendOtpError(err.message ?? "Failed to send verification code.");
          setSendingOtp(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Current-password phase ─────────────────────────────────────────────────
  const [current,    setCurrent]    = useState("");
  const [showCur,    setShowCur]    = useState(false);
  const [curError,   setCurError]   = useState(null);
  const [curLoading, setCurLoading] = useState(false);

  async function handleCurrentSubmit(e) {
    e.preventDefault();
    if (!current) { setCurError("Current password is required."); return; }
    setCurLoading(true);
    setCurError(null);
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser?.email) throw new Error("Not signed in.");
      const cred = EmailAuthProvider.credential(firebaseUser.email, current);
      await reauthenticateWithCredential(firebaseUser, cred);
      reauthed.current = true;

      const data = await api.otpSend();
      ssSet(SS_MASKED,  data.maskedEmail);
      ssSet(SS_RESEND,  data.nextResendAt);
      ssSet(SS_EXPIRES, data.codeExpiresAt);
      router.push("/verify-otp?ctx=change");
    } catch (err) {
      const code = err?.code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setCurError("Current password is incorrect.");
      } else if (err?.code === "OTP_COOLDOWN") {
        // Re-auth passed; OTP send hit cooldown — just navigate forward.
        try {
          if (!sessionStorage.getItem(SS_MASKED) && user?.email) {
            ssSet(SS_MASKED, maskEmail(user.email));
          }
          if (err?.extra?.cooldownEnds) ssSet(SS_RESEND, err.extra.cooldownEnds);
        } catch {}
        router.push("/verify-otp?ctx=change");
      } else {
        toast.error(err.message ?? "Something went wrong.");
      }
    } finally {
      setCurLoading(false);
    }
  }

  // ── New-password phase ─────────────────────────────────────────────────────
  const [next,       setNext]       = useState("");
  const [confirm,    setConfirm]    = useState("");
  const [showNew,    setShowNew]    = useState(false);
  const [showCon,    setShowCon]    = useState(false);
  const [newErrors,  setNewErrors]  = useState({});
  const [newLoading, setNewLoading] = useState(false);

  const reqStatus  = REQUIREMENTS.map((r) => ({ ...r, met: r.test(next) }));
  const allReqsMet = reqStatus.every((r) => r.met);

  async function handleNewSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!next)            errs.next    = "New password is required.";
    else if (!allReqsMet) errs.next    = "Password does not meet all requirements.";
    if (next !== confirm) errs.confirm = "Passwords do not match.";
    setNewErrors(errs);
    if (Object.keys(errs).length > 0) return;

    let otpToken;
    try { otpToken = sessionStorage.getItem(SS_TOKEN); } catch {}
    if (!otpToken) {
      toast.error("Verification session expired. Please verify your identity again.");
      clearOtpState();
      setPhase(user?.isPasswordTemp ? "otp_sending" : "current_pwd");
      return;
    }

    setNewLoading(true);
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser?.email) throw new Error("Not signed in.");

      await api.changePassword({ newPassword: next, otpToken });

      clearOtpState();

      await signOut(auth);
      await signInWithEmailAndPassword(auth, firebaseUser.email, next);

      toast.success("Password changed successfully.");
      updateUser({ isPasswordTemp: false });
      router.replace(ROLE_HOME[user?.role] ?? "/login");
    } catch (err) {
      const apiCode = err?.code;
      if (apiCode === "OTP_INVALID" || apiCode === "OTP_REQUIRED") {
        clearOtpState();
        toast.error("Your verification session expired. Please verify again.");
        setPhase(user?.isPasswordTemp ? "otp_sending" : "current_pwd");
      } else {
        toast.error(err.message ?? "Failed to change password.");
      }
    } finally {
      setNewLoading(false);
    }
  }

  function clearOtpState() {
    try {
      sessionStorage.removeItem(SS_TOKEN);
      sessionStorage.removeItem(SS_MASKED);
      sessionStorage.removeItem(SS_RESEND);
      sessionStorage.removeItem(SS_EXPIRES);
    } catch {}
  }

  // ── Render: loading / otp_sending ─────────────────────────────────────────
  if (phase === "loading" || phase === "otp_sending") {
    return (
      <AuthCardShell>
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          {sendOtpError ? (
            <>
              <p className="text-sm text-destructive">{sendOtpError}</p>
              <button
                type="button"
                onClick={() => { setSendOtpError(null); setPhase("otp_sending"); }}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Try again
              </button>
            </>
          ) : (
            <>
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Sending verification code…</p>
            </>
          )}
        </div>
      </AuthCardShell>
    );
  }

  // ── Render: current_pwd ───────────────────────────────────────────────────
  if (phase === "current_pwd") {
    return (
      <AuthCardShell>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <Lock className="size-6 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Change your password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your current password to continue.
          </p>
        </div>

        <form onSubmit={handleCurrentSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cur" className="text-muted-foreground">Current password</Label>
            <div className="relative">
              <Input
                id="cur"
                type={showCur ? "text" : "password"}
                value={current}
                onChange={(e) => { setCurrent(e.target.value); setCurError(null); }}
                disabled={curLoading}
                className="h-12 rounded-full bg-slate-100 px-5 pr-12"
                aria-invalid={!!curError}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowCur((v) => !v)} disabled={curLoading}
                className="absolute inset-y-0 right-4 flex items-center text-muted-foreground hover:text-primary">
                {showCur ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {curError && <p role="alert" className="px-2 text-xs text-destructive">{curError}</p>}
          </div>

          <div className="flex justify-center pt-2">
            <Button type="submit" disabled={curLoading}
              className="h-12 w-52 rounded-full bg-gradient-to-r from-primary to-rose-700 text-sm font-semibold tracking-wide shadow-lg shadow-primary/30 hover:opacity-95">
              {curLoading
                ? <><Loader2 className="size-4 animate-spin" />Verifying…</>
                : "CONTINUE"}
            </Button>
          </div>
        </form>
      </AuthCardShell>
    );
  }

  // ── Render: new_pwd ───────────────────────────────────────────────────────
  const isTemp = user?.isPasswordTemp ?? false;
  return (
    <AuthCardShell>
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Lock className="size-6 text-primary" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {isTemp ? "Set your password" : "Change your password"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isTemp
            ? "Your account has a temporary password. Please set a new one to continue."
            : "Choose a new secure password for your account."}
        </p>
      </div>

      <form onSubmit={handleNewSubmit} noValidate className="space-y-4">
        {/* New password + live requirements */}
        <div className="space-y-1.5">
          <Label htmlFor="new" className="text-muted-foreground">New password</Label>
          <div className="relative">
            <Input
              id="new"
              type={showNew ? "text" : "password"}
              value={next}
              onChange={(e) => { setNext(e.target.value); setNewErrors((p) => ({ ...p, next: undefined })); }}
              disabled={newLoading}
              className="h-12 rounded-full bg-slate-100 px-5 pr-12"
              aria-invalid={!!newErrors.next}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowNew((v) => !v)} disabled={newLoading}
              className="absolute inset-y-0 right-4 flex items-center text-muted-foreground hover:text-primary">
              {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {newErrors.next && <p role="alert" className="px-2 text-xs text-destructive">{newErrors.next}</p>}
          <ul className="mt-2 space-y-1 px-1">
            {reqStatus.map((r) => (
              <li key={r.key}
                className={`flex items-center gap-2 text-xs transition-colors ${r.met ? "text-emerald-600" : "text-muted-foreground"}`}>
                {r.met
                  ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                  : <Circle       className="size-3.5 shrink-0" />}
                {r.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Confirm */}
        <div className="space-y-1.5">
          <Label htmlFor="con" className="text-muted-foreground">Confirm new password</Label>
          <div className="relative">
            <Input
              id="con"
              type={showCon ? "text" : "password"}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setNewErrors((p) => ({ ...p, confirm: undefined })); }}
              disabled={newLoading}
              className="h-12 rounded-full bg-slate-100 px-5 pr-12"
              aria-invalid={!!newErrors.confirm}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowCon((v) => !v)} disabled={newLoading}
              className="absolute inset-y-0 right-4 flex items-center text-muted-foreground hover:text-primary">
              {showCon ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {newErrors.confirm && <p role="alert" className="px-2 text-xs text-destructive">{newErrors.confirm}</p>}
        </div>

        <div className="flex justify-center pt-2">
          <Button type="submit" disabled={newLoading}
            className="h-12 w-52 rounded-full bg-gradient-to-r from-primary to-rose-700 text-sm font-semibold tracking-wide shadow-lg shadow-primary/30 hover:opacity-95">
            {newLoading ? <><Loader2 className="size-4 animate-spin" />Saving…</> : "SET PASSWORD"}
          </Button>
        </div>
      </form>
    </AuthCardShell>
  );
}
