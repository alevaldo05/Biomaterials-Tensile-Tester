/* Protocol pages: a material choice (General, or "To be added at a later date") and four tabs: Steps, Specimen and
   equipment, Report and notes, and the example graph with the governing equations. The draft procedure
   comes from data/protocols.js; the example graph (labeled sample data) is drawn by graph.js.
   Links: #general/step-3 (a step), #general/graph (a tab). Nothing is saved. */
(function () {
  'use strict';
  var box = document.getElementById('protocol-app');
  var graph = document.getElementById('graph-app');
  if (!box || !window.PROTOCOLS) return;
  var test = box.getAttribute('data-test');
  var data = window.PROTOCOLS[test] || {};
  var TEST_PAGE = test === 'relaxation' ? 'test-stress-relaxation.html' : 'test-uniaxial-tension.html';
  /* Only the General procedure is written (data/protocols.js). The second choice is a placeholder for material-specific
     procedures that will be added later; until then it shows the General text with a note. */
  var TABS = [['general', 'General (no specific material)', null], ['later', 'To be added at a later date', null]];
  var PANELS = [['steps', 'Steps'], ['setup', 'Specimen and equipment'], ['report', 'Report and notes'], ['graph', 'Example graph and equations']];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  /* escape, then highlight [placeholders] */
  function txt(s) { return esc(s).replace(/\[([^\]]+)\]/g, '<span class="ph">[$1]</span>'); }
  function shortText(s) { s = String(s).replace(/\[[^\]]*\]/g, '[…]'); return s.length > 58 ? s.slice(0, 55).replace(/\s+\S*$/, '') + '…' : s; }

  /* ---------- link in the address bar ---------- */
  function parseHash() {
    var parts = (location.hash || '').replace('#', '').split('/'), mat = 'general', tab = 'steps', step = 0;
    parts.forEach(function (p) {
      if (TABS.some(function (t) { return t[0] === p; })) mat = p;
      else if (PANELS.some(function (t) { return t[0] === p; })) tab = p;
      else if (/^step-\d+$/.test(p)) { tab = 'steps'; step = parseInt(p.slice(5), 10); }
    });
    return { mat: mat, tab: tab, step: step };
  }
  var cur = parseHash(), matKey = cur.mat, tabKey = cur.tab;
  function hashFor(extra) { return '#' + matKey + (extra ? '/' + extra : (tabKey !== 'steps' ? '/' + tabKey : '')); }
  function setHash(extra) { try { history.replaceState(null, '', hashFor(extra)); } catch (e) { /* file:// may block this */ } }

  /* ---------- page skeleton ---------- */
  box.innerHTML =
    '<div class="mat-pick"><label for="protocol-material">Material</label><select id="protocol-material">' +
      TABS.map(function (t) { return '<option value="' + t[0] + '">' + esc(t[1]) + '</option>'; }).join('') +
    '</select><a class="mat-link" id="protocol-mat-link" href="materials.html">Properties on the Materials page</a></div>' +
    '<p class="muted small" id="protocol-mat-note" hidden></p>' +
    '<p class="lead" id="protocol-lead"></p>' +
    '<div class="proto-tabs" role="tablist" aria-label="Protocol sections">' +
      PANELS.map(function (p) { return '<button type="button" role="tab" id="tab-' + p[0] + '" aria-controls="panel-' + p[0] + '" data-tab="' + p[0] + '">' + p[1] + '</button>'; }).join('') +
    '</div>' +
    PANELS.map(function (p) { return '<div class="proto-panel" role="tabpanel" id="panel-' + p[0] + '" aria-labelledby="tab-' + p[0] + '" tabindex="-1" hidden></div>'; }).join('');

  /* the example graph and equations sections already on the page move into the last tab */
  var graphPanel = document.getElementById('panel-graph');
  ['graph-section', 'equations-section'].forEach(function (id) {
    var s = document.getElementById(id);
    if (s) graphPanel.appendChild(s);
  });

  var api = graph && window.TensileGraph ? window.TensileGraph.mount(graph, { test: test, mode: 'example' }) : null;
  var live = document.createElement('div');
  live.className = 'sr-only'; live.setAttribute('aria-live', 'polite');
  box.appendChild(live);

  /* ---------- tabs ---------- */
  function selectTab(key, focusTab) {
    tabKey = key;
    PANELS.forEach(function (p) {
      var on = p[0] === key, b = document.getElementById('tab-' + p[0]);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      document.getElementById('panel-' + p[0]).hidden = !on;
    });
    if (focusTab) document.getElementById('tab-' + key).focus();
    spy();
  }
  box.querySelectorAll('[role="tab"]').forEach(function (b, i, all) {
    b.addEventListener('click', function () { selectTab(b.getAttribute('data-tab')); setHash(); });
    b.addEventListener('keydown', function (e) {
      var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : -1;
      if (j < 0) return;
      e.preventDefault();
      var nb = all[(j + all.length) % all.length];
      selectTab(nb.getAttribute('data-tab'), true); setHash();
    });
  });

  /* ---------- steps with a jump list ---------- */
  var io = null, lockUntil = 0;
  function mark(n) {
    document.querySelectorAll('.step-nav a').forEach(function (a) {
      var on = a.getAttribute('data-step') === String(n);
      a.classList.toggle('is-here', on);
      if (on) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
  }
  function spy() {
    if (io) { io.disconnect(); io = null; }
    var cards = [].slice.call(document.querySelectorAll('.step-card'));
    if (tabKey !== 'steps' || !cards.length || !('IntersectionObserver' in window)) return;
    io = new IntersectionObserver(function (entries) {
      if (Date.now() < lockUntil) return; /* just jumped to a step: keep it highlighted */
      entries.forEach(function (en) { if (en.isIntersecting) mark(en.target.id.replace('step-', '')); });
    }, { rootMargin: '-15% 0px -70% 0px' });
    cards.forEach(function (c) { io.observe(c); });
  }
  function goStep(n, quiet) {
    var card = document.getElementById('step-' + n);
    if (!card) return;
    selectTab('steps');
    card.scrollIntoView({ block: 'start' });
    card.focus({ preventScroll: true });
    mark(n); lockUntil = Date.now() + 1200;
    card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
    setHash('step-' + n);
    if (!quiet) live.textContent = 'Step ' + n + '.';
  }
  function stepLinks(text) {
    var links = [['setup', 'Specimen and equipment'], ['graph', 'Example graph']];
    if (/download|report|record|note /i.test(text)) links.push(['report', 'Report and notes']);
    var out = links.map(function (l) { return '<a href="#" data-go="' + l[0] + '">' + l[1] + '</a>'; });
    if (/New Test|Connect|Press Start|Tare/i.test(text)) out.push('<a href="' + TEST_PAGE + '">Open the test page</a>');
    return out.join('');
  }
  function copyText(text, done) {
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); }); return; }
    fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    var t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(t); done();
  }

  function list(items, ordered) {
    var tag = ordered ? 'ol' : 'ul';
    return '<' + tag + '>' + items.map(function (i) { return '<li>' + txt(i) + '</li>'; }).join('') + '</' + tag + '>';
  }
  function part(title, items, cls) {
    return items && items.length ? '<section class="protocol-part' + (cls ? ' ' + cls : '') + '"><h2>' + title + '</h2>' + list(items) + '</section>' : '';
  }
  /* References: [ "text", "https://link" ] pairs; only https links become links. */
  function refs(items, note) {
    if (!items || !items.length) return '';
    return '<section class="protocol-part"><h2>References</h2>' + (note ? '<p class="muted small">' + esc(note) + '</p>' : '') + '<ul class="refs">' +
      items.map(function (r) {
        var t = esc(r[0]), u = r[1];
        return '<li>' + (u && /^https:\/\/[^\s"<>]+$/.test(u) ? '<a href="' + esc(u) + '">' + t + '</a>' : t) + '</li>';
      }).join('') + '</ul></section>';
  }

  function render(key) {
    var p = data.general;
    matKey = key;
    var sel = document.getElementById('protocol-material');
    if (sel.value !== key) sel.value = key;
    var mnote = document.getElementById('protocol-mat-note');
    mnote.hidden = key === 'general';
    if (!mnote.hidden) mnote.textContent = 'No material-specific protocol has been added yet. The General procedure is shown.';
    var lead = document.getElementById('protocol-lead');
    var steps = document.getElementById('panel-steps'), setup = document.getElementById('panel-setup'), report = document.getElementById('panel-report');
    if (!p) {
      lead.textContent = '';
      [steps, setup, report].forEach(function (d) { d.innerHTML = '<p class="muted">No protocol entered yet.</p>'; });
    } else {
      lead.innerHTML = txt(p.summary || '');
      var st = p.steps || [];
      steps.innerHTML = st.length ?
        '<div class="steps-layout"><nav class="step-nav" id="step-nav" aria-label="Jump to a step" tabindex="-1"><h2>Jump to step</h2><ol>' +
          st.map(function (s, i) { return '<li><a href="#" data-step="' + (i + 1) + '"><span class="n">' + (i + 1) + '</span>' + esc(shortText(s)) + '</a></li>'; }).join('') +
        '</ol></nav><ol class="step-cards">' +
          st.map(function (s, i) {
            return '<li class="step-card" id="step-' + (i + 1) + '" tabindex="-1"><span class="step-num" aria-hidden="true">' + (i + 1) + '</span>' +
              '<div class="step-main"><p class="step-text"><span class="sr-only">Step ' + (i + 1) + ': </span>' + txt(s) + '</p>' +
              '<p class="step-links">' + stepLinks(s) +
              '<a href="#" data-top="1">Back to the step list</a>' +
              '<button type="button" class="copy-link" data-copy="' + (i + 1) + '">Copy link to this step</button></p></div></li>';
          }).join('') +
        '</ol></div>' : '<p class="muted">No steps entered yet.</p>';
      if (p.status) steps.innerHTML = '<p class="protocol-status" role="note">' + txt(p.status) + '</p>' + steps.innerHTML;
      steps.innerHTML += part('Reasons to stop or flag', p.stop, 'protocol-stop');
      setup.innerHTML = '<div class="protocol-grid">' + part('Specimen preparation', p.specimen) + part('Equipment and measurement methods', p.equipment) + '</div>' +
        part('Settings and reference conditions', p.settings);
      report.innerHTML = '<div class="protocol-grid">' + part('Required results', p.report) + part('Limitations', p.notes) + '</div>' +
        (p.record && p.record.length ? '<details class="protocol-part protocol-record"><summary>Required metadata: the specimen and test record</summary>' + list(p.record) + '</details>' : '') +
        refs(p.refs, p.refnote);
    }
    var tab = TABS.filter(function (t) { return t[0] === key; })[0];
    var note = document.getElementById('example-note');
    if (api) {
      var has = !tab[2] || api.hasMaterial(tab[2]);
      graph.hidden = !has;
      if (!tab[2]) { api.setChoices(['biomaterial']); api.setMaterial('biomaterial', true); }
      else if (has) api.setMaterial(tab[2], true);
      if (note) note.textContent = !has ? 'There is no example graph for ' + tab[1] + ' in this test yet. Stress relaxation examples exist for skin, mild steel, and concrete only.' :
        tab[2] ? 'Example for ' + tab[1] + ', from labeled sample data (not measured). For materials other than skin, mild steel, and concrete, the curve is a schematic generated from illustrative inputs, not experimental data or a validated material model.' :
        'Example from labeled sample data (not measured). The curve is a soft-tissue sample and does not represent every material.';
    }
    spy();
  }

  box.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-step], a[data-go], a[data-top], button[data-copy]') : null;
    if (!a) return;
    if (a.hasAttribute('data-step')) { e.preventDefault(); goStep(parseInt(a.getAttribute('data-step'), 10)); }
    else if (a.hasAttribute('data-go')) {
      e.preventDefault(); selectTab(a.getAttribute('data-go')); setHash();
      var pan = document.getElementById('panel-' + tabKey); pan.scrollIntoView({ block: 'start' }); pan.focus({ preventScroll: true });
    } else if (a.hasAttribute('data-top')) {
      e.preventDefault();
      var nav = document.getElementById('step-nav'); nav.scrollIntoView({ block: 'start' }); nav.focus({ preventScroll: true }); setHash();
    } else {
      var n = a.getAttribute('data-copy');
      copyText(location.href.split('#')[0] + '#' + matKey + '/step-' + n, function () { live.textContent = 'Link to step ' + n + ' copied.'; a.textContent = 'Link copied'; setTimeout(function () { a.textContent = 'Copy link to this step'; }, 2000); });
    }
  });

  document.getElementById('protocol-material').addEventListener('change', function (e) {
    render(e.target.value);
    setHash();
  });
  render(matKey);
  selectTab(tabKey);
  if (cur.step) goStep(cur.step, true);

  /* a link pasted into the same tab, or the Back button, changes only the part after # */
  window.addEventListener('hashchange', function () {
    var h = parseHash();
    if (h.mat !== matKey) {
      render(h.mat);
    }
    selectTab(h.tab);
    if (h.step) goStep(h.step, true);
  });
})();
