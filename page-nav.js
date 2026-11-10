/* Page navigation for Help, About, and Settings. Loaded after layouts.js.
     Help and About   a short "On this page" list (only where the chosen layout does not already show one) and a
                      "Back to top" link after each section
     Settings         a "Jump to" list of the setting groups
   Nothing is saved. Words for the controls are in TEXT below. (The site search is in site-search.js.) */
(function () {
  'use strict';
  var main = document.querySelector('main');
  if (!main) return;
  var page = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');

  var TEXT = {
    onPage: 'On this page', jumpTo: 'Jump to', top: 'Back to top',
    groups: { appearance: 'Appearance', graphs: 'Graphs', units: 'Units and digits', checklist: 'Pre-test checklist', help: 'Help prompts' }
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

  if (page === 'help' || page === 'about') { addJump(); addTop(); }
  if (page === 'settings') addSettingsJump();
})();
