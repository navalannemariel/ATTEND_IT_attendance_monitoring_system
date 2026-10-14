"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MailCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AuthCardShell } from "@/components/auth-card-shell";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

// Keys written by /forgot-password and read here
const SS_FP_EMAIL   = "hhca_fp_email";
const SS_FP_MASKED  = "hhca_fp_masked_email";
const SS_FP_RESEND  = "hhca_fp_next_resend_at";
const SS_FP_EXPIRES = "hhca_fp_code_expires_at";

// Written here; read by /reset-password
export const SS_FP_RESET_TOKEN = "hhca_fp_reset_token";

function ssGet(key) {
  try { return sessionStorage.getItem(key) ?? ""; } catch { return ""; }
}
function ssSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch {}
}
function ssClearAll() {
  try {
    [SS_FP_EMAIL, SS_FP_MASKED, SS_FP_RESEND, SS_FP_EXPIRES, SS_FP_RESET_TOKEN]
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}

export default function ForgotPasswordVerifyOtpPage() {
  const router = useRouter();

  // Read initial state from sessionStorage on mount.
  const [email] = useState(() => ssGet(SS_FP_EMAIL));
  const [maskedEmail, setMaskedEmail] = useState(() => ssGet(SS_FP_MASKED));
  const [nextResendAt, setNextResendAt] = useState(() => {
    const raw = ssGet(SS_FP_RESEND);
    return raw ? new Date(raw) : new Date(0);
  });

  // Redirect to /forgot-password if there is no email context.
  useEffect(() => {
    if (!email) router.replace("/forgot-password");
  }, [email, router]);

  // ── 6-digit OTP input ─────────────────────────────────────────────────────
  const [digits,    setDigits]    = useState(["", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [otpError,  setOtpError]  = useState(null);
  const inputRefs = useRef(Array.from({ length: 6 }, () => null));

  const code = digits.join("");

  function focusAt(i) { inputRefs.current[i]?.focus(); }

  function handleDigit(i, value) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next  = [...digits];
    next[i]     = digit;
    setDigits(next);
    setOtpError(null);
    if (digit && i < 5) focusAt(i + 1);
  }

  function handleKeyDown(i, e) {
    if (e.key === "Backspace") {
      if (digits[i]) {
        const next = [...digits]; next[i] = ""; setDigits(next);
      } else if (i > 0) {
        focusAt(i - 1);
      }
    } else if (e.key === "ArrowLeft"  && i > 0) focusAt(i - 1);
    else if   (e.key === "ArrowRight" && i < 5) focusAt(i + 1);
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = [...digits];
    pasted.split("").forEach((d, idx) => { if (idx < 6) next[idx] = d; });
    setDigits(next);
    focusAt(Math.min(pasted.length, 5));
  }

  // ── Verify ────────────────────────────────────────────────────────────────
  async function handleVerify(e) {
    e?.preventDefault();
    if (code.length < 6) { setOtpError("Please enter all 6 digits."); return; }
    setVerifying(true);
    setOtpError(null);
    try {
      const data = await api.forgotPasswordVerifyOtp(email, code);
      ssSet(SS_FP_RESET_TOKEN, data.passwordResetToken);
      router.replace("/reset-password");
    } catch (err) {
      setOtpError(err.message ?? "Incorrect code. Please try again.");
      setDigits(["", "", "", "", "", ""]);
      focusAt(0);
    } finally {
      setVerifying(false);
    }
  }

  // ── Resend countdown ──────────────────────────────────────────────────────
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resending,   setResending]   = useState(false);

  useEffect(() => {
    function tick() {
      const left = Math.max(0, Math.ceil((nextResendAt.getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
    }
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [nextResendAt]);

  async function handleResend() {
    setResending(true);
    setOtpError(null);
    setDigits(["", "", "", "", "", ""]);
    try {
      const data = await api.post("/auth/forgot-password", { email });
      ssSet(SS_FP_MASKED,  data.maskedEmail);
      ssSet(SS_FP_RESEND,  data.nextResendAt);
      ssSet(SS_FP_EXPIRES, data.codeExpiresAt);
      setMaskedEmail(data.maskedEmail);
      setNextResendAt(new Date(data.nextResendAt));
      toast.success("A new verification code has been sent.");
      focusAt(0);
    } catch (err) {
      if (err?.code === "OTP_COOLDOWN" && err?.extra?.cooldownEnds) {
        setNextResendAt(new Date(err.extra.cooldownEnds));
        ssSet(SS_FP_RESEND, err.extra.cooldownEnds);
      }
      toast.error(err?.message ?? "Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  }

  if (!email) {
    return (
      <AuthCardShell>
        <div className="flex justify-center py-8">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell>
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <MailCheck className="size-6 text-primary" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Check your email
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the 6-digit code sent to{" "}
          <span className="font-medium text-foreground">
            {maskedEmail || email}
          </span>
        </p>
      </div>

      {/* OTP form */}
      <form onSubmit={handleVerify} noValidate>
        <div className="mb-6 flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              disabled={verifying}
              aria-label={`Digit ${i + 1}`}
              className={[
                "h-12 w-10 rounded-xl border bg-slate-100 text-center text-lg font-bold",
                "tabular-nums outline-none transition-all",
                "focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/30",
                "disabled:opacity-50",
                otpError ? "border-destructive" : "border-input",
              ].join(" ")}
            />
          ))}
        </div>

        {otpError && (
          <p role="alert" className="mb-4 px-2 text-center text-xs text-destructive">
            {otpError}
          </p>
        )}

        <div className="flex justify-center">
          <Button
            type="submit"
            disabled={verifying || code.length < 6}
            className="h-12 w-52 rounded-full bg-gradient-to-r from-primary to-rose-700 text-sm font-semibold tracking-wide shadow-lg shadow-primary/30 hover:opacity-95"
          >
            {verifying
              ? <><Loader2 className="size-4 animate-spin" />Verifying…</>
              : "VERIFY CODE"}
          </Button>
        </div>
      </form>

      {/* Resend */}
      <div className="mt-6 text-center">
        {secondsLeft > 0 ? (
          <p className="text-sm text-muted-foreground">
            Resend available in{" "}
            <span className="tabular-nums font-medium text-foreground">{secondsLeft}s</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
          >
            {resending
              ? <><Loader2 className="size-3.5 animate-spin" />Sending…</>
              : <><RefreshCw className="size-3.5" />Resend code</>}
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => { ssClearAll(); router.push("/forgot-password"); }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Try a different email
        </button>
        <button
          type="button"
          onClick={() => { ssClearAll(); router.replace("/login?fp=1"); }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to Log In
        </button>
      </div>
    </AuthCardShell>
  );
}
