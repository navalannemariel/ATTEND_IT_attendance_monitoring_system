"use client";

import { useEffect, useState } from "react";

function fmt() {
  const now  = new Date();
  const date = now.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const time = now.toLocaleTimeString(undefined, {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
  return `Today is ${date} — ${time}`;
}

export function LiveDateTime({ className }) {
  // Initialize with "" so server and client agree on the initial render.
  // useState(fmt) would call fmt() on the server, inject a frozen timestamp
  // into the SSR HTML, then fail hydration when the browser's locale/clock
  // differs — leaving the component stuck on the server string and preventing
  // the interval from triggering visible re-renders.
  const [text, setText] = useState("");

  useEffect(() => {
    setText(fmt()); // first tick immediately on mount (client only)
    const id = setInterval(() => setText(fmt()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className={className ?? "text-xs text-muted-foreground"}>
      {text || " " /* non-breaking space holds the line height before first tick */}
    </p>
  );
}
