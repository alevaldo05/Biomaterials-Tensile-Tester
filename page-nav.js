/* Page navigation for Help, About, and Settings. Loaded after layouts.js.
     Help and About   a short "On this page" list (only where the chosen layout does not already show one) and a
                      "Back to top" link after each section
     Settings         a "Jump to" list of the setting groups
     Help             a search box at the top that narrows the Troubleshooting rows, the Keyboard rows, and the references
   Nothing is saved, and the search words are not put in the address. Words for the controls are in TEXT below. */
(function () {
  'use strict';
  var main = document.querySelector('main');
  if (!main) return;
  var page = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');

  var TEXT = {
    onPage: 'On this page', jumpTo: 'Jump to', top: 'Back to top',
    search: 'Search Help', clear: 'Clear', placeholder: 'for example: USB, Esc, Safari',
    findNote: 'Your browser’s Find (Ctrl+F) cannot see rows hidden by a search. Clear the search to look through the whole page.',
    none: 'No rows in this table match.',
    groups: { appearance: 'Appearance', graphs: 'Graphs', units: 'Units and digits', checklist: 'Pre-test checklist' }
  };

  function el(tag, attrs) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function link(href, text, cls) {
    var a = el('a', { href: href });
    if (cls) a.className = cls;
    a.textContent = text;
    return a;
  }
  function sections() { return [].slice.call(main.querySelectorAll('section.section')); }
  function heading(s) { return s.querySelector('h2'); }
  function label(s) {
    var h = heading(s);
    return s.getAttribute('data-tab') || (h ? h.textContent.replace(/\s*Draft\s*$/, '').trim() : '');
  }
  /* Put a node right after the page's title and intro line (wherever the layout has moved them). */
  function afterIntro(node) {
    var h1 = main.querySelector('h1');
    if (!h1) return;
    var at = h1.nextElementSibling && h1.nextElementSibling.matches('p.sub') ? h1.nextElementSibling : h1;
    at.parentNode.insertBefore(node, at.nextSibling);
  }

  /* ---------- "On this page" (Help, About) ---------- */
  function addJump() {
    if (main.querySelector('.onpage, .toc, .tabs')) return;   /* Sidebar, Reading, and Tabs already have one */
    var secs = sections().filter(function (s) { return heading(s) && heading(s).id; });
    if (secs.length < 2) return;
    var nav = el('nav', { 'class': 'onpage', 'aria-label': TEXT.onPage });
    var span = el('span');
    span.textContent = TEXT.onPage;
    nav.appendChild(span);
    secs.forEach(function (s) { nav.appendChild(link('#' + heading(s).id, label(s))); });
    afterIntro(nav);
  }

  /* ---------- "Back to top" (Help, About) ---------- */
  function addTop() {
    sections().forEach(function (s) {
      var p = el('p', { 'class': 'to-top' });
      p.appendChild(link('#main-content', TEXT.top, 'to-top-link'));
      s.appendChild(p);
    });
    /* Like the skip link, this moves focus without changing the address. */
    main.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a.to-top-link') : null;
      if (!a) return;
      e.preventDefault();
      main.focus({ preventScroll: true });
      main.scrollIntoView();
    });
  }

  /* ---------- "Jump to" (Settings) ---------- */
  function addSettingsJump() {
    var first = {}, order = [];
    [].slice.call(main.querySelectorAll(':scope > fieldset[data-group]')).forEach(function (f) {
      var g = f.getAttribute('data-group');
      if (!first[g] && f.id) { first[g] = f; order.push(g); }
    });
    if (order.length < 2) return;
    var nav = el('nav', { 'class': 'onpage', 'aria-label': TEXT.jumpTo + ' a group of settings' });
    var span = el('span');
    span.textContent = TEXT.jumpTo;
    nav.appendChild(span);
    order.forEach(function (g) { nav.appendChild(link('#' + first[g].id, TEXT.groups[g] || g)); });
    afterIntro(nav);
  }

  /* ---------- search (Help) ---------- */
  function addSearch() {
    var units = [].slice.call(main.querySelectorAll('table.compare tbody tr, ul.ref-list > li'));
    if (!units.length) return;   /* the text files did not load, so there is nothing to search */
    var texts = units.map(function (u) { return u.textContent.toLowerCase().replace(/\s+/g, ' '); });

    var bar = el('div', { 'class': 'help-search', role: 'search' });
    var lab = el('label', { 'for': 'help-q' });
    lab.textContent = TEXT.search;
    var row = el('div', { 'class': 'help-search-row' });
    var input = el('input', { id: 'help-q', type: 'search', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'help-q-status help-q-note', placeholder: TEXT.placeholder });
    var clear = el('button', { type: 'button', 'class': 'btn-secondary', id: 'help-q-clear' });
    clear.textContent = TEXT.clear;
    clear.hidden = true;
    row.appendChild(input);
    row.appendChild(clear);
    var status = el('p', { id: 'help-q-status', role: 'status', 'class': 'small muted' });
    var links = el('p', { id: 'help-q-links', 'class': 'small' });
    links.hidden = true;
    var note = el('p', { id: 'help-q-note', 'class': 'small muted' });
    note.textContent = TEXT.findNote;
    note.hidden = true;   /* shown only while a search is active */
    bar.appendChild(lab);
    bar.appendChild(row);
    bar.appendChild(status);
    bar.appendChild(links);
    bar.appendChild(note);
    afterIntro(bar);

    var tables = [].slice.call(main.querySelectorAll('table.compare')).map(function (t) {
      var wrap = t.closest('.table-scroll') || t, msg = el('p', { 'class': 'small muted no-rows' });
      msg.textContent = TEXT.none;
      msg.hidden = true;
      wrap.parentNode.insertBefore(msg, wrap.nextSibling);
      return { table: t, wrap: wrap, msg: msg };
    });
    var lists = [].slice.call(main.querySelectorAll('ul.ref-list'));

    function apply() {
      var raw = input.value.trim(), words = raw ? raw.toLowerCase().split(/\s+/) : [], total = 0, per = [];
      units.forEach(function (u, i) {
        var ok = !words.length || words.every(function (w) { return texts[i].indexOf(w) >= 0; });
        u.classList.toggle('filtered-out', !ok);
        if (ok && words.length) {
          total++;
          var s = u.closest('section.section'), hit = per.filter(function (p) { return p.s === s; })[0];
          if (hit) hit.n++; else per.push({ s: s, n: 1 });
        }
      });
      /* a reference group (heading, intro line, list) disappears only when none of its entries match */
      lists.forEach(function (ul) {
        var any = !!ul.querySelector('li:not(.filtered-out)');
        ul.classList.toggle('filtered-out', !any);
        var prev = ul.previousElementSibling;
        while (prev && (prev.matches('p.muted') || prev.matches('h3'))) {
          prev.classList.toggle('filtered-out', !any);
          if (prev.matches('h3')) break;
          prev = prev.previousElementSibling;
        }
      });
      tables.forEach(function (t) {
        var any = !!t.table.querySelector('tbody tr:not(.filtered-out)');
        t.wrap.classList.toggle('filtered-out', !any && words.length > 0);
        t.msg.hidden = any || !words.length;
      });
      clear.hidden = !raw;
      note.hidden = !raw;
      if (!words.length) { status.textContent = ''; links.hidden = true; links.textContent = ''; return; }
      if (!total) { status.textContent = 'No matches for “' + raw + '”. Clear the search to see everything.'; links.hidden = true; links.textContent = ''; return; }
      status.textContent = total + (total === 1 ? ' match' : ' matches') + ' in ' + per.length + (per.length === 1 ? ' section.' : ' sections.');
      links.textContent = 'Go to: ';
      per.forEach(function (p, i) {
        var h = p.s && heading(p.s);
        if (!h || !h.id) return;
        if (i) links.appendChild(document.createTextNode(', '));
        links.appendChild(link('#' + h.id, label(p.s) + ' (' + p.n + ')'));
      });
      links.hidden = false;
    }
    var timer = null;
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(apply, 150); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; apply(); }
    });
    clear.addEventListener('click', function () { input.value = ''; apply(); input.focus(); });

    /* A direct link such as help.html#ref-13 must still reach its target: clear the search if it hides it. */
    function reveal() {
      var id = location.hash.slice(1), t = null;
      try { t = id ? document.getElementById(decodeURIComponent(id)) : null; } catch (e) { t = null; }
      if (t && t.closest('.filtered-out')) { input.value = ''; apply(); t.scrollIntoView(); }
    }
    window.addEventListener('hashchange', reveal);
    reveal();
  }

  if (page === 'help' || page === 'about') { addJump(); addTop(); }
  if (page === 'settings') addSettingsJump();
  if (page === 'help') addSearch();
})();
