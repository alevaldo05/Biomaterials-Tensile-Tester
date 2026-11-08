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
      msg('Test type changed. Choose the file again.');
    });
  });
  input.addEventListener('change', function () {
    var file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 20e6) { msg('The file is larger than 20 MB.', true); input.value = ''; return; }
    var reader = new FileReader();
    reader.onerror = function () { msg('The file could not be read.', true); };
    reader.onload = function () {
      try {
        var r = TG.fromCSV(file.name, String(reader.result), testType());
        TG.mount(graph, { test: testType(), mode: 'load', record: r });
        msg('Opened ' + file.name + ': ' + r.x.length + ' points' + (r.simulated ? ' (simulated, not measured)' : '') + '. ' +
          (r.direct ? '' : r.dimsFromFile ? 'Dimensions come from the file.' : 'This file does not contain enough information for dimension-based calculations. Example dimensions are not measurements; enter the specimen’s measured dimensions below the graph.'));
      } catch (err) {
        graph.innerHTML = '';
        msg(err.message, true);
      }
      input.value = '';
    };
    reader.readAsText(file);
  });
})();
