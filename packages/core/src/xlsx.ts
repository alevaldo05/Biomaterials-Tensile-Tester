/* Excel (.xlsx) export, written by hand so no library is needed (port of excel-export.js).
   An .xlsx file is a zip of small XML files; this writes the zip itself (stored, not compressed)
   and the XML for two sheets plus one scatter chart. It returns the file bytes.
   Checked with openpyxl and LibreOffice only; it has not been opened in Microsoft Excel. */

export type XlsxCellValue = string | number | null | undefined;

/* Test data workbook: a Details sheet and a Data sheet with a scatter chart. */
export interface XlsxInfo {
  details: [string, XlsxCellValue][];
  results: [string, string, string][];
  columns: { name: string; values: number[] }[];
  chart: { title: string; xName: string; yName: string; xTitle: string; yTitle: string; seriesName: string };
  note: string;
}

/* Comparison workbook: one Summary sheet (details, then a table with a row per specimen, then mean, standard deviation, n). */
export interface XlsxCompareInfo {
  details: [string, XlsxCellValue][];
  header: string[];
  rows: XlsxCellValue[][];
}

/* The project's TypeScript setting has no DOM types, so the one global used here is declared. */
declare const TextEncoder: new () => { encode(input: string): Uint8Array };

const enc = new TextEncoder();

/* ---------- zip (method 0 = stored) ---------- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = (CRC[(c ^ (b[i] ?? 0)) & 0xFF] ?? 0) ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

interface ZipFile { name: string; data: Uint8Array }

/* The time stamp inside the zip is the local time of `d` (the page passes the current time). */
function zip(files: ZipFile[], d: Date): Uint8Array {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  files.forEach((f) => {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + size;
  });
  let cdSize = 0;
  central.forEach((c) => { cdSize += c.length; });
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = parts.concat(central, [new Uint8Array(end.buffer)]);
  let total = 0;
  all.forEach((p) => { total += p.length; });
  const out = new Uint8Array(total);
  let pos = 0;
  all.forEach((p) => { out.set(p, pos); pos += p.length; });
  return out;
}

/* ---------- XML helpers ---------- */
function x(s: unknown): string {
  return String(s === null || s === undefined ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function col(i: number): string {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}
function str(ref: string, v: unknown, style?: number): string {
  return '<c r="' + ref + '" t="inlineStr"' + (style ? ' s="' + style + '"' : '') + '><is><t xml:space="preserve">' + x(v) + '</t></is></c>';
}
function num(ref: string, v: number): string { return '<c r="' + ref + '"><v>' + v + '</v></c>'; }
function cell(ref: string, v: XlsxCellValue, style?: number): string {
  if (v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v))) return '';
  return typeof v === 'number' ? num(ref, v) : str(ref, v, style);
}
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PK = 'http://schemas.openxmlformats.org/package/2006/relationships';
const STYLES = HEAD + '<styleSheet ' + NS + '><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

function detailsSheet(info: XlsxInfo): string {
  const rows: string[] = [];
  let r = 1;
  const add = (cells: string[]): void => { rows.push('<row r="' + r + '">' + cells.join('') + '</row>'); r++; };
  add([str('A' + r, 'Biomaterials Tensile Tester: test data', 1)]);
  info.details.forEach((d) => {
    if (d[0] === 'Biomaterials Tensile Tester') return;
    add([str('A' + r, d[0], 1), cell('B' + r, d[1])]);
  });
  r++;
  add([str('A' + r, 'Key results (calculated by this website)', 1)]);
  add([str('A' + r, 'Result', 1), str('B' + r, 'Value', 1), str('C' + r, 'Definition', 1)]);
  info.results.forEach((q) => { add([str('A' + r, q[0]), str('B' + r, q[1]), str('C' + r, q[2])]); });
  r++;
  add([str('A' + r, 'Note', 1), str('B' + r, info.note)]);
  return HEAD + '<worksheet ' + NS + '><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/><col min="3" max="3" width="70" customWidth="1"/></cols><sheetData>' + rows.join('') + '</sheetData></worksheet>';
}

function dataSheet(info: XlsxInfo): string {
  const cols = info.columns, n = cols[0]?.values.length ?? 0;
  const rows: string[] = [];
  let c: string[] = [];
  for (let j = 0; j < cols.length; j++) c.push(str(col(j) + '1', cols[j]?.name, 1));
  rows.push('<row r="1">' + c.join('') + '</row>');
  for (let i = 0; i < n; i++) {
    c = [];
    for (let j = 0; j < cols.length; j++) {
      const v = cols[j]?.values[i];
      if (typeof v === 'number' && isFinite(v)) c.push(num(col(j) + (i + 2), v));
    }
    rows.push('<row r="' + (i + 2) + '">' + c.join('') + '</row>');
  }
  const widths = cols.map((_q, k) => '<col min="' + (k + 1) + '" max="' + (k + 1) + '" width="18" customWidth="1"/>').join('');
  return HEAD + '<worksheet ' + NS + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><cols>' + widths + '</cols><sheetData>' + rows.join('') + '</sheetData><drawing r:id="rId1"/></worksheet>';
}

