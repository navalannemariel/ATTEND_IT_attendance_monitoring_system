"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { AuthCardShell } from "@/components/auth-card-shell";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const SS_FP_EMAIL       = "hhca_fp_email";
const SS_FP_RESET_TOKEN = "hhca_fp_reset_token";
// Also clear these on success
const SS_FP_MASKED  = "hhca_fp_masked_email";
const SS_FP_RESEND  = "hhca_fp_next_resend_at";
const SS_FP_EXPIRES = "hhca_fp_code_expires_at";

const REQUIREMENTS = [
  { key: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { key: "upper",  label: "Uppercase letter",       test: (p) => /[A-Z]/.test(p) },
  { key: "lower",  label: "Lowercase letter",       test: (p) => /[a-z]/.test(p) },
  { key: "number", label: "Number",                 test: (p) => /[0-9]/.test(p) },
];

function ssGet(key) {
  try { return sessionStorage.getItem(key) ?? ""; } catch { return ""; }
}
function ssClearAll() {
  try {
    [SS_FP_EMAIL, SS_FP_MASKED, SS_FP_RESEND, SS_FP_EXPIRES, SS_FP_RESET_TOKEN]
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}

export default function ResetPasswordPage() {
  const router = useRouter();

  const [email,       setEmail]       = useState(() => ssGet(SS_FP_EMAIL));
  const [resetToken,  setResetToken]  = useState(() => ssGet(SS_FP_RESET_TOKEN));

  // Redirect if no active session exists.
  useEffect(() => {
    if (!email || !resetToken) router.replace("/forgot-password");
  }, [email, resetToken, router]);

  const [next,     setNext]     = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showNew,  setShowNew]  = useState(false);
  const [showCon,  setShowCon]  = useState(false);
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);

  const reqStatus  = REQUIREMENTS.map((r) => ({ ...r, met: r.test(next) }));
  const allReqsMet = reqStatus.every((r) => r.met);

  function validate() {
    const e = {};
    if (!next)            e.next    = "New password is required.";
    else if (!allReqsMet) e.next    = "Password does not meet all requirements.";
    if (next !== confirm) e.confirm = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    if (!resetToken || !email) {
      router.replace("/forgot-password");
      return;
    }

    setLoading(true);
    try {
      await api.forgotPasswordReset(email, next, resetToken);
      ssClearAll();
      setSuccess(true);
    } catch (err) {
      const apiCode = err?.code;
      if (apiCode === "RESET_INVALID") {
        ssClearAll();
        setResetToken("");
        setEmail("");
        setErrors((p) => ({
          ...p,
          submit: "Your reset session has expired or is invalid. Please start over.",
        }));
      } else {
        setErrors((p) => ({
          ...p,
          submit: err?.message ?? "Failed to reset password. Please try again.",
        }));
      }
    } finally {
      setLoading(false);
    }
  }

  if (!email || !resetToken) {
    return (
      <AuthCardShell>
        <div className="flex justify-center py-8">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </AuthCardShell>
    );
  }

  if (success) {
    return (
      <AuthCardShell>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="size-7 text-emerald-600" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Password reset!
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your password has been updated. You can now log in with your new
              password.
            </p>
          </div>
          <Button
            onClick={() => router.replace("/login")}
            className="mt-2 h-12 w-full rounded-full bg-gradient-to-r from-primary to-rose-700 text-sm font-semibold shadow-lg shadow-primary/30 hover:opacity-95"
          >
            Log In
          </Button>
        </div>
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell>
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Lock className="size-6 text-primary" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Set a new password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a new secure password for{" "}
          <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* New password */}
        <div className="space-y-1.5">
          <Label htmlFor="new" className="text-muted-foreground">New password</Label>
          <div className="relative">
            <Input
              id="new"
              type={showNew ? "text" : "password"}
              value={next}
              onChange={(e) => { setNext(e.target.value); setErrors((p) => ({ ...p, next: undefined })); }}
              disabled={loading}
              className="h-12 rounded-full bg-slate-100 px-5 pr-12"
              aria-invalid={!!errors.next}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowNew((v) => !v)} disabled={loading}
              className="absolute inset-y-0 right-4 flex items-center text-muted-foreground hover:text-primary">
              {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.next && (
            <p role="alert" className="px-2 text-xs text-destructive">{errors.next}</p>
          )}
          <ul className="mt-2 space-y-1 px-1">
            {reqStatus.map((r) => (
              <li key={r.key}
                className={`flex items-center gap-2 text-xs transition-colors ${
                  r.met ? "text-emerald-600" : "text-muted-foreground"
                }`}>
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
              onChange={(e) => { setConfirm(e.target.value); setErrors((p) => ({ ...p, confirm: undefined })); }}
              disabled={loading}
              className="h-12 rounded-full bg-slate-100 px-5 pr-12"
              aria-invalid={!!errors.confirm}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowCon((v) => !v)} disabled={loading}
              className="absolute inset-y-0 right-4 flex items-center text-muted-foreground hover:text-primary">
              {showCon ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.confirm && (
            <p role="alert" className="px-2 text-xs text-destructive">{errors.confirm}</p>
          )}
        </div>

        {errors.submit && (
          <p role="alert" className="px-2 text-xs text-destructive">{errors.submit}</p>
        )}

        <div className="flex justify-center pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-52 rounded-full bg-gradient-to-r from-primary to-rose-700 text-sm font-semibold tracking-wide shadow-lg shadow-primary/30 hover:opacity-95"
          >
            {loading
              ? <><Loader2 className="size-4 animate-spin" />Saving…</>
              : "SET PASSWORD"}
          </Button>
        </div>
      </form>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => { ssClearAll(); router.replace("/login?fp=1"); }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
        >
          <ArrowLeft className="size-3.5" />
          Back to Log In
        </button>
      </div>
    </AuthCardShell>
  );
}
