/* Gives the reading pages a "Need help?" button (help-coach.js) with the words from data/page-help.js.
   These pages are for reading, so no hint appears by itself after a minute (quiet). Nothing is saved. */
(function () {
  'use strict';
  var page = location.pathname.split('/').pop() || 'index.html';
  var h = window.PAGE_HELP && window.PAGE_HELP[page];
  if (window.HelpCoach && h) window.HelpCoach.setContext({ key: page, title: h.title, lines: h.lines, quiet: true });
})();