function chartXml(info: XlsxInfo): string {
  const cols = info.columns, n = cols[0]?.values.length ?? 0, ch = info.chart;
  const idx = (name: string): number => { for (let i = 0; i < cols.length; i++) if (cols[i]?.name === name) return i; return 0; };
  const ref = (name: string): string => { const L = col(idx(name)); return 'Data!$' + L + '$2:$' + L + '$' + (n + 1); };
  const title = (t: string, size: number, rot: boolean): string =>
    '<c:title><c:tx><c:rich><a:bodyPr' + (rot ? ' rot="-5400000" vert="horz"' : '') + '/><a:p><a:pPr><a:defRPr sz="' + size + '" b="0"/></a:pPr><a:r><a:rPr lang="en-US" sz="' + size + '" b="0"/><a:t>' + x(t) + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>';
  const axis = (id: number, cross: number, pos: string, t: string, rot: boolean): string =>
    '<c:valAx><c:axId val="' + id + '"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="' + pos + '"/>' + (pos === 'l' ? '<c:majorGridlines/>' : '') + title(t, 1000, rot) +
    '<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="' + cross + '"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>';
  return HEAD + '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>' +
    title(ch.title, 1200, false) + '<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>' +
    '<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>' + x(ch.seriesName) + '</c:v></c:tx><c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="2F5D44"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>' +
    '<c:xVal><c:numRef><c:f>' + ref(ch.xName) + '</c:f></c:numRef></c:xVal><c:yVal><c:numRef><c:f>' + ref(ch.yName) + '</c:f></c:numRef></c:yVal><c:smooth val="0"/></c:ser>' +
    '<c:axId val="111111111"/><c:axId val="222222222"/></c:scatterChart>' + axis(111111111, 222222222, 'b', ch.xTitle, false) + axis(222222222, 111111111, 'l', ch.yTitle, true) +
    '</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>';
}

function toZip(files: Record<string, string>, date: Date): Uint8Array {
  return zip(Object.entries(files).map(([name, text]) => ({ name, data: enc.encode(text) })), date);
}

/* The test data workbook. `date` is the time stamp stored in the zip entries (the page uses the current time). */
export function buildXlsx(info: XlsxInfo, date: Date = new Date()): Uint8Array {
  const nc = info.columns.length;
  const files: Record<string, string> = {
    '[Content_Types].xml': HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' +
      '<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>',
    '_rels/.rels': HEAD + '<Relationships xmlns="' + PK + '"><Relationship Id="rId1" Type="' + R + '/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': HEAD + '<workbook ' + NS + ' xmlns:r="' + R + '"><sheets><sheet name="Details" sheetId="1" r:id="rId1"/><sheet name="Data" sheetId="2" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': HEAD + '<Relationships xmlns="' + PK + '"><Relationship Id="rId1" Type="' + R + '/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + R + '/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="' + R + '/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': STYLES,
    'xl/worksheets/sheet1.xml': detailsSheet(info),
    'xl/worksheets/sheet2.xml': dataSheet(info),
    'xl/worksheets/_rels/sheet2.xml.rels': HEAD + '<Relationships xmlns="' + PK + '"><Relationship Id="rId1" Type="' + R + '/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
    'xl/drawings/drawing1.xml': HEAD + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>' + (nc + 1) + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>' + (nc + 11) + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>24</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>' +
      '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Graph"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="' + R + '" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>',
    'xl/drawings/_rels/drawing1.xml.rels': HEAD + '<Relationships xmlns="' + PK + '"><Relationship Id="rId1" Type="' + R + '/chart" Target="../charts/chart1.xml"/></Relationships>',
    'xl/charts/chart1.xml': chartXml(info),
  };
  return toZip(files, date);
}

/* The comparison workbook: one Summary sheet. */
export function buildCompareXlsx(info: XlsxCompareInfo, date: Date = new Date()): Uint8Array {
  const rows: string[] = [];
  let r = 1;
  const add = (cells: string[]): void => { rows.push('<row r="' + r + '">' + cells.join('') + '</row>'); r++; };
  add([str('A' + r, 'Biomaterials Tensile Tester: comparison summary', 1)]);
  info.details.forEach((d) => { add([str('A' + r, d[0], 1), cell('B' + r, d[1])]); });
  r++;
  add(info.header.map((h, j) => str(col(j) + r, h, 1)));
  info.rows.forEach((row) => { const rr = r; add(row.map((v, j) => cell(col(j) + rr, v))); });
  const sheet = HEAD + '<worksheet ' + NS + '><cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="' + info.header.length + '" width="22" customWidth="1"/></cols><sheetData>' + rows.join('') + '</sheetData></worksheet>';
  const files: Record<string, string> = {
    '[Content_Types].xml': HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': HEAD + '<Relationships xmlns="' + PK + '"><Relationship Id="rId1" Type="' + R + '/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': HEAD + '<workbook ' + NS + ' xmlns:r="' + R + '"><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': HEAD + '<Relationships xmlns="' + PK + '"><Relationship Id="rId1" Type="' + R + '/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + R + '/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': STYLES,
    'xl/worksheets/sheet1.xml': sheet,
  };
  return toZip(files, date);
}
