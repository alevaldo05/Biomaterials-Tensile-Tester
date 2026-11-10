/* Tutorials (window.Tutorials): short animated illustrations of the screen, drawn with SVG and CSS from data/tutorials.js.
   They open in the site pop-up (ui.js). Nothing is saved or sent.

   Tutorials.open(id)   opens one (it does nothing while a test is recording, so the pop-up never covers STOP)
   Tutorials.has(id)    true when the tutorial exists
   The Help page lists them in #tutorials-list.
   Playback: each frame lasts about 2.5 s and the set loops. Play/Pause and Replay are buttons. When Motion is Reduced in Settings
   (or the system asks for less motion and Motion is Follow system) the frames are shown one at a time with Back and Next. */
(function () {
  'use strict';
  var DATA = window.TUTORIALS, SU = window.SiteUI;
  if (!DATA || !SU) return;
  var NS = 'http://www.w3.org/2000/svg', FRAME_MS = 2500;

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
    var g = sv('g', { 'class': 'tb tb-' + b.kind, 'data-id': b.id }), t = null;
    if (b.kind === 'label' || b.kind === 'link') {
      t = sv('text', { x: b.x, y: b.y + b.h - 2, 'class': 'tt' }, b.text || '');
    } else if (b.kind === 'graph') {
      g.appendChild(sv('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 3, 'class': 'tr' }));
      g.appendChild(sv('polyline', { points: CURVE.split(' ').map(function (p) { var a = p.split(','); return (b.x + 8 + a[0] * (b.w - 16)).toFixed(1) + ',' + (b.y + 6 + a[1] * (b.h - 12)).toFixed(1); }).join(' '), 'class': 'tc' }));
    } else if (b.kind === 'zoombox') {
      g.appendChild(sv('rect', { x: b.x, y: b.y, width: b.w, height: b.h, 'class': 'tr' }));
    } else if (b.kind === 'table') {
      g.appendChild(sv('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 3, 'class': 'tr' }));
      for (var i = 1; i < 5; i++) g.appendChild(sv('line', { x1: b.x, x2: b.x + b.w, y1: b.y + i * b.h / 5, y2: b.y + i * b.h / 5, 'class': 'tl' }));
      t = sv('text', { x: b.x + 8, y: b.y + 14, 'class': 'tt' }, b.text || '');
    } else {
      g.appendChild(sv('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: b.kind === 'panel' ? 6 : 4, 'class': 'tr' }));
      if (b.text !== undefined && b.kind !== 'panel') {
        var mid = b.kind === 'btn' || b.kind === 'primary' || b.kind === 'stop' || b.kind === 'tab';
        t = sv('text', { x: mid ? b.x + b.w / 2 : b.x + 8, y: b.y + b.h / 2 + 3.5, 'class': 'tt' + (mid ? ' tm' : '') }, b.text);
      }
    }
    if (t) g.appendChild(t);
    return { box: b, g: g, text: t };
  }
  function drawScene(tut) {
    var svg = sv('svg', { viewBox: '0 0 400 250', 'class': 'tut-svg', role: 'img', 'aria-label': tut.title + '. ' + DATA.label });
    svg.appendChild(sv('rect', { x: 0.5, y: 0.5, width: 399, height: 249, rx: 6, 'class': 'tw' }));
    svg.appendChild(sv('rect', { x: 0.5, y: 0.5, width: 399, height: 22, rx: 6, 'class': 'th' }));
    svg.appendChild(sv('text', { x: 10, y: 15, 'class': 'tlogo' }, 'BTT'));
    svg.appendChild(sv('text', { x: 392, y: 15, 'class': 'tmenu', 'text-anchor': 'end' }, 'Home  Learn  Protocols  Materials  Calibration  About  Help  Settings'));
    var parts = tut.boxes.map(drawBox), byId = {};
    parts.forEach(function (p) { svg.appendChild(p.g); byId[p.box.id] = p; });
    var ptr = sv('g', { 'class': 'tptr' });
    ptr.appendChild(sv('path', { d: 'M0 0 L0 15 L4 11.5 L7 18 L10 16.6 L7 10.4 L12 10.4 Z', 'class': 'tpa' }));
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
    if (tgt) scene.ptr.style.transform = 'translate(' + (tgt.box.x + tgt.box.w * 0.7).toFixed(1) + 'px,' + (tgt.box.y + tgt.box.h * 0.55).toFixed(1) + 'px)';
  }

  /* ---------- the pop-up ---------- */
  function open(id) {
    var tut = find(id);
    if (!tut || recording()) return false;
    var d = SU.dialog({ className: 'tutorial-dialog', labelledBy: 'tut-title' });
    if (!d) return false;
    var el0 = d.el, scene = drawScene(tut), cur = 0, timer = null, still = reduced(), playing = !still;
    var h = el('h2', { id: 'tut-title' }, tut.title), x = el('button', { type: 'button', 'class': 'tut-x', 'aria-label': 'Close this tutorial' }, '×');
    var head = el('div', { 'class': 'tut-head' }); head.appendChild(h); head.appendChild(x);
    var lab = el('p', { 'class': 'tut-label' }, DATA.label);
    var extra = tut.note ? el('p', { 'class': 'tut-label tut-note' }, tut.note) : null;
    var body = el('div', { 'class': 'tut-body' }), figure = el('div', { 'class': 'tut-fig' });
    figure.appendChild(scene.svg);
    var caps = el('ol', { 'class': 'tut-caps' });
    tut.captions.forEach(function (c, i) { caps.appendChild(el('li', { 'data-i': i }, c)); });
    body.appendChild(figure); body.appendChild(caps);
    var live = el('p', { 'class': 'tut-live', role: 'status', 'aria-live': 'polite' });
    var ctl = el('div', { 'class': 'tut-ctl' });
    var play = el('button', { type: 'button', 'class': 'btn-secondary', id: 'tut-play' }, 'Pause'), replay = el('button', { type: 'button', 'class': 'btn-secondary', id: 'tut-replay' }, 'Replay');
    var back = el('button', { type: 'button', 'class': 'btn-secondary', id: 'tut-back' }, 'Back'), next = el('button', { type: 'button', 'class': 'btn', id: 'tut-next' }, 'Next');
    if (still) { ctl.appendChild(back); ctl.appendChild(next); ctl.appendChild(replay); } else { ctl.appendChild(play); ctl.appendChild(replay); }
    el0.appendChild(head); el0.appendChild(lab); if (extra) el0.appendChild(extra); el0.appendChild(body); el0.appendChild(live); el0.appendChild(ctl);
    if (still) el0.classList.add('is-still');

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
    x.addEventListener('click', function () { el0.close(); });
    el0.addEventListener('close', function () { stop(); if (el0.parentNode) el0.parentNode.removeChild(el0); }, { once: true });
    show(0); d.show();
    (still ? next : play).focus();
    if (!still) setPlaying(true);
    return true;
  }

  /* ---------- the list on the Help page ---------- */
  function hub() {
    var ul = document.getElementById('tutorials-list');
    if (!ul) return;
    var intro = document.getElementById('tutorials-intro'); if (intro) intro.textContent = DATA.label + ' Each opens in a small window with Pause and Replay.';
    DATA.list.forEach(function (t) {
      var li = el('li'), b = el('button', { type: 'button', 'class': 'btn-link', 'data-tutorial': t.id }, t.title);
      b.addEventListener('click', function () { open(t.id); });
      li.appendChild(b);
      if (t.note) li.appendChild(el('span', { 'class': 'muted small' }, ' – ' + t.note));
      ul.appendChild(li);
    });
  }
  hub();

  window.Tutorials = { open: open, has: function (id) { return !!find(id); } };
})();
