import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusLabel, statusTone } from "@/lib/status-config";

/** Page title + subtitle, with optional actions on the right. */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Compact stat card for dashboard overviews. */
export function StatCard({ icon: Icon, label, value, tone = "primary" }) {
  const toneClass =
    {
      primary: "bg-primary/10 text-primary",
      success: "bg-emerald-100 text-emerald-700",
      warning: "bg-amber-100 text-amber-700",
      danger: "bg-red-100 text-red-700",
      info: "bg-sky-100 text-sky-700",
    }[tone] ?? "bg-primary/10 text-primary";

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        {Icon && (
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${toneClass}`}
          >
            <Icon className="size-5" />
          </span>
        )}
        <div className="leading-tight">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Maps any status/priority value (API key or display string) to a colored Badge. */
export function StatusBadge({ value }) {
  return <Badge tone={statusTone(value)}>{statusLabel(value)}</Badge>;
}

/** Render one cell's content, shared by the table and the mobile cards. */
function renderCell(col, row) {
  if (col.render) return col.render(row);
  if (col.badge) return <StatusBadge value={row[col.key]} />;
  return <span className="text-foreground/90">{row[col.key]}</span>;
}

/**
 * Responsive table: a real table on `md+` screens, and a stacked card list on
 * phones (each row becomes a card — first column is the title, the rest are
 * label/value rows, and unlabeled columns like action buttons go full-width).
 * `columns`: [{ key, label, badge?: bool, render?, className? }]
 * `rows`: array of objects keyed by column.key
 */
export function DataTable({ columns, rows, empty = "No records found." }) {
  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto rounded-2xl bg-card shadow-sm ring-1 ring-black/5 md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="px-4 py-3 font-medium text-muted-foreground"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${c.className ?? ""}`}>
                      {renderCell(c, row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
            {empty}
          </div>
        ) : (
          rows.map((row, i) => (
            <div
              key={row.id ?? i}
              className="space-y-2 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/5"
            >
              {columns.map((c, ci) => {
                const content = renderCell(c, row);
                // First column = card title.
                if (ci === 0) {
                  return (
                    <div key={c.key} className="font-semibold text-foreground">
                      {content}
                    </div>
                  );
                }
                // Unlabeled columns (action buttons, etc.) — full width.
                if (!c.label) {
                  return (
                    <div key={c.key} className="pt-1">
                      {content}
                    </div>
                  );
                }
                // Everything else — label / value row.
                return (
                  <div
                    key={c.key}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {c.label}
                    </span>
                    <span className="min-w-0 text-right">{content}</span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </>
  );
}

/** Friendly placeholder for sections that aren't wired up yet. */
export function Placeholder({ icon: Icon, title, description }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
        {Icon && <Icon className="size-9 text-muted-foreground/40" />}
        <p className="font-medium text-foreground">{title}</p>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
