/* LEARN PAGE TEXT (learn.html)
   Edit only the words between the quotation marks. Keep every quotation mark, comma, bracket and brace
   exactly as they are. To check your changes, open check-text.html in the browser. Guide: EDITING-TEXT.md.

   You can use: **bold**   *italic*   [link text](page.html)   {E} for a variable   _{0} subscript   ^{2} superscript
   Type symbols directly (σ ε Δ × ² – ’ →). Do not type HTML tags. */
window.SITE_TEXT = window.SITE_TEXT || {};
window.SITE_TEXT.learn = {

  /* The line under the page title. */
  sub: "Preparation, background, and terms used on this site.",

  sections: {

    /* "Before you test": the items come from data/checklist.js, the same file the optional pre-test
       pop-up uses. Change the items there, not here. printButton is the label of the button that prints
       a blank one-page run sheet; delete that line to remove the button. */
    "before-title": {
      heading: "Before you test",
      blocks: [ { pretest: true, printButton: "Print blank run sheet" } ]
    },

    /* The simulator lives only on the practice page; this website has no USB connection (real tests are run in the tester app). */
    "practice-title": {
      heading: "Practice with a simulated test",
      blocks: [
        { p: "This website does not connect to the tester: real tests are run in the [tester app](choose-test.html). To learn the steps without a tester, use the [practice page](practice.html). It has a labeled simulator, and everything it shows is *Simulated data, not measured*. Nothing on it connects to a tester." },
        { p: "To reopen a CSV file saved earlier, from the practice page or the tester app, use [Load Test](load-test.html). It opens the file in this browser only; nothing is uploaded." }
      ]
    },

    "bg-title": {
      heading: "Background",
      blocks: [
        { columns: [
          { heading: "Biomechanics", blocks: [
            "Biomechanics applies the principles of mechanics to living systems, describing how tissues deform and carry load, from whole organs down to cells."
          ] },
          { heading: "Why tensile testing matters for skin", blocks: [
            "Skin is layered, nonlinear, and viscoelastic. It stretches easily at first, then stiffens, and its response depends on time and direction. Tensile tests quantify stiffness, strength, extensibility, and stress relaxation. These can inform wound closure and surgical planning, graft and dressing design, and comparisons across age, hydration, or condition."
          ] }
        ] },
        { h3: "What the machine measures" },
        "Force and displacement are recorded channels. Stress, strain, modulus estimates, and energy are calculated results. Their meaning depends on the specimen dimensions, reference state, displacement source, and analysis method.",
        { h3: "Why comparisons need matching conditions" },
        "Compare specimens using compatible preparation, orientation, reference length, loading history, rate, environment, and analysis. A difference in a reported modulus can reflect differences in the specimen, method, or both.",
        "[Read more about tensile testing →](about.html) · [Troubleshooting and keyboard help →](help.html)"
      ]
    },

    /* Glossary: each line is [ "Term", "Definition" ]. Add a term by adding a line (keep the comma at the end). */
    "gloss-title": {
      heading: "Glossary",
      blocks: [
        { summary: "Show terms", glossary: [
          [ "Force, {F}", "Axial load recorded by the force-measuring system, in newtons." ],
          [ "Reference length, {L}_{0}", "Length used as the strain reference. State when and how it was established." ],
          [ "Original area, {A}_{0}", "Cross-sectional area assigned to the reference specimen state." ],
          [ "Engineering stress, σ_{e}", "Force divided by original area." ],
          [ "Engineering strain, ε_{e}", "Specimen extension divided by reference length. It is dimensionless; multiply by 100 for percent." ],
          [ "Crosshead-based strain", "Crosshead displacement divided by {L}_{0}. It includes effects that may differ from extension of the marked specimen gauge region." ],
          [ "True stress", "Force divided by current cross-sectional area." ],
          [ "True strain", "Logarithmic length change for the stated deformation measure." ],
          [ "Stiffness, {k}", "Slope of force against extension, commonly N/mm. It depends on specimen geometry and measurement arrangement." ],
          [ "Young’s modulus, {E}", "Stress–strain slope in an appropriate linear elastic range." ],
          [ "Tangent modulus", "Local stress–strain slope at a stated strain." ],
          [ "Secant modulus", "Slope from the chosen origin to a stated point on the stress–strain curve." ],
          [ "Chord modulus", "Slope between two stated stress–strain points." ],
          [ "Offset yield strength", "Stress at the intersection with a specified offset line. Its appropriateness depends on the material and method." ],
          [ "Ultimate tensile strength, UTS", "Maximum engineering tensile stress reached in a valid tensile test. For an incomplete test, use “maximum recorded engineering stress.”" ],
          [ "Failure strain", "Strain associated with a defined failure event and measurement method." ],
          [ "Toughness", "Work per reference volume up to a defined failure endpoint. It is distinct from fracture toughness." ],
          [ "Viscoelasticity", "Mechanical behavior that depends on time and loading history and includes recoverable and dissipative response." ],
          [ "Creep", "Time-dependent strain under a maintained stress condition." ],
          [ "Stress relaxation", "Time-dependent stress under a maintained strain condition." ],
          [ "Relaxation modulus", "Time-dependent stress divided by the imposed strain amplitude for an appropriate step-strain experiment and model." ],
          [ "Tare", "Setting the current force reference to zero." ],
          [ "Preload", "Defined initial tensile force applied before the main loading sequence." ],
          [ "Calibration", "Establishing an instrument-response relationship using references under stated conditions." ],
          [ "Verification", "Checking whether stated requirements are met." ],
          [ "Drift", "Change in indicated response over time under nominally unchanged conditions." ],
          [ "Measurement uncertainty", "Quantified uncertainty associated with a measurement result; it is not the same as specimen-to-specimen variation." ]
        ] }
      ]
    }

  }
};
