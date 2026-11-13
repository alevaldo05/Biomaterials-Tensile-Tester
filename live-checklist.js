/* The optional pre-test checklist pop-up (window.LiveChecklist), shown before Start on the practice page when Settings > Pre-test checklist is On.
   The items come from data/checklist.js. It is a reminder, not a safety certification. Built on the shared site pop-up (ui.js).
   Pure move from live.js; live.js creates it with LiveChecklist.create($, esc). */
(function () {
  'use strict';
  window.LiveChecklist = {
    create: function ($, esc) {
    function checklistOn() { return document.documentElement.getAttribute('data-checklist') === 'on' && !!window.PRETEST_CHECKLIST; }
    /* The material is free text, so no material family is guessed from it: every checklist item is shown, tissue items included. */
    var checklistDlg = null;
    function showChecklist(onConfirm) {
      var C = window.PRETEST_CHECKLIST, tissue = true;
      var groups = C.groups.map(function (g) { return { name: g.name, items: g.items.filter(function (it) { return !it.tissue || tissue; }) }; });
      var total = groups.reduce(function (n, g) { return n + g.items.length; }, 0);
      if (!window.SiteUI || typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) {
        /* very old browser without <dialog>: a plain confirmation that lists the same items */
        var lines = groups.map(function (g) { return g.name + ':\n' + g.items.map(function (it) { return ' - ' + it.text; }).join('\n'); }).join('\n\n');
        if (window.confirm(C.title + '\n\n' + lines + '\n\nHave you done all of these?')) onConfirm();
        return;
      }
      if (!checklistDlg) {
        /* the shared site pop-up (ui.js): it keeps Esc from reaching the page's Esc-sends-STOP shortcut */
        checklistDlg = window.SiteUI.dialog({ className: 'pretest', labelledBy: 'pt-title' }).el;
      }
      var dlg = checklistDlg;
      dlg.innerHTML =
        '<h2 id="pt-title">' + esc(C.title) + (C.badge ? ' <span class="badge">' + esc(C.badge) + '</span>' : '') + '</h2>' +
        '<p class="pt-note">' + esc(C.note) + '</p>' +
        groups.map(function (g) {
          return '<h3>' + esc(g.name) + '</h3><ul class="pt-list">' + g.items.map(function (it) {
            return '<li><label><input type="checkbox"> <span>' + esc(it.text) + '</span></label></li>';
          }).join('') + '</ul>';
        }).join('') +
        '<p class="pt-count" id="pt-count" aria-live="polite"></p>' +
        '<div class="pt-actions"><button type="button" class="btn" id="pt-go" disabled>Start recording</button>' +
        '<button type="button" class="btn-secondary" id="pt-cancel">Cancel</button></div>';
      var boxes = [].slice.call(dlg.querySelectorAll('input[type="checkbox"]')), go = dlg.querySelector('#pt-go');
      function update() {
        var n = boxes.filter(function (b) { return b.checked; }).length;
        go.disabled = n < total;
        dlg.querySelector('#pt-count').textContent = n + ' of ' + total + ' ticked' + (n < total ? '. Start is available when all are ticked.' : '.');
      }
      boxes.forEach(function (b) { b.addEventListener('change', update); });
      update();
      go.addEventListener('click', function () { dlg.close(); $('r-start').focus(); onConfirm(); });
      dlg.querySelector('#pt-cancel').addEventListener('click', function () { dlg.close(); });
      dlg.addEventListener('close', function () { if (document.activeElement === document.body) $('r-start').focus(); }, { once: true });
      dlg.showModal();
    }

      return { on: checklistOn, show: showChecklist };
    }
  };
})();
