/* Text checker: reports, for each text file in data/text/, whether it loaded, whether every section is
   present and readable, and (if the file has a typing mistake) which line the browser stopped at. */
(function () {
  'use strict';
  var ST = window.SiteText, box = document.getElementById('check-report');
  if (!ST || !box) return;
  var PAGE_URL = { home: 'index.html', learn: 'learn.html', help: 'help.html', about: 'about.html' };
  var esc = ST.esc, html = '', allGood = true;

  Object.keys(ST.PAGES).forEach(function (key) {
    var cfg = ST.PAGES[key], res = ST.validate(key);
    var syntax = (window.__textErrors || []).filter(function (e) { return e.file.indexOf(cfg.file) >= 0; });
    var total = cfg.sections.length, good = res.loaded && !res.problems.length && !res.missing.length && !syntax.length;
    if (!good) allGood = false;
    html += '<section class="cmp-card"><h2>' + esc(key.charAt(0).toUpperCase() + key.slice(1)) + ' <span class="tag">' + (good ? 'OK' : 'Needs attention') + '</span></h2>' +
      '<p class="muted small">File: <code>' + esc(cfg.file) + '</code> · Page: <a href="' + PAGE_URL[key] + '">' + PAGE_URL[key] + '</a> · Sections readable: ' + res.ok + ' of ' + total + '</p>';
    if (syntax.length) {
      html += '<p class="text-error" role="alert"><strong>The file has a typing mistake and could not load.</strong> The browser stopped at line ' + esc(syntax[0].line) + ': ' + esc(syntax[0].message) + '. Look just above that line for a missing quotation mark, comma, bracket, or brace, or compare with the example at the top of the file.</p>';
    } else if (!res.loaded) {
      html += '<p class="text-error" role="alert"><strong>The file did not load.</strong> Check that it exists in <code>data/text/</code> and that its name is spelled exactly as above.</p>';
    }
    res.missing.forEach(function (id) { html += '<p class="text-error" role="alert"><strong>Missing section:</strong> there is no <code>"' + esc(id) + '"</code> entry. Every section key must stay in the file.</p>'; });
    res.problems.forEach(function (p) { html += '<p class="text-error" role="alert"><strong>Problem in "' + esc(p.section) + '":</strong> ' + esc(p.message) + '</p>'; });
    if (res.ok) {
      html += '<details><summary>Preview the readable sections</summary>';
      Object.keys(res.html).forEach(function (id) { html += '<div class="check-preview"><p class="muted small"><code>' + esc(id) + '</code></p>' + res.html[id].replace(/href="#/g, 'href="' + PAGE_URL[key] + '#') + '</div>'; });
      html += '</details>';
    }
    html += '</section>';
  });
  box.innerHTML = '<p class="' + (allGood ? 'cmp-warn' : 'text-error') + '" role="status"><strong>' + (allGood ? 'All text files look good.' : 'Some text files need attention (see below).') + '</strong></p>' + html;
})();
