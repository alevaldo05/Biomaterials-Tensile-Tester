/* Shared pop-up pieces (window.SiteUI): a Tip, a Site pop-up (dialog), and a Dismissible note.
   Nothing here is saved or sent anywhere. Colors and fades come from ui.css.

   SiteUI.tip(target, content)   target: an element. content: text, or a function that returns text (called each time it opens).
                                 Opens on hover and on keyboard focus; closes on mouse-out, blur, or Esc.
                                 Esc closes the tip but is NOT stopped, so Esc still sends STOP on the practice page.
                                 Returns { open(), close(), destroy() }.
   Terms (no call needed): any element with data-term="key" shows that entry of window.TERMS (data/terms.js): name,
                                 one-line definition, equation, unit. An element with data-tip-id="id" shows the text of the element with that id
                                 (only <sub> and <sup> are kept). Both open on hover and on Tab focus, so give the element tabindex="0" unless it is
                                 already a button or link. The same rules as Tip: Esc closes it and is not stopped.
   SiteUI.dialog(opts)           opts: { className, labelledBy, html }. A <dialog> in the site's look, added to the page.
                                 Esc closes it and does not reach the page (so Esc does not send STOP).
                                 Returns { el, show(), close() }, or null where <dialog> is not supported.
   SiteUI.leaveGuard(fn)         fn() returns null (nothing to lose) or { text, stop, download: { label, run } }. While it returns an object, a click on a
                                 link that would leave the page, and SiteUI.navigate(url), open the "Leave without saving?" pop-up instead:
                                 Stay (the default; Esc does the same), Leave without saving, and, when given, a Download button
                                 and a STOP button (stop() is called; the pop-up then shows the new state). Closing the tab, reloading, and Back
                                 cannot be caught here; pages keep their beforeunload handler and skip it while SiteUI.leaving is true.
   SiteUI.navigate(url)          Go to url, through the guard.
   SiteUI.note(opts)             opts: { text, title, link: { href, label }, host, onClose }. A small card with an X button; not modal, never takes focus.
                                 Returns { el, close() }. */
