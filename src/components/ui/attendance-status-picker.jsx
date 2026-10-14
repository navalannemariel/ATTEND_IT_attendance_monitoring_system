"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    value:  "present",
    label:  "Present",
    active: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
    hover:  "hover:bg-emerald-50 hover:text-emerald-700",
  },
  {
    value:  "late",
    label:  "Late",
    active: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
    hover:  "hover:bg-amber-50 hover:text-amber-700",
  },
  {
    value:  "absent",
    label:  "Absent",
    active: "bg-red-100 text-red-700 ring-1 ring-red-200",
    hover:  "hover:bg-red-50 hover:text-red-700",
  },
  {
    value:  "excused",
    label:  "Excused",
    active: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
    hover:  "hover:bg-sky-50 hover:text-sky-700",
  },
];

/**
 * Compact inline status picker for attendance editing.
 *
 * mode="student"      → Present / Late / Absent / Excused
 * mode="teacher"      → Present / Late / Absent  (no Excused)
 * allowToggleOff=true → clicking the already-active button calls onSave(null),
 *                       signalling the parent to remove the manual record.
 *                       Defaults to false; only the student attendance flow uses this.
 *
 * Clicking a non-active button immediately calls onSave(value).
 * onSave must throw on API error (after calling toast.error) so the picker stays
 * open for retry.  On success the parent closes the modal and reloads data.
 */
export function AttendanceStatusPicker({ mode = "student", currentStatus, onSave, onCancel, allowToggleOff = false }) {
  const [saving,   setSaving]   = useState(false);
  const [pending,  setPending]  = useState(null);
  const [removing, setRemoving] = useState(false);

  const opts = mode === "teacher"
    ? OPTIONS.filter((o) => o.value !== "excused")
    : OPTIONS;

  async function handleClick(value) {
    if (saving) return;
    if (value === null) setRemoving(true);
    else setPending(value);
    setSaving(true);
    try {
      await onSave(value);
    } catch {
      // parent already called toast.error — just reset saving state so user can retry
    } finally {
      setSaving(false);
      setPending(null);
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Select new status
      </p>
      <div className={cn("grid gap-2", mode === "teacher" ? "grid-cols-3" : "grid-cols-2")}>
        {opts.map(({ value, label, active, hover }) => {
          const isCurrent   = value === (currentStatus ?? "").toLowerCase();
          const isPending   = value === pending && saving;
          const isRemoving  = isCurrent && removing;
          const canToggleOff = allowToggleOff && isCurrent;
          return (
            <button
              key={value}
              type="button"
              disabled={saving}
              onClick={() => handleClick(canToggleOff ? null : value)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-medium transition-colors",
                isCurrent
                  ? cn(active, canToggleOff ? "cursor-pointer hover:opacity-70" : "cursor-default")
                  : cn("text-muted-foreground", hover, "disabled:cursor-not-allowed disabled:opacity-40")
              )}
            >
              {(isPending || isRemoving) ? (
                <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : isCurrent ? (
                <Check className="size-3 shrink-0" />
              ) : null}
              {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-40"
      >
        Cancel
      </button>
    </div>
  );
}
