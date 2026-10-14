"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { AuthCardShell } from "@/components/auth-card-shell";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// sessionStorage keys shared with the verify-otp and reset-password pages
export const SS_FP_EMAIL    = "hhca_fp_email";
export const SS_FP_MASKED   = "hhca_fp_masked_email";
export const SS_FP_RESEND   = "hhca_fp_next_resend_at";
export const SS_FP_EXPIRES  = "hhca_fp_code_expires_at";

function validateEmail(value) {
  if (!value.trim()) return "Email address is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    return "Please enter a valid email address.";
}

function ssSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch {}
}
function ssClearAll() {
  try {
    ["hhca_fp_email", "hhca_fp_masked_email", "hhca_fp_next_resend_at",
     "hhca_fp_code_expires_at", "hhca_fp_reset_token"]
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email,      setEmail]      = useState("");
  const [emailError, setEmailError] = useState(undefined);
  const [submitError, setSubmitError] = useState(null);
  const [isLoading,  setIsLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateEmail(email);
    setEmailError(err);
    if (err) return;

    setIsLoading(true);
    setSubmitError(null);

    const trimmed = email.trim().toLowerCase();

    try {
      const data = await api.post("/auth/forgot-password", { email: trimmed });
      ssSet(SS_FP_EMAIL,   trimmed);
      ssSet(SS_FP_MASKED,  data.maskedEmail);
      ssSet(SS_FP_RESEND,  data.nextResendAt);
      ssSet(SS_FP_EXPIRES, data.codeExpiresAt);
      router.push("/forgot-password/verify-otp");
    } catch (apiErr) {
      if (apiErr?.code === "OTP_COOLDOWN") {
        // An OTP was already sent recently — navigate to verify with existing data.
        ssSet(SS_FP_EMAIL,  trimmed);
        if (apiErr.extra?.maskedEmail) ssSet(SS_FP_MASKED, apiErr.extra.maskedEmail);
        if (apiErr.extra?.cooldownEnds) ssSet(SS_FP_RESEND, apiErr.extra.cooldownEnds);
        router.push("/forgot-password/verify-otp");
      } else {
        setSubmitError(apiErr?.message ?? "Something went wrong. Please try again.");
        setIsLoading(false);
      }
    }
  };

  return (
    <AuthCardShell>
      <div className="mb-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Reset your password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a verification code.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-muted-foreground">
            Email Address
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute inset-y-0 left-4 my-auto size-4 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(undefined);
                if (submitError) setSubmitError(null);
              }}
              onBlur={() => setEmailError(validateEmail(email))}
              disabled={isLoading}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "email-error" : undefined}
              className="h-12 rounded-full bg-slate-100 pl-11 pr-5"
            />
          </div>
          {emailError && (
            <p id="email-error" role="alert" className="px-2 text-xs text-destructive">
              {emailError}
            </p>
          )}
        </div>

        {submitError && (
          <p role="alert" className="px-2 text-xs text-destructive">{submitError}</p>
        )}

        <div className="flex justify-center pt-1">
          <Button
            type="submit"
            disabled={isLoading}
            className="h-12 w-full rounded-full bg-gradient-to-r from-primary to-rose-700 text-sm font-semibold tracking-wide shadow-lg shadow-primary/30 hover:opacity-95"
          >
            {isLoading ? (
              <><Loader2 className="size-4 animate-spin" />Sending…</>
            ) : (
              "Send Code"
            )}
          </Button>
        </div>
      </form>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => { ssClearAll(); router.push("/login?fp=1"); }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to Log In
        </button>
      </div>
    </AuthCardShell>
  );
}