(function () {
  'use strict';
  var uid = 0;

  /* ---------- Tip ---------- */
  var tipEl = null, tipFor = null, tipTarget = null;
  function ensureTip() {
    if (tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'siteui-tip';
    tipEl.setAttribute('role', 'tooltip');
    tipEl.id = 'siteui-tip';
    tipEl.hidden = true;
    document.body.appendChild(tipEl);
    return tipEl;
  }
  function place() {
    var t = tipEl, r = tipTarget.getBoundingClientRect(), gap = 6, m = 8;
    var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    t.style.left = '0px'; t.style.top = '0px';
    var w = t.offsetWidth, h = t.offsetHeight;
    var top = r.top - h - gap;
    if (top < m) top = r.bottom + gap;                 /* no room above: go below */
    if (top + h > vh - m) top = Math.max(m, vh - h - m);
    var left = r.left + r.width / 2 - w / 2;
    left = Math.max(m, Math.min(left, vw - w - m));
    t.style.left = Math.round(left) + 'px';
    t.style.top = Math.round(top) + 'px';
  }
  var watcher = null;
  function hideTip() {
    if (!tipEl || tipEl.hidden) return;
    tipEl.hidden = true;
    if (tipTarget) tipTarget.removeAttribute('aria-describedby');
    tipTarget = null; tipFor = null;
    if (watcher) { watcher.disconnect(); watcher = null; }
  }
  /* Copy text from a node, keeping only <sub> and <sup>; anything else becomes plain text. */
  function copyAllowed(src, dest) {
    for (var n = src.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) dest.appendChild(document.createTextNode(n.nodeValue));
      else if (n.nodeType === 1) {
        var tag = n.nodeName.toLowerCase();
        if (tag === 'sub' || tag === 'sup') { var c = document.createElement(tag); copyAllowed(n, c); dest.appendChild(c); }
        else copyAllowed(n, dest);
      }
    }
  }
  function line(cls, label, text) {
    var d = document.createElement('div'); d.className = cls;
    if (label) { var b = document.createElement('strong'); b.textContent = label; d.appendChild(b); d.appendChild(document.createTextNode(' ')); }
    d.appendChild(document.createTextNode(text)); return d;
  }
  function fillTerm(t, key) {
    var e = window.TERMS && window.TERMS[key];
    if (!e) return false;
    t.textContent = '';
    var h = document.createElement('div'); h.className = 'siteui-tip-name'; h.textContent = e.name; t.appendChild(h);
    t.appendChild(line('siteui-tip-def', '', e.def));
    if (e.eq) t.appendChild(line('siteui-tip-eq', 'Equation:', e.eq));
    if (e.unit) t.appendChild(line('siteui-tip-unit', 'Unit:', e.unit));
    return true;
  }
  function fillFrom(t, id) {
    var src = document.getElementById(id);
    if (!src) return false;
    t.textContent = '';
    var d = document.createElement('div'); d.className = 'siteui-tip-def'; copyAllowed(src, d); t.appendChild(d);
    return !!d.textContent;
  }
  function showTip(target, content) {
    var t = ensureTip(), text = typeof content === 'function' ? content() : content, ok;
    if (!text) return;
    hideTip();
    if (text && typeof text === 'object' && text.term) ok = fillTerm(t, text.term);
    else if (text && typeof text === 'object' && text.from) ok = fillFrom(t, text.from);
    else { t.textContent = text; ok = true; }
    if (!ok) return;
    t.hidden = false;
    tipTarget = target; tipFor = target;
    target.setAttribute('aria-describedby', t.id);
    place();
    /* the page may redraw the element the tip belongs to (live results): close the tip when it goes away */
    if (window.MutationObserver) {
      watcher = new MutationObserver(function () { if (tipTarget && !document.body.contains(tipTarget)) hideTip(); });
      watcher.observe(document.body, { childList: true, subtree: true });
    }
  }
  function tip(target, content) {
    function open() { showTip(target, content); }
    function close() { if (tipFor === target) hideTip(); }
    target.addEventListener('mouseenter', open);
    target.addEventListener('mouseleave', close);
    target.addEventListener('focus', open);
    target.addEventListener('blur', close);
    return {
      open: open, close: close,
      destroy: function () {
        close();
        target.removeEventListener('mouseenter', open); target.removeEventListener('mouseleave', close);
        target.removeEventListener('focus', open); target.removeEventListener('blur', close);
      }
    };
  }
  /* Terms: elements marked data-term="key" or data-tip-id="id" get a tip without any call (works for redrawn content too). */
  var TERM_SEL = '[data-term],[data-tip-id]';
  function termContent(el) {
    var k = el.getAttribute('data-term');
    return k ? { term: k } : { from: el.getAttribute('data-tip-id') };
  }
  function termTarget(e) { return e.target && e.target.closest ? e.target.closest(TERM_SEL) : null; }
  document.addEventListener('mouseover', function (e) { var el = termTarget(e); if (el && el !== tipFor) showTip(el, termContent(el)); });
  document.addEventListener('mouseout', function (e) {
    var el = termTarget(e);
    if (el && el === tipFor && !(e.relatedTarget && el.contains(e.relatedTarget))) hideTip();
  });
  document.addEventListener('focusin', function (e) { var el = termTarget(e); if (el && el !== tipFor) showTip(el, termContent(el)); });
  document.addEventListener('focusout', function (e) { var el = termTarget(e); if (el && el === tipFor) hideTip(); });

  /* Esc closes an open tip only. The event is left alone so the practice page still sends STOP. */
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTip(); });
  /* Scrolling keeps the tip with its word; it closes only when the word has scrolled out of the window. (Tab can scroll a word into view, so closing on every scroll would hide the tip it just opened.) */
  window.addEventListener('scroll', function () {
    if (!tipTarget) return;
    var r = tipTarget.getBoundingClientRect();
    if (r.bottom < 0 || r.top > document.documentElement.clientHeight || r.right < 0 || r.left > document.documentElement.clientWidth) hideTip(); else place();
  }, true);
  window.addEventListener('resize', hideTip);

  /* ---------- Site pop-up ---------- */
  function dialog(opts) {
    opts = opts || {};
    if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return null;
    var el = document.createElement('dialog');
    el.className = 'site-dialog' + (opts.className ? ' ' + opts.className : '');
    if (opts.labelledBy) el.setAttribute('aria-labelledby', opts.labelledBy);
    if (opts.html) el.innerHTML = opts.html;
    /* Esc only closes this pop-up; it must not also reach the page's Esc-sends-STOP shortcut */
    el.addEventListener('keydown', function (e) { if (e.key === 'Escape') e.stopPropagation(); });
    document.body.appendChild(el);
    return { el: el, show: function () { el.showModal(); }, close: function () { el.close(); } };
  }

  /* ---------- Dismissible note ---------- */
  var notesHost = null;
  function note(opts) {
    opts = opts || {};
    var host = opts.host;
    if (!host) {
      if (!notesHost) {
        notesHost = document.createElement('div');
        notesHost.className = 'siteui-notes';
        document.body.appendChild(notesHost);
      }
      host = notesHost;
    }
    var el = document.createElement('div');
    el.className = 'siteui-note';
    el.setAttribute('role', 'status');
    var id = 'siteui-note-' + (++uid);
    var body = document.createElement('div');
    body.className = 'siteui-note-body';
    if (opts.title) { var h = document.createElement('strong'); h.id = id; h.textContent = opts.title; body.appendChild(h); }
    var p = document.createElement('p'); p.textContent = opts.text || ''; body.appendChild(p);
    if (opts.link) { var a = document.createElement('a'); a.href = opts.link.href; a.textContent = opts.link.label; a.className = 'siteui-note-link'; var lp = document.createElement('p'); lp.appendChild(a); body.appendChild(lp); }
    var x = document.createElement('button');
    x.type = 'button'; x.className = 'siteui-note-x'; x.setAttribute('aria-label', 'Close this note'); x.textContent = '×';
    el.appendChild(body); el.appendChild(x);
    host.appendChild(el);
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      if (el.parentNode) el.parentNode.removeChild(el);
      if (typeof opts.onClose === 'function') opts.onClose();
    }
    x.addEventListener('click', close);
    return { el: el, close: close };
  }

  /* ---------- Leave pop-up ---------- */
  var guardFn = null, leavingFlag = false;
  function leaveNow(url) {
    leavingFlag = true; api.leaving = true;          /* the page's own beforeunload box is skipped for this one leave */
    setTimeout(function () { leavingFlag = false; api.leaving = false; }, 4000);
    location.href = url;
  }
  function askLeave(url) {
    var spec = guardFn && guardFn();
    if (!spec) { location.href = url; return; }
    var d = dialog({ className: 'leave-dialog', labelledBy: 'lv-title' });
    if (!d) {                                          /* very old browser without <dialog> */
      if (window.confirm('Leave without saving?\n\n' + spec.text)) leaveNow(url);
      return;
    }
    var el = d.el;
    function render() {
      spec = guardFn && guardFn();
      if (!spec) { d.close(); leaveNow(url); return; }  /* nothing is left to lose */
      el.textContent = '';
      var h = document.createElement('h2'); h.id = 'lv-title'; h.textContent = 'Leave without saving?'; el.appendChild(h);
      var p = document.createElement('p'); p.className = 'lv-text'; p.textContent = spec.text; el.appendChild(p);
      /* Each choice is one full-width button: a bold label and one plain line saying what it does. */
      function choice(cls, id, label, note, onClick) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'lv-choice ' + cls; b.id = id;
        var l = document.createElement('span'); l.className = 'lv-label'; l.textContent = label; b.appendChild(l);
        var n = document.createElement('span'); n.className = 'lv-note'; n.textContent = note; b.appendChild(n);
        b.addEventListener('click', onClick); return b;
      }
      var acts = document.createElement('div'); acts.className = 'lv-choices';
      if (spec.stop) {
        acts.appendChild(choice('lv-stopbtn', 'lv-stop', 'STOP \u2014 sends a stop command', 'Stops the test. Not an emergency stop.', function () {
          spec.stop(); render(); var s2 = el.querySelector('#lv-stay'); if (s2) s2.focus();
        }));
      }
      acts.appendChild(choice('lv-primary', 'lv-stay', 'Stay', spec.stayNote || 'Keep this page as it is.', function () { el.close(); }));
      if (spec.download) {
        acts.appendChild(choice('', 'lv-dl', spec.download.label, spec.download.note || 'Saves the file first, then leaves.', function () {
          spec.download.run(); setTimeout(function () { el.close(); leaveNow(url); }, 500);
        }));
      }
      acts.appendChild(choice('', 'lv-leave', 'Leave without saving', spec.leaveNote || 'Anything not saved will be lost.', function () { el.close(); leaveNow(url); }));
      el.appendChild(acts);
    }
    render();
    el.addEventListener('close', function () { if (el.parentNode) el.parentNode.removeChild(el); }, { once: true });
    d.show();
    var st = el.querySelector('#lv-stay'); if (st) st.focus();
  }
  document.addEventListener('click', function (e) {
    if (!guardFn || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (!/^(https?|file):$/.test(u.protocol)) return;
    if (u.origin === location.origin && u.pathname === location.pathname && u.search === location.search && u.hash) return;   /* a link within this page */
    if (!guardFn()) return;
    e.preventDefault(); e.stopPropagation();
    askLeave(u.href);
  }, true);

  var api = { tip: tip, dialog: dialog, note: note, leaving: false,
    leaveGuard: function (fn) { guardFn = fn; },
    navigate: function (url) { if (guardFn && guardFn()) askLeave(new URL(url, location.href).href); else location.href = url; } };
  window.SiteUI = api;
})();
