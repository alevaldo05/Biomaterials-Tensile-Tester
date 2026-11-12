/* The Material box on the test pages (window.LiveMaterial): a text box you can type in, with a small drop-down of ready choices.
   A choice fills the box; anything else you type is kept as typed. live.js owns the value, the validation, and the red outline (aria-invalid).
   Keyboard: Down opens the list and moves through it, Enter picks, Esc closes the list (and does not reach the page's Esc-sends-STOP shortcut). */
(function () {
  'use strict';
  window.LiveMaterial = {
    attach: function (input, choices) {
      var uid = 'ws-mat-list';
      var wrap = document.createElement('span'); wrap.className = 'ws-combo';
      input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
      input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-controls', uid);
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ws-combo-btn'; btn.tabIndex = -1; btn.setAttribute('aria-label', 'Show material choices'); btn.innerHTML = '&#9662;';
      var list = document.createElement('ul'); list.className = 'ws-combo-list'; list.id = uid; list.setAttribute('role', 'listbox'); list.hidden = true;
      choices.forEach(function (c) { var li = document.createElement('li'); li.setAttribute('role', 'option'); li.textContent = c; list.appendChild(li); });
      wrap.appendChild(btn); wrap.appendChild(list);
      var cur = -1;
      function items() { return [].slice.call(list.children); }
      function open(on) { list.hidden = !on; input.setAttribute('aria-expanded', String(on)); if (!on) { cur = -1; items().forEach(function (li) { li.classList.remove('is-cur'); }); } }
      function pick(v) { input.value = v; open(false); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }
      function mark(i) { var it = items(); cur = (i + it.length) % it.length; it.forEach(function (li, k) { li.classList.toggle('is-cur', k === cur); }); }
      btn.addEventListener('click', function () { if (input.disabled) return; open(list.hidden); input.focus(); });
      items().forEach(function (li) { li.addEventListener('mousedown', function (e) { e.preventDefault(); pick(li.textContent); }); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) open(true); mark(cur + 1); }
        else if (e.key === 'ArrowUp' && !list.hidden) { e.preventDefault(); mark(cur - 1); }
        else if (e.key === 'Enter' && !list.hidden && cur >= 0) { e.preventDefault(); pick(items()[cur].textContent); }
        else if (e.key === 'Escape' && !list.hidden) { e.stopPropagation(); open(false); }
      });
      input.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== input) open(false); }, 120); });
      return { setDisabled: function (d) { btn.disabled = !!d; if (d) open(false); } };
    }
  };
})();
