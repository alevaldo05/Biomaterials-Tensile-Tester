/* Materials list for the Materials page, the protocol pages, and the test pages.

   TYPICAL, APPROXIMATE, UNREVIEWED values. Every number is a range of the kind found in materials
   textbooks and handbooks. None is measured on this tester, none is copied from one named table, and
   none has been checked by an advisor. Real values depend on the exact grade, heat treatment, direction,
   moisture, temperature, and (for biomaterials) species, site, age, hydration, storage, and loading rate.
   Entries marked low: true are especially uncertain (very wide spread in the literature).

   Units: E in GPa, rho (density) in kg/m3, ys (yield) and uts (tensile strength) in MPa, el (elongation
   at break) in %. A range is [low, high]; null means "not applicable" (no yield point, or not reported).
   kind says what shape the sample graph has (see data/sample-models.js): ductile, linear, rubber, fung.
   region says how the graph's region guides are named: steel, concrete, biomaterial, plain.
   sample is the key of the sample curve used for the example graph; the first three keep the hand-made
   curves from data/samples.js, the rest are generated in the browser from the typical mid-range values.

   SOURCE AND REVIEW FIELDS (one set per material, filled in later; "not recorded yet" until then).
   Set them with a line such as  note('steel', { source: '...', valueType: '...', conditions: '...',
   densityBasis: '...', review: { status: '...', reviewer: '...', date: '...', scope: '...' } });  at the
   bottom of this file. Any field you leave out shows "not recorded yet".
     source        where the numbers come from (name the document, table, or study)
     valueType     supplier typical value, specification minimum, measured study result, or illustrative
     conditions    the grade, condition, direction, moisture state, or tissue definition the numbers apply to
     densityBasis  for example apparent density or tissue density
     review        status, reviewer, date, and scope of any review (a review covers only what its scope says)
   Do not combine values from different conditions into one supposedly representative specimen. */
