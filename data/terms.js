/* Definitions shown in the small box that opens when you point at (or Tab to) a term with a dotted underline.
   One entry per term: name, def (one line), eq (equation, plain text), unit.
   The wording is copied from the Glossary (data/text/learn.js), from the Governing equations tables on the two test
   pages, and from the text the graph and Calibration pages already show. Nothing new is claimed here and no
   source is added. Key results use the live definition the graph already builds; they do not use this file.
   Leave eq or unit as "" when there is none. Plain text only. */
window.TERMS = {
  stress:      { name: 'Engineering stress, σ', def: 'Force divided by original area.', eq: 'σ = F / A₀', unit: 'MPa (1 N/mm² = 1 MPa)' },
  strain:      { name: 'Engineering strain, ε', def: 'Specimen extension divided by reference length. It is dimensionless; multiply by 100 for percent.', eq: 'ε = (L − L₀) / L₀', unit: 'mm/mm (dimensionless)' },
  force:       { name: 'Force, F', def: 'Axial force.', eq: '', unit: 'N' },
  tangent:     { name: 'Local slope (tangent) estimate', def: 'Slope at one strain ε. Unlike E, it changes along the curve; in soft tissue it rises with strain (J-shaped curve).', eq: 'Eₜ(ε) = dσ/dε', unit: 'MPa or GPa' },
  truestrain:  { name: 'Estimated true strain, εₜ', def: 'Accounts for the changing cross-section; assumes constant volume and uniform deformation, so valid before necking.', eq: 'εₜ = ln(1 + ε)', unit: 'dimensionless' },
  truestress:  { name: 'Estimated true stress, σₜ', def: 'Accounts for the changing cross-section; assumes constant volume and uniform deformation, so valid before necking.', eq: 'σₜ = σ(1 + ε)', unit: 'MPa' },
  modulus:     { name: 'Modulus estimate, E (fitted slope)', def: 'Slope of the linear (elastic) region, fitted by least squares; σ = Eε (Hooke’s law). One value for the region.', eq: 'E = Δσ / Δε', unit: 'MPa or GPa' },
  youngs:      { name: 'Young’s modulus, E', def: 'Stress–strain slope in an appropriate linear elastic range.', eq: 'E = Δσ / Δε', unit: '' },
  yield:       { name: 'Yield strength (0.2% offset)', def: 'Stress at which the curve meets a line of slope E offset by 0.2% strain. Used for materials without a sharp yield point.', eq: 'σ = E(ε − 0.002)', unit: 'MPa' },
  uts:         { name: 'Ultimate tensile strength, UTS', def: 'Maximum engineering tensile stress reached in a valid tensile test. For an incomplete test, use “maximum recorded engineering stress.”', eq: 'UTS = σmax', unit: 'MPa' },
  failstrain:  { name: 'Estimated failure strain, εf (force-drop rule)', def: 'Last point before σ falls below 50% of UTS; this is not a confirmed rupture.', eq: '', unit: 'mm/mm (dimensionless)' },
  energy:      { name: 'Energy density to recorded endpoint, U', def: 'Energy absorbed per unit volume up to failure strain εf (trapezoid rule).', eq: 'U = ∫ σ dε from 0 to εf', unit: 'MJ/m³' },
  s0:          { name: 'Ramp-peak stress, σ₀', def: 'Highest stress in the record.', eq: '', unit: 'MPa' },
  holdstart:   { name: 'Hold-start stress', def: 'Stress at the first reading where displacement reaches 98% of the hold displacement.', eq: '', unit: 'MPa' },
  sfinal:      { name: 'Final recorded stress', def: 'Last recorded point of the hold; not automatically an equilibrium value.', eq: '', unit: 'MPa' },
  relaxed:     { name: 'Percent relaxed', def: 'Fraction of the initial stress lost by time t.', eq: '100 [1 − σ(t) / σ₀]', unit: '%' },
  ratio:       { name: 'Relaxation function, G(t)', def: 'Stress remaining relative to the initial stress σ₀ = σ(0). Dimensionless, 1 at t = 0 (not the shear modulus).', eq: 'G(t) = σ(t) / σ₀', unit: 'dimensionless' },
  apparent:    { name: 'Apparent stress/strain ratio after ramp', def: 'Ramp-peak stress σ₀ divided by the hold strain ε₀; not necessarily the instantaneous relaxation modulus.', eq: 'E(t) = σ(t) / ε₀', unit: 'MPa or GPa' },
  tau:         { name: 'Endpoint-referenced 1/e decay time, τ', def: 'Time for the decaying part of the stress to fall to 1/e (about 37%). Depends on the recording duration. Measured from the ramp peak.', eq: 'σ(τ) = σend + (σ₀ − σend) / e', unit: 's' },
  L0:          { name: 'Gauge length, L₀', def: 'Original gauge length.', eq: '', unit: 'mm' },
  A0:          { name: 'Area, A₀', def: 'Original cross-sectional area, from the width and thickness entered here.', eq: 'A₀ = width × thickness', unit: 'mm²' },
  speed:       { name: 'Crosshead speed', def: 'The commanded constant speed at which the specimen is extended.', eq: '', unit: 'mm/min' },
  holdmm:      { name: 'Hold displacement, ΔL', def: 'The displacement the test ramps to; it is then held for the hold duration.', eq: '', unit: 'mm' },
  holdstrain:  { name: 'Hold strain, ε₀', def: 'Strain imposed during loading and then held constant for t > 0.', eq: 'ε₀ = ΔL / L₀', unit: 'dimensionless' },
  forcemass:   { name: 'Force from the mass', def: 'The force of the known mass, from its mass and g.', eq: 'F = m g', unit: 'N' },
  errN:        { name: 'Error', def: 'Reading minus the force from the mass.', eq: 'Error = reading − force from the mass', unit: 'N' },
  errPct:      { name: 'Error (% of reading)', def: 'Error divided by the reading. Percentages are large and not very meaningful when the reading is close to zero.', eq: 'Error ÷ reading × 100', unit: '%' },
  gain:        { name: 'Gain (reading per newton of force)', def: 'From the fit, by least squares, over the rows that have both a mass and a reading.', eq: 'reading = gain × force + offset', unit: '' },
  offset:      { name: 'Zero offset', def: 'From the fit, by least squares, over the rows that have both a mass and a reading.', eq: 'reading = gain × force + offset', unit: 'N' },
  sd:          { name: 'Standard deviation', def: 'The sample standard deviation (n − 1); it needs at least 2 values.', eq: '', unit: '' }
};
