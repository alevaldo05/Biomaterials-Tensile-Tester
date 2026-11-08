/* Excel (.xlsx) export, written by hand so the site needs no library.
   window.TensileExcel.build(info) returns a Blob. An .xlsx file is a zip of small XML files; this file
   writes the zip itself (stored, not compressed) and the XML for two sheets plus one scatter chart.
   info = { details: [[label, value], ...], results: [[name, value, definition], ...],
            columns: [{ name, values: [...] }], chart: { title, xName, yName, xTitle, yTitle, seriesName }, note }
   Checked with openpyxl and LibreOffice only; it has not been opened in Microsoft Excel. */
(function () {
  'use strict';

  var enc = new TextEncoder();

  /* ---------- zip (method 0 = stored) ---------- */
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(b) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files) {
    var d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, f.data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + size;
    });
    var cdSize = 0;
    central.forEach(function (c) { cdSize += c.byteLength !== undefined ? c.byteLength : c.length; });
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ---------- XML helpers ---------- */
  function x(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function col(i) { var s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; }
  function str(ref, v, style) { return '<c r="' + ref + '" t="inlineStr"' + (style ? ' s="' + style + '"' : '') + '><is><t xml:space="preserve">' + x(v) + '</t></is></c>'; }
  function num(ref, v) { return '<c r="' + ref + '"><v>' + v + '</v></c>'; }
  function cell(ref, v, style) {
    if (v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v))) return '';
    return typeof v === 'number' ? num(ref, v) : str(ref, v, style);
  }
  var NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  var HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

  function detailsSheet(info) {
    var rows = [], r = 1;
    function add(cells) { rows.push('<row r="' + r + '">' + cells.join('') + '</row>'); r++; }
    add([str('A' + r, 'Biomaterials Tensile Tester: test data', 1)]);
    info.details.forEach(function (d) {
      if (d[0] === 'Biomaterials Tensile Tester') return;
      add([str('A' + r, d[0], 1), cell('B' + r, d[1])]);
    });
    r++;
    add([str('A' + r, 'Key results (calculated by this website)', 1)]);
    add([str('A' + r, 'Result', 1), str('B' + r, 'Value', 1), str('C' + r, 'Definition', 1)]);
    info.results.forEach(function (q) { add([str('A' + r, q[0]), str('B' + r, q[1]), str('C' + r, q[2])]); });
    r++;
    add([str('A' + r, 'Note', 1), str('B' + r, info.note)]);
    return HEAD + '<worksheet ' + NS + '><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/><col min="3" max="3" width="70" customWidth="1"/></cols><sheetData>' + rows.join('') + '</sheetData></worksheet>';
  }

  function dataSheet(info) {
    var cols = info.columns, n = cols[0].values.length, rows = [], i, j, c;
    c = [];
    for (j = 0; j < cols.length; j++) c.push(str(col(j) + '1', cols[j].name, 1));
    rows.push('<row r="1">' + c.join('') + '</row>');
    for (i = 0; i < n; i++) {
      c = [];
      for (j = 0; j < cols.length; j++) {
        var v = cols[j].values[i];
        if (typeof v === 'number' && isFinite(v)) c.push(num(col(j) + (i + 2), v));
      }
      rows.push('<row r="' + (i + 2) + '">' + c.join('') + '</row>');
    }
    var widths = cols.map(function (q, k) { return '<col min="' + (k + 1) + '" max="' + (k + 1) + '" width="18" customWidth="1"/>'; }).join('');
    return HEAD + '<worksheet ' + NS + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><cols>' + widths + '</cols><sheetData>' + rows.join('') + '</sheetData><drawing r:id="rId1"/></worksheet>';
  }

  function chartXml(info) {
    var cols = info.columns, n = cols[0].values.length, ch = info.chart;
    function idx(name) { for (var i = 0; i < cols.length; i++) if (cols[i].name === name) return i; return 0; }
    function ref(name) { var L = col(idx(name)); return 'Data!$' + L + '$2:$' + L + '$' + (n + 1); }
    function title(t, size, rot) {
      return '<c:title><c:tx><c:rich><a:bodyPr' + (rot ? ' rot="-5400000" vert="horz"' : '') + '/><a:p><a:pPr><a:defRPr sz="' + size + '" b="0"/></a:pPr><a:r><a:rPr lang="en-US" sz="' + size + '" b="0"/><a:t>' + x(t) + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>';
    }
    function axis(id, cross, pos, t, rot) {
      return '<c:valAx><c:axId val="' + id + '"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="' + pos + '"/>' + (pos === 'l' ? '<c:majorGridlines/>' : '') + title(t, 1000, rot) +
        '<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="' + cross + '"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>';
    }
    return HEAD + '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>' +
      title(ch.title, 1200, false) + '<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>' +
      '<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>' + x(ch.seriesName) + '</c:v></c:tx><c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="2F5D44"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>' +
      '<c:xVal><c:numRef><c:f>' + ref(ch.xName) + '</c:f></c:numRef></c:xVal><c:yVal><c:numRef><c:f>' + ref(ch.yName) + '</c:f></c:numRef></c:yVal><c:smooth val="0"/></c:ser>' +
      '<c:axId val="111111111"/><c:axId val="222222222"/></c:scatterChart>' + axis(111111111, 222222222, 'b', ch.xTitle, false) + axis(222222222, 111111111, 'l', ch.yTitle, true) +
      '</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>';
  }

  function build(info) {
    var nc = info.columns.length;
    var R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    var PK = 'http://schemas.openxmlformats.org/package/2006/relationships';
    var files = {
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
      'xl/styles.xml': HEAD + '<styleSheet ' + NS + '><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
      'xl/worksheets/sheet1.xml': detailsSheet(info),
      'xl/worksheets/sheet2.xml': dataSheet(info),
      'xl/worksheets/_rels/sheet2.xml.rels': HEAD + '<Relationships xmlns="' + PK + '"><Relationship Id="rId1" Type="' + R + '/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
      'xl/drawings/drawing1.xml': HEAD + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>' + (nc + 1) + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>' + (nc + 11) + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>24</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>' +
        '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Graph"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="' + R + '" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>',
      'xl/drawings/_rels/drawing1.xml.rels': HEAD + '<Relationships xmlns="' + PK + '"><Relationship Id="rId1" Type="' + R + '/chart" Target="../charts/chart1.xml"/></Relationships>',
      'xl/charts/chart1.xml': chartXml(info)
    };
    return zip(Object.keys(files).map(function (n) { return { name: n, data: enc.encode(files[n]) }; }));
  }

  window.TensileExcel = { build: build };
})();
