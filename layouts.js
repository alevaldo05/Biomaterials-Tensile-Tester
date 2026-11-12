/* Page layouts (Settings → Layout). Loaded at the end of every page. It only rearranges what is
   already on the page (content is written once in the HTML); it never changes data or controls.
     start   – homepage shows large New Test / Load Test cards and a "More" row (default)
     sidebar – menu down the left side of every page
     cards   – long pages show each section as a separate box
     tabs    – long pages show one section at a time
     reading – long pages use a narrow text column with an "On this page" list */
(function () {
  'use strict';
  var root = document.documentElement;
  var layout = root.getAttribute('data-layout') || 'start';
  var page = location.pathname.split('/').pop() || 'index.html';
  var main = document.querySelector('main');

  /* Skip link: moves focus to <main> without changing the URL hash (several pages keep their state in the hash). */
  var skip = document.querySelector('a.skip-link');
  if (skip && main) skip.addEventListener('click', function (e) {
    e.preventDefault();
    main.focus({ preventScroll: true });
    main.scrollIntoView();
  });

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  /* Card descriptions on the homepage come from data/text/home.js (the words you edit); these are the defaults. */
  function cardText(key, fallback) {
    var c = window.SITE_TEXT && window.SITE_TEXT.home && window.SITE_TEXT.home.cards;
    var v = c && typeof c[key] === 'string' ? c[key] : fallback;
    return String(v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; });
  }
  function sections() {
    return main ? [].slice.call(main.children).filter(function (c) { return c.matches('section.section'); }) : [];
  }
  function heading(sec) { return sec.querySelector('h2'); }
  function label(sec) {
    var h = heading(sec);
    return sec.getAttribute('data-tab') || (h ? h.textContent.replace(/\s*Draft\s*$/, '').trim() : '');
  }
  function icon(path) {
    return '<svg class="card-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + path +
      '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  var long = sections().length >= 3;

  /* ---------- Start screen (homepage only) ---------- */
  if (layout === 'start' && page === 'index.html' && main) {
    var heroActions = document.querySelector('.hero .actions');
    if (heroActions) heroActions.remove();
    var start = el('div', { 'class': 'start-actions' },
      '<a class="action-card primary" href="choose-test.html">' + icon('M5 12h14M13 6l6 6-6 6') +
        '<span class="ac-title">New Test</span><span class="ac-text">' + cardText('newTest', 'Uniaxial Tension or Stress Relaxation: connect, run, and watch the graph live.') + '</span></a>' +
      '<a class="action-card" href="load-test.html">' + icon('M4 4h10l6 6v10H4zM14 4v6h6') +
        '<span class="ac-title">Load Test</span><span class="ac-text">' + cardText('loadTest', 'Reopen an earlier CSV file in this browser.') + '</span></a>');
    main.insertBefore(start, main.firstChild);
    var proto = document.getElementById('protocols');
    if (proto) proto.hidden = true;   /* replaced by the Protocols card below */
    main.appendChild(el('section', { 'class': 'section', 'aria-labelledby': 'more-title' },
      '<h2 id="more-title">More</h2><div class="mini-cards">' +
      '<a class="mini-card" href="protocol-uniaxial-tension.html"><strong>Protocols <span class="badge badge-inline">Draft</span></strong><span>' + cardText('protocols', 'Procedures for each test and material.') + '</span></a>' +
      '<a class="mini-card" href="materials.html"><strong>Materials</strong><span>' + cardText('materials', 'Properties, a stiffness chart, and sample graphs for many materials.') + '</span></a>' +
      '<a class="mini-card" href="calibration.html"><strong>Calibration</strong><span>' + cardText('calibration', 'Compare force readings with known weights and record the result.') + '</span></a>' +
      '<a class="mini-card" href="learn.html"><strong>Learn</strong><span>' + cardText('learn', 'Before you test, background, and glossary.') + '</span></a>' +
      '<a class="mini-card" href="about.html"><strong>About</strong><span>' + cardText('about', 'Tensile testing, project status, and references.') + '</span></a>' +
      '<a class="mini-card" href="help.html"><strong>Help</strong><span>' + cardText('help', 'Troubleshooting, keyboard keys, and references.') + '</span></a>' +
      '<a class="mini-card" href="settings.html"><strong>Settings</strong><span>' + cardText('settings', 'Color theme, style, and layout.') + '</span></a></div>'));
  }

  /* ---------- Sidebar (every page) ---------- */
  if (layout === 'sidebar') {
    var header = document.querySelector('header.topbar');
    var brand = header ? header.querySelector('.brand') : null;
    var items = [['Home', 'index.html'], ['New Test', 'choose-test.html'], ['Load Test', 'load-test.html'], ['Learn', 'learn.html'],
      ['Protocols', 'protocol-uniaxial-tension.html'], ['Materials', 'materials.html'], ['Calibration', 'calibration.html'], ['About', 'about.html'], ['Help', 'help.html'], ['Settings', 'settings.html']];
    var current = /^test-/.test(page) ? 'choose-test.html' : /^protocol-/.test(page) ? 'protocol-uniaxial-tension.html' : page;
    var nav = el('nav', { 'aria-label': 'Main' });
    items.forEach(function (it) {
      var a = el('a', { href: it[1] }, it[0]);
      if (it[1] === current) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    var aside = el('aside', { 'class': 'sidebar' });
    if (brand) aside.appendChild(brand);
    aside.appendChild(nav);
    aside.appendChild(el('p', { 'class': 'side-note' }, 'Prototype · hardware untested'));
    var col = el('div', { 'class': 'page-col' });
    if (header) header.remove();
    while (document.body.firstChild) col.appendChild(document.body.firstChild);
    document.body.appendChild(aside);
    document.body.appendChild(col);
    if (skip) document.body.insertBefore(skip, aside); /* keep the skip link the first thing Tab reaches */
    if (long) {
      var chips = el('nav', { 'class': 'onpage', 'aria-label': 'On this page' }, '<span>On this page</span>');
      sections().forEach(function (s) { var h = heading(s); if (h && h.id && !s.hidden) chips.appendChild(el('a', { href: '#' + h.id }, label(s))); });
      main.insertBefore(chips, sections()[0]);
    }
  }

  /* ---------- Cards (pages with several sections) ---------- */
  if (layout === 'cards' && long) {
    var ICONS = {
      'about-title': 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z', 'how-title': 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
      'proto-title': 'M6 3h9l4 4v14H6zM9 12h7M9 16h7', 'before-title': 'M9 11l3 3l8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
      'practice-title': 'M7 4l12 8-12 8z', 'bg-title': 'M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7', 'gloss-title': 'M4 18L9 6l5 12M6 14h6M15 12h5M15 16h5',
      'status-title': 'M4 20V10M10 20V4M16 20v-6M22 20H2', 'reading-title': 'M12 6c-2-2-6-2-8-1v14c2-1 6-1 8 1c2-2 6-2 8-1V5c-2-1-6-1-8 1zM12 6v14'
    };
    var grid = el('div', { 'class': 'card-grid' });
    var secs = sections();
    main.insertBefore(grid, secs[0]);
    secs.forEach(function (s) {
      s.classList.add('card');
      /* Wide content (two columns, tables, step lists, long text) spans the full row. */
      if (s.querySelector('.two-col, .steps, table, .glossary') || s.textContent.length > 900) s.classList.add('span-all');
      var h = heading(s);
      if (h && ICONS[h.id]) h.insertAdjacentHTML('beforebegin', icon(ICONS[h.id]));
      grid.appendChild(s);
    });
  }

  /* ---------- Tabs (pages with several sections) ---------- */
  if (layout === 'tabs' && long) {
    var tsecs = sections();
    var list = el('div', { 'class': 'tabs', role: 'tablist', 'aria-label': 'Sections' });
    main.insertBefore(list, tsecs[0]);
    var tabs = tsecs.map(function (s, i) {
      var id = s.id || ('section-' + i);
      s.id = id;
      s.setAttribute('role', 'tabpanel');
      var b = el('button', { type: 'button', role: 'tab', id: 'tab-' + id, 'aria-controls': id }, label(s));
      s.setAttribute('aria-labelledby', 'tab-' + id);
      list.appendChild(b);
      s.querySelectorAll('details.glossary').forEach(function (d) { d.open = true; });
      return b;
    });
    var select = function (i, focus) {
      tabs.forEach(function (b, j) {
        var on = i === j;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
        tsecs[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach(function (b, i) {
      b.addEventListener('click', function () { select(i); });
      b.addEventListener('keydown', function (e) {
        var n = tabs.length, k = { ArrowRight: i + 1, ArrowLeft: i - 1 + n, Home: 0, End: n - 1 }[e.key];
        if (k === undefined) return;
        e.preventDefault();
        select(k % n, true);
      });
    });
    /* A link to a heading inside another tab (for example #status-title) opens that tab. */
    var fromHash = function () {
      var t = location.hash ? document.getElementById(location.hash.slice(1)) : null;
      var i = t ? tsecs.findIndex(function (s) { return s === t || s.contains(t); }) : -1;
      if (i >= 0) { select(i); t.scrollIntoView(); }
      return i >= 0;
    };
    if (!fromHash()) select(0);
    window.addEventListener('hashchange', fromHash);
  }

  /* ---------- Reading (pages with several sections) ---------- */
  if (layout === 'reading' && long) {
    main.classList.add('reading');
    var wrap = el('div', { 'class': 'read-wrap' });
    var colr = el('div', { 'class': 'read-col' });
    var toc = el('nav', { 'class': 'toc', 'aria-label': 'On this page' }, '<p class="toc-title">On this page</p>');
    while (main.firstChild) colr.appendChild(main.firstChild);
    [].slice.call(colr.children).filter(function (c) { return c.matches('section.section') && !c.hidden; }).forEach(function (s) {
      var h = heading(s);
      if (h && h.id) toc.appendChild(el('a', { href: '#' + h.id }, label(s)));
    });
    wrap.appendChild(colr);
    wrap.appendChild(toc);
    main.appendChild(wrap);
    if ('IntersectionObserver' in window) {
      var links = [].slice.call(toc.querySelectorAll('a'));
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) {
            var on = a.getAttribute('href') === '#' + en.target.id;
            a.classList.toggle('active', on);
            if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
          });
        });
      }, { rootMargin: '0px 0px -70% 0px' });
      links.forEach(function (a) { var t = document.getElementById(a.getAttribute('href').slice(1)); if (t) io.observe(t); });
    }
  }
})();
