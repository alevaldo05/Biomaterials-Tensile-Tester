/* HELP PAGE TEXT (help.html)
   Edit only the words between the quotation marks. Keep every quotation mark, comma, bracket and brace
   exactly as they are. To check your changes, open check-text.html in the browser. Guide: EDITING-TEXT.md.

   You can use: **bold**   *italic*   [link text](page.html)   {E} for a variable   _{0} subscript   ^{2} superscript
   Type symbols directly (σ ε Δ × ² – ’ →). Do not type HTML tags.
   The reference list itself is in data/references.js, not here. */
window.SITE_TEXT = window.SITE_TEXT || {};
window.SITE_TEXT.help = {

  /* The line under the page title. */
  sub: "Short answers to common problems, the keyboard keys that work, and the reference list. This website does not connect to the tester; real tests are run in the tester app. The tester hardware connection is draft and has not been tested with the real machine.",

  sections: {

    /* Each row is [ "Problem", "What to do" ]. The first row is the column headings. */
    "trouble-title": {
      heading: "Troubleshooting", tab: "Troubleshooting",
      blocks: [
        { table: {
          head: [ "Problem", "What to do" ],
          labels: [ "What to do" ],
          rows: [
            [ "I want to connect to the tester over USB", "This website has no USB connection. Connecting to the tester over USB is done in the tester app installed on the lab computer (Chrome). Here, use the practice page to learn the screen with a labeled simulator, or Load Test to open a saved CSV file, including a CSV file saved by the tester app." ],
            [ "A message beside a field says \"That is not a number\" or \"Enter the ...\"", "Type digits only, with a point or a comma, in the unit shown (mm, mm/min, or s). Dimensions, speed, and hold values must be greater than 0. The Review panel above Start lists every entry that still needs attention, with a button that moves to the field. Start stays unavailable until you press Use simulator." ],
            [ "Readings stop during a real test", "Machine state may be unknown. Follow the approved physical stop procedure. The on-screen STOP button is not an emergency stop." ],
            [ "A CSV file cannot be opened", "Review test type, delimiter, column names, units, and reported row errors." ],
            [ "Dimensions are missing", "Force and displacement can be reviewed. Results that depend on geometry require measured dimensions. Example dimensions are not measurements." ],
            [ "The modulus looks wrong", "Check dimensions, strain source, preload and reference state, slip, and the fitted interval." ],
            [ "No relaxation time is shown", "The record may not contain a valid hold, sufficient decay, or a defensible reference." ],
            [ "Excel formatting looks different", "The generated workbook has not been verified in Microsoft Excel. Preserve the CSV and record the application used." ]
          ]
        } },
        { h3: "About USB and browsers" },
        "This website has no USB connection and cannot open a serial port. Real tests are run in the tester app. Connecting the tester over USB (Web Serial, in Chrome on a computer) is done in the app installed on the lab computer. Every page of this website, including the practice page and Load Test, works in Chrome and in Safari; Firefox and Edge are not tested.",
        "The Tutorials section below lists short animated illustrations of the screen. They are not recordings of a real test. Each one plays on the page where you do the thing: press Watch how there (it has Pause and Replay, or Back and Next when Motion is set to Reduced). The Need help? button and a step\u2019s \"?\" take you to it too, except while a test is recording.",
        "On the practice page, Load Test, and Calibration, the Need help? button at the bottom right opens a short note about the step you are on. Small hints may also appear by themselves when something may have gone wrong or you stay on one step for a while; each has an X, and they can be turned off in Settings under Help prompts.",
        "On the practice page the setup is shown one step at a time with Back and Next; the \"Show all steps\" switch at the top right shows every step at once. Next stays unavailable until the step\u2019s required entries are filled in, and the line under it says what is missing. STOP is always shown, and the \"?\" buttons explain each step.",
        "When a test is recording, or its data has not been downloaded, clicking a link on the page opens a pop-up asking whether to leave; you can stay, leave, download first once the test has stopped, or press STOP while it is recording. Closing the tab, reloading, or pressing Back shows your browser’s own box instead, which this site cannot change. Leaving a page does not stop the machine.",
        { note: "The on-screen STOP button and the Esc key are requests sent through a computer and a connection that can fail. They are not an emergency stop." }
      ]
    },

    /* Each row is [ "Key", "Where", "What it does" ]. Only list keys that really work. */
    "keys-title": {
      heading: "Keyboard", tab: "Keyboard",
      blocks: [
        "Graph keys work after you click the graph or move to it with the Tab key. They do not work while a test is recording live.",
        { table: {
          head: [ "Key", "Where", "What it does" ],
          labels: [ "Where", "What it does" ],
          rows: [
            [ "Esc", "Practice page, while connected to the simulator", "Sends a STOP command to the simulator. It depends on page focus, event handling, and a working connection. It is not a physical emergency stop. While the pre-test checklist pop-up is open, Esc closes the pop-up and does not send STOP." ],
            [ "Tab", "Underlined terms (Key results, Readout, setup labels, table headings)", "Opens a small box with the definition. It closes when you move on, and Esc closes it; on the practice page Esc still sends STOP." ],
            [ "← and →", "Graph", "Move the readout to the previous or next point. Hold Shift to move ten points." ],
            [ "Home and End", "Graph", "Move the readout to the first or last point." ],
            [ "+ and −", "Graph", "Zoom in and out. Display only; calculated results do not change." ],
            [ "[ and ]", "Graph, when zoomed", "Move the view left or right." ],
            [ "Page Up and Page Down", "Graph, when zoomed", "Move the view up or down." ],
            [ "← and →, Home and End", "Tab lists on the protocol and Materials pages", "Move between tabs." ],
            [ "← → ↑ ↓, Home and End", "Materials chart", "Move between the materials showing: left and right by density, up and down by Young’s modulus; Home and End go to the first and last. The chart is one Tab stop." ],
            [ "Enter or Space", "Materials chart", "Choose the material that has focus." ],
            [ "↑ and ↓", "Material box on the Materials page", "Move through the materials that match what you typed." ],
            [ "Enter", "Material box on the Materials page", "Choose the highlighted material." ],
            [ "Esc", "Material box on the Materials page", "Close the list and keep the current material." ],
            [ "↑ and ↓", "Search box in the header", "Move through the results." ],
            [ "Enter", "Search box in the header", "Open the highlighted result." ],
            [ "Esc", "Leave pop-up", "Chooses Stay. It does not send STOP; use the STOP button in the pop-up while a test is recording." ],
            [ "Esc", "Search box in the header", "Close the search and return to the search button. On the practice page it closes the search only and does not send STOP." ]
          ]
        } }
      ]
    },

    /* The 37 numbered references are in data/references.js. */
    "helprefs-title": {
      heading: "References",  tab: "References",
      blocks: [
        { references: true }
      ]
    }

  }
};
