import { cn } from "@/lib/utils"

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger:  "bg-red-100 text-red-700",
  info:    "bg-sky-100 text-sky-700",
  violet:  "bg-violet-50 text-violet-700",
}

function Badge({ className, tone = "neutral", ...props }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        TONES[tone] ?? TONES.neutral,
        className
      )}
      {...props}
    />
  )
}

export { Badge, TONES }
