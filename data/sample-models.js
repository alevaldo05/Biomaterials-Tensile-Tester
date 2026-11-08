/* Example (sample) curves for the materials in data/materials.js that have no hand-made curve in
   data/samples.js. These are SHAPES BUILT IN THE BROWSER from each material's typical mid-range values
   (modulus, yield, tensile strength, elongation). They are NOT data and NOT measured, and are labeled
   "Sample data, not measured" wherever they appear. Load order: data/materials.js, data/samples.js,
   then this file, then graph.js. Only uniaxial curves are made; stress relaxation samples exist only
   for the three materials in data/samples.js. */
(function () {
  'use strict';
  if (!window.MATERIALS || !window.SAMPLE_DATA) return;

  function mid(r) { return (r[0] + r[1]) / 2; }
  function geo(r) { return Math.sqrt(r[0] * r[1]); }
  function round(v) { return parseFloat(v.toPrecision(5)); }
  function pts(n, f) { var a = []; for (var i = 0; i <= n; i++) a.push(f(i / n)); return a; }

  /* Elastic to yield, hardening to the tensile strength, then necking to fracture. Strain is denser near 0
     so the elastic part has enough points for the modulus fit. */
  function ductile(E, ys, uts, ef) {
    var ey = ys / E, eu = ey + 0.65 * (ef - ey);
    var X = pts(200, function (u) { return ef * u * u; }), Y = X.map(function (e) {
      if (e <= ey) return E * e;
      if (e <= eu) { var t = (e - ey) / (eu - ey); return ys + (uts - ys) * (1 - (1 - t) * (1 - t)); }
      var s = (e - eu) / (ef - eu); return uts * (1 - 0.25 * s * s);
    });
    return drop(X, Y, ef, uts, 'Linear elastic E = ' + round(E / 1000) + ' GPa to ' + round(ys) + ' MPa, hardening to ' + round(uts) + ' MPa, then necking to fracture at strain ' + round(ef));
  }
  /* Straight line to the tensile strength, then fracture (brittle materials). */
  function linear(E, uts) {
    var ef = uts / E, X = pts(60, function (u) { return ef * u; }), Y = X.map(function (e) { return E * e; });
    return drop(X, Y, ef, uts, 'Linear elastic E = ' + round(E / 1000) + ' GPa to fracture at ' + round(uts) + ' MPa (strain ' + round(ef) + ')');
  }
  /* Soft tissue J-shaped curve: sigma = A (exp(B e) - 1), with the end slope equal to the modulus and the
     end stress equal to the tensile strength. Falls back to a straight line when no such curve exists. */
  function fung(E, uts, ef) {
    if (E * ef <= uts * 1.02) {
      var X0 = pts(100, function (u) { return ef * u; });
      return drop(X0, X0.map(function (e) { return uts * e / ef; }), ef, uts, 'Straight line to ' + round(uts) + ' MPa at strain ' + round(ef) + ' (the typical modulus and strength do not fit a J-curve)');
    }
    function f(B) { return (E / B - uts) * (Math.exp(B * ef) - 1) - uts; }
    var lo = 1e-6, hi = E / uts - 1e-6;
    for (var i = 0; i < 80; i++) { var mdl = (lo + hi) / 2; if (f(mdl) > 0) lo = mdl; else hi = mdl; }
    var B = (lo + hi) / 2, A = E / B - uts;
    var X = pts(120, function (u) { return ef * u; });
    return drop(X, X.map(function (e) { return A * (Math.exp(B * e) - 1); }), ef, uts, 'Exponential J-curve sigma = A(exp(B e) - 1), A = ' + round(A) + ' MPa, B = ' + round(B) + ', to strain ' + round(ef) + ' (typical modulus is the end slope)');
  }
  /* Rubber: neo-Hookean stress plus a stiffening term, scaled to end at the tensile strength. */
  function rubber(E, uts, ef) {
    var lf = 1 + ef, base = lf - 1 / (lf * lf), G = E / 3, b = 0;
    if (G * base > uts) G = uts / base; else b = (uts - G * base) / Math.pow(ef, 3);
    var X = pts(150, function (u) { return ef * u; });
    return drop(X, X.map(function (e) { var l = 1 + e; return G * (l - 1 / (l * l)) + b * e * e * e; }), ef, uts, 'Neo-Hookean G = ' + round(G) + ' MPa plus a stiffening term, to strain ' + round(ef) + ' and ' + round(uts) + ' MPa');
  }
  function drop(X, Y, ef, uts, text) {
    X.push(ef * 1.003, ef * 1.006); Y.push(0.3 * uts, 0.02 * uts);
    return { x: X.map(round), y: Y.map(round), text: text };
  }

  var DIMS = { bio: { L0_mm: 10, width_mm: 5, thickness_mm: 1.5 }, rubbers: { L0_mm: 25, width_mm: 6, thickness_mm: 2 }, def: { L0_mm: 50, width_mm: 12.5, thickness_mm: 3 } };

  window.MATERIALS.forEach(function (mt) {
    /* keeps the hand-made curves for skin, mild steel, and concrete */
    if (window.SAMPLE_DATA.some(function (r) { return r.test === 'uniaxial' && r.material === mt.sample; })) return;
    var E = mid(mt.E) * 1000, uts = mid(mt.uts), c;
    var ef = mt.el ? (mt.el[1] / mt.el[0] > 4 ? geo(mt.el) : mid(mt.el)) / 100 : 0;
    if (mt.kind === 'ductile') c = ductile(E, mid(mt.ys), uts, ef);
    else if (mt.kind === 'rubber') c = rubber(E, uts, ef);
    else if (mt.kind === 'fung') c = fung(E, uts, ef);
    else c = linear(E, uts);
    var dims = DIMS[mt.family] || DIMS.def;
    window.SAMPLE_DATA.push({
      id: 'uniaxial-' + mt.id, test: 'uniaxial', material: mt.id, region: mt.region, label: mt.name, source: 'sample',
      units: { x: '-', y: 'MPa' }, x: c.x, y: c.y,
      params: { yield: !!mt.ys, specimen: { L0_mm: dims.L0_mm, width_mm: dims.width_mm, thickness_mm: dims.thickness_mm }, rate_per_s: 0.001, preload_N: '', temperature_C: 22, environment: '',
        model: 'Schematic curve generated from illustrative inputs; not experimental data or a validated material model. ' + c.text }
    });
  });
})();
