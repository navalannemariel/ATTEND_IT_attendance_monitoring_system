"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthCardShell } from "@/components/auth-card-shell";

// Password reset is now handled by Firebase Auth.
// The reset link sent by the backend goes directly to Firebase's hosted reset page.
// Any old links using this route are redirected to forgot-password so the user
// can request a fresh Firebase reset link.
export default function ResetPasswordPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/forgot-password");
  }, [router]);

  return (
    <AuthCardShell>
      <p className="text-center text-sm text-muted-foreground">Redirecting…</p>
    </AuthCardShell>
  );
}
