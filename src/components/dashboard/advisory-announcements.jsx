"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Loader2, Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function stripHtml(html) {
  return (html ?? "").replace(/<[^>]*>/g, "").trim();
}

export function AdvisoryAnnouncements() {
  const [sections,     setSections]     = useState([]);
  const [sectionPosts, setSectionPosts] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/sections"),
      api.get("/announcements?scope=section"),
    ])
      .then(([secs, posts]) => {
        setSections(Array.isArray(secs) ? secs : []);
        setSectionPosts(Array.isArray(posts) ? posts : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const postsBySection = useMemo(() => {
    const map = {};
    for (const p of sectionPosts) {
      const sid = String(p.sectionScope?._id ?? p.sectionScope ?? "");
      if (!sid) continue;
      (map[sid] ??= []).push(p);
    }
    return map;
  }, [sectionPosts]);

  // ── Section detail view ────────────────────────────────────────────────────
  if (selected) {
    const posts = postsBySection[String(selected._id)] ?? [];
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          All sections
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
            {selected.displayName ?? [selected.gradeLevel, selected.name].filter(Boolean).join(" – ")}
          </span>
          {selected.adviser?.name && (
            <span className="text-sm text-muted-foreground">
              Adviser:{" "}
              <span className="font-medium text-foreground/80">{selected.adviser.name}</span>
            </span>
          )}
        </div>

        {posts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <Megaphone className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No posts yet for this section.</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {posts.map((a) => (
              <li key={a._id}>
                <Card className="overflow-hidden">
                  {a.imageUrl && (
                    <img src={a.imageUrl} alt={stripHtml(a.title)} className="w-full h-auto" />
                  )}
                  <CardHeader>
                    <div className="space-y-1">
                      <h3
                        className="font-heading text-sm font-semibold text-foreground [&_strong]:font-bold [&_em]:italic"
                        dangerouslySetInnerHTML={{ __html: a.title }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Posted by{" "}
                        <span className="font-medium text-foreground/80">
                          {a.postedBy?.name ?? "Teacher"}
                        </span>
                        {" · "}{formatDate(a.createdAt)}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="text-sm text-foreground/90 leading-relaxed [&_strong]:font-bold [&_em]:italic [&_u]:underline"
                      dangerouslySetInnerHTML={{ __html: a.body }}
                    />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ── Section list view ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-card">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : sections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No sections found for the active school year.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sections.map((sec) => {
            const postCount = (postsBySection[String(sec._id)] ?? []).length;
            return (
              <button
                key={sec._id}
                type="button"
                onClick={() => setSelected(sec)}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40 hover:border-primary/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <BookOpen className="size-4 shrink-0 text-teal-600 dark:text-teal-400" />
                  <span className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    postCount > 0
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {postCount} post{postCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    {sec.displayName ?? [sec.gradeLevel, sec.name].filter(Boolean).join(" – ")}
                  </p>
                  {sec.adviser?.name && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {sec.adviser.name}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
