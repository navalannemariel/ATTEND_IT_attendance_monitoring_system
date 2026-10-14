// SF2 XLSX export — pixel-perfect match to sf2.xls template

export async function exportSF2ToXLSX(data) {
  const XLS = (await import('xlsx-js-style')).default;
  const { schoolInfo, schoolYear, section, monthName, calYear, dates, schoolDayCount, students } = data;
  const { male, female } = students;

  // ── Fixed architecture ──────────────────────────────────────────────────────
  const TOTAL_COLS = 51;

  const DATE_SLOTS = [5,7,8,9,10,11,13,14,15,16,17,19,20,21,23,25,27,28,29,30,31,32,34,35,36];
  const SLOT_DOWS  = [1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5];
  const DOW_LABEL  = { 1:'M', 2:'T', 3:'W', 4:'TH', 5:'F' };
  const SLOT_MERGE_RIGHT = new Set([0,5,10,13,14,15,21,24]);

  const COL_WIDTHS = [
    2.33,1.86,19.75,12.13,0.46,
    0.93,2.80,
    5.13,5.13,5.13,5.13,
    3.58,0.46,
    5.13,5.13,5.13,5.13,
    0.93,2.80,
    5.13,5.13,
    0.93,3.26,
    1.86,2.33,
    2.33,1.86,
    4.66,4.66,4.66,4.66,
    5.13,3.73,0.46,
    5.13,5.13,
    1.86,2.33,
    2.33,7.00,
    7.00,2.33,
    14.15,8.86,8.86,9.33,0.46,
    12.13,12.13,12.13,12.13,
  ];

  // ── Date slot map ───────────────────────────────────────────────────────────
  function buildSlotMap(dates) {
    if (!dates || !dates.length) return new Array(25).fill(null);
    const sorted = [...dates].sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = new Date(sorted[0].date + 'T12:00:00');
    const firstDow  = firstDate.getDay();
    const daysBack  = firstDow === 0 ? -6 : 1 - firstDow;
    const mon0      = new Date(firstDate);
    mon0.setDate(firstDate.getDate() + daysBack);
    const slotMap = new Array(25).fill(null);
    dates.forEach(d => {
      const dt   = new Date(d.date + 'T12:00:00');
      const dow  = dt.getDay();
      const diff = Math.round((dt - mon0) / 86400000);
      const wg   = Math.floor(diff / 7);
      if (wg < 0 || wg >= 5) return;
      const off  = dow === 0 ? 6 : dow - 1;
      const slot = wg * 5 + off;
      if (slot >= 0 && slot < 25) slotMap[slot] = d;
    });
    return slotMap;
  }

  const slotMap = buildSlotMap(dates);

  // ── Worksheet scaffolding ───────────────────────────────────────────────────
  const wb     = XLS.utils.book_new();
  const ws     = {};
  const merges = [];
  let   maxRow = 0;

  function C(r, c, value, style = {}) {
    ws[XLS.utils.encode_cell({ r, c })] = {
      v: value ?? '',
      t: typeof value === 'number' ? 'n' : 's',
      s: style,
    };
    if (r > maxRow) maxRow = r;
  }
  function M(r1, c1, r2, c2) {
    merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
  }

  // ── Border helpers ──────────────────────────────────────────────────────────
  function brd(l, r, t, b) {
    const o = {};
    if (l) o.left   = l;
    if (r) o.right  = r;
    if (t) o.top    = t;
    if (b) o.bottom = b;
    return o;
  }
  const thin   = { style: 'thin' };
  const medium = { style: 'medium' };
  const dbl    = { style: 'double' };

  // Numeric shorthand → border object side
  function bs(n) { return n === 2 ? medium : n === 1 ? thin : n === 6 ? dbl : null; }
  function B(l, r, t, b) { return brd(bs(l), bs(r), bs(t), bs(b)); }

  // ── Column border tables for date area (cols 5–37) ─────────────────────────
  // Each entry: [left, right, top, bottom]  (0=none,1=thin,2=medium)

  // Student data rows
  const SDT = {
     5:[2,0,1,1],  6:[0,1,1,1],
     7:[1,1,1,1],  8:[1,1,1,1],  9:[1,1,1,1], 10:[1,2,1,1],
    11:[2,0,1,1], 12:[0,1,1,1],
    13:[1,1,1,1], 14:[1,1,1,1], 15:[1,1,1,1], 16:[1,2,1,1],
    17:[2,0,1,1], 18:[0,1,1,1],
    19:[1,1,1,1], 20:[1,1,1,1],
    21:[1,0,1,1], 22:[0,1,1,1],
    23:[1,0,1,1], 24:[0,2,1,1],
    25:[2,0,1,1], 26:[0,1,1,1],
    27:[1,1,1,1], 28:[1,1,1,1], 29:[1,1,1,1], 30:[1,2,1,1],
    31:[2,1,1,1],
    32:[1,0,1,1], 33:[0,1,1,1],
    34:[1,1,1,1], 35:[1,1,1,1],
    36:[1,0,1,1], 37:[0,2,1,1],
  };

  // Date number row (row 5) — no medium-right at week ends
  const NDT = {
     5:[2,0,1,1],  6:[0,1,1,1],
     7:[1,1,1,1],  8:[1,1,1,1],  9:[1,1,1,1], 10:[1,1,1,1],
    11:[2,0,1,1], 12:[0,1,1,1],
    13:[1,1,1,1], 14:[1,1,1,1], 15:[1,1,1,1], 16:[1,1,1,1],
    17:[2,0,1,1], 18:[0,1,1,1],
    19:[1,1,1,1], 20:[1,1,1,1],
    21:[1,0,1,1], 22:[0,1,1,1],
    23:[1,0,1,1], 24:[0,1,1,1],
    25:[2,0,1,1], 26:[0,1,1,1],
    27:[1,1,1,1], 28:[1,1,1,1], 29:[1,1,1,1], 30:[1,1,1,1],
    31:[2,1,1,1],
    32:[1,0,1,1], 33:[0,1,1,1],
    34:[1,1,1,1], 35:[1,1,1,1],
    36:[1,0,1,1], 37:[0,1,1,1],
  };

  // DOW label row (row 6) — medium bottom
  const DDT = {
     5:[2,0,1,2],  6:[0,1,1,2],
     7:[1,1,1,2],  8:[1,1,1,2],  9:[1,1,1,2], 10:[1,1,1,2],
    11:[2,0,1,2], 12:[0,1,1,2],
    13:[1,1,1,2], 14:[1,1,1,2], 15:[1,1,1,2], 16:[1,1,1,2],
    17:[2,0,1,2], 18:[0,1,1,2],
    19:[1,1,1,2], 20:[1,1,1,2],
    21:[1,0,1,2], 22:[0,1,1,2],
    23:[1,0,1,2], 24:[0,1,1,2],
    25:[2,0,1,2], 26:[0,1,1,2],
    27:[1,1,1,2], 28:[1,1,1,2], 29:[1,1,1,2], 30:[1,1,1,2],
    31:[2,1,1,2],
    32:[1,0,1,2], 33:[0,1,1,2],
    34:[1,1,1,2], 35:[1,1,1,2],
    36:[1,0,1,2], 37:[0,1,1,2],
  };

  // Total rows — medium top and bottom
  const TDT = {
     5:[2,0,2,2],  6:[0,1,2,2],
     7:[1,1,2,2],  8:[1,1,2,2],  9:[1,1,2,2], 10:[1,1,2,2],
    11:[2,0,2,2], 12:[0,1,2,2],
    13:[1,1,2,2], 14:[1,1,2,2], 15:[1,1,2,2], 16:[1,1,2,2],
    17:[2,0,2,2], 18:[0,1,2,2],
    19:[1,1,2,2], 20:[1,1,2,2],
    21:[1,0,2,2], 22:[0,1,2,2],
    23:[1,0,2,2], 24:[0,1,2,2],
    25:[2,0,2,2], 26:[0,1,2,2],
    27:[1,1,2,2], 28:[1,1,2,2], 29:[1,1,2,2], 30:[1,1,2,2],
    31:[2,1,2,2],
    32:[1,0,2,2], 33:[0,1,2,2],
    34:[1,1,2,2], 35:[1,1,2,2],
    36:[1,0,2,2], 37:[0,1,2,2],
  };

  // Write all 33 date-area columns (5–37) for a row
  function writeDateArea(row, bTable, getCell) {
    for (let c = 5; c <= 37; c++) {
      const [l, r, t, b] = bTable[c] || [1,1,1,1];
      const border = B(l, r, t, b);
      const slotIdx = DATE_SLOTS.indexOf(c);
      if (slotIdx !== -1) {
        const [val, extraStyle] = getCell(slotIdx);
        C(row, c, val, { ...extraStyle, border });
        if (SLOT_MERGE_RIGHT.has(slotIdx)) M(row, c, row, c + 1);
      } else {
        C(row, c, '', { border });
      }
    }
  }

  // ── Fills ───────────────────────────────────────────────────────────────────
  const fillYellow = { fgColor: { rgb: 'FFFF99' }, patternType: 'solid' };

  // ── Style atoms ─────────────────────────────────────────────────────────────
  const fSS  = (sz, bold, italic) => ({ sz, name: 'Arial', bold: bold || undefined, italic: italic || undefined });
  const fAN  = (sz, bold) => ({ sz, name: 'Arial Narrow', bold: bold || undefined });
  const fAr  = (sz, bold) => ({ sz, name: 'Arial', bold: bold || undefined });
  const aCC  = (wt) => ({ horizontal: 'center', vertical: 'center', wrapText: wt });
  const aLC  = (wt) => ({ horizontal: 'left',   vertical: 'center', wrapText: wt });
  const aRC  = (wt) => ({ horizontal: 'right',  vertical: 'center', wrapText: wt });
  const aCT  = (wt) => ({ horizontal: 'center', vertical: 'top',    wrapText: wt });
  const aLT  = (wt) => ({ horizontal: 'left',   vertical: 'top',    wrapText: wt });

  const sTitle = { font: fSS(13, true),  alignment: aCT(true) };
  const sSub   = { font: fSS(5, false, true), alignment: aCT(true) };

  // Label cells (School ID label, School Year label, etc.) — right-aligned, no border
  const sLbl = (sz = 6) => ({ font: fSS(sz), alignment: aRC(true) });

  // Header value cells
  const sValS = (sz = 8) => ({ font: fSS(sz), border: B(1,0,1,1), alignment: aCC(true) });
  const sValE = (sz = 8) => ({ font: fSS(sz), border: B(0,1,1,1), alignment: aCC(true) });
  const sValM = (sz = 8) => ({ font: fSS(sz), border: B(0,0,1,1), alignment: aCC(true) });

  // Column header cells (rows 4-6)
  // No., NAME (rows 4-6): medium L and T, no B
  const sNoHdrS  = { font: fSS(6, true),  border: B(2,0,2,0), alignment: aCC(true) };
  const sNoHdrE  = { font: fSS(6, true),  border: B(0,2,2,0), alignment: aCC(true) };
  const sNameHdrS= { font: fSS(6, true),  border: B(2,0,2,0), alignment: aCC(true) };
  const sNameHdrE= { font: fSS(6, true),  border: B(0,2,2,0), alignment: aCC(true) };
  // Row 4 date placeholder area (thin top/bottom, thin sides)
  const sDatePh  = { font: fSS(6),        border: B(1,0,2,1), alignment: aCC(true) };
  const sDatePhE = { font: fSS(6),        border: B(0,1,2,1), alignment: aCC(true) };
  // "Total for the Month" header (rows 4-5, cols 38-41)
  const sTotHdrS = { font: fSS(8, true),  border: B(2,0,2,0), alignment: aCC(true) };
  const sTotHdrE = { font: fSS(8, true),  border: B(0,2,2,0), alignment: aCC(true) };
  const sTotHdr2S= { font: fSS(8, true),  border: B(2,0,0,2), alignment: aCC(true) };
  const sTotHdr2E= { font: fSS(8, true),  border: B(0,2,0,2), alignment: aCC(true) };
  // "REMARKS" header (rows 4-6, cols 42-46)
  const sRemHdrS = { font: fSS(5, true),  border: B(2,0,2,0), alignment: aCC(true) };
  const sRemHdrE = { font: fSS(5, true),  border: B(0,2,2,0), alignment: aCC(true) };
  const sRemDowS = { font: fSS(5, true),  border: B(2,0,0,2), alignment: aCC(true) };
  const sRemDowE = { font: fSS(5, true),  border: B(0,2,0,2), alignment: aCC(true) };
  // Day-number cells (row 5): left-aligned
  const sDayNum  = (sz = 9) => ({ font: fSS(sz), alignment: { horizontal: 'left', vertical: 'top', wrapText: true } });
  // DOW label cells (row 6)
  const sDow     = (sz = 6) => ({ font: fSS(sz), alignment: aCC(true) });
  // ABSENT / PRESENT headers (row 6, cols 38-41): SansSerif 5 Bold, medium borders
  const sAbsHdrS = { font: fSS(5, true),  border: B(2,0,2,2), alignment: aCC(true) };
  const sAbsHdrE = { font: fSS(5, true),  border: B(0,2,2,2), alignment: aCC(true) };
  // Row 5 continuation of No. / NAME (borders only, no value)
  const sR5NoS   = { font: fSS(6, true),  border: B(2,0,0,0) };
  const sR5NoE   = { font: fSS(6, true),  border: B(0,2,0,0) };
  const sR5NmS   = { font: fSS(6, true),  border: B(2,0,0,0) };
  const sR5NmE   = { font: fSS(6, true),  border: B(0,2,0,0) };
  // Row 6 (DOW row) No. / NAME bottom border (medium)
  const sR6NoS   = { font: fSS(6, true),  border: B(2,0,0,2) };
  const sR6NoE   = { font: fSS(6, true),  border: B(0,2,0,2) };
  const sR6NmS   = { font: fSS(6, true),  border: B(2,0,0,2) };
  const sR6NmE   = { font: fSS(6, true),  border: B(0,2,0,2) };

  // Student rows
  const sNum  = { font: fSS(7),       border: B(2,0,1,1), alignment: aCC(true) };
  const sNumE = { font: fSS(7),       border: B(0,1,1,1), alignment: aCC(true) };
  const sNameS= { font: fSS(7),       border: B(1,0,2,1), alignment: aLC(false) };
  const sNameE= { font: fSS(7),       border: B(0,2,2,1), alignment: aLC(false) };
  // Absent/present total cells (Arial Narrow 11 Bold)
  const sAbsS = { font: fAN(11,true), border: B(2,0,1,1), alignment: aCC(true) };
  const sAbsE = { font: fAN(11,true), border: B(0,2,1,1), alignment: aCC(true) };
  const sPresS= { font: fAN(11,true), border: B(2,0,1,1), alignment: aCC(true) };
  const sPresE= { font: fAN(11,true), border: B(0,2,1,1), alignment: aCC(true) };
  // Remarks student cells (Arial Narrow 5 Bold)
  const sRemS = { font: fAN(5, true), border: B(1,0,1,1) };
  const sRemE = { font: fAN(5, true), border: B(0,2,1,1) };

  // Attendance cell fills
  const fillAbsent  = { fgColor: { rgb: 'FF2020' }, patternType: 'solid' };
  const fillNcd     = { fgColor: { rgb: 'FFFF00' }, patternType: 'solid' };

  // Total rows (male/female/combined): no fill, medium top+bottom
  const sTotNumS  = { font: fSS(8),      border: B(2,0,2,2), alignment: aCC(true) };
  const sTotNumE  = { font: fSS(8),      border: B(0,1,2,2), alignment: aCC(true) };
  const sTotLblS  = { font: fSS(7),      border: B(1,0,6,2), alignment: aLC(false) };
  const sTotAbsS  = { font: fAN(11,true),border: B(0,0,1,2), alignment: aCC(true) };
  const sTotAbsE  = { font: fAN(11,true),border: B(0,2,1,2), alignment: aCC(true) };
  const sTotPresS = { font: fAN(11,true),border: B(2,0,1,2), alignment: aCC(true) };
  const sTotPresE = { font: fAN(11,true),border: B(0,2,1,2), alignment: aCC(true) };
  const sTotRemS  = { font: fAN(5, true),border: B(2,0,1,2) };
  const sTotRemE  = { font: fAN(5, true),border: B(0,2,1,2) };

  // Combined total row
  const sCmbNumS  = { font: fSS(8),      border: B(2,0,1,2), alignment: aCC(true) };
  const sCmbNumE  = { font: fSS(8),      border: B(0,1,1,2), alignment: aCC(true) };
  const sCmbLblS  = { font: fSS(7),      border: B(1,0,1,2), alignment: aLC(false) };

  // Summary column cells (cols 48-50 in total rows)
  const sSumBox = (fill) => ({
    font: fAr(10),
    fill,
    border: B(2,2,0,0),
    alignment: aCC(false),
  });

  // Bottom section helpers
  function sBot(bold = false, sz = 6) {
    return { font: { ...fSS(sz), bold: bold || undefined }, alignment: aLT(true) };
  }
  function sStat() {
    return { font: fSS(9), border: brd(thin,thin,thin,thin), alignment: aCC(true) };
  }
  function sStatLabel() {
    return { font: fSS(6), border: brd(medium,null,null,null), alignment: aLC(true) };
  }
  function sStatHdr(bold = true) {
    return { font: fSS(5, bold), border: brd(thin,thin,thin,thin), alignment: aCC(true) };
  }

  // ── ROW 0: Title ────────────────────────────────────────────────────────────
  C(0, 0, 'School Form 2 (SF2) Daily Attendance Report of Learners', sTitle);
  M(0, 0, 0, 46);

  // ── ROW 1: Subtitle ─────────────────────────────────────────────────────────
  C(1, 0, '(This replaces Form 1, Form 2 & STS Form 4 - Absenteeism and Dropout Profile)', sSub);
  M(1, 0, 1, 46);

  // ── ROW 2: School ID | School Year | Month ───────────────────────────────────
  C(2, 0,  'School ID ',       sLbl(6));   M(2, 0, 2, 3);
  C(2, 5,  String(schoolInfo?.id ?? ''), sValS(8));
  C(2, 6,  '', sValM(8)); C(2, 7, '', sValM(8));
  C(2, 8,  '', sValE(8));
  M(2, 5, 2, 8);

  C(2, 9,  'School Year ',     sLbl(6));   M(2, 9, 2, 11);
  C(2, 12, schoolYear?.name ?? '', sValS(8));
  C(2, 13, '', sValM(8)); C(2, 14, '', sValM(8)); C(2, 15, '', sValM(8));
  C(2, 16, '', sValM(8));
  C(2, 17, '', sValE(8));
  M(2, 12, 2, 17);

  C(2, 18, 'Report for the Month of', sLbl(6)); M(2, 18, 2, 25);
  C(2, 26, `${monthName} ${calYear}`, sValS(8));
  C(2, 27, '', sValM(8)); C(2, 28, '', sValM(8)); C(2, 29, '', sValM(8));
  C(2, 30, '', sValM(8)); C(2, 31, '', sValM(8));
  C(2, 32, '', sValE(8));
  M(2, 26, 2, 32);

  // ── ROW 3: Name of School | Grade Level | Section | Total Days ───────────────
  C(3, 0,  'Name of School',   sLbl(6));   M(3, 0, 3, 3);
  C(3, 5,  schoolInfo?.name ?? '', sValS(8));
  for (let c = 6; c <= 16; c++) C(3, c, '', sValM(8));
  C(3, 17, '', sValE(8));
  M(3, 5, 3, 17);

  C(3, 18, 'Grade Level',      sLbl(6));   M(3, 18, 3, 25);
  C(3, 26, section?.gradeLevel ?? '', sValS(8));
  C(3, 27, '', sValM(8)); C(3, 28, '', sValM(8)); C(3, 29, '', sValM(8));
  C(3, 30, '', sValM(8)); C(3, 31, '', sValM(8));
  C(3, 32, '', sValE(8));
  M(3, 26, 3, 32);

  C(3, 34, 'Section ',         sLbl(6));   M(3, 34, 3, 37);
  C(3, 38, section?.name ?? '', sValS(8));
  for (let c = 39; c <= 45; c++) C(3, c, '', sValM(8));
  C(3, 46, '', sValE(8));
  M(3, 38, 3, 46);

  // "TOTAL NO. OF DAYS" label — Arial 10, medium left+top
  C(3, 48, 'TOTAL NO. OF DAYS', { font: fAr(10), border: B(2,0,2,0), alignment: aCC(false) });
  C(3, 49, '',                   { font: fAr(10), border: B(0,0,2,0), alignment: aCC(false) });
  C(3, 50, '',                   { font: fAr(10), border: B(0,2,2,0), alignment: aCC(false) });
  M(3, 48, 3, 50);

  // ── ROWS 4–6: Column headers ──────────────────────────────────────────────────

  // No. (rowspan 4-6, cols 0-1)
  C(4, 0, 'No.',  sNoHdrS);
  C(4, 1, '',     sNoHdrE);
  C(5, 0, '',     sR5NoS);  C(5, 1, '', sR5NoE);
  C(6, 0, '',     sR6NoS);  C(6, 1, '', sR6NoE);
  M(4, 0, 6, 1);

  // NAME (rowspan 4-6, cols 2-4)
  C(4, 2, 'NAME\n(Last Name, First Name, Middle Name)', sNameHdrS);
  C(4, 3, '', { border: B(0,0,2,0) });
  C(4, 4, '', sNameHdrE);
  C(5, 2, '', sR5NmS);  C(5, 3, '', { border: B(0,0,0,0) });  C(5, 4, '', sR5NmE);
  C(6, 2, '', sR6NmS);  C(6, 3, '', { border: B(0,0,0,2) });  C(6, 4, '', sR6NmE);
  M(4, 2, 6, 4);

  // Date placeholder (row 4 only, cols 5-37): thin L, medium T, thin B
  C(4, 5, '(1st row for date)', sDatePh);
  for (let c = 6; c <= 36; c++) C(4, c, '', { border: B(0,0,2,1) });
  C(4, 37, '', sDatePhE);
  M(4, 5, 4, 37);

  // "Total for the Month" (rows 4-5, cols 38-41): medium L+T, no B in row4
  C(4, 38, 'Total for the Month', sTotHdrS);
  C(4, 39, '', { border: B(0,0,2,0) });
  C(4, 40, '', { border: B(0,0,2,0) });
  C(4, 41, '', sTotHdrE);
  // Row 5: medium bottom closes the span
  C(5, 38, '', sTotHdr2S);
  C(5, 39, '', { border: B(0,0,0,2) });
  C(5, 40, '', { border: B(0,0,0,2) });
  C(5, 41, '', sTotHdr2E);
  M(4, 38, 5, 41);

  // REMARKS (rowspan 4-6, cols 42-46)
  C(4, 42, 'REMARKS\n(If NLS, state reason, please refer to legend numbers)', sRemHdrS);
  C(4, 43, '', { border: B(0,0,2,0) });
  C(4, 44, '', { border: B(0,0,2,0) });
  C(4, 45, '', { border: B(0,0,2,0) });
  C(4, 46, '', sRemHdrE);
  C(5, 42, '', { border: B(2,0,0,0) });
  C(5, 43, '', { border: B(0,0,0,0) });
  C(5, 44, '', { border: B(0,0,0,0) });
  C(5, 45, '', { border: B(0,0,0,0) });
  C(5, 46, '', { border: B(0,2,0,0) });
  C(6, 42, '', sRemDowS);
  C(6, 43, '', { border: B(0,0,0,2) });
  C(6, 44, '', { border: B(0,0,0,2) });
  C(6, 45, '', { border: B(0,0,0,2) });
  C(6, 46, '', sRemDowE);
  M(4, 42, 6, 46);

  // School day count (rows 4-5, cols 48-50): Arial 14 Bold, yellow fill
  C(4, 48, schoolDayCount, { font: fAr(14, true), fill: fillYellow, border: B(2,0,0,0), alignment: aCC(false) });
  C(4, 49, '',              { font: fAr(14, true), fill: fillYellow, border: B(0,0,0,0), alignment: aCC(false) });
  C(4, 50, '',              { font: fAr(14, true), fill: fillYellow, border: B(0,2,0,0), alignment: aCC(false) });
  C(5, 48, '',              { font: fAr(14, true), fill: fillYellow, border: B(2,0,0,0), alignment: aCC(false) });
  C(5, 49, '',              { font: fAr(14, true), fill: fillYellow, border: B(0,0,0,0), alignment: aCC(false) });
  C(5, 50, '',              { font: fAr(14, true), fill: fillYellow, border: B(0,2,0,0), alignment: aCC(false) });
  C(6, 48, '',              { font: fAr(10),        border: B(2,0,0,0), alignment: aCC(false) });
  C(6, 49, '',              { border: B(0,0,0,0) });
  C(6, 50, '',              { font: fAr(10),        border: B(0,2,0,0), alignment: aCC(false) });
  M(4, 48, 5, 50);

  // Row 5: date numbers
  writeDateArea(5, NDT, slot => {
    const d = slotMap[slot];
    return [d ? d.day : '', sDayNum()];
  });

  // Row 6: DOW labels | ABSENT | PRESENT
  writeDateArea(6, DDT, slot => {
    const d = slotMap[slot];
    return [d ? DOW_LABEL[SLOT_DOWS[slot]] : '', sDow()];
  });
  C(6, 38, 'ABSENT',  sAbsHdrS); C(6, 39, '', sAbsHdrE);  M(6, 38, 6, 39);
  C(6, 40, 'PRESENT', sAbsHdrS); C(6, 41, '', sAbsHdrE);  M(6, 40, 6, 41);

  // ── Student row writer ────────────────────────────────────────────────────────
  function writeStudentRow(r, idx, student) {
    C(r, 0, idx + 1, sNum);
    C(r, 1, '',       sNumE);
    M(r, 0, r, 1);

    const name = student?.name ?? '';
    C(r, 2, name, sNameS);
    C(r, 3, '',   { font: fSS(7), border: B(0,0,2,1) });
    C(r, 4, '',   sNameE);
    M(r, 2, r, 4);

    writeDateArea(r, SDT, slot => {
      const dateObj = slotMap[slot];
      if (!dateObj || !dateObj.inSchoolYear) return ['', {}];
      const status = student ? ((student.daily ?? {})[dateObj.date] ?? 'no_record') : 'no_record';
      if (status === 'ncd')                             return ['', { fill: fillNcd }];
      if (status === 'absent' || status === 'excused')  return ['', { fill: fillAbsent }];
      if (status === 'present' || status === 'late')    return ['✓', { alignment: aCC(false) }];
      return ['', {}];
    });

    const ab = student?.totalAbsent  ?? '';
    const pr = student?.totalPresent ?? '';
    C(r, 38, ab, sAbsS);  C(r, 39, '', sAbsE);  M(r, 38, r, 39);
    C(r, 40, pr, sPresS); C(r, 41, '', sPresE); M(r, 40, r, 41);
    C(r, 42, '', sRemS);
    C(r, 43, '', { font: fAN(5,true), border: B(0,0,1,1) });
    C(r, 44, '', { font: fAN(5,true), border: B(0,0,1,1) });
    C(r, 45, '', { font: fAN(5,true), border: B(0,0,1,1) });
    C(r, 46, '', sRemE);
    M(r, 42, r, 46);

    // Summary cols 48/50 (thin frames)
    C(r, 48, '', { font: fAr(10), border: B(2,0,0,0) });
    C(r, 50, '', { font: fAr(10), border: B(0,2,0,0) });
  }

  // ── Total row writer ──────────────────────────────────────────────────────────
  function writeTotalRow(r, group, label, isLastOfSection) {
    const b2 = isLastOfSection ? 2 : 2;

    C(r, 0, group.length, sTotNumS);
    C(r, 1, '',           sTotNumE);
    M(r, 0, r, 1);

    C(r, 2, label, sTotLblS);
    C(r, 3, '',    { border: B(0,0,6,2) });
    C(r, 4, '',    { border: B(0,2,6,2) });
    M(r, 2, r, 4);

    writeDateArea(r, TDT, slot => {
      const dateObj = slotMap[slot];
      if (!dateObj || !dateObj.inSchoolYear) return ['', {}];
      const n = group.filter(s => {
        const st = (s.daily ?? {})[dateObj.date];
        return st === 'present' || st === 'late';
      }).length;
      return [n || '', { alignment: aCC(false) }];
    });

    const ta = group.reduce((s, st) => s + (st.totalAbsent  ?? 0), 0);
    const tp = group.reduce((s, st) => s + (st.totalPresent ?? 0), 0);

    C(r, 38, ta || '', sTotAbsS);  C(r, 39, '', sTotAbsE);  M(r, 38, r, 39);
    C(r, 40, tp || '', sTotPresS); C(r, 41, '', sTotPresE); M(r, 40, r, 41);
    C(r, 42, '', sTotRemS);
    C(r, 43, '', { font: fAN(5,true), border: B(0,0,1,2) });
    C(r, 44, '', { font: fAN(5,true), border: B(0,0,1,2) });
    C(r, 45, '', { font: fAN(5,true), border: B(0,0,1,2) });
    C(r, 46, '', sTotRemE);
    M(r, 42, r, 46);

    // Summary cols: schoolDays | count | totalPresent
    C(r, 48, schoolDayCount, { font: fAr(10), fill: { fgColor:{ rgb:'FFFF00' }, patternType:'solid' }, border: B(2,0,0,0) });
    C(r, 49, group.length,   { font: fAr(10), fill: { fgColor:{ rgb:'33CCCC' }, patternType:'solid' }, border: B(0,0,0,0) });
    C(r, 50, tp || '',       { font: fAr(10), border: B(0,2,0,0) });
  }

  // ── Male students ─────────────────────────────────────────────────────────────
  const MALE_ROWS   = Math.max(male.length, 1);
  const FEMALE_ROWS = Math.max(female.length, 1);

  let row = 7;
  for (let i = 0; i < MALE_ROWS; i++) {
    writeStudentRow(row, i, male[i] ?? null);
    row++;
  }
  const maleTotalRow = row;
  writeTotalRow(row, male, '<=== MALE | TOTAL Per Day ===>');
  row++;

  // ── Female students ────────────────────────────────────────────────────────────
  for (let i = 0; i < FEMALE_ROWS; i++) {
    writeStudentRow(row, i, female[i] ?? null);
    row++;
  }
  const femaleTotalRow = row;
  writeTotalRow(row, female, '<=== FEMALE | TOTAL Per Day ===>');
  row++;

  // ── Combined total ─────────────────────────────────────────────────────────────
  const allStudents   = [...male, ...female];
  const totalStudents = allStudents.length;
  const totalPresents = allStudents.reduce((s, st) => s + (st.totalPresent ?? 0), 0);
  const combinedAbs   = allStudents.reduce((s, st) => s + (st.totalAbsent  ?? 0), 0);

  C(row, 0, totalStudents, sCmbNumS);
  C(row, 1, '',             sCmbNumE);
  M(row, 0, row, 1);
  C(row, 2, 'Combined TOTAL Per Day', sCmbLblS);
  C(row, 3, '', { border: B(0,0,1,2) });
  C(row, 4, '', { border: B(0,2,1,2) });
  M(row, 2, row, 4);

  writeDateArea(row, TDT, slot => {
    const dateObj = slotMap[slot];
    if (!dateObj || !dateObj.inSchoolYear) return ['', {}];
    const n = allStudents.filter(s => {
      const st = (s.daily ?? {})[dateObj.date];
      return st === 'present' || st === 'late';
    }).length;
    return [n || '', { alignment: aCC(false) }];
  });

  C(row, 38, combinedAbs  || '', { font: fAN(11,true), border: B(0,0,1,2), alignment: aCC(true) });
  C(row, 39, '',                  { font: fAN(11,true), border: B(0,2,1,2) });
  M(row, 38, row, 39);
  C(row, 40, totalPresents || '', { font: fAN(11,true), border: B(2,0,1,2), alignment: aCC(true) });
  C(row, 41, '',                  { font: fAN(11,true), border: B(0,2,1,2) });
  M(row, 40, row, 41);
  C(row, 42, '', { border: B(2,0,1,2) });
  C(row, 43, '', { border: B(0,0,1,2) });
  C(row, 44, '', { border: B(0,0,1,2) });
  C(row, 45, '', { border: B(0,0,1,2) });
  C(row, 46, '', { border: B(0,2,1,2) });
  M(row, 42, row, 46);
  row++;

  // ── Bottom section ────────────────────────────────────────────────────────────
  const B0 = row;

  const mLen  = male.length;
  const fLen  = female.length;
  const tLen  = mLen + fLen;
  const presM = male.reduce((s, st)   => s + (st.totalPresent ?? 0), 0);
  const presF = female.reduce((s, st) => s + (st.totalPresent ?? 0), 0);
  const presT = presM + presF;
  const adaM  = schoolDayCount > 0 ? presM / schoolDayCount : 0;
  const adaF  = schoolDayCount > 0 ? presF / schoolDayCount : 0;
  const adaT  = schoolDayCount > 0 ? presT / schoolDayCount : 0;
  const pctM  = mLen > 0 ? (adaM / mLen * 100) : 0;
  const pctF  = fLen > 0 ? (adaF / fLen * 100) : 0;
  const pctT  = tLen > 0 ? (adaT / tLen * 100) : 0;
  const fmt1  = n => Math.round(n * 100) / 100;

  // B0+0
  C(B0+0,  0, 'GUIDELINES:', sBot(true, 6));  M(B0+0, 0, B0+0, 23);
  C(B0+0, 25, '1. CODES FOR CHECKING ATTENDANCE', sBot(true, 5));  M(B0+0, 25, B0+0, 36);
  C(B0+0, 38, 'Month :', { font: fSS(6, true), border: brd(medium,null,medium,null), alignment: aLC(false) });
  C(B0+0, 39, monthName, { font: fSS(6),       border: brd(null,null,medium,null),  alignment: aLC(false) });
  M(B0+0, 38, B0+1, 40);
  C(B0+0, 41, 'No. of Days of Classes:', { font: fSS(6, true), border: brd(null,null,medium,null), alignment: aLC(true) });
  M(B0+0, 41, B0+1, 42);
  C(B0+0, 43, 'Summary', sStatHdr(true));  M(B0+0, 43, B0+0, 46);

  // B0+1
  C(B0+1, 0,
    '1. The attendance shall be accomplished daily. Record the attendance on each column corresponding to the date. ' +
    'Shade half of the box if the learner is tardy.\n2. At the end of each month, total the number of absences in the ABSENT column and the number of days present in the PRESENT column.',
    sBot(false, 6));
  M(B0+1, 0, B0+4, 23);
  C(B0+1, 25, '(blank) - Present; (x)- Absent; Tardy (half shade for upper part)', sBot(false, 5));
  M(B0+1, 25, B0+2, 36);
  C(B0+1, 43, 'M',     sStatHdr(true));
  C(B0+1, 44, 'F',     sStatHdr(true));
  C(B0+1, 45, 'TOTAL', sStatHdr(true));
  M(B0+1, 45, B0+1, 46);

  // B0+2 Enrollment
  C(B0+2, 38, '* Enrolment as of (1st Friday of the SY)', sStatLabel());
  M(B0+2, 38, B0+3, 42);
  C(B0+2, 43, mLen, sStat());  M(B0+2, 43, B0+3, 43);
  C(B0+2, 44, fLen, sStat());  M(B0+2, 44, B0+3, 44);
  C(B0+2, 45, tLen, sStat());  M(B0+2, 45, B0+3, 46);

  // B0+3
  C(B0+3, 25, '2. REASONS/CAUSES FOR NLS', sBot(false, 5));
  M(B0+3, 25, B0+4, 36);

  // B0+4
  C(B0+4, 38, 'Late enrolment', sStatLabel());  M(B0+4, 38, B0+5, 40);
  C(B0+4, 41, 'during the month', sStatLabel()); M(B0+4, 41, B0+5, 42);
  C(B0+4, 43, '', sStat());  M(B0+4, 43, B0+7, 43);
  C(B0+4, 44, '', sStat());  M(B0+4, 44, B0+7, 44);
  C(B0+4, 45, '', sStat());  M(B0+4, 45, B0+7, 46);

  // B0+5
  C(B0+5,  1, 'a. Percentage of Enrolment =', sBot(false, 6));  M(B0+5, 1, B0+7, 5);
  C(B0+5,  6, 'Registered Learners as of end of the month', sBot(false, 6));  M(B0+5, 6, B0+6, 18);
  C(B0+5, 19, 'x 100', sBot(false, 6));  M(B0+5, 19, B0+7, 21);
  C(B0+5, 25, 'a. Domestic-Related Factors', sBot(false, 5));  M(B0+5, 25, B0+6, 36);

  // B0+6
  C(B0+6, 38, '(beyond cut-off)', sStatLabel());  M(B0+6, 38, B0+7, 42);

  // B0+7
  C(B0+7,  6, 'Enrolment as of 1st Friday of the school year', sBot(false, 6));  M(B0+7, 6, B0+7, 18);
  C(B0+7, 25,
    'a.1. Had to take care of siblings\na.2. Early marriage\na.3. Pregnancy\na.4. Had to accompany parents',
    sBot(false, 5));
  M(B0+7, 25, B0+10, 36);

  // B0+8
  C(B0+8,  1, 'b. Average Daily Attendance =', sBot(false, 6));  M(B0+8, 1, B0+9, 5);
  C(B0+8,  6, 'Total Daily Attendance', sBot(false, 6));  M(B0+8, 6, B0+8, 18);
  C(B0+8, 38, 'Registered Learners as of', sStatLabel());  M(B0+8, 38, B0+8, 42);
  C(B0+8, 43, fmt1(adaM), sStat());  M(B0+8, 43, B0+9, 43);
  C(B0+8, 44, fmt1(adaF), sStat());  M(B0+8, 44, B0+9, 44);
  C(B0+8, 45, fmt1(adaT), sStat());  M(B0+8, 45, B0+9, 46);

  // B0+9
  C(B0+9,  6, 'Number of School Days in reporting month', sBot(false, 6));  M(B0+9, 6, B0+9, 18);
  C(B0+9, 38, 'end of month', sStatLabel());  M(B0+9, 38, B0+9, 42);

  // B0+10
  C(B0+10,  1, 'c. Percentage of Attendance for the month =', sBot(false, 6));  M(B0+10, 1, B0+11, 5);
  C(B0+10,  6, 'Average daily attendance', sBot(false, 6));  M(B0+10, 6, B0+10, 18);
  C(B0+10, 19, 'x 100', sBot(false, 6));  M(B0+10, 19, B0+11, 21);
  C(B0+10, 38, 'Percentage of Enrolment as of', sStatLabel());  M(B0+10, 38, B0+10, 42);
  C(B0+10, 43, 100, sStat());  M(B0+10, 43, B0+11, 43);
  C(B0+10, 44, 100, sStat());  M(B0+10, 44, B0+11, 44);
  C(B0+10, 45, 100, sStat());  M(B0+10, 45, B0+11, 46);

  // B0+11
  C(B0+11,  6, 'Registered Learners as of end of the month', sBot(false, 6));  M(B0+11, 6, B0+11, 18);
  C(B0+11, 25, 'b. Individual-Related Factors', sBot(false, 5));  M(B0+11, 25, B0+11, 36);
  C(B0+11, 38, 'end of month', sStatLabel());  M(B0+11, 38, B0+11, 42);

  // B0+12
  C(B0+12, 25,
    'b.1. Illness\nb.2. Overage\nb.3. Death\nb.4. Drug Addiction\nb.5. Seasonal/Migratory Workers',
    sBot(false, 5));
  M(B0+12, 25, B0+16, 36);
  C(B0+12, 38, 'Average Daily Attendance', sStatLabel());  M(B0+12, 38, B0+13, 42);
  C(B0+12, 43, fmt1(adaM), sStat());  M(B0+12, 43, B0+13, 43);
  C(B0+12, 44, fmt1(adaF), sStat());  M(B0+12, 44, B0+13, 44);
  C(B0+12, 45, fmt1(adaT), sStat());  M(B0+12, 45, B0+13, 46);

  // B0+13
  C(B0+13, 0,
    '4. Every end of the month, the class adviser will submit this form to the principal for signature. ' +
    'The principal will then submit the accomplished form to the division office.',
    sBot(false, 6));
  M(B0+13, 0, B0+16, 23);

  // B0+14
  C(B0+14, 38, 'Percentage of Attendance for the month', sStatLabel());  M(B0+14, 38, B0+14, 42);
  C(B0+14, 43, fmt1(pctM), sStat());
  C(B0+14, 44, fmt1(pctF), sStat());
  C(B0+14, 45, fmt1(pctT), sStat());  M(B0+14, 45, B0+14, 46);

  // B0+15
  C(B0+15, 38, 'Number of students absent for 5 consecutive days', sStatLabel());  M(B0+15, 38, B0+15, 42);
  C(B0+15, 43, '', sStat());
  C(B0+15, 44, '', sStat());
  C(B0+15, 45, '', sStat());  M(B0+15, 45, B0+15, 46);

  // B0+16
  C(B0+16, 38, 'NLS', sStatLabel());  M(B0+16, 38, B0+17, 42);
  C(B0+16, 43, '', sStat());  M(B0+16, 43, B0+17, 43);
  C(B0+16, 44, '', sStat());  M(B0+16, 44, B0+17, 44);
  C(B0+16, 45, '', sStat());  M(B0+16, 45, B0+17, 46);

  // B0+17
  C(B0+17,  1, '*Beginning of School Year cut-off report is every 1st Friday of the SY.', sBot(false, 6));
  M(B0+17, 1, B0+20, 23);
  C(B0+17, 25, 'c. School-Related Factors', sBot(false, 5));  M(B0+17, 25, B0+18, 36);

  // B0+18
  C(B0+18, 38, 'Transferred out', sStatLabel());  M(B0+18, 38, B0+19, 42);
  C(B0+18, 43, '', sStat());  M(B0+18, 43, B0+19, 43);
  C(B0+18, 44, '', sStat());  M(B0+18, 44, B0+19, 44);
  C(B0+18, 45, '', sStat());  M(B0+18, 45, B0+19, 46);

  // B0+19
  C(B0+19, 25,
    'c.1. Teacher Factor\nc.2. Physical condition of classroom\nc.3. Availability of textbooks\nc.4. Others',
    sBot(false, 5));
  M(B0+19, 25, B0+22, 36);

  // B0+20
  C(B0+20, 38, 'Transferred in', sStatLabel());  M(B0+20, 38, B0+21, 42);
  C(B0+20, 43, '', sStat());  M(B0+20, 43, B0+21, 43);
  C(B0+20, 44, '', sStat());  M(B0+20, 44, B0+21, 44);
  C(B0+20, 45, '', sStat());  M(B0+20, 45, B0+21, 46);

  // B0+23
  C(B0+23, 25, 'd. Geographic/Environmental', sBot(false, 5));  M(B0+23, 25, B0+23, 36);
  C(B0+23, 38,
    'I certify that this is a true and correct report.',
    { font: fSS(6), border: brd(medium,null,null,null), alignment: aLT(true) });
  M(B0+23, 38, B0+24, 46);

  // B0+24
  C(B0+24, 25,
    'd.1. Distance between home and school\nd.2. Armed conflict\nd.3. Natural Disaster/Calamity',
    sBot(false, 5));
  M(B0+24, 25, B0+25, 36);

  // B0+25 Adviser signature line
  C(B0+25, 39, '', { border: brd(null,null,null,thin), alignment: aCC(false) });
  M(B0+25, 39, B0+25, 46);

  // B0+26
  C(B0+26, 25, 'e. Financial-Related', sBot(false, 5));  M(B0+26, 25, B0+26, 36);

  // B0+27
  C(B0+27, 25, 'e.1. Child labor, work', sBot(false, 5));  M(B0+27, 25, B0+27, 36);
  C(B0+27, 39, '(Signature of Adviser over Printed Name)', { font: fSS(6), alignment: aCC(true) });
  M(B0+27, 39, B0+28, 46);

  // B0+28
  C(B0+28, 25, 'f. Others (Specify)', sBot(false, 5));  M(B0+28, 25, B0+29, 36);

  // B0+29
  C(B0+29, 38, 'Attested by:', { font: fSS(6, true), alignment: aLC(false) });
  M(B0+29, 38, B0+29, 46);

  // B0+31 Principal signature line
  C(B0+31, 39, '', { border: brd(null,null,null,thin), alignment: aCC(false) });
  M(B0+31, 39, B0+31, 45);

  // B0+32
  C(B0+32,  0, 'Generated thru eLearning Information System (eLIS)', sBot(false, 5));
  M(B0+32, 0, B0+32, 23);
  C(B0+32, 39, '(Signature of School Head over Printed Name)', { font: fSS(6), alignment: aCC(true) });
  M(B0+32, 39, B0+32, 46);

  maxRow = B0 + 32;

  // ── Row heights ───────────────────────────────────────────────────────────────
  const dynRowHpts = [
    30, 19.9, 19.9, 19.9, 10.2, 15, 15,   // rows 0-6
    ...Array(MALE_ROWS).fill(19.9),          // male students
    19.9,                                    // male total
    ...Array(FEMALE_ROWS).fill(19.9),        // female students
    19.9,                                    // female total
    19.9,                                    // combined total
    10.2, 10.2, 10.2, 5, 5, 8, 1.9,
    10.2, 10.2, 10.2, 10.2, 10.2, 10.2,
    5, 15, 21, 9, 4.2, 6, 7.2, 3,
    10.2, 10.2, 10.2, 10.2,
    19.9, 10.2, 10.2, 10.2,
    10.9, 9, 22.9, 10.2,
  ];

  // ── Worksheet metadata ────────────────────────────────────────────────────────
  ws['!ref']    = XLS.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: TOTAL_COLS - 1 } });
  ws['!merges'] = merges;
  ws['!cols']   = COL_WIDTHS.map(w => ({ wch: w }));
  ws['!rows']   = dynRowHpts.map(h => ({ hpt: h }));

  // Print settings: landscape A4
  ws['!pageSetup'] = { orientation: 'landscape', paperSize: 9 };

  // ── Download ──────────────────────────────────────────────────────────────────
  XLS.utils.book_append_sheet(wb, ws, 'SF2');
  const wbout = XLS.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob  = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = `SF2-${section?.name ?? 'section'}-${monthName}-${calYear}.xlsx`.replace(/\s+/g, '_');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
