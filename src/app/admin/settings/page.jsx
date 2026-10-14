"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-ui";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const KEYS = [
  "gate_closing_time",
  "homeroom_start_time",
  "homeroom_end_time",
  "attendance_finalization_time",
  "teacher_time_in",
  "teacher_grace_period",
];

const FIELDS = [
  {
    key:   "gate_closing_time",
    id:    "gate-closing",
    label: "Gate Closing Time",
    hint: (
      <>
        Students who arrive through the gate before this time are recorded as{" "}
        <strong>On Time</strong>. Students who arrive at or after this time are
        recorded as <strong>Late</strong>.
      </>
    ),
  },
  {
    key:   "homeroom_start_time",
    id:    "homeroom-start",
    label: "Homeroom Start Time",
    hint:  "Teachers may begin taking homeroom room attendance starting at this time. The app will prevent teachers from starting an official room scan before this time.",
  },
  {
    key:   "homeroom_end_time",
    id:    "homeroom-end",
    label: "Homeroom End Time",
    hint: (
      <>
        The normal homeroom scanning period ends at this time. Students who are
        still unresolved after this time remain <strong>Pending</strong> — they
        are not immediately marked Absent. Absences are only finalized at the
        Attendance Finalization Time below.
      </>
    ),
  },
  {
    key:   "attendance_finalization_time",
    id:    "finalization",
    label: "Attendance Finalization Time",
    hint: (
      <>
        At this time, all attendance records for the day are finalized: students
        who are still Pending are marked <strong>Absent</strong>, parents of
        absent students are notified, and the school&apos;s prescriptive
        intervention rules are evaluated against the finalized data.
      </>
    ),
  },
  {
    key:       "teacher_time_in",
    id:        "teacher-time-in",
    label:     "Teacher Time-In",
    inputType: "time",
    hint:      "Official arrival time for teachers. Combined with the grace period below to determine whether a teacher's gate scan is On Time or Late on the employee attendance record.",
  },
  {
    key:       "teacher_grace_period",
    id:        "teacher-grace-period",
    label:     "Teacher Grace Period (minutes)",
    inputType: "number",
    hint: (
      <>
        Minutes after Teacher Time-In that are still considered{" "}
        <strong>On Time</strong>. 
      </>
    ),
  },
];

function fmtTime(value) {
  if (!value) return "—";
  const [h, m] = value.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function SettingsPage() {
  const [saved,   setSaved]   = useState(null);
  const [form,    setForm]    = useState({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    api.get("/settings")
      .then((data) => {
        const map  = Object.fromEntries(data.map((s) => [s.key, s.value ?? ""]));
        const vals = Object.fromEntries(KEYS.map((k) => [k, map[k] || ""]));
        setSaved(vals);
      })
      .catch(() => toast.error("Could not load settings."))
      .finally(() => setLoading(false));
  }, []);

  function startEdit() {
    setForm({ ...saved });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setForm({});
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all(KEYS.map((k) => api.put(`/settings/${k}`, { value: form[k] })));
      setSaved({ ...form });
      setEditing(false);
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(err.message || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Settings" subtitle="Configure school-wide attendance timing." />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading settings…
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Configure school-wide attendance timing."
      />

      <div className="max-w-2xl">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-base font-semibold text-foreground">
                Attendance Configuration
              </h2>
              <p className="text-sm text-muted-foreground">
                School days are calculated from the active school year period, excluding weekends,
                national holidays, and school-declared No Class Days. Changes to these times take
                effect immediately — no server restart required.
              </p>
            </div>
            {!editing && (
              <Button size="sm" variant="outline" onClick={startEdit} className="shrink-0">
                <Pencil className="size-3.5" />
                Edit
              </Button>
            )}
          </CardHeader>

          <CardContent>
            <form onSubmit={save} className="space-y-6">
              {FIELDS.map(({ key, id, label, hint, inputType = "time" }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={editing ? id : undefined}>{label}</Label>

                  {editing ? (
                    <Input
                      id={id}
                      type={inputType}
                      value={form[key] ?? ""}
                      onChange={set(key)}
                      className="h-11 max-w-xs"
                      {...(inputType === "number" ? { min: 0, max: 120 } : {})}
                    />
                  ) : (
                    <p className="text-sm font-medium text-muted-foreground">
                      {inputType === "number"
                        ? (saved?.[key] != null && saved[key] !== "" ? `${saved[key]} min` : "—")
                        : fmtTime(saved?.[key])}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
              ))}

              {editing && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving
                      ? <><Loader2 className="size-4 animate-spin" />Saving…</>
                      : "Save changes"}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
