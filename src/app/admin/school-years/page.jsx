"use client";

import { useEffect, useState } from "react";
import { CalendarRange, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/dashboard-ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function SchoolYearsPage() {
  const [activeYear, setActiveYear] = useState(null);
  const [loading,    setLoading]    = useState(true);

  // Start modal (create + activate in one step)
  const [startOpen, setStartOpen] = useState(false);
  const [newName,   setNewName]   = useState("");
  const [newStart,  setNewStart]  = useState("");
  const [newEnd,    setNewEnd]    = useState("");
  const [startErr,  setStartErr]  = useState("");
  const [starting,  setStarting]  = useState(false);

  // End school year modal
  const [endOpen, setEndOpen] = useState(false);
  const [ending,  setEnding]  = useState(false);

  // Edit dates modal
  const [editOpen,  setEditOpen]  = useState(false);
  const [editStart, setEditStart] = useState("");
  const [editEnd,   setEditEnd]   = useState("");
  const [editErr,   setEditErr]   = useState("");
  const [saving,    setSaving]    = useState(false);

  async function load() {
    try {
      const years = await api.get("/school-years");
      const active = Array.isArray(years) ? (years.find((y) => y.isActive) ?? null) : null;
      setActiveYear(active);
    } catch {
      toast.error("Could not load school year.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ── Start school year (create + activate) ─────────────────────────────────
  const openStart = () => {
    setNewName(""); setNewStart(""); setNewEnd(""); setStartErr("");
    setStartOpen(true);
  };

  const closeStart = () => {
    if (starting) return;
    setStartOpen(false);
    setStartErr("");
  };

  const handleStart = async (e) => {
    e.preventDefault();
    if (!newName.trim())    { setStartErr("Name is required.");                        return; }
    if (!newStart)          { setStartErr("Start date is required.");                  return; }
    if (!newEnd)            { setStartErr("End date is required.");                    return; }
    if (newStart >= newEnd) { setStartErr("Start date must be before end date.");      return; }
    if (starting) return;
    setStarting(true);
    setStartErr("");
    try {
      const created = await api.post("/school-years", {
        name: newName.trim(), startDate: newStart, endDate: newEnd,
      });
      await api.patch(`/school-years/${created._id}/activate`, {});
      toast.success(`${newName.trim()} is now the active school year.`);
      setStartOpen(false);
      load();
    } catch (err) {
      setStartErr(err.message || "Could not start school year.");
    } finally {
      setStarting(false);
    }
  };

  // ── End school year ───────────────────────────────────────────────────────
  const handleEnd = async () => {
    if (!activeYear || ending) return;
    setEnding(true);
    try {
      await api.patch(`/school-years/${activeYear._id}/end`, {});
      toast.success(`${activeYear.name} has ended. Student records archived.`);
      setEndOpen(false);
      load();
    } catch (err) {
      toast.error(err.message || "Could not end school year.");
    } finally {
      setEnding(false);
    }
  };

  // ── Edit dates ────────────────────────────────────────────────────────────
  const openEdit = () => {
    if (!activeYear) return;
    setEditStart(activeYear.startDate?.slice(0, 10) ?? "");
    setEditEnd(activeYear.endDate?.slice(0, 10) ?? "");
    setEditErr("");
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditOpen(false);
    setEditErr("");
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editStart)           { setEditErr("Start date is required.");             return; }
    if (!editEnd)             { setEditErr("End date is required.");               return; }
    if (editStart >= editEnd) { setEditErr("Start date must be before end date."); return; }
    if (saving) return;
    setSaving(true);
    setEditErr("");
    try {
      await api.put(`/school-years/${activeYear._id}`, {
        startDate: editStart, endDate: editEnd,
      });
      toast.success("Dates updated.");
      setEditOpen(false);
      load();
    } catch (err) {
      setEditErr(err.message || "Could not update dates.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="School Years"
        subtitle="Manage the active school year and its dates."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">

          {activeYear ? (
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardContent className="flex flex-wrap items-center gap-4 py-5">
                <CalendarRange className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {activeYear.name}
                    </span>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Active
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fmtDate(activeYear.startDate)} → {fmtDate(activeYear.endDate)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" variant="outline" onClick={openEdit}>
                    <Pencil className="size-3.5" />
                    Edit Dates
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEndOpen(true)} className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30">
                    End School Year
                  </Button>
                  <Button size="sm" onClick={openStart}>
                    <Plus className="size-3.5" />
                    Start New Year
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <CalendarRange className="size-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium text-foreground">No active school year</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Start a school year to enable attendance tracking.
                  </p>
                </div>
                <Button onClick={openStart}>
                  Start School Year
                </Button>
              </CardContent>
            </Card>
          )}

          {/* How it works */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground text-sm">How school year transitions work</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Click <strong>Start School Year</strong>, enter a name and set start and end dates.</li>
              <li>The year activates immediately — attendance tracking begins on the start date.</li>
              <li>Edit the dates any time using <strong>Edit Dates</strong> if the schedule changes.</li>
              <li>When the year ends, click <strong>Start New Year</strong> — student sections, face biometrics, and enrollment are reset automatically.</li>
              <li>Student and teacher accounts are always preserved across transitions.</li>
            </ol>
          </div>

        </div>
      )}

      {/* ── End School Year modal ────────────────────────────────────────────── */}
      <Modal
        open={endOpen}
        onClose={() => { if (!ending) setEndOpen(false); }}
        title="End School Year"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            End <span className="font-semibold text-foreground">{activeYear?.name}</span>?
          </p>
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-red-800 dark:text-red-300">The following will happen immediately:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-xs text-red-700 dark:text-red-400">
              <li>All student records will be archived</li>
              <li>All sections will be removed</li>
              <li>The school year will become inactive</li>
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <strong>Not affected:</strong> attendance records, teacher accounts, guidance cases, and calendar events.
            You can start a new school year immediately after.
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" disabled={ending} onClick={() => setEndOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleEnd} disabled={ending}>
              {ending ? <><Loader2 className="size-4 animate-spin" />Ending…</> : "End School Year"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Start School Year modal ──────────────────────────────────────────── */}
      <Modal
        open={startOpen}
        onClose={closeStart}
        title={activeYear ? "Start New School Year" : "Start School Year"}
      >
        <form onSubmit={handleStart} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sy-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sy-name"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setStartErr(""); }}
              placeholder="e.g. 2027–2028"
              className="h-11"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sy-start">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sy-start"
                type="date"
                value={newStart}
                onChange={(e) => { setNewStart(e.target.value); setStartErr(""); }}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sy-end">
                End Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sy-end"
                type="date"
                value={newEnd}
                onChange={(e) => { setNewEnd(e.target.value); setStartErr(""); }}
                className="h-11"
              />
            </div>
          </div>

          {activeYear && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                This will replace the current year ({activeYear.name}):
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
                <li>All student section assignments will be cleared</li>
                <li>All face biometric templates will be cleared</li>
                <li>Enrollment records will be reset for the new year</li>
              </ul>
            </div>
          )}

          {startErr && (
            <p className="text-xs text-destructive">{startErr}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" disabled={starting} onClick={closeStart}>
              Cancel
            </Button>
            <Button type="submit" disabled={starting}>
              {starting
                ? <><Loader2 className="size-4 animate-spin" />Starting…</>
                : "Start School Year"
              }
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Dates modal ─────────────────────────────────────────────────── */}
      <Modal open={editOpen} onClose={closeEdit} title="Edit School Year Dates">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-start">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-start"
                type="date"
                value={editStart}
                onChange={(e) => { setEditStart(e.target.value); setEditErr(""); }}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end">
                End Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-end"
                type="date"
                value={editEnd}
                onChange={(e) => { setEditEnd(e.target.value); setEditErr(""); }}
                className="h-11"
              />
            </div>
          </div>

          {editErr && (
            <p className="text-xs text-destructive">{editErr}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" disabled={saving} onClick={closeEdit}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? <><Loader2 className="size-4 animate-spin" />Saving…</>
                : "Save"
              }
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
