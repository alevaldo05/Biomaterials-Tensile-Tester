/* Shows which version of the site is loaded. The deploy adds ?v=<commit> to this script's address; a plain local copy has none, so nothing is shown. */
(function () {
  'use strict';
  var s = document.currentScript, m = s && /[?&]v=([0-9a-f]{7,40})/.exec(s.src);
  if (!m) return;
  var p = document.createElement('p');
  p.className = 'build-number';
  p.textContent = 'Site version: ' + m[1].slice(0, 7);
  /* The Sidebar layout has its own note at the foot of the menu; the line goes under it there. */
  var note = document.querySelector('.side-note');
  if (note && note.parentNode) { p.className += ' build-number-side'; note.parentNode.insertBefore(p, note.nextSibling); }
  else document.body.appendChild(p);
})();
