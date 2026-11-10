/* Load Test page: choose the test type, then a CSV file; the graph, key results, and editable
   dimensions come from graph.js. The file is read in this browser tab only (not uploaded or saved). */
(function () {
  'use strict';
  var TG = window.TensileGraph;
  var btn = document.getElementById('load-btn');
  var input = document.getElementById('load-file');
  var msgEl = document.getElementById('load-msg');
  var graph = document.getElementById('graph-app');
  if (!TG || !btn || !input || !graph) return;

  function msg(text, isError) {
    msgEl.textContent = (isError ? 'Could not open the file. ' : '') + text;
    msgEl.className = 'csv-msg' + (isError ? ' error' : '');
  }
  /* "Need help?" and the one-minute hint use the sentence this page already shows under its title. */
  if (window.HelpCoach) window.HelpCoach.setContext({ key: 'load', title: 'Load Test', tutorial: 'load-compare', lines: function () { var s = document.querySelector('.sub'); return [s ? s.textContent : '']; } });
  function testType() { return document.querySelector('input[name="load-test"]:checked').value; }

  /* Mode switch: "Open one file" (below, unchanged) or "Compare several files" (compare.js). */
  document.querySelectorAll('input[name="load-mode"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      var cmp = r.value === 'compare';
      document.getElementById('mode-one').hidden = cmp;
      document.getElementById('mode-compare').hidden = !cmp;
      graph.hidden = cmp;
      document.getElementById('compare-app').hidden = !cmp;
    });
  });

  btn.addEventListener('click', function () { input.click(); });
  document.querySelectorAll('input[name="load-test"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (!graph.innerHTML) return;
      graph.innerHTML = '';
      document.getElementById('load-form').classList.remove('loaded');
      btn.textContent = 'Choose CSV file';
      msg('Test type changed. Choose the file again.');
    });
  });
  input.addEventListener('change', function () {
    var file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 20e6) { msg('The file is larger than 20 MB.', true); input.value = ''; return; }
    var reader = new FileReader();
    reader.onerror = function () { msg('The file could not be read.', true); if (window.HelpCoach) window.HelpCoach.report('csv'); };
    reader.onload = function () {
      try {
        var r = TG.fromCSV(file.name, String(reader.result), testType());
        TG.mount(graph, { test: testType(), mode: 'load', record: r });
        document.getElementById('load-form').classList.add('loaded');
        btn.textContent = 'Open another file';
        if (window.HelpCoach) window.HelpCoach.setContext(null);
        msg('Opened ' + file.name + ': ' + r.x.length + ' points' + (r.simulated ? ' (simulated, not measured)' : '') + '. ' +
          (r.direct ? '' : r.dimsFromFile ? 'Dimensions come from the file.' : 'This file does not contain enough information for dimension-based calculations. Example dimensions are not measurements; enter the specimen’s measured dimensions below the graph.'));
      } catch (err) {
        graph.innerHTML = '';
        document.getElementById('load-form').classList.remove('loaded');
        btn.textContent = 'Choose CSV file';
        msg(err.message, true);
        if (window.HelpCoach) window.HelpCoach.report('csv');
      }
      input.value = '';
    };
    reader.readAsText(file);
  });

  /* Dropping a file (or, in Compare mode, several) anywhere on the page opens it exactly as the Choose button does.
     Nothing is uploaded; the browser only hands the page the file. */
  var dragDepth = 0, main = document.querySelector('main');
  function hasFiles(e) { return !!(e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') >= 0); }
  document.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; if (main) main.classList.add('drop-active'); });
  document.addEventListener('dragover', function (e) { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  document.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth && main) main.classList.remove('drop-active'); });
  document.addEventListener('drop', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth = 0; if (main) main.classList.remove('drop-active');
    var compare = !document.getElementById('mode-compare').hidden;
    var target = compare ? document.getElementById('cmp-file') : input;
    try { target.files = e.dataTransfer.files; } catch (err) { msg('The dropped file could not be taken. Use the Choose button instead.', true); return; }
    target.dispatchEvent(new Event('change', { bubbles: true }));
  });
})();
