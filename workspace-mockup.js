/* Workspace mock-up (workspace-mockup.html). DEMO ONLY: a canned curve is drawn when you press Start recording. It uses no Web Serial, no real simulator,
   no calculation code from the site, and saves or sends nothing. Every value shown is labeled "Mock-up: demo data, not measured". */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var NS = 'http://www.w3.org/2000/svg';
  var grid = $('wm-grid'), side = $('wm-side'), work = $('wm-work'), plot = $('wm-plot');
  var narrow = window.matchMedia ? window.matchMedia('(max-width: 1100px)') : { matches: false };

  /* Hover and Tab-focus definitions: the site's own mechanism (data-term, ui.js, data/terms.js). These entries are added for the mock-up page only. */
  window.TERMS = window.TERMS || {};
  var MT = window.TERMS;
  MT.wm_force = { name: 'Force, F', def: 'Axial force reading from the tester. In this mock-up it is simulated. It shows \u2014 until a reading arrives.', eq: '', unit: 'N' };
  MT.wm_disp = { name: 'Displacement', def: 'Crosshead movement since the start of the recording. This is not the specimen\u2019s own strain.', eq: '', unit: 'mm' };
  MT.wm_elapsed = { name: 'Elapsed time', def: 'Time since Start recording. Here: displacement divided by the crosshead speed you entered.', eq: 't = displacement / speed', unit: 's' };
  MT.wm_state = { name: 'Recording status', def: 'Whether readings are being saved. Ending the recording does not stop the tester; STOP tester sends the stop command and is not an emergency stop.', eq: '', unit: '' };
  MT.wm_src = { name: 'Data source', def: 'Says whether the data is simulated or measured. Everything on this mock-up is demo data, not measured.', eq: '', unit: '' };
  MT.wm_peakF = { name: 'Peak force', def: 'Largest force recorded during the test.', eq: '', unit: 'N' };
  MT.wm_duration = { name: 'Duration', def: 'Time from the start of the recording to the last reading.', eq: '', unit: 's' };
  MT.wm_toe = { name: 'End of toe (approximate)', def: 'Where the slope first reaches half of the steepest slope. There is no standard definition; shown for illustration only.', eq: '', unit: 'mm/mm' };
  MT.wm_fit = { name: 'Modulus fit line', def: 'Straight line fitted (least squares) over the steepest window of the loading curve. Its slope is the modulus estimate E.', eq: '\u03c3 = E\u03b5 + b', unit: 'MPa' };
  MT.wm_offsetyield = { name: 'Offset yield (estimate)', def: 'Stress where the curve crosses a copy of the fitted modulus line moved right by the offset shown. It is a method-dependent estimate. Soft tissue has no standard yield point, so for simulated skin the value is illustrative.', eq: '\u03c3 = E\u03b5 + b \u2212 E \u00b7 offset', unit: 'MPa' };
  MT.wm_offsetinput = { name: 'Include offset yield (optional)', def: 'Tick this to calculate an offset yield after the test; then enter the offset in % strain (0.05 to 5; 0.2 is common). Leave it unticked and no offset yield is shown anywhere. The offset line is the fitted modulus line moved right by the offset, starting from the fitted line\u2019s own intercept, which compensates for a toe region. It is a method-dependent estimate; for simulated skin it is illustrative, because soft tissue has no standard yield point. It is set before the test and locks with the other entries.', eq: '\u03c3 = E\u03b5 + b \u2212 E \u00b7 offset', unit: '% strain' };
  MT.wm_modulus = { name: 'Modulus estimate, E (fitted slope)', def: 'Slope of the steepest window of the loading curve, fitted by least squares. One value for the curve; it depends on which window is used.', eq: 'E = \u0394\u03c3 / \u0394\u03b5', unit: 'MPa' };

  /* ---------- inputs ---------- */
  function num(id) { var v = parseFloat(String($(id).value).replace(',', '.')); return isFinite(v) && v > 0 ? v : null; }
  function dims() { var L = num('wm-L0'), W = num('wm-W'), T = num('wm-T'); return { L0: L, A: W && T ? W * T : null }; }
  function matOk() { return String($('wm-mat').value).trim().length > 0; }
  var touched = {}, FIELDS = ['wm-mat', 'wm-L0', 'wm-W', 'wm-T', 'wm-speed', 'wm-offset'];
  function offsetReady() { if (!offsetOn()) return true; var v = offsetValue(); return v !== null && v === v; }
  function offsetOn() { return $('wm-useoff').checked; }
  function flagBad() {
    var bad = { 'wm-mat': !matOk(), 'wm-L0': !num('wm-L0'), 'wm-W': !num('wm-W'), 'wm-T': !num('wm-T'), 'wm-speed': !num('wm-speed') };
    bad['wm-offset'] = offsetOn() && (function () { var v = offsetValue(); return v === null || v !== v; })();
    for (var k in bad) {
      var show = !!(bad[k] && touched[k] && !$(k).disabled);
      $(k).classList.toggle('wm-bad', show);
      if (show) $(k).setAttribute('aria-invalid', 'true'); else $(k).removeAttribute('aria-invalid');
    }
  }
  FIELDS.forEach(function (id) { $(id).addEventListener('blur', function () { touched[id] = true; flagBad(); }); });
  function updateInputs() {
    var d = dims(); $('wm-A').textContent = d.A ? d.A.toFixed(2) : '—';
    var ok = matOk() && d.L0 && d.A && num('wm-speed') && offsetReady(); flagBad();
    $('wm-review').textContent = ok ? 'Ready: ' + $('wm-mat').value.trim() + ', L₀ ' + d.L0 + ' mm, A₀ ' + d.A.toFixed(2) + ' mm², speed ' + num('wm-speed') + ' mm/min' + (offsetOn() ? ', offset yield at ' + $('wm-offset').value.trim() + '% offset' : '') + '.'
      : 'Fill every field marked *: material, gauge length, width, thickness, and speed' + (offsetOn() ? ', and the offset' : '') + '. Then connect (toolbar) and press Start recording.';
    refreshState(); draw();
  }
  ['wm-L0', 'wm-W', 'wm-T', 'wm-speed', 'wm-offset'].forEach(function (id) { $(id).addEventListener('input', updateInputs); });
  $('wm-useoff').addEventListener('change', function () { $('wm-offwrap').hidden = !this.checked; if (!this.checked) { $('wm-offset').value = ''; delete touched['wm-offset']; } updateInputs(); });
  $('wm-mat').addEventListener('input', updateInputs);
  $('wm-fill-dims').addEventListener('click', function () { if (this.disabled) return; $('wm-L0').value = '20'; $('wm-W').value = '5'; $('wm-T').value = '1.2'; updateInputs(); });
  $('wm-fill-set').addEventListener('click', function () { if (this.disabled) return; $('wm-speed').value = '30'; updateInputs(); });

  /* ---------- material: choose from the list or type your own ---------- */
  (function () {
    var inp = $('wm-mat'), list = $('wm-mat-list'), btn = $('wm-mat-btn'), cur = -1;
    function items() { return [].slice.call(list.children); }
    function open(on) { list.hidden = !on; inp.setAttribute('aria-expanded', String(on)); if (!on) { cur = -1; items().forEach(function (li) { li.classList.remove('is-cur'); }); } }
    function pick(v) { inp.value = v; open(false); updateInputs(); inp.focus(); }
    function mark(i) { var it = items(); cur = (i + it.length) % it.length; it.forEach(function (li, k) { li.classList.toggle('is-cur', k === cur); }); }
    btn.addEventListener('click', function () { open(list.hidden); inp.focus(); });
    items().forEach(function (li) { li.addEventListener('mousedown', function (e) { e.preventDefault(); pick(li.getAttribute('data-v')); }); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) open(true); mark(cur + 1); }
      else if (e.key === 'ArrowUp' && !list.hidden) { e.preventDefault(); mark(cur - 1); }
      else if (e.key === 'Enter' && !list.hidden && cur >= 0) { e.preventDefault(); pick(items()[cur].getAttribute('data-v')); }
      else if (e.key === 'Escape' && !list.hidden) { e.stopPropagation(); open(false); }
    });
    inp.addEventListener('blur', function () { setTimeout(function () { open(false); }, 120); });
  })();

  /* ---------- setup sidebar: hide, show, drawer ---------- */
  function sideToggle() {
    if (narrow.matches) { side.classList.remove('is-open'); return; }
    var c = grid.classList.toggle('is-collapsed');
    $('wm-side-toggle').textContent = c ? '»' : '« Hide setup';
    $('wm-side-toggle').setAttribute('aria-expanded', String(!c));
    $('wm-side-toggle').setAttribute('aria-label', c ? 'Show setup' : 'Hide setup');
    setTimeout(draw, 0);
  }
  $('wm-side-toggle').addEventListener('click', sideToggle);
  $('wm-setup-open').addEventListener('click', function () { side.classList.add('is-open'); $('wm-side-toggle').textContent = 'Close'; $('wm-side-toggle').focus(); });
  function syncSideLabel() { if (narrow.matches) { $('wm-side-toggle').textContent = 'Close'; $('wm-side-toggle').setAttribute('aria-label', 'Close setup'); } else { side.classList.remove('is-open'); var c = grid.classList.contains('is-collapsed'); $('wm-side-toggle').textContent = c ? '»' : '« Hide setup'; $('wm-side-toggle').setAttribute('aria-label', c ? 'Show setup' : 'Hide setup'); } draw(); }
  if (narrow.addEventListener) narrow.addEventListener('change', syncSideLabel); else if (narrow.addListener) narrow.addListener(syncSideLabel);

  /* ---------- state ---------- */
  var state = 'idle';       /* idle (not connected), ready, recording, ended */
  var timer = null, data = { t: [], d: [], f: [] }, tick = 0, SIM_STEP = 0.2, TOTAL = 62;
  /* Demo curve (illustrative shape, NOT the site\u2019s sample data and not measured): a toe (exponential), a linear region, a rounded peak, then a gradual drop to failure.
     Constants: toe to strain 0.25 joining a linear region of E = 40 MPa; linear to 0.50; rounded to a peak of about 16 MPa at strain 0.65; then a decline over about 0.08 strain. */
  var DEMO = { E: 40, B: 12, e1: 0.25, e2: 0.50, ep: 0.65, w: 0.08 };
  DEMO.a = DEMO.E / (DEMO.B * Math.exp(DEMO.B * DEMO.e1));
  DEMO.s1 = DEMO.a * (Math.exp(DEMO.B * DEMO.e1) - 1);
  DEMO.s2 = DEMO.s1 + DEMO.E * (DEMO.e2 - DEMO.e1);
  DEMO.c = DEMO.E / (2 * (DEMO.ep - DEMO.e2));
  DEMO.sp = DEMO.s2 + DEMO.E * (DEMO.ep - DEMO.e2) - DEMO.c * Math.pow(DEMO.ep - DEMO.e2, 2);
  function demoStress(e) {
    if (e <= DEMO.e1) return DEMO.a * (Math.exp(DEMO.B * e) - 1);
    if (e <= DEMO.e2) return DEMO.s1 + DEMO.E * (e - DEMO.e1);
    if (e <= DEMO.ep) return DEMO.s2 + DEMO.E * (e - DEMO.e2) - DEMO.c * Math.pow(e - DEMO.e2, 2);
    var sdrop = (e - DEMO.ep) / DEMO.w;
    return DEMO.sp * Math.max(0, 1 - 0.9 * Math.pow(sdrop, 1.7));
  }
  var sim = null;
  function noise() { return Math.random() + Math.random() + Math.random() - 1.5; }
  function makeSim() {
    var d = dims(), speed = num('wm-speed') || 30;
    return { A: d.A, L0: d.L0, v: speed / 60, dE: 0.0016, peak: DEMO.sp * d.A, N: 700, k: 0, failedAt: 0 };
  }
  function setStatus(label, dotClass) { $('wm-state').textContent = label; $('wm-dot').className = 'dot' + (dotClass ? ' ' + dotClass : ''); }
  var saved = false;
  var LOCKABLE = ['wm-mat', 'wm-id', 'wm-L0', 'wm-W', 'wm-T', 'wm-speed', 'wm-temp', 'wm-offset', 'wm-useoff'];
  function applyLock() {
    var lock = state === 'recording' || state === 'ended';
    LOCKABLE.forEach(function (id) { $(id).disabled = lock; });
    ['wm-fill-dims', 'wm-fill-set', 'wm-mat-btn'].forEach(function (id) { $(id).disabled = lock; });
    var l = $('wm-lock'); l.hidden = !lock;
    l.textContent = state === 'recording' ? 'Locked while recording.' : 'Locked: this test\u2019s data cannot be changed. Save it, or choose New test.';
    flagBad();
  }
  function refreshState() {
    var d = dims(), ready = state === 'ready', ok = ready && matOk() && d.L0 && d.A && num('wm-speed') && offsetReady();
    $('wm-start').disabled = !ok;
    $('wm-end').disabled = state !== 'recording';
    $('wm-stop').disabled = state === 'idle';
    $('wm-tare').disabled = state !== 'ready';
    $('wm-sim').hidden = state !== 'idle'; $('wm-usb').hidden = state !== 'idle'; $('wm-off').hidden = state === 'idle' || state === 'recording'; $('wm-conn').hidden = state === 'idle';
    $('wm-end').hidden = state === 'ended'; $('wm-save').hidden = state !== 'ended'; $('wm-new').hidden = state !== 'ended'; $('wm-save').disabled = saved; $('wm-save').textContent = saved ? 'Saved (demo)' : 'Save data';
    applyLock();
    $('wm-p-cust').hidden = state !== 'ended';
    $('wm-dock').hidden = state !== 'recording'; document.body.classList.toggle('has-stop-dock', state === 'recording');
    var why = '';
    if (state === 'idle') why = 'Not connected. Choose Use simulator to try the demo.';
    else if (state === 'ready' && !ok) why = 'Start recording is unavailable: fill the fields marked * in Setup (material, gauge length, width, thickness, speed' + (offsetOn() ? ', offset' : '') + ').';
    else if (state === 'ready') why = 'Connected to the demo. Press Start recording.';
    else if (state === 'recording') why = 'Recording. End recording stops saving readings; it does not stop the tester. STOP tester sends the stop command.';
    else if (state === 'ended') why = saved ? 'Saved (demo): nothing was downloaded. You can close this page, or choose New test.' : 'Recording ended. Save the data, or choose New test. Key results are below the graph.';
    $('wm-why').textContent = why;
    viewButtons();
  }
  function viewButtons() {
    var d = dims();
    [].forEach.call(document.querySelectorAll('.wm-tab'), function (b) {
      var v = b.getAttribute('data-view'), need = v === 'ss' && !(d.L0 && d.A);
      b.setAttribute('aria-disabled', need ? 'true' : 'false');
      b.classList.toggle('is-on', v === view);
      b.setAttribute('aria-pressed', String(v === view));
    });
    var w = $('wm-vwhy'), needSS = !(d.L0 && d.A);
    w.hidden = !needSS; w.textContent = needSS ? 'Stress–strain is unavailable until the gauge length, width, and thickness are entered.' : '';
  }
  $('wm-sim').addEventListener('click', function () {
    state = 'ready'; data = { t: [], d: [], f: [] }; setStatus('Connected · ready'); $('wm-src').textContent = 'No data yet'; showReadout(null); refreshState(); draw();
  });
  $('wm-usb').addEventListener('click', function () {
    $('wm-why').textContent = 'USB is not part of the mock-up. In the finished page this opens the browser’s port chooser (Chrome only). The hardware connection is untested.';
  });
  $('wm-tare').addEventListener('click', function () { $('wm-why').textContent = 'Tare sets the current reading to zero. Tare is not a calibration. (Demo: nothing changes.)'; });
  $('wm-start').addEventListener('click', function () {
    if ($('wm-start').disabled) return;
    state = 'recording'; data = { t: [], d: [], f: [] }; tick = 0; autoRange = null; view0 = null; viewWin = null; cursorIdx = null; cursorKey = null; kpRes = null; updateReadoutPanel();
    setStatus('Recording', 'run'); $('wm-src').textContent = 'Mock-up: demo data, not measured';
    $('wm-p-res').open = false; $('wm-res').innerHTML = '<p class="small muted">Available when the recording ends.</p>';
    if (!narrow.matches) { grid.classList.add('is-collapsed'); $('wm-side-toggle').textContent = '»'; $('wm-side-toggle').setAttribute('aria-expanded', 'false'); $('wm-side-toggle').setAttribute('aria-label', 'Show setup'); }
    refreshState(); draw();
    sim = makeSim(); timer = setInterval(step, 40);
  });
  function step() {
    sim.k++;
    var eps = sim.k * sim.dE, sg = demoStress(eps), d = eps * sim.L0;
    var F = sg * sim.A + 0.0008 * sim.peak * noise();
    data.t.push(d / sim.v); data.d.push(d); data.f.push(F);
    showReadout(data.t.length - 1); draw();
    if (eps > DEMO.ep && sg < 0.5 * DEMO.sp && !sim.failedAt) sim.failedAt = sim.k;   /* like the auto-stop option: stop a few points after the force has fallen below half of the peak */
    if ((sim.failedAt && sim.k >= sim.failedAt + 5) || sim.k >= sim.N) endRecording('Recording ended: the simulated specimen failed (force fell below half of the peak).');
  }
  function endRecording(msg) {
    if (timer) { clearInterval(timer); timer = null; }
    if (state !== 'recording') return;
    state = 'ended'; setStatus('Ended'); refreshState();
    if (msg) $('wm-why').textContent = msg;
    computeKeyResults(); $('wm-kp-yield').closest('label').hidden = !(kpRes && kpRes.use); if (!(kpRes && kpRes.use)) $('wm-kp-yield').checked = false; renderResults(); $('wm-p-res').open = true; $('wm-p-cust').open = true; draw();
  }
  $('wm-end').addEventListener('click', function () { endRecording('Recording ended. The tester was not sent a stop command.'); });
  function stopTester() {
    if (state === 'idle') return;
    var wasRec = state === 'recording';
    if (wasRec) endRecording();
    $('wm-why').textContent = 'STOP tester pressed: in the finished page this sends the stop command to the tester (not an emergency stop). Demo: nothing was sent.';
  }

  /* ---------- after the test: save, or start a new test ---------- */
  function doSave() { saved = true; refreshState(); }
  function resetAll(to) {   /* to: 'ready' (New test, stays connected) or 'idle' (Disconnect, back to Not connected) */
    if (timer) { clearInterval(timer); timer = null; }
    data = { t: [], d: [], f: [] }; tick = 0; viewWin = null; cursorIdx = null; cursorKey = null; saved = false; touched = {}; kpRes = null; sim = null; resetCust();
    LOCKABLE.forEach(function (id) { if ($(id).type === 'checkbox') $(id).checked = false; else $(id).value = ''; });
    $('wm-offwrap').hidden = true; $('wm-kp-yield').closest('label').hidden = false; $('wm-kp-yield').checked = false;
    state = to === 'idle' ? 'idle' : 'ready'; setStatus(to === 'idle' ? 'Not connected' : 'Connected \u00b7 ready'); $('wm-src').textContent = 'No data yet';
    $('wm-res').innerHTML = '<p class="small muted">Available when the recording ends.</p>'; $('wm-p-res').open = false;
    showReadout(null); updateReadoutPanel(); updateInputs();
    if (!narrow.matches) { grid.classList.remove('is-collapsed'); $('wm-side-toggle').textContent = '\u00ab Hide setup'; $('wm-side-toggle').setAttribute('aria-expanded', 'true'); $('wm-side-toggle').setAttribute('aria-label', 'Hide setup'); }
    $('wm-why').textContent = to === 'idle' ? 'Disconnected. The test data was cleared. Choose Use simulator to start again.' : 'New test: fill the fields marked * in Setup, then press Start recording.';
  }
  function disconnect() {
    if (state === 'ended') { if (saved) resetAll('idle'); else openDlg('disconnect'); return; }
    state = 'idle'; setStatus('Not connected'); $('wm-src').textContent = 'No data yet'; data = { t: [], d: [], f: [] }; showReadout(null); refreshState(); draw();
  }
  $('wm-off').addEventListener('click', disconnect);
  var modal = $('wm-modal'), lastFocus = null, dlgMode = 'new';
  var DLG = {
    'new': { t: 'Save this test before you start a new one?', d: 'This test has not been saved. Starting a new test clears its data from this page.', a: 'Save and start new test', b: 'Don\u2019t save, start new test', to: 'ready' },
    'disconnect': { t: 'Save this test before you disconnect?', d: 'This test has not been saved. Disconnecting clears its data from this page.', a: 'Save and disconnect', b: 'Don\u2019t save, disconnect', to: 'idle' }
  };
  function openDlg(mode) {
    dlgMode = mode || 'new'; var m = DLG[dlgMode];
    $('wm-dlg-t').textContent = m.t; $('wm-dlg-d').textContent = m.d; $('wm-dlg-save').textContent = m.a; $('wm-dlg-nosave').textContent = m.b;
    lastFocus = document.activeElement; modal.hidden = false; $('wm-dlg-save').focus();
  }
  function closeDlg() { modal.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  $('wm-save').addEventListener('click', doSave);
  $('wm-new').addEventListener('click', function () { if (saved) resetAll('ready'); else openDlg('new'); });
  $('wm-dlg-save').addEventListener('click', function () { doSave(); modal.hidden = true; resetAll(DLG[dlgMode].to); });
  $('wm-dlg-nosave').addEventListener('click', function () { modal.hidden = true; resetAll(DLG[dlgMode].to); });
  $('wm-dlg-cancel').addEventListener('click', closeDlg);
  modal.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDlg(); return; }
    if (e.key !== 'Tab') return;
    var b = [].slice.call(modal.querySelectorAll('button')), f = b[0], l = b[b.length - 1];
    if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l.focus(); } else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f.focus(); }
  });
  $('wm-stop').addEventListener('click', stopTester);
  $('wm-stop-dock').addEventListener('click', stopTester);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state === 'recording') { e.preventDefault(); stopTester(); } });

  /* ---------- measurement strip ---------- */
  function showReadout(i) {
    var d = dims();
    if (i === null || i === undefined || i < 0) { ['wm-f', 'wm-d', 'wm-t', 'wm-s'].forEach(function (id) { $(id).textContent = '—'; }); return; }
    $('wm-f').textContent = data.f[i].toFixed(2); $('wm-d').textContent = data.d[i].toFixed(2); $('wm-t').textContent = data.t[i].toFixed(1);
    $('wm-s').textContent = d.A ? (data.f[i] / d.A).toFixed(2) : '—';
  }

  /* ---------- key results: the site's own calculations (graph-core.js) on the finished record ---------- */
  var kpRes = null, TGC = window.TensileGraphCore;
  /* Offset line = the fitted line moved right by the offset (so it starts from the fitted line\u2019s own intercept, which compensates for a toe region). graph-core.js instead
     starts the offset line at strain = offset, which only suits curves with no toe; on this skin curve that gives a meaningless 0 MPa at strain 0.002. */
  function offsetYield(k, X, Y, off) {
    if (!k || !k.fit) return null;
    for (var m = 1; m < X.length; m++) {
      var a = Y[m - 1] - (k.fit.slope * X[m - 1] + k.fit.b - k.fit.slope * off), b = Y[m] - (k.fit.slope * X[m] + k.fit.b - k.fit.slope * off);
      if (a >= 0 && b < 0) { var u = a / (a - b); return { x: X[m - 1] + u * (X[m] - X[m - 1]), y: Y[m - 1] + u * (Y[m] - Y[m - 1]) }; }
    }
    return null;
  }
  function offsetValue() {   /* null: box empty (optional, not calculated); NaN: something typed that is not 0.05 to 5; otherwise the offset as a strain ratio */
    var raw = String($('wm-offset').value).trim(); if (raw === '') return null;
    var v = parseFloat(raw.replace(',', '.')); return isFinite(v) && v >= 0.05 && v <= 5 ? v / 100 : NaN;
  }
  function computeKeyResults() {
    var d = dims(); kpRes = null;
    if (!TGC || !d.L0 || !d.A || data.f.length < 10) return;
    var X = data.d.map(function (v) { return v / d.L0; }), Y = data.f.map(function (v) { return v / d.A; });
    var k = TGC.keyPoints({ x: X, y: Y, params: { yield: false } }, false);
    if (!k || !k.ok) return;
    kpRes = { X: X, Y: Y, k: k, toeIdx: -1, use: offsetOn() };
    if (k.toe !== undefined) for (var i = 0; i < X.length; i++) if (X[i] === k.toe) { kpRes.toeIdx = i; break; }
    updateYield();
  }
  function updateYield() {
    if (!kpRes) return; var off = kpRes.use ? offsetValue() : null;
    kpRes.off = off; kpRes.yield = (!kpRes.use || off === null || off !== off) ? null : offsetYield(kpRes.k, kpRes.X, kpRes.Y, off);
  }
  function renderResults() {
    var d = dims(), r = $('wm-res');
    if (!kpRes) { r.innerHTML = '<p class="small muted">Key results need valid dimensions and enough readings. Peak force: ' + (data.f.length ? Math.max.apply(null, data.f).toFixed(2) + ' N' : '\u2014') + '.</p>'; return; }
    var k = kpRes.k, X = kpRes.X, Y = kpRes.Y, off = kpRes.off, yv = kpRes.yield;
    var yieldTxt = yv ? yv.y.toFixed(2) + ' MPa at \u03b5 = ' + yv.x.toFixed(3) : 'not found (the curve never crosses the offset line)';
    var fitFrom = X[k.fit.i0].toFixed(3), fitTo = X[k.fit.i1].toFixed(3);
    function row(term, name, val) { return '<div><dt data-term="' + term + '" tabindex="0">' + name + '</dt><dd data-term="' + term + '">' + val + '</dd></div>'; }
    r.innerHTML = '<dl class="wm-res">' +
      row('wm_modulus', 'Modulus, E (fitted)', k.E.toFixed(1) + ' MPa') +
      row('uts', 'Ultimate tensile strength', k.uts.y.toFixed(2) + ' MPa at \u03b5 = ' + k.uts.x.toFixed(3)) +
      row('failstrain', 'Failure strain (50% force-drop rule)', k.detected ? k.fail.x.toFixed(3) : 'not detected') +
      (kpRes.use ? row('wm_offsetyield', 'Offset yield, ' + (off * 100).toFixed(2).replace(/\.?0+$/, '') + '% offset, toe-compensated (estimate)', yieldTxt) : '') +
      row('wm_peakF', 'Peak force', Math.max.apply(null, data.f).toFixed(2) + ' N') +
      row('wm_duration', 'Duration', data.t[data.t.length - 1].toFixed(1) + ' s') +
      '</dl><p class="small muted">Computed with the site\u2019s own calculation code on the finished record. The modulus is fitted over \u03b5 = ' + fitFrom + ' to ' + fitTo + ' (' + k.fit.w + ' points). ' + (kpRes.use ? 'Offset yield is an estimate and, for simulated skin, illustrative: soft tissue has no standard yield point. ' : '') + 'Mock-up: demo curve (illustrative shape, not the site\u2019s sample data), demo data, not measured.</p>';
  }

  /* ---------- appearance (only after the test) ---------- */
  var cust = { bg: 'theme', bgc: '#ffffff', lc: '', lw: '3', cs: 'line', grid: 'major', title: '' };
  function graphTitle() { var t = String(cust.title || '').trim(); return t || (matOk() ? $('wm-mat').value.trim() + ' tensile test' : 'Tensile test'); }
  var KPS = ['uts', 'fit', 'toe', 'fail', 'yield'];
  function lum(hex) { var n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }
  function applyCust() {
    var st = plot.style, bg = null;
    if (cust.bg === 'white') bg = '#ffffff'; else if (cust.bg === 'black') bg = '#000000'; else if (cust.bg === 'gray') bg = '#e6e6e6'; else if (cust.bg === 'custom') bg = cust.bgc;
    if (bg) {
      var light = lum(bg) > 0.5;
      st.setProperty('--g-bg', bg); st.setProperty('--g-ink', light ? '#000000' : '#f5f5f5'); st.setProperty('--g-muted', light ? '#4a4a4a' : '#bdbdbd');
      st.setProperty('--g-grid', light ? '#d4d4d4' : '#3f3f3f'); st.setProperty('--g-line', light ? '#000000' : '#f5f5f5');
    } else ['--g-bg', '--g-ink', '--g-muted', '--g-grid', '--g-line'].forEach(function (p) { st.removeProperty(p); });
    if (cust.lc) st.setProperty('--g-line', cust.lc);
    st.setProperty('--g-w', cust.lw + 'px');
    draw();
  }
  function resetCust() {
    cust = { bg: 'theme', bgc: '#ffffff', lc: '', lw: '3', cs: 'line', grid: 'major', title: '' }; $('wm-title').value = '';
    $('wm-bg').value = 'theme'; $('wm-bgc').value = '#ffffff'; $('wm-bgc').disabled = true; $('wm-lw').value = '3'; $('wm-cs').value = 'line'; $('wm-gr').value = 'major';
    [].forEach.call($('wm-sw').querySelectorAll('button'), function (b) { b.classList.toggle('is-on', b.getAttribute('data-c') === ''); });
    KPS.forEach(function (n) { $('wm-kp-' + n).checked = false; });
    applyCust();
  }
  $('wm-title').addEventListener('input', function () { cust.title = this.value; draw(); });
  $('wm-bg').addEventListener('change', function () { cust.bg = this.value; $('wm-bgc').disabled = this.value !== 'custom'; applyCust(); });
  $('wm-bgc').addEventListener('input', function () { cust.bgc = this.value; applyCust(); });
  $('wm-lw').addEventListener('change', function () { cust.lw = this.value; applyCust(); });
  $('wm-cs').addEventListener('change', function () { cust.cs = this.value; draw(); });
  $('wm-gr').addEventListener('change', function () { cust.grid = this.value; draw(); });
  [].forEach.call($('wm-sw').querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () { cust.lc = b.getAttribute('data-c'); [].forEach.call($('wm-sw').querySelectorAll('button'), function (x) { x.classList.toggle('is-on', x === b); }); applyCust(); });
  });
  $('wm-lcc').addEventListener('input', function () { cust.lc = this.value; [].forEach.call($('wm-sw').querySelectorAll('button'), function (x) { x.classList.remove('is-on'); }); applyCust(); });
  $('wm-creset').addEventListener('click', resetCust);
  KPS.forEach(function (n) { $('wm-kp-' + n).addEventListener('change', function () { cursorKey = null; draw(); }); });
  $('wm-kp-all').addEventListener('click', function () { KPS.forEach(function (n) { if (n === 'yield' && !(kpRes && kpRes.use)) return; $('wm-kp-' + n).checked = true; }); cursorKey = null; draw(); });
  $('wm-kp-none').addEventListener('click', function () { KPS.forEach(function (n) { $('wm-kp-' + n).checked = false; }); cursorKey = null; draw(); });

  /* ---------- graph ---------- */
  var view = 'fd', viewWin = null, view0 = null, autoRange = null, panOn = false;
  var VIEWS = {
    fd: { xl: 'Displacement (mm)', yl: 'Force (N)', def: [12, 25] },
    ss: { xl: 'Engineering strain (mm/mm)', yl: 'Engineering stress (MPa)', def: [0.6, 5] },
    ft: { xl: 'Time (s)', yl: 'Force (N)', def: [20, 25] }
  };
  function pts() {
    var d = dims(), out = [], i;
    for (i = 0; i < data.t.length; i++) {
      if (view === 'fd') out.push([data.d[i], data.f[i]]);
      else if (view === 'ft') out.push([data.t[i], data.f[i]]);
      else if (d.L0 && d.A) out.push([data.d[i] / d.L0, data.f[i] / d.A]);
    }
    return out;
  }
  function niceCeil(v) {  /* round up in steps of about 20 percent (1 to 10 in about 20 percent steps, x 10^k) so the axis grows rarely and not wastefully */
    if (!(v > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p, L = [1, 1.2, 1.5, 1.8, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 10];
    for (var i = 0; i < L.length; i++) if (m <= L[i] + 1e-9) return L[i] * p;
    return 10 * p;
  }
  function ticks(lo, hi, n) {
    var raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p, s = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p, out = [], v = Math.ceil(lo / s - 1e-9) * s;
    for (; v <= hi + s * 1e-6; v += s) out.push(Math.abs(v) < s * 1e-9 ? 0 : v);
    return { list: out, step: s };
  }
  function fmt(v, step) { var dec = Math.max(0, Math.min(4, -Math.floor(Math.log10(step) + 1e-9))); return v.toFixed(dec); }
  function range(P) {
    var def = VIEWS[view].def, mx = def[0], my = def[1], i;
    for (i = 0; i < P.length; i++) { if (P[i][0] > mx / 1.05) mx = niceCeil(P[i][0] * 1.05); if (P[i][1] > my / 1.05) my = niceCeil(P[i][1] * 1.05); }
    return { x0: 0, x1: mx, y0: 0, y1: my };
  }
  function el(tag, attrs, text) { var e = document.createElementNS(NS, tag), k; for (k in attrs) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; }
  var geom = null;
  var cursorIdx = null, cursorKey = null;   /* cursorKey: a shown key point the cursor has snapped to ({name, e, st}) */
  function linesFor(e, st) {   /* readout lines for a point given as strain and stress (used for key points) */
    var d = dims(), v = sim ? sim.v : (num('wm-speed') || 30) / 60, disp = e * d.L0;
    return ['Time ' + (disp / v).toFixed(1) + ' s', 'Displacement ' + disp.toFixed(2) + ' mm', 'Force ' + (st * d.A).toFixed(2) + ' N', 'Strain ' + e.toFixed(3) + ' mm/mm', 'Stress ' + st.toFixed(2) + ' MPa'];
  }
  function readoutLines(i) {
    var d = dims(), out = ['Time ' + data.t[i].toFixed(1) + ' s', 'Displacement ' + data.d[i].toFixed(2) + ' mm', 'Force ' + data.f[i].toFixed(2) + ' N'];
    if (d.L0 && d.A) { out.push('Strain ' + (data.d[i] / d.L0).toFixed(3) + ' mm/mm'); out.push('Stress ' + (data.f[i] / d.A).toFixed(2) + ' MPa'); }
    return out;
  }
  function updateReadoutPanel() {
    var r = $('wm-readout');
    if (cursorKey) { r.textContent = cursorKey.name + ': ' + linesFor(cursorKey.e, cursorKey.st).join(' \u00b7 ') + '. Key point; mock-up: demo data, not measured.'; return; }
    if (cursorIdx === null || cursorIdx >= data.t.length) { r.textContent = data.t.length ? 'Move the pointer over the graph, or click it and use the left and right arrow keys (Home and End jump to the ends).' : 'No readings yet. Start a recording, then point at the graph.'; return; }
    r.textContent = 'Point ' + (cursorIdx + 1) + ' of ' + data.t.length + ': ' + readoutLines(cursorIdx).join(' \u00b7 ') + '. Mock-up: demo data, not measured.';
  }
  function setCursor(i) { cursorIdx = i; cursorKey = null; updateReadoutPanel(); draw(); }
  function setCursorKey(k) { cursorKey = k; updateReadoutPanel(); draw(); }
  function nearest(clientX) {
    if (!geom || !geom.P.length) return null;
    var b = plot.getBoundingClientRect(), x = clientX - b.left, best = 0, bd = 1e9, R = geom.R, M = geom.M;
    geom.P.forEach(function (p, k) { var px = M.l + (p[0] - R.x0) / (R.x1 - R.x0) * geom.pw, dd = Math.abs(px - x); if (dd < bd) { bd = dd; best = k; } });
    return best;
  }
  function nearKey(e) {   /* a shown key point within 14 px of the pointer */
    if (!geom || !geom.keys || !geom.keys.length) return null;
    var b = plot.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, best = null, bd = 14;
    geom.keys.forEach(function (k) { var dd = Math.sqrt(Math.pow(k.px - x, 2) + Math.pow(k.py - y, 2)); if (dd <= bd) { bd = dd; best = k; } });
    return best;
  }
  plot.addEventListener('pointermove', function (e) {
    if (drag) return;
    var k = nearKey(e);
    if (k) { if (!cursorKey || cursorKey.id !== k.id) setCursorKey({ id: k.id, name: k.name, e: k.e, st: k.st }); return; }
    var i = nearest(e.clientX);
    if (i !== null && (i !== cursorIdx || cursorKey)) setCursor(i);
  });
  plot.addEventListener('pointerleave', function () { if (document.activeElement !== plot && (cursorIdx !== null || cursorKey)) setCursor(null); });
  plot.addEventListener('keydown', function (e) {
    var n = data.t.length; if (!n) return;
    var big = e.shiftKey ? 10 : 1, i = cursorIdx === null ? n - 1 : cursorIdx;
    if (e.key === 'ArrowLeft') i = Math.max(0, i - big); else if (e.key === 'ArrowRight') i = Math.min(n - 1, i + big);
    else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = n - 1; else return;
    e.preventDefault(); setCursor(i);
  });
  function draw() {
    var W = plot.clientWidth, H = plot.clientHeight;
    if (!W || !H) return;
    var disabledSS = view === 'ss' && !(dims().L0 && dims().A);
    var P = disabledSS ? [] : pts(), R = viewWin || range(P);
    var M = { l: 70, r: 22, t: 46, b: 54 }, pw = W - M.l - M.r, ph = H - M.t - M.b;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' });
    function sx(v) { return M.l + (v - R.x0) / (R.x1 - R.x0) * pw; }
    function sy(v) { return M.t + ph - (v - R.y0) / (R.y1 - R.y0) * ph; }
    var tx = ticks(R.x0, R.x1, Math.max(3, Math.round(pw / 110))), ty = ticks(R.y0, R.y1, Math.max(3, Math.round(ph / 60)));
    tx.list.forEach(function (v) { if (cust.grid !== 'off') svg.appendChild(el('line', { x1: sx(v), x2: sx(v), y1: M.t, y2: M.t + ph, 'class': 'wm-svg-grid' })); svg.appendChild(el('text', { x: sx(v), y: M.t + ph + 20, 'text-anchor': 'middle', 'class': 'wm-svg-tick' }, fmt(v, tx.step))); });
    ty.list.forEach(function (v) { if (cust.grid !== 'off') svg.appendChild(el('line', { x1: M.l, x2: M.l + pw, y1: sy(v), y2: sy(v), 'class': 'wm-svg-grid' })); svg.appendChild(el('text', { x: M.l - 8, y: sy(v) + 4, 'text-anchor': 'end', 'class': 'wm-svg-tick' }, fmt(v, ty.step))); });
    svg.appendChild(el('line', { x1: M.l, x2: M.l + pw, y1: M.t + ph, y2: M.t + ph, 'class': 'wm-svg-axis' }));
    svg.appendChild(el('line', { x1: M.l, x2: M.l, y1: M.t, y2: M.t + ph, 'class': 'wm-svg-axis' }));
    svg.appendChild(el('text', { x: M.l + pw / 2, y: H - 10, 'text-anchor': 'middle', 'class': 'wm-svg-lab' }, VIEWS[view].xl));
    svg.appendChild(el('text', { x: 16, y: M.t + ph / 2, 'text-anchor': 'middle', transform: 'rotate(-90 16 ' + (M.t + ph / 2) + ')', 'class': 'wm-svg-lab' }, VIEWS[view].yl));
    var ttl = graphTitle(); svg.appendChild(el('text', { x: M.l + pw / 2, y: 28, 'class': 'wm-svg-title', style: 'font-size:' + Math.max(12, Math.min(17, Math.floor(pw / (ttl.length * 0.62)))) + 'px' }, ttl));
    var clip = el('clipPath', { id: 'wm-clip' }); clip.appendChild(el('rect', { x: M.l, y: M.t, width: pw, height: ph })); svg.appendChild(clip);
    var g = el('g', { 'clip-path': 'url(#wm-clip)' });
    if (P.length > 1) g.appendChild(el('polyline', { points: P.map(function (p) { return sx(p[0]).toFixed(1) + ',' + sy(p[1]).toFixed(1); }).join(' '), 'class': 'wm-svg-curve' }));
    if (cust.cs === 'markers' && P.length) P.forEach(function (p, i) { if (i % 6 === 0) g.appendChild(el('circle', { cx: sx(p[0]), cy: sy(p[1]), r: 3, 'class': 'wm-svg-pt' })); });
    var labels = [], keys = [];
    var d0 = dims(), v0 = sim ? sim.v : (num('wm-speed') || 30) / 60;
    var tv = function (e, st) { return view === 'ss' ? [e, st] : view === 'fd' ? [e * d0.L0, st * d0.A] : [e * d0.L0 / v0, st * d0.A]; };
    if (state === 'ended' && kpRes && !disabledSS) {
      var K = kpRes.k, mark = function (pt, txt, term, id, name) { var q2 = tv(pt.x, pt.y), px = sx(q2[0]), py = sy(q2[1]); g.appendChild(el('circle', { cx: px, cy: py, r: 7, 'class': 'wm-svg-mk wm-svg-mkpt' }));   /* no definition box here: the cursor readout names the point; the legend chips and Key results carry the definitions */ labels.push([px, py, txt, term]); if (px >= M.l && px <= M.l + pw && py >= M.t && py <= M.t + ph) keys.push({ id: id, name: name, px: px, py: py, e: pt.x, st: pt.y }); };
      if ($('wm-kp-fit').checked) {
        var f = K.fit, ex0 = Math.max(0, kpRes.X[f.i0] - 0.06), ex1 = kpRes.X[f.i1] + 0.12, a0 = tv(ex0, f.slope * ex0 + f.b), a1 = tv(ex1, f.slope * ex1 + f.b);
        g.appendChild(el('line', { x1: sx(a0[0]), y1: sy(a0[1]), x2: sx(a1[0]), y2: sy(a1[1]), 'class': 'wm-svg-mkline' }));
        labels.push([sx(a1[0]), sy(a1[1]), 'Modulus fit E \u2248 ' + K.E.toFixed(1) + ' MPa', 'wm_fit']);
      }
      if ($('wm-kp-toe').checked && kpRes.toeIdx >= 0) mark({ x: K.toe, y: kpRes.Y[kpRes.toeIdx] }, 'End of toe \u2248 \u03b5 ' + K.toe.toFixed(2) + ' (approximate)', 'wm_toe', 'toe', 'End of toe (approximate)');
      if (kpRes.use && $('wm-kp-yield').checked) { if (kpRes.yield) mark(kpRes.yield, 'Offset yield ' + kpRes.yield.y.toFixed(1) + ' MPa (' + (kpRes.off * 100).toFixed(2).replace(/\.?0+$/, '') + '% offset, estimate)', 'wm_offsetyield', 'yield', 'Offset yield (estimate)'); else labels.push([0, 0, kpRes.off === null ? 'Offset yield: enter an offset to calculate it' : kpRes.off !== kpRes.off ? 'Offset yield: enter an offset from 0.05 to 5 %' : 'Offset yield: not found', 'wm_offsetyield']); }
      if ($('wm-kp-fail').checked && K.detected) mark(K.fail, 'Failure (50% force drop) \u03b5 ' + K.fail.x.toFixed(2), 'failstrain', 'fail', 'Failure point (50% force drop)');
      if ($('wm-kp-uts').checked) mark(K.uts, 'UTS ' + K.uts.y.toFixed(1) + ' MPa', 'uts', 'uts', 'Ultimate tensile strength (UTS)');
    }
    /* labels are stacked at the top left of the plot (not beside the points), so they never overlap each other or the curve */
    labels.forEach(function (L, i) {
      var txt = L[2], w = txt.length * 7 + 28, x = M.l + 10, y = M.t + 22 + i * 26;
      svg.appendChild(el('rect', { x: x, y: y - 16, width: w, height: 22, rx: 4, 'class': 'wm-svg-mkb', 'data-term': L[3] }));
      svg.appendChild(el('circle', { cx: x + 11, cy: y - 5, r: 5, 'class': 'wm-svg-mk', 'data-term': L[3] }));
      svg.appendChild(el('text', { x: x + 22, y: y, 'class': 'wm-svg-mkt', 'data-term': L[3] }, txt));
    });
    if (P.length) { var q = P[P.length - 1]; g.appendChild(el('circle', { cx: sx(q[0]), cy: sy(q[1]), r: 5, 'class': 'wm-svg-dot' })); }
    svg.appendChild(g);
    var cpt = null, cname = null, clines = null;
    if (cursorKey && !disabledSS) { var kq = tv(cursorKey.e, cursorKey.st); cpt = [kq[0], kq[1]]; cname = cursorKey.name; clines = linesFor(cursorKey.e, cursorKey.st); }
    else if (cursorIdx !== null && P[cursorIdx]) { cpt = P[cursorIdx]; clines = readoutLines(cursorIdx); }
    if (cpt) {
      var cx = sx(cpt[0]), cy = sy(cpt[1]);
      if (cx >= M.l && cx <= M.l + pw) {
        svg.appendChild(el('line', { x1: cx, x2: cx, y1: M.t, y2: M.t + ph, 'class': 'wm-svg-cur' }));
        svg.appendChild(el('circle', { cx: cx, cy: cy, r: cname ? 10 : 6, 'class': 'wm-svg-curdot' }));
        var rows = (cname ? [cname] : []).concat(clines), bw = Math.max(196, cname ? cname.length * 7.4 + 20 : 0), bh = 8 + rows.length * 18, bx = cx + 16 + bw > M.l + pw ? cx - 16 - bw : cx + 16, by = Math.min(Math.max(M.t + 4, cy - bh / 2), M.t + ph - bh - 4);
        svg.appendChild(el('rect', { x: bx, y: by, width: bw, height: bh, rx: 6, 'class': 'wm-svg-rbox' }));
        rows.forEach(function (t, k) { svg.appendChild(el('text', { x: bx + 10, y: by + 20 + k * 18, 'class': cname && k === 0 ? 'wm-svg-rname' : 'wm-svg-rtxt' }, t)); });
      }
    }
    if (!P.length) svg.appendChild(el('text', { x: M.l + pw / 2, y: M.t + ph / 2, 'class': 'wm-svg-note' }, disabledSS ? 'Enter gauge length, width, and thickness to see stress–strain.' : state === 'idle' ? 'No data yet. Connect, then press Start recording.' : state === 'ready' ? 'Ready. Press Start recording.' : 'Waiting for readings…'));
    svg.appendChild(el('text', { x: M.l + pw - 6, y: M.t + ph - 8, 'class': 'wm-svg-wm' }, 'Mock-up: demo data, not measured'));
    geom = { M: M, pw: pw, ph: ph, R: R, W: W, H: H, P: P, keys: keys };
    plot.replaceChildren(svg);
    plot.setAttribute('aria-label', 'Test graph, ' + VIEWS[view].yl + ' against ' + VIEWS[view].xl + '. Mock-up with demo data, ' + P.length + ' points.');
    $('wm-cap').textContent = 'Mock-up: demo data, not measured. The demo curve shape is illustrative.' + (viewWin ? ' Zoomed view: the display only changes; the data does not.' : '');
  }
  if (window.ResizeObserver) new ResizeObserver(function () { draw(); }).observe(plot); else window.addEventListener('resize', draw);

  [].forEach.call(document.querySelectorAll('.wm-tab'), function (b) {
    b.addEventListener('click', function () {
      if (b.getAttribute('aria-disabled') === 'true') { $('wm-vwhy').hidden = false; return; }
      view = b.getAttribute('data-view'); viewWin = null; viewButtons(); draw();
    });
  });

  /* zoom, pan, autoscale, reset: display only */
  function current() { return viewWin || (geom && geom.R) || { x0: 0, x1: 1, y0: 0, y1: 1 }; }
  function zoom(f, fx, fy) {
    var r = current(), cx = r.x0 + (r.x1 - r.x0) * fx, cy = r.y0 + (r.y1 - r.y0) * (1 - fy);
    var nw = (r.x1 - r.x0) * f, nh = (r.y1 - r.y0) * f;
    viewWin = { x0: cx - nw * fx, x1: cx + nw * (1 - fx), y0: cy - nh * (1 - fy), y1: cy + nh * fy };
    draw();
  }
  $('wm-zin').addEventListener('click', function () { zoom(0.7, 0.5, 0.5); });
  $('wm-zout').addEventListener('click', function () { zoom(1 / 0.7, 0.5, 0.5); });
  $('wm-auto').addEventListener('click', function () {
    var P = pts(); if (!P.length) { viewWin = null; draw(); return; }
    var mx = 0, my = 0; P.forEach(function (p) { if (p[0] > mx) mx = p[0]; if (p[1] > my) my = p[1]; });
    viewWin = { x0: 0, x1: mx * 1.05 || 1, y0: 0, y1: my * 1.05 || 1 }; draw();
  });
  $('wm-reset').addEventListener('click', function () { viewWin = null; draw(); });
  $('wm-pan').addEventListener('click', function () { panOn = !panOn; $('wm-pan').setAttribute('aria-pressed', String(panOn)); plot.classList.toggle('is-pan', panOn); });
  plot.addEventListener('wheel', function (e) {
    if (!geom) return; e.preventDefault();
    var b = plot.getBoundingClientRect(), fx = Math.min(1, Math.max(0, (e.clientX - b.left - geom.M.l) / geom.pw)), fy = Math.min(1, Math.max(0, (e.clientY - b.top - geom.M.t) / geom.ph));
    zoom(Math.min(2, Math.max(0.5, Math.exp(e.deltaY * 0.0015))), fx, 1 - fy);
  }, { passive: false });
  var drag = null;
  plot.addEventListener('pointerdown', function (e) {
    if (!panOn || !geom) return;
    drag = { x: e.clientX, y: e.clientY, r: JSON.parse(JSON.stringify(current())) }; plot.setPointerCapture(e.pointerId); plot.classList.add('is-panning');
  });
  plot.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = (e.clientX - drag.x) / geom.pw * (drag.r.x1 - drag.r.x0), dy = (e.clientY - drag.y) / geom.ph * (drag.r.y1 - drag.r.y0);
    viewWin = { x0: drag.r.x0 - dx, x1: drag.r.x1 - dx, y0: drag.r.y0 + dy, y1: drag.r.y1 + dy }; draw();
  });
  function endDrag() { drag = null; plot.classList.remove('is-panning'); }
  plot.addEventListener('pointerup', endDrag); plot.addEventListener('pointercancel', endDrag);

  /* Expand graph: the workspace fills the window. Esc is not used (Esc is STOP while recording); the same button closes it. */
  $('wm-expand').addEventListener('click', function () {
    var on = work.classList.toggle('is-expanded');
    $('wm-expand').setAttribute('aria-pressed', String(on)); $('wm-expand').textContent = on ? 'Close expanded graph' : 'Expand graph';
    document.body.style.overflow = on ? 'hidden' : ''; setTimeout(draw, 0);
  });

  syncSideLabel();
  updateInputs();
})();
