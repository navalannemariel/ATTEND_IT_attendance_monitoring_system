"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  UserPlus, UserCheck, Pencil, Ban, CircleCheck, Search, Archive,
  ArchiveRestore, Loader2, ChevronDown, ChevronRight, Eye, EyeOff,
  Printer, Copy, KeyRound, MoreHorizontal, GraduationCap, ExternalLink,
  Users as UsersIcon, User as UserIcon, CalendarDays, Trash2, Fingerprint,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, DataTable, StatusBadge } from "@/components/dashboard/dashboard-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const GRADE_LEVELS = [
  "Grade 7", "Grade 8", "Grade 9",
  "Grade 10", "Grade 11", "Grade 12",
];

const ROLE_TO_BACKEND = {
  Teacher: "teacher",
  "Guidance Counselor": "guidance_counselor",
  Administrator: "admin",
  Gate: "gate",
  Student: "student",
};

const ROLE_FROM_BACKEND = {
  teacher: "Teacher",
  guidance_counselor: "Guidance Counselor",
  admin: "Administrator",
  gate: "Gate",
  student: "Student",
  parent: "Parent / Guardian",
  principal: "Principal", // legacy display label for existing accounts
};

const EMPLOYEE_ROLES = ["Teacher", "Guidance Counselor", "Administrator", "Gate"];

function isStudent(u) { return u.role === "student"; }
function isEmployee(u) { return u.role !== "student" && u.role !== "parent" && u.role !== "substitute_teacher"; }
function displayRole(r) { return ROLE_FROM_BACKEND[r] ?? r; }
function displayStatus(s) { return s === "inactive" ? "Disabled" : "Active"; }

const ARCHIVE_REASON_LABEL = {
  manual:       "Manual",
  resigned:     "Resigned",
  not_enrolled: "Not enrolled",
  graduated:    "Graduated",
  transferred:  "Transferred",
};

function sectionEntityDisplay(sec) {
  return sec.gradeLevel ? `${sec.gradeLevel} – ${sec.name}` : sec.name;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

const SUFFIX_OPTIONS = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V', 'Other'];

const NAME_RE   = /^[A-Za-zÀ-ÖØ-öø-ÿ\s'\-\.]+$/;
const MOBILE_RE = /^\d{11}$/;
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUNUM_RE = /^\d+$/;

function capitalizeName(str) {
  if (!str) return str;
  return str
    .split(' ')
    .map(word =>
      word.split('-').map(part =>
        part.split("'").map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("'")
      ).join('-')
    )
    .join(' ');
}

function splitName(full = "") {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], middle: "", last: "" };
  if (parts.length === 2) return { first: parts[0], middle: "", last: parts[1] };
  return { first: parts[0], middle: parts.slice(1, -1).join(" "), last: parts[parts.length - 1] };
}

function formatLastFirst(full = "") {
  const { first, middle, last } = splitName(full);
  if (!last) return full;
  const firstMiddle = [first, middle].filter(Boolean).join(" ");
  return `${last}, ${firstMiddle}`;
}

function displayUserRole(u) {
  if (u.role === "parent") {
    if (u.guardianRelationship === "parent")   return "Parent";
    if (u.guardianRelationship === "guardian") return "Guardian";
    return "Parent / Guardian";
  }
  return ROLE_FROM_BACKEND[u.role] ?? u.role;
}

function printSlip({ name, roleLabel, email, tempPassword }) {
  const win = window.open("", "_blank");
  win.document.write(`<!doctype html><html><head><title>Credential Slip</title>
<style>
  body{font-family:Georgia,serif;margin:48px;color:#111}
  h1{font-size:18px;margin:0 0 2px}
  .sub{font-size:12px;color:#666;margin:0 0 28px}
  table{width:100%;border-collapse:collapse}
  td{padding:6px 0;vertical-align:top}
  td:first-child{font-weight:bold;width:140px;color:#555}
  .pw{font-family:monospace;font-size:17px;letter-spacing:3px}
  .note{margin-top:28px;font-size:11px;color:#888;border-top:1px solid #ddd;padding-top:12px}
</style></head><body>
<h1>Holy Heart of Christ Academy</h1>
<p class="sub">Attendance Monitoring System — Credential Slip</p>
<table>
  <tr><td>Name</td><td>${name}</td></tr>
  <tr><td>Role</td><td>${roleLabel}</td></tr>
  <tr><td>Email</td><td>${email}</td></tr>
  <tr><td>Temp Password</td><td class="pw">${tempPassword}</td></tr>
</table>
<p class="note">⚠&nbsp; Please change this password immediately on first login. Do not share this slip.</p>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 150);
}

// ── Credential reveal modal ──────────────────────────────────────────────────

function CredentialSlipModal({ creds, onClose }) {
  const { name, roleLabel, email, tempPassword } = creds;
  const copyText = `Name: ${name}\nRole: ${roleLabel}\nEmail: ${email}\nPassword: ${tempPassword}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(copyText).then(() => toast.success("Credentials copied."));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        These credentials are shown <strong>once only</strong>. Copy or print them before closing.
      </p>
      <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2.5 text-sm">
        {[
          ["Name",     name],
          ["Role",     roleLabel],
          ["Email",    email],
          ["Password", tempPassword],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-3">
            <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <span className={cn("font-medium text-foreground", label === "Password" && "font-mono tracking-widest text-base")}>
              {value}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        The user must change this password on first login.
      </p>
      <div className="flex flex-wrap gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={() => printSlip(creds)} className="gap-1.5">
          <Printer className="size-3.5" />
          Print Slip
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
          <Copy className="size-3.5" />
          Copy
        </Button>
        <Button size="sm" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

// ── Reset password modal ─────────────────────────────────────────────────────

function ResetPasswordModal({ target, onDone, onClose }) {
  const [step,     setStep]    = useState(1);
  const [adminPwd, setAdminPwd] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!adminPwd) { setError("Please enter your password."); return; }
    if (saving) return;
    setSaving(true);
    try {
      const result = await api.post(`/users/${target.id ?? target._id}/reset-password`, { adminPassword: adminPwd });
      onDone({
        name:         result.user.name,
        roleLabel:    displayRole(result.user.role),
        email:        result.user.email,
        tempPassword: result.tempPassword,
        _title:       "Password Reset",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (step === 1) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This will generate a new temporary password for{" "}
          <span className="font-semibold text-foreground">{target.name}</span>.
          Their current password will be invalidated immediately.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { setStep(2); setError(""); }}>Continue</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter your admin password to confirm the password reset for{" "}
        <span className="font-semibold text-foreground">{target.name}</span>.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="rp-pwd">Your current password</Label>
        <div className="relative">
          <Input
            id="rp-pwd"
            type={showPwd ? "text" : "password"}
            value={adminPwd}
            onChange={(e) => { setAdminPwd(e.target.value); setError(""); }}
            placeholder="Enter your password"
            className="h-11 pr-10"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" disabled={saving}
          onClick={() => { setStep(1); setError(""); setAdminPwd(""); }}>
          Back
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <><Loader2 className="size-4 animate-spin" />Resetting…</> : "Reset Password"}
        </Button>
      </div>
    </form>
  );
}

// ── Relationship toggle ──────────────────────────────────────────────────────

function RelationshipToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {["parent", "guardian"].map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            "rounded-md px-5 py-1.5 text-sm font-medium capitalize transition-colors",
            value === r
              ? "bg-white text-primary shadow-sm"
              : "text-slate-500 hover:text-foreground"
          )}
        >
          {r === "parent" ? "Parent" : "Guardian"}
        </button>
      ))}
    </div>
  );
}

// ── Form section header ──────────────────────────────────────────────────────

