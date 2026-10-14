"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "firebase/auth";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from "lucide-react";
import { AuthCardShell } from "@/components/auth-card-shell";
import { auth } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const REQUIREMENTS = [
  { key: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { key: "upper",  label: "Uppercase letter",       test: (p) => /[A-Z]/.test(p) },
  { key: "lower",  label: "Lowercase letter",       test: (p) => /[a-z]/.test(p) },
  { key: "number", label: "Number",                 test: (p) => /[0-9]/.test(p) },
];

// Inner component that reads searchParams — must be wrapped in Suspense.
function ResetPasswordAction() {
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const mode    = searchParams.get("mode");

  // Verification phase
  const [verifying,    setVerifying]    = useState(true);
  const [verifyError,  setVerifyError]  = useState(null);
  const [email,        setEmail]        = useState("");

  // Form state
  const [next,         setNext]         = useState("");
  const [confirm,      setConfirm]      = useState("");
  const [showNew,      setShowNew]      = useState(false);
  const [showCon,      setShowCon]      = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [errors,       setErrors]       = useState({});
  const [success,      setSuccess]      = useState(false);

  const reqStatus  = REQUIREMENTS.map((r) => ({ ...r, met: r.test(next) }));
  const allReqsMet = reqStatus.every((r) => r.met);

  // Verify the oobCode on mount — also returns the email address for display
  useEffect(() => {
    if (!oobCode || mode !== "resetPassword") {
      setVerifyError("This link is invalid or incomplete. Please request a new password reset.");
      setVerifying(false);
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((emailFromCode) => {
        setEmail(emailFromCode);
        setVerifying(false);
      })
      .catch(() => {
        setVerifyError(
          "This reset link has expired or has already been used. Please request a new one."
        );
        setVerifying(false);
      });
  }, [oobCode, mode]);

  function validate() {
    const e = {};
    if (!next) {
      e.next = "New password is required.";
    } else if (!allReqsMet) {
      e.next = "Password does not meet all requirements.";
    }
    if (next !== confirm) e.confirm = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, next);
      setSuccess(true);
    } catch (err) {
      const code = err?.code ?? "";
      if (
        code === "auth/expired-action-code" ||
        code === "auth/invalid-action-code"
      ) {
        setVerifyError(
          "This reset link has expired or has already been used. Please request a new one."
        );
      } else {
        setErrors((p) => ({
          ...p,
          submit: err.message ?? "Failed to reset password. Please try again.",
        }));
      }
      setLoading(false);
    }
  }

  // ── Loading / verifying ──────────────────────────────────────────────────
  if (verifying) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verifying reset link…</p>
      </div>
    );
  }

  // ── Invalid / expired link ───────────────────────────────────────────────
  if (verifyError) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="size-7 text-destructive" />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">
            Link expired
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{verifyError}</p>
        </div>
        <Link
          href="/forgot-password"
          className={buttonVariants({
            className:
              "mt-2 h-12 w-full rounded-full bg-gradient-to-r from-primary to-rose-700 text-sm font-semibold shadow-lg shadow-primary/30 hover:opacity-95",
          })}
        >
          Request a new link
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to Log In
        </Link>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (success) {
    return (
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
        <Link
          href="/login"
          className={buttonVariants({
            className:
              "mt-2 h-12 w-full rounded-full bg-gradient-to-r from-primary to-rose-700 text-sm font-semibold shadow-lg shadow-primary/30 hover:opacity-95",
          })}
        >
          Log In
        </Link>
      </div>
    );
  }

  // ── Reset form ───────────────────────────────────────────────────────────
  return (
    <>
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Lock className="size-6 text-primary" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Reset your password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Setting a new password for{" "}
          <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* New password + live requirements */}
        <div className="space-y-1.5">
          <Label htmlFor="new" className="text-muted-foreground">
            New password
          </Label>
          <div className="relative">
            <Input
              id="new"
              type={showNew ? "text" : "password"}
              value={next}
              onChange={(e) => {
                setNext(e.target.value);
                setErrors((p) => ({ ...p, next: undefined }));
              }}
              disabled={loading}
              className="h-12 rounded-full bg-slate-100 px-5 pr-12"
              aria-invalid={!!errors.next}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              disabled={loading}
              className="absolute inset-y-0 right-4 flex items-center text-muted-foreground hover:text-primary"
            >
              {showNew ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.next && (
            <p className="px-2 text-xs text-destructive">{errors.next}</p>
          )}
          {/* Live requirements checklist */}
          <ul className="mt-2 space-y-1 px-1">
            {reqStatus.map((r) => (
              <li
                key={r.key}
                className={`flex items-center gap-2 text-xs transition-colors ${
                  r.met ? "text-emerald-600" : "text-muted-foreground"
                }`}
              >
                {r.met ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="size-3.5 shrink-0" />
                )}
                {r.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Confirm */}
        <div className="space-y-1.5">
          <Label htmlFor="con" className="text-muted-foreground">
            Confirm new password
          </Label>
          <div className="relative">
            <Input
              id="con"
              type={showCon ? "text" : "password"}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setErrors((p) => ({ ...p, confirm: undefined }));
              }}
              disabled={loading}
              className="h-12 rounded-full bg-slate-100 px-5 pr-12"
              aria-invalid={!!errors.confirm}
            />
            <button
              type="button"
              onClick={() => setShowCon((v) => !v)}
              disabled={loading}
              className="absolute inset-y-0 right-4 flex items-center text-muted-foreground hover:text-primary"
            >
              {showCon ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.confirm && (
            <p className="px-2 text-xs text-destructive">{errors.confirm}</p>
          )}
        </div>

        {errors.submit && (
          <p className="px-2 text-xs text-destructive">{errors.submit}</p>
        )}

        <div className="flex justify-center pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-52 rounded-full bg-gradient-to-r from-primary to-rose-700 text-sm font-semibold tracking-wide shadow-lg shadow-primary/30 hover:opacity-95"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "SET PASSWORD"
            )}
          </Button>
        </div>
      </form>

      <div className="mt-6 flex justify-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to Log In
        </Link>
      </div>
    </>
  );
}

export default function AuthActionPage() {
  return (
    <AuthCardShell>
      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        }
      >
        <ResetPasswordAction />
      </Suspense>
    </AuthCardShell>
  );
}
