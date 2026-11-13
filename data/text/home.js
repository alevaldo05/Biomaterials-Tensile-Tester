/* HOME PAGE TEXT (index.html)
   Edit only the words between the quotation marks. Keep every quotation mark, comma, bracket and brace
   exactly as they are. To check your changes, open check-text.html in the browser. Guide: EDITING-TEXT.md.

   You can use: **bold**   *italic*   [link text](page.html)   {E} for a variable   _{0} subscript   ^{2} superscript
   Type symbols directly (σ ε Δ × ² – ’ →). Do not type HTML tags. */
window.SITE_TEXT = window.SITE_TEXT || {};
window.SITE_TEXT.home = {

  /* The line under the big title at the top of the page. */
  sub: "Tests are run in the tester app on the lab computer. Learn, practice, and review saved data here.",

  /* Short descriptions on the cards in the "Start screen" layout. */
  cards: {
    getApp: "The Windows app that connects to the tester and records tests. Download not yet available.",
    learnStart: "Before you test, practice with a simulated test, reopen saved files, and the glossary.",
    protocols: "Procedures for each test and material.",
    materials: "Properties, a stiffness chart, and sample graphs for many materials.",
    calibration: "Compare force readings with known weights and record the result.",
    about: "Tensile testing, project status, and references.",
    help: "Troubleshooting, keyboard keys, and references.",
    settings: "Color theme, style, and layout."
  },

  /* The sections of the page. Each key (such as "about-title") is fixed; do not rename it. */
  sections: {

    "about-title": {
      heading: "About the tester",
      blocks: [
        "A tensile tester extends a specimen along one axis while recording the force it resists and the distance it stretches. Normalized by specimen geometry, these give stress and strain, which describe stiffness, strength, and time-dependent behavior. This tester is built for biomaterials: biological tissues such as skin, and materials designed to interact with them. It supports uniaxial tension and stress relaxation tests, with room for more later.",
        "[Read more about tensile testing →](about.html)"
      ]
    },

    "how-title": {
      heading: "How it works",
      blocks: [
        { steps: [
          { title: "Prepare the specimen", text: "Follow the protocol for your test and material, then measure gauge length, width, and thickness." },
          { title: "Run the test", text: "Run the test in the [tester app](choose-test.html) on the lab computer. To learn the steps first, try the [practice page](practice.html), which uses a labeled simulator." },
          { title: "Review and download", text: "Read the key results, then download the data as a CSV file for Excel and the graph as an image. Reopen old files with [Load Test](load-test.html)." }
        ] }
      ]
    },

    "proto-title": {
      heading: "Protocols and procedures",
      blocks: [
        { note: "Step-by-step procedures for each test, in general, with an example graph of what to expect. Procedures for specific materials will be added later. These are placeholders until the team’s protocols are final." },
        { linklist: [
          { link: "[Uniaxial Tension protocol](protocol-uniaxial-tension.html)", note: "– extension to failure at constant speed" },
          { link: "[Stress Relaxation protocol](protocol-stress-relaxation.html)", note: "– hold at fixed displacement while force decays" }
        ] }
      ]
    }

  }
};
