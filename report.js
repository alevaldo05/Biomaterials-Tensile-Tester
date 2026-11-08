/* Printable report. Builds a clean one-page report inside the page, asks the browser to print it (you can
   choose "Save as PDF" in the print window), and removes it afterwards. Everything is made in this browser
   from the data in this tab; nothing is uploaded or saved.
   window.TensileReport.printRecord(info)  one test (info from the graph's reportInfo())
   window.TensileReport.printHtml(html)    any report body (used by the comparison summary) */
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

  window.TensileReport = {
    printRecord: function (info) { printHtml(recordHtml(info)); },
    printHtml: printHtml,
    parts: { esc: esc, fit: fit, head: head, foot: foot, method: METHOD }
  };
})();
