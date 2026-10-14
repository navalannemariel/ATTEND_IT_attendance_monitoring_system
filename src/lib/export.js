// Dependency-free export helpers.
// - Excel: build an HTML table and download it as a .xls file (Excel opens it).
// - PDF: open a styled print window and let the browser "Save as PDF".
//
// `columns` is an array of { key, label }. `rows` is an array of objects.

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildTable(columns, rows) {
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((c) => `<td>${escapeHtml(row[c.key])}</td>`)
          .join("")}</tr>`
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function exportToExcel(filename, columns, rows) {
  if (typeof window === "undefined") return;
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel">` +
    `<head><meta charset="utf-8" /></head><body>` +
    buildTable(columns, rows) +
    `</body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToPdf(title, columns, rows) {
  if (typeof window === "undefined") return;
  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          * { font-family: Arial, Helvetica, sans-serif; }
          h1 { font-size: 18px; color: #8B0029; margin-bottom: 4px; }
          p.meta { color: #6b7280; font-size: 12px; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
          thead th { background: #8B0029; color: #fff; }
          tbody tr:nth-child(even) { background: #f9fafb; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p class="meta">Holy Heart Christian Academy · Generated ${new Date().toLocaleString()}</p>
        ${buildTable(columns, rows)}
        <script>
          window.onload = function () { window.print(); };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}
