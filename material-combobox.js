/* Turns a grouped Material <select> into one box you can type into.
   Click or Tab into the box to see the list; type to narrow it to matching names; Up and Down move through the
   matches, Enter chooses, Esc closes and keeps the current material. The real <select> stays in the page (hidden)
   as the single source of truth, so the page code keeps reading select.value and listening for its change event.
   window.MaterialCombobox.set(select, value) changes the material from code and updates the box. Nothing is stored. */
(function () {
  'use strict';

  var seq = 0;

  function attach(select) {
    if (!select || select._combo) return;
    var n = ++seq, listId = 'mc-list-' + n;
    var groups = []; /* [{ label, items: [{ value, text }] }]; label null for options outside any family */
    [].slice.call(select.children).forEach(function (c) {
      if (c.tagName === 'OPTGROUP') groups.push({ label: c.label, items: [].slice.call(c.children).map(function (o) { return { value: o.value, text: o.textContent }; }) });
      else groups.push({ label: null, items: [{ value: c.value, text: c.textContent }] });
    });

    var wrap = document.createElement('span'); wrap.className = 'mc-wrap';
    var input = document.createElement('input');
    input.type = 'text'; input.className = 'mc-input'; input.id = select.id + '-combo';
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-controls', listId);
    input.autocomplete = 'off'; input.spellcheck = false; input.placeholder = 'Type to search materials';
    var arrow = document.createElement('span'); arrow.className = 'mc-arrow'; arrow.setAttribute('aria-hidden', 'true');
    var list = document.createElement('div'); list.className = 'mc-list'; list.id = listId; list.setAttribute('role', 'listbox'); list.hidden = true;
    var status = document.createElement('span'); status.className = 'sr-only'; status.setAttribute('role', 'status');
    wrap.appendChild(input); wrap.appendChild(arrow); wrap.appendChild(list); wrap.appendChild(status);
    select.parentNode.insertBefore(wrap, select);
    select.hidden = true;
    var label = select.parentNode.querySelector('label[for="' + select.id + '"]');
    if (label) label.setAttribute('for', input.id);

    var open = false, typed = false, shown = [], active = -1;

    function currentText() { var o = select.options[select.selectedIndex]; return o ? o.textContent : ''; }
    function showName() { input.value = currentText(); typed = false; }

    function build() {
      var q = typed ? input.value.trim().toLowerCase() : '';
      var html = '', count = 0;
      shown = [];
      groups.forEach(function (g) {
        var its = g.items.filter(function (it) { return !q || it.text.toLowerCase().indexOf(q) !== -1; });
        if (!its.length) return;
        var rows = its.map(function (it) {
          var i = shown.push(it) - 1; count++;
          return '<div role="option" class="mc-opt' + (it.value === select.value ? ' current' : '') + '" id="' + listId + '-' + i + '" data-i="' + i + '" aria-selected="' + (it.value === select.value ? 'true' : 'false') + '">' + esc(it.text) + '</div>';
        }).join('');
        html += g.label === null ? rows : '<div role="group" aria-label="' + esc(g.label) + '"><div class="mc-gh" aria-hidden="true">' + esc(g.label) + '</div>' + rows + '</div>';
      });
      if (!count) html = '<div class="mc-none">No material matches.</div>';
      list.innerHTML = html;
      var cur = -1;
      shown.forEach(function (it, i) { if (it.value === select.value) cur = i; });
      setActive(typed ? (count ? 0 : -1) : (cur >= 0 ? cur : (count ? 0 : -1)), !typed);
      status.textContent = typed ? (count === 0 ? 'No material matches.' : count + (count === 1 ? ' material matches.' : ' materials match.')) : '';
    }

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    function setActive(i, scroll) {
      var old = list.querySelector('.mc-opt.active'); if (old) old.classList.remove('active');
      active = i;
      if (i < 0) { input.removeAttribute('aria-activedescendant'); return; }
      var el = document.getElementById(listId + '-' + i);
      if (el) { el.classList.add('active'); input.setAttribute('aria-activedescendant', el.id); if (scroll !== false) el.scrollIntoView({ block: 'nearest' }); }
    }

    function openList() { if (open) return; open = true; list.hidden = false; input.setAttribute('aria-expanded', 'true'); build(); }
    function closeList() { if (!open) return; open = false; list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); status.textContent = ''; showName(); }

    function choose(i) {
      var it = shown[i]; if (!it) return;
      var changed = select.value !== it.value;
      select.value = it.value;
      closeList(); showName();
      if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    input.addEventListener('focus', function () { input.select(); openList(); });
    input.addEventListener('click', function () { if (!open) { openList(); input.select(); } });
    input.addEventListener('input', function () { typed = true; if (!open) { open = true; list.hidden = false; input.setAttribute('aria-expanded', 'true'); } build(); });
    input.addEventListener('blur', function () { closeList(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!open) { openList(); return; }
        if (!shown.length) return;
        var next = e.key === 'ArrowDown' ? (active + 1) % shown.length : (active - 1 + shown.length) % shown.length;
        setActive(next);
      } else if (e.key === 'Enter') {
        if (open && active >= 0) { e.preventDefault(); choose(active); }
      } else if (e.key === 'Escape') {
        if (open) { e.preventDefault(); e.stopPropagation(); closeList(); input.select(); }
      } else if (e.key === 'Tab') { closeList(); }
    });
    /* A mouse press on the list must not blur the box before the choice is made. */
    list.addEventListener('mousedown', function (e) { e.preventDefault(); });
    list.addEventListener('click', function (e) { var o = e.target.closest('.mc-opt'); if (o) choose(+o.getAttribute('data-i')); });
    list.addEventListener('mousemove', function (e) { var o = e.target.closest('.mc-opt'); if (o && +o.getAttribute('data-i') !== active) setActive(+o.getAttribute('data-i'), false); });

    select._combo = { show: function () { if (!open) showName(); } };
    showName();
  }

  window.MaterialCombobox = {
    attach: attach,
    set: function (select, value) { select.value = value; if (select._combo) select._combo.show(); }
  };
})();
