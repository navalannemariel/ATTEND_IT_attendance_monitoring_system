/**
 * Canonical attendance-source configuration.
 *
 * Single source of truth for labels, tones, and icon names used by SourceBadge
 * and any other component that needs to display an attendance source.
 *
 * Tones are intentionally muted (not overlapping with Present / Late / Absent /
 * Excused) so SourceBadge reads as secondary context beside a StatusBadge.
 *
 * Icon names reference Lucide icons — resolved inside source-badge.jsx.
 */
export const SOURCE_CONFIG = {
  gate_scan: { label: "Gate Scan", icon: "ScanLine", tone: "teal"   },
  room_scan: { label: "Room Scan", icon: "Camera",   tone: "violet" },
  manual:    { label: "Manual",    icon: "PenLine",  tone: "slate"  },
};

export function sourceLabel(value) {
  return SOURCE_CONFIG[value]?.label ?? value ?? "—";
}

export function sourceTone(value) {
  return SOURCE_CONFIG[value]?.tone ?? "slate";
}

export function sourceIcon(value) {
  return SOURCE_CONFIG[value]?.icon ?? "PenLine";
}
