/* Display settings: color theme, font, style, layout, text size, spacing, motion, and graph appearance (line width, curve style, grid). Loaded in <head> of every page so the saved
   choices are applied before the page paints. Saved in this browser only, and they change appearance
   only: they never change test data, results, or what is sent to the tester. */
(function () {
  var SETTINGS = {
    theme: { values: ["light", "dark", "purple", "pink", "purple-dark", "pink-dark"], fallback: "light" },
    font: { values: ["serif", "sans", "humanist"], fallback: "serif" },
    checklist: { values: ["off", "on"], fallback: "off" },
    style: { values: ["standard", "lab", "clinical", "drafting", "academic"], fallback: "standard" },
    layout: { values: ["start", "sidebar", "cards", "tabs", "reading"], fallback: "start" },
    textsize: { values: ["100", "125", "150", "200"], fallback: "100" },
    spacing: { values: ["standard", "comfortable", "compact"], fallback: "standard" },
    motion: { values: ["system", "reduced", "standard"], fallback: "system" },
    linewidth: { values: ["3", "1.5", "2", "4"], fallback: "3" },
    curve: { values: ["line", "markers"], fallback: "line" },
    grid: { values: ["major", "off", "minor"], fallback: "major" },
    stressunit: { values: ["mpa", "kpa"], fallback: "mpa" },
    strainunit: { values: ["ratio", "percent"], fallback: "ratio" },
    digits: { values: ["standard", "4", "5"], fallback: "standard" },
    steps: { values: ["guided", "all"], fallback: "guided" },
    helpprompts: { values: ["on", "off"], fallback: "on" }
  };

  function saved(name) {
    var s = SETTINGS[name];
    try {
      var v = localStorage.getItem(name);
      return s.values.indexOf(v) >= 0 ? v : s.fallback;
    } catch (e) {
      return s.fallback;
    }
  }
  function apply(name, value) { document.documentElement.setAttribute("data-" + name, value); }
  function store(name, value) {
    try { localStorage.setItem(name, value); } catch (e) { /* Storage unavailable: applies to this page only. */ }
  }

  Object.keys(SETTINGS).forEach(function (name) { apply(name, saved(name)); });

  /* Browser-tab icon: the same curve mark as the header logo, in the selected theme's colors. The page's security policy allows
     blob: images, so the colored icon is built as a small SVG blob. If anything fails, the plain green favicon.svg stays. */
  var tabBlob = "";
  function tabIcon() {
    try {
      var cs = getComputedStyle(document.documentElement);
      var bg = cs.getPropertyValue("--accent").trim(), fg = cs.getPropertyValue("--accent-ink").trim();
      var link = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
      if (!bg || !fg || !link || !window.URL || !window.Blob) return;
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="13" fill="' + bg + '"/>' +
        '<g fill="none" stroke="' + fg + '" stroke-linecap="round" stroke-linejoin="round"><path stroke-width="2.4" d="M12 12V52H52"/>' +
        '<path stroke-width="4" d="M13 51C18 50.5 20 48 21.5 43L25.5 15L31 25H36L41.5 15L45 30L48 51"/></g>' +
        '<circle cx="30" cy="33" r="1.9" fill="' + fg + '"/><circle cx="37" cy="33" r="1.9" fill="' + fg + '"/></svg>';
      var next = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      var png = document.querySelector('link[rel="icon"][type="image/png"]');
      if (png) png.parentNode.removeChild(png);
      link.setAttribute("href", next);
      if (tabBlob) URL.revokeObjectURL(tabBlob);
      tabBlob = next;
    } catch (e) { /* keep the static icon */ }
  }

  /* These apply at once on the Settings page (CSS only, or read by the graph the next time it is drawn). */
  var NO_RELOAD = ["theme", "font", "checklist", "textsize", "spacing", "motion", "linewidth", "curve", "grid", "stressunit", "strainunit", "digits", "helpprompts"];

  /* Settings page: radio groups named theme, font, style, layout, and a reset button. */
  function settingsPage() {
    Object.keys(SETTINGS).forEach(function (name) {
      var current = saved(name);
      document.querySelectorAll('input[name="' + name + '"]').forEach(function (radio) {
        radio.checked = radio.value === current;
        radio.addEventListener("change", function () {
          if (!radio.checked) return;
          store(name, radio.value);
          /* Style and layout rearrange or redraw parts of the page, so reload to show them fully. */
          if (NO_RELOAD.indexOf(name) >= 0) { apply(name, radio.value); if (name === "theme") tabIcon(); return; }
          try { sessionStorage.setItem("settings-focus", name + ":" + radio.value); } catch (e) { /* ignore */ }
          location.reload();
        });
      });
    });
    /* After a reload, put keyboard focus back on the option that was just chosen. */
    try {
      var f = sessionStorage.getItem("settings-focus");
      if (f) {
        sessionStorage.removeItem("settings-focus");
        var el = f === "reset" ? document.getElementById("reset-display")
          : document.querySelector('input[name="' + f.split(":")[0] + '"][value="' + f.split(":")[1] + '"]');
        if (el) el.focus();
      }
    } catch (e) { /* ignore */ }
    var reset = document.getElementById("reset-display");
    if (reset) reset.addEventListener("click", function () {
      Object.keys(SETTINGS).forEach(function (name) { try { localStorage.removeItem(name); } catch (e) { /* ignore */ } });
      try { sessionStorage.setItem("settings-focus", "reset"); } catch (e) { /* ignore */ }
      location.reload();
    });
  }

  document.addEventListener("DOMContentLoaded", function () { tabIcon(); settingsPage(); });
})();
