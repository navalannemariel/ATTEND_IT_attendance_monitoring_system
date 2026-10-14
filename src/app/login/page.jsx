"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthCardShell } from "@/components/auth-card-shell";
import { useAuth } from "@/components/auth-provider";
import { ROLE_HOME } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function validateEmail(value) {
  if (!value.trim()) return "Email address is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    return "Please enter a valid email address.";
}

function validatePassword(value) {
  if (!value) return "Password is required.";
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState({});
  const [loginError, setLoginError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Set when arriving from the forgot-password "Back to Log In" action so the
  // auto-redirect doesn't fire for already-authenticated users in that path.
  const _fpRef = useRef(false);

  // Show session-expiry error on redirect from api.js 401 handler.
  // Also detect ?fp=1 (arriving from forgot-password abandonment).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "1") {
      setLoginError("Session expired. Please log in again.");
      window.history.replaceState({}, "", "/login");
    }
    if (params.get("fp") === "1") {
      _fpRef.current = true;
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  // Already signed in → go straight to the role's home,
  // unless the user explicitly abandoned the forgot-password flow.
  useEffect(() => {
    if (!loading && user && !_fpRef.current) router.replace(ROLE_HOME[user.role] ?? "/login");
  }, [loading, user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    setErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) return;

    setLoginError(null);
    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);
    if (!result.ok) {
      setLoginError(result.error ?? "Unable to sign in.");
      return;
    }
    const home = ROLE_HOME[result.user.role];
    if (!home) {
      logout();
      setLoginError("This portal is for school staff only. Please use the mobile app.");
      return;
    }
    if (result.user.isPasswordTemp) {
      router.replace("/change-password");
      return;
    }
    if (!result.user.privacyConsentGiven) {
      router.replace("/privacy-consent");
      return;
    }
    router.replace(home);
  };

  return (
    <AuthCardShell>
      <div className="mb-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Please login to your account
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-muted-foreground">
            Email Address
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
              if (loginError) setLoginError(null);
            }}
            onBlur={() => setErrors((p) => ({ ...p, email: validateEmail(email) }))}
            disabled={isLoading}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="h-12 rounded-full bg-slate-100 px-5"
          />
          {errors.email && (
            <p id="email-error" role="alert" className="px-2 text-xs text-destructive">
              {errors.email}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-muted-foreground">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password)
                  setErrors((p) => ({ ...p, password: undefined }));
                if (loginError) setLoginError(null);
              }}
              onBlur={() =>
                setErrors((p) => ({ ...p, password: validatePassword(password) }))
              }
              disabled={isLoading}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              className="h-12 rounded-full bg-slate-100 px-5 pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              disabled={isLoading}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-4 flex items-center text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" role="alert" className="px-2 text-xs text-destructive">
              {errors.password}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between px-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={isLoading}
              className="size-4 rounded border-border accent-[#8B0029]"
            />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        {loginError && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {loginError}
          </div>
        )}

        <div className="flex justify-center pt-1">
          <Button
            type="submit"
            disabled={isLoading}
            className="h-12 w-44 rounded-full bg-gradient-to-r from-primary to-rose-700 text-sm font-semibold tracking-wide shadow-lg shadow-primary/30 hover:opacity-95"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "LOGIN"
            )}
          </Button>
        </div>
      </form>

    </AuthCardShell>
  );
}
