"use client";

import { useEffect, useRef, useState } from "react";
import {
  Megaphone, Send, Trash2, Loader2, ImagePlus, X,
  Pencil, Bold, Eye, History,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

// ── Image helpers ─────────────────────────────────────────────────────────────

function resizeImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 800, MAX_H = 800;
        let w = img.width, h = img.height;
        const scale = Math.min(MAX_W / w, MAX_H / h, 1);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const result = canvas.toDataURL("image/jpeg", 0.65);
        if (result.length > 3 * 1024 * 1024) {
          reject(new Error("Image is still too large. Please use a smaller photo."));
          return;
        }
        resolve(result);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function stripHtml(html) {
  return (html ?? "").replace(/<[^>]*>/g, "").trim();
}


// ── Rich text editor ──────────────────────────────────────────────────────────


function RichEditor({ editorRef, initialHtml = "", placeholder, singleLine = false, minHeight = 44 }) {
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialHtml;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onKeyDown={(e) => { if (singleLine && e.key === "Enter") e.preventDefault(); }}
      style={{ minHeight }}
      className="w-full rounded-b-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground [&_strong]:font-bold [&_em]:italic [&_u]:underline"
    />
  );
}

function RichToolbar({ editorRef }) {
  const [boldActive, setBoldActive] = useState(false);

  useEffect(() => {
    const update = () => setBoldActive(document.queryCommandState("bold"));
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  const exec = (cmd) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, null);
    setBoldActive(document.queryCommandState("bold"));
  };

  const btnClass = (on) =>
    `rounded p-1.5 transition-colors ${on
      ? "bg-primary/15 text-primary"
      : "text-muted-foreground hover:bg-accent hover:text-foreground"}`;

  return (
    <div className="flex items-center gap-1 rounded-t-md border border-b-0 border-input bg-muted/40 px-2 py-1">
      <button type="button" title="Bold"
        onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}
        className={btnClass(boldActive)}>
        <Bold className="size-3.5" />
      </button>
    </div>
  );
}

// ── Image picker ──────────────────────────────────────────────────────────────

