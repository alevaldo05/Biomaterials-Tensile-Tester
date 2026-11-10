/* Shared pop-up pieces (window.SiteUI): a Tip, a Site pop-up (dialog), and a Dismissible note.
   Nothing here is saved or sent anywhere. Colors and fades come from ui.css.

   SiteUI.tip(target, content)   target: an element. content: text, or a function that returns text (called each time it opens).
                                 Opens on hover and on keyboard focus; closes on mouse-out, blur, or Esc.
                                 Esc closes the tip but is NOT stopped, so Esc still sends STOP on a test page.
                                 Returns { open(), close(), destroy() }.
   SiteUI.dialog(opts)           opts: { className, labelledBy, html }. A <dialog> in the site's look, added to the page.
                                 Esc closes it and does not reach the page (so Esc does not send STOP).
                                 Returns { el, show(), close() }, or null where <dialog> is not supported.
   SiteUI.note(opts)             opts: { text, title, host, onClose }. A small card with an X button; not modal, never takes focus.
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
  function hideTip() {
    if (!tipEl || tipEl.hidden) return;
    tipEl.hidden = true;
    if (tipTarget) tipTarget.removeAttribute('aria-describedby');
    tipTarget = null; tipFor = null;
  }
  function showTip(target, content) {
    var t = ensureTip(), text = typeof content === 'function' ? content() : content;
    if (!text) return;
    hideTip();
    t.textContent = text;
    t.hidden = false;
    tipTarget = target; tipFor = target;
    target.setAttribute('aria-describedby', t.id);
    place();
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
  /* Esc closes an open tip only. The event is left alone so a test page still sends STOP. */
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTip(); });
  window.addEventListener('scroll', hideTip, true);
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

  window.SiteUI = { tip: tip, dialog: dialog, note: note };
})();
