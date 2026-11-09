/* Site search: a magnifying-glass button in the header, to the right of Settings. Pressing it opens a small box;
   typing lists the pages and sections that match (data/search-index.js); choosing one goes there.
   Up and Down move through the results, Enter opens the highlighted one, Esc closes the box and returns to the button.
   Esc here closes the search only; it does not send STOP on a test page. Nothing is saved. */
(function () {
  'use strict';
  var nav = document.querySelector('nav[aria-label="Main"]'); /* after layouts.js, so the Sidebar layout's own menu is found too */
  var INDEX = window.SEARCH_INDEX;
  if (!nav || !INDEX || !INDEX.length) return;

  var TEXT = { button: 'Search the site', placeholder: 'Search', none: 'No pages match.', count: function (n) { return n + (n === 1 ? ' result.' : ' results.'); } };
  var MAX = 8;
  var current = (location.pathname.split('/').pop() || 'index.html');

  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var wrap = el('div', 'site-search');
  var btn = el('button', 'ss-btn', { type: 'button', 'aria-label': TEXT.button, 'aria-expanded': 'false', 'aria-controls': 'ss-box' });
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';
  var box = el('div', 'ss-box', { id: 'ss-box' });
  box.hidden = true;
  var input = el('input', 'ss-input', { type: 'text', role: 'combobox', 'aria-label': TEXT.button, placeholder: TEXT.placeholder,
    'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': 'ss-list', autocomplete: 'off', spellcheck: 'false' });
  var list = el('div', 'ss-list', { id: 'ss-list', role: 'listbox', 'aria-label': 'Search results' });
  list.hidden = true;
  var status = el('span', 'sr-only', { role: 'status' });
  box.appendChild(input);
  wrap.appendChild(btn); wrap.appendChild(box); wrap.appendChild(list); wrap.appendChild(status);
  nav.appendChild(wrap);

  var topbar = document.querySelector('.topbar'), open = false, shown = [], active = -1;

  /* every typed word must appear in the name, the label, or the extra words; names that start with a word rank first */
  function search(q) {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    var out = [];
    INDEX.forEach(function (it, i) {
      var t = it.t.toLowerCase(), hay = t + ' ' + it.w.toLowerCase() + ' ' + it.k.toLowerCase(), score = 0;
      for (var j = 0; j < words.length; j++) {
        var w = words[j];
        if (hay.indexOf(w) < 0) return;
        score += t.indexOf(w) === 0 ? 3 : t.indexOf(w) > 0 ? 2 : 1;
      }
      out.push({ it: it, score: score, i: i });
    });
    out.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
    return out.slice(0, MAX).map(function (r) { return r.it; });
  }
  function href(it) { return it.p + (it.a ? '#' + it.a : ''); }

  function render() {
    var q = input.value.trim();
    shown = search(q);
    if (!q) { list.hidden = true; list.innerHTML = ''; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); status.textContent = ''; active = -1; return; }
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
    if (!shown.length) { list.innerHTML = '<div class="ss-none">' + esc(TEXT.none) + '</div>'; status.textContent = TEXT.none; active = -1; input.removeAttribute('aria-activedescendant'); place(); return; }
    list.innerHTML = shown.map(function (it, i) {
      return '<div role="option" class="ss-opt" id="ss-o' + i + '" data-i="' + i + '" aria-selected="false"><span class="ss-t">' + esc(it.t) + '</span><span class="ss-where">' + esc(it.w) + '</span></div>';
    }).join('');
    status.textContent = TEXT.count(shown.length);
    setActive(0);
    place();
  }
  /* keep the results list inside the window: it hangs from the right edge of the search; slide it right if it would run off the left */
  function place() {
    if (list.hidden) return;
    list.style.right = '0px'; list.style.width = '';
    var r = list.getBoundingClientRect(), pad = 8;
    if (r.left < pad) list.style.right = (-(pad - r.left)) + 'px';
    r = list.getBoundingClientRect();
    if (r.right > window.innerWidth - pad) list.style.width = Math.max(160, window.innerWidth - pad * 2) + 'px';
  }
  function setActive(i) {
    var old = list.querySelector('.ss-opt.active');
    if (old) { old.classList.remove('active'); old.setAttribute('aria-selected', 'false'); }
    active = i;
    var o = i >= 0 ? document.getElementById('ss-o' + i) : null;
    if (!o) { input.removeAttribute('aria-activedescendant'); return; }
    o.classList.add('active'); o.setAttribute('aria-selected', 'true'); input.setAttribute('aria-activedescendant', o.id);
    o.scrollIntoView({ block: 'nearest' });
  }
  function openBox() {
    if (open) return;
    open = true; box.hidden = false; btn.setAttribute('aria-expanded', 'true');
    if (topbar) topbar.classList.add('search-open');
    input.focus(); render();
  }
  function closeBox(toButton) {
    if (!open) return;
    open = false; box.hidden = true; list.hidden = true; btn.setAttribute('aria-expanded', 'false');
    input.value = ''; shown = []; active = -1; status.textContent = ''; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
    if (topbar) topbar.classList.remove('search-open');
    if (toButton) btn.focus();
  }
  function go(it) {
    var target = href(it), same = it.p === current;
    closeBox(false);
    if (same && it.a) { location.hash = '#' + it.a; } else { location.href = target; }
  }

  window.addEventListener('resize', place);
  btn.addEventListener('click', function () { if (open) closeBox(false); else openBox(); });
  input.addEventListener('input', render);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!shown.length) return;
      setActive(e.key === 'ArrowDown' ? (active + 1) % shown.length : (active - 1 + shown.length) % shown.length);
    } else if (e.key === 'Enter') {
      if (active >= 0 && shown[active]) { e.preventDefault(); go(shown[active]); }
    } else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation(); closeBox(true);
    }
  });
  list.addEventListener('mousedown', function (e) { e.preventDefault(); });
  list.addEventListener('click', function (e) { var o = e.target.closest('.ss-opt'); if (o) go(shown[+o.getAttribute('data-i')]); });
  list.addEventListener('mousemove', function (e) { var o = e.target.closest('.ss-opt'); if (o && +o.getAttribute('data-i') !== active) setActive(+o.getAttribute('data-i')); });
  /* leaving the search (Tab away or a click elsewhere) closes it */
  wrap.addEventListener('focusout', function (e) { if (open && !wrap.contains(e.relatedTarget)) closeBox(false); });
  document.addEventListener('mousedown', function (e) { if (open && !wrap.contains(e.target)) closeBox(false); });
})();
