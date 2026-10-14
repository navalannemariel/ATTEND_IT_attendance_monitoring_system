"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";
import { ROLE_HOME } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function PrivacyConsentPage() {
  const router = useRouter();
  const { user, loading, updateUser } = useAuth();
  const [ticked, setTicked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    // Already consented — skip straight to dashboard
    if (user.privacyConsentGiven) {
      router.replace(ROLE_HOME[user.role] ?? "/login");
    }
  }, [loading, user, router]);

  if (loading || !user || user.privacyConsentGiven) return null;

  const handleAgree = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.patch("/auth/me/privacy-consent", {});
      updateUser({ privacyConsentGiven: true });
      router.replace(ROLE_HOME[user.role] ?? "/login");
    } catch (err) {
      setError(err.message ?? "Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl bg-white px-8 py-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.18)] border border-slate-100">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="size-5 text-primary" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">
                Privacy Notice
              </h1>
              <p className="text-xs text-muted-foreground">
                Please read and acknowledge before continuing
              </p>
            </div>
          </div>

          {/* Notice body */}
          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-foreground/80 space-y-3">
            <p>
              <strong>Holy Heart Christian Academy, Manila</strong> collects and
              processes your personal information — including name, email address,
              and biometric face recognition data — for the sole purpose of automated
              school attendance tracking.
            </p>
            <p>
              Under <strong>Republic Act No. 10173</strong> (Data Privacy Act of 2012),
              biometric data is classified as sensitive personal information. The school
              is committed to keeping your data secure, using it only for attendance
              purposes, and never sharing it with third parties.
            </p>
            <p>
              You have the right to access, correct, or request deletion of your
              personal data at any time by contacting the school&rsquo;s Data Protection
              Officer at the administration office.
            </p>
            <p>
              For the full policy, see the{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-2"
              >
                Privacy Notice
              </a>.
            </p>
          </div>

          {/* Checkbox */}
          <label className="mt-5 flex cursor-pointer items-start gap-3 select-none">
            <input
              type="checkbox"
              checked={ticked}
              onChange={(e) => setTicked(e.target.checked)}
              disabled={saving}
              className="mt-0.5 size-4 rounded border-border accent-[#8B0029]"
            />
            <span className="text-sm text-foreground">
              I have read and understood the Privacy Notice, and I consent to the
              collection and processing of my personal data for attendance purposes.
            </span>
          </label>

          {error && (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          )}

          {/* CTA */}
          <div className="mt-6">
            <Button
              onClick={handleAgree}
              disabled={!ticked || saving}
              className="w-full h-12 rounded-full bg-gradient-to-r from-primary to-rose-700 text-sm font-semibold tracking-wide shadow-lg shadow-primary/30 hover:opacity-95"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "I Agree — Continue"
              )}
            </Button>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Holy Heart Christian Academy, Manila.
        </p>
      </div>
    </main>
  );
}