function FormSection({ icon: Icon, title, children, headerRight }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-muted-foreground" />}
          <p className="text-sm font-semibold text-foreground">{title}</p>
        </div>
        {headerRight}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ── Student overview panel (shown in edit mode) ──────────────────────────────

function StudentOverviewPanel({ user, parent, section, schoolYear }) {
  const rows = [
    {
      label: "Status",
      value: user.status === "active" ? "Active" : "Disabled",
      dot:   user.status === "active" ? "green" : "red",
    },
    {
      label: "Face Recognition",
      value: user.faceEnrolledAt ? "Face Enrolled" : "Not Enrolled",
      dot:   user.faceEnrolledAt ? "green" : "slate",
    },
    {
      label: "School Year",
      value: schoolYear?.name ?? "—",
    },
    {
      label: "Current Section",
      value: section ? sectionEntityDisplay(section) : "No Section Assigned",
      muted: !section,
    },
    {
      label: "Parent Account",
      value: parent ? `Linked · ${parent.name}` : "Not Linked",
      dot:   parent ? "green" : "slate",
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        Student Overview
      </p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{r.label}</span>
          <div className="flex items-center gap-1.5">
            {r.dot && (
              <span className={cn("size-1.5 rounded-full shrink-0", {
                "bg-emerald-400": r.dot === "green",
                "bg-red-400":     r.dot === "red",
                "bg-slate-300":   r.dot === "slate",
              })} />
            )}
            <span className={cn(
              "text-right font-medium",
              r.muted ? "italic text-muted-foreground/60" : "text-foreground"
            )}>
              {r.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Overflow menu (student row actions) ─────────────────────────────────────

function OverflowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-8 items-center justify-center rounded-md transition-colors",
          "text-muted-foreground hover:bg-muted hover:text-foreground",
          open && "bg-muted text-foreground"
        )}
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg ring-1 ring-black/5">
          {items.map((item, i) => {
            if (item.divider) {
              return <div key={i} className="my-1 border-t border-border" />;
            }
            if (item.href) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                  onClick={() => setOpen(false)}
                >
                  {item.icon && <item.icon className="size-3.5 shrink-0 text-muted-foreground" />}
                  {item.label}
                </a>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => { item.onClick?.(); setOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted",
                  item.danger ? "text-destructive" : "text-foreground"
                )}
              >
                {item.icon && (
                  <item.icon className={cn(
                    "size-3.5 shrink-0",
                    item.danger ? "text-destructive" : "text-muted-foreground"
                  )} />
                )}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Student list ─────────────────────────────────────────────────────────────

function FlatStudentList({ students, onEdit, onToggle, onArchive, onDelete, onResetPassword, onRemoveFace, parentsByStudentId = {} }) {
  if (students.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No students match your filters.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {students.map((u) => {
        const row    = { ...u, id: u._id, status: displayStatus(u.status) };
        const parent = parentsByStudentId[String(u._id)];

        const menuItems = [
          {
            label: "Edit",
            icon:  Pencil,
            onClick: () => onEdit(row),
          },
          { divider: true },
          {
            label: u.status === "inactive" ? "Enable" : "Disable",
            icon:  u.status === "inactive" ? CircleCheck : Ban,
            onClick: () => onToggle(row),
          },
          ...(u.faceEnrolledAt ? [{
            label:   "Remove Face",
            icon:    Fingerprint,
            danger:  true,
            onClick: () => onRemoveFace(row),
          }] : []),
          {
            label:   "Archive",
            icon:    Archive,
            danger:  true,
            onClick: () => onArchive(row),
          },
          {
            label:   "Delete",
            icon:    Trash2,
            danger:  true,
            onClick: () => onDelete(row),
          },
          ...(parent ? [
            { divider: true },
            {
              label:   "Reset Parent's Password",
              icon:    KeyRound,
              onClick: () => onResetPassword({
                id: parent._id, _id: parent._id, name: parent.name, role: parent.role,
              }),
            },
          ] : []),
          { divider: true },
          {
            label: "View Student Profile",
            icon:  ExternalLink,
            href:  `/admin/users/students/${u._id}`,
          },
        ];

        return (
          <div key={u._id} className="flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{formatLastFirst(u.name)}</p>
            </div>

            {/* Status badges */}
            <StatusBadge value={u.faceEnrolledAt ? "Face Enrolled" : "No Face Enrolled"} />
            <StatusBadge value={row.status} />

            {/* Overflow menu */}
            <OverflowMenu items={menuItems} />
          </div>
        );
      })}
    </div>
  );
}

// ── Archived users grouped by year ──────────────────────────────────────────

function ArchivedYearGroups({ users, onUnarchive, query }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, query]);

  const byYear = useMemo(() => {
    const map = {};
    for (const u of filtered) {
      const yr = u.deletedAt ? new Date(u.deletedAt).getFullYear() : 0;
      if (!map[yr]) map[yr] = [];
      map[yr].push(u);
    }
    return Object.entries(map)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([yr, list]) => ({ year: Number(yr), users: list }));
  }, [filtered]);

  const yearKeyStr = byYear.map((g) => g.year).join(",");
  const [expanded, setExpanded] = useState(() => new Set(byYear[0]?.year ? [byYear[0].year] : []));
  useEffect(() => {
    const yr = byYear[0]?.year;
    if (yr) setExpanded(new Set([yr]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearKeyStr]);

  const toggle = (yr) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(yr) ? next.delete(yr) : next.add(yr);
    return next;
  });

  if (byYear.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
        No archived users match your search.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {byYear.map(({ year, users: yearUsers }) => {
        const isOpen = expanded.has(year);
        return (
          <div key={year} className="overflow-hidden rounded-lg border border-border bg-card">
            <button
              type="button"
              onClick={() => toggle(year)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-3">
                {isOpen
                  ? <ChevronDown  className="size-4 text-muted-foreground" />
                  : <ChevronRight className="size-4 text-muted-foreground" />}
                <span className="text-sm font-semibold text-foreground">Archived {year || "—"}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {yearUsers.length}
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="divide-y divide-border border-t border-border">
                {yearUsers.map((u) => (
                  <div key={u._id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{formatLastFirst(u.name)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {displayUserRole(u)} · {u.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Archived {fmtDate(u.deletedAt)} — {ARCHIVE_REASON_LABEL[u.archiveReason] ?? "Manual"}
                        {u.archiveNote ? `: ${u.archiveNote}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUnarchive({ id: u._id, name: u.name })}
                      className="shrink-0 gap-1.5 text-slate-600 hover:text-primary"
                    >
                      <ArchiveRestore className="size-3.5" />
                      Unarchive
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Employee row actions (unchanged) ─────────────────────────────────────────

function RowActions({ row, onEdit, onToggle, onArchive, onResetPassword }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button variant="ghost" size="sm" onClick={() => onEdit(row)}
        className="h-8 gap-1.5 px-2 text-xs text-slate-500 hover:text-primary">
        <Pencil className="size-3.5" />
        Edit
      </Button>
      {onResetPassword && (
        <Button variant="ghost" size="sm" onClick={() => onResetPassword(row)}
          className="h-8 gap-1.5 px-2 text-xs text-slate-500 hover:text-primary">
          <KeyRound className="size-3.5" />
          Reset Password
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => onToggle(row)}
        className={cn("h-8 gap-1.5 px-2 text-xs",
          row.status === "Disabled" ? "text-emerald-600 hover:text-emerald-700" : "text-amber-600 hover:text-amber-700"
        )}>
        {row.status === "Disabled"
          ? <><CircleCheck className="size-3.5" />Enable</>
          : <><Ban className="size-3.5" />Disable</>}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onArchive(row)}
        className="h-8 gap-1.5 px-2 text-xs text-slate-500 hover:text-destructive">
        <Archive className="size-3.5" />
        Archive
      </Button>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function UserManagementPage({ view = "both" }) {
  const showEmp = view !== "students";
  const showStu = view !== "employees";

  const [users,           setUsers]           = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [showArchived,    setShowArchived]     = useState(false);
  const [empOpen,         setEmpOpen]         = useState(showEmp);
  const [stuOpen,         setStuOpen]         = useState(showStu);
  const [modalOpen,       setModalOpen]       = useState(false);
  const [editing,         setEditing]         = useState(null);
  const [addKind,         setAddKind]         = useState(view === "students" ? "student" : "employee");
  const [archiveTarget,   setArchiveTarget]   = useState(null);
  const [resetTarget,     setResetTarget]     = useState(null);
  const [deleteTarget,    setDeleteTarget]    = useState(null);
  const [deleting,        setDeleting]        = useState(false);
  const [removeFaceTarget, setRemoveFaceTarget] = useState(null);
  const [removingFace,     setRemovingFace]     = useState(false);
  const [archiveReason,   setArchiveReason]   = useState("manual");
  const [archiveNote,     setArchiveNote]     = useState("");
  const [archiving,       setArchiving]       = useState(false);
  const [credsToReveal,        setCredsToReveal]        = useState(null);
  const [enrollExistingOpen,   setEnrollExistingOpen]   = useState(false);
  const [query,           setQuery]           = useState("");
  const [roleFilter,      setRoleFilter]      = useState("all");
  const [empGender,       setEmpGender]       = useState("all");
  const [empStatus,       setEmpStatus]       = useState("all");
  const [stuGender,       setStuGender]       = useState("all");
  const [stuGrade,        setStuGrade]        = useState("all");
  const [stuStatus,       setStuStatus]       = useState("all");
  const [stuFaceStatus,   setStuFaceStatus]   = useState("all");
  const [sectionEntities, setSectionEntities] = useState([]);

  async function loadUsers(archived = false) {
    try {
      const url = archived ? "/users?archived=true" : "/users";
      const data = await api.get(url);
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Could not load users.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSections() {
    try {
      const data = await api.get("/sections");
      setSectionEntities(Array.isArray(data) ? data : []);
    } catch { /* sections optional */ }
  }

  useEffect(() => {
    setLoading(true);
    loadUsers(showArchived);
    loadSections();
  }, [showArchived]);

  const employees = useMemo(() => users.filter(isEmployee), [users]);
  const students  = useMemo(() => users.filter(isStudent),  [users]);

  const parentsByStudentId = useMemo(() => {
    const map = {};
    for (const u of users) {
      if (u.role !== "parent") continue;
      // Match both the legacy singular `student` field and the authoritative
      // `students` array — a parent's 2nd+ linked child only appears in the
      // array, never in the singular field.
      if (u.student) map[String(u.student)] = u;
      for (const sid of u.students || []) {
        const key = String(sid);
        if (!map[key]) map[key] = u;
      }
    }
    return map;
  }, [users]);

  // Derive active school year from the first section entity (sections include schoolYear)
  const activeSchoolYear = useMemo(
    () => sectionEntities[0]?.schoolYear ?? null,
    [sectionEntities]
  );

  const formKind = editing
    ? (isStudent(editing) ? "student" : "employee")
    : addKind;

  const filteredEmployeeRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .filter((u) => roleFilter  === "all" || displayRole(u.role)    === roleFilter)
      .filter((u) => empGender   === "all" || u.gender               === empGender)
      .filter((u) => empStatus   === "all" || displayStatus(u.status) === empStatus)
      .map((u) => ({ ...u, id: u._id, role: displayRole(u.role), status: displayStatus(u.status) }));
  }, [employees, query, roleFilter, empGender, empStatus]);

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      .filter((u) => stuGender === "all" || u.gender === stuGender)
      .filter((u) => stuStatus === "all" || displayStatus(u.status) === stuStatus)
      .filter((u) => stuFaceStatus === "all" ||
        (stuFaceStatus === "Enrolled" ? !!u.faceEnrolledAt : !u.faceEnrolledAt))
      .filter((u) => {
        if (stuGrade === "all") return true;
        const sec   = sectionEntities.find((s) => String(s._id) === String(u.sectionId));
        const grade = sec?.gradeLevel ?? u.section?.match(/^(Grade \d+)/)?.[1] ?? "";
        return grade === stuGrade;
      });
  }, [students, query, stuGender, stuStatus, stuFaceStatus, stuGrade, sectionEntities]);

  const openAddEmployee = () => { setAddKind("employee"); setEditing(null); setModalOpen(true); };
  const openAddStudent  = () => { setAddKind("student");  setEditing(null); setModalOpen(true); };
  const openEdit = (row) => {
    const raw = users.find((u) => u._id === (row.id ?? row._id));
    setEditing(raw ?? row);
    setModalOpen(true);
  };
  const close = () => setModalOpen(false);

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const noteParam = archiveNote.trim()
        ? `&note=${encodeURIComponent(archiveNote.trim())}`
        : "";
      await api.delete(`/users/${archiveTarget.id}?reason=${archiveReason}${noteParam}`);
      toast.success(`${archiveTarget.name} archived.`);
      setArchiveTarget(null);
      setArchiveReason("manual");
      setArchiveNote("");
      loadUsers(showArchived);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setArchiving(false);
    }
  };

  const closeArchiveModal = () => {
    if (archiving) return;
    setArchiveTarget(null);
    setArchiveReason("manual");
    setArchiveNote("");
  };

  const handleToggle = async (row) => {
    const nextStatus = row.status === "Disabled" ? "active" : "inactive";
    try {
      await api.put(`/users/${row.id ?? row._id}`, { status: nextStatus });
      toast.success(nextStatus === "active" ? `${row.name} enabled.` : `${row.name} disabled.`);
      loadUsers(showArchived);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUnarchive = async (row) => {
    try {
      await api.put(`/users/${row.id ?? row._id}`, { deletedAt: null });
      toast.success(`${row.name} restored.`);
      loadUsers(showArchived);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRemoveFace = async () => {
    if (!removeFaceTarget) return;
    setRemovingFace(true);
    try {
      await api.delete(`/face/${removeFaceTarget.id ?? removeFaceTarget._id}`);
      toast.success(`Face data removed for ${removeFaceTarget.name}.`);
      setRemoveFaceTarget(null);
      loadUsers(showArchived);
    } catch (err) {
      toast.error(err.message ?? "Could not remove face data.");
    } finally {
      setRemovingFace(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget.id ?? deleteTarget._id}/permanent`);
      toast.success(`${deleteTarget.name} permanently deleted.`);
      setDeleteTarget(null);
      loadUsers(showArchived);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const employeeColumns = [
    { key: "name",   label: "Name",    render: (row) => `${formatLastFirst(row.name)}${row.suffix ? ` ${row.suffix}` : ''}` },
    { key: "role",   label: "Role" },
    { key: "status", label: "Status", badge: true },
    {
      key: "actions", label: "",
      render: (row) => {
        const menuItems = [
          { label: "Edit",           icon: Pencil,      onClick: () => openEdit(row) },
          { divider: true },
          {
            label: row.status === "Disabled" ? "Enable" : "Disable",
            icon:  row.status === "Disabled" ? CircleCheck : Ban,
            onClick: () => handleToggle(row),
          },
          { label: "Archive",        icon: Archive,     onClick: () => setArchiveTarget(row), danger: true },
          { label: "Delete",         icon: Trash2,      onClick: () => setDeleteTarget(row),  danger: true },
          { divider: true },
          { label: "Reset Password", icon: KeyRound,    onClick: () => setResetTarget(row) },
        ];
        return <OverflowMenu items={menuItems} />;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={view === "employees" ? "Employees" : view === "students" ? "Students" : "User Management"}
        subtitle={
          view === "employees" ? "Manage employee accounts." :
          view === "students"  ? "Manage student accounts." :
          "Manage employee and student accounts."
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="h-11 pl-9"
          />
        </div>
        <Button
          variant={showArchived ? "default" : "outline"}
          size="sm"
          onClick={() => { setShowArchived((v) => !v); setQuery(""); }}
          className="gap-1.5"
        >
          <Archive className="size-3.5" />
          {showArchived ? "Hide archived" : "Show archived"}
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="space-y-3">

          {/* ── Employees panel ── */}
          {showEmp && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setEmpOpen((v) => !v)}
                  className="flex flex-1 items-center gap-2.5 text-left"
                >
                  <span className={cn("size-2 shrink-0 rounded-full",
                    employees.length > 0 ? "bg-emerald-400" : "bg-slate-300"
                  )} />
                  <span className="text-sm font-semibold text-foreground">Employees</span>
                  <ChevronDown className={cn("ml-1 size-4 text-muted-foreground transition-transform", empOpen && "rotate-180")} />
                </button>
                {!showArchived && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Select value={roleFilter}  onChange={(e) => setRoleFilter(e.target.value)}  className="h-8 w-auto text-xs">
                      <option value="all">All roles</option>
                      {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                    <Select value={empGender}   onChange={(e) => setEmpGender(e.target.value)}   className="h-8 w-auto text-xs">
                      <option value="all">All genders</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </Select>
                    <Select value={empStatus}   onChange={(e) => setEmpStatus(e.target.value)}   className="h-8 w-auto text-xs">
                      <option value="all">All statuses</option>
                      <option value="Active">Active</option>
                      <option value="Disabled">Disabled</option>
                    </Select>
                    <Button size="sm" onClick={openAddEmployee} className="h-8 gap-1.5 text-xs">
                      <UserPlus className="size-3.5" />
                      Add Employee
                    </Button>
                  </div>
                )}
              </div>

              {empOpen && (
                <div className="border-t border-border">
                  {showArchived ? (
                    <ArchivedYearGroups users={employees} onUnarchive={handleUnarchive} query={query} />
                  ) : (
                    <DataTable
                      columns={employeeColumns}
                      rows={filteredEmployeeRows}
                      empty="No employees match your filters."
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Students panel ── */}
          {showStu && (
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setStuOpen((v) => !v)}
                  className="flex flex-1 items-center gap-2.5 text-left"
                >
                  <span className={cn("size-2 shrink-0 rounded-full",
                    students.length > 0 ? "bg-emerald-400" : "bg-slate-300"
                  )} />
                  <span className="text-sm font-semibold text-foreground">Students</span>
                  <ChevronDown className={cn("ml-1 size-4 text-muted-foreground transition-transform", stuOpen && "rotate-180")} />
                </button>
                {!showArchived && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Select value={stuGender} onChange={(e) => setStuGender(e.target.value)} className="h-8 w-auto text-xs">
                      <option value="all">All genders</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </Select>
                    <Select value={stuGrade}  onChange={(e) => setStuGrade(e.target.value)}  className="h-8 w-auto text-xs">
                      <option value="all">All grades</option>
                      {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </Select>
                    <Select value={stuStatus} onChange={(e) => setStuStatus(e.target.value)} className="h-8 w-auto text-xs">
                      <option value="all">All statuses</option>
                      <option value="Active">Active</option>
                      <option value="Disabled">Disabled</option>
                    </Select>
                    <Select value={stuFaceStatus} onChange={(e) => setStuFaceStatus(e.target.value)} className="h-8 w-auto text-xs">
                      <option value="all">All face status</option>
                      <option value="Enrolled">Face Enrolled</option>
                      <option value="Not Enrolled">Not Enrolled</option>
                    </Select>
                    <Button size="sm" onClick={openAddStudent} className="h-8 gap-1.5 text-xs">
                      <UserPlus className="size-3.5" />
                      Add Student
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEnrollExistingOpen(true)} className="h-8 gap-1.5 text-xs">
                      <UserCheck className="size-3.5" />
                      Enroll Existing
                    </Button>
                  </div>
                )}
              </div>

              {stuOpen && (
                <div className="border-t border-border">
                  {showArchived ? (
                    <ArchivedYearGroups users={students} onUnarchive={handleUnarchive} query={query} />
                  ) : (
                    <FlatStudentList
                      students={filteredStudents}
                      onEdit={openEdit}
                      onToggle={handleToggle}
                      onArchive={setArchiveTarget}
                      onDelete={setDeleteTarget}
                      onResetPassword={setResetTarget}
                      onRemoveFace={setRemoveFaceTarget}
                      parentsByStudentId={parentsByStudentId}
                    />
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Archive confirmation */}
      <Modal open={!!archiveTarget} onClose={closeArchiveModal} title="Archive Account">
        <p className="text-sm text-muted-foreground">
          This will archive{" "}
          <span className="font-semibold text-foreground">{archiveTarget?.name}</span>.
          Records linked to this account are preserved.
          {archiveTarget?.role === "student" && (
            <span className="mt-1 block">This will also archive the linked parent/guardian account.</span>
          )}
        </p>

        {archiveTarget?.role === "student" ? (
          <div className="mt-4 space-y-1.5">
            <label htmlFor="archive-reason" className="text-sm font-medium text-foreground">Reason</label>
            <Select
              id="archive-reason"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              className="h-10 w-full"
            >
              <option value="manual">Manual archive</option>
              <option value="graduated">Graduated</option>
              <option value="transferred">Transferred</option>
              <option value="not_enrolled">Did not enroll</option>
            </Select>
          </div>
        ) : archiveTarget?.role !== "parent" && (
          <div className="mt-4 space-y-1.5">
            <label htmlFor="archive-reason" className="text-sm font-medium text-foreground">Reason</label>
            <Select
              id="archive-reason"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              className="h-10 w-full"
            >
              <option value="manual">Manual archive</option>
              <option value="resigned">Resigned</option>
            </Select>
          </div>
        )}

        <div className="mt-4 space-y-1.5">
          <label htmlFor="archive-note" className="text-sm font-medium text-foreground">
            Reason details{" "}
            <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            id="archive-note"
            value={archiveNote}
            onChange={(e) => setArchiveNote(e.target.value)}
            placeholder="e.g. Relocated to another province"
            className="h-10"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={closeArchiveModal} disabled={archiving}>Cancel</Button>
          <Button variant="destructive" onClick={confirmArchive} disabled={archiving}>
            {archiving ? <Loader2 className="size-4 animate-spin" /> : "Archive"}
          </Button>
        </div>
      </Modal>

      {/* Permanent delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} title="Delete Account">
        <p className="text-sm text-muted-foreground">
          Permanently delete{" "}
          <span className="font-semibold text-foreground">{deleteTarget?.name}</span>?
          This cannot be undone. The account will be removed from the system entirely.
          {deleteTarget?.role === "student" && (
            <span className="mt-1 block">The linked parent/guardian account will also be deleted.</span>
          )}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" onClick={handlePermanentDelete} disabled={deleting}>
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <><Trash2 className="size-4" />Delete</>}
          </Button>
        </div>
      </Modal>

      {/* Remove face confirmation */}
      <Modal open={!!removeFaceTarget} onClose={() => !removingFace && setRemoveFaceTarget(null)} title="Remove Face Data">
        <p className="text-sm text-muted-foreground">
          Remove the enrolled face for{" "}
          <span className="font-semibold text-foreground">{removeFaceTarget?.name}</span>?
          They will no longer be recognized by face scans until re-enrolled.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRemoveFaceTarget(null)} disabled={removingFace}>Cancel</Button>
          <Button variant="destructive" onClick={handleRemoveFace} disabled={removingFace}>
            {removingFace ? <Loader2 className="size-4 animate-spin" /> : <><Fingerprint className="size-4" />Remove Face</>}
          </Button>
        </div>
      </Modal>

      {/* Reset password */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title="Reset Password">
        {resetTarget && (
          <ResetPasswordModal
            target={resetTarget}
            onClose={() => setResetTarget(null)}
            onDone={(creds) => { setResetTarget(null); setCredsToReveal(creds); }}
          />
        )}
      </Modal>

      {/* Credential reveal */}
      <Modal
        open={!!credsToReveal}
        onClose={() => setCredsToReveal(null)}
        title={credsToReveal?._title ?? "Account Created"}
      >
        {credsToReveal && (
          <CredentialSlipModal creds={credsToReveal} onClose={() => setCredsToReveal(null)} />
        )}
      </Modal>

      {/* Enroll existing student */}
      <Modal
        open={enrollExistingOpen}
        onClose={() => setEnrollExistingOpen(false)}
        title="Enroll Existing Student"
      >
        {enrollExistingOpen && (
          <EnrollExistingStudentModal
            sectionEntities={sectionEntities}
            activeSchoolYear={activeSchoolYear}
            onDone={() => loadUsers(showArchived)}
            onClose={() => setEnrollExistingOpen(false)}
          />
        )}
      </Modal>

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={close}
        title={`${editing ? "Edit" : "Add"} ${formKind === "student" ? "Student" : "Employee"}`}
        size={formKind === "student" ? "xl" : "lg"}
      >
        {modalOpen && (
          <UserForm
            kind={formKind}
            user={editing}
            sectionEntities={sectionEntities}
            activeSchoolYear={activeSchoolYear}
            parentsByStudentId={parentsByStudentId}
            allParents={users.filter((u) => u.role === "parent" && !u.deletedAt)}
            onDone={(creds) => {
              close();
              loadUsers(showArchived);
              if (creds) setCredsToReveal(creds);
            }}
          />
        )}
      </Modal>
    </>
  );
}

// ── EnrollExistingStudentModal ───────────────────────────────────────────────
// Three-step flow: Search → Review + Section → Success

function prevSectionLabel(student) {
  if (student.sectionId?.name) {
    return student.sectionId.gradeLevel
      ? `${student.sectionId.gradeLevel} – ${student.sectionId.name}`
      : student.sectionId.name;
  }
  return student.section || "—";
}

function EnrollExistingStudentModal({ sectionEntities, activeSchoolYear, onDone, onClose }) {
  const [step,           setStep]           = useState(1);
  const [query,          setQuery]          = useState("");
  const [searching,      setSearching]      = useState(false);
  const [results,        setResults]        = useState([]);
  const [selected,       setSelected]       = useState(null);
  const [parentInfo,     setParentInfo]     = useState(null);
  const [parentLoading,  setParentLoading]  = useState(false);
  const [newSectionId,   setNewSectionId]   = useState("");
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState("");
  const timerRef = useRef(null);

  const doSearch = async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const data = await api.get(`/users/students/for-enrollment?q=${encodeURIComponent(q.trim())}`);
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleQueryChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(q), 350);
  };

  const handleSelect = (student) => {
    setSelected(student);
    setParentInfo(null);
    setParentLoading(true);
    api.get(`/users/parent-of/${student._id}`)
      .then((p) => setParentInfo(p))
      .catch(() => setParentInfo(null))
      .finally(() => setParentLoading(false));
    setNewSectionId("");
    setError("");
    setStep(2); // preview/confirmation
  };

  const handleEnroll = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await api.post(`/users/${selected._id}/reenroll`, {
        sectionId: newSectionId || null,
      });
      onDone();
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 4: Success ──────────────────────────────────────────────────────
  if (step === 4) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-4 space-y-1.5">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            {selected?.name} enrolled for {activeSchoolYear?.name ?? "the current school year"}.
          </p>
          <p className="text-sm text-emerald-600 dark:text-emerald-500">
            A new face enrollment is required before this student can be recognized by attendance scans.
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  // ── Step 2: Student preview / identity confirmation ─────────────────────
  if (step === 2) {
    const statusLabel = selected?.deletedAt
      ? { text: "Archived — will be restored", cls: "text-amber-600 dark:text-amber-400" }
      : selected?.status === "inactive"
        ? { text: "Inactive", cls: "text-muted-foreground" }
        : { text: "Active", cls: "text-emerald-600 dark:text-emerald-400" };

    const rows = [
      { label: "Full Name",        value: selected?.name ?? "—" },
      { label: "Student Number",   value: selected?.studentNumber ?? "—", mono: true },
      { label: "Grade / Section",  value: prevSectionLabel(selected ?? {}) },
      {
        label: "Parent / Guardian",
        value: parentLoading ? "Loading…" : (parentInfo?.name ?? "—"),
        sub:   !parentLoading && parentInfo?.guardianRelationship
          ? parentInfo.guardianRelationship.charAt(0).toUpperCase() + parentInfo.guardianRelationship.slice(1)
          : null,
      },
      {
        label: "Previous School Year",
        value: selected?.enrolledSchoolYear?.name ?? "Not enrolled",
      },
    ];

    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Confirm Student Identity
          </p>
          <div className="divide-y divide-border/60">
            {rows.map(({ label, value, mono, sub }) => (
              <div key={label} className="flex items-start justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0">
                <span className="shrink-0 text-muted-foreground">{label}</span>
                <span className={`text-right font-medium text-foreground${mono ? " font-mono" : ""}`}>
                  {value}
                  {sub && <span className="ml-1 text-xs font-normal text-muted-foreground">({sub})</span>}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 py-2 pb-0 text-sm">
              <span className="shrink-0 text-muted-foreground">Status</span>
              <span className={`font-medium ${statusLabel.cls}`}>{statusLabel.text}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Make sure this is the correct student before proceeding — especially if multiple students share the same name.
        </p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => { setStep(1); setError(""); }}>
            Back to Search
          </Button>
          <Button type="button" onClick={() => setStep(3)}>
            Yes, this is the correct student
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 3: Section picker ───────────────────────────────────────────────
  if (step === 3) {
    const prevYear = selected?.enrolledSchoolYear?.name ?? "—";
    const prevSec  = prevSectionLabel(selected ?? {});

    return (
      <div className="space-y-5">
        {/* Identity */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Student Record</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Name</span>
              <span className="font-semibold text-foreground">{selected?.name}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Student No.</span>
              <span className="font-mono text-foreground">{selected?.studentNumber ?? "—"}</span>
            </div>
          </div>
        </div>

        {/* Previous enrollment */}
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Previous Enrollment</p>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">School Year</span>
            <span className="text-foreground">{prevYear}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Section</span>
            <span className="text-foreground">{prevSec}</span>
          </div>
          {selected?.deletedAt && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Account</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">Archived — will be restored</span>
            </div>
          )}
        </div>

        {/* New section */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">
            Enroll for {activeSchoolYear?.name ?? "current school year"}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="reenroll-section">
              Section{" "}
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Select
              id="reenroll-section"
              value={newSectionId}
              onChange={(e) => setNewSectionId(e.target.value)}
              className="h-11"
            >
              <option value="">No Section Assigned</option>
              {sectionEntities.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.gradeLevel ? `${s.gradeLevel} – ${s.name}` : s.name}
                </option>
              ))}
            </Select>
          </div>
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Face enrollment will be required after the current school year is activated. Previous biometric data is cleared at school-year transition.
          </p>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" disabled={saving}
            onClick={() => { setStep(2); setError(""); }}>
            Back
          </Button>
          <Button onClick={handleEnroll} disabled={saving}>
            {saving ? <><Loader2 className="size-4 animate-spin" />Enrolling…</> : "Confirm Enrollment"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 1: Search ───────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={handleQueryChange}
          placeholder="Search by name or student number…"
          className="h-11 pl-9"
        />
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
        {searching ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {query.trim() ? "No matching students found." : "Type a name or student number to search."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {results.map((s) => (
              <button
                key={s._id}
                type="button"
                onClick={() => handleSelect(s)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{formatLastFirst(s.name)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.studentNumber ?? "No student number"}
                    {" · "}
                    {prevSectionLabel(s)}
                    {" · "}
                    {s.enrolledSchoolYear?.name ?? "No previous year"}
                  </p>
                </div>
                {s.deletedAt ? (
                  <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                    Archived
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400">
                    Previous Year
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {query.trim()
          ? `Results are students not yet enrolled in ${activeSchoolYear?.name ?? "the current school year"}.`
          : `Search by name or student number to find students eligible for re-enrollment.`}
      </p>
    </div>
  );
}

// ── UserForm ─────────────────────────────────────────────────────────────────

function UserForm({ kind, user, sectionEntities = [], activeSchoolYear = null, parentsByStudentId = {}, allParents = [], onDone }) {
  const isStudentForm = kind === "student";
  const isEdit        = !!user;

  const initName = isEdit ? splitName(user.name) : { first: "", middle: "", last: "" };
  const [firstName,  setFirstName]  = useState(initName.first);
  const [middleName, setMiddleName] = useState(initName.middle);
  const [lastName,   setLastName]   = useState(initName.last);
  const [gender,     setGender]     = useState(user?.gender ?? "");

  // Employee-only
  const [email,          setEmail]          = useState(user?.email ?? "");
  const [role,           setRole]           = useState(user ? displayRole(user.role) : EMPLOYEE_ROLES[0]);
  const [employeeNumber, setEmployeeNumber] = useState(user?.employeeNumber ?? "");
  const [originalEmployeeNumber, setOriginalEmployeeNumber] = useState(user?.employeeNumber ?? "");

  // Student-only
  const [studentSectionId, setStudentSectionId] = useState(String(user?.sectionId ?? ""));
  const [studentNumber,    setStudentNumber]    = useState(user?.studentNumber ?? "");

  // Suffix (student and parent)
  const [suffix,               setSuffix]               = useState("");
  const [parentSuffix,         setParentSuffix]         = useState("");
  const [customSuffix,         setCustomSuffix]         = useState("");
  const [parentCustomSuffix,   setParentCustomSuffix]   = useState("");
  const [originalStudentNumber, setOriginalStudentNumber] = useState(user?.studentNumber ?? "");

  // Inline per-field validation errors (format only — "required" stays on submit)
  const [fieldErrors, setFieldErrors] = useState({});

  // Parent / guardian (create only)
  const [guardianRel,      setGuardianRel]      = useState("parent");
  const [parentFirstName,  setParentFirstName]  = useState("");
  const [parentMiddleName, setParentMiddleName] = useState("");
  const [parentLastName,   setParentLastName]   = useState("");
  const [parentEmail,  setParentEmail]  = useState("");
  const [parentMobile, setParentMobile] = useState("");

  // Parent / guardian (edit only) — initialized from the (possibly stale)
  // parentsByStudentId prop, then overwritten with a fresh fetch below once
  // it resolves (see the freshParent effect).
  const initParent = (isEdit && isStudentForm && user)
    ? (parentsByStudentId[String(user._id)] ?? null)
    : null;
  const initParentSplit = splitName(initParent?.name ?? "");
  const [parentEditFirstName,  setParentEditFirstName]  = useState(initParentSplit.first);
  const [parentEditMiddleName, setParentEditMiddleName] = useState(initParentSplit.middle);
  const [parentEditLastName,   setParentEditLastName]   = useState(initParentSplit.last);
  const [parentEditEmail,  setParentEditEmail]  = useState(initParent?.email ?? "");
  const [parentEditMobile, setParentEditMobile] = useState(initParent?.mobileNumber ?? "");

  // ── Fresh data on open (edit mode) ────────────────────────────────────────
  // The list this form was opened from can be stale (loaded on mount, or
  // before some other edit happened). Re-fetch the current student and their
  // linked parent straight from the DB every time the form opens, and use
  // those values instead of whatever the caller passed in — so "Existing
  // Account Detected" / the pre-filled fields always reflect current data.
  const [freshUser,   setFreshUser]   = useState(user);
  const [freshParent, setFreshParent] = useState(initParent);

  useEffect(() => {
    if (!isEdit || !user?._id) return;
    let cancelled = false;
    (async () => {
      try {
        const [freshU, freshP] = await Promise.all([
          api.get(`/users/${user._id}`),
          isStudentForm ? api.get(`/users/parent-of/${user._id}`) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setFreshUser(freshU ?? user);
        setFreshParent(freshP ?? null);
      } catch {
        // Fetch failed — keep whatever we already have from props.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, isStudentForm, user?._id]);

  // Re-fill the editable fields whenever fresh data arrives (runs once with
  // the prop-derived fallback, then again — correctly overwriting — once the
  // fetch above resolves).
  useEffect(() => {
    if (!freshUser) return;
    const split = splitName(freshUser.name);
    setFirstName(split.first);
    setMiddleName(split.middle);
    setLastName(split.last);
    setGender(freshUser.gender ?? "");
    setEmail(freshUser.email ?? "");
    setStudentSectionId(String(freshUser.sectionId ?? ""));
    setStudentNumber(freshUser.studentNumber ?? "");
    setSuffix(freshUser.suffix ?? "");
    setOriginalStudentNumber(freshUser.studentNumber ?? "");
    setEmployeeNumber(freshUser.employeeNumber ?? "");
    setOriginalEmployeeNumber(freshUser.employeeNumber ?? "");
    setFieldErrors({});
  }, [freshUser]);

  useEffect(() => {
    if (!isStudentForm || !isEdit) return;
    const split = splitName(freshParent?.name ?? "");
    setParentEditFirstName(split.first);
    setParentEditMiddleName(split.middle);
    setParentEditLastName(split.last);
    setParentEditEmail(freshParent?.email ?? "");
    setParentEditMobile(freshParent?.mobileNumber ?? "");
    setParentSuffix(freshParent?.suffix ?? "");
    setGuardianRel(freshParent?.guardianRelationship ?? "parent");
  }, [freshParent, isStudentForm, isEdit]);

  // Check if the typed parent email already belongs to an existing active
  // parent OTHER than the one already linked to this student — i.e. only
  // flag it when it's genuinely a different account.
  const existingParentMatch = useMemo(() => {
    const typed = isEdit ? parentEditEmail : parentEmail;
    if (!typed.trim()) return null;
    const lower = typed.trim().toLowerCase();
    const match = allParents.find((p) => p.email?.toLowerCase() === lower) ?? null;
    if (!match) return null;
    if (isEdit && freshParent && String(match._id) === String(freshParent._id)) return null;
    return match;
  }, [parentEmail, parentEditEmail, allParents, isEdit, freshParent]);

  // When editing a student with no linked parent and the typed email matches an
  // existing active parent, auto-fill their name/mobile so the payload satisfies
  // the backend's parentName guard and the admin can confirm the account details.
  // NOTE: must be declared AFTER existingParentMatch useMemo so the dep array
  // resolves correctly.
  useEffect(() => {
    if (!isStudentForm || !isEdit || freshParent || !existingParentMatch) return;
    const split = splitName(existingParentMatch.name ?? "");
    setParentEditFirstName(split.first);
    setParentEditMiddleName(split.middle);
    setParentEditLastName(split.last);
    setParentEditMobile(existingParentMatch.mobileNumber ?? "");
  }, [existingParentMatch, freshParent, isStudentForm, isEdit]);

  // Two-step edit flow
  const [step,                setStep]                = useState(1);
  const [pendingPayload,      setPendingPayload]      = useState(null);
  const [pendingParentPayload, setPendingParentPayload] = useState(null);
  const [adminPwd,       setAdminPwd]       = useState("");
  const [showPwd,        setShowPwd]        = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState("");
  // Archived parent reactivation confirmation (create flow only)
  const [archivedParent, setArchivedParent] = useState(null); // { name: string } | null

  // Derived values for the overview / academic assignment
  const selectedSection = useMemo(
    () => sectionEntities.find((s) => String(s._id) === studentSectionId) ?? null,
    [sectionEntities, studentSectionId]
  );

  const combinedName = () =>
    [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(" ");

  const setFE    = (key, msg) => setFieldErrors(prev => ({ ...prev, [key]: msg }));
  const clearFE  = (key)      => setFieldErrors(prev => { const n = {...prev}; delete n[key]; return n; });
  const chkName  = (val, key) => {
    if (!val.trim()) { clearFE(key); return; }
    if (!NAME_RE.test(val.trim())) setFE(key, 'Contains invalid characters.');
    else clearFE(key);
  };
  const chkEmail = (val, key) => {
    if (!val.trim()) { clearFE(key); return; }
    if (!EMAIL_RE.test(val.trim())) setFE(key, 'Enter a valid email address.');
    else clearFE(key);
  };
  const chkMobile = (val, key) => {
    if (!val.trim()) { clearFE(key); return; }
    if (!MOBILE_RE.test(val.trim())) setFE(key, 'Must be 11 digits (e.g. 09171234567).');
    else clearFE(key);
  };
  const chkStuNum = (val, key, original) => {
    if (!val.trim()) { clearFE(key); return; }
    if (val.trim() !== original && !STUNUM_RE.test(val.trim())) setFE(key, 'Digits only (e.g. 20240001).');
    else clearFE(key);
  };

  const buildPayload = () => {
    const name = combinedName();
    const effectiveSuffix = suffix === 'Other' ? customSuffix.trim() : suffix;
    const effectiveParentSuffix = parentSuffix === 'Other' ? parentCustomSuffix.trim() : parentSuffix;
    if (isStudentForm) {
      const secEntity = sectionEntities.find((s) => String(s._id) === studentSectionId);
      return {
        name,
        role:          "student",
        gender:        gender || null,
        studentNumber: studentNumber.trim() || null,
        sectionId:     studentSectionId || null,
        section:       secEntity ? sectionEntityDisplay(secEntity) : null,
        suffix:        effectiveSuffix || null,
        ...(!isEdit && {
          parentName:                [parentFirstName, parentMiddleName, parentLastName].map((s) => s.trim()).filter(Boolean).join(" "),
          parentEmail:               parentEmail.trim(),
          parentMobileNumber:        parentMobile.trim(),
          guardianRelationship:      guardianRel,
          parentSuffix:              effectiveParentSuffix || null,
          ...(archivedParent        && { reactivateArchivedParent: true }),
        }),
        // Pass parent fields when no parent is linked yet, OR when the typed
        // email matches an existing active parent (re-linking scenario). The
        // backend uses parentEmail to find and $addToSet the student in both
        // cases. When freshParent is set but existingParentMatch is null, the
        // admin is only editing the existing parent's name/mobile — those go
        // through the separate pendingParentPayload second PUT, not here.
        ...((isEdit && (!freshParent || existingParentMatch)) && {
          parentName:         [parentEditFirstName, parentEditMiddleName, parentEditLastName].map((s) => s.trim()).filter(Boolean).join(" "),
          parentEmail:        parentEditEmail.trim(),
          parentMobileNumber: parentEditMobile.trim(),
        }),
      };
    } else {
      const backendRole = ROLE_TO_BACKEND[role] ?? "teacher";
      return {
        name,
        email:          email.trim(),
        role:           backendRole,
        gender:         gender || null,
        suffix:         (suffix === 'Other' ? customSuffix.trim() : suffix) || null,
        employeeNumber: employeeNumber.trim() || null,
      };
    }
  };

  const validate = () => {
    if (!firstName.trim()) return "First name is required.";
    if (firstName.trim() && !NAME_RE.test(firstName.trim())) return "First name contains invalid characters.";
    if (!lastName.trim())  return "Last name is required.";
    if (lastName.trim() && !NAME_RE.test(lastName.trim())) return "Last name contains invalid characters.";
    if (middleName.trim() && !NAME_RE.test(middleName.trim())) return "Middle name contains invalid characters.";
    if (suffix === 'Other' && !customSuffix.trim()) return "Please enter a custom suffix or select a different option.";
    if (!gender) return "Gender is required.";
    if (!isStudentForm) {
      if (!isEdit && !employeeNumber.trim()) return "Employee number is required.";
      if (employeeNumber.trim() && employeeNumber.trim() !== originalEmployeeNumber && !STUNUM_RE.test(employeeNumber.trim())) return "Employee number must contain digits only.";
      if (!email.trim()) return "Email is required.";
      if (email.trim() && !EMAIL_RE.test(email.trim())) return "Please enter a valid email address.";
    } else {
      if (!studentNumber.trim()) return "Student number is required.";
      if (studentNumber.trim() && studentNumber.trim() !== originalStudentNumber && !STUNUM_RE.test(studentNumber.trim())) {
        return "Student number must be digits only (e.g. 20240001).";
      }
      if (!isEdit) {
        if (!parentFirstName.trim()) return "Parent/guardian first name is required.";
        if (parentFirstName.trim() && !NAME_RE.test(parentFirstName.trim())) return "Parent/guardian first name contains invalid characters.";
        if (!parentLastName.trim())  return "Parent/guardian last name is required.";
        if (parentLastName.trim() && !NAME_RE.test(parentLastName.trim())) return "Parent/guardian last name contains invalid characters.";
        if (parentMiddleName.trim() && !NAME_RE.test(parentMiddleName.trim())) return "Parent/guardian middle name contains invalid characters.";
        if (parentSuffix === 'Other' && !parentCustomSuffix.trim()) return "Please enter a custom suffix for the parent/guardian.";
        if (!parentEmail.trim()) return "Parent/guardian email is required.";
        if (parentEmail.trim() && !EMAIL_RE.test(parentEmail.trim())) return "Please enter a valid parent/guardian email address.";
        if (!parentMobile.trim()) return "Parent/guardian mobile number is required.";
        if (parentMobile.trim() && !MOBILE_RE.test(parentMobile.trim())) return "Mobile number must be exactly 11 digits (e.g. 09171234567).";
      }
      if (isEdit) {
        if (!parentEditFirstName.trim()) return "Parent/guardian first name is required.";
        if (parentEditFirstName.trim() && !NAME_RE.test(parentEditFirstName.trim())) return "Parent/guardian first name contains invalid characters.";
        if (!parentEditLastName.trim())  return "Parent/guardian last name is required.";
        if (parentEditLastName.trim() && !NAME_RE.test(parentEditLastName.trim())) return "Parent/guardian last name contains invalid characters.";
        if (parentEditMiddleName.trim() && !NAME_RE.test(parentEditMiddleName.trim())) return "Parent/guardian middle name contains invalid characters.";
        if (parentSuffix === 'Other' && !parentCustomSuffix.trim()) return "Please enter a custom suffix for the parent/guardian.";
        if (!parentEditEmail.trim()) return "Parent/guardian email is required.";
        if (parentEditEmail.trim() && !EMAIL_RE.test(parentEditEmail.trim())) return "Please enter a valid parent/guardian email address.";
        // Skip mobile validation when linking to an existing parent — no new
        // account is being created, so the backend doesn't use the mobile value.
        // existingParentMatch is always an active parent (allParents filters by
        // role === 'parent' && !deletedAt), so never block — let the backend
        // reject incompatible accounts (teacher/admin/archived) with 409.
        if (!existingParentMatch) {
          if (!parentEditMobile.trim()) return "Parent/guardian mobile number is required.";
          if (parentEditMobile.trim() && !MOBILE_RE.test(parentEditMobile.trim())) return "Mobile number must be exactly 11 digits (e.g. 09171234567).";
        }
      }
    }
    return null;
  };

  const handleStep1Submit = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    if (isEdit) {
      setPendingPayload(buildPayload());
      const editedParentName = [parentEditFirstName, parentEditMiddleName, parentEditLastName].map((s) => s.trim()).filter(Boolean).join(" ");
      const effectiveParentSuffix = parentSuffix === 'Other' ? parentCustomSuffix.trim() : parentSuffix;
      // When the typed email matches an existing active parent (re-linking),
      // don't send a parent UPDATE — the linking is handled by the student's
      // own PUT payload above. Only queue a parent update when the admin is
      // editing the already-linked parent's own name/mobile (same email).
      if (freshParent && !existingParentMatch && (
        editedParentName                          !== freshParent.name ||
        parentEditEmail.trim()                    !== freshParent.email ||
        parentEditMobile.trim()                   !== (freshParent.mobileNumber ?? "") ||
        effectiveParentSuffix                     !== (freshParent.suffix ?? "") ||
        guardianRel                               !== (freshParent.guardianRelationship ?? "parent")
      )) {
        setPendingParentPayload({
          name:                 editedParentName,
          email:                parentEditEmail.trim(),
          mobileNumber:         parentEditMobile.trim() || null,
          suffix:               effectiveParentSuffix || null,
          guardianRelationship: guardianRel,
        });
      } else {
        setPendingParentPayload(null);
      }
      setStep(2);
      setError("");
    } else {
      handleCreate();
    }
  };

  const handleCreate = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await api.post("/users", buildPayload());
      let creds = null;
      if (isStudentForm && result.parent && result.parentTempPassword) {
        creds = {
          name:         result.parent.name,
          roleLabel:    guardianRel === "guardian" ? "Guardian" : "Parent",
          email:        result.parent.email,
          tempPassword: result.parentTempPassword,
        };
      } else if (!isStudentForm && result.tempPassword) {
        creds = {
          name:         result.user.name,
          roleLabel:    displayRole(result.user.role),
          email:        result.user.email,
          tempPassword: result.tempPassword,
        };
      }
      onDone(creds);
    } catch (err) {
      if (err instanceof ApiError && err.code === "PARENT_ARCHIVED") {
        setArchivedParent({ name: err.extra?.archivedParentName ?? "This account" });
      } else {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    if (!adminPwd) { setError("Please enter your password."); return; }
    if (saving) return;
    setSaving(true);
    try {
      const result = await api.put(`/users/${user._id}`, { ...pendingPayload, adminPassword: adminPwd });
      if (pendingParentPayload && freshParent) {
        await api.put(`/users/${freshParent._id}`, { ...pendingParentPayload, adminPassword: adminPwd });
      }
      toast.success("Account updated.");
      // If the backend created a new parent account, surface the credentials.
      let creds = null;
      if (result?.parentTempPassword && result?.parent) {
        creds = {
          name:         result.parent.name,
          roleLabel:    "Parent / Guardian",
          email:        result.parent.email,
          tempPassword: result.parentTempPassword,
        };
      }
      onDone(creds);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 2: admin password confirmation ──────────────────────────────────

  if (step === 2) {
    return (
      <form onSubmit={handleStep2Submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter your admin password to confirm changes to{" "}
          <span className="font-semibold text-foreground">{user?.name}</span>.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-pwd">Your current password</Label>
          <div className="relative">
            <Input
              id="confirm-pwd"
              type={showPwd ? "text" : "password"}
              value={adminPwd}
              onChange={(e) => { setAdminPwd(e.target.value); setError(""); }}
              placeholder="Enter your password"
              className="h-11 pr-10"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" disabled={saving}
            onClick={() => { setStep(1); setError(""); setAdminPwd(""); }}>
            Back
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <><Loader2 className="size-4 animate-spin" />Saving…</> : "Confirm & Save"}
          </Button>
        </div>
      </form>
    );
  }

  // ── Step 1: form ─────────────────────────────────────────────────────────

  const lastEdited = isEdit && freshUser?.updatedBy
    ? `Last edited by ${freshUser.updatedBy.name} on ${fmtDate(freshUser.updatedAt)}.`
    : null;

  return (
    <form onSubmit={handleStep1Submit} className="space-y-0">
      {lastEdited && (
        <p className="mb-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{lastEdited}</p>
      )}

      {/* ── Student overview (edit only) ── */}
      {isStudentForm && isEdit && (
        <div className="mb-5">
          <StudentOverviewPanel
            user={freshUser ?? user}
            parent={freshParent}
            section={selectedSection}
            schoolYear={activeSchoolYear}
          />
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* STUDENT FORM                                                         */}
      {/* ──────────────────────────────────────────────────────────────────── */}

      {isStudentForm ? (
        <>
          {/* Section 1: Student Information */}
          <FormSection icon={UserIcon} title="Student Information">
            <div className="space-y-1.5">
              <Label htmlFor="u-studnum">
                Student Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="u-studnum"
                value={studentNumber}
                onChange={(e) => { setStudentNumber(e.target.value); setError(""); chkStuNum(e.target.value, 'studentNumber', originalStudentNumber); }}
                placeholder="e.g. 20240001"
                className="h-11"
              />
              {fieldErrors.studentNumber && <p className="text-xs text-destructive">{fieldErrors.studentNumber}</p>}
            </div>

            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr 110px' }}>
              <div className="space-y-1.5">
                <Label htmlFor="u-first">
                  First name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="u-first"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setError(""); chkName(e.target.value, 'firstName'); }}
                  onBlur={(e) => setFirstName(capitalizeName(e.target.value))}
                  placeholder="Juan"
                  className="h-11"
                />
                {fieldErrors.firstName && <p className="text-xs text-destructive">{fieldErrors.firstName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-middle">
                  Middle name{" "}
                  <span className="text-xs font-normal text-muted-foreground">(opt.)</span>
                </Label>
                <Input
                  id="u-middle"
                  value={middleName}
                  onChange={(e) => { setMiddleName(e.target.value); chkName(e.target.value, 'middleName'); }}
                  onBlur={(e) => setMiddleName(capitalizeName(e.target.value))}
                  placeholder="Santos"
                  className="h-11"
                />
                {fieldErrors.middleName && <p className="text-xs text-destructive">{fieldErrors.middleName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-last">
                  Last name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="u-last"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setError(""); chkName(e.target.value, 'lastName'); }}
                  onBlur={(e) => setLastName(capitalizeName(e.target.value))}
                  placeholder="Dela Cruz"
                  className="h-11"
                />
                {fieldErrors.lastName && <p className="text-xs text-destructive">{fieldErrors.lastName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-suffix">
                  Suffix{" "}
                  <span className="text-xs font-normal text-muted-foreground">(opt.)</span>
                </Label>
                <Select id="u-suffix" value={suffix} onChange={(e) => setSuffix(e.target.value)} className="h-11">
                  {SUFFIX_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt || "None"}</option>
                  ))}
                </Select>
                {suffix === 'Other' && (
                  <Input
                    value={customSuffix}
                    onChange={(e) => setCustomSuffix(e.target.value)}
                    placeholder="Enter suffix"
                    className="h-11 mt-1"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-gender">Gender <span className="text-destructive">*</span></Label>
              <Select id="u-gender" value={gender} onChange={(e) => { setGender(e.target.value); setError(""); }} className="h-11 max-w-xs">
                <option value="">— Select gender —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
            </div>
          </FormSection>

          {/* Section 2: Parent / Guardian (edit) */}
          {isEdit && (
            <>
              <div className="my-5 border-t border-border" />

              <FormSection icon={UsersIcon} title="Parent / Guardian Information" headerRight={<RelationshipToggle value={guardianRel} onChange={setGuardianRel} />}>
                {!freshParent && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                    No parent / guardian account is linked. Fill in the fields below to create one.
                  </p>
                )}
                <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr 110px' }}>
                  <div className="space-y-1.5">
                    <Label htmlFor="pe-first">
                      First name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="pe-first"
                      value={parentEditFirstName}
                      onChange={(e) => { setParentEditFirstName(e.target.value); setError(""); chkName(e.target.value, 'peFirst'); }}
                      onBlur={(e) => setParentEditFirstName(capitalizeName(e.target.value))}
                      placeholder="Maria"
                      className="h-11"
                    />
                    {fieldErrors.peFirst && <p className="text-xs text-destructive">{fieldErrors.peFirst}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pe-middle">
                      Middle name{" "}
                      <span className="text-xs font-normal text-muted-foreground">(opt.)</span>
                    </Label>
                    <Input
                      id="pe-middle"
                      value={parentEditMiddleName}
                      onChange={(e) => { setParentEditMiddleName(e.target.value); chkName(e.target.value, 'peMiddle'); }}
                      onBlur={(e) => setParentEditMiddleName(capitalizeName(e.target.value))}
                      placeholder="Santos"
                      className="h-11"
                    />
                    {fieldErrors.peMiddle && <p className="text-xs text-destructive">{fieldErrors.peMiddle}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pe-last">
                      Last name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="pe-last"
                      value={parentEditLastName}
                      onChange={(e) => { setParentEditLastName(e.target.value); setError(""); chkName(e.target.value, 'peLast'); }}
                      onBlur={(e) => setParentEditLastName(capitalizeName(e.target.value))}
                      placeholder="Dela Cruz"
                      className="h-11"
                    />
                    {fieldErrors.peLast && <p className="text-xs text-destructive">{fieldErrors.peLast}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pe-suffix">
                      Suffix{" "}
                      <span className="text-xs font-normal text-muted-foreground">(opt.)</span>
                    </Label>
                    <Select id="pe-suffix" value={parentSuffix} onChange={(e) => setParentSuffix(e.target.value)} className="h-11">
                      {SUFFIX_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt || "None"}</option>
                      ))}
                    </Select>
                    {parentSuffix === 'Other' && (
                      <Input
                        value={parentCustomSuffix}
                        onChange={(e) => setParentCustomSuffix(e.target.value)}
                        placeholder="Enter suffix"
                        className="h-11 mt-1"
                      />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pe-email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="pe-email"
                      type="email"
                      value={parentEditEmail}
                      onChange={(e) => { setParentEditEmail(e.target.value); setError(""); chkEmail(e.target.value, 'peEmail'); }}
                      placeholder="parent@gmail.com"
                      className="h-11"
                    />
                    {fieldErrors.peEmail && <p className="text-xs text-destructive">{fieldErrors.peEmail}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pe-mobile">
                      Mobile Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="pe-mobile"
                      type="tel"
                      value={parentEditMobile}
                      onChange={(e) => { setParentEditMobile(e.target.value); setError(""); chkMobile(e.target.value, 'peMobile'); }}
                      placeholder="e.g. 09171234567"
                      className="h-11"
                    />
                    {fieldErrors.peMobile && <p className="text-xs text-destructive">{fieldErrors.peMobile}</p>}
                  </div>
                </div>

                {existingParentMatch && !freshParent ? (
                  // Sibling-linking: no parent yet, email matches an existing active parent.
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                    <span className="font-semibold">Existing account found.</span>{" "}
                    This student will be linked to{" "}
                    <span className="font-semibold">{existingParentMatch.name}</span>&apos;s
                    existing parent account — no new account will be created.
                  </p>
                ) : existingParentMatch && freshParent ? (
                  // Already has a linked parent; typed email belongs to a different account.
                  <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
                    <span className="font-semibold">Existing account detected.</span>{" "}
                    This email already belongs to <span className="font-semibold">{existingParentMatch.name}</span>
                    {existingParentMatch.childName ? (
                      <>, already linked to <span className="font-semibold">{existingParentMatch.childName}</span></>
                    ) : null}
                    . Use a different email, or leave this student&apos;s original parent email unchanged.
                  </p>
                ) : null}
              </FormSection>
            </>
          )}

          {/* Section 2: Parent / Guardian (create only) */}
          {!isEdit && (
            <>
              <div className="my-5 border-t border-border" />

              <FormSection
                icon={UsersIcon}
                title="Parent / Guardian Information"
                headerRight={<RelationshipToggle value={guardianRel} onChange={setGuardianRel} />}
              >
                <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr 110px' }}>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-first">
                      First name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="p-first"
                      value={parentFirstName}
                      onChange={(e) => { setParentFirstName(e.target.value); setError(""); chkName(e.target.value, 'pFirst'); }}
                      onBlur={(e) => setParentFirstName(capitalizeName(e.target.value))}
                      placeholder="Maria"
                      className="h-11"
                    />
                    {fieldErrors.pFirst && <p className="text-xs text-destructive">{fieldErrors.pFirst}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-middle">
                      Middle name{" "}
                      <span className="text-xs font-normal text-muted-foreground">(opt.)</span>
                    </Label>
                    <Input
                      id="p-middle"
                      value={parentMiddleName}
                      onChange={(e) => { setParentMiddleName(e.target.value); chkName(e.target.value, 'pMiddle'); }}
                      onBlur={(e) => setParentMiddleName(capitalizeName(e.target.value))}
                      placeholder="Santos"
                      className="h-11"
                    />
                    {fieldErrors.pMiddle && <p className="text-xs text-destructive">{fieldErrors.pMiddle}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-last">
                      Last name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="p-last"
                      value={parentLastName}
                      onChange={(e) => { setParentLastName(e.target.value); setError(""); chkName(e.target.value, 'pLast'); }}
                      onBlur={(e) => setParentLastName(capitalizeName(e.target.value))}
                      placeholder="Dela Cruz"
                      className="h-11"
                    />
                    {fieldErrors.pLast && <p className="text-xs text-destructive">{fieldErrors.pLast}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-suffix">
                      Suffix{" "}
                      <span className="text-xs font-normal text-muted-foreground">(opt.)</span>
                    </Label>
                    <Select id="p-suffix" value={parentSuffix} onChange={(e) => setParentSuffix(e.target.value)} className="h-11">
                      {SUFFIX_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt || "None"}</option>
                      ))}
                    </Select>
                    {parentSuffix === 'Other' && (
                      <Input
                        value={parentCustomSuffix}
                        onChange={(e) => setParentCustomSuffix(e.target.value)}
                        placeholder="Enter suffix"
                        className="h-11 mt-1"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="p-email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="p-email"
                      type="email"
                      value={parentEmail}
                      onChange={(e) => { setParentEmail(e.target.value); setError(""); setArchivedParent(null); chkEmail(e.target.value, 'pEmail'); }}
                      placeholder="parent@gmail.com"
                      className="h-11"
                    />
                    {fieldErrors.pEmail && <p className="text-xs text-destructive">{fieldErrors.pEmail}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-mobile">
                      Mobile Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="p-mobile"
                      type="tel"
                      value={parentMobile}
                      onChange={(e) => { setParentMobile(e.target.value); setError(""); chkMobile(e.target.value, 'pMobile'); }}
                      placeholder="e.g. 09171234567"
                      className="h-11"
                    />
                    {fieldErrors.pMobile && <p className="text-xs text-destructive">{fieldErrors.pMobile}</p>}
                  </div>
                </div>

                {existingParentMatch ? (
                  <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
                    <span className="font-semibold">Existing account detected.</span>{" "}
                    This email belongs to <span className="font-semibold">{existingParentMatch.name}</span>
                    {existingParentMatch.childName ? (
                      <>, already linked to <span className="font-semibold">{existingParentMatch.childName}</span></>
                    ) : null}
                    . The new student will be added to this account — no new password will be generated.
                  </p>
                ) : (
                  <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    A secure temporary password will be generated for the parent account. You&apos;ll see it once after saving — copy or print it to hand over.
                  </p>
                )}
              </FormSection>
            </>
          )}

          {/* Section 3: Academic Assignment */}
          <div className="my-5 border-t border-border" />

          <FormSection icon={GraduationCap} title="Academic Assignment">
            {/* School year (display only) */}
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="size-4 shrink-0" />
                <span>Current School Year</span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {activeSchoolYear?.name ?? "—"}
              </span>
            </div>

            {/* Section */}
            <div className="space-y-1.5">
              <Label htmlFor="u-section">
                Section{" "}
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Select
                id="u-section"
                value={studentSectionId}
                onChange={(e) => setStudentSectionId(e.target.value)}
                className="h-11"
              >
                <option value="">No Section Assigned</option>
                {sectionEntities.map((s) => (
                  <option key={s._id} value={s._id}>{sectionEntityDisplay(s)}</option>
                ))}
              </Select>

              {/* Grade level derived from selected section */}
              {selectedSection?.gradeLevel && (
                <p className="text-xs text-muted-foreground">
                  Grade Level:{" "}
                  <span className="font-medium text-foreground">{selectedSection.gradeLevel}</span>
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Students may be assigned to a section later from the Sections module.
              </p>
            </div>
          </FormSection>
        </>
      ) : (

        /* ── EMPLOYEE FORM ── */
        <>
          <div className="space-y-4">
            {/* Employee Number — full width, required on create */}
            <div className="space-y-1.5">
              <Label htmlFor="u-empnum">
                Employee No. <span className="text-destructive">*</span>
              </Label>
              <Input
                id="u-empnum"
                value={employeeNumber}
                onChange={(e) => {
                  setEmployeeNumber(e.target.value);
                  setError("");
                  chkStuNum(e.target.value, 'employeeNumber', originalEmployeeNumber);
                }}
                className="h-11"
              />
              {fieldErrors.employeeNumber && <p className="text-xs text-destructive">{fieldErrors.employeeNumber}</p>}
            </div>

            {/* Name row: First | Middle | Last | Suffix */}
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr 110px' }}>
              <div className="space-y-1.5">
                <Label htmlFor="u-first">
                  First name <span className="text-destructive">*</span>
                </Label>
                <Input id="u-first" value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setError(""); chkName(e.target.value, 'firstName'); }}
                  onBlur={(e) => setFirstName(capitalizeName(e.target.value))}
                  className="h-11" />
                {fieldErrors.firstName && <p className="text-xs text-destructive">{fieldErrors.firstName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-middle">
                  Middle name{" "}
                  <span className="text-xs font-normal text-muted-foreground">(opt.)</span>
                </Label>
                <Input id="u-middle" value={middleName}
                  onChange={(e) => { setMiddleName(e.target.value); chkName(e.target.value, 'middleName'); }}
                  onBlur={(e) => setMiddleName(capitalizeName(e.target.value))}
                  className="h-11" />
                {fieldErrors.middleName && <p className="text-xs text-destructive">{fieldErrors.middleName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-last">
                  Last name <span className="text-destructive">*</span>
                </Label>
                <Input id="u-last" value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setError(""); chkName(e.target.value, 'lastName'); }}
                  onBlur={(e) => setLastName(capitalizeName(e.target.value))}
                  className="h-11" />
                {fieldErrors.lastName && <p className="text-xs text-destructive">{fieldErrors.lastName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-emp-suffix">
                  Suffix{" "}
                  <span className="text-xs font-normal text-muted-foreground">(opt.)</span>
                </Label>
                <Select id="u-emp-suffix" value={suffix} onChange={(e) => setSuffix(e.target.value)} className="h-11">
                  {SUFFIX_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt || "None"}</option>
                  ))}
                </Select>
                {suffix === 'Other' && (
                  <Input
                    value={customSuffix}
                    onChange={(e) => setCustomSuffix(e.target.value)}
                    placeholder="Enter suffix"
                    className="h-11 mt-1"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-gender">Gender <span className="text-destructive">*</span></Label>
              <Select id="u-gender" value={gender} onChange={(e) => { setGender(e.target.value); setError(""); }} className="h-11 w-40">
                <option value="">— Select —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input id="u-email" type="email" value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); chkEmail(e.target.value, 'email'); }}
                className="h-11" />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-role">Role</Label>
              <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value)} className="h-11">
                {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </div>

            {!isEdit && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                A secure temporary password will be generated automatically. You&apos;ll see it once after saving — copy or print it to hand over.
              </p>
            )}
          </div>
        </>
      )}

      {archivedParent && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-700 dark:bg-amber-950/40">
          <p className="font-semibold text-amber-800 dark:text-amber-300">
            This parent/guardian account is archived.
          </p>
          <p className="mt-1 text-amber-700 dark:text-amber-400">
            <span className="font-medium">{archivedParent.name}</span> already has an account.
            Reactivate it and link this new student?
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setArchivedParent(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleCreate} disabled={saving}>
              {saving
                ? <><Loader2 className="size-4 animate-spin" />Reactivating…</>
                : "Reactivate & Link"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-xs text-destructive">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onDone(null)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !!archivedParent}>
          {saving
            ? <><Loader2 className="size-4 animate-spin" />{isEdit ? "Saving…" : "Adding…"}</>
            : isEdit ? "Save changes" : "Add"}
        </Button>
      </div>
    </form>
  );
}
