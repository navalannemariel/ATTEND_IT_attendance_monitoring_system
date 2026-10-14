"use client";

import { useState } from "react";
import { CheckCircle2, CalendarX, RefreshCw } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const OUTCOME_OPTIONS = [
  { value: "held",        label: "Conference was held",     icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 ring-emerald-200" },
  { value: "noshow",      label: "Parent did not show up",  icon: CalendarX,    color: "text-red-600 bg-red-50 ring-red-200" },
  { value: "rescheduled", label: "Needs to be rescheduled", icon: RefreshCw,    color: "text-amber-600 bg-amber-50 ring-amber-200" },
];

export const CASE_ACTION_OPTIONS = [
  { value: "close",    label: "Close the case — concern resolved" },
  { value: "monitor",  label: "Continue monitoring" },
  { value: "followup", label: "Schedule a follow-up conference" },
];

/**
 * Shared "Conference outcome" modal used by:
 *  - Guidance Dashboard (Today's Schedule)
 *  - Guidance Conferences page
 *  - Guidance Student Profile
 *
 * Props:
 *  conference – the conference object; must have _id, date, time, and optionally
 *               .case (populated or ObjectId) to decide whether to show case actions,
 *               and .parent / .parentUser.name for the display header.
 *  open       – boolean
 *  onClose    – () => void
 *  onSave     – ({ outcomeType, note, caseAction }) => void
 *
 * The caller is responsible for calling PATCH /api/conferences/:id/complete with
 * { outcomeType, outcomeNote, caseAction } — the backend handles Case and Referral
 * updates atomically.
 */
export function MarkDoneModal({ conference, open, onClose, onSave }) {
  const [outcomeType, setOutcomeType] = useState("held");
  const [note,        setNote]        = useState("");
  const [caseAction,  setCaseAction]  = useState("monitor");

  // Show case actions only when the conference has a linked case and outcome is "held".
  // The backend also enforces this — noshow never closes a case.
  const hasLinkedCase = !!conference?.case;
  const showCaseActions = hasLinkedCase && outcomeType === "held";

  function handleSave() {
    onSave({
      outcomeType,
      note,
      caseAction: showCaseActions ? caseAction : null,
    });
    // Reset for next open
    setOutcomeType("held");
    setNote("");
    setCaseAction("monitor");
  }

  if (!conference) return null;

  const parentName =
    conference.parent ||
    conference.parentUser?.name ||
    "—";

  return (
    <Modal open={open} onClose={onClose} title="Conference outcome">
      <div className="space-y-5">
        {/* Conference summary */}
        <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-black/5">
          <p className="text-sm font-medium text-foreground">
            {conference.date} · {conference.time}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">With {parentName}</p>
        </div>

        {/* Outcome picker */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">What happened?</p>
          <div className="space-y-2">
            {OUTCOME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setOutcomeType(opt.value)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium ring-1 transition-all",
                  outcomeType === opt.value
                    ? opt.color + " ring-current/30"
                    : "bg-white text-foreground ring-black/10 hover:bg-slate-50"
                )}
              >
                <opt.icon className="size-4 shrink-0" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">
            Notes{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            rows={3}
            placeholder="What was discussed? Any agreements or commitments made?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Case action (only when conference has a linked case and outcome is "held") */}
        {showCaseActions && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">What's next for the case?</p>
            <div className="space-y-1.5">
              {CASE_ACTION_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-black/5 hover:bg-slate-100"
                >
                  <input
                    type="radio"
                    name="caseAction"
                    value={opt.value}
                    checked={caseAction === opt.value}
                    onChange={() => setCaseAction(opt.value)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>
            <CheckCircle2 className="size-4" />Save outcome
          </Button>
        </div>
      </div>
    </Modal>
  );
}
