"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Send, Loader2, Megaphone, ImagePlus, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/dashboard-ui";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

// ── Image resize helper (same cap as admin composer) ─────────────────────────

function resizeImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let w = img.width, h = img.height;
        const scale = Math.min(MAX / w, MAX / h, 1);
        w = Math.round(w * scale); h = Math.round(h * scale);
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

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function stripHtml(s) { return (s ?? "").replace(/<[^>]*>/g, "").trim(); }

export default function TeacherComposePage() {
  const { user } = useAuth();
  const fileRef     = useRef(null);
  const editFileRef = useRef(null);

  // ── Compose state ─────────────────────────────────────────────────────────
  const [title,      setTitle]      = useState("");
  const [body,       setBody]       = useState("");
  const [imageUrl,   setImageUrl]   = useState(null);
  const [step,       setStep]       = useState("form"); // 'form' | 'preview'
  const [submitting, setSubmitting] = useState(false);

  // ── My posts ──────────────────────────────────────────────────────────────
  const [myPosts,      setMyPosts]      = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // ── Delete flow ───────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  // ── Edit flow ─────────────────────────────────────────────────────────────
  const [editTarget,     setEditTarget]     = useState(null);
  const [editTitle,      setEditTitle]      = useState("");
  const [editBody,       setEditBody]       = useState("");
  const [editImageUrl,   setEditImageUrl]   = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  async function loadMyPosts() {
    try {
      const data = await api.get("/announcements?mine=true");
      setMyPosts(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Could not load your past posts.");
    } finally {
      setPostsLoading(false);
    }
  }

  useEffect(() => { loadMyPosts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Image handlers ────────────────────────────────────────────────────────

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB."); return; }
    try { setImageUrl(await resizeImageToBase64(file)); }
    catch (err) {
      toast.error(err.message ?? "Could not load image.");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleEditImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB."); return; }
    try { setEditImageUrl(await resizeImageToBase64(file)); }
    catch (err) {
      toast.error(err.message ?? "Could not load image.");
      if (editFileRef.current) editFileRef.current.value = "";
    }
  }

  // ── Compose submit ────────────────────────────────────────────────────────

  function handlePreview(e) {
    e.preventDefault();
    if (!title.trim()) { toast.error("Title is required."); return; }
    if (!body.trim())  { toast.error("Message is required."); return; }
    setStep("preview");
  }

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const data = await api.post("/announcements", { title, body, imageUrl: imageUrl || null });
      setMyPosts((prev) => [data, ...prev]);
      setTitle(""); setBody(""); setImageUrl(null);
      if (fileRef.current) fileRef.current.value = "";
      setStep("form");
      toast.success("Posted to your advisory section!");
    } catch (err) {
      toast.error(err.message ?? "Could not post announcement.");
      setStep("form");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/announcements/${deleteTarget._id}`);
      toast.success("Post removed.");
      setMyPosts((prev) => prev.filter((p) => p._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) { toast.error(err.message ?? "Could not remove post."); }
    finally { setDeleting(false); }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  function openEdit(post) {
    setEditTarget(post);
    setEditTitle(stripHtml(post.title));
    setEditBody(stripHtml(post.body));
    setEditImageUrl(post.imageUrl ?? null);
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editTitle.trim()) { toast.error("Title is required."); return; }
    if (!editBody.trim())  { toast.error("Message is required."); return; }
    setEditSubmitting(true);
    try {
      const updated = await api.put(`/announcements/${editTarget._id}`, {
        title: editTitle,
        body:  editBody,
        imageUrl: editImageUrl || null,
      });
      setMyPosts((prev) => prev.map((p) => p._id === updated._id ? updated : p));
      setEditTarget(null);
      toast.success("Post updated.");
    } catch (err) { toast.error(err.message ?? "Could not update post."); }
    finally { setEditSubmitting(false); }
  }

  // ── Derived section label ─────────────────────────────────────────────────

  const scopedSection = myPosts[0]?.sectionScope;
  const sectionLabel  = scopedSection
    ? [scopedSection.gradeLevel, scopedSection.name].filter(Boolean).join(" — ")
    : "your advisory class";

  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Post to Your Section"
        subtitle={`Send updates directly to parents of ${sectionLabel}.`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">

        {/* ── LEFT: Notice + Compose/Preview (top on mobile, left on desktop) */}
        <div className="order-1 space-y-4 lg:sticky lg:top-24 lg:self-start">

          <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm dark:border-sky-800 dark:bg-sky-950/40">
            <Megaphone className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
            <p className="text-sky-800 dark:text-sky-200">
              This will be posted to parents of your advisory class only — other sections and employees will not see this.
            </p>
          </div>

          {step === "preview" ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Eye className="size-4 text-primary" />
                  <h2 className="font-heading text-base font-semibold text-foreground">Preview</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  This will be posted to parents of {sectionLabel}.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Card className="overflow-hidden">
                  {imageUrl && (
                    <img src={imageUrl} alt="Preview" className="w-full h-auto" />
                  )}
                  <CardHeader>
                    <h3 className="font-heading text-sm font-semibold text-foreground">{title}</h3>
                    <p className="text-xs text-muted-foreground">
                      Posted by {user.name} · just now
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{body}</p>
                  </CardContent>
                </Card>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep("form")} disabled={submitting}>
                    Back to edit
                  </Button>
                  <Button onClick={handleConfirm} disabled={submitting}>
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Confirm & Post
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <h2 className="font-heading text-base font-semibold text-foreground">New Announcement</h2>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePreview} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ann-title">Title <span className="text-destructive">*</span></Label>
                    <Input
                      id="ann-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Reminder: Bring Materials Tomorrow"
                      className="h-11"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ann-body">Message <span className="text-destructive">*</span></Label>
                    <Textarea
                      id="ann-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write the details of your announcement…"
                      rows={5}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Photo <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                    {imageUrl ? (
                      <div className="relative overflow-hidden rounded-lg border">
                        <img src={imageUrl} alt="Preview" className="w-full max-h-40 object-contain bg-slate-50" />
                        <button type="button"
                          onClick={() => { setImageUrl(null); if (fileRef.current) fileRef.current.value = ""; }}
                          className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70">
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-5 text-sm text-muted-foreground transition hover:border-primary hover:text-primary">
                        <ImagePlus className="size-5" /> Click to upload a photo
                      </button>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" className="gap-1.5">
                      <Eye className="size-4" />
                      Preview
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

        </div>

        {/* ── RIGHT: My Posts (below on mobile, right on desktop) ──────────── */}
        <div className="order-2 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            My Posts
          </p>

          {postsLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : myPosts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No posts yet. Write one to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {myPosts.map((a) => (
                <li key={a._id}>
                  <Card className="overflow-hidden">
                    {a.imageUrl && (
                      <img src={a.imageUrl} alt={stripHtml(a.title)} className="w-full h-auto" />
                    )}
                    <CardHeader className="flex-row items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <h3 className="font-heading text-sm font-semibold text-foreground">
                          {stripHtml(a.title)}
                        </h3>
                        <p className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button type="button" variant="ghost" size="sm"
                          onClick={() => openEdit(a)}
                          className="gap-1.5 text-muted-foreground hover:text-primary">
                          <Pencil className="size-3.5" /> Edit
                        </Button>
                        <Button type="button" variant="ghost" size="sm"
                          onClick={() => setDeleteTarget(a)}
                          className="gap-1.5 text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-3.5" /> Delete
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                        {stripHtml(a.body)}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Delete confirmation ────────────────────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Post">
        <p className="text-sm text-muted-foreground">
          Remove <span className="font-semibold text-foreground">"{stripHtml(deleteTarget?.title)}"</span>?
          Parents will no longer see it.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
            {deleting ? <Loader2 className="size-4 animate-spin" /> : "Remove"}
          </Button>
        </div>
      </Modal>

      {/* ── Edit modal ────────────────────────────────────────────────────────── */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Post">
        {editTarget && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Title <span className="text-destructive">*</span></Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-body">Message <span className="text-destructive">*</span></Label>
              <Textarea
                id="edit-body"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={5}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Photo <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
              {editImageUrl ? (
                <div className="relative overflow-hidden rounded-lg border">
                  <img src={editImageUrl} alt="Preview" className="w-full max-h-40 object-contain bg-slate-50" />
                  <button type="button"
                    onClick={() => { setEditImageUrl(null); if (editFileRef.current) editFileRef.current.value = ""; }}
                    className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70">
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => editFileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-5 text-sm text-muted-foreground transition hover:border-primary hover:text-primary">
                  <ImagePlus className="size-5" /> Click to upload a photo
                </button>
              )}
              <input ref={editFileRef} type="file" accept="image/*" className="hidden" onChange={handleEditImageChange} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)} disabled={editSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Confirm & Save
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
