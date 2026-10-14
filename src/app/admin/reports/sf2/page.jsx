"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { FileSpreadsheet } from "lucide-react";
import { exportSF2ToXLSX } from "@/lib/exportSF2";
import { PageHeader } from "@/components/dashboard/dashboard-ui";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// ── Month list ────────────────────────────────────────────────────────────────
const MONTHS = [
  { value: 1,  label: "January"   },
  { value: 2,  label: "February"  },
  { value: 3,  label: "March"     },
  { value: 4,  label: "April"     },
  { value: 5,  label: "May"       },
  { value: 6,  label: "June"      },
  { value: 7,  label: "July"      },
  { value: 8,  label: "August"    },
  { value: 9,  label: "September" },
  { value: 10, label: "October"   },
  { value: 11, label: "November"  },
  { value: 12, label: "December"  },
];

// ── Print-window HTML builder ─────────────────────────────────────────────────
function buildPrintHtml(data) {
  const { schoolInfo, schoolYear, section, monthName, calYear, dates, schoolDayCount, students } = data;
  const { male, female } = students;

  const colspan = 3 + dates.length + 2; // No. + LRN + Name + date cols + Absent + Present

  function groupPerDay(group, dateStr) {
    return group.filter((s) => {
      const st = s.daily[dateStr];
      return st === "present" || st === "late";
    }).length;
  }

  function dateHeaderCells() {
    return dates.map((d) => `<th class="col-date">${d.day}</th>`).join("");
  }

  function dowCells() {
    return dates.map((d) => `<th class="col-dow">${d.weekday}</th>`).join("");
  }

  function studentRow(s, idx) {
    const dateCells = dates.map((d) => {
      const status  = s.daily[d.date] || "no_record";
      let cls     = "";
      let content = "";
      if (status === "absent" || status === "excused") cls = "cell-absent";
      else if (status === "ncd")                       cls = "cell-ncd";
      if (status === "present" || status === "late")   content = "&#10003;"; // ✓
      return `<td class="tc ${cls}">${content}</td>`;
    }).join("");

    return `<tr>
      <td class="tc">${idx + 1}</td>
      <td class="tc small">${escHtml(s.studentNumber || "")}</td>
      <td class="name-cell">${escHtml(s.name)}</td>
      ${dateCells}
      <td class="tc total">${s.totalAbsent}</td>
      <td class="tc total">${s.totalPresent}</td>
    </tr>`;
  }

  function totalRow(group, label) {
    const dayCells     = dates.map((d) => `<td class="tc">${groupPerDay(group, d.date) || ""}</td>`).join("");
    const totalAbsent  = group.reduce((acc, s) => acc + s.totalAbsent, 0);
    const totalPresent = group.reduce((acc, s) => acc + s.totalPresent, 0);
    return `<tr class="group-total">
      <td colspan="3" style="text-align:left;padding-left:4px;">${escHtml(label)} &mdash; Total Per Day</td>
      ${dayCells}
      <td class="tc total">${totalAbsent}</td>
      <td class="tc total">${totalPresent}</td>
    </tr>`;
  }

  const maleRowsHtml   = male.map((s, i)   => studentRow(s, i)).join("");
  const femaleRowsHtml = female.map((s, i) => studentRow(s, i)).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SF2 &ndash; ${escHtml(section.gradeLevel || "")} ${escHtml(section.name)} &ndash; ${escHtml(monthName)} ${calYear}</title>
  <style>
    @page { size: A3 landscape; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; }

    /* Title */
    .title-block { text-align: center; margin-bottom: 4px; }
    .sf2-title   { font-size: 11pt; font-weight: bold; }
    .sf2-sub     { font-size: 8pt; }

    /* Info table */
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #000; padding: 2px 3px; vertical-align: middle; }
    .info-table .lbl { font-weight: bold; white-space: nowrap; font-size: 7.5pt; }
    .info-table td   { font-size: 7.5pt; }

    /* Attendance table */
    .att-table thead th { text-align: center; background: #d8d8d8; font-size: 7pt; }
    .col-no    { width: 20px; }
    .col-lrn   { width: 68px; }
    .col-name  { min-width: 130px; }
    .col-date  { width: 18px; }
    .col-dow   { width: 18px; font-size: 6pt; }
    .col-total { width: 28px; }
    .name-cell { padding-left: 3px; font-size: 7.5pt; }
    .small     { font-size: 7pt; }

    /* Cell classes */
    .tc        { text-align: center; }
    .total     { font-weight: bold; }
    .cell-absent { background-color: #ff2020; }
    .cell-ncd    { background-color: #ffff00; }

    /* Group header / total rows */
    .group-header td { background: #b0b0b0; font-weight: bold; font-size: 8pt; padding: 2px 6px; }
    .group-total  td { background: #d4d4d4; font-weight: bold; font-size: 7pt; text-align: center; }

    /* Alternating rows */
    .att-table tbody tr:not(.group-header):not(.group-total):nth-child(even) td { background: #f5f5f5; }
    /* Override even-row bg for colored cells */
    .att-table tbody tr td.cell-absent { background-color: #ff2020 !important; }
    .att-table tbody tr td.cell-ncd    { background-color: #ffff00 !important; }
  </style>
</head>
<body>
  <div class="title-block">
    <div class="sf2-title">School Form 2 (SF2) Daily Attendance Report of Learners</div>
    <div class="sf2-sub">(This replaces Form 1, Form 2 &amp; STS Form 4 - Absenteeism and Dropout Profile)</div>
  </div>

  <table class="info-table" style="margin-bottom:4px;">
    <tr>
      <td class="lbl">School ID:</td>
      <td>${escHtml(String(schoolInfo.id))}</td>
      <td class="lbl">School Year:</td>
      <td>${escHtml(schoolYear.name)}</td>
      <td class="lbl">Report for the Month of:</td>
      <td colspan="5"><b>${escHtml(monthName)} ${calYear}</b></td>
    </tr>
    <tr>
      <td class="lbl">Name of School:</td>
      <td colspan="3">${escHtml(schoolInfo.name)}</td>
      <td class="lbl">Grade Level:</td>
      <td>${escHtml(section.gradeLevel || "")}</td>
      <td class="lbl">Section:</td>
      <td>${escHtml(section.name)}</td>
      <td class="lbl">Total No. of Days:</td>
      <td><b>${schoolDayCount}</b></td>
    </tr>
  </table>

  <table class="att-table">
    <thead>
      <tr>
        <th rowspan="2" class="col-no">No.</th>
        <th rowspan="2" class="col-lrn">LRN</th>
        <th rowspan="2" class="col-name">NAME<br/>(Last Name, First Name, Middle Name)</th>
        ${dateHeaderCells()}
        <th rowspan="2" class="col-total">ABSENT</th>
        <th rowspan="2" class="col-total">PRESENT</th>
      </tr>
      <tr>
        ${dowCells()}
      </tr>
    </thead>
    <tbody>
      <tr class="group-header"><td colspan="${colspan}">MALE</td></tr>
      ${maleRowsHtml}
      ${totalRow(male, "MALE")}
      <tr class="group-header"><td colspan="${colspan}">FEMALE</td></tr>
      ${femaleRowsHtml}
      ${totalRow(female, "FEMALE")}
    </tbody>
  </table>
</body>
</html>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── SF2 browser preview component ─────────────────────────────────────────────
function SF2Preview({ data }) {
  const { schoolInfo, schoolYear, section, monthName, calYear, dates, schoolDayCount, students } = data;
  const { male, female } = students;

  function groupPerDay(group, dateStr) {
    return group.filter((s) => {
      const st = s.daily[dateStr];
      return st === "present" || st === "late";
    }).length;
  }

  function cellCls(status) {
    if (status === "absent" || status === "excused") return "bg-red-500";
    if (status === "ncd")                            return "bg-yellow-300";
    return "";
  }

  function cellContent(status) {
    return status === "present" || status === "late" ? "✓" : "";
  }

  function renderRows(group) {
    return group.map((s, i) => (
      <tr key={s.id || s.name}>
        <td className="border border-gray-300 text-center text-[10px] px-0.5">{i + 1}</td>
        <td className="border border-gray-300 text-center text-[10px] px-0.5 whitespace-nowrap">{s.studentNumber}</td>
        <td className="border border-gray-300 text-[10px] px-1 whitespace-nowrap">{s.name}</td>
        {dates.map((d) => {
          const status = s.daily[d.date] || "no_record";
          return (
            <td
              key={d.date}
              className={`border border-gray-300 text-center text-[10px] w-5 ${cellCls(status)}`}
            >
              {cellContent(status)}
            </td>
          );
        })}
        <td className="border border-gray-300 text-center text-[10px] font-bold">{s.totalAbsent}</td>
        <td className="border border-gray-300 text-center text-[10px] font-bold">{s.totalPresent}</td>
      </tr>
    ));
  }

  function renderTotalRow(group, label) {
    const totalAbsent  = group.reduce((acc, s) => acc + s.totalAbsent, 0);
    const totalPresent = group.reduce((acc, s) => acc + s.totalPresent, 0);
    return (
      <tr className="bg-gray-200">
        <td colSpan={3} className="border border-gray-300 text-[10px] font-semibold px-1">
          {label} — Total Per Day
        </td>
        {dates.map((d) => (
          <td key={d.date} className="border border-gray-300 text-center text-[10px] font-semibold w-5">
            {groupPerDay(group, d.date) || ""}
          </td>
        ))}
        <td className="border border-gray-300 text-center text-[10px] font-bold">{totalAbsent}</td>
        <td className="border border-gray-300 text-center text-[10px] font-bold">{totalPresent}</td>
      </tr>
    );
  }

  const colspan = 3 + dates.length + 2;

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      {/* Title */}
      <div className="text-center space-y-0.5">
        <p className="font-bold text-sm">School Form 2 (SF2) Daily Attendance Report of Learners</p>
        <p className="text-xs text-gray-500">
          (This replaces Form 1, Form 2 &amp; STS Form 4 - Absenteeism and Dropout Profile)
        </p>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs border rounded p-2 bg-gray-50">
        <div><span className="font-semibold">School ID:</span> {schoolInfo.id}</div>
        <div><span className="font-semibold">School Year:</span> {schoolYear.name}</div>
        <div><span className="font-semibold">Name of School:</span> {schoolInfo.name}</div>
        <div><span className="font-semibold">Month:</span> {monthName} {calYear}</div>
        <div><span className="font-semibold">Grade Level:</span> {section.gradeLevel || "—"}</div>
        <div>
          <span className="font-semibold">Section:</span> {section.name}&nbsp;&nbsp;
          <span className="font-semibold">Total Days:</span> {schoolDayCount}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-red-500 border border-gray-400 rounded-sm" />
          Absent / Excused
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-yellow-300 border border-gray-400 rounded-sm" />
          No Class Day
        </span>
        <span className="flex items-center gap-1">
          <span className="font-semibold">✓</span> Present / Late
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="border-collapse" style={{ borderSpacing: 0 }}>
          <thead>
            <tr className="bg-gray-100">
              <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs whitespace-nowrap">No.</th>
              <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs whitespace-nowrap">LRN</th>
              <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs min-w-[140px]">NAME</th>
              {dates.map((d) => (
                <th key={d.date} className="border border-gray-300 px-0 py-0.5 text-[10px] text-center w-5">
                  {d.day}
                </th>
              ))}
              <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs whitespace-nowrap">ABSENT</th>
              <th rowSpan={2} className="border border-gray-300 px-1 py-0.5 text-xs whitespace-nowrap">PRESENT</th>
            </tr>
            <tr className="bg-gray-100">
              {dates.map((d) => (
                <th key={d.date} className="border border-gray-300 px-0 py-0.5 text-[9px] text-center w-5">
                  {d.weekday}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Male group */}
            <tr className="bg-gray-300">
              <td colSpan={colspan} className="border border-gray-300 text-xs font-bold px-1 py-0.5">
                MALE
              </td>
            </tr>
            {renderRows(male)}
            {renderTotalRow(male, "MALE")}

            {/* Female group */}
            <tr className="bg-gray-300">
              <td colSpan={colspan} className="border border-gray-300 text-xs font-bold px-1 py-0.5">
                FEMALE
              </td>
            </tr>
            {renderRows(female)}
            {renderTotalRow(female, "FEMALE")}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SF2ReportPage() {
  const [schoolYears,         setSchoolYears]         = useState([]);
  const [sections,            setSections]            = useState([]);
  const [selectedSchoolYear,  setSelectedSchoolYear]  = useState("");
  const [selectedSection,     setSelectedSection]     = useState("");
  const [selectedMonth,       setSelectedMonth]       = useState("");
  const [reportData,          setReportData]          = useState(null);
  const [loading,             setLoading]             = useState(false);
  const [error,               setError]               = useState("");

  // Fetch school years on mount
  useEffect(() => {
    api
      .get("/school-years")
      .then((data) => setSchoolYears(Array.isArray(data) ? data : []))
      .catch((err) => toast.error(err.message || "Could not load school years."));
  }, []);

  // Fetch sections whenever school year changes.
  useEffect(() => {
    if (!selectedSchoolYear) {
      setSections([]);
      setSelectedSection("");
      return;
    }
    api
      .get(`/sections?schoolYear=${selectedSchoolYear}`)
      .then((data) => {
        if (!Array.isArray(data)) { setSections([]); return; }
        setSections(data.map((s) => ({
          ...s,
          displayName: s.displayName || (s.gradeLevel ? `${s.gradeLevel} – ${s.name}` : s.name),
        })));
      })
      .catch((err) => toast.error(err.message || "Could not load sections."));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchoolYear]);

  async function handleGenerate() {
    if (!selectedSchoolYear || !selectedSection || !selectedMonth) {
      toast.error("Please select School Year, Month, and Section.");
      return;
    }
    setLoading(true);
    setError("");
    setReportData(null);
    try {
      const data = await api.get(
        `/reports/sf2?sectionId=${selectedSection}&schoolYearId=${selectedSchoolYear}&month=${selectedMonth}`
      );
      setReportData(data);
    } catch (err) {
      const msg = err.message || "Failed to generate report.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    if (!reportData) return;
    const html = buildPrintHtml(reportData);
    const win  = window.open("", "_blank");
    if (!win) {
      toast.error("Pop-up blocked. Please allow pop-ups for this site and try again.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    // Small delay to let the page render before printing
    setTimeout(() => win.print(), 600);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="SF2 Attendance Report"
        subtitle="Monthly School Form 2 — Daily Attendance Report of Learners"
      />

      {/* Filter card */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Report Parameters</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* School Year */}
          <div className="space-y-1">
            <Label htmlFor="sy-select">School Year</Label>
            <Select
              id="sy-select"
              value={selectedSchoolYear}
              onChange={(e) => {
                setSelectedSchoolYear(e.target.value);
                setSelectedSection("");
                setReportData(null);
                setError("");
              }}
            >
              <option value="">— Select School Year —</option>
              {schoolYears.map((sy) => (
                <option key={sy._id} value={sy._id}>
                  {sy.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Month */}
          <div className="space-y-1">
            <Label htmlFor="month-select">Month</Label>
            <Select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setReportData(null);
                setError("");
              }}
            >
              <option value="">— Select Month —</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Section */}
          <div className="space-y-1">
            <Label htmlFor="section-select">Section</Label>
            <Select
              id="section-select"
              value={selectedSection}
              onChange={(e) => {
                setSelectedSection(e.target.value);
                setReportData(null);
                setError("");
              }}
              disabled={!selectedSchoolYear || sections.length === 0}
            >
              <option value="">— Select Section —</option>
              {sections.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.displayName || s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating…" : "Generate Report"}
          </Button>
          {reportData && (
            <>
              <Button variant="outline" onClick={handlePrint}>
                Print / Save as PDF
              </Button>
              <Button variant="outline" onClick={() => exportSF2ToXLSX(reportData).catch((e) => toast.error(e.message ?? "Export failed."))}>
                <FileSpreadsheet className="size-4" /> Export to XLSX
              </Button>
            </>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {/* Preview */}
      {reportData && <SF2Preview data={reportData} />}
    </div>
  );
}
