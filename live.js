/* Live test page: connects to the tester over USB (Web Serial); the practice page (data-practice="true") uses the labeled simulator instead and has no USB. Sends
   commands, records readings, plots them while the test runs, and downloads the data as a CSV file that
   opens in Excel. Data stays in this browser tab until you download it; nothing is uploaded or saved.
   The message format lives in data/device.js. The graph comes from graph.js (window.TensileGraph). */
(function () {
  'use strict';

  var app = document.getElementById('live-app');
  var TG = window.TensileGraph, DEV = window.DEVICE;
  if (!app || !TG || !DEV) return;
  var test = app.getAttribute('data-test'), isRelax = test === 'relaxation', CFG = TG.configs[test];
  /* Practice page: only the simulator, no USB. The real test pages have no simulator (live-sim.js is not loaded there). */
  var PRACTICE = app.getAttribute('data-practice') === 'true';
  var sig = TG.sig;
  /* The material is a name the user types (optional). Simulated readings always use one default sample curve, and say so. */
  var SIM_CURVE = 'biomaterial';
  var hasSerial = 'serial' in navigator;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  /* setup field -> entry in data/terms.js (hover or Tab shows the definition) */
  var FIELD_TERMS = { 's-L0': 'L0', 's-speed': 'speed', 's-hold': 'holdmm' };
  function field(id, label, attrs, withMsg) {
    var tk = FIELD_TERMS[id], tip = tk ? ' data-term="' + tk + '" tabindex="0"' : '';
    var one = '<label class="pf"><span' + tip + '>' + label + '</span><input id="' + id + '" ' + (attrs || 'type="number" min="0" step="any" inputmode="decimal"') + (withMsg ? ' aria-describedby="m-' + id + '"' : '') + '></label>';
    return withMsg ? '<div class="pf-wrap">' + one + '<span class="pf-msg" id="m-' + id + '" hidden></span></div>' : one;
  }

  /* ---------- page layout ---------- */
  app.innerHTML =
    '<div class="gs-switch"><label class="check"><input type="checkbox" id="steps-all"> Show all steps</label></div>' +
    (PRACTICE ? '<div class="tut-slot" data-tutorial="run-simulated"></div>' : '') +
    '<div class="live-layout">' +
      '<form class="panel" id="spec" novalidate aria-labelledby="spec-title">' +
        '<h2 id="spec-title">Specimen and settings</h2>' +
        '<div class="setup-col">' +
        '<h3 class="step-h">1. Specimen</h3>' +
        field('s-mat', 'Material', 'type="text" autocomplete="off" maxlength="100" aria-describedby="s-mat-hint"') +
        '<p class="small muted" id="s-mat-hint" hidden>Type the material name.</p>' +
        field('s-id', 'Specimen ID', 'type="text" autocomplete="off"') +
        '</div><div class="setup-col">' +
        '<h3 class="step-h">2. Dimensions (mm)</h3>' +
        field('s-L0', 'Gauge length, L<sub>0</sub> (mm)', undefined, true) +
        field('s-W', 'Width (mm)', undefined, true) +
        field('s-T', 'Thickness (mm)', undefined, true) +
        '<div class="pf"><span data-term="A0" tabindex="0">Area, A<sub>0</sub> (mm²)</span><output id="s-A">—</output></div>' +
        '<p class="pf-note" id="dim-note" hidden></p>' +
        '<p class="small gs-fill"><button type="button" class="btn-link" id="s-example-dims">Fill example dimensions</button></p>' +
        '</div><div class="setup-col">' +
        '<h3 class="step-h">3. Test settings</h3>' +
        field('s-speed', 'Crosshead speed (mm/min)', undefined, true) +
        (isRelax ?
          field('s-hold', 'Hold displacement, ΔL (mm)', undefined, true) +
          '<div class="pf"><span data-term="holdstrain" tabindex="0">Hold strain, ε<sub>0</sub> = ΔL/L<sub>0</sub></span><output id="s-e0">—</output></div>' +
          field('s-holds', 'Hold duration (s)', undefined, true) : '') +
        '<p class="small gs-fill"><button type="button" class="btn-link" id="s-example-settings">Fill example settings</button></p>' +
        field('s-temp', 'Temperature (°C), optional', 'type="text" inputmode="decimal" autocomplete="off"', true) +
        field('s-env', 'Environment, optional', 'type="text" autocomplete="off"') +
        '<label class="pf"><span>Notes</span><textarea id="s-notes" rows="2"></textarea></label>' +
        '</div>' +
        '<div class="tut-slot" data-tutorial="dimensions" data-step="2"></div>' +   /* across the whole setup card (wide enough to read); only shown at the Dimensions step in the guided view */
      '</form>' +
      '<div class="live-main">' +
        '<div class="control-bar">' +
          '<div class="conn-row">' +
          '<h3 class="step-h">4. Connection</h3>' +
          '<p class="conn"><span class="dot" id="c-dot" aria-hidden="true"></span><strong id="c-text">Not connected</strong> <span class="muted" id="c-now"></span></p>' +
          '<div class="graph-actions">' +
            (PRACTICE ? '<button type="button" class="btn-secondary" id="c-sim">Use simulator</button>' : '<button type="button" class="btn-secondary" id="c-usb">Connect to tester (USB)</button>') +
            '<button type="button" class="btn-secondary" id="c-off" hidden>Disconnect</button>' +
          '</div>' +
          '</div>' +
          (PRACTICE || hasSerial ? '' : '<p class="small muted">USB serial requires a supporting desktop browser, a secure context, permission for the selected port, and compatible controller software. In this project, USB works in Chrome only; this browser does not offer it here. The practice page has a simulator that works in any browser.</p>') +
          '<div class="tut-slot" data-tutorial="connect-usb" data-step="4"></div>' +
          '<div class="run-bar">' +
            '<button type="button" class="btn-secondary" id="r-tare">Tare</button>' +
            '<button type="button" class="btn btn-start" id="r-start">Start test</button>' +
            '<button type="button" class="btn-stop" id="r-stop">STOP — sends a stop command</button>' +
            '<label class="check"><input type="checkbox" id="r-auto" checked> ' + (isRelax ? 'Auto-stop at end of hold' : 'Send STOP after detected force drop') + '</label>' +
          '</div>' +
          '<p class="small muted" id="r-why"></p>' +
          '<section class="review" aria-labelledby="rv-title"><h3 class="step-h" id="rv-title">5. Review before starting</h3><p class="rv-sum" id="rv-sum"></p></section>' +
          '<p class="small muted esc-line">Esc also sends STOP while connected. <a href="help.html">Help and keyboard keys</a></p>' +
          '<p class="csv-msg" id="r-msg" role="status"></p>' +
          '<details class="rv-det" id="rv-det"><summary>Show every value to review</summary><p class="small muted" id="c-explain">' + (PRACTICE ? 'Simulator readings are labeled “Simulated data, not measured”. Nothing on this page connects to a tester.' : 'A USB tester is draft and unvalidated.') + '</p><div id="rv-body"></div></details>' +
          '<p class="small muted" id="r-info"></p>' +
        '</div>' +
        '<div id="graph-app"></div>' +
        '<div class="tut-slot tut-after" data-tutorial="graph-zoom"></div>' +
        '<div class="tut-slot tut-after" data-tutorial="download"></div>' +
      '</div>' +
    '</div>';

  if (window.Tutorials) window.Tutorials.scan(app);   /* "Watch how" buttons for the spots marked above (tutorials.js) */
  function $(id) { return document.getElementById(id); }
  var Checklist = window.LiveChecklist.create($, esc), checklistOn = Checklist.on, showChecklist = Checklist.show;
  var csv = window.LiveCsv.create(spec, CFG, TG, isRelax);
  var msgEl = $('r-msg'), infoEl = $('r-info');
  function msg(text, isError) {
    msgEl.textContent = text;
    msgEl.className = 'csv-msg' + (isError ? ' error' : '');
  }

  /* ---------- specimen form ---------- */
  /* A number is digits with an optional point or comma and an optional exponent, nothing else ("12abc" is not a number). */
  var NUM = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/;
  function read(id) {   /* { state: 'empty' | 'text' | 'ok', value } */
    var e = $(id);
    if (!e) return { state: 'empty', value: null };
    var t = String(e.value).trim();
    if (t === '') return { state: e.validity && e.validity.badInput ? 'text' : 'empty', value: null };
    if (!NUM.test(t)) return { state: 'text', value: null };
    var v = parseFloat(t.replace(',', '.'));
    return isFinite(v) ? { state: 'ok', value: v } : { state: 'text', value: null };
  }
  function num(id) { var r = read(id); return r.state === 'ok' && r.value > 0 ? r.value : null; }
  function spec() {
    var m = $('s-mat').value.trim();
    return {
      mat: m, matLabel: m, matKey: SIM_CURVE, id: $('s-id').value.trim(),
      L0: num('s-L0'), W: num('s-W'), T: num('s-T'), speed: num('s-speed'),
      hold_mm: isRelax ? num('s-hold') : null, hold_s: isRelax ? num('s-holds') : null,
      temp: $('s-temp').value.trim(), env: $('s-env').value.trim(), notes: $('s-notes').value.trim()
    };
  }
  function newRecord(source) {
    var r = { id: 'live', test: test, material: 'live', label: 'New test', source: source,
      units: { x: isRelax ? 's' : '-', y: 'MPa' },
      params: { yield: false, specimen: { L0_mm: NaN, width_mm: NaN, thickness_mm: NaN }, hold_mm: NaN, hold_strain: NaN, hold_s: NaN },
      raw: { t: [], d: [], F: [] }, x: [], y: [] };
    applySpec(r);
    r.dimSource = dimSourceNow();
    return r;
  }
  function applySpec(r) {
    var s = spec(), p = r.params;
    if (s.L0) p.specimen.L0_mm = s.L0;
    if (s.W) p.specimen.width_mm = s.W;
    if (s.T) p.specimen.thickness_mm = s.T;
    if (isRelax) { if (s.hold_mm) p.hold_mm = s.hold_mm; if (s.hold_s) p.hold_s = s.hold_s; }
    p.yield = !isRelax && !!(TG.sampleParams(test, s.matKey) || {}).yield;
    r.mk = TG.sampleRegion(test, s.matKey);
    p.speed_mm_min = s.speed; p.temperature_C = s.temp; p.environment = s.env;
    if (!running) r.label = [s.matLabel, s.id].filter(Boolean).join(' · ') || 'New test';
  }
  function updateOutputs() {
    var s = spec();
    $('s-A').textContent = s.W && s.T ? sig(s.W * s.T, 4) : '—';
    if (isRelax) $('s-e0').textContent = s.hold_mm && s.L0 ? sig(s.hold_mm / s.L0, 4) : '—';
    var ex = dimSourceNow() === 'example', dn = $('dim-note');
    dn.hidden = !ex;
    dn.textContent = ex ? 'These dimensions are example values from the labeled sample data, not measurements of your specimen.' : '';
  }
  /* The entries Start needs, with the unit to name in messages. */
  var FIELDS = [['s-L0', 'gauge length', 'mm'], ['s-W', 'width', 'mm'], ['s-T', 'thickness', 'mm'], ['s-speed', 'crosshead speed', 'mm/min']]
    .concat(isRelax ? [['s-hold', 'hold displacement', 'mm'], ['s-holds', 'hold duration', 's']] : []);
  var FIELD_IDS = FIELDS.map(function (q) { return q[0]; }).concat(['s-temp']), touched = {};
  function fieldInfo(id) { return FIELDS.filter(function (q) { return q[0] === id; })[0]; }
  /* What is wrong with one required entry, in plain words ('' when it is fine). */
  function problemText(id) {
    var q = fieldInfo(id), r = read(id);
    if (!q) return '';
    if (r.state === 'empty') return 'Enter the ' + q[1] + ' in ' + q[2] + '.';
    if (r.state === 'text') return 'That is not a number. Enter digits only, for example 12.5 (' + q[2] + ').';
    if (r.value <= 0) return 'Enter a number greater than 0 (' + q[2] + ').';
    return '';
  }
  /* A note that does not stop Start. */
  function warnText(id) {
    if (id === 's-hold') {
      var h = num('s-hold'), l = num('s-L0');
      if (h && l && h >= l) return 'The hold displacement is not smaller than the gauge length, so the hold strain would be 100% or more. Check that both are in mm.';
    }
    if (id === 's-temp' && $('s-temp').value.trim() && read('s-temp').state !== 'ok') return 'The temperature is not a number, so it is saved as typed. Enter a number in °C if you can.';
    return '';
  }
  function showMsg(id, text, isWarn) {
    var m = $('m-' + id), e = $(id);
    if (!m || !e) return;
    m.textContent = text; m.hidden = !text; m.className = 'pf-msg' + (text && isWarn ? ' warn' : '');
    if (text && !isWarn) e.setAttribute('aria-invalid', 'true'); else e.removeAttribute('aria-invalid');
  }
  function checkField(id) { var p = problemText(id); showMsg(id, p || warnText(id), !p); }
  function clearMessages() { touched = {}; FIELD_IDS.forEach(function (id) { showMsg(id, ''); }); }
  function problemList() { return FIELDS.filter(function (q) { return problemText(q[0]); }).map(function (q) { return { id: q[0], name: q[1], text: problemText(q[0]) }; }); }
  /* Checks every required entry (showing the messages) and returns what needs attention: [{ id, name, text }]. */
  function validate() { FIELDS.forEach(function (q) { touched[q[0]] = true; checkField(q[0]); }); return problemList(); }

  /* ---------- review before starting (read-only; it never starts anything) ---------- */
  function modeRow() {
    if (!link) return [PRACTICE ? 'Not connected. Choose “Use simulator”.' : 'Not connected. Choose “Connect to tester (USB)”.', true];
    return link.kind === 'sim' ? ['Simulator. Its readings are simulated and labeled “Simulated data, not measured”.', false]
      : ['USB tester. The hardware connection is draft and has not been validated.', false];
  }
  var lastReview = '';
  function renderReview() {
    var box = $('rv-body');
    if (!box) return;
    var s = spec(), rows = [];
    function row(k, v, bad) { rows.push('<dt>' + k + '</dt><dd' + (bad ? ' class="rv-bad"' : '') + '>' + esc(v) + '</dd>'); }
    function val(id, label, unit) {
      var q = read(id);
      if (q.state === 'ok' && q.value > 0) row(label, sig(q.value, 6) + ' ' + unit);
      else row(label, q.state === 'empty' ? 'missing' : q.state === 'text' ? 'not a number' : 'must be greater than 0', true);
    }
    row('Test', isRelax ? 'Stress relaxation' : 'Uniaxial tension');
    row('Material', s.matLabel || 'not entered (optional)');
    row('Specimen ID', s.id || 'not entered (optional)');
    val('s-L0', 'Gauge length L₀', 'mm'); val('s-W', 'Width', 'mm'); val('s-T', 'Thickness', 'mm');
    row('Area A₀', s.W && s.T ? sig(s.W * s.T, 4) + ' mm²' : '—');
    row('Dimension source', dimSourceNow() === 'example' ? 'Example values (not measured)' : 'Typed by you');
    val('s-speed', 'Crosshead speed', 'mm/min');
    if (isRelax) {
      val('s-hold', 'Hold displacement', 'mm');
      row('Hold strain ε₀', s.hold_mm && s.L0 ? sig(s.hold_mm / s.L0, 4) : '—');
      val('s-holds', 'Hold duration', 's');
    }
    row('Temperature', s.temp || 'not entered (optional)');
    row('Environment', s.env || 'not entered (optional)');
    var md = modeRow();
    row('Connection', md[0], md[1]);
    row('Pre-test checklist', checklistOn() ? 'On: a checklist pop-up opens when you press Start' : 'Off (it can be turned on in Settings)');
    var probs = problemList(), warns = ['s-hold', 's-temp'].map(function (id) { return { id: id, text: warnText(id) }; }).filter(function (w) { return w.text; });
    var short = !link ? 'Not connected.' : link.kind === 'sim' ? 'Simulator (readings are simulated).' : 'USB tester (unvalidated).';
    $('rv-sum').textContent = (probs.length ? (probs.length === 1 ? '1 entry needs attention. ' : probs.length + ' entries need attention. ') : 'Every required entry is filled in. ') +
      (warns.length ? (warns.length === 1 ? '1 to check. ' : warns.length + ' to check. ') : '') + (dimSourceNow() === 'example' ? 'Example dimensions (not measured). ' : '') + short;
    function items(list) {
      return '<ul class="rv-list">' + list.map(function (p) { return '<li>' + esc(p.text) + ' <button type="button" class="btn-link" data-fix="' + p.id + '">Go to this field</button></li>'; }).join('') + '</ul>';
    }
    var html = '<dl class="rv-dl">' + rows.join('') + '</dl>' +
      (probs.length ? '<p class="rv-h">To fix before starting:</p>' + items(probs) : '<p class="rv-ok">Every required entry is filled in. Check the values against your specimen.</p>') +
      (warns.length ? '<p class="rv-h">Check:</p>' + items(warns) : '');
    /* Only redraw when something changed, so a button is never replaced while it is being pressed. */
    if (html !== lastReview) { lastReview = html; box.innerHTML = html; }
    if (stepsReady) stepsUpdate();
  }
  $('rv-body').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button[data-fix]') : null;
    var t = b && $(b.getAttribute('data-fix'));
    if (t) { showStepOf(t); t.focus(); }
  });
  /* ---------- guided steps ----------
     One setup step at a time (the default), or every step at once with the "Show all steps" switch (remembered in this browser).
     This only shows and hides the existing markup and adds a step bar and Back/Next buttons; no field, id, or message is rebuilt. */
  var STEP_NAMES = ['Specimen', 'Dimensions', 'Test settings', 'Connection', 'Review and start'];
  var layoutEl = app.querySelector('.live-layout'), stepsReady = false, cur = 1, maxStep = 1;
  var setupCols = app.querySelectorAll('.setup-col'), connRow = app.querySelector('.conn-row'), reviewSec = app.querySelector('section.review');
  function stepHead(n) { return n <= 3 ? setupCols[n - 1].querySelector('.step-h') : n === 4 ? connRow.querySelector('.step-h') : $('rv-title'); }
  function stepFields(n) { return n === 2 ? ['s-L0', 's-W', 's-T'] : n === 3 ? ['s-speed'].concat(isRelax ? ['s-hold', 's-holds'] : []) : []; }
  function stepValid(n) { return n === 4 ? !!link : stepFields(n).every(function (id) { return !problemText(id); }); }
  function stepWhy(n) {
    if (n === 4) return link ? '' : (PRACTICE ? 'Use the simulator to continue.' : 'Connect to the tester to continue.');
    var bad = stepFields(n).filter(function (id) { return problemText(id); })[0];
    return bad ? problemText(bad) : '';
  }
  function stepSummary(n) {
    var s = spec();
    if (n === 1) return [s.matLabel, s.id].filter(Boolean).join(' · ') || 'Nothing typed (optional)';
    if (n === 2) return s.L0 && s.W && s.T ? sig(s.L0, 4) + ' × ' + sig(s.W, 4) + ' × ' + sig(s.T, 4) + ' mm' : 'Needs entries';
    if (n === 3) return s.speed && (!isRelax || (s.hold_mm && s.hold_s)) ? sig(s.speed, 4) + ' mm/min' + (isRelax ? ' · hold ' + sig(s.hold_mm, 4) + ' mm, ' + sig(s.hold_s, 4) + ' s' : '') : 'Needs entries';
    if (n === 4) return !link ? 'Not connected' : link.kind === 'sim' ? 'Simulator' : 'USB tester';
    var p = problemList().length;
    return running ? 'Recording' : hasData ? 'Test finished' : p ? p + (p === 1 ? ' entry to fix' : ' entries to fix') : 'Ready to start';
  }
  /* Tag each step's markup, add the step bar and the Back/Next rows. */
  setupCols[0].setAttribute('data-step', '1'); setupCols[1].setAttribute('data-step', '2'); setupCols[2].setAttribute('data-step', '3');
  connRow.setAttribute('data-step', '4');
  if (connRow.nextElementSibling && !connRow.nextElementSibling.classList.contains('run-bar')) connRow.nextElementSibling.setAttribute('data-step', '4');  /* the USB-unavailable note */
  reviewSec.setAttribute('data-step', '5'); $('rv-det').setAttribute('data-step', '5'); $('r-why').setAttribute('data-step', '5');
  var bar = document.createElement('ol');
  bar.className = 'gs-bar'; bar.setAttribute('aria-label', 'Test setup steps');
  bar.innerHTML = STEP_NAMES.map(function (nm, i) {
    return '<li><button type="button" class="sb" data-go="' + (i + 1) + '"><span class="sb-n" aria-hidden="true">' + (i + 1) + '</span><span class="sb-t">' + nm + '</span><span class="sb-s"></span></button></li>';
  }).join('');
  layoutEl.parentNode.insertBefore(bar, layoutEl);
  function navFor(n) {
    var d = document.createElement('div'); d.className = 'gs-nav';
    d.innerHTML = (n > 1 ? '<button type="button" class="btn-secondary" data-back>Back</button>' : '') + (n < 5 ? '<button type="button" class="btn" data-next>Next</button>' : '') + '<span class="gs-why" role="status" aria-live="polite"></span>';
    return d;
  }
  [1, 2, 3].forEach(function (n) { setupCols[n - 1].appendChild(navFor(n)); });
  var nav4 = navFor(4); nav4.setAttribute('data-step', '4'); connRow.parentNode.insertBefore(nav4, (connRow.nextElementSibling && connRow.nextElementSibling.getAttribute('data-step') === '4') ? connRow.nextElementSibling.nextSibling : connRow.nextSibling);
  var nav5 = navFor(5); nav5.setAttribute('data-step', '5'); $('rv-det').parentNode.insertBefore(nav5, $('rv-det').nextSibling);
  /* "?" help on each step heading (both views). The text is existing wording; the tip copies it from the hidden element named here. */
  /* Which tutorial each step's "?" opens and "Watch how" offers: each plays inline on this page (tutorials.js; not offered while a test is recording). */
  var TUT_OF = PRACTICE ? { 1: 'run-simulated', 2: 'dimensions', 3: 'run-simulated', 4: 'run-simulated', 5: 'run-simulated' } : { 2: 'dimensions', 4: 'connect-usb' };
  var HELP = {
    1: ['s-mat-hint', null],
    2: ['help-step2', 'Example values come from the labeled sample data. Replace them with your specimen’s measured dimensions.'],
    3: ['help-step3', ['speed'].concat(isRelax ? ['holdmm', 'holdstrain'] : []).map(function (k) { var t = window.TERMS && window.TERMS[k]; return t ? t.name + ': ' + t.def : ''; }).filter(Boolean).join(' ')],
    4: ['help-step4', PRACTICE ? 'Simulator readings are labeled “Simulated data, not measured”. Nothing on this page connects to a tester.' : 'The USB tester is draft and unvalidated.'],
    5: ['help-step5', 'Check the values against your specimen.']
  };
  [1, 2, 3, 4, 5].forEach(function (n) {
    var h = HELP[n], head = stepHead(n);
    if (!h[0] || !head) return;
    if (h[1]) { var hid = document.createElement('div'); hid.id = h[0]; hid.hidden = true; hid.textContent = h[1]; app.appendChild(hid); }
    if (n === 3 && !app.querySelector('#help-step3').textContent) return;
    var q = document.createElement('button'); q.type = 'button'; q.className = 'help-q'; q.textContent = '?';
    q.setAttribute('aria-label', 'Help for ' + STEP_NAMES[n - 1].toLowerCase()); q.setAttribute('data-tip-id', h[0]);
    q.addEventListener('click', function () { if (window.Tutorials) window.Tutorials.show(TUT_OF[n]); });
    head.appendChild(q);
  });
  function stepsUpdate() {
    var guidedOn = document.documentElement.getAttribute('data-steps') !== 'all';
    layoutEl.classList.toggle('cur-setup', cur <= 3);
    for (var k = 1; k <= 5; k++) layoutEl.classList.toggle('cur-' + k, k === cur);
    layoutEl.classList.toggle('running', running); layoutEl.classList.toggle('has-run', running || hasData); layoutEl.classList.toggle('ended', !running && hasData);
    app.querySelectorAll('[data-step]').forEach(function (el) { el.classList.toggle('is-current', el.getAttribute('data-step') === String(cur)); });
    bar.querySelectorAll('.sb').forEach(function (b) {
      var n = +b.getAttribute('data-go'), done = n < maxStep || (n === maxStep && n < cur) || (n === 5 && hasData && !running);
      b.disabled = n > maxStep || running; b.classList.toggle('is-done', done && n !== cur); b.classList.toggle('is-cur', n === cur);
      if (n === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.querySelector('.sb-n').textContent = done && n !== cur ? '✓' : String(n);
      b.querySelector('.sb-s').textContent = stepSummary(n);
    });
    app.querySelectorAll('.gs-nav').forEach(function (nv) {
      var n = nv.getAttribute('data-step') ? +nv.getAttribute('data-step') : +nv.parentNode.getAttribute('data-step');
      var nx = nv.querySelector('[data-next]'), why = nv.querySelector('.gs-why');
      if (nx) nx.disabled = !stepValid(n);
      if (why) why.textContent = nx && !stepValid(n) ? stepWhy(n) : '';
    });
    var sw = $('steps-all'); if (sw) sw.checked = !guidedOn;
    coachContext(guidedOn);
  }
  /* What "Need help?" shows, and the one-minute hint, use wording this page already has (the "?" help and the reason Next is unavailable). */
  function helpText(n) { var e = HELP[n] && $(HELP[n][0]); return e ? e.textContent : ''; }
  function coachContext(guidedOn) {
    if (!window.HelpCoach) return;
    if (running || hasData) {   /* the card shows the status line and the Esc line this page already has; no one-minute hint while a test is running or finished */
      window.HelpCoach.setContext({ key: 'test-run-' + running, title: running ? 'Test running' : 'Test finished', quiet: true, lines: function () { var e = app.querySelector('.esc-line'); return [msgEl.textContent, e ? e.textContent : '']; } });
      return;
    }
    if (!guidedOn) { window.HelpCoach.setContext({ key: 'test-all', title: 'Setting up the test', tutorial: 'run-simulated', lines: function () { return [1, 2, 3, 4, 5].map(helpText); } }); return; }
    window.HelpCoach.setContext({ key: 'test-step-' + cur, title: cur + '. ' + STEP_NAMES[cur - 1], tutorial: TUT_OF[cur], lines: function () { return [helpText(cur), stepWhy(cur)]; } });
  }
  function goStep(n, focus) {
    cur = Math.max(1, Math.min(5, n)); maxStep = Math.max(maxStep, cur);
    stepsUpdate();
    if (focus) { var h = stepHead(cur); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); } }
  }
  /* Make the step holding an element current (used by "Go to this field" and links from search). */
  function showStepOf(el) {
    var host = el.closest ? el.closest('[data-step]') : null;
    if (host) { cur = +host.getAttribute('data-step'); maxStep = Math.max(maxStep, cur); stepsUpdate(); }
  }
  bar.addEventListener('click', function (e) { var b = e.target.closest ? e.target.closest('.sb') : null; if (b && !b.disabled) goStep(+b.getAttribute('data-go'), true); });
  app.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-next],[data-back]') : null;
    if (!t) return;
    var n = +(t.closest('[data-step]') || {getAttribute: function () { return cur; }}).getAttribute('data-step');
    if (t.hasAttribute('data-next')) { if (stepValid(n)) goStep(n + 1, true); } else goStep(n - 1, true);
  });
  $('steps-all').addEventListener('change', function (e) {
    var v = e.target.checked ? 'all' : 'guided';
    document.documentElement.setAttribute('data-steps', v);
    try { localStorage.setItem('steps', v); } catch (err) { /* applies to this page only */ }
    stepsUpdate();
  });
  /* Links from search to a step open that step. */
  function openFromHash() {
    var id = location.hash.replace('#', ''), STEP_OF = { 'spec-title': 1, 'rv-title': 5 };
    if (/^tut-/.test(id)) {   /* a link to a tutorial (for example from the Help page): go to its step, then open it */
      var slot = $(id);
      if (slot && window.Tutorials) { showStepOf(slot); setTimeout(function () { window.Tutorials.show(id.slice(4)); }, 80); }
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(STEP_OF, id)) return;   /* words such as #constructor are not steps */
    var n = STEP_OF[id];
    if (n === 5) maxStep = 5;
    goStep(n, false);
    var el = $(id); if (el && el.scrollIntoView) el.scrollIntoView();
  }
  window.addEventListener('hashchange', openFromHash);
  stepsReady = true;
  stepsUpdate();
  openFromHash();



  /* The three numbers "Fill example dimensions" wrote, so a test started with exactly those is labeled as example values. */
  var exampleDims = null;
  function dimSourceNow() {
    return exampleDims && num('s-L0') === exampleDims.L0 && num('s-W') === exampleDims.W && num('s-T') === exampleDims.T ? 'example' : 'typed';
  }
  /* Each of the Dimensions and Test settings steps has its own example link, and each fills only that step, so you choose
     step by step whether to use the example or type your own. Nothing is filled until you press one. */
  function clearFor(ids) { ids.forEach(function (id) { touched[id] = false; showMsg(id, ''); }); }
  function afterFill(ids, text) {
    clearFor(ids);
    updateOutputs(); applySpec(rec); api.refresh(running); renderReview();
    msg(text);
  }
  $('s-example-dims').addEventListener('click', function () {
    var p = TG.sampleParams(test, spec().matKey);
    if (!p) return;
    $('s-L0').value = p.specimen.L0_mm; $('s-W').value = p.specimen.width_mm; $('s-T').value = p.specimen.thickness_mm;
    exampleDims = { L0: num('s-L0'), W: num('s-W'), T: num('s-T') };
    afterFill(['s-L0', 's-W', 's-T'], 'Example dimensions filled in (from the sample data, not measurements). Replace them with your specimen’s measured dimensions.');
  });
  $('s-example-settings').addEventListener('click', function () {
    var s = spec(), p = TG.sampleParams(test, s.matKey), u = TG.sampleParams('uniaxial', s.matKey);
    if (!p) return;
    $('s-speed').value = sig(u.rate_per_s * u.specimen.L0_mm * 60, 3);
    if (isRelax) { $('s-hold').value = sig(p.hold_mm, 4); $('s-holds').value = p.hold_s; }
    afterFill(isRelax ? ['s-speed', 's-hold', 's-holds'] : ['s-speed'], 'Example settings filled in (from the sample data). Change them to your own values if you prefer.');
  });
  /* A message appears after you leave an entry (or press Start) and updates as you fix it. */
  $('spec').addEventListener('focusout', function (e) {
    if (FIELD_IDS.indexOf(e.target.id) >= 0) {
      touched[e.target.id] = true; checkField(e.target.id);
      var fid = e.target.id;
      if (window.HelpCoach && window.HELP_TIPS && problemText(fid)) {
        setTimeout(function () { if (problemText(fid)) window.HelpCoach.report('field'); else window.HelpCoach.resolve('field'); }, window.HELP_TIPS.fieldErrorMs);
      }
    }
  });
  $('spec').addEventListener('input', function (e) {
    var id = e.target.id;
    if (touched[id]) checkField(id);
    if (isRelax && (id === 's-L0' || id === 's-hold') && touched['s-hold']) checkField('s-hold');
    updateOutputs(); applySpec(rec); api.refresh(running); renderReview();
  });

  /* ---------- connections ---------- */
  /* USB serial and the simulator are in live-links.js */
  var Links = window.LiveLinks.create(DEV, isRelax), SerialLink = Links.SerialLink, SimLink = PRACTICE ? Links.SimLink : null;

  /* ---------- state ---------- */
  var link = null, running = false, hasData = false, downloaded = true;
  var baseTitle = document.title; /* the browser-tab title, with the run status in front while a test runs or has just stopped */
  var t0 = null, d0 = null, peakF = 0, holdStart = null, skipped = 0, startedAt = null, endReason = '', heartbeat = null;
  /* a link such as test-uniaxial-tension.html#al-6061 (from the Materials page) fills in that material's name */
  (function () {
    var h = (location.hash || '').replace('#', ''), sel = document.getElementById('s-mat');
    var m = window.MATERIAL_BY_ID && Object.prototype.hasOwnProperty.call(window.MATERIAL_BY_ID, h) ? window.MATERIAL_BY_ID[h] : null;
    if (sel && m) sel.value = m.name;
  })();
  var rec = newRecord('none');
  var graphRoot = $('graph-app');
  var api = TG.mount(graphRoot, {
    test: test, mode: 'live', record: rec,
    emptyText: 'Waiting for data – connect to the tester and press Start',
    fileBase: function () { return csv.fileBase(rec, startedAt); },
    details: function () { return csv.metaRows(rec, startedAt, endReason); }
  });

  function ui() {
    var on = !!link;
    if ($('c-usb')) { $('c-usb').hidden = on; $('c-usb').disabled = !hasSerial; }
    if ($('c-sim')) $('c-sim').hidden = on;
    $('c-off').hidden = !on; $('c-off').disabled = running;
    $('r-tare').disabled = !on || running;
    $('r-start').disabled = !on || running;
    $('r-stop').disabled = !on;
    /* While recording, the same STOP button is pinned to the bottom of the window so it stays in reach when the page is scrolled. */
    var dock = $('stop-dock'); if (dock) { dock.hidden = !running; document.body.classList.toggle('has-stop-dock', running); }
    $('dl-csv').disabled = running || !hasData;
    if ($('r-print')) $('r-print').disabled = running || !hasData;
    ['s-mat', 's-speed', 's-hold', 's-holds', 's-example-dims', 's-example-settings'].forEach(function (id) { if ($(id)) $(id).disabled = running; });
    $('r-why').textContent = on || running ? '' : (PRACTICE ? 'Start is available after you connect: press “Use simulator”.' : 'Start is available after you connect: press “Connect to tester (USB)”.');
    $('c-dot').className = 'dot' + (running ? ' run' : on ? ' on' : '');
    document.title = running ? 'Recording · ' + baseTitle : (on && hasData ? 'Stopped · ' + baseTitle : baseTitle);
    $('c-text').textContent = !on ? 'Not connected' : (running ? 'Recording · ' : 'Connected · ') + (link.kind === 'sim' ? 'simulator (not measured)' : 'tester (USB)');
    if (!on) $('c-now').textContent = '';
    renderReview();
  }

  /* ---------- readings from the tester ---------- */
  function toNum(s) { s = String(s === undefined ? '' : s).trim(); return s === '' ? NaN : Number(s); }
  var lastNow = 0;
  function onLine(line) {
    var s = String(line).trim();
    if (!s) return;
    var up = s.toUpperCase();
    if (up === DEV.messages.done) { if (running) finish('The tester reported the test is complete.'); return; }
    if (up.indexOf(DEV.messages.errorPrefix) === 0) {
      if (running) finish('Tester error: ' + s.slice(0, 160) + '. Recording stopped.', true);
      else msg('Tester error: ' + s.slice(0, 160), true);
      return;
    }
    var parts = s.split(/[,;\t]/), c = DEV.columns, sc = DEV.scale;
    var t = toNum(parts[c.time]) * sc.time, F = toNum(parts[c.force]) * sc.force, d = toNum(parts[c.displacement]) * sc.displacement;
    if (!isFinite(t) || !isFinite(F) || !isFinite(d)) {
      if (running) { skipped++; if (skipped === 1 && window.HelpCoach) window.HelpCoach.report('skippedLines'); }
      infoEl.textContent = 'Message from tester: ' + s.slice(0, 160);
      return;
    }
    var now = performance.now();
    if (now - lastNow > 150) { lastNow = now; $('c-now').textContent = '· Force ' + sig(F, 4) + ' N · Displacement ' + sig(d, 4) + ' mm'; }
    if (!running) return;
    if (t0 === null) { t0 = t; d0 = d; }
    var raw = rec.raw;
    raw.t.push(t - t0); raw.d.push(d - d0); raw.F.push(F);
    if (!hasData) { hasData = true; downloaded = false; if (window.HelpCoach) window.HelpCoach.resolve('noReadings'); }
    var n = raw.t.length;
    if (!isRelax) {
      if (F > peakF) peakF = F;
      if ($('r-auto').checked && peakF >= DEV.breakDetect.minPeakForce_N && F < DEV.breakDetect.dropFraction * peakF) {
        stopTest('Force drop detected: force fell below ' + Math.round(DEV.breakDetect.dropFraction * 100) + '% of its peak. STOP sent.');
        return;
      }
    } else {
      var hm = rec.params.hold_mm;
      if (holdStart === null && hm > 0 && d - d0 >= TG.holdStartFraction * hm) holdStart = t - t0;
      if ($('r-auto').checked && holdStart !== null && t - t0 - holdStart >= rec.params.hold_s) { stopTest('Hold complete. STOP sent.'); return; }
    }
    if (n >= DEV.maxPoints) { stopTest('Point limit (' + DEV.maxPoints + ') reached. STOP sent.'); return; }
    schedule();
  }
  var pending = false, lastDraw = 0;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () {
      requestAnimationFrame(function () { pending = false; lastDraw = performance.now(); api.refresh(running); });
    }, Math.max(0, 50 - (performance.now() - lastDraw)));
  }

  /* ---------- commands ---------- */
  function fill(tpl, v) { return tpl.replace(/\{(\w+)\}/g, function (m, k) { return v[k] !== undefined && v[k] !== null ? String(v[k]) : m; }); }
  function sendCmd(cmd) {
    if (!link || !cmd) return;
    link.send(cmd).catch(function (e) { msg('Could not send ' + cmd + ' to the tester: ' + (e && e.message ? e.message : e), true); });
  }
  function startTest() {
    var probs = validate();
    if (probs.length) {
      msg((probs.length === 1 ? '1 entry needs attention: ' : probs.length + ' entries need attention: ') + probs.map(function (q) { return q.name; }).join(', ') + '. The message beside each entry says what to fix.', true);
      renderReview();
      $('rv-det').open = true;
      $(probs[0].id).focus();
      return;
    }
    if (hasData && !downloaded && !window.confirm('Start a new test? The current data has not been downloaded and will be cleared.')) return;
    if (checklistOn()) { showChecklist(begin); return; }
    begin();
  }

  /* ---------- pre-test checklist (only when Settings > Pre-test checklist is On; data/checklist.js) ---------- */
  /* (the checklist pop-up is built by live-checklist.js; see `Checklist` near the top) */

  function begin() {
    if (!link) { msg(PRACTICE ? 'Not connected. Use the simulator, then press Start.' : 'Not connected. Connect to the tester, then press Start.', true); return; }
    var s = spec();
    rec = newRecord(link.kind === 'sim' ? 'simulated' : 'measured');
    api.setRecord(rec);
    t0 = d0 = null; peakF = 0; holdStart = null; skipped = 0; hasData = false; downloaded = true;
    startedAt = new Date(); endReason = ''; infoEl.textContent = '';
    running = true;
    ui();
    sendCmd(isRelax ? fill(DEV.commands.startRelaxation, { speed: s.speed, hold_mm: s.hold_mm, hold_s: s.hold_s }) : fill(DEV.commands.startUniaxial, { speed: s.speed }));
    if (DEV.commands.heartbeat && DEV.heartbeatMs) heartbeat = setInterval(function () { sendCmd(DEV.commands.heartbeat); }, DEV.heartbeatMs);
    msg('Test running' + (link.kind === 'sim' ? ' (simulated)' : '') + '. Press STOP or Esc to stop.');
    if (window.HelpCoach && window.HELP_TIPS && link.kind !== 'sim') {
      var started = rec;
      setTimeout(function () { if (running && rec === started && !hasData) window.HelpCoach.report('noReadings'); }, window.HELP_TIPS.noReadingsMs);
    }
  }
  function finish(reason, isError) {
    running = false;
    clearInterval(heartbeat); heartbeat = null;
    endReason = reason;
    rec.skippedLines = skipped;
    api.refresh(false);
    var n = rec.raw.t.length;
    msg(reason + ' ' + (n ? n + ' points recorded' + (skipped ? ' (' + skipped + ' unreadable lines skipped)' : '') + '. Download the data before you leave this page.' : 'No readings were recorded.'), isError);
    ui();
  }
  function stopTest(reason) {
    sendCmd(DEV.commands.stop);
    if (running) finish(reason || 'Stopped. STOP sent.');
    else msg('STOP sent.');
  }

  function attach(l) {
    link = l;
    l.onLine = onLine;
    l.onClose = function (why) {
      link = null;
      if (running) finish(why + ' Recording stopped; the data so far is kept.', true);
      else msg(why, true);
      ui();
    };
    ui();
  }
  if ($('c-usb')) $('c-usb').addEventListener('click', function () {
    var l = new SerialLink();
    l.open().then(function () {
      attach(l);
      msg('Connected to the tester over USB. Press Tare with no load on the specimen, then Start.');
    }).catch(function (e) {
      if (e && e.name === 'NotFoundError') msg('No port was selected.');
      else msg('Could not connect: ' + (e && e.message ? e.message : e), true);
      /* a hint with the matching Troubleshooting row (help-coach.js); it says what could be wrong, not what is */
      if (window.HelpCoach && e) {
        if (e.name === 'NotFoundError' || e.name === 'SecurityError' || e.name === 'NotAllowedError') window.HelpCoach.report('permission');
        else if (e.name === 'NetworkError' || e.name === 'InvalidStateError') window.HelpCoach.report('port');
      }
    });
  });
  if ($('c-sim')) $('c-sim').addEventListener('click', function () {
    var l = new SimLink(spec);
    l.open().then(function () {
      attach(l);
      msg('Simulator connected (practice). Its readings are simulated, not measured. Enter the specimen values (or use the Fill example links in the Dimensions and Test settings steps), then press Start.');
    });
  });
  $('c-off').addEventListener('click', function () {
    if (running || !link) return;
    var l = link;
    link = null;
    ui();
    l.close().then(function () { msg('Disconnected.'); });
  });
  $('r-tare').addEventListener('click', function () { sendCmd(DEV.commands.tare); msg('TARE sent: force zeroed.'); });
  $('r-start').addEventListener('click', startTest);
  $('r-stop').addEventListener('click', function () { stopTest('Stopped by you. STOP sent.'); });
  (function () {
    var dock = document.createElement('div');
    dock.className = 'stop-dock'; dock.id = 'stop-dock'; dock.hidden = true;
    dock.setAttribute('role', 'region'); dock.setAttribute('aria-label', 'STOP while recording');
    dock.innerHTML = '<span class="small">Not an emergency stop.</span><button type="button" class="btn-stop" id="r-stop-dock">STOP — sends a stop command</button>';
    document.body.appendChild(dock);
    $('r-stop-dock').addEventListener('click', function () { stopTest('Stopped by you. STOP sent.'); });
  })();
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && link) { stopTest('Stopped with Esc. STOP sent.'); }
  });
  $('s-mat').addEventListener('input', function () { applySpec(rec); api.refresh(running); renderReview(); });

  /* ---------- CSV download (opens in Excel) ---------- */
  /* (the CSV text is built by live-csv.js; see `csv` near the top) */
  var dl = document.createElement('button');
  dl.type = 'button'; dl.className = 'btn-secondary'; dl.id = 'dl-csv'; dl.textContent = 'Download data (CSV for Excel)';
  graphRoot.querySelector('#g-actions').insertBefore(dl, graphRoot.querySelector('#g-actions').firstChild);
  /* Print report: a one-page report of the finished test (report.js) */
  if (window.TensileReport) {
    var pr = document.createElement('button');
    pr.type = 'button'; pr.className = 'btn-secondary'; pr.id = 'r-print'; pr.textContent = 'Print report';
    dl.parentNode.insertBefore(pr, dl.nextSibling);
    pr.addEventListener('click', function () {
      if (!running && hasData) window.TensileReport.printRecord(api.reportInfo());
    });
  }
  dl.addEventListener('click', function () {
    api.save(new Blob([csv.build(rec, startedAt, endReason)], { type: 'text/csv;charset=utf-8' }), csv.fileBase(rec, startedAt) + '.csv');
    downloaded = true;
    msg('Data downloaded as ' + csv.fileBase(rec, startedAt) + '.csv. Open it in Excel, or reopen it later with Load Test.');
  });

  /* A click on a link inside the site: the site's own "Leave without saving?" pop-up (ui.js). Closing the tab, reloading, and Back
     cannot be caught that way, so the browser's own box stays for them. */
  if (window.SiteUI) window.SiteUI.leaveGuard(function () {
    if (running) return { text: 'A test is still recording. Leaving this page does not stop the machine, and the data so far will be lost.', stayNote: 'Keep recording and keep your data.', leaveNote: 'The data so far will be lost.', stop: function () { stopTest('Stopped by you. STOP sent.'); } };
    if (hasData && !downloaded) return { text: 'This test\u2019s data has not been downloaded. It is kept only in this tab and will be lost.', stayNote: 'Keep your data on this page.', leaveNote: 'The data will be lost.', download: { label: 'Download CSV and leave', note: 'Saves the CSV file first, then leaves.', run: function () { $('dl-csv').click(); } } };
    return null;
  });
  window.addEventListener('beforeunload', function (e) {
    if (window.SiteUI && window.SiteUI.leaving) return;
    if (running || (hasData && !downloaded)) { e.preventDefault(); e.returnValue = ''; }
  });

  updateOutputs();
  ui();
})();
