"use client";

import { useState, useRef } from "react";
import { Camera, Lock, Eye, EyeOff, Check, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

function resizePhotoToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const fileRef = useRef(null);

  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState(null);

  const [pwdModalOpen, setPwdModalOpen] = useState(false);

  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.role] ?? user.role;
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3_000_000) {
      setPhotoError("Photo must be under 3 MB.");
      e.target.value = "";
      return;
    }
    setPhotoError(null);
    setPhotoSaving(true);
    try {
      const photoUrl = await resizePhotoToBase64(file);
      const data = await api.patch("/auth/me/photo", { photoUrl });
      updateUser({ photoUrl: data.user.photoUrl });
    } catch (err) {
      setPhotoError(err.message ?? "Failed to upload photo.");
    } finally {
      setPhotoSaving(false);
      e.target.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoError(null);
    setPhotoSaving(true);
    try {
      await api.patch("/auth/me/photo", { photoUrl: null });
      updateUser({ photoUrl: null });
    } catch (err) {
      setPhotoError(err.message ?? "Failed to remove photo.");
    } finally {
      setPhotoSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View your account info and manage your settings.
        </p>
      </div>

      {/* Profile Photo */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Profile Photo
        </h2>
        <div className="flex items-center gap-6">
          <div className="shrink-0">
            {user.photoUrl ? (
              <img
                src={user.photoUrl}
                alt={user.name}
                className="size-20 rounded-full object-cover ring-4 ring-primary/10"
              />
            ) : (
              <span className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-rose-700 text-2xl font-bold text-primary-foreground shadow">
                {initials}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handlePhotoChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={photoSaving}
              onClick={() => fileRef.current?.click()}
              className="gap-1.5"
            >
              {photoSaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Camera className="size-3.5" />
              )}
              {user.photoUrl ? "Change photo" : "Upload photo"}
            </Button>
            {user.photoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={photoSaving}
                onClick={handleRemovePhoto}
                className="block text-destructive hover:text-destructive"
              >
                Remove photo
              </Button>
            )}
            <p className="text-xs text-muted-foreground">JPG, PNG · Max 3 MB</p>
            {photoError && (
              <p className="text-xs text-destructive">{photoError}</p>
            )}
          </div>
        </div>
      </section>

      {/* Account Info */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Account Info
        </h2>
        <div className="divide-y divide-slate-100">
          <InfoRow label="Name" value={user.name} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Role" value={roleLabel} />
          {user.role === "teacher" && user.sectionName && (
            <InfoRow
              label="Advisory Section"
              value={[user.sectionGrade, user.sectionName]
                .filter(Boolean)
                .join(" – ")}
            />
          )}
          {user.role === "parent" && user.childName && (
            <InfoRow label="Linked Student" value={user.childName} />
          )}
        </div>
      </section>

      {/* Security */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Security
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Password</p>
            <p className="text-xs text-muted-foreground">
              Change your account password
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setPwdModalOpen(true)}
          >
            <Lock className="size-3.5" />
            Change Password
          </Button>
        </div>
      </section>

      {/* Privacy Notice */}
      <p className="text-xs text-muted-foreground">
        <a
          href="/privacy"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Privacy Notice
        </a>
        {" — "}
        How we collect and protect your personal and biometric data.
      </p>

      {/* Change Password Modal */}
      <ChangePasswordModal
        open={pwdModalOpen}
        onClose={() => setPwdModalOpen(false)}
      />
    </div>
  );
}

function ChangePasswordModal({ open, onClose }) {
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  function reset() {
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setPwdError(null);
    setPwdSuccess(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(false);
    if (newPwd !== confirmPwd) {
      setPwdError("New passwords do not match.");
      return;
    }
    const fails = pwdStrengthFails(newPwd);
    if (fails.length > 0) {
      setPwdError(`Password must include: ${fails.join(", ")}.`);
      return;
    }
    setPwdSaving(true);
    try {
      await api.changePassword({
        currentPassword: currentPwd,
        newPassword: newPwd,
      });
      setPwdSuccess(true);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err) {
      setPwdError(err.message ?? "Failed to change password.");
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Change Password">
      <form onSubmit={handlePasswordChange} className="space-y-4 pt-1">
        <PasswordField
          id="current-pwd"
          label="Current password"
          value={currentPwd}
          onChange={setCurrentPwd}
          show={showCurrent}
          onToggleShow={() => setShowCurrent((v) => !v)}
          disabled={pwdSaving}
        />
        <PasswordField
          id="new-pwd"
          label="New password"
          value={newPwd}
          onChange={setNewPwd}
          show={showNew}
          onToggleShow={() => setShowNew((v) => !v)}
          disabled={pwdSaving}
        />
        <StrengthChecklist password={newPwd} />
        <PasswordField
          id="confirm-pwd"
          label="Confirm new password"
          value={confirmPwd}
          onChange={setConfirmPwd}
          show={showConfirm}
          onToggleShow={() => setShowConfirm((v) => !v)}
          disabled={pwdSaving}
        />
        {pwdError && (
          <p className="text-sm text-destructive">{pwdError}</p>
        )}
        {pwdSuccess && (
          <p className="flex items-center gap-1.5 text-sm text-emerald-600">
            <Check className="size-4" /> Password changed successfully.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={pwdSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pwdSaving || !currentPwd || !newPwd || !confirmPwd}
            className="gap-1.5"
          >
            {pwdSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Lock className="size-4" />
            )}
            Update password
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, show, onToggleShow, disabled }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          disabled={disabled}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function pwdStrengthFails(pwd) {
  const fails = [];
  if (pwd.length < 8)     fails.push("at least 8 characters");
  if (!/[A-Z]/.test(pwd)) fails.push("an uppercase letter");
  if (!/[a-z]/.test(pwd)) fails.push("a lowercase letter");
  if (!/[0-9]/.test(pwd)) fails.push("a number");
  return fails;
}

function StrengthChecklist({ password }) {
  if (!password) return null;
  const checks = [
    { label: "8+ characters",    ok: password.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter", ok: /[a-z]/.test(password) },
    { label: "Number",           ok: /[0-9]/.test(password) },
  ];
  return (
    <ul className="space-y-1 pt-1">
      {checks.map(({ label, ok }) => (
        <li key={label} className={cn("flex items-center gap-2 text-xs", ok ? "text-emerald-600" : "text-muted-foreground")}>
          {ok
            ? <Check className="size-3.5 shrink-0" />
            : <Circle className="size-3.5 shrink-0 opacity-40" />}
          {label}
        </li>
      ))}
    </ul>
  );
}
