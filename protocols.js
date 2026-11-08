/* Protocols and procedures shown on the protocol pages (protocol-uniaxial-tension.html and
   protocol-stress-relaxation.html). DRAFT, FOR ADVISOR REVIEW: no numerical operating parameter is
   approved here. Text in [square brackets] is shown highlighted as a value still to be decided.

   One entry per test ("uniaxial", "relaxation") and material ("general", "skin", "steel", "concrete").
   Each entry has: summary and status (text), and these lists (each item is one line of text):
     steps       Procedure, numbered      stop      Reasons to stop or flag
     specimen    Specimen preparation     equipment Equipment and measurement methods
     settings    Settings and reference conditions
     report      Required results         record    Required metadata (specimen record)
     notes       Limitations              refs      References: [ "text", "https://link" ] pairs
   Plain text only (no HTML). Keep commas between entries. The status line is the same on every page;
   change the version, date, and reviewer there when the protocol is reviewed. */
window.PROTOCOLS = {
  uniaxial: {
    general: {
      summary: 'Extend a specimen at a commanded constant crosshead speed, recording force and displacement. Stress and strain are calculated from the entered specimen dimensions. Reported values are estimates that depend on the specimen, the displacement source, and the analysis method.',
      status: 'Draft 0.1 for advisor review, November 7, 2026. No numerical operating parameters are approved. Reviewer: [not yet reviewed]. Values in [brackets] must be decided by the team and approved before use.',
      specimen: [
        'Shape: [set by your protocol], for example a dog-bone (dumbbell) or a straight strip with a marked gauge length.',
        'Measure gauge length, width, and thickness before testing; use the average of [number] measurements and record where each was taken and the method.',
        'Specimens per condition: [set by your protocol].',
        'Record defects, how the specimen was cut, and any prior loading.'
      ],
      equipment: [
        'Force: [load cell, amplifier, and acquisition configuration]; record its calibration and verification status. Tare is not calibration.',
        'Displacement source: [crosshead position from motor steps, or another source]. Commanded travel is not independently measured travel, and the source must be identified in the record.',
        'Strain in this website is displacement divided by the entered reference length. When the displacement is crosshead motion, grip slip and load-train deformation can affect it.',
        'Grips: [set by your protocol].',
        'Timing: report the sensor conversion rate, controller sampling and filtering, transmitted reading rate, and recorded timestamps separately. Prefer acquisition timestamps for analysis.'
      ],
      settings: [
        'Crosshead rate: [set by your protocol] mm/min, commanded. A constant crosshead speed does not prove a constant specimen strain rate.',
        'Preload: [target and permitted variation], applied by [method], with a settling interval of [set by your protocol] s. State whether L0 and displacement zero are set at that state and whether the preload stays in the reported force.',
        'Reference length L0: [definition and when it is established].',
        'Preconditioning and recovery: [set by your protocol, or none].',
        'Force-drop option: this website can send STOP when the force falls below 50% of its running peak after the peak reaches at least 1 N. It can miss low-force failures or respond to slip. It does not confirm rupture or that the machine has stopped. Threshold and persistence: [to be approved].',
        'Modulus fitting interval: [to be approved]. Replicate count and exclusion rules: [set by your protocol].'
      ],
      steps: [
        'Confirm the approved scope. Identify the material, protocol revision, specimen geometry, measurement method, operating limits, and required protective measures.',
        'Confirm machine readiness. Follow the team’s approved pre-use check for the physical emergency stop, grips, guards, travel, force instrumentation, and controller protections.',
        'Confirm measurement readiness. Identify calibration and verification records. Observe unloaded force stability. Confirm displacement direction and reference.',
        'Document the specimen. Record preparation, orientation, storage, dimensions, and environment.',
        'Enter specimen values. Replace example dimensions. Verify units and the calculated area.',
        'Tare in the defined unloaded configuration. Do not tare away an unknown specimen load.',
        'Mount and align. Avoid twisting, bending, unintended stretching, and damage. Establish slip-reference marks if included in the approved method.',
        'Apply the approved preload: [set by your protocol] N. Allow the specified settling interval. Establish the reference length and displacement origin according to the protocol.',
        'Precondition if required. Use only an approved and supported method, and record what was actually performed.',
        'Start the approved loading sequence. Record force, displacement, and time. Monitor the specimen and machine.',
        'Stop or flag abnormalities. Examples include visible slip, grip tearing, unexpected motion, sensor saturation, stale data, or loss of environmental control.',
        'Record the end reason. Distinguish observed rupture, force-drop detection, manual stop, controller fault, communication loss, and recording limit.',
        'Review before interpreting results. Confirm whether failure occurred in the intended gauge region. Mark incomplete or questionable tests.',
        'Download and verify the record. Reopen the CSV and check source labels, units, metadata, and point count.',
        'Unload, remove, and clean. Follow the approved machine and tissue-handling procedure.'
      ],
      stop: [
        'Stop the test, or flag it in the record, if you see any of these: visible slip or grip tearing; unexpected motion; force reading saturated, stale, or missing; loss of environmental control; communication loss; the specimen failing outside the intended gauge region.',
        'The on-screen STOP and the Esc key send a request through a computer and a connection that can fail. They are not an emergency stop.'
      ],
      report: [
        'Automatic modulus estimate, ultimate tensile strength (or maximum recorded engineering stress for an incomplete test), estimated failure strain (force-drop rule; reported only if a force drop is found), and energy density to the recorded endpoint (Key results).',
        'With each result: the fitted interval for the modulus estimate, the displacement source, the end reason (observed rupture, force-drop detection, manual stop, controller fault, communication loss, or recording limit), failure location, slip or damage flags, and any deviations.',
        'Yield strength (0.2% offset) only where your approved method selects it for this material.'
      ],
      record: [
        'Identification: specimen ID, test ID, date, operator, protocol version.',
        'Biological source (if tissue): species, anatomical site, coded donor or batch identifier, relevant available specimen characteristics.',
        'Tissue preparation: layers retained, fat removal, cutting method, geometry, defects.',
        'Orientation: direction, reference axis, identification method.',
        'Storage: fresh or frozen, storage medium and temperature, duration, freeze–thaw count, thawing method.',
        'Timing: harvest or excision time when available, preparation time, time to test.',
        'Environment: medium, hydration method, temperature, relevant humidity or bath conditions.',
        'Dimensions: individual width and thickness readings, locations, method, reported area, reference length.',
        'Mounting: grip design, interface materials, engagement length, alignment, slip observations.',
        'Loading history: preload, settling interval, preconditioning, recovery interval, prior tests.',
        'Acquisition: force instrument, displacement source, calibration record, sampling information, filtering.',
        'Test conditions: commanded and achieved rate, ramp duration, hold target, hold duration.',
        'Outcome: end reason, failure location, slip or damage flags, incomplete recording, deviations.',
        'Analysis: calculation version, fitted interval, endpoint rule, normalization reference, model assumptions.',
        'Use coded specimen identifiers. Do not enter names or identifying clinical information. This site stores nothing; keep the record in the downloaded files.',
        '“Not recorded” and “not applicable” are different entries; keep them distinct.'
      ],
      notes: [
        'This is a draft for advisor review, not an approved procedure. No operating parameter is approved here.',
        'The tester hardware connection is draft and unvalidated. Calibration, protections, and hardware operation remain unvalidated.',
        'Reported values are estimates that depend on the specimen, the displacement source, and the analysis method.',
        'Three safety levels are different. (1) Physical emergency stop: a hardware safety function that needs independent design and validation. (2) Controller protections: proposed force and travel limits, a watchdog and fault handling; these do not exist yet. (3) Browser commands: requests sent through a fallible computer and connection. They are not equivalent safety functions. The on-screen STOP and the Esc key are not an emergency stop.'
      ],
      refs: [
        [ 'ASTM E111-17(2025)e1. Young’s, tangent, and chord modulus. Public scope only.', 'https://store.astm.org/e0111-17r25e01.html' ],
        [ 'ASTM E4-24. Force calibration and verification of testing machines. Public scope only.', 'https://store.astm.org/e0004-24.html' ],
        [ 'ISO 7500-1:2018. Calibration and verification of the force-measuring system. Public summary only.', 'https://www.iso.org/standard/72572.html' ],
        [ 'ASTM E83-25. Calibration, verification, and classification of extensometer systems. Public scope only.', 'https://store.astm.org/standards/e83' ],
        [ 'ISO 13850:2015. Emergency stop function, principles for design. Public summary only.', 'https://www.iso.org/standard/59970.html' ],
        [ 'Roylance, MIT, 2001. Stress-Strain Curves. Educational module.', 'https://web.mit.edu/course/3/3.11/www/modules/ss.pdf' ],
        [ 'Bartel, NIST, 2005. Uncertainty in NIST Force Measurements.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4846226/' ],
        [ 'Taylor and Kuyatt, NIST TN 1297, 1994. Guidelines for evaluating and expressing uncertainty.', 'https://www.nist.gov/publications/guidelines-evaluating-and-expressing-uncertainty-nist-measurement-results-1994-edition' ],
        [ 'HX711 datasheet, version 2.0. Sensor conversion rate (not the rate of the finished controller and browser recording).', 'https://e2e.ti.com/cfs-file/__key/communityserver-discussions-components-files/73/HX711.pdf' ]
      ],
      refnote: 'Sources supplied by the project owner’s research. They were not independently opened or verified. Standards were reviewed through public publisher information only; the complete standards have not been reviewed for this project. Listing a standard does not establish compliance. The team must obtain and review the applicable edition before using it to define an approved procedure.'
    },
    skin: {
      summary: 'Soft-tissue tension test. Skin is nonlinear, viscoelastic, and anisotropic, so preparation, hydration, and orientation matter as much as the test itself.',
      status: 'Draft 0.1 for advisor review, November 7, 2026. No numerical operating parameters are approved. Reviewer: [not yet reviewed]. Values in [brackets] must be decided by the team and approved before use.',
      specimen: [
        'Source, storage, and handling: [set by your protocol and your lab’s tissue-handling approval].',
        'Layers retained and fat removal: [set by your protocol]; record them, because including or removing underlying tissue changes what is being tested.',
        'Cut with a die or template to one consistent shape: [set by your protocol].',
        'Record the orientation relative to the body axis or Langer’s lines; skin can respond differently along and across a direction.',
        'Measure thickness at several points without crushing the tissue: [method].',
        'Keep hydrated with [solution, for example saline] until and during the test; record the hydration method.'
      ],
      equipment: [
        'Low-range load cell suited to [expected peak force] N.',
        'Grips that hold soft tissue without tearing or slipping: [set by your protocol].',
        'Force: [load cell, amplifier, and acquisition configuration]; record its calibration and verification status. Tare is not calibration.',
        'Displacement source: [crosshead position from motor steps, or another source]. Commanded travel is not independently measured travel, and the source must be identified in the record.',
        'Strain in this website is displacement divided by the entered reference length. When the displacement is crosshead motion, grip slip and load-train deformation can affect it.',
        'Timing: report the sensor conversion rate, controller sampling and filtering, transmitted reading rate, and recorded timestamps separately. Prefer acquisition timestamps for analysis.'
      ],
      settings: [
        'Crosshead rate: [set by your protocol] mm/min, commanded. A constant crosshead speed does not prove a constant specimen strain rate.',
        'Preload: [target and permitted variation], applied by [method], with a settling interval of [set by your protocol] s. State whether L0 and displacement zero are set at that state and whether the preload stays in the reported force.',
        'Reference length L0: [definition and when it is established].',
        'Preconditioning and recovery: [set by your protocol, or none].',
        'Force-drop option: this website can send STOP when the force falls below 50% of its running peak after the peak reaches at least 1 N. It can miss low-force failures or respond to slip. It does not confirm rupture or that the machine has stopped. Threshold and persistence: [to be approved].',
        'Modulus fitting interval: [to be approved]. Replicate count and exclusion rules: [set by your protocol].'
      ],
      steps: [
        'Confirm the approved scope. Identify the material, protocol revision, specimen geometry, measurement method, operating limits, and required protective measures.',
        'Confirm machine readiness. Follow the team’s approved pre-use check for the physical emergency stop, grips, guards, travel, force instrumentation, and controller protections.',
        'Confirm measurement readiness. Identify calibration and verification records. Observe unloaded force stability. Confirm displacement direction and reference.',
        'Document the specimen. Record preparation, orientation, storage, dimensions, and environment. For skin also record layers retained, orientation relative to the body axis or Langer’s lines, storage, time since harvest, and hydration.',
        'Enter specimen values. Replace example dimensions. Verify units and the calculated area. Measure thickness at several points without crushing the tissue.',
        'Tare in the defined unloaded configuration. Do not tare away an unknown specimen load.',
        'Mount and align. Avoid twisting, bending, unintended stretching, and damage. Establish slip-reference marks if included in the approved method. Do not pre-stretch the specimen, and keep it moist. Wear gloves and follow your lab’s biosafety rules for tissue.',
        'Apply the approved preload: [set by your protocol] N. Allow the specified settling interval. Establish the reference length and displacement origin according to the protocol.',
        'Precondition if required. Use only an approved and supported method, and record what was actually performed. The website does not run preconditioning cycles yet.',
        'Start the approved loading sequence. Record force, displacement, and time. Monitor the specimen and machine.',
        'Stop or flag abnormalities. Examples include visible slip, grip tearing, unexpected motion, sensor saturation, stale data, or loss of environmental control.',
        'Record the end reason. Distinguish observed rupture, force-drop detection, manual stop, controller fault, communication loss, and recording limit.',
        'Review before interpreting results. Confirm whether failure occurred in the intended gauge region. Mark incomplete or questionable tests.',
        'Download and verify the record. Reopen the CSV and check source labels, units, metadata, and point count.',
        'Unload, remove, and clean. Follow the approved machine and tissue-handling procedure. Dispose of tissue and disinfect the grips following your lab’s rules.'
      ],
      stop: [
        'Stop the test, or flag it in the record, if you see any of these: visible slip or grip tearing; unexpected motion; force reading saturated, stale, or missing; loss of environmental control; communication loss; the specimen failing outside the intended gauge region.',
        'The on-screen STOP and the Esc key send a request through a computer and a connection that can fail. They are not an emergency stop.'
      ],
      report: [
        'Automatic modulus estimate, ultimate tensile strength (or maximum recorded engineering stress for an incomplete test), estimated failure strain (force-drop rule; reported only if a force drop is found), and energy density to the recorded endpoint (Key results).',
        'With each result: the fitted interval for the modulus estimate, the displacement source, the end reason (observed rupture, force-drop detection, manual stop, controller fault, communication loss, or recording limit), failure location, slip or damage flags, and any deviations.',
        'Leave the 0.2% offset yield off: it is not meaningful for skin in this project.'
      ],
      record: [
        'Identification: specimen ID, test ID, date, operator, protocol version.',
        'Biological source (if tissue): species, anatomical site, coded donor or batch identifier, relevant available specimen characteristics.',
        'Tissue preparation: layers retained, fat removal, cutting method, geometry, defects.',
        'Orientation: direction, reference axis, identification method.',
        'Storage: fresh or frozen, storage medium and temperature, duration, freeze–thaw count, thawing method.',
        'Timing: harvest or excision time when available, preparation time, time to test.',
        'Environment: medium, hydration method, temperature, relevant humidity or bath conditions.',
        'Dimensions: individual width and thickness readings, locations, method, reported area, reference length.',
        'Mounting: grip design, interface materials, engagement length, alignment, slip observations.',
        'Loading history: preload, settling interval, preconditioning, recovery interval, prior tests.',
        'Acquisition: force instrument, displacement source, calibration record, sampling information, filtering.',
        'Test conditions: commanded and achieved rate, ramp duration, hold target, hold duration.',
        'Outcome: end reason, failure location, slip or damage flags, incomplete recording, deviations.',
        'Analysis: calculation version, fitted interval, endpoint rule, normalization reference, model assumptions.',
        'Use coded specimen identifiers. Do not enter names or identifying clinical information. This site stores nothing; keep the record in the downloaded files.',
        '“Not recorded” and “not applicable” are different entries; keep them distinct.'
      ],
      notes: [
        'This is a draft for advisor review, not an approved procedure. No operating parameter is approved here.',
        'The tester hardware connection is draft and unvalidated. Calibration, protections, and hardware operation remain unvalidated.',
        'Reported values are estimates that depend on the specimen, the displacement source, and the analysis method.',
        'No dedicated consensus method was established for this project by this review. Published skin-testing methods vary. The team’s skin procedure remains a draft pending advisor approval.',
        'Studies of skin differ in specimen, attachment, and conditions; their values are findings from those studies, not targets for every specimen.',
        'Three safety levels are different. (1) Physical emergency stop: a hardware safety function that needs independent design and validation. (2) Controller protections: proposed force and travel limits, a watchdog and fault handling; these do not exist yet. (3) Browser commands: requests sent through a fallible computer and connection. They are not equivalent safety functions. The on-screen STOP and the Esc key are not an emergency stop.'
      ],
      refs: [
        [ 'Ní Annaidh et al., 2012. Anisotropic mechanical properties of excised human skin. Full author manuscript.', 'https://arxiv.org/pdf/1302.3022' ],
        [ 'Ottenio et al., 2015. Strain rate and anisotropy effects on tensile failure of human skin. Abstract only.', 'https://pubmed.ncbi.nlm.nih.gov/25455608/' ],
        [ 'Kumaraswamy et al., 2017. Mechanical response of human female breast skin under uniaxial stretching. Author manuscript.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5582008/' ],
        [ 'Sachs et al., 2024. A quadriphasic mechanical model of the human dermis. Full open-access article.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11584490/' ],
        [ 'Ranamukhaarachchi et al., 2016. Human and porcine skin before and after preservation by freezing. Full article.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4997349/' ],
        [ 'ASTM E111-17(2025)e1. Young’s, tangent, and chord modulus. Public scope only.', 'https://store.astm.org/e0111-17r25e01.html' ],
        [ 'ASTM E4-24. Force calibration and verification of testing machines. Public scope only.', 'https://store.astm.org/e0004-24.html' ],
        [ 'ISO 7500-1:2018. Calibration and verification of the force-measuring system. Public summary only.', 'https://www.iso.org/standard/72572.html' ],
        [ 'ISO 13850:2015. Emergency stop function, principles for design. Public summary only.', 'https://www.iso.org/standard/59970.html' ]
      ],
      refnote: 'Sources supplied by the project owner’s research. They were not independently opened or verified. Standards were reviewed through public publisher information only; the complete standards have not been reviewed for this project. Listing a standard does not establish compliance. The team must obtain and review the applicable edition before using it to define an approved procedure.'
    },
    steel: {
      summary: 'Metal tension test, kept as a separate educational or experimental scope. Reference methods: ASTM E8/E8M and ISO 6892-1.',
      status: 'Draft 0.1 for advisor review, November 7, 2026. No numerical operating parameters are approved. Reviewer: [not yet reviewed]. Values in [brackets] must be decided by the team and approved before use.',
      specimen: [
        'Machined dog-bone specimen with geometry from the reference method: [confirm which].',
        'Mark the gauge length; measure width and thickness.',
        'Record material grade and condition: [set by your protocol].'
      ],
      equipment: [
        'Steel needs far more force than skin. Confirm the expected force from the actual specimen area and material condition, and verify the complete load path, grips, travel, instrumentation, and protective measures.',
        'An extensometer is recommended for modulus. Added load-train deformation commonly lowers the apparent slope of a crosshead-based modulus, so do not expect an accurate steel modulus from crosshead displacement.',
        'Force: [load cell, amplifier, and acquisition configuration]; record its calibration and verification status. Tare is not calibration.',
        'Displacement source: [crosshead position from motor steps, or another source]. Commanded travel is not independently measured travel, and the source must be identified in the record.',
        'Timing: report the sensor conversion rate, controller sampling and filtering, transmitted reading rate, and recorded timestamps separately. Prefer acquisition timestamps for analysis.'
      ],
      settings: [
        'Crosshead rate: [set by your protocol] mm/min, commanded. A constant crosshead speed does not prove a constant specimen strain rate.',
        'Preload: [target and permitted variation], applied by [method], with a settling interval of [set by your protocol] s. State whether L0 and displacement zero are set at that state and whether the preload stays in the reported force.',
        'Reference length L0: [definition and when it is established].',
        'Preconditioning and recovery: [set by your protocol, or none].',
        'Force-drop option: this website can send STOP when the force falls below 50% of its running peak after the peak reaches at least 1 N. It can miss low-force failures or respond to slip. It does not confirm rupture or that the machine has stopped. Threshold and persistence: [to be approved].',
        'Modulus fitting interval: [to be approved]. Replicate count and exclusion rules: [set by your protocol].'
      ],
      steps: [
        'Confirm the approved scope. Identify the material, protocol revision, specimen geometry, measurement method, operating limits, and required protective measures.',
        'Confirm machine readiness. Follow the team’s approved pre-use check for the physical emergency stop, grips, guards, travel, force instrumentation, and controller protections.',
        'Confirm measurement readiness. Identify calibration and verification records. Observe unloaded force stability. Confirm displacement direction and reference.',
        'Document the specimen. Record preparation, orientation, storage, dimensions, and environment.',
        'Enter specimen values. Replace example dimensions. Verify units and the calculated area.',
        'Tare in the defined unloaded configuration. Do not tare away an unknown specimen load.',
        'Mount and align. Avoid twisting, bending, unintended stretching, and damage. Establish slip-reference marks if included in the approved method. Wear eye protection; fracture can be sudden.',
        'Apply the approved preload: [set by your protocol] N. Allow the specified settling interval. Establish the reference length and displacement origin according to the protocol.',
        'Precondition if required. Use only an approved and supported method, and record what was actually performed.',
        'Start the approved loading sequence. Record force, displacement, and time. Monitor the specimen and machine.',
        'Stop or flag abnormalities. Examples include visible slip, grip tearing, unexpected motion, sensor saturation, stale data, or loss of environmental control.',
        'Record the end reason. Distinguish observed rupture, force-drop detection, manual stop, controller fault, communication loss, and recording limit.',
        'Review before interpreting results. Confirm whether failure occurred in the intended gauge region. Mark incomplete or questionable tests.',
        'Download and verify the record. Reopen the CSV and check source labels, units, metadata, and point count.',
        'Unload, remove, and clean. Follow the approved machine and tissue-handling procedure.'
      ],
      stop: [
        'Stop the test, or flag it in the record, if you see any of these: visible slip or grip tearing; unexpected motion; force reading saturated, stale, or missing; loss of environmental control; communication loss; the specimen failing outside the intended gauge region.',
        'The on-screen STOP and the Esc key send a request through a computer and a connection that can fail. They are not an emergency stop.'
      ],
      report: [
        'Automatic modulus estimate, ultimate tensile strength (or maximum recorded engineering stress for an incomplete test), estimated failure strain (force-drop rule; reported only if a force drop is found), and energy density to the recorded endpoint (Key results).',
        'With each result: the fitted interval for the modulus estimate, the displacement source, the end reason (observed rupture, force-drop detection, manual stop, controller fault, communication loss, or recording limit), failure location, slip or damage flags, and any deviations.',
        'Yield strength (0.2% offset) only where your approved method selects it for this material.'
      ],
      record: [
        'Identification: specimen ID, test ID, date, operator, protocol version.',
        'Biological source (if tissue): species, anatomical site, coded donor or batch identifier, relevant available specimen characteristics.',
        'Tissue preparation: layers retained, fat removal, cutting method, geometry, defects.',
        'Orientation: direction, reference axis, identification method.',
        'Storage: fresh or frozen, storage medium and temperature, duration, freeze–thaw count, thawing method.',
        'Timing: harvest or excision time when available, preparation time, time to test.',
        'Environment: medium, hydration method, temperature, relevant humidity or bath conditions.',
        'Dimensions: individual width and thickness readings, locations, method, reported area, reference length.',
        'Mounting: grip design, interface materials, engagement length, alignment, slip observations.',
        'Loading history: preload, settling interval, preconditioning, recovery interval, prior tests.',
        'Acquisition: force instrument, displacement source, calibration record, sampling information, filtering.',
        'Test conditions: commanded and achieved rate, ramp duration, hold target, hold duration.',
        'Outcome: end reason, failure location, slip or damage flags, incomplete recording, deviations.',
        'Analysis: calculation version, fitted interval, endpoint rule, normalization reference, model assumptions.',
        'Use coded specimen identifiers. Do not enter names or identifying clinical information. This site stores nothing; keep the record in the downloaded files.',
        '“Not recorded” and “not applicable” are different entries; keep them distinct.'
      ],
      notes: [
        'This is a draft for advisor review, not an approved procedure. No operating parameter is approved here.',
        'The tester hardware connection is draft and unvalidated. Calibration, protections, and hardware operation remain unvalidated.',
        'Reported values are estimates that depend on the specimen, the displacement source, and the analysis method.',
        'Do not call a steel specimen a machine “calibration” specimen without a defined reference procedure.',
        'Room-temperature steel is approximately rate-independent only within stated conditions and the chosen analysis.',
        'Three safety levels are different. (1) Physical emergency stop: a hardware safety function that needs independent design and validation. (2) Controller protections: proposed force and travel limits, a watchdog and fault handling; these do not exist yet. (3) Browser commands: requests sent through a fallible computer and connection. They are not equivalent safety functions. The on-screen STOP and the Esc key are not an emergency stop.'
      ],
      refs: [
        [ 'ASTM E8/E8M-25. Tension testing of metallic materials. Public scope only.', 'https://store.astm.org/e0008_e0008m-25.html' ],
        [ 'ISO 6892-1:2019. Tensile testing of metallic materials at room temperature. Public summary only.', 'https://www.iso.org/standard/78322.html' ],
        [ 'ASTM E111-17(2025)e1. Young’s, tangent, and chord modulus. Public scope only.', 'https://store.astm.org/e0111-17r25e01.html' ],
        [ 'ASTM E4-24. Force calibration and verification of testing machines. Public scope only.', 'https://store.astm.org/e0004-24.html' ],
        [ 'ISO 7500-1:2018. Calibration and verification of the force-measuring system. Public summary only.', 'https://www.iso.org/standard/72572.html' ],
        [ 'ASTM E83-25. Calibration, verification, and classification of extensometer systems. Public scope only.', 'https://store.astm.org/standards/e83' ],
        [ 'ISO 13850:2015. Emergency stop function, principles for design. Public summary only.', 'https://www.iso.org/standard/59970.html' ],
        [ 'Roylance, MIT, 2001. Stress-Strain Curves. Educational module.', 'https://web.mit.edu/course/3/3.11/www/modules/ss.pdf' ],
        [ 'Bartel, NIST, 2005. Uncertainty in NIST Force Measurements.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4846226/' ],
        [ 'Taylor and Kuyatt, NIST TN 1297, 1994. Guidelines for evaluating and expressing uncertainty.', 'https://www.nist.gov/publications/guidelines-evaluating-and-expressing-uncertainty-nist-measurement-results-1994-edition' ],
        [ 'HX711 datasheet, version 2.0. Sensor conversion rate (not the rate of the finished controller and browser recording).', 'https://e2e.ti.com/cfs-file/__key/communityserver-discussions-components-files/73/HX711.pdf' ]
      ],
      refnote: 'Sources supplied by the project owner’s research. They were not independently opened or verified. Standards were reviewed through public publisher information only; the complete standards have not been reviewed for this project. Listing a standard does not establish compliance. The team must obtain and review the applicable edition before using it to define an approved procedure.'
    },
    concrete: {
      summary: 'Concrete remains an unresolved scope decision. Direct tension tests are uncommon; tensile strength is usually measured indirectly or estimated from compression tests, and those results are not interchangeable with direct tensile strength. Confirm with your advisor whether this tester will run concrete.',
      status: 'Draft 0.1 for advisor review, November 7, 2026. No numerical operating parameters are approved. Reviewer: [not yet reviewed]. Values in [brackets] must be decided by the team and approved before use.',
      specimen: [
        'Direct tension needs special specimen ends (bonded or embedded grips) so the specimen does not fail at the grips: [set by your protocol].',
        'Cure age and conditions: [set by your protocol].'
      ],
      equipment: [
        'High-capacity load cell and frame rated for [expected peak force] N.',
        'Displacement measured on the specimen is recommended; failure strains are very small.',
        'Crosshead speed: [set by your protocol] mm/min.',
        'Force: [load cell, amplifier, and acquisition configuration]; record its calibration and verification status. Tare is not calibration.',
        'Displacement source: [crosshead position from motor steps, or another source]. Commanded travel is not independently measured travel, and the source must be identified in the record.'
      ],
      settings: [
        'Crosshead rate: [set by your protocol] mm/min, commanded. A constant crosshead speed does not prove a constant specimen strain rate.',
        'Preload: [target and permitted variation], applied by [method], with a settling interval of [set by your protocol] s. State whether L0 and displacement zero are set at that state and whether the preload stays in the reported force.',
        'Reference length L0: [definition and when it is established].',
        'Preconditioning and recovery: [set by your protocol, or none].',
        'Force-drop option: this website can send STOP when the force falls below 50% of its running peak after the peak reaches at least 1 N. It can miss low-force failures or respond to slip. It does not confirm rupture or that the machine has stopped. Threshold and persistence: [to be approved].',
        'Modulus fitting interval: [to be approved]. Replicate count and exclusion rules: [set by your protocol].'
      ],
      steps: [
        'Confirm the approved scope. Identify the material, protocol revision, specimen geometry, measurement method, operating limits, and required protective measures.',
        'Confirm machine readiness. Follow the team’s approved pre-use check for the physical emergency stop, grips, guards, travel, force instrumentation, and controller protections.',
        'Confirm measurement readiness. Identify calibration and verification records. Observe unloaded force stability. Confirm displacement direction and reference.',
        'Document the specimen. Record preparation, orientation, storage, dimensions, and environment.',
        'Enter specimen values. Replace example dimensions. Verify units and the calculated area.',
        'Tare in the defined unloaded configuration. Do not tare away an unknown specimen load.',
        'Mount and align. Avoid twisting, bending, unintended stretching, and damage. Establish slip-reference marks if included in the approved method. Wear eye protection; failure is brittle.',
        'Apply the approved preload: [set by your protocol] N. Allow the specified settling interval. Establish the reference length and displacement origin according to the protocol.',
        'Precondition if required. Use only an approved and supported method, and record what was actually performed.',
        'Start the approved loading sequence. Record force, displacement, and time. Monitor the specimen and machine.',
        'Stop or flag abnormalities. Examples include visible slip, grip tearing, unexpected motion, sensor saturation, stale data, or loss of environmental control.',
        'Record the end reason. Distinguish observed rupture, force-drop detection, manual stop, controller fault, communication loss, and recording limit.',
        'Review before interpreting results. Confirm whether failure occurred in the intended gauge region. Mark incomplete or questionable tests.',
        'Download and verify the record. Reopen the CSV and check source labels, units, metadata, and point count.',
        'Unload, remove, and clean. Follow the approved machine and tissue-handling procedure.'
      ],
      stop: [
        'Stop the test, or flag it in the record, if you see any of these: visible slip or grip tearing; unexpected motion; force reading saturated, stale, or missing; loss of environmental control; communication loss; the specimen failing outside the intended gauge region.',
        'The on-screen STOP and the Esc key send a request through a computer and a connection that can fail. They are not an emergency stop.'
      ],
      report: [
        'Automatic modulus estimate, ultimate tensile strength (or maximum recorded engineering stress for an incomplete test), estimated failure strain (force-drop rule; reported only if a force drop is found), and energy density to the recorded endpoint (Key results).',
        'With each result: the fitted interval for the modulus estimate, the displacement source, the end reason (observed rupture, force-drop detection, manual stop, controller fault, communication loss, or recording limit), failure location, slip or damage flags, and any deviations.'
      ],
      record: [
        'Identification: specimen ID, test ID, date, operator, protocol version.',
        'Biological source (if tissue): species, anatomical site, coded donor or batch identifier, relevant available specimen characteristics.',
        'Tissue preparation: layers retained, fat removal, cutting method, geometry, defects.',
        'Orientation: direction, reference axis, identification method.',
        'Storage: fresh or frozen, storage medium and temperature, duration, freeze–thaw count, thawing method.',
        'Timing: harvest or excision time when available, preparation time, time to test.',
        'Environment: medium, hydration method, temperature, relevant humidity or bath conditions.',
        'Dimensions: individual width and thickness readings, locations, method, reported area, reference length.',
        'Mounting: grip design, interface materials, engagement length, alignment, slip observations.',
        'Loading history: preload, settling interval, preconditioning, recovery interval, prior tests.',
        'Acquisition: force instrument, displacement source, calibration record, sampling information, filtering.',
        'Test conditions: commanded and achieved rate, ramp duration, hold target, hold duration.',
        'Outcome: end reason, failure location, slip or damage flags, incomplete recording, deviations.',
        'Analysis: calculation version, fitted interval, endpoint rule, normalization reference, model assumptions.',
        'Use coded specimen identifiers. Do not enter names or identifying clinical information. This site stores nothing; keep the record in the downloaded files.',
        '“Not recorded” and “not applicable” are different entries; keep them distinct.'
      ],
      notes: [
        'This is a draft for advisor review, not an approved procedure. No operating parameter is approved here.',
        'The tester hardware connection is draft and unvalidated. Calibration, protections, and hardware operation remain unvalidated.',
        'Reported values are estimates that depend on the specimen, the displacement source, and the analysis method.',
        'This project has not established a concrete procedure or expected response, and the sample curve is not a machine capability.',
        'Splitting (for example ASTM C496/C496M, withdrawn in 2026 with no replacement listed), flexural, compression-derived estimates, and direct tensile strength are not interchangeable.',
        'Three safety levels are different. (1) Physical emergency stop: a hardware safety function that needs independent design and validation. (2) Controller protections: proposed force and travel limits, a watchdog and fault handling; these do not exist yet. (3) Browser commands: requests sent through a fallible computer and connection. They are not equivalent safety functions. The on-screen STOP and the Esc key are not an emergency stop.'
      ],
      refs: [
        [ 'ASTM C496/C496M-17. Splitting tensile strength of cylindrical concrete specimens. Withdrawn in 2026, no replacement listed; historical reference only, and not performed by this tester. Public status only.', 'https://store.astm.org/c0496_c0496m-17.html' ],
        [ 'ASTM E111-17(2025)e1. Young’s, tangent, and chord modulus. Public scope only.', 'https://store.astm.org/e0111-17r25e01.html' ],
        [ 'ASTM E4-24. Force calibration and verification of testing machines. Public scope only.', 'https://store.astm.org/e0004-24.html' ],
        [ 'ISO 7500-1:2018. Calibration and verification of the force-measuring system. Public summary only.', 'https://www.iso.org/standard/72572.html' ],
        [ 'ASTM E83-25. Calibration, verification, and classification of extensometer systems. Public scope only.', 'https://store.astm.org/standards/e83' ]
      ],
      refnote: 'Sources supplied by the project owner’s research. They were not independently opened or verified. Standards were reviewed through public publisher information only; the complete standards have not been reviewed for this project. Listing a standard does not establish compliance. The team must obtain and review the applicable edition before using it to define an approved procedure.'
    }
  },
  relaxation: {
    general: {
      summary: 'Stretch the specimen to a target displacement, then hold it there while force is recorded. The record includes the loading ramp, because relaxation can occur while the specimen is still being extended. The stress change shows time-dependent (viscoelastic) behavior.',
      status: 'Draft 0.1 for advisor review, November 7, 2026. No numerical operating parameters are approved. Reviewer: [not yet reviewed]. Values in [brackets] must be decided by the team and approved before use.',
      specimen: [
        'Shape: [set by your protocol], for example a dog-bone (dumbbell) or a straight strip with a marked gauge length.',
        'Measure gauge length, width, and thickness before testing; use the average of [number] measurements and record where each was taken and the method.',
        'Record defects, how the specimen was cut, and any prior loading.'
      ],
      equipment: [
        'Force: [load cell, amplifier, and acquisition configuration]; record its calibration and verification status. Tare is not calibration.',
        'Displacement source: [crosshead position from motor steps, or another source]. Commanded travel is not independently measured travel, and the source must be identified in the record.',
        'Strain in this website is displacement divided by the entered reference length. When the displacement is crosshead motion, grip slip and load-train deformation can affect it.',
        'Grips: [set by your protocol].',
        'Timing: report the sensor conversion rate, controller sampling and filtering, transmitted reading rate, and recorded timestamps separately. Prefer acquisition timestamps for analysis.',
        'Hold target ΔL: [set by your protocol] mm.'
      ],
      settings: [
        'Hold target (displacement or strain): [set by your protocol], within an advisor-approved range.',
        'Ramp rate and duration: [set by your protocol]. Acceptable overshoot and hold drift: [to be approved].',
        'Hold duration: [set by your protocol] s.',
        'Preload and reference conditions: [set by your protocol] N; L0 and displacement origin as in the uniaxial protocol.',
        'Normalization reference and relaxation model or plateau criterion: [to be approved].',
        'Replicate count and exclusion rules: [set by your protocol].'
      ],
      steps: [
        'Complete the relevant preparation and readiness steps: confirm the approved scope and machine readiness, check the physical emergency stop, grips and measurement readiness, and document the specimen.',
        'Confirm that the hold target is within an advisor-approved range for the specimen and apparatus: [set by your protocol].',
        'Define whether the target is crosshead displacement, grip separation, or directly measured specimen strain. This project commands a displacement hold.',
        'Establish preload, reference length, and displacement origin. Tare in the defined unloaded configuration; do not tare away an unknown specimen load.',
        'Perform approved preconditioning and recovery, if required: [method].',
        'Begin recording before loading so the ramp is retained.',
        'Ramp to the target using the approved motion profile: [set by your protocol].',
        'Record the actual ramp end and hold start. Preserve overshoot and settling information.',
        'Hold the controlled variable. Monitor force, position, environment, and slip.',
        'Record achieved hold duration and stability. A command to hold is not evidence that the target was maintained.',
        'End according to the approved procedure. Record whether motion stopped, load remained applied, or unloading occurred.',
        'Download the complete ramp-and-hold record and check source labels, units, metadata, and point count.',
        'Review the hold interval before calculating normalized stress, apparent stress/strain ratio, or a characteristic time.'
      ],
      stop: [
        'Stop the test, or flag it in the record, if you see any of these: visible slip or grip tearing; unexpected motion; force reading saturated, stale, or missing; loss of environmental control; communication loss; the specimen failing outside the intended gauge region.',
        'The on-screen STOP and the Esc key send a request through a computer and a connection that can fail. They are not an emergency stop.'
      ],
      report: [
        'Ramp-peak stress σ0, hold-start stress (when a displacement column and hold target are available), final recorded stress with the elapsed hold time, percent relaxed, the apparent stress/strain ratio after the ramp, and the endpoint-referenced 1/e decay time τ (Key results).',
        'With each result: ramp duration, achieved displacement or strain, overshoot, hold stability, the hold interval used, end reason, and any deviations.'
      ],
      record: [
        'Identification: specimen ID, test ID, date, operator, protocol version.',
        'Biological source (if tissue): species, anatomical site, coded donor or batch identifier, relevant available specimen characteristics.',
        'Tissue preparation: layers retained, fat removal, cutting method, geometry, defects.',
        'Orientation: direction, reference axis, identification method.',
        'Storage: fresh or frozen, storage medium and temperature, duration, freeze–thaw count, thawing method.',
        'Timing: harvest or excision time when available, preparation time, time to test.',
        'Environment: medium, hydration method, temperature, relevant humidity or bath conditions.',
        'Dimensions: individual width and thickness readings, locations, method, reported area, reference length.',
        'Mounting: grip design, interface materials, engagement length, alignment, slip observations.',
        'Loading history: preload, settling interval, preconditioning, recovery interval, prior tests.',
        'Acquisition: force instrument, displacement source, calibration record, sampling information, filtering.',
        'Test conditions: commanded and achieved rate, ramp duration, hold target, hold duration.',
        'Outcome: end reason, failure location, slip or damage flags, incomplete recording, deviations.',
        'Analysis: calculation version, fitted interval, endpoint rule, normalization reference, model assumptions.',
        'Use coded specimen identifiers. Do not enter names or identifying clinical information. This site stores nothing; keep the record in the downloaded files.',
        '“Not recorded” and “not applicable” are different entries; keep them distinct.'
      ],
      notes: [
        'This is a draft for advisor review, not an approved procedure. No operating parameter is approved here.',
        'The tester hardware connection is draft and unvalidated. Calibration, protections, and hardware operation remain unvalidated.',
        'Reported values are estimates that depend on the specimen, the displacement source, and the analysis method.',
        'Record the complete loading ramp and hold. Report the ramp duration, achieved displacement or strain, overshoot, and hold stability. Choose the ramp with advisor review and system testing. Do not assume the ramp is instantaneous. A faster ramp is not automatically better: overshoot, vibration, sensor response, and controller limits can affect the result.',
        'This project commands a displacement hold. A stationary crosshead does not establish constant specimen strain. Changes in grip slip or load-train deformation can change specimen extension during the hold.',
        'Normalized stress and percent relaxed depend on the selected reference. Final recorded stress is the last valid value in the selected hold interval; it is not automatically an equilibrium value.',
        'Three safety levels are different. (1) Physical emergency stop: a hardware safety function that needs independent design and validation. (2) Controller protections: proposed force and travel limits, a watchdog and fault handling; these do not exist yet. (3) Browser commands: requests sent through a fallible computer and connection. They are not equivalent safety functions. The on-screen STOP and the Esc key are not an emergency stop.'
      ],
      refs: [
        [ 'ASTM E328-26. Stress relaxation for materials and structures. Public scope only.', 'https://store.astm.org/e0328-26.html' ],
        [ 'Troyer, Estep and Puttlitz, 2012. Viscoelastic effects during loading in soft tissue mechanics. Abstract and publisher excerpts only; spinal ligament tissue.', 'https://doi.org/10.1016/j.actbio.2011.07.035' ],
        [ 'Roylance, MIT, 2001. Engineering Viscoelasticity. Educational module.', 'https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/d173f95347f59d59dd9b7387ab4303e7_MIT3_11F99_visco.pdf' ],
        [ 'ASTM E4-24. Force calibration and verification of testing machines. Public scope only.', 'https://store.astm.org/e0004-24.html' ],
        [ 'ISO 7500-1:2018. Calibration and verification of the force-measuring system. Public summary only.', 'https://www.iso.org/standard/72572.html' ],
        [ 'ISO 13850:2015. Emergency stop function, principles for design. Public summary only.', 'https://www.iso.org/standard/59970.html' ],
        [ 'HX711 datasheet, version 2.0. Sensor conversion rate (not the rate of the finished controller and browser recording).', 'https://e2e.ti.com/cfs-file/__key/communityserver-discussions-components-files/73/HX711.pdf' ]
      ],
      refnote: 'Sources supplied by the project owner’s research. They were not independently opened or verified. Standards were reviewed through public publisher information only; the complete standards have not been reviewed for this project. Listing a standard does not establish compliance. The team must obtain and review the applicable edition before using it to define an approved procedure.'
    },
    skin: {
      summary: 'Soft-tissue relaxation. Hydration and temperature must stay controlled through the ramp and hold.',
      status: 'Draft 0.1 for advisor review, November 7, 2026. No numerical operating parameters are approved. Reviewer: [not yet reviewed]. Values in [brackets] must be decided by the team and approved before use.',
      specimen: [
        'Prepare as for skin tension: consistent shape, recorded orientation and layers retained, measured thickness.',
        'Keep hydrated with [solution] during the whole hold. Hydration changes can alter the response, so maintain and record the approved conditions.',
        'Source, storage, and handling: [set by your protocol and your lab’s tissue-handling approval].'
      ],
      equipment: [
        'Low-range load cell suited to [expected peak force] N.',
        'Force: [load cell, amplifier, and acquisition configuration]; record its calibration and verification status. Tare is not calibration.',
        'Displacement source: [crosshead position from motor steps, or another source]. Commanded travel is not independently measured travel, and the source must be identified in the record.',
        'Strain in this website is displacement divided by the entered reference length. When the displacement is crosshead motion, grip slip and load-train deformation can affect it.',
        'Timing: report the sensor conversion rate, controller sampling and filtering, transmitted reading rate, and recorded timestamps separately. Prefer acquisition timestamps for analysis.',
        'Hold target: [set by your protocol], below damage.'
      ],
      settings: [
        'Hold target (displacement or strain): [set by your protocol], within an advisor-approved range.',
        'Ramp rate and duration: [set by your protocol]. Acceptable overshoot and hold drift: [to be approved].',
        'Hold duration: [set by your protocol] s.',
        'Preload and reference conditions: [set by your protocol] N; L0 and displacement origin as in the uniaxial protocol.',
        'Normalization reference and relaxation model or plateau criterion: [to be approved].',
        'Replicate count and exclusion rules: [set by your protocol].'
      ],
      steps: [
        'Complete the relevant preparation and readiness steps: confirm the approved scope and machine readiness, check the physical emergency stop, grips and measurement readiness, and document the specimen.',
        'Confirm that the hold target is within an advisor-approved range for the specimen and apparatus: [set by your protocol].',
        'Define whether the target is crosshead displacement, grip separation, or directly measured specimen strain. This project commands a displacement hold.',
        'Establish preload, reference length, and displacement origin. Tare in the defined unloaded configuration; do not tare away an unknown specimen load. Keep the specimen hydrated and wear gloves per your lab’s biosafety rules.',
        'Perform approved preconditioning and recovery, if required: [method].',
        'Begin recording before loading so the ramp is retained.',
        'Ramp to the target using the approved motion profile: [set by your protocol].',
        'Record the actual ramp end and hold start. Preserve overshoot and settling information.',
        'Hold the controlled variable. Monitor force, position, environment, and slip. Keep the specimen hydrated during the hold.',
        'Record achieved hold duration and stability. A command to hold is not evidence that the target was maintained.',
        'End according to the approved procedure. Record whether motion stopped, load remained applied, or unloading occurred. Dispose of tissue following your lab’s rules.',
        'Download the complete ramp-and-hold record and check source labels, units, metadata, and point count.',
        'Review the hold interval before calculating normalized stress, apparent stress/strain ratio, or a characteristic time.'
      ],
      stop: [
        'Stop the test, or flag it in the record, if you see any of these: visible slip or grip tearing; unexpected motion; force reading saturated, stale, or missing; loss of environmental control; communication loss; the specimen failing outside the intended gauge region.',
        'The on-screen STOP and the Esc key send a request through a computer and a connection that can fail. They are not an emergency stop.'
      ],
      report: [
        'Ramp-peak stress σ0, hold-start stress (when a displacement column and hold target are available), final recorded stress with the elapsed hold time, percent relaxed, the apparent stress/strain ratio after the ramp, and the endpoint-referenced 1/e decay time τ (Key results).',
        'With each result: ramp duration, achieved displacement or strain, overshoot, hold stability, the hold interval used, end reason, and any deviations.',
        'Also record hydration method, temperature, and orientation.'
      ],
      record: [
        'Identification: specimen ID, test ID, date, operator, protocol version.',
        'Biological source (if tissue): species, anatomical site, coded donor or batch identifier, relevant available specimen characteristics.',
        'Tissue preparation: layers retained, fat removal, cutting method, geometry, defects.',
        'Orientation: direction, reference axis, identification method.',
        'Storage: fresh or frozen, storage medium and temperature, duration, freeze–thaw count, thawing method.',
        'Timing: harvest or excision time when available, preparation time, time to test.',
        'Environment: medium, hydration method, temperature, relevant humidity or bath conditions.',
        'Dimensions: individual width and thickness readings, locations, method, reported area, reference length.',
        'Mounting: grip design, interface materials, engagement length, alignment, slip observations.',
        'Loading history: preload, settling interval, preconditioning, recovery interval, prior tests.',
        'Acquisition: force instrument, displacement source, calibration record, sampling information, filtering.',
        'Test conditions: commanded and achieved rate, ramp duration, hold target, hold duration.',
        'Outcome: end reason, failure location, slip or damage flags, incomplete recording, deviations.',
        'Analysis: calculation version, fitted interval, endpoint rule, normalization reference, model assumptions.',
        'Use coded specimen identifiers. Do not enter names or identifying clinical information. This site stores nothing; keep the record in the downloaded files.',
        '“Not recorded” and “not applicable” are different entries; keep them distinct.'
      ],
      notes: [
        'This is a draft for advisor review, not an approved procedure. No operating parameter is approved here.',
        'The tester hardware connection is draft and unvalidated. Calibration, protections, and hardware operation remain unvalidated.',
        'Reported values are estimates that depend on the specimen, the displacement source, and the analysis method.',
        'Record the complete loading ramp and hold. Report the ramp duration, achieved displacement or strain, overshoot, and hold stability. Choose the ramp with advisor review and system testing. Do not assume the ramp is instantaneous. A faster ramp is not automatically better: overshoot, vibration, sensor response, and controller limits can affect the result.',
        'This project commands a displacement hold. A stationary crosshead does not establish constant specimen strain. Changes in grip slip or load-train deformation can change specimen extension during the hold.',
        'Protocols for biological tissue vary; specify each value in your protocol. No dedicated consensus method was established for this project by this review.',
        'Three safety levels are different. (1) Physical emergency stop: a hardware safety function that needs independent design and validation. (2) Controller protections: proposed force and travel limits, a watchdog and fault handling; these do not exist yet. (3) Browser commands: requests sent through a fallible computer and connection. They are not equivalent safety functions. The on-screen STOP and the Esc key are not an emergency stop.'
      ],
      refs: [
        [ 'Troyer, Estep and Puttlitz, 2012. Viscoelastic effects during loading in soft tissue mechanics. Abstract and publisher excerpts only; spinal ligament tissue.', 'https://doi.org/10.1016/j.actbio.2011.07.035' ],
        [ 'Roylance, MIT, 2001. Engineering Viscoelasticity. Educational module.', 'https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/d173f95347f59d59dd9b7387ab4303e7_MIT3_11F99_visco.pdf' ],
        [ 'Sachs et al., 2024. A quadriphasic mechanical model of the human dermis. Full open-access article.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11584490/' ],
        [ 'Ranamukhaarachchi et al., 2016. Human and porcine skin before and after preservation by freezing. Full article.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4997349/' ],
        [ 'ASTM E328-26. Stress relaxation for materials and structures. Public scope only.', 'https://store.astm.org/e0328-26.html' ],
        [ 'ISO 13850:2015. Emergency stop function, principles for design. Public summary only.', 'https://www.iso.org/standard/59970.html' ]
      ],
      refnote: 'Sources supplied by the project owner’s research. They were not independently opened or verified. Standards were reviewed through public publisher information only; the complete standards have not been reviewed for this project. Listing a standard does not establish compliance. The team must obtain and review the applicable edition before using it to define an approved procedure.'
    },
    steel: {
      summary: 'A steel hold may help characterize combined stability of the specimen, load train, and instrument under defined conditions. It does not isolate instrument drift. Reference method: ASTM E328.',
      status: 'Draft 0.1 for advisor review, November 7, 2026. No numerical operating parameters are approved. Reviewer: [not yet reviewed]. Values in [brackets] must be decided by the team and approved before use.',
      specimen: [
        'Machined specimen as for steel tension: [confirm geometry].'
      ],
      equipment: [
        'Confirm the frame and load cell are rated for the force at the hold strain.',
        'Force: [load cell, amplifier, and acquisition configuration]; record its calibration and verification status. Tare is not calibration.',
        'Displacement source: [crosshead position from motor steps, or another source]. Commanded travel is not independently measured travel, and the source must be identified in the record.',
        'Strain in this website is displacement divided by the entered reference length. When the displacement is crosshead motion, grip slip and load-train deformation can affect it.',
        'Timing: report the sensor conversion rate, controller sampling and filtering, transmitted reading rate, and recorded timestamps separately. Prefer acquisition timestamps for analysis.'
      ],
      settings: [
        'Hold target (displacement or strain): [set by your protocol], within an advisor-approved range.',
        'Ramp rate and duration: [set by your protocol]. Acceptable overshoot and hold drift: [to be approved].',
        'Hold duration: [set by your protocol] s.',
        'Preload and reference conditions: [set by your protocol] N; L0 and displacement origin as in the uniaxial protocol.',
        'Normalization reference and relaxation model or plateau criterion: [to be approved].',
        'Replicate count and exclusion rules: [set by your protocol].'
      ],
      steps: [
        'Complete the relevant preparation and readiness steps: confirm the approved scope and machine readiness, check the physical emergency stop, grips and measurement readiness, and document the specimen. Wear eye protection.',
        'Confirm that the hold target is within an advisor-approved range for the specimen and apparatus: [set by your protocol].',
        'Define whether the target is crosshead displacement, grip separation, or directly measured specimen strain. This project commands a displacement hold.',
        'Establish preload, reference length, and displacement origin. Tare in the defined unloaded configuration; do not tare away an unknown specimen load.',
        'Perform approved preconditioning and recovery, if required: [method].',
        'Begin recording before loading so the ramp is retained.',
        'Ramp to the target using the approved motion profile: [set by your protocol].',
        'Record the actual ramp end and hold start. Preserve overshoot and settling information.',
        'Hold the controlled variable. Monitor force, position, environment, and slip.',
        'Record achieved hold duration and stability. A command to hold is not evidence that the target was maintained.',
        'End according to the approved procedure. Record whether motion stopped, load remained applied, or unloading occurred.',
        'Download the complete ramp-and-hold record and check source labels, units, metadata, and point count.',
        'Review the hold interval before calculating normalized stress, apparent stress/strain ratio, or a characteristic time.'
      ],
      stop: [
        'Stop the test, or flag it in the record, if you see any of these: visible slip or grip tearing; unexpected motion; force reading saturated, stale, or missing; loss of environmental control; communication loss; the specimen failing outside the intended gauge region.',
        'The on-screen STOP and the Esc key send a request through a computer and a connection that can fail. They are not an emergency stop.'
      ],
      report: [
        'Ramp-peak stress σ0, hold-start stress (when a displacement column and hold target are available), final recorded stress with the elapsed hold time, percent relaxed, the apparent stress/strain ratio after the ramp, and the endpoint-referenced 1/e decay time τ (Key results).',
        'With each result: ramp duration, achieved displacement or strain, overshoot, hold stability, the hold interval used, end reason, and any deviations.'
      ],
      record: [
        'Identification: specimen ID, test ID, date, operator, protocol version.',
        'Biological source (if tissue): species, anatomical site, coded donor or batch identifier, relevant available specimen characteristics.',
        'Tissue preparation: layers retained, fat removal, cutting method, geometry, defects.',
        'Orientation: direction, reference axis, identification method.',
        'Storage: fresh or frozen, storage medium and temperature, duration, freeze–thaw count, thawing method.',
        'Timing: harvest or excision time when available, preparation time, time to test.',
        'Environment: medium, hydration method, temperature, relevant humidity or bath conditions.',
        'Dimensions: individual width and thickness readings, locations, method, reported area, reference length.',
        'Mounting: grip design, interface materials, engagement length, alignment, slip observations.',
        'Loading history: preload, settling interval, preconditioning, recovery interval, prior tests.',
        'Acquisition: force instrument, displacement source, calibration record, sampling information, filtering.',
        'Test conditions: commanded and achieved rate, ramp duration, hold target, hold duration.',
        'Outcome: end reason, failure location, slip or damage flags, incomplete recording, deviations.',
        'Analysis: calculation version, fitted interval, endpoint rule, normalization reference, model assumptions.',
        'Use coded specimen identifiers. Do not enter names or identifying clinical information. This site stores nothing; keep the record in the downloaded files.',
        '“Not recorded” and “not applicable” are different entries; keep them distinct.'
      ],
      notes: [
        'This is a draft for advisor review, not an approved procedure. No operating parameter is approved here.',
        'The tester hardware connection is draft and unvalidated. Calibration, protections, and hardware operation remain unvalidated.',
        'Reported values are estimates that depend on the specimen, the displacement source, and the analysis method.',
        'This project commands a displacement hold. A stationary crosshead does not establish constant specimen strain. Changes in grip slip or load-train deformation can change specimen extension during the hold.',
        'A steel hold is not a pure drift reference. Its measured response can include specimen behavior, seating, load-train changes, and instrumentation effects.',
        'Three safety levels are different. (1) Physical emergency stop: a hardware safety function that needs independent design and validation. (2) Controller protections: proposed force and travel limits, a watchdog and fault handling; these do not exist yet. (3) Browser commands: requests sent through a fallible computer and connection. They are not equivalent safety functions. The on-screen STOP and the Esc key are not an emergency stop.'
      ],
      refs: [
        [ 'ASTM E328-26. Stress relaxation for materials and structures. Public scope only.', 'https://store.astm.org/e0328-26.html' ],
        [ 'ASTM E4-24. Force calibration and verification of testing machines. Public scope only.', 'https://store.astm.org/e0004-24.html' ],
        [ 'ISO 7500-1:2018. Calibration and verification of the force-measuring system. Public summary only.', 'https://www.iso.org/standard/72572.html' ],
        [ 'ISO 13850:2015. Emergency stop function, principles for design. Public summary only.', 'https://www.iso.org/standard/59970.html' ]
      ],
      refnote: 'Sources supplied by the project owner’s research. They were not independently opened or verified. Standards were reviewed through public publisher information only; the complete standards have not been reviewed for this project. Listing a standard does not establish compliance. The team must obtain and review the applicable edition before using it to define an approved procedure.'
    },
    concrete: {
      summary: 'Concrete remains an unresolved scope decision. Concrete relaxation depends on age, mixture, moisture, temperature, loading level, and method. This project has not established a concrete relaxation procedure or expected response.',
      status: 'Draft 0.1 for advisor review, November 7, 2026. No numerical operating parameters are approved. Reviewer: [not yet reviewed]. Values in [brackets] must be decided by the team and approved before use.',
      specimen: [
        'Specimen ends designed for tension: [set by your protocol].',
        'Cure age and conditions: [set by your protocol].'
      ],
      equipment: [
        'High-capacity load cell and frame rated for [expected force] N.',
        'Hold strain well below the cracking strain: [set by your protocol].',
        'Force: [load cell, amplifier, and acquisition configuration]; record its calibration and verification status. Tare is not calibration.',
        'Displacement source: [crosshead position from motor steps, or another source]. Commanded travel is not independently measured travel, and the source must be identified in the record.'
      ],
      settings: [
        'Hold target (displacement or strain): [set by your protocol], within an advisor-approved range.',
        'Ramp rate and duration: [set by your protocol]. Acceptable overshoot and hold drift: [to be approved].',
        'Hold duration: [set by your protocol] s.',
        'Preload and reference conditions: [set by your protocol] N; L0 and displacement origin as in the uniaxial protocol.',
        'Normalization reference and relaxation model or plateau criterion: [to be approved].',
        'Replicate count and exclusion rules: [set by your protocol].'
      ],
      steps: [
        'Complete the relevant preparation and readiness steps: confirm the approved scope and machine readiness, check the physical emergency stop, grips and measurement readiness, and document the specimen. Wear eye protection.',
        'Confirm that the hold target is within an advisor-approved range for the specimen and apparatus: [set by your protocol].',
        'Define whether the target is crosshead displacement, grip separation, or directly measured specimen strain. This project commands a displacement hold.',
        'Establish preload, reference length, and displacement origin. Tare in the defined unloaded configuration; do not tare away an unknown specimen load.',
        'Perform approved preconditioning and recovery, if required: [method].',
        'Begin recording before loading so the ramp is retained.',
        'Ramp to the target using the approved motion profile: [set by your protocol].',
        'Record the actual ramp end and hold start. Preserve overshoot and settling information.',
        'Hold the controlled variable. Monitor force, position, environment, and slip.',
        'Record achieved hold duration and stability. A command to hold is not evidence that the target was maintained.',
        'End according to the approved procedure. Record whether motion stopped, load remained applied, or unloading occurred.',
        'Download the complete ramp-and-hold record and check source labels, units, metadata, and point count.',
        'Review the hold interval before calculating normalized stress, apparent stress/strain ratio, or a characteristic time.'
      ],
      stop: [
        'Stop the test, or flag it in the record, if you see any of these: visible slip or grip tearing; unexpected motion; force reading saturated, stale, or missing; loss of environmental control; communication loss; the specimen failing outside the intended gauge region.',
        'The on-screen STOP and the Esc key send a request through a computer and a connection that can fail. They are not an emergency stop.'
      ],
      report: [
        'With each result: ramp duration, achieved displacement or strain, overshoot, hold stability, the hold interval used, end reason, and any deviations.'
      ],
      record: [
        'Identification: specimen ID, test ID, date, operator, protocol version.',
        'Biological source (if tissue): species, anatomical site, coded donor or batch identifier, relevant available specimen characteristics.',
        'Tissue preparation: layers retained, fat removal, cutting method, geometry, defects.',
        'Orientation: direction, reference axis, identification method.',
        'Storage: fresh or frozen, storage medium and temperature, duration, freeze–thaw count, thawing method.',
        'Timing: harvest or excision time when available, preparation time, time to test.',
        'Environment: medium, hydration method, temperature, relevant humidity or bath conditions.',
        'Dimensions: individual width and thickness readings, locations, method, reported area, reference length.',
        'Mounting: grip design, interface materials, engagement length, alignment, slip observations.',
        'Loading history: preload, settling interval, preconditioning, recovery interval, prior tests.',
        'Acquisition: force instrument, displacement source, calibration record, sampling information, filtering.',
        'Test conditions: commanded and achieved rate, ramp duration, hold target, hold duration.',
        'Outcome: end reason, failure location, slip or damage flags, incomplete recording, deviations.',
        'Analysis: calculation version, fitted interval, endpoint rule, normalization reference, model assumptions.',
        'Use coded specimen identifiers. Do not enter names or identifying clinical information. This site stores nothing; keep the record in the downloaded files.',
        '“Not recorded” and “not applicable” are different entries; keep them distinct.'
      ],
      notes: [
        'This is a draft for advisor review, not an approved procedure. No operating parameter is approved here.',
        'The tester hardware connection is draft and unvalidated. Calibration, protections, and hardware operation remain unvalidated.',
        'Reported values are estimates that depend on the specimen, the displacement source, and the analysis method.',
        'This project commands a displacement hold. A stationary crosshead does not establish constant specimen strain. Changes in grip slip or load-train deformation can change specimen extension during the hold.',
        'Published work documents tensile stress relaxation relevant to early-age concrete and thermal cracking. That evidence does not validate direct-tension testing on this apparatus.',
        'Three safety levels are different. (1) Physical emergency stop: a hardware safety function that needs independent design and validation. (2) Controller protections: proposed force and travel limits, a watchdog and fault handling; these do not exist yet. (3) Browser commands: requests sent through a fallible computer and connection. They are not equivalent safety functions. The on-screen STOP and the Esc key are not an emergency stop.'
      ],
      refs: [
        [ 'Nonaka, 1981. Tensile stress relaxation of concrete. Public abstract only; it does not validate direct-tension testing on this apparatus.', 'https://www.jstage.jst.go.jp/article/jsidre1965/1981/96/1981_96_58/_article/-char/en' ],
        [ 'ASTM E328-26. Stress relaxation for materials and structures. Public scope only.', 'https://store.astm.org/e0328-26.html' ],
        [ 'ISO 13850:2015. Emergency stop function, principles for design. Public summary only.', 'https://www.iso.org/standard/59970.html' ]
      ],
      refnote: 'Sources supplied by the project owner’s research. They were not independently opened or verified. Standards were reviewed through public publisher information only; the complete standards have not been reviewed for this project. Listing a standard does not establish compliance. The team must obtain and review the applicable edition before using it to define an approved procedure.'
    }
  }
};
