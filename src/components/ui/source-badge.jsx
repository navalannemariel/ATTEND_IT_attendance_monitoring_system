import { ScanLine, Camera, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_CONFIG } from "@/lib/source-config";

const ICONS = { ScanLine, Camera, PenLine };

const TONES = {
  teal:   "bg-teal-50   text-teal-600   dark:bg-teal-950/40   dark:text-teal-400",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400",
  slate:  "bg-slate-100 text-slate-500  dark:bg-slate-800     dark:text-slate-400",
};

/**
 * Small badge displaying the attendance source (gate_scan / room_scan / manual).
 * Intentionally muted — should not compete with StatusBadge visually.
 * Renders nothing if value is null/undefined.
 */
export function SourceBadge({ value, className }) {
  if (!value) return null;
  const cfg  = SOURCE_CONFIG[value];
  if (!cfg) return null;

  const Icon = ICONS[cfg.icon] ?? PenLine;
  const tone = TONES[cfg.tone] ?? TONES.slate;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tone,
        className
      )}
    >
      <Icon className="size-3 shrink-0" />
      {cfg.label}
    </span>
  );
}
