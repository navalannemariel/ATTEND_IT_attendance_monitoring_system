"use client";

import { useEffect, useState } from "react";
import { CalendarOff, Monitor } from "lucide-react";
import { api } from "@/lib/api";

// Fetches GET /api/calendar/today once on mount.
// Renders nothing on normal school days.
// online_class → violet banner (attendance still tracked).
// suspension / holiday / other → amber banner.
export function NoClassBanner() {
  const [info, setInfo] = useState(null); // null = loading | false = normal | {label,type} = no-class

  useEffect(() => {
    api.get("/calendar/today")
      .then((data) => setInfo(data?.isNoClassDay ? data : false))
      .catch(() => setInfo(false));
  }, []);

  if (!info) return null;

  if (info.type === "online_class") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm dark:border-violet-800 dark:bg-violet-950/40">
        <Monitor className="size-4 shrink-0 text-violet-600 dark:text-violet-400" />
        <span className="font-medium text-violet-800 dark:text-violet-200">
          Online class today — {info.label}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
      <CalendarOff className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="font-medium text-amber-800 dark:text-amber-200">
        No classes today — {info.label}
      </span>
    </div>
  );
}