function ImagePicker({ imageUrl, setImageUrl, fileRef, disabled }) {
  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB."); return; }
    try {
      setImageUrl(await resizeImageToBase64(file));
    } catch (err) {
      toast.error(err.message ?? "Could not load image.");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      {imageUrl ? (
        <div className="relative w-full overflow-hidden rounded-lg border">
          <img src={imageUrl} alt="Preview" className="w-full max-h-40 object-contain bg-slate-50" />
          <button type="button"
            onClick={() => { setImageUrl(null); if (fileRef.current) fileRef.current.value = ""; }}
            className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
            aria-label="Remove image">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-6 text-sm text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50">
          <ImagePlus className="size-5" /> Click to upload a photo
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </>
  );
}

// ── Audience badge chips ──────────────────────────────────────────────────────

function AudienceBadges({ audience }) {
  const resolved = audience ?? ["parent", "employee"];
  return (
    <div className="flex flex-wrap gap-1">
      {resolved.includes("parent") && (
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
          Parents
        </span>
      )}
      {resolved.includes("employee") && (
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
          Employees
        </span>
      )}
    </div>
  );
}

// ── Main announcements component ──────────────────────────────────────────────

export function Announcements({ user, twoColumn = false }) {
  const [announcements,  setAnnouncements]  = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [editTarget,     setEditTarget]     = useState(null);
  const [deleting,       setDeleting]       = useState(false);


  // "View past" toggle — employee / principal normal feed
  const [showPast, setShowPast] = useState(false);

  const canPost     = user.role === "admin";
  const isEmployee  = !canPost;

  async function load() {
    try {
      const query = (isEmployee && showPast) ? "/announcements?past=true" : "/announcements";
      const data = await api.get(query);
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch { toast.error("Could not load announcements."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [showPast]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when the tab regains focus so cross-tab/cross-device posts appear.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") { setLoading(true); load(); }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPast]);


  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/announcements/${deleteTarget._id}`);
      toast.success("Announcement removed.");
      setDeleteTarget(null);
      setLoading(true);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setDeleting(false); }
  };

  const handleEdited = () => {
    setEditTarget(null);
    setLoading(true);
    load();
  };

  // ── Main list view ────────────────────────────────────────────────────────────

  // Admin sees only broadcast posts; employees see whatever the API returns.
  const displayList = canPost ? announcements.filter((a) => !a.sectionScope) : announcements;

  const announcementsList = (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Megaphone className="size-4 text-primary" />
        <h2 className="font-heading text-base font-semibold text-foreground">Announcements</h2>
        {!loading && displayList.length > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {displayList.length}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isEmployee && (
            <Button type="button" variant="ghost" size="sm"
              onClick={() => { setLoading(true); setShowPast((v) => !v); }}
              className={cn("gap-1.5 text-xs h-8", showPast && "text-primary")}>
              <History className="size-3.5" />
              {showPast ? "Showing all years" : "View past"}
            </Button>
          )}
        </div>
      </div>

      {showPast && isEmployee && (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-2">
          Showing announcements from all school years.{" "}
          <button
            className="underline hover:text-foreground"
            onClick={() => { setLoading(true); setShowPast(false); }}>
            Back to current year
          </button>
        </p>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : displayList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Megaphone className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No announcements yet.{" "}
              {canPost ? "Post one to get started." : "Check back later."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {displayList.map((a) => (
            <li key={a._id}>
              <Card className="overflow-hidden">
                {a.imageUrl && (
                  <img src={a.imageUrl} alt={stripHtml(a.title)} className="w-full h-auto" />
                )}
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3
                      className="font-heading text-sm font-semibold text-foreground [&_strong]:font-bold [&_em]:italic"
                      dangerouslySetInnerHTML={{ __html: a.title }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Posted by{" "}
                      <span className="font-medium text-foreground/80">
                        {a.postedBy?.name ?? "Admin"}
                      </span>
                      {a.sectionScope && (
                        <>
                          {" · "}
                          <span className="font-medium text-foreground/80">
                            {[a.sectionScope.gradeLevel, a.sectionScope.name].filter(Boolean).join(" — ")}
                          </span>
                        </>
                      )}
                      {" · "}
                      {formatDate(a.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canPost && (
                      <Button type="button" variant="ghost" size="sm"
                        onClick={() => setEditTarget(a)}
                        className="gap-1.5 text-muted-foreground hover:text-primary">
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                    )}
                    {canPost && (
                      <Button type="button" variant="ghost" size="sm"
                        onClick={() => setDeleteTarget(a)}
                        className="gap-1.5 text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className="text-sm text-foreground/90 leading-relaxed [&_strong]:font-bold [&_em]:italic [&_u]:underline"
                    dangerouslySetInnerHTML={{ __html: a.body }}
                  />
                  {!canPost && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      — {a.postedBy?.name ?? "School Administration"}
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const sharedModals = (
    <>
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Announcement">
        <p className="text-sm text-muted-foreground">
          Remove{" "}
          <span className="font-semibold text-foreground">
            "{stripHtml(deleteTarget?.title)}"
          </span>? It will no longer appear for any users.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
            {deleting ? <Loader2 className="size-4 animate-spin" /> : "Remove"}
          </Button>
        </div>
      </Modal>
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Announcement">
        {editTarget && (
          <AnnouncementForm
            key={editTarget._id}
            existing={editTarget}
            onPosted={handleEdited}
          />
        )}
      </Modal>
    </>
  );

  if (twoColumn && canPost) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <AnnouncementForm
              onPosted={() => { setLoading(true); load(); }}
            />
          </div>
          <div>{announcementsList}</div>
        </div>
        {sharedModals}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {canPost && (
        <AnnouncementForm
          onPosted={() => { setLoading(true); load(); }}
        />
      )}
      {announcementsList}
      {sharedModals}
    </div>
  );
}

// ── Shared post / edit form ───────────────────────────────────────────────────

function AnnouncementForm({ onPosted, existing }) {
  const isEdit   = !!existing;
  const titleRef = useRef(null);
  const bodyRef  = useRef(null);
  const fileRef  = useRef(null);

  const [imageUrl,   setImageUrl]   = useState(existing?.imageUrl ?? null);
  const audience = ["parent"];
  const [step,       setStep]       = useState("edit");
  const [preview,    setPreview]    = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePreview = (e) => {
    e.preventDefault();
    const title = titleRef.current?.innerHTML ?? "";
    const body  = bodyRef.current?.innerHTML  ?? "";
    if (!stripHtml(title)) { toast.error("Title is required."); return; }
    if (!stripHtml(body))  { toast.error("Message is required."); return; }
    setPreview({ title, body, imageUrl });
    setStep("preview");
  };

  const handleConfirm = async () => {
    if (submitting || !preview) return;
    setSubmitting(true);
    try {
      const payload = {
        title:    preview.title,
        body:     preview.body,
        tag:      "general",
        imageUrl: preview.imageUrl || null,
        audience,
      };
      const data = isEdit
        ? await api.put(`/announcements/${existing._id}`, payload)
        : await api.post("/announcements", payload);

      onPosted({ ...data, imageUrl: preview.imageUrl || data.imageUrl || null });

      if (!isEdit) {
        if (titleRef.current) titleRef.current.innerHTML = "";
        if (bodyRef.current)  bodyRef.current.innerHTML  = "";
        setImageUrl(null);
        if (fileRef.current) fileRef.current.value = "";
      }
      setStep("edit");
      setPreview(null);
      toast.success(isEdit ? "Announcement updated." : "Announcement posted!");
    } catch (err) {
      toast.error(err.message ?? "Could not save announcement.");
      setStep("edit");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Preview step ─────────────────────────────────────────────────────────
  if (step === "preview" && preview) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-primary" />
            <h2 className="font-heading text-base font-semibold text-foreground">
              Preview
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            This will be posted to all parents.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Card className="overflow-hidden">
            {preview.imageUrl && (
              <img src={preview.imageUrl} alt="Preview" className="w-full h-auto" />
            )}
            <CardHeader>
              <h3
                className="font-heading text-sm font-semibold text-foreground [&_strong]:font-bold [&_em]:italic"
                dangerouslySetInnerHTML={{ __html: preview.title }}
              />
              <p className="text-xs text-muted-foreground">Posted by You · just now</p>
            </CardHeader>
            <CardContent>
              <div
                className="text-sm text-foreground/90 leading-relaxed [&_strong]:font-bold [&_em]:italic [&_u]:underline"
                dangerouslySetInnerHTML={{ __html: preview.body }}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("edit")} disabled={submitting}>
              Back to edit
            </Button>
            <Button onClick={handleConfirm} disabled={submitting}>
              {submitting
                ? <Loader2 className="size-4 animate-spin" />
                : <Send className="size-4" />}
              {isEdit ? "Confirm & Save" : "Confirm & Post"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Edit step — Item 1: Audience is at the TOP ────────────────────────────
  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base font-semibold text-foreground">
          {isEdit ? "Edit Announcement" : "Post an Announcement"}
        </h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePreview} className="space-y-4">

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title <span className="text-destructive">*</span></Label>
            <RichToolbar editorRef={titleRef} />
            <RichEditor
              editorRef={titleRef}
              initialHtml={preview?.title ?? existing?.title ?? ""}
              placeholder="e.g. Faculty meeting this Friday"
              singleLine
              minHeight={44}
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label>Message <span className="text-destructive">*</span></Label>
            <RichToolbar editorRef={bodyRef} />
            <RichEditor
              editorRef={bodyRef}
              initialHtml={preview?.body ?? existing?.body ?? ""}
              placeholder="Write the details of your announcement..."
              minHeight={120}
            />
          </div>

          {/* Image */}
          <div className="space-y-2">
            <Label>Photo <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <ImagePicker imageUrl={imageUrl} setImageUrl={setImageUrl} fileRef={fileRef} disabled={submitting} />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting} className="gap-1.5">
              <Eye className="size-4" />
              Preview
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
