/* Adds a "Find a material" box next to a grouped Material dropdown.
   Typing narrows the list to materials whose names contain the typed text. The dropdown is rebuilt rather than
   hidden, because Safari ignores hidden options. The material that is selected always stays in the list, so
   typing never changes the choice. window.MaterialFind.clear(select) empties the box and restores the full list;
   call it before setting select.value from code. No data is stored. */
(function () {
  'use strict';

  var all = new WeakMap(); /* select -> the full list of groups and options */

  function snapshot(select) {
    var groups = [];
    [].slice.call(select.children).forEach(function (n) {
      if (n.tagName === 'OPTGROUP') groups.push({ label: n.label, options: [].slice.call(n.children) });
      else groups.push({ label: null, options: [n] });
    });
    return groups;
  }

  function rebuild(select, text) {
    var q = text.trim().toLowerCase(), keep = select.value, shown = 0;
    var out = document.createDocumentFragment();
    all.get(select).forEach(function (g) {
      var opts = g.options.filter(function (o) {
        return !q || o.value === keep || o.textContent.toLowerCase().indexOf(q) !== -1;
      });
      if (!opts.length) return;
      shown += g.options.filter(function (o) { return !q || o.textContent.toLowerCase().indexOf(q) !== -1; }).length;
      if (g.label === null) { out.appendChild(opts[0]); return; }
      var og = document.createElement('optgroup');
      og.label = g.label;
      opts.forEach(function (o) { og.appendChild(o); });
      out.appendChild(og);
    });
    select.textContent = '';
    select.appendChild(out);
    select.value = keep;
    return shown;
  }

  function firstMatch(select, text) {
    var q = text.trim().toLowerCase(), found = null;
    all.get(select).forEach(function (g) {
      g.options.forEach(function (o) { if (!found && q && o.textContent.toLowerCase().indexOf(q) !== -1) found = o; });
    });
    return found;
  }

  function attach(select) {
    if (!select || all.has(select)) return;
    all.set(select, snapshot(select));
    var id = select.id + '-find', wrap = select.parentNode;
    var label = document.createElement('label'); label.setAttribute('for', id); label.textContent = 'Find a material';
    var input = document.createElement('input');
    input.type = 'search'; input.id = id; input.className = 'mat-find'; input.placeholder = 'Type a name';
    input.autocomplete = 'off'; input.setAttribute('aria-controls', select.id);
    var none = document.createElement('span'); none.className = 'muted small mat-find-none'; none.hidden = true;
    none.textContent = 'No material matches.';
    var live = document.createElement('span'); live.className = 'sr-only'; live.setAttribute('role', 'status');
    wrap.insertBefore(live, wrap.firstChild);
    wrap.insertBefore(none, wrap.firstChild);
    wrap.insertBefore(input, wrap.firstChild);
    wrap.insertBefore(label, wrap.firstChild);

    function update() {
      var n = rebuild(select, input.value), typed = input.value.trim() !== '';
      none.hidden = !typed || n > 0;
      live.textContent = typed ? (n === 0 ? 'No material matches.' : n + (n === 1 ? ' material matches.' : ' materials match.')) : '';
    }
    input.addEventListener('input', update);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; update(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        var o = firstMatch(select, input.value);
        if (o) { input.value = ''; update(); select.value = o.value; select.dispatchEvent(new Event('change', { bubbles: true })); }
      } else if (e.key === 'ArrowDown') { e.preventDefault(); select.focus(); }
    });
    select.addEventListener('change', function () { if (input.value) { input.value = ''; update(); } });
    select._findClear = function () { if (input.value) { input.value = ''; update(); } };
  }

  window.MaterialFind = {
    attach: attach,
    clear: function (select) { if (select && select._findClear) select._findClear(); }
  };
})();
