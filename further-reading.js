/* Builds the Further reading list from data/articles.js. */
(function () {
  'use strict';
  var list = document.getElementById('articles');
  var empty = document.getElementById('articles-empty');
  var items = (window.ARTICLES || []).filter(function (a) {
    return a && a.title && /^https?:\/\//i.test(String(a.url || ''));
  });
  if (!list || !items.length) return;
  items.forEach(function (a) {
    var li = document.createElement('li');
    var link = document.createElement('a');
    link.href = a.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = a.title;
    li.appendChild(link);
    if (a.source) li.appendChild(document.createTextNode(' \u2013 ' + a.source));
    if (a.note) {
      var n = document.createElement('span');
      n.className = 'note';
      n.textContent = a.note;
      li.appendChild(n);
    }
    list.appendChild(li);
  });
  if (empty) empty.hidden = true;
})();
