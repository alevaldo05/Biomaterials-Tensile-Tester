/* The footer line of every page with the header menu: "Version 2.0". When the page comes from a deploy, the commit follows it ("Version 2.0 \u00b7 build 908eff0"):
   the deploy adds ?v=<commit> to this script's address, and a plain local copy has none, so a local copy shows only "Version 2.0".
   The release number is also in scripts/build-site.sh (version.json); change both together. */
(function () {
  'use strict';
  var VERSION = '2.0';
  var s = document.currentScript, m = s && /[?&]v=([0-9a-f]{7,40})/.exec(s.src);
  var text = 'Version ' + VERSION + (m ? ' \u00b7 build ' + m[1].slice(0, 7) : '');
  var p = document.createElement('p');
  p.className = 'build-number';
  p.textContent = text;
  /* The Sidebar layout has its own note at the foot of the menu; the line goes under it there. */
  var note = document.querySelector('.side-note');
  if (note && note.parentNode) { p.className += ' build-number-side'; note.parentNode.insertBefore(p, note.nextSibling); return; }
  var f = document.createElement('footer');
  f.className = 'site-footer';
  f.appendChild(p);
  document.body.appendChild(f);
})();
