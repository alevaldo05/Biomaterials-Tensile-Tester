/* Practice page (practice.html): chooses the kind of practice test from the address (#uniaxial or #relaxation) before live.js builds the page, and marks
   the matching choice. Changing the choice reloads the page so the setup is built fresh; nothing is saved. */
(function () {
  'use strict';
  var app = document.getElementById('live-app');
  if (!app) return;
  function kind() { return location.hash === '#relaxation' ? 'relaxation' : 'uniaxial'; }
  app.setAttribute('data-test', kind());
  var k = kind(), u = document.getElementById('pk-uniaxial'), r = document.getElementById('pk-relaxation');
  [[u, 'uniaxial'], [r, 'relaxation']].forEach(function (p) {
    if (!p[0]) return;
    if (p[1] === k) p[0].setAttribute('aria-current', 'true'); else p[0].removeAttribute('aria-current');
  });
  document.title = (k === 'relaxation' ? 'Stress Relaxation practice' : 'Uniaxial Tension practice') + ' – Biomaterials Tensile Tester';
  window.addEventListener('hashchange', function () { location.reload(); });
})();
