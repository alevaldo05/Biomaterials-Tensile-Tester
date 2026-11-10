/* Tutorials (window.Tutorials): short animated illustrations of the screen, drawn with SVG and CSS from data/tutorials.js.
   Each one plays INLINE, on the page where you do the thing, in a wide panel that opens under a "Watch how" button. There is no
   pop-up. Nothing is saved or sent.

   A page marks the spot with  <div class="tut-slot" data-tutorial="ID"></div>  (live.js adds its own, then calls Tutorials.scan).
   Tutorials.scan(root)  turns every slot under root into a "Watch how" button and a hidden panel; a link to page#tut-ID opens it
   Tutorials.show(id)    opens that page's panel for the tutorial, scrolls to it, and returns true (false if it is not on this page,
                         is not shown now, or a test is recording; panels are hidden while recording so nothing sits near STOP)
   Tutorials.open(id)    the same as show
   Tutorials.has(id)     true when the tutorial exists
   The Help page lists them in #tutorials-list as links to the page and spot where each one lives.
   Playback: each frame lasts about 2.5 s and the set loops. Play/Pause, Replay, and Hide are buttons. When Motion is Reduced in
   Settings (or the system asks for less motion and Motion is Follow system) the frames are shown one at a time with Back and Next. */
(function () {
  'use strict';
  var DATA = window.TUTORIALS;
  if (!DATA) return;
  var NS = 'http://www.w3.org/2000/svg', FRAME_MS = 2500;
  var S = 1.6, VW = 400 * S, VH = 250 * S;   /* the data is laid out on 400 x 250; it is drawn on a larger canvas so the text stays small and the picture wide */

  function el(tag, attrs, text) {
    var e = document.createElement(tag), k;
    for (k in (attrs || {})) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function sv(tag, attrs, text) {
    var e = document.createElementNS(NS, tag), k;
    for (k in (attrs || {})) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function find(id) { return DATA.list.filter(function (t) { return t.id === id; })[0] || null; }
  function recording() { return document.body.classList.contains('has-stop-dock'); }
  function reduced() {
    var m = document.documentElement.getAttribute('data-motion');
    if (m === 'reduced') return true;
    if (m === 'standard') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ---------- the drawing ---------- */
  var CURVE = '0,1 0.1,0.97 0.2,0.93 0.3,0.88 0.4,0.8 0.5,0.7 0.6,0.58 0.7,0.42 0.8,0.26 0.9,0.12 1,0.03';
  function drawBox(b) {
    var x = b.x * S, y = b.y * S, w = b.w * S, h = b.h * S;
    var g = sv('g', { 'class': 'tb tb-' + b.kind, 'data-id': b.id }), t = null;
    if (b.kind === 'label' || b.kind === 'link') {
      t = sv('text', { x: x, y: y + h - 3, 'class': 'tt' }, b.text || '');
    } else if (b.kind === 'graph') {
      g.appendChild(sv('rect', { x: x, y: y, width: w, height: h, rx: 4, 'class': 'tr' }));
      g.appendChild(sv('polyline', { points: CURVE.split(' ').map(function (p) { var a = p.split(','); return (x + 10 + a[0] * (w - 20)).toFixed(1) + ',' + (y + 8 + a[1] * (h - 16)).toFixed(1); }).join(' '), 'class': 'tc' }));
    } else if (b.kind === 'zoombox') {
      g.appendChild(sv('rect', { x: x, y: y, width: w, height: h, 'class': 'tr' }));
    } else if (b.kind === 'table') {
      g.appendChild(sv('rect', { x: x, y: y, width: w, height: h, rx: 4, 'class': 'tr' }));
      for (var i = 1; i < 5; i++) g.appendChild(sv('line', { x1: x, x2: x + w, y1: y + i * h / 5, y2: y + i * h / 5, 'class': 'tl' }));
      t = sv('text', { x: x + 10, y: y + 18, 'class': 'tt' }, b.text || '');
    } else {
      g.appendChild(sv('rect', { x: x, y: y, width: w, height: h, rx: b.kind === 'panel' ? 8 : 5, 'class': 'tr' }));
      if (b.text !== undefined && b.kind !== 'panel') {
        var mid = b.kind === 'btn' || b.kind === 'primary' || b.kind === 'stop' || b.kind === 'tab';
        t = sv('text', { x: mid ? x + w / 2 : x + 10, y: y + h / 2 + 4, 'class': 'tt' + (mid ? ' tm' : '') }, b.text);
      }
    }
    if (t) g.appendChild(t);
    return { box: b, g: g, text: t };
  }
  function drawScene(tut) {
    var svg = sv('svg', { viewBox: '0 0 ' + VW + ' ' + VH, 'class': 'tut-svg', role: 'img', 'aria-label': tut.title + '. ' + DATA.label });
    svg.appendChild(sv('rect', { x: 0.5, y: 0.5, width: VW - 1, height: VH - 1, rx: 8, 'class': 'tw' }));
    svg.appendChild(sv('rect', { x: 0.5, y: 0.5, width: VW - 1, height: 34, rx: 8, 'class': 'th' }));
    svg.appendChild(sv('text', { x: 14, y: 22, 'class': 'tlogo' }, 'BTT'));
    svg.appendChild(sv('text', { x: VW - 14, y: 22, 'class': 'tmenu', 'text-anchor': 'end' }, 'Home   Learn   Protocols   Materials   Calibration   About   Help   Settings'));
    var parts = tut.boxes.map(drawBox), byId = {};
    parts.forEach(function (p) { svg.appendChild(p.g); byId[p.box.id] = p; });
    var ptr = sv('g', { 'class': 'tptr' });
    ptr.appendChild(sv('path', { d: 'M0 0 L0 15 L4 11.5 L7 18 L10 16.6 L7 10.4 L12 10.4 Z', 'class': 'tpa', transform: 'scale(1.4)' }));
    svg.appendChild(ptr);
    return { svg: svg, parts: parts, byId: byId, ptr: ptr };
  }
  function inFrame(list, n) { return !list || list.indexOf(n) >= 0; }
  function applyFrame(scene, tut, n) {
    var f = tut.frames[n], texts = {}, i;
    for (i = 0; i <= n; i++) { var s = tut.frames[i].set || {}; for (var k in s) texts[k] = s[k]; }
    scene.parts.forEach(function (p) {
      var b = p.box;
      p.g.classList.toggle('is-hidden', !inFrame(b.in, n));
      p.g.classList.toggle('is-cur', !!b.cur && b.cur.indexOf(n) >= 0);
      p.g.classList.toggle('is-mark', (f.mark || []).indexOf(b.id) >= 0);
      if (p.text && texts[b.id] !== undefined) p.text.textContent = texts[b.id];
    });
    var tgt = scene.byId[f.point];
    if (tgt) scene.ptr.style.transform = 'translate(' + ((tgt.box.x + tgt.box.w * 0.7) * S).toFixed(1) + 'px,' + ((tgt.box.y + tgt.box.h * 0.55) * S).toFixed(1) + 'px)';
  }

  /* ---------- the player (inside a panel) ---------- */
  function player(tut, host, onHide) {
    var scene = drawScene(tut), cur = 0, timer = null, still = reduced(), playing = !still;
    host.textContent = '';
    host.classList.toggle('is-still', still);
    var lab = el('p', { 'class': 'tut-label' }, DATA.label);
    var extra = tut.note ? el('p', { 'class': 'tut-label tut-note' }, tut.note) : null;
    var body = el('div', { 'class': 'tut-body' }), figure = el('div', { 'class': 'tut-fig' });
    figure.appendChild(scene.svg);
    var caps = el('ol', { 'class': 'tut-caps' });
    tut.captions.forEach(function (c, i) { caps.appendChild(el('li', { 'data-i': i }, c)); });
    body.appendChild(figure); body.appendChild(caps);
    var live = el('p', { 'class': 'tut-live', role: 'status', 'aria-live': 'polite' });
    var ctl = el('div', { 'class': 'tut-ctl' });
    var play = el('button', { type: 'button', 'class': 'btn-secondary btn-small tut-play' }, 'Pause'), replay = el('button', { type: 'button', 'class': 'btn-secondary btn-small' }, 'Replay');
    var back = el('button', { type: 'button', 'class': 'btn-secondary btn-small' }, 'Back'), next = el('button', { type: 'button', 'class': 'btn btn-small tut-next' }, 'Next');
    var hide = el('button', { type: 'button', 'class': 'btn-secondary btn-small tut-hide' }, 'Hide');
    if (still) { ctl.appendChild(back); ctl.appendChild(next); ctl.appendChild(replay); } else { ctl.appendChild(play); ctl.appendChild(replay); }
    ctl.appendChild(hide);
    host.appendChild(lab); if (extra) host.appendChild(extra); host.appendChild(body); host.appendChild(live); host.appendChild(ctl);

    function show(n) {
      cur = (n + tut.frames.length) % tut.frames.length;
      applyFrame(scene, tut, cur);
      var ci = tut.frames[cur].caption;
      [].forEach.call(caps.children, function (li, i) { li.classList.toggle('is-now', i === ci); });
      live.textContent = 'Step ' + (cur + 1) + ' of ' + tut.frames.length + ': ' + tut.captions[ci];
      back.disabled = still && cur === 0; next.disabled = still && cur === tut.frames.length - 1;
    }
    function stop() { clearTimeout(timer); timer = null; }
    function tick() { timer = setTimeout(function () { show(cur + 1); tick(); }, FRAME_MS); }
    function setPlaying(on) { playing = on; stop(); play.textContent = on ? 'Pause' : 'Play'; if (on) tick(); }
    play.addEventListener('click', function () { setPlaying(!playing); });
    replay.addEventListener('click', function () { show(0); if (!still) setPlaying(true); });
    back.addEventListener('click', function () { show(cur - 1); });
    next.addEventListener('click', function () { show(cur + 1); });
    hide.addEventListener('click', function () { stop(); onHide(); });
    show(0);
    if (!still) setPlaying(true);
    return { stop: stop, focus: function () { (still ? next : play).focus(); } };
  }

  /* ---------- the spots on the pages ---------- */
  var open = {};   /* id -> { close(), focus() } for the panels that are open */
  function mount(slot) {
    var id = slot.getAttribute('data-tutorial'), tut = find(id);
    if (!tut || slot.getAttribute('data-ready')) return;
    slot.setAttribute('data-ready', '1'); slot.id = 'tut-' + id; slot.classList.add('tut-inline');
    var btn = el('button', { type: 'button', 'class': 'btn-secondary btn-small tut-toggle', 'aria-expanded': 'false', 'aria-controls': 'tut-panel-' + id }, 'Watch how: ' + tut.title);
    var panel = el('div', { 'class': 'tut-panel', id: 'tut-panel-' + id, hidden: '' });
    slot.appendChild(btn); slot.appendChild(panel);
    var pl = null;
    function close() { if (pl) { pl.stop(); pl = null; } panel.hidden = true; panel.textContent = ''; btn.setAttribute('aria-expanded', 'false'); btn.textContent = 'Watch how: ' + tut.title; delete open[id]; }
    function openIt() {
      if (recording()) return false;
      panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); btn.textContent = 'Hide: ' + tut.title;
      pl = player(tut, panel, function () { close(); btn.focus(); });
      open[id] = { close: close, focus: function () { if (pl) pl.focus(); } };
      return true;
    }
    btn.addEventListener('click', function () { if (panel.hidden) { if (openIt() && pl) pl.focus(); } else close(); });
    slot._tut = { open: openIt, close: close };
  }
  function shown(e) { return !!(e && (e.offsetWidth || e.offsetHeight || e.getClientRects().length)); }
  function show(id) {
    var slot = document.getElementById('tut-' + id);
    if (!slot || !slot._tut || recording() || !shown(slot)) return false;
    if (slot.querySelector('.tut-panel').hidden) { if (!slot._tut.open()) return false; }
    slot.scrollIntoView({ block: 'center' });
    if (open[id]) open[id].focus();
    return true;
  }
  function scan(root) {
    [].forEach.call((root || document).querySelectorAll('.tut-slot[data-tutorial]'), mount);
    var m = /^#tut-(.+)$/.exec(location.hash || '');
    if (m && find(m[1])) setTimeout(function () { show(m[1]); }, 50);
  }
  window.addEventListener('hashchange', function () { var m = /^#tut-(.+)$/.exec(location.hash || ''); if (m) show(m[1]); });

  /* ---------- the list on the Help page ---------- */
  function hub() {
    var ul = document.getElementById('tutorials-list');
    if (!ul) return;
    var intro = document.getElementById('tutorials-intro');
    if (intro) intro.textContent = DATA.label + ' Each plays on the page where you do the thing: follow a link, then press Watch how.';
    DATA.list.forEach(function (t) {
      var li = el('li'), a = el('a', { href: (t.page || 'index.html') + '#tut-' + t.id }, t.title);
      li.appendChild(a);
      if (t.where) li.appendChild(el('span', { 'class': 'muted small' }, ' – ' + t.where));
      if (t.note) li.appendChild(el('span', { 'class': 'muted small' }, ' (' + t.note.replace(/\.$/, '') + ')'));
      ul.appendChild(li);
    });
  }
  hub();
  scan(document);

  window.Tutorials = { show: show, open: show, scan: scan, has: function (id) { return !!find(id); } };
})();
