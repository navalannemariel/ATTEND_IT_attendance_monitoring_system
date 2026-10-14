"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function fmtDisplay(value) {
  if (!value) return "—";
  const [h, m] = value.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function to24(h12, ampm) {
  if (ampm === "AM") return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}
function toH12(h24) { return h24 % 12 || 12; }
function fmt24(h24, min) {
  if (h24 === null || min === null) return "";
  return `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

const HOURS   = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const ITEM_H  = 40; // px — height of each list row
const POPUP_H = 300;

function ScrollColumn({ items, selected, onSelect, renderLabel }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) return;
    const idx = items.indexOf(selected);
    if (idx < 0) return;
    // Center the selected item in the viewport
    listRef.current.scrollTop = idx * ITEM_H - (listRef.current.clientHeight / 2) + ITEM_H / 2;
  }, [selected, items]);

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Fade top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-background to-transparent" />
      {/* Fade bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-background to-transparent" />

      <ul
        ref={listRef}
        className="scrollbar-none h-full overflow-y-auto px-2 py-2"
        style={{ scrollBehavior: "smooth" }}
      >
        {items.map((val) => {
          const active = selected === val;
          return (
            <li key={val}>
              <button
                type="button"
                onClick={() => onSelect(val)}
                style={{ height: ITEM_H }}
                className={cn(
                  "flex w-full items-center justify-center rounded-xl text-sm font-semibold transition-all duration-100",
                  active
                    ? "bg-primary text-primary-foreground scale-105 shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {renderLabel(val)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TimePicker({ id, value, onChange, disabled }) {
  const [open,   setOpen]   = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [ampm,   setAmpm]   = useState("AM");
  const [selH12, setSelH12] = useState(null);
  const [selMin, setSelMin] = useState(null);
  const wrapRef    = useRef(null);
  const triggerRef = useRef(null);

  function sync(val) {
    if (!val) { setSelH12(null); setSelMin(null); setAmpm("AM"); return; }
    const [h, m] = val.split(":").map(Number);
    setSelH12(isNaN(h) ? null : toH12(h));
    setSelMin(isNaN(m)  ? null : m);
    setAmpm((!isNaN(h) && h >= 12) ? "PM" : "AM");
  }

  function openPicker() {
    if (disabled) return;
    sync(value);
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setOpenUp(window.innerHeight - rect.bottom < POPUP_H + 16);
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function commit(h12, min, period) {
    if (h12 === null || min === null) return;
    onChange(fmt24(to24(h12, period), min));
  }

  function onHour(h12) {
    setSelH12(h12);
    commit(h12, selMin, ampm);
  }
  function onMinute(min) {
    setSelMin(min);
    commit(selH12, min, ampm);
    setOpen(false);
  }
  function onAmpm(p) {
    setAmpm(p);
    commit(selH12, selMin, p);
  }

  return (
    <div className="relative" ref={wrapRef}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className={cn(
          "flex h-11 w-44 items-center rounded-xl border border-input bg-background px-3 text-sm font-medium",
          "ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          !value && "text-muted-foreground",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {fmtDisplay(value)}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 z-50 w-56 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          style={openUp
            ? { bottom: "calc(100% + 8px)" }
            : { top:    "calc(100% + 8px)" }}
        >
          {/* AM / PM strip */}
          <div className="flex border-b border-border">
            {["AM", "PM"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onAmpm(p)}
                className={cn(
                  "flex-1 py-2.5 text-xs font-bold tracking-widest uppercase transition-colors",
                  ampm === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Column labels */}
          <div className="flex border-b border-border/50">
            <div className="flex-1 py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Hour
            </div>
            <div className="w-px bg-border/50" />
            <div className="flex-1 py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Min
            </div>
          </div>

          {/* Scroll columns */}
          <div className="flex" style={{ height: POPUP_H - 80 }}>
            <ScrollColumn
              items={HOURS}
              selected={selH12}
              onSelect={onHour}
              renderLabel={(h) => h}
            />
            <div className="w-px self-stretch bg-border/50" />
            <ScrollColumn
              items={MINUTES}
              selected={selMin}
              onSelect={onMinute}
              renderLabel={(m) => String(m).padStart(2, "0")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
