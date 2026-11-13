/* The test workspace shell (window.LiveShell), used by live.js on the practice page (the website's test screen).
   It only MOVES the markup live.js has already built (so every id and listener stays valid) into the workspace layout:
     a Setup sidebar (the step bar, the setup steps, the Connection note and the Review), and a workspace beside it
     (a toolbar for Connection, Recording and the Tester, a line saying why Start is unavailable, a measurement strip, and the graph).
   The sidebar folds to a slim rail (it folds by itself while a test records) and becomes a drawer on narrow windows.
   It adds no calculation and sends nothing. live.js creates it with LiveShell.build({ ... }). */
(function () {
  'use strict';
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

  window.LiveShell = {
    /* o: { app, layout, main, form, bar, controlBar, practice } (elements built by live.js) */
    build: function (o) {
      var app = o.app, layout = o.layout, main = o.main, form = o.form, bar = o.bar, cb = o.controlBar;
      /* "Narrow" means the sidebar is a drawer: the window is 1100 px or narrower, or the room for the workspace is under 60rem (large text makes rem bigger). */
      var mq = window.matchMedia ? window.matchMedia('(max-width: 68.75rem)') : null, narrow = { matches: false };
      function measure() {
        var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, w = layout.parentNode ? layout.parentNode.clientWidth : window.innerWidth;
        var n = !!(mq && mq.matches) || w < 60 * rem;
        narrow.matches = n; layout.classList.toggle('ws-narrow', n);
      }
      measure();

      /* The pieces that go into the toolbar are taken out of the old control card first (the Connection step heading stays with its step). */
      var conn = cb.querySelector('p.conn'), actions = cb.querySelector('.graph-actions'), runBar = cb.querySelector('.run-bar');
      conn.parentNode.removeChild(conn); actions.parentNode.removeChild(actions);

      /* ---------- Setup sidebar ---------- */
      var side = el('aside', 'ws-side');
      side.id = 'ws-side'; side.setAttribute('aria-label', 'Specimen and test settings');
      var head = el('div', 'ws-side-head', '<h2 class="ws-side-title">Setup</h2><button type="button" class="btn-secondary btn-small" id="ws-side-toggle" aria-expanded="true" aria-controls="ws-side-body"></button>');
      var body = el('div', 'ws-side-body'); body.id = 'ws-side-body';
      side.appendChild(head); side.appendChild(body);
      var lock = el('p', 'small ws-lock'); lock.id = 'ws-lock'; lock.hidden = true;
      body.appendChild(bar); body.appendChild(lock); body.appendChild(form);
      /* the Connection note, its tutorial spot, and the Review: every element of step 4 or 5 inside the old control card */
      [].slice.call(cb.querySelectorAll('[data-step="4"],[data-step="5"]')).forEach(function (n) { body.appendChild(n); });
      layout.insertBefore(side, layout.firstChild);

      /* ---------- Toolbar ---------- */
      var why = app.querySelector('#r-why'), esc = cb.querySelector('.esc-line'), msgEl = app.querySelector('#r-msg'), info = app.querySelector('#r-info');
      var tare = app.querySelector('#r-tare'), start = app.querySelector('#r-start'), stop = app.querySelector('#r-stop'), auto = runBar.querySelector('label.check');
      var end = el('button', 'btn-secondary', 'End recording'); end.type = 'button'; end.id = 'r-end';
      end.title = 'Stops saving readings on this page. It does not send a stop command to the tester.';
      var save = el('button', 'btn-secondary', 'Save data'); save.type = 'button'; save.id = 'r-save'; save.hidden = true;
      save.title = 'Downloads the data as a CSV file for Excel.';
      var fresh = el('button', 'btn', 'New test'); fresh.type = 'button'; fresh.id = 'r-new'; fresh.hidden = true;

      var setupOpen = el('button', 'btn-secondary ws-setup-open', 'Setup'); setupOpen.type = 'button'; setupOpen.id = 'ws-setup-open';
      var gConn = el('div', 'ws-grp'); gConn.setAttribute('role', 'group'); gConn.setAttribute('aria-label', 'Connection');
      gConn.appendChild(el('span', 'ws-grp-t', 'Connection')); gConn.appendChild(conn); gConn.appendChild(actions);
      var gRec = el('div', 'ws-grp'); gRec.setAttribute('role', 'group'); gRec.setAttribute('aria-label', 'Recording');
      gRec.appendChild(el('span', 'ws-grp-t', 'Recording'));
      [tare, start, end, save, fresh].forEach(function (b) { gRec.appendChild(b); });
      var gTest = el('div', 'ws-grp ws-grp-tester'); gTest.setAttribute('role', 'group'); gTest.setAttribute('aria-label', 'Tester');
      gTest.appendChild(el('span', 'ws-grp-t', 'Tester')); gTest.appendChild(stop); gTest.appendChild(el('span', 'small ws-nes', 'Not an emergency stop.'));
      while (cb.firstChild) cb.removeChild(cb.firstChild);
      cb.classList.add('ws-toolbar');
      cb.appendChild(setupOpen); cb.appendChild(gConn); cb.appendChild(gRec); cb.appendChild(gTest);
      why.removeAttribute('data-step');
      stop.textContent = 'STOP tester'; stop.title = 'Sends a stop command to the tester. Not an emergency stop.';
      main.insertBefore(cb, main.firstChild);
      /* the line under the toolbar: why Start is unavailable, and the auto-stop choice */
      var line = el('div', 'ws-line'); line.appendChild(why); if (esc) line.appendChild(esc); if (auto) line.appendChild(auto);
      cb.parentNode.insertBefore(line, cb.nextSibling);

      /* ---------- Measurement strip ---------- */
      var strip = el('div', 'ws-strip');
      strip.setAttribute('role', 'group'); strip.setAttribute('aria-label', 'Current measurements');
      function cell(cls, term, label, valueHtml) {
        return '<div class="ws-cell' + (cls ? ' ' + cls : '') + '"><span class="ws-k" data-term="' + term + '" tabindex="0">' + label + '</span><span class="ws-v" data-term="' + term + '">' + valueHtml + '</span></div>';
      }
      strip.innerHTML =
        cell('', 'ws_force', 'Force', '<b id="ws-f">—</b> N') +
        cell('', 'ws_disp', 'Displacement', '<b id="ws-d">—</b> mm') +
        cell('', 'ws_elapsed', 'Elapsed', '<b id="ws-t">—</b> s') +
        cell('', 'stress', 'Stress', '<b id="ws-s">—</b> MPa') +
        cell('ws-status', 'ws_state', 'Recording', '<span class="dot" id="ws-dot" aria-hidden="true"></span> <b id="ws-state">Not connected</b>') +
        cell('ws-src', 'ws_src', 'Data', '<b id="ws-src">No data yet</b>');
      var anchor = msgEl; main.insertBefore(strip, main.querySelector('#graph-app'));
      if (msgEl) main.insertBefore(msgEl, strip);
      if (info) main.insertBefore(info, strip);

      /* ---------- Sidebar: hide, show, drawer ---------- */
      var toggle = head.querySelector('#ws-side-toggle');
      function labelToggle() {
        var collapsed = layout.classList.contains('ws-collapsed');
        if (narrow.matches) { toggle.textContent = 'Close'; toggle.setAttribute('aria-label', 'Close setup'); toggle.setAttribute('aria-expanded', String(side.classList.contains('is-open'))); return; }
        toggle.textContent = collapsed ? '»' : '« Hide setup';
        toggle.setAttribute('aria-label', collapsed ? 'Show setup' : 'Hide setup');
        toggle.setAttribute('aria-expanded', String(!collapsed));
      }
      function collapse(on) { layout.classList.toggle('ws-collapsed', !!on); if (!on) side.classList.remove('is-open'); labelToggle(); }
      toggle.addEventListener('click', function () {
        if (narrow.matches) { side.classList.remove('is-open'); setupOpen.focus(); labelToggle(); return; }
        collapse(!layout.classList.contains('ws-collapsed'));
      });
      setupOpen.addEventListener('click', function () { side.classList.add('is-open'); labelToggle(); toggle.focus(); });
      function onWidth() { measure(); if (!narrow.matches) side.classList.remove('is-open'); labelToggle(); }
      if (window.ResizeObserver && layout.parentNode) new ResizeObserver(function () { onWidth(); }).observe(layout.parentNode); else window.addEventListener('resize', onWidth);
      labelToggle();

      /* ---------- Strip values ---------- */
      function $(id) { return document.getElementById(id); }
      function setText(id, v) { var n = $(id); if (n && n.textContent !== v) n.textContent = v; }
      return {
        collapse: collapse,
        /* v: { f, d, t, s (numbers or null), state, dot ('on' | 'run' | ''), src } */
        strip: function (v) {
          function num(x, dp) { return x === null || x === undefined || !isFinite(x) ? '—' : x.toFixed(dp); }
          setText('ws-f', num(v.f, 2)); setText('ws-d', num(v.d, 2)); setText('ws-t', num(v.t, 1)); setText('ws-s', num(v.s, 2));
          setText('ws-state', v.state); setText('ws-src', v.src);
          var dot = $('ws-dot'); if (dot) dot.className = 'dot' + (v.dot ? ' ' + v.dot : '');
        },
        showEnded: function (ended) { save.hidden = !ended; fresh.hidden = !ended; end.hidden = !!ended; start.hidden = !!ended; tare.hidden = !!ended; },
        lockNote: function (text) { lock.hidden = !text; lock.textContent = text || ''; },
        buttons: { end: end, save: save, fresh: fresh, setupOpen: setupOpen }
      };
    }
  };
})();
