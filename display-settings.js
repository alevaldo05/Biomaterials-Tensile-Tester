/* Display settings: color theme, font, style, layout, text size, spacing, motion, and graph appearance (line width, curve style, grid). Loaded in <head> of every page so the saved
   choices are applied before the page paints. Saved in this browser only, and they change appearance
   only: they never change test data, results, or what is sent to the tester. */
(function () {
  var SETTINGS = {
    theme: { values: ["light", "dark", "purple", "pink"], fallback: "light" },
    font: { values: ["serif", "sans", "humanist"], fallback: "serif" },
    checklist: { values: ["off", "on"], fallback: "off" },
    style: { values: ["standard", "lab", "clinical", "drafting", "bold", "academic"], fallback: "standard" },
    layout: { values: ["start", "sidebar", "cards", "tabs", "reading"], fallback: "start" },
    textsize: { values: ["100", "125", "150", "200"], fallback: "100" },
    spacing: { values: ["standard", "comfortable", "compact"], fallback: "standard" },
    motion: { values: ["system", "reduced", "standard"], fallback: "system" },
    linewidth: { values: ["3", "1.5", "2", "4"], fallback: "3" },
    curve: { values: ["line", "markers"], fallback: "line" },
    grid: { values: ["major", "off", "minor"], fallback: "major" },
    stressunit: { values: ["mpa", "kpa"], fallback: "mpa" },
    strainunit: { values: ["ratio", "percent"], fallback: "ratio" },
    digits: { values: ["standard", "4", "5"], fallback: "standard" }
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

  /* Bold modern: a larger illustrative curve on the homepage instead of the fiber drawing. */
  var BOLD_HERO = '<g stroke="#ffffff" stroke-opacity=".18" stroke-width="1"><path d="M40 20v220M140 20v220M240 20v220M340 20v220M440 20v220M40 240h400M40 180h400M40 120h400M40 60h400"/></g>' +
    '<path d="M40 240C120 236 180 222 230 180S320 70 360 40L372 36" fill="none" stroke="#c6ef6b" stroke-width="7" stroke-linecap="round"/>' +
    '<path d="M372 36L380 120" fill="none" stroke="#c6ef6b" stroke-width="3" stroke-dasharray="6 6"/>' +
    '<g fill="#cde6d8" font-family="system-ui, sans-serif" font-size="14"><text x="48" y="226">toe</text><text x="292" y="168">linear</text><text x="330" y="28">failure</text></g>';

  /* Browser-tab icon: the same "BTT" mark, in the selected theme's colors. The page's security policy allows
     blob: images, so the colored icon is built as a small SVG blob. If anything fails, the plain green favicon.svg stays. */
  var tabBlob = "";
  function tabIcon() {
    try {
      var cs = getComputedStyle(document.documentElement);
      var bg = cs.getPropertyValue("--accent").trim(), fg = cs.getPropertyValue("--accent-ink").trim();
      var link = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
      if (!bg || !fg || !link || !window.URL || !window.Blob) return;
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="' + bg + '"/>' +
        '<text x="24" y="31.5" text-anchor="middle" textLength="40" lengthAdjust="spacingAndGlyphs" font-family="Georgia, \'Times New Roman\', serif" font-weight="700" font-size="20" fill="' + fg + '">BTT</text></svg>';
      var next = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      var png = document.querySelector('link[rel="icon"][type="image/png"]');
      if (png) png.parentNode.removeChild(png);
      link.setAttribute("href", next);
      if (tabBlob) URL.revokeObjectURL(tabBlob);
      tabBlob = next;
    } catch (e) { /* keep the static icon */ }
  }

  function decorate() {
    var style = saved("style");
    var hero = document.querySelector("svg.hero-art");
    if (hero && style === "bold") {
      hero.setAttribute("viewBox", "0 0 460 280");
      hero.setAttribute("aria-label", "Illustrative stress-strain curve: toe, linear, failure");
      hero.innerHTML = BOLD_HERO;
    }
  }

  /* These apply at once on the Settings page (CSS only, or read by the graph the next time it is drawn). */
  var NO_RELOAD = ["theme", "font", "checklist", "textsize", "spacing", "motion", "linewidth", "curve", "grid", "stressunit", "strainunit", "digits"];

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

  document.addEventListener("DOMContentLoaded", function () { decorate(); tabIcon(); settingsPage(); });
})();
