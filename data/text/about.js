/* ABOUT PAGE TEXT (about.html)
   Edit only the words between the quotation marks. Keep every quotation mark, comma, bracket and brace
   exactly as they are. To check your changes, open check-text.html in the browser. Guide: EDITING-TEXT.md.

   You can use: **bold**   *italic*   [link text](page.html)   {E} for a variable   _{0} subscript   ^{2} superscript
   Type symbols directly (σ ε Δ × ² – ’ →). Do not type HTML tags.
   "tab" is the short name shown when the page is arranged as Tabs. */
window.SITE_TEXT = window.SITE_TEXT || {};
window.SITE_TEXT.about = {

  /* The note at the top of the page, next to the "Prototype" badge. */
  status: "Senior design prototype. The hardware has not been validated; graphs on this site use labeled sample or simulated data.",

  sections: {

    "measures-title": {
      heading: "What a tensile test measures", tab: "What it measures",
      blocks: [
        "A tensile test pulls a specimen along one axis and records the force it carries and how far it extends. This tester records force and crosshead displacement over time. Engineering stress is calculated using the specimen’s initial cross-sectional area. Crosshead-based engineering strain is estimated using displacement divided by the initial gauge length. Grip slip and deformation of the grips and frame can affect this estimate.",
        { columns: [
          { heading: "Recorded", blocks: [
            { list: [ "Time (s)", "Force, {F} (N)", "Crosshead displacement (mm)" ] }
          ] },
          { heading: "Calculated", blocks: [
            { list: [
              "Engineering stress, σ = {F}/{A}_{0} (MPa)",
              "Engineering strain, ε = Δ{L}/{L}_{0} (no units; ×100 for percent)",
              "Results derived from them: modulus, strength, failure strain, relaxation"
            ] }
          ] }
        ] },
        { note: "Engineering stress and strain use the original area and length. They are not direct measurements of true stress or true strain, and crosshead-based strain is not an extensometer measurement." }
      ]
    },

    "why-title": {
      heading: "Why tensile testing matters", tab: "Why it matters",
      blocks: [
        "A tensile test turns a material’s response to stretching into numbers that can be compared and used in design: how stiff it is, how much stress it carries, how far it stretches before failing, and, for time-dependent materials, how its stress changes while it is held stretched.",
        "Engineers use these results to select materials, check that a material meets a specification, compare treatments or conditions, and supply properties to calculations and computer models. Because results depend on specimen shape, speed, temperature, and other conditions, a result is meaningful only together with the method that produced it."
      ]
    },

    /* The comparison table. The first row is the column headings. Each following row is
       [ "Topic", "Engineering materials text", "Skin text" ]. "labels" are short names shown when the
       table is stacked on a narrow screen. */
    "compare-title": {
      heading: "Engineering materials and biomaterials", tab: "Materials vs. skin",
      blocks: [
        "The machine works the same way for steel and for skin, but the material behavior, the specimens, and what can be reported differ.",
        "Many metals can be approximated as linear elastic over an initial range under specified conditions. Skin commonly shows a nonlinear, direction-dependent, history-dependent response. Both require a defined specimen and method. Neither material name alone establishes a valid modulus or expected failure value.",
        { table: {
          head: [ "Topic", "Engineering materials (example: mild steel)", "Soft tissue (example: skin)" ],
          labels: [ "Engineering materials", "Skin" ],
          rows: [
            [ "Shape of the curve", "A linear elastic region, then yielding and plastic deformation before fracture.", "Nonlinear from the start: a compliant toe region, then a stiffer, more linear region, then failure." ],
            [ "Stiffness", "Often summarized by one Young’s modulus from the linear region.", "Stiffness changes with strain, so one modulus value cannot fully describe it." ],
            [ "Time and rate", "In a standard room-temperature test, mild steel is usually treated as time-independent.", "Viscoelastic: the response depends on loading rate and history, and stress relaxes while the stretch is held." ],
            [ "Specimens", "Machined to standardized shapes and sizes.", "Cut from tissue; thickness can vary, and the specimen must be kept hydrated." ],
            [ "Variability", "Comparatively consistent when material and preparation are controlled.", "Varies with species or donor, body location, orientation, storage, and hydration." ],
            [ "Gripping", "Shaped ends let grips hold the specimen firmly.", "Soft, wet tissue can slip in the grips or be damaged by them." ],
            [ "Methods", "Published standards exist, for example ASTM E8/E8M and ISO 6892-1 for metals.", "This project has no approved skin method yet; its protocols are drafts." ]
          ]
        } },
        { note: "Concrete, the third sample material on this site, is brittle and much weaker in tension than in compression. Its tensile strength is often measured indirectly, for example by the splitting test in ASTM C496/C496M. ASTM lists C496/C496M as withdrawn in 2026 with no replacement, so it is a historical reference only. That method differs from direct tension and is not performed by this tester." },
        { note: "This educational prototype is not validated for clinical decision-making." }
      ]
    },

    "skin-title": {
      heading: "Skin: why one number is not enough", tab: "Skin",
      blocks: [
        "Skin has a nonlinear, direction-dependent mechanical response. Results depend on the specimen and test conditions, so values from different studies should be compared cautiously.",
        { terms: [
          [ "Toe region", "The initial, relatively compliant part of a nonlinear stress–strain curve. In skin it is commonly explained by wavy collagen fibers straightening as the tissue stretches." ],
          [ "Anisotropy", "Properties depend on loading direction." ],
          [ "Viscoelasticity", "Mechanical behavior that depends on time and loading history." ],
          [ "One modulus is not enough", "The slope keeps changing, so a single modulus depends on which part of the curve was used. Report the region that was fitted." ]
        ] },
        "In one study of excised human back skin, specimen orientation affected the measured tensile properties (Ní Annaidh et al., 2012). Another human-skin study observed failure properties that depended on loading rate under its test conditions (Otténio et al., 2015). These are findings from those studies, not target values for every skin specimen.",
        { h3: "Skin in depth" },
        "Skin is layered. The epidermis forms the outer barrier, while the dermis contains collagen, elastic fibres, cells, and a hydrated ground substance. Report which layers are retained in a test specimen. Including or removing underlying tissue changes what is being tested.",
        "Skin often stiffens as it is stretched. Fibre arrangement and recruitment help explain this nonlinear response, but the curve alone does not identify a unique microscopic mechanism.",
        "Direction and loading history matter. A specimen cut along one anatomical direction can respond differently from one cut across it. Repeated loading, storage, hydration, and the test environment also need documentation.",
        "A single modulus cannot describe the whole response. State the strain range, loading conditions, and measurement method associated with each reported slope. Separate observed results from model-based explanations."
      ]
    },

    "time-title": {
      heading: "Stress relaxation and creep", tab: "Relaxation and creep",
      blocks: [
        { terms: [
          [ "Stress relaxation", "Stress changes over time while strain is held approximately constant. This site’s Stress Relaxation test ramps to a displacement and holds it." ],
          [ "Creep", "Strain changes over time under approximately constant stress. This tester does not run creep tests." ]
        ] },
        { note: "Holding the crosshead still does not prove the specimen’s strain stayed constant, because grip slip can change it." }
      ]
    },

    "skin-why-title": {
      heading: "Why it matters for skin", tab: "Uses for skin",
      blocks: [
        "Tensile tests quantify stiffness, strength, extensibility, and stress relaxation. These can inform wound closure and surgical planning, graft and dressing design, and comparisons across age, hydration, or condition."
      ]
    },

    "limits-title": {
      heading: "Limits of this tester today", tab: "Limits",
      blocks: [
        { list: [
          "Strain comes from crosshead displacement, not an extensometer.",
          "The hardware and the USB connection have not been tested with the real machine.",
          "The protocols are drafts awaiting advisor review.",
          "One force channel and one displacement channel.",
          "The real tester has not been connected, and machine calibration, protections, and hardware operation are unvalidated.",
          "Microsoft Excel compatibility and real measured-data workflows are unverified.",
          "See [Project status](#status-title) below."
        ] }
      ]
    },

    "status-title": {
      heading: "Project status", tab: "Project status",
      blocks: [
        { h3: "Status reported by the project owner on November 7, 2026" },
        { list: [
          "Website workflows are demonstrated with labeled sample and simulated data.",
          "The real tester has not been connected.",
          "Controller code has not been developed.",
          "The serial message format is a draft.",
          "Machine calibration, protections, and hardware operation remain unvalidated.",
          "Protocols and material-property values await review.",
          "Microsoft Excel compatibility and real measured-data workflows remain unverified.",
          "Concrete testing remains an unresolved scope decision."
        ] },
        { columns: [
          { heading: "Works now", blocks: [
            { list: [
              "New Test pages with live graphing, Start/STOP/Tare commands, and CSV and image downloads, demonstrated with a labeled simulator.",
              "USB connection code, not yet tested with the real machine.",
              "Load Test for opening earlier CSV files.",
              "Draft protocols with example graphs from labeled sample data."
            ] }
          ] },
          { heading: "Planned", blocks: [
            { list: [
              "Controller code that matches the website’s message format.",
              "Testing with the real machine and measured data.",
              "Final, approved protocols.",
              "Possible Wi-Fi connection option."
            ] }
          ] }
        ] }
      ]
    },

    "refs-title": {
      heading: "References", tab: "References",
      blocks: [
        { note: "The full numbered reference list, with what each source covers and what was reviewed, is on the [Help page](help.html#helprefs-title)." },
        { h3: "Educational notes" },
        { articles: [
          { text: "[MIT, *Stress–Strain Curves*](https://web.mit.edu/course/3/3.11/www/modules/ss.pdf)", note: "Engineering stress and strain." },
          { text: "[MIT, *Engineering Viscoelasticity*](https://web.mit.edu/course/3/3.11/www/modules/visco.pdf)", note: "Stress relaxation and creep." }
        ] },
        { h3: "Research studies" },
        { articles: [
          { text: "[Ní Annaidh et al., 2012](https://pubmed.ncbi.nlm.nih.gov/22100088/)", note: "Orientation effects on the tensile properties of excised human back skin." },
          { text: "[Otténio et al., 2015](https://pubmed.ncbi.nlm.nih.gov/25455608/)", note: "Loading-rate effects on the failure properties of human skin." }
        ] },
        { h3: "Standards" },
        { note: "Cited by number; the full standards were not reviewed." },
        { articles: [
          { text: "[ASTM E8/E8M](https://store.astm.org/e0008_e0008m-25.html)", note: "Tension testing of metallic materials." },
          { text: "[ISO 6892-1](https://www.iso.org/standard/78322.html)", note: "Tensile testing of metallic materials at room temperature." },
          { text: "[ASTM C496/C496M](https://store.astm.org/c0496_c0496m-17.html)", note: "Splitting tensile strength of cylindrical concrete specimens." }
        ] }
      ]
    }

  }
};
