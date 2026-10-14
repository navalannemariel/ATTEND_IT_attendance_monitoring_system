"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Pencil, Trash2, Users, X, GraduationCap, ScanLine, BookOpen, Clock } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/dashboard-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { GateScanRecordsModal } from "@/components/dashboard/gate-scan-records-modal";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const GRADE_LEVELS = [
  "", "Grade 7", "Grade 8", "Grade 9",
  "Grade 10", "Grade 11", "Grade 12",
];
const GRADE_ORDER = {
  "Grade 7": 0, "Grade 8": 1, "Grade 9": 2,
  "Grade 10": 3, "Grade 11": 4, "Grade 12": 5,
};

function sectionDisplay(sec) {
  return sec.gradeLevel ? `${sec.gradeLevel} – ${sec.name}` : sec.name;
}

function adviserName(sec) {
  if (!sec.adviser) return null;
  return typeof sec.adviser === "object" ? sec.adviser.name : sec.adviser;
}

// ── Student picker (chip-style multi-select) ─────────────────────────────────

function StudentPicker({ sectionId, availableStudents, onEnrolled, onCancel }) {
  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState([]);
  const [open,     setOpen]     = useState(false);
  const [saving,   setSaving]   = useState(false);

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return availableStudents
      .filter((u) => !selected.some((s) => s._id === u._id))
      .filter((u) =>
        u.name.toLowerCase().includes(q) ||
        (u.studentNumber && u.studentNumber.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [query, availableStudents, selected]);

  function pickStudent(u) {
    setSelected((prev) => [...prev, u]);
    setQuery("");
    setOpen(false);
  }

  function removeStudent(id) {
    setSelected((prev) => prev.filter((s) => s._id !== id));
  }

  async function handleSave() {
    if (!selected.length) return;
    setSaving(true);
    try {
      await api.post(`/sections/${sectionId}/enroll`, {
        studentIds: selected.map((s) => s._id),
      });
      toast.success(`${selected.length} student${selected.length !== 1 ? "s" : ""} added to section.`);
      onEnrolled(selected);
    } catch (err) {
      toast.error(err.message || "Could not add students.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span
              key={u._id}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {u.name}
              <button type="button" onClick={() => removeStudent(u._id)} className="ml-0.5 hover:text-primary/60">
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input + dropdown */}
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search by name or student number…"
          className="h-8 text-sm"
          autoFocus
        />
        {open && query.trim() && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-md overflow-hidden">
            {suggestions.length > 0 ? (
              suggestions.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onMouseDown={() => pickStudent(u)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  <span>{u.name}</span>
                  {u.studentNumber && (
                    <span className="ml-3 shrink-0 font-mono text-xs text-muted-foreground">{u.studentNumber}</span>
                  )}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-xs text-muted-foreground">No available students found.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving || selected.length === 0}>
          {saving
            ? <Loader2 className="size-3.5 animate-spin" />
            : `Add ${selected.length > 0 ? selected.length : ""} Student${selected.length !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}

// ── Subject management ───────────────────────────────────────────────────────

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatSchedule(sub) {
  const days = (sub.daysOfWeek ?? []).map((d) => DAY_LABELS[d]).join("/");
  const time = sub.startTime && sub.endTime ? ` · ${sub.startTime}–${sub.endTime}` : "";
  return days ? `${days}${time}` : "No schedule";
}

function SubjectForm({ sectionId, editingSubject, teachers, onDone, onCancel }) {
  const [name,      setName]      = useState(editingSubject?.name ?? "");
  const [teacherId, setTeacherId] = useState(editingSubject?.teacher?._id ?? "");
  const [days,      setDays]      = useState(editingSubject?.daysOfWeek ?? []);
  const [startTime, setStartTime] = useState(editingSubject?.startTime ?? "");
  const [endTime,   setEndTime]   = useState(editingSubject?.endTime ?? "");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  function toggleDay(d) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError("Subject name is required."); return; }
    if (!teacherId)   { setError("Teacher is required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { name: name.trim(), section: sectionId, teacher: teacherId,
                        daysOfWeek: days, startTime: startTime || null, endTime: endTime || null };
      if (editingSubject) {
        await api.put(`/subjects/${editingSubject._id}`, payload);
        toast.success("Subject updated.");
      } else {
        await api.post("/subjects", payload);
        toast.success("Subject added.");
      }
      onDone();
    } catch (err) {
      setError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="space-y-1">
        <Label htmlFor="sub-name" className="text-xs">Subject Name *</Label>
        <Input id="sub-name" value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          placeholder="e.g. Mathematics" className="h-8 text-sm" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="sub-teacher" className="text-xs">Teacher *</Label>
        <Select id="sub-teacher" value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)} className="h-8 text-sm">
          <option value="">— Select teacher —</option>
          {teachers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Days</Label>
        <div className="flex gap-1">
          {DAY_LABELS.map((lbl, d) => (
            <button key={d} type="button" onClick={() => toggleDay(d)}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-xs font-medium transition-colors",
                days.includes(d)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/60"
              )}>
              {lbl}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="sub-start" className="text-xs">Start Time</Label>
          <Input id="sub-start" type="time" value={startTime}
            onChange={(e) => setStartTime(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor="sub-end" className="text-xs">End Time</Label>
          <Input id="sub-end" type="time" value={endTime}
            onChange={(e) => setEndTime(e.target.value)} className="h-8 text-sm" />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : (editingSubject ? "Save" : "Add")}
        </Button>
      </div>
    </form>
  );
}

function SubjectsPanel({ sectionId, teachers }) {
  const [subjects,   setSubjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function loadSubjects() {
    setLoading(true);
    try {
      const data = await api.get(`/subjects?sectionId=${sectionId}`).catch(() => []);
      setSubjects(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSubjects(); }, [sectionId]);

  async function handleDelete(id) {
    try {
      await api.delete(`/subjects/${id}`);
      toast.success("Subject removed.");
      setDeletingId(null);
      setSubjects((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      toast.error(err.message || "Could not delete subject.");
    }
  }

  function handleDone() {
    setShowForm(false);
    setEditing(null);
    loadSubjects();
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          <BookOpen className="size-3" />
          Subjects
          {!loading && <span className="ml-0.5 font-bold text-foreground">{subjects.length}</span>}
        </p>
        {!showForm && (
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline underline-offset-2">
            <Plus className="size-3" /> Add
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-2">
          <SubjectForm
            sectionId={sectionId}
            editingSubject={editing}
            teachers={teachers}
            onDone={handleDone}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </div>
      )}

      {loading ? (
        <p className="py-3 text-center text-xs text-muted-foreground">Loading subjects…</p>
      ) : subjects.length === 0 && !showForm ? (
        <p className="rounded-lg border border-dashed border-border py-4 text-center text-sm text-muted-foreground">
          No subjects assigned yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {subjects.map((sub) => {
            const isConfirming = deletingId === sub._id;
            return (
              <div key={sub._id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors",
                  isConfirming && "border-destructive/30 bg-destructive/5"
                )}>
                {isConfirming ? (
                  <>
                    <p className="flex-1 truncate text-xs text-destructive">
                      Remove <span className="font-semibold">{sub.name}</span>?
                    </p>
                    <div className="flex shrink-0 gap-1.5">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-xs"
                        onClick={() => setDeletingId(null)}>Cancel</Button>
                      <Button size="sm" variant="destructive" className="h-6 px-2 text-xs"
                        onClick={() => handleDelete(sub._id)}>Remove</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{sub.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Clock className="size-2.5 shrink-0" />
                        {sub.teacher?.name ?? "No teacher"} · {formatSchedule(sub)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button"
                        onClick={() => { setEditing(sub); setShowForm(true); }}
                        className="p-1 text-muted-foreground/40 transition-colors hover:text-primary">
                        <Pencil className="size-3" />
                      </button>
                      <button type="button"
                        onClick={() => setDeletingId(sub._id)}
                        className="p-1 text-muted-foreground/40 transition-colors hover:text-destructive">
                        <X className="size-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Section detail modal ─────────────────────────────────────────────────────

function SectionDetailModal({
  section, students, teachers, availableStudents,
  onClose, onSectionUpdated, onStudentsEnrolled, onStudentUnenrolled,
}) {
  const [reassigning,   setReassigning]   = useState(false);
  const [newAdviserId,  setNewAdviserId]  = useState(
    section.adviser
      ? (typeof section.adviser === "object" ? section.adviser._id : section.adviser)
      : ""
  );
  const [savingAdviser,  setSavingAdviser]  = useState(false);
  const [showPicker,     setShowPicker]     = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [removing,        setRemoving]        = useState(false);

  const roster = useMemo(
    () => students
      .filter((u) => u.sectionId === section._id || u.sectionId?._id === section._id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [students, section._id]
  );

  async function saveAdviser() {
    setSavingAdviser(true);
    try {
      const updated = await api.put(`/sections/${section._id}`, {
        name:       section.name,
        gradeLevel: section.gradeLevel,
        adviser:    newAdviserId || null,
      });
      toast.success("Adviser updated.");
      onSectionUpdated(updated);
      setReassigning(false);
    } catch (err) {
      toast.error(err.message || "Could not update adviser.");
    } finally {
      setSavingAdviser(false);
    }
  }

  async function handleRemoveStudent(studentId) {
    setRemoving(true);
    try {
      await api.post(`/sections/${section._id}/unenroll`, { studentId });
      toast.success("Student removed from section.");
      setConfirmRemoveId(null);
      onStudentUnenrolled(studentId);
    } catch (err) {
      toast.error(err.message || "Could not remove student.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Adviser block — full width */}
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Adviser
        </p>
        {reassigning ? (
          <div className="flex items-center gap-2">
            <Select
              value={newAdviserId}
              onChange={(e) => setNewAdviserId(e.target.value)}
              className="h-9 flex-1"
            >
              <option value="">— No adviser —</option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </Select>
            <Button size="sm" onClick={saveAdviser} disabled={savingAdviser}>
              {savingAdviser ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setReassigning(false)} disabled={savingAdviser}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {adviserName(section) ?? "No adviser assigned"}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReassigning(true)}
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-primary"
            >
              <Pencil className="size-3" />
              Reassign
            </Button>
          </div>
        )}
      </div>

      {/* Students + Subjects side by side */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
        {/* Enrolled Students */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              <Users className="size-3" />
              Enrolled Students
              <span className="ml-0.5 font-bold text-foreground">{roster.length}</span>
            </p>
            {!showPicker && (
              <button
                onClick={() => setShowPicker(true)}
                className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline underline-offset-2"
              >
                <Plus className="size-3" />
                Add
              </button>
            )}
          </div>

          {showPicker && (
            <div className="mb-2">
              <StudentPicker
                sectionId={section._id}
                availableStudents={availableStudents}
                onEnrolled={(enrolled) => {
                  setShowPicker(false);
                  onStudentsEnrolled(enrolled, section._id);
                }}
                onCancel={() => setShowPicker(false)}
              />
            </div>
          )}

          {roster.length === 0 && !showPicker ? (
            <p className="rounded-lg border border-dashed border-border py-5 text-center text-sm text-muted-foreground">
              No students enrolled yet.
            </p>
          ) : roster.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="max-h-96 overflow-y-auto divide-y divide-border">
                {roster.map((u) => {
                  const isConfirming = confirmRemoveId === u._id;
                  return (
                    <div
                      key={u._id}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 transition-colors",
                        isConfirming && "bg-destructive/5"
                      )}
                    >
                      {isConfirming ? (
                        <>
                          <p className="text-xs text-destructive truncate">
                            Remove <span className="font-semibold">{u.name}</span>?
                          </p>
                          <div className="flex gap-1.5 shrink-0 ml-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs"
                              onClick={() => setConfirmRemoveId(null)}
                              disabled={removing}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleRemoveStudent(u._id)}
                              disabled={removing}
                            >
                              {removing ? <Loader2 className="size-3 animate-spin" /> : "Remove"}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveId(u._id)}
                              className="text-muted-foreground/40 transition-colors hover:text-destructive"
                              title="Remove from section"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Subjects */}
        <div className="border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <SubjectsPanel sectionId={section._id} teachers={teachers} />
        </div>
      </div>

      <div className="flex justify-end border-t border-border pt-3">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

// ── Section create/edit form ──────────────────────────────────────────────────

function SectionForm({ editing, teachers, onClose, onDone }) {
  const [name,      setName]      = useState(editing?.name      ?? "");
  const [grade,     setGrade]     = useState(editing?.gradeLevel ?? "");
  const [adviserId, setAdviserId] = useState(
    editing
      ? (typeof editing.adviser === "object" ? editing.adviser?._id ?? "" : editing.adviser ?? "")
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError("Section name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { name: name.trim(), gradeLevel: grade || null, adviser: adviserId || null };
      if (editing) {
        const updated = await api.put(`/sections/${editing._id}`, payload);
        toast.success("Section updated.");
        onDone(updated);
      } else {
        const created = await api.post("/sections", payload);
        toast.success("Section created.");
        onDone(created);
      }
    } catch (err) {
      setError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="sec-grade">Grade Level</Label>
        <Select id="sec-grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="h-11">
          {GRADE_LEVELS.map((g) => (
            <option key={g} value={g}>{g || "— Not specified —"}</option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sec-name">
          Section Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="sec-name"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          placeholder="e.g. St. Peter"
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sec-adviser">
          Adviser
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Select id="sec-adviser" value={adviserId} onChange={(e) => setAdviserId(e.target.value)} className="h-11">
          <option value="">— No adviser assigned —</option>
          {teachers.map((t) => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </Select>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving
            ? <><Loader2 className="size-4 animate-spin" />{editing ? "Saving…" : "Creating…"}</>
            : editing ? "Save changes" : "Create"}
        </Button>
      </div>
    </form>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SectionsPage() {
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const [editModal,     setEditModal]     = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [detailSection, setDetailSection] = useState(null);
  const [gateScanSection, setGateScanSection] = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null); // section to confirm-delete
  const [deleting,      setDeleting]      = useState(false);

  async function load() {
    try {
      const [secs, users] = await Promise.all([
        api.get("/sections").catch(() => []),
        api.get("/users").catch(() => []),
      ]);
      const allUsers = Array.isArray(users) ? users : [];
      setSections(Array.isArray(secs) ? secs : []);
      setTeachers(allUsers.filter((u) => u.role === "teacher" && !u.deletedAt));
      setStudents(allUsers.filter((u) => u.role === "student" && !u.deletedAt));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const studentCounts = useMemo(() => {
    const counts = {};
    for (const u of students) {
      const key = u.sectionId?._id ?? u.sectionId;
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [students]);

  // Students with no section assignment — eligible to be enrolled
  const availableStudents = useMemo(
    () => students.filter((u) => !u.sectionId),
    [students]
  );

  const sorted = useMemo(() =>
    [...sections].sort((a, b) => {
      const ga = GRADE_ORDER[a.gradeLevel] ?? 99;
      const gb = GRADE_ORDER[b.gradeLevel] ?? 99;
      return ga !== gb ? ga - gb : a.name.localeCompare(b.name);
    }),
    [sections]
  );

  function openCreate() {
    setEditing(null);
    setEditModal(true);
  }

  function openEdit(sec, e) {
    e.stopPropagation();
    setEditing(sec);
    setEditModal(true);
  }

  function openGateScanRecords(sec, e) {
    e.stopPropagation();
    setGateScanSection(sec);
  }

  function openDeleteConfirm(sec, e) {
    e.stopPropagation();
    setDeleteTarget(sec);
  }

  async function handleDeleteSection() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/sections/${deleteTarget._id}`);
      toast.success(`Section "${deleteTarget.name}" deleted.`);
      setSections((prev) => prev.filter((s) => s._id !== deleteTarget._id));
      // Clear students that were in this section
      setStudents((prev) =>
        prev.map((u) => {
          const sid = u.sectionId?._id ?? u.sectionId;
          return String(sid) === String(deleteTarget._id) ? { ...u, sectionId: null, section: null } : u;
        })
      );
      if (detailSection?._id === deleteTarget._id) setDetailSection(null);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || "Could not delete section.");
    } finally {
      setDeleting(false);
    }
  }

  function handleFormDone(updatedOrCreated) {
    setEditModal(false);
    setEditing(null);
    if (detailSection?._id === updatedOrCreated._id) {
      setDetailSection(updatedOrCreated);
    }
    load();
  }

  function handleAdviserUpdated(updatedSection) {
    setSections((prev) => prev.map((s) => s._id === updatedSection._id ? updatedSection : s));
    setDetailSection(updatedSection);
  }

  function handleStudentsEnrolled(enrolledStudents, sectionId) {
    setStudents((prev) =>
      prev.map((u) =>
        enrolledStudents.some((e) => e._id === u._id)
          ? { ...u, sectionId }
          : u
      )
    );
  }

  function handleStudentUnenrolled(studentId) {
    setStudents((prev) =>
      prev.map((u) => u._id === studentId ? { ...u, sectionId: null } : u)
    );
  }

  return (
    <>
      <PageHeader
        title="Sections"
        subtitle="Advisory sections for the current school year. Click a row to manage the roster."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            New Section
          </Button>
        }
      />

      {loading ? (
        <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
          Loading sections…
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
          No sections yet. Create one above.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((sec) => {
            const count   = studentCounts[String(sec._id)] ?? 0;
            const adviser = adviserName(sec);
            return (
              <div
                key={sec._id}
                role="button"
                tabIndex={0}
                onClick={() => setDetailSection(sec)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailSection(sec); } }}
                className={cn(
                  "group relative flex flex-col rounded-xl bg-card p-5 text-left",
                  "shadow-sm ring-1 ring-black/5",
                  "transition-all duration-150 cursor-pointer",
                  "hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/25",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                )}
              >
                {/* Card shortcuts */}
                <div className="absolute right-3 top-3 flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={(e) => openGateScanRecords(sec, e)}
                    className="rounded-md p-1 text-muted-foreground/30 transition-colors hover:bg-muted hover:text-primary"
                    title="Gate Scan Records"
                  >
                    <ScanLine className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => openEdit(sec, e)}
                    className="rounded-md p-1 text-muted-foreground/30 transition-colors hover:bg-muted hover:text-primary"
                    title="Edit section"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => openDeleteConfirm(sec, e)}
                    className="rounded-md p-1 text-muted-foreground/30 transition-colors hover:bg-muted hover:text-destructive"
                    title="Delete section"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {/* Grade badge */}
                {sec.gradeLevel && (
                  <span className="mb-2 self-start rounded-full bg-primary/8 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    {sec.gradeLevel}
                  </span>
                )}

                {/* Section name */}
                <p className="pr-12 text-base font-semibold text-foreground transition-colors group-hover:text-primary">
                  {sec.name}
                </p>

                <div className="my-3 border-t border-border/60" />

                {/* Adviser + student count */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="size-3.5 shrink-0 text-muted-foreground/50" />
                    <span>{count} student{count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <GraduationCap className="size-3.5 shrink-0 text-muted-foreground/50" />
                    {adviser
                      ? <span className="truncate">{adviser}</span>
                      : <span className="italic text-muted-foreground/50">No adviser</span>
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit section modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={editing ? "Edit Section" : "New Section"}>
        {editModal && (
          <SectionForm
            editing={editing}
            teachers={teachers}
            onClose={() => setEditModal(false)}
            onDone={handleFormDone}
          />
        )}
      </Modal>

      {/* Section detail modal */}
      <Modal
        open={!!detailSection}
        onClose={() => setDetailSection(null)}
        title={detailSection ? sectionDisplay(detailSection) : ""}
        size="2xl"
      >
        {detailSection && (
          <SectionDetailModal
            section={detailSection}
            students={students}
            teachers={teachers}
            availableStudents={availableStudents}
            onClose={() => setDetailSection(null)}
            onSectionUpdated={handleAdviserUpdated}
            onStudentsEnrolled={handleStudentsEnrolled}
            onStudentUnenrolled={handleStudentUnenrolled}
          />
        )}
      </Modal>

      {/* Delete section confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete Section"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Delete <span className="font-semibold">{sectionDisplay(deleteTarget)}</span>?
              This action cannot be undone.
            </p>
            {(studentCounts[String(deleteTarget._id)] ?? 0) > 0 && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                {studentCounts[String(deleteTarget._id)]} student{studentCounts[String(deleteTarget._id)] !== 1 ? "s" : ""} currently in this section will be unassigned.
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteSection} disabled={deleting}>
                {deleting ? <><Loader2 className="size-4 animate-spin" />Deleting…</> : "Delete"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Gate Scan Records modal — keyed by section so each section opens
          with a fresh calendar/selected date instead of reusing state from
          whichever section was viewed previously. */}
      <GateScanRecordsModal
        key={gateScanSection?._id ?? "none"}
        open={!!gateScanSection}
        onClose={() => setGateScanSection(null)}
        section={gateScanSection}
      />
    </>
  );
}
