/* "Need help?" button and hints that appear by themselves (window.HelpCoach). Built on the shared pieces in ui.js.
   Nothing is saved or sent. The only stored value is the Settings choice "Help prompts" (data-helpprompts on <html>).

   The page script tells it two things:
     HelpCoach.setContext({ key, title, lines })  what the person is doing now (lines: a list of strings, or a function that returns one; quiet: true = no one-minute hint).
                                                  The wording comes from text the page already shows. Use setContext(null) when no help is needed
                                                  (a test is recording). After a minute without activity in the same context, one hint shows it.
     HelpCoach.report(problemKey)                 something went wrong (keys are in data/help-tips.js). The hint shows the matching
                                                  Troubleshooting row from data/text/help.js.
     HelpCoach.resolve(problemKey)                the problem went away: its hint closes (and may show again if it returns).
   Hints are one at a time, small, closable with their X, never take keyboard focus, and never use Esc (Esc is STOP on test pages).
   A hint closed with X stays closed for that problem until the page is reloaded. */
(function () {
  'use strict';
  var SU = window.SiteUI, TIPS = window.HELP_TIPS;
  if (!SU || !TIPS) return;
  var ctx = null, closed = {}, shown = null, idle = null, card = null, btn = null;

  function promptsOn() { return document.documentElement.getAttribute('data-helpprompts') !== 'off'; }
  function troubleRows() {
    var t = window.SITE_TEXT && window.SITE_TEXT.help && window.SITE_TEXT.help.sections && window.SITE_TEXT.help.sections['trouble-title'], out = [];
    ((t && t.blocks) || []).forEach(function (b) { if (b && b.table && b.table.rows) out = out.concat(b.table.rows); });
    return out;
  }
  function rowFor(key) {
    var p = TIPS.problems[key], rows = troubleRows(), i;
    if (!p) return null;
    for (i = 0; i < rows.length; i++) if (String(rows[i][0]).indexOf(p.match) === 0) return rows[i];
    return null;
  }
  function ctxLines() {
    var l = ctx && (typeof ctx.lines === 'function' ? ctx.lines() : ctx.lines);
    return (l || []).filter(Boolean);
  }

  /* ---------- hints ---------- */
  function showHint(key, title, text) {
    if (!promptsOn() || closed[key] || (shown && shown.key === key) || !text) return;
    hideHint();
    var n = SU.note({ title: title, text: text, link: TIPS.troubleshooting, onClose: function () { closed[key] = true; if (shown && shown.note === n) shown = null; } });
    shown = { key: key, note: n };
  }
  function hideHint() { if (shown) { var s = shown; shown = null; s.note.el.parentNode && s.note.el.parentNode.removeChild(s.note.el); } }
  function report(key) {
    var r = rowFor(key);
    if (r) showHint(key, TIPS.problems[key].title || r[0], r[1]);
  }
  function resolve(key) { if (shown && shown.key === key) hideHint(); }

  /* ---------- a minute without activity in the same context ---------- */
  function arm() {
    clearTimeout(idle); idle = null;
    if (!ctx || ctx.quiet || !promptsOn()) return;
    var c = ctx;
    idle = setTimeout(function () {
      if (ctx !== c || (card && !card.hidden)) return;
      var l = ctxLines();
      if (l.length) showHint('stuck:' + c.key, c.title, l.join(' '));
    }, TIPS.stuckMs);
  }
  ['keydown', 'pointerdown', 'input', 'change'].forEach(function (t) { document.addEventListener(t, arm, true); });
  function setContext(c) {
    var changed = !c || !ctx || ctx.key !== c.key;
    ctx = c || null;
    if (changed) { if (shown && shown.key.indexOf('stuck:') === 0) hideHint(); arm(); }
    if (card && !card.hidden) fillCard();
  }

  /* ---------- the "Need help?" button and its card ---------- */
  function fillCard() {
    var l = ctxLines();
    card.querySelector('.hc-body').textContent = '';
    var b = card.querySelector('.hc-body');
    var h = document.createElement('h2'); h.id = 'hc-title'; h.textContent = ctx ? ctx.title : 'Help'; b.appendChild(h);
    l.forEach(function (t) { var p = document.createElement('p'); p.textContent = t; b.appendChild(p); });
    var p2 = document.createElement('p'), a = document.createElement('a');
    a.href = TIPS.troubleshooting.href; a.textContent = TIPS.troubleshooting.label; p2.appendChild(a); b.appendChild(p2);
  }
  function toggleCard(open) {
    var on = open === undefined ? card.hidden : open;
    if (on) { fillCard(); card.hidden = false; hideHint(); } else card.hidden = true;
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  function build() {
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'hc-btn'; btn.id = 'need-help'; btn.textContent = 'Need help?';
    btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'hc-card');
    card = document.createElement('div'); card.className = 'hc-card'; card.id = 'hc-card'; card.hidden = true;
    card.setAttribute('role', 'region'); card.setAttribute('aria-labelledby', 'hc-title');
    card.innerHTML = '<div class="hc-body"></div><button type="button" class="hc-x" aria-label="Close help">×</button>';
    card.querySelector('.hc-x').addEventListener('click', function () { toggleCard(false); btn.focus(); });
    btn.addEventListener('click', function () { toggleCard(); });
    document.body.appendChild(card); document.body.appendChild(btn);
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);

  window.HelpCoach = { setContext: setContext, report: report, resolve: resolve };
})();
