"use client"

import { useEffect } from "react"
import { X } from "lucide-react"

const SIZE_CLS = {
  md:  "max-w-md",
  lg:  "max-w-2xl",
  xl:  "max-w-3xl",
  "2xl": "max-w-5xl",
}

/** Minimal accessible-ish modal dialog (no dependencies). */
function Modal({ open, onClose, title, children, size = "md" }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex w-full ${SIZE_CLS[size] ?? SIZE_CLS.md} flex-col rounded-2xl bg-white shadow-xl max-h-[calc(100vh-2rem)]`}
      >
        {/* Pinned header */}
        <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 pb-6">
          {children}
        </div>
      </div>
    </div>
  )
}

export { Modal }
