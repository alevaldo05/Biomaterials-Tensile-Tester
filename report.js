/* Printable report. Builds a clean one-page report inside the page, asks the browser to print it (you can
   choose "Save as PDF" in the print window), and removes it afterwards. Everything is made in this browser
   from the data in this tab; nothing is uploaded or saved.
   window.TensileReport.printRecord(info)  one test (info from the graph's reportInfo())
   window.TensileReport.printHtml(html)    any report body (used by the comparison summary)
   window.TensileReport.printBlank()       a blank one-page run sheet to fill in by hand (Learn page button) */
(function () {
  'use strict';

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  /* The graph svg carries a fixed width and height for downloads; the report scales it to the page instead. */
  function fit(svg) { return String(svg).replace(/^<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/, '<svg$1'); }

  var METHOD = 'Recorded by the tester: time, force, and crosshead displacement. Calculated by this website from the recorded values and the specimen dimensions above: engineering stress σ = F/A₀ and engineering strain ε = ΔL/L₀. The strain is estimated from crosshead displacement, not measured with an extensometer, so grip slip and deformation of the grips and frame can affect it. Key results are calculated from the plotted data using the definitions shown.';
  var FOOT_NOTE = 'Generated in this browser from data in this tab; nothing was uploaded or saved. The tester hardware connection is draft and has not been tested with the real machine.';

  function sign() {
    return '<div class="rp-sign"><span>Prepared by: ____________________</span><span>Reviewed by: ____________________</span><span>Date: ______________</span></div>';
  }
  function head(title, source) {
    return '<header class="rp-head"><div><p class="rp-kicker">Biomaterials Tensile Tester</p><h1>' + esc(title) + '</h1></div><p class="rp-draft">Draft</p></header>' +
      (source ? '<p class="rp-source"><strong>' + esc(source) + '</strong></p>' : '');
  }
  function foot() {
    return '<footer class="rp-foot"><p>Printed ' + esc(stamp()) + '. ' + esc(FOOT_NOTE) + '</p>' + sign() + '</footer>';
  }

  /* ---------- one test ---------- */
  function recordHtml(info) {
    var skip = { 'Biomaterials Tensile Tester': 1, 'Source': 1, 'Test': 1 };
    var det = (info.details || []).filter(function (d) { return !skip[d[0]] && d[1] !== '' && d[1] !== null && d[1] !== undefined; });
    return '<article class="report">' + head('Test report', info.source) +
      '<h2>' + esc(info.title) + '</h2>' +
      '<dl class="rp-details">' + det.map(function (d) { return '<div><dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd></div>'; }).join('') + '</dl>' +
      '<figure class="rp-graph">' + fit(info.svg) + '</figure>' +
      '<h2>Key results <span class="rp-tag">calculated</span></h2>' +
      '<table class="rp-table"><thead><tr><th>Result</th><th>Value</th><th>Definition</th></tr></thead><tbody>' +
      (info.results || []).map(function (q) { return '<tr><th scope="row">' + esc(q[0]) + '</th><td>' + esc(q[1]) + '</td><td>' + esc(q[2]) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<h2>How the values were obtained</h2><p class="rp-method">' + esc(METHOD) + '</p>' + foot() + '</article>';
  }

  /* ---------- printing ---------- */
  var busy = false;
  function printHtml(html) {
    if (busy) return;
    busy = true;
    var host = document.getElementById('print-report');
    if (!host) {
      host = document.createElement('div');
      host.id = 'print-report';
      document.body.appendChild(host);
    }
    host.innerHTML = html;
    document.body.classList.add('printing-report');
    function done() {
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('printing-report');
      host.innerHTML = '';
      busy = false;
    }
    window.addEventListener('afterprint', done);
    host.offsetHeight; /* let the browser lay the report out before the print window opens */
    window.print();
  }

  /* ---------- blank run sheet (a form to fill in by hand; no data, nothing stored) ---------- */
  function blankHtml() {
    var C = window.PRETEST_CHECKLIST;
    function field(label, wide) { return '<div class="rp-field' + (wide ? ' rp-wide' : '') + '"><span>' + esc(label) + '</span><i></i></div>'; }
    function box(label) { return '<span class="rp-check"><span class="rp-box"></span>' + esc(label) + '</span>'; }
    function choices(label, list, other) {
      return '<div class="rp-field rp-wide"><span>' + esc(label) + '</span><b>' + list.map(box).join('') + (other ? '<span class="rp-check"><span class="rp-box"></span>Other</span><i></i>' : '') + '</b></div>';
    }
    var lists = C && C.groups ? '<div class="rp-cols">' + C.groups.map(function (g) {
      return '<div><h3>' + esc(g.name) + '</h3><ul class="rp-checklist">' + g.items.map(function (it) {
        return '<li><span class="rp-box"></span><span>' + esc(it.text) + (it.tissue ? ' <em>(biological specimens)</em>' : '') + '</span></li>';
      }).join('') + '</ul></div>';
    }).join('') + '</div>' + (C.note ? '<p class="rp-note">' + esc(C.note) + '</p>' : '')
      : '<p class="rp-warn">The checklist file did not load, so the checklist is missing from this sheet.</p>';
    return '<article class="report rp-blank">' + head('Run sheet', 'Blank form to fill in by hand. Not a record of any test; nothing is saved.') +
      '<h2>Test</h2><div class="rp-form">' + choices('Test type', ['Uniaxial tension', 'Stress relaxation']) + field('Date') + field('Operator') + '</div>' +
      '<h2>Specimen</h2><div class="rp-form">' + field('Specimen ID') + field('Material') + field('Orientation / location (tissue)', true) +
        field('Gauge length L0 (mm)') + field('Width (mm)') + field('Thickness (mm)') + '</div>' +
      '<h2>Test settings</h2><div class="rp-form">' + field('Crosshead speed (mm/min)') + field('Temperature (°C)') +
        field('Hold displacement (mm), stress relaxation') + field('Hold time (s), stress relaxation') + field('Environment (humidity, hydration)', true) + '</div>' +
      '<h2>Pre-test checklist <span class="rp-tag">draft</span></h2>' + lists +
      '<h2>After the test</h2><div class="rp-form">' + choices('How it ended', ['Finished on its own', 'Stopped by user', 'Specimen failed'], true) + field('Data file name', true) + '</div>' +
      '<div class="rp-notes"><span>Notes</span><div class="rp-line"></div><div class="rp-line"></div><div class="rp-line"></div><div class="rp-line"></div><div class="rp-line"></div></div>' +
      '<footer class="rp-foot"><p>Printed ' + esc(stamp()) + '. Blank form made in this browser; nothing was uploaded or saved. The checklist wording is a draft for advisor review and is a reminder, not a safety certification. The on-screen STOP is not an emergency stop; the machine needs its own physical emergency stop. The tester hardware connection is draft and has not been tested with the real machine.</p>' + sign() + '</footer></article>';
  }
  function printBlank() { printHtml(blankHtml()); }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-runsheet]') : null;
    if (t) printBlank();
  });

  window.TensileReport = {
    printRecord: function (info) { printHtml(recordHtml(info)); },
    printHtml: printHtml,
    printBlank: printBlank,
    parts: { esc: esc, fit: fit, head: head, foot: foot, method: METHOD }
  };
})();