(function () {
  'use strict';

  var FAMILIES = [
    { id: 'metals', name: 'Metals', color: '#0072B2', shape: 'circle' },
    { id: 'plastics', name: 'Plastics', color: '#E69F00', shape: 'square' },
    { id: 'rubbers', name: 'Rubbers', color: '#CC79A7', shape: 'triangle' },
    { id: 'ceramics', name: 'Concrete and ceramics', color: '#6b6b6b', shape: 'diamond' },
    { id: 'wood', name: 'Wood', color: '#8c5a2b', shape: 'pentagon' },
    { id: 'composites', name: 'Composites', color: '#009E73', shape: 'cross' },
    { id: 'bio', name: 'Biomaterials', color: '#D55E00', shape: 'star' }
  ];

  var MATS = [];
  function m(id, family, name, detail, E, rho, ys, uts, el, nu, cond, kind, region, extra) {
    var o = { id: id, family: family, name: name, detail: detail, E: E, rho: rho, ys: ys, uts: uts, el: el, nu: nu, cond: cond, kind: kind, region: region, sample: id };
    if (extra) for (var k in extra) o[k] = extra[k];
    MATS.push(o);
  }
  var STEEL = 'Cold work and carbon content', HT = 'Heat treatment', AN = 'Cold work raises strength';

  /* ---- Metals ---- */
  m('steel', 'metals', 'Mild (low-carbon) steel', 'e.g. A36 / 1018 type, hot rolled', [200, 210], [7800, 7850], [250, 370], [400, 550], [20, 30], '0.27–0.30', STEEL, 'ductile', 'steel', { sample: 'steel', relax: true });
  m('steel-1045', 'metals', 'Medium-carbon steel (1045)', 'as rolled to drawn', [200, 210], [7800, 7850], [310, 530], [565, 630], [12, 16], '0.27–0.30', HT, 'ductile', 'steel');
  m('steel-4140', 'metals', 'Alloy steel 4140', 'annealed to quenched and tempered', [200, 210], [7800, 7850], [415, 1000], [655, 1100], [10, 25], '0.27–0.30', 'Heat treatment sets strength', 'ductile', 'steel', { low: true });
  m('tool-a2', 'metals', 'Tool steel A2', 'hardened', [190, 210], [7700, 7900], [1000, 2000], [1500, 2500], [1, 10], '0.27–0.30', 'Hardness set by heat treatment', 'ductile', 'steel', { low: true });
  m('ss-304', 'metals', 'Stainless steel 304', 'annealed', [190, 200], [7900, 8000], [205, 310], [515, 620], [40, 60], '0.27–0.30', AN, 'ductile', 'steel');
  m('ss-316', 'metals', 'Stainless steel 316', 'annealed', [190, 200], [7900, 8000], [205, 290], [515, 620], [40, 60], '0.27–0.30', AN, 'ductile', 'steel');
  m('ss-17-4', 'metals', 'Stainless steel 17-4 PH', 'aged (H900 to H1150)', [190, 200], [7750, 7800], [725, 1170], [930, 1310], [10, 16], '0.27–0.30', 'Aging condition', 'ductile', 'steel');
  m('ss-2205', 'metals', 'Duplex stainless steel 2205', 'annealed', [190, 200], [7800, 7850], [450, 550], [620, 880], [25, 35], '0.27–0.30', 'Heat treatment', 'ductile', 'steel');
  m('al-6061', 'metals', 'Aluminum 6061', 'T6', [68, 70], [2700, 2720], [240, 275], [290, 310], [8, 17], '0.33', 'Temper', 'ductile', 'steel');
  m('al-7075', 'metals', 'Aluminum 7075', 'T6', [70, 72], [2800, 2820], [480, 505], [540, 570], [7, 11], '0.33', 'Temper', 'ductile', 'steel');
  m('al-2024', 'metals', 'Aluminum 2024', 'T3', [72, 74], [2760, 2800], [325, 345], [470, 485], [16, 20], '0.33', 'Temper', 'ductile', 'steel');
  m('ti-6al-4v', 'metals', 'Titanium Ti-6Al-4V', 'annealed to aged', [105, 120], [4400, 4430], [830, 1100], [900, 1200], [6, 14], '0.31–0.34', HT, 'ductile', 'steel');
  m('ti-cp2', 'metals', 'Titanium, commercially pure (grade 2)', 'annealed', [100, 110], [4500, 4510], [275, 450], [345, 550], [20, 30], '0.34', 'Oxygen content, cold work', 'ductile', 'steel');
  m('copper', 'metals', 'Copper', 'annealed to hard', [110, 130], [8900, 8960], [33, 330], [210, 400], [4, 50], '0.34', 'Cold work', 'ductile', 'steel');
  m('brass', 'metals', 'Brass', 'e.g. 70/30', [100, 125], [8400, 8700], [100, 450], [330, 600], [5, 65], '0.34', 'Composition and cold work', 'ductile', 'steel');
  m('mg-az31', 'metals', 'Magnesium AZ31', 'wrought', [44, 46], [1760, 1780], [150, 230], [240, 290], [8, 20], '0.35', 'Temper and direction', 'ductile', 'steel');

  /* ---- Plastics ---- */
  m('nylon-66', 'plastics', 'Nylon 6/6', 'dry to conditioned', [1.5, 3.5], [1130, 1150], [55, 85], [60, 85], [15, 300], '0.39', 'Moisture content, temperature', 'ductile', 'plain');
  m('hdpe', 'plastics', 'HDPE', '', [0.8, 1.4], [940, 970], [20, 30], [20, 35], [100, 1000], '0.42', 'Temperature, strain rate', 'ductile', 'plain');
  m('pp', 'plastics', 'Polypropylene (PP)', '', [1.1, 1.6], [900, 910], [25, 35], [30, 40], [100, 600], '0.42', 'Grade, temperature, strain rate', 'ductile', 'plain');
  m('pvc', 'plastics', 'PVC, rigid', '', [2.4, 4.1], [1300, 1450], [40, 60], [40, 60], [20, 80], '0.38', 'Formulation, temperature', 'ductile', 'plain');
  m('pet', 'plastics', 'PET', '', [2, 4], [1330, 1400], [55, 80], [55, 80], [50, 300], '0.37', 'Crystallinity, orientation', 'ductile', 'plain');
  m('pc', 'plastics', 'Polycarbonate (PC)', '', [2.0, 2.4], [1190, 1210], [55, 70], [55, 75], [100, 150], '0.37', 'Temperature, strain rate', 'ductile', 'plain');
  m('abs', 'plastics', 'ABS', '', [1.8, 2.9], [1030, 1060], [30, 50], [30, 50], [5, 50], '0.35–0.39', 'Grade, temperature', 'ductile', 'plain');
  m('pla', 'plastics', 'PLA', '', [3, 4], [1240, 1270], [50, 65], [50, 70], [2, 10], '0.36', 'Print settings if 3D printed', 'ductile', 'plain');
  m('ptfe', 'plastics', 'PTFE', '', [0.4, 0.6], [2130, 2200], [10, 15], [20, 35], [200, 400], '0.46', 'Temperature, strain rate', 'ductile', 'plain');

  /* ---- Rubbers ---- */
  m('rubber-natural', 'rubbers', 'Natural rubber', 'vulcanized, unfilled', [0.0005, 0.005], [920, 1000], null, [20, 30], [500, 800], 'about 0.5', 'Strain-dependent; filler content', 'rubber', 'plain');
  m('rubber-silicone', 'rubbers', 'Silicone rubber', '', [0.0005, 0.01], [1100, 1500], null, [4, 11], [100, 700], 'about 0.5', 'Hardness and formulation', 'rubber', 'plain');
  m('tpu', 'rubbers', 'Polyurethane elastomer (TPU)', '', [0.005, 0.1], [1100, 1250], null, [25, 50], [300, 700], 'about 0.5', 'Hardness and grade', 'rubber', 'plain', { low: true });

  /* ---- Concrete and ceramics ---- */
  m('concrete', 'ceramics', 'Concrete', 'normal weight', [20, 40], [2200, 2500], null, [2, 5], null, '0.15–0.22', 'Mix, age, moisture; compressive strength is about 20–40 MPa', 'linear', 'concrete', { sample: 'concrete', relax: true, utsNote: 'tensile', elText: 'under 0.1' });
  m('alumina', 'ceramics', 'Alumina (aluminum oxide)', 'dense', [300, 400], [3800, 3960], null, [200, 300], null, '0.21–0.27', 'Purity and porosity; strength varies with flaws', 'linear', 'concrete', { utsNote: 'tensile', elText: 'about 0', low: true });
  m('glass', 'ceramics', 'Soda-lime glass', '', [68, 74], [2440, 2520], null, [30, 90], null, '0.22', 'Surface flaws set the strength', 'linear', 'concrete', { utsNote: 'tensile', elText: 'about 0' });

  /* ---- Wood (along the grain) ---- */
  m('pine', 'wood', 'Pine', 'along the grain', [8, 14], [350, 600], null, [50, 120], [1, 2], 'varies', 'Moisture, grain direction, species', 'linear', 'concrete');
  m('spruce', 'wood', 'Spruce', 'along the grain', [9, 13], [400, 470], null, [60, 100], [1, 2], 'varies', 'Moisture, grain direction, species', 'linear', 'concrete');
  m('oak', 'wood', 'Oak', 'along the grain', [11, 14], [600, 800], null, [60, 120], [1, 2], 'varies', 'Moisture, grain direction, species', 'linear', 'concrete');
  m('balsa', 'wood', 'Balsa', 'along the grain', [2, 5], [100, 250], null, [10, 30], [1, 2], 'varies', 'Density varies a lot; moisture', 'linear', 'concrete');

  /* ---- Composites (along the fibres) ---- */
  m('cfrp', 'composites', 'Carbon-fibre / epoxy', 'unidirectional, along fibres', [100, 180], [1500, 1600], null, [1000, 2200], [1, 1.8], '0.27–0.30', 'Fibre fraction and direction', 'linear', 'concrete');
  m('gfrp', 'composites', 'Glass-fibre / epoxy', 'unidirectional, along fibres', [35, 50], [1800, 2100], null, [600, 1100], [1.5, 3], '0.25–0.30', 'Fibre fraction and direction', 'linear', 'concrete');
  m('afrp', 'composites', 'Aramid-fibre / epoxy', 'unidirectional, along fibres', [50, 85], [1350, 1400], null, [1000, 1400], [1.5, 2.5], '0.34', 'Fibre fraction and direction', 'linear', 'concrete', { low: true });

  /* ---- Biomaterials ---- */
  m('skin', 'bio', 'Skin', 'human, in-plane tension', [0.02, 0.15], [1000, 1100], null, [5, 30], [30, 80], 'n/a', 'Site, direction, age, hydration, rate; the toe region is much softer than the linear modulus shown', 'fung', 'biomaterial', { sample: 'biomaterial', relax: true, eText: 'linear-region modulus' });
  m('tendon', 'bio', 'Tendon', '', [0.5, 2], [1100, 1200], null, [50, 150], [8, 15], 'n/a', 'Hydration, rate, storage', 'fung', 'biomaterial', { low: true });
  m('ligament', 'bio', 'Ligament', '', [0.1, 0.5], [1050, 1150], null, [20, 40], [10, 30], 'n/a', 'Hydration, rate, storage', 'fung', 'biomaterial', { low: true });
  m('cartilage', 'bio', 'Articular cartilage', 'tensile', [0.005, 0.05], [1050, 1100], null, [5, 25], [20, 80], 'n/a', 'Depth, direction, hydration', 'fung', 'biomaterial', { low: true });
  m('artery', 'bio', 'Artery wall', '', [0.001, 0.01], [1050, 1100], null, [1, 5], [50, 100], 'n/a', 'Vessel, direction, age, hydration', 'fung', 'biomaterial', { low: true });
  m('bone-cortical', 'bio', 'Cortical bone', 'long bone, along axis', [15, 20], [1800, 2000], [100, 130], [100, 150], [1, 3], '0.28–0.40', 'Site, age, hydration, direction', 'ductile', 'plain');
  m('bone-trabecular', 'bio', 'Trabecular bone', 'apparent density', [0.1, 3], [100, 1000], null, [1, 20], [1, 2], 'n/a', 'Site, density, hydration', 'linear', 'plain', { low: true });
  m('dentin', 'bio', 'Dentin', '', [15, 20], [2100, 2200], null, [50, 100], null, 'n/a', 'Hydration, tooth, location', 'linear', 'plain', { elText: 'about 0', low: true });

  /* Source, conditions, and review fields. Nothing is recorded yet, so every material shows the blank wording. */
  var BLANK = 'Not recorded yet';
  var BLANK_REVIEW = { status: 'Unreviewed', reviewer: BLANK, date: BLANK, scope: BLANK };
  function note(id, fields) {
    var o = null;
    MATS.forEach(function (x) { if (x.id === id) o = x; });
    if (!o) throw new Error('note(): no material with id "' + id + '"');
    for (var k in fields) o[k] = fields[k];
  }
  MATS.forEach(function (o) {
    o.source = BLANK; o.valueType = BLANK; o.conditions = BLANK; o.densityBasis = BLANK;
    o.review = { status: BLANK_REVIEW.status, reviewer: BLANK, date: BLANK, scope: BLANK };
  });
  window.MATERIAL_BLANK = BLANK;

  var BY_ID = {};
  MATS.forEach(function (o) { BY_ID[o.id] = o; });

  window.MATERIAL_FAMILIES = FAMILIES;
  window.MATERIALS = MATS;
  window.MATERIAL_BY_ID = BY_ID;
  window.MATERIAL_STATUS = 'Typical, unreviewed';
})();
