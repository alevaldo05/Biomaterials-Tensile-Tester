/* Theme preview: draws the seven sample blocks listed in #pv-grid and measures the contrast of each set's own colors.
   Preview only. Nothing is saved or sent. The colors themselves are in theme-preview.css. */
(function () {
  'use strict';
  var grid = document.getElementById('pv-grid');
  if (!grid) return;
  var SETS = {
    'green-light':   { name: 'Green light (today)' },
    'green-dark':    { name: 'Green dark (today)' },
    'mu-green-light': { name: 'MU green light', mu: true, sub: 'Today’s green light with Manhattan Green as the accent' },
    'mu-green-dark':  { name: 'MU green dark', mu: true, sub: 'Today’s green dark with the secondary green as the accent' },
    'mu':            { name: 'MU colors', mu: true, sub: 'A separate theme: white page, Manhattan Green, gold as an accent only' },
    'purple-dark':   { name: 'Purple dark', sub: 'New: dark purple, built like green dark' },
    'pink-dark':     { name: 'Pink dark', sub: 'New: dark pink, built like green dark' }
  };
  /* [label, text color variable, background variable, minimum ratio] */
  var PAIRS = [
    ['Text on page', '--ink', '--bg', 4.5], ['Text on card', '--ink', '--surface', 4.5], ['Muted text on page', '--muted', '--bg', 4.5], ['Muted text on card', '--muted', '--surface', 4.5],
    ['Link on page', '--link', '--bg', 4.5], ['Link on card', '--link', '--surface', 4.5], ['Button text', '--accent-ink', '--accent', 4.5], ['STOP text', '--danger-ink', '--danger', 4.5],
    ['Mark on page', '--mark', '--bg', 3], ['Focus ring on page', '--focus', '--bg', 3], ['Button border on card', '--accent', '--surface', 3]
  ];

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function rgb(hex) {
    var h = String(hex).trim().replace('#', '');
    if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
    return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; });
  }
  function lum(hex) {
    var c = rgb(hex).map(function (v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  function graph() {
    var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 240 110'); s.setAttribute('class', 'pv-graph'); s.setAttribute('role', 'img'); s.setAttribute('aria-label', 'Sample graph in this color set');
    function add(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); s.appendChild(e); return e; }
    for (var i = 1; i < 5; i++) add('line', { x1: 28, x2: 232, y1: 10 + i * 18, y2: 10 + i * 18, style: 'stroke: var(--line)' });
    add('line', { x1: 28, x2: 28, y1: 8, y2: 100, style: 'stroke: var(--muted)' }); add('line', { x1: 28, x2: 232, y1: 100, y2: 100, style: 'stroke: var(--muted)' });
    add('polyline', { points: '28,98 60,94 92,86 124,72 156,52 188,30 216,16', fill: 'none', style: 'stroke: var(--accent); stroke-width: 2.5' });
    add('circle', { cx: 188, cy: 30, r: 4.5, style: 'fill: var(--mark)' });
    var t = add('text', { x: 30, y: 108, style: 'fill: var(--muted); font-size: 8px' }); t.textContent = 'Sample data, not measured';
    return s;
  }

  function build(key) {
    var def = SETS[key], box = el('section', 'pv'); box.setAttribute('data-pv', key); box.setAttribute('aria-label', def.name);
    box.appendChild(el('h2', '', def.name));
    if (def.sub) box.appendChild(el('p', 'pv-sub', def.sub));
    if (def.mu) box.appendChild(el('p', 'pv-unv', 'Unverified: MU color values come from the project plan, not yet compared with the official guidelines.'));
    var head = el('div', 'pv-head'); head.appendChild(el('span', 'pv-logo', 'BTT'));
    var nav = el('nav', 'pv-nav'); nav.setAttribute('aria-label', def.name + ' sample menu');
    ['Home', 'Learn', 'Materials', 'Help'].forEach(function (t) { var a = el('a', '', t); a.href = '#'; a.setAttribute('tabindex', '-1'); a.addEventListener('click', function (e) { e.preventDefault(); }); nav.appendChild(a); });
    head.appendChild(nav); box.appendChild(head);
    var row = el('div', 'pv-row');
    row.appendChild(el('button', 'btn', 'New Test')); row.appendChild(el('button', 'btn-secondary', 'Load Test'));
    row.appendChild(el('button', 'btn-stop', 'STOP'));
    var lk = el('a', '', 'A link'); lk.href = '#'; lk.setAttribute('tabindex', '-1'); lk.addEventListener('click', function (e) { e.preventDefault(); }); row.appendChild(lk);
    var f = el('button', 'pv-ctl pv-focus', 'Focus ring'); f.type = 'button'; f.setAttribute('tabindex', '-1'); row.appendChild(f);
    box.appendChild(row);
    var card = el('div', 'pv-card'); card.appendChild(el('h3', '', 'Card heading')); card.appendChild(el('p', '', 'Body text on a card, with a '));
    var lk2 = el('a', '', 'link'); lk2.href = '#'; lk2.setAttribute('tabindex', '-1'); lk2.addEventListener('click', function (e) { e.preventDefault(); }); card.firstChild.nextSibling.appendChild(lk2);
    card.firstChild.nextSibling.appendChild(document.createTextNode(' and '));
    card.firstChild.nextSibling.appendChild(el('span', 'muted', 'muted text.'));
    box.appendChild(card);
    var tb = el('table'); tb.innerHTML = '<thead><tr><th scope="col">Result</th><th scope="col">Value</th></tr></thead><tbody><tr><th scope="row">Modulus estimate</th><td>8.55 MPa</td></tr><tr><th scope="row">UTS</th><td>0.731 MPa</td></tr></tbody>';
    box.appendChild(tb);
    box.appendChild(el('p', 'pv-warn', 'A check or warning (mark color on the left edge).'));
    box.appendChild(el('p', 'pv-err', 'Enter the gauge length in mm.'));
    box.appendChild(graph());
    box.appendChild(el('p', 'pv-sub', 'Measured contrast (needs 4.5 text, 3 mark, ring, border):'));
    var cr = el('table', 'pv-cr'); cr.setAttribute('data-cr', key);
    box.appendChild(cr);
    return box;
  }

  grid.textContent = '';
  grid.getAttribute('data-sets').split(',').forEach(function (k) { if (SETS[k]) grid.appendChild(build(k)); });

  /* Measure from the computed colors of each block, so the numbers always match what is drawn. */
  var failed = 0;
  [].forEach.call(grid.querySelectorAll('.pv'), function (box) {
    var cs = getComputedStyle(box), cr = box.querySelector('.pv-cr'), rows = '';
    PAIRS.forEach(function (p) {
      var r = ratio(cs.getPropertyValue(p[1]), cs.getPropertyValue(p[2])), ok = r >= p[3];
      if (!ok) failed++;
      rows += '<tr><th scope="row">' + p[0] + '</th><td class="n">' + r.toFixed(1) + ' : 1</td><td class="' + (ok ? 'pv-ok' : 'pv-bad') + '">' + (ok ? 'Pass' : 'Below ' + p[3]) + '</td></tr>';
    });
    cr.innerHTML = '<tbody>' + rows + '</tbody>';
  });
  var note = document.createElement('p');
  note.className = 'small'; note.setAttribute('role', 'status');
  note.textContent = failed ? failed + ' measured pair' + (failed === 1 ? '' : 's') + ' below its minimum (marked in the tables).' : 'Every measured pair in every set meets its minimum.';
  grid.parentNode.insertBefore(note, grid);
})();
