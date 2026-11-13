/* Tutorials: short animated illustrations of the screen (tutorials.js draws them with SVG and CSS; no video, no outside files).
   DRAFT wording: the captions are short instructions naming the site's real buttons, for the owner to review.
   They are illustrations of the screen, NOT recordings of a real test, and say so.

   Each tutorial: id, page (the page it lives on) and where (words for the Help list), title, note (optional extra line, shown under the label), captions (2 to 4 short lines),
   boxes (the simplified screen), frames (the steps the pointer takes).
   The drawing area is 400 wide and 250 tall (under a header bar drawn for you, so start at y = 30); it is drawn about 1.6 times larger.
   The page marks where each one plays with <div class="tut-slot" data-tutorial="ID"></div> (in its HTML, or in live.js for the practice page).
   A box: id, kind, x, y, w, h, text (optional), and optional lists of frame numbers:
     in   frames where the box is drawn (leave out for every frame)       cur  frames where it is highlighted as the current one
   kind: panel, tab, btn, primary, stop, field, label, link, graph, zoombox, table
   A frame: { caption: which caption to emphasize (0 is the first), point: id of the box the pointer moves to,
              mark: [ids to highlight], set: { id: 'new text' } (stays for later frames) }.
   Frames play about 2.5 s each, so 4 frames make a loop of about 10 s. With reduced motion the frames are shown one at a
   time with Back and Next. Run node scripts/check-site.js after editing: it checks every id a frame names. */
/* The setup tutorials draw the real workspace: a Setup sidebar (the step bar 1 to 5, then the current step) beside the toolbar, the readings strip and the graph.
   sidebar(heading, curByStep) returns the sidebar boxes: its panel, the five step buttons (curByStep[i] lists the frames in which step i + 1 is the current one) and the step heading. */
(function () {
  function sidebar(heading, curByStep) {
    var b = [{ id: 'sb', kind: 'panel', x: 12, y: 34, w: 140, h: 210 }], i;
    for (i = 0; i < 5; i++) b.push({ id: 's' + (i + 1), kind: 'tab', x: 18 + i * 26, y: 40, w: 22, h: 18, text: String(i + 1), cur: curByStep[i] || [] });
    b.push({ id: 'hd', kind: 'label', x: 20, y: 66, w: 124, h: 14, text: heading });
    return b;
  }
  function all(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }

  window.TUTORIALS = {
  label: 'Illustration of the screen, not a recording of a real test.',
  list: [
    { id: 'run-simulated', page: 'practice.html', where: 'at the top of the practice page', title: 'Run a simulated test',
      captions: ['Fill in each setup step in the sidebar, typing your own values or using the Fill example links.', 'In the toolbar, choose Use simulator.', 'On Review and start, press Start recording.', 'Press End recording to stop saving readings (STOP tester sends the stop command; it is not an emergency stop). Then press Save data to download the CSV.'],
      boxes: sidebar('Dimensions', [[], [0], [], [1], [2, 3, 4]]).concat([
        { id: 'fill', kind: 'link', x: 20, y: 84, w: 124, h: 14, text: 'Fill example', in: [0] },
        { id: 'f1', kind: 'field', x: 20, y: 104, w: 124, h: 22, text: '', in: [0] }, { id: 'f2', kind: 'field', x: 20, y: 132, w: 124, h: 22, text: '', in: [0] }, { id: 'f3', kind: 'field', x: 20, y: 160, w: 124, h: 22, text: '', in: [0] },
        { id: 'hint', kind: 'label', x: 20, y: 90, w: 124, h: 14, text: 'Use simulator in the toolbar.', in: [1] },
        { id: 'chk', kind: 'label', x: 20, y: 90, w: 124, h: 14, text: 'Check the setup, then start.', in: [2, 3, 4] },
        { id: 'sim', kind: 'btn', x: 160, y: 34, w: 86, h: 24, text: 'Use simulator', in: [0, 1, 2, 3] },
        { id: 'tare', kind: 'btn', x: 252, y: 34, w: 34, h: 24, text: 'Tare', in: [0, 1, 2, 3] }, { id: 'start', kind: 'primary', x: 292, y: 34, w: 96, h: 24, text: 'Start recording', in: [0, 1, 2, 3] },
        { id: 'end', kind: 'btn', x: 160, y: 62, w: 92, h: 24, text: 'End recording', in: [0, 1, 2, 3] }, { id: 'stop', kind: 'stop', x: 258, y: 62, w: 76, h: 24, text: 'STOP tester', in: [0, 1, 2, 3] },
        { id: 'nes', kind: 'label', x: 160, y: 92, w: 180, h: 12, text: 'Not an emergency stop.', in: [0, 1, 2, 3] },
        { id: 'save', kind: 'btn', x: 160, y: 34, w: 84, h: 24, text: 'Save data', in: [4] }, { id: 'new', kind: 'primary', x: 250, y: 34, w: 70, h: 24, text: 'New test', in: [4] },
        { id: 'strip', kind: 'label', x: 160, y: 112, w: 228, h: 14, text: 'Force — N · Disp — mm · 0 s · Not connected' },
        { id: 'g', kind: 'graph', x: 160, y: 132, w: 228, h: 92, in: [3, 4] },
        { id: 'sn', kind: 'label', x: 160, y: 236, w: 228, h: 12, text: 'Simulated data, not measured', in: [2, 3, 4] }
      ]),
      frames: [
        { caption: 0, point: 'fill', mark: ['fill'], set: { f1: 'L0 10', f2: 'Width 5', f3: 'Thickness 1.5' } },
        { caption: 1, point: 'sim', mark: ['sim'], set: { hd: 'Connection', strip: 'Force — N · Disp — mm · 0 s · Not connected' } },
        { caption: 2, point: 'start', mark: ['start'], set: { hd: 'Review and start', strip: 'Force 0.00 N · Disp 0.00 mm · 0 s · Connected' } },
        { caption: 3, point: 'end', mark: ['end', 'stop'], set: { strip: 'Force 3.20 N · Disp 4.10 mm · 6 s · Recording' } },
        { caption: 3, point: 'save', mark: ['save'], set: { strip: 'Force 3.20 N · Disp 4.10 mm · 8 s · Test ended' } }] },

    { id: 'dimensions', page: 'practice.html', where: 'at the Dimensions step of the practice page', title: 'Enter specimen dimensions',
      captions: ['Type the gauge length L0 in mm.', 'Type the width and the thickness in mm.', 'The area A0 is calculated for you.', 'Press Next.'],
      boxes: sidebar('Dimensions', [[], all(4)]).concat([
        { id: 'l1', kind: 'label', x: 20, y: 82, w: 124, h: 12, text: 'Gauge length L0 (mm)' }, { id: 'f1', kind: 'field', x: 20, y: 96, w: 124, h: 22, text: '' },
        { id: 'l2', kind: 'label', x: 20, y: 124, w: 124, h: 12, text: 'Width (mm)' }, { id: 'f2', kind: 'field', x: 20, y: 138, w: 124, h: 22, text: '' },
        { id: 'l3', kind: 'label', x: 20, y: 166, w: 124, h: 12, text: 'Thickness (mm)' }, { id: 'f3', kind: 'field', x: 20, y: 180, w: 124, h: 22, text: '' },
        { id: 'area', kind: 'label', x: 20, y: 208, w: 124, h: 12, text: 'Area A0 (mm²): 7.5', in: [2, 3] },
        { id: 'back', kind: 'btn', x: 20, y: 220, w: 54, h: 20, text: 'Back' }, { id: 'next', kind: 'primary', x: 90, y: 220, w: 54, h: 20, text: 'Next' },
        { id: 'ws', kind: 'panel', x: 160, y: 34, w: 228, h: 210 }, { id: 'wst', kind: 'label', x: 170, y: 60, w: 208, h: 14, text: 'Toolbar, readings, and graph' }
      ]),
      frames: [{ caption: 0, point: 'f1', mark: ['f1'], set: { f1: '10' } }, { caption: 1, point: 'f3', mark: ['f2', 'f3'], set: { f2: '5', f3: '1.5' } }, { caption: 2, point: 'area', mark: ['area'] }, { caption: 3, point: 'next', mark: ['next'] }] },

    { id: 'graph-zoom', page: 'practice.html', where: 'under the graph on the practice page', title: 'Read and zoom the graph',
      captions: ['Click the graph, then use the left and right arrow keys to move the Readout along the curve. With key results shown, it snaps to one and names it.', 'Choose a view: Force-displacement, Stress-strain, or Force-time.', 'Press + to zoom in, Autoscale to fit the height, or Reset view to see the whole curve.', 'Press Expand graph to fill the window; its Close expanded graph button brings it back (Esc is not used).'],
      boxes: [
        { id: 'vw', kind: 'btn', x: 12, y: 34, w: 130, h: 22, text: 'View: Stress-strain' }, { id: 'au', kind: 'btn', x: 148, y: 34, w: 66, h: 22, text: 'Autoscale' },
        { id: 'zr', kind: 'btn', x: 220, y: 34, w: 72, h: 22, text: 'Reset view' }, { id: 'ex', kind: 'btn', x: 298, y: 34, w: 90, h: 22, text: 'Expand graph', in: [0, 1, 2] }, { id: 'ex2', kind: 'btn', x: 262, y: 34, w: 126, h: 22, text: 'Close expanded graph', in: [3] },
        { id: 'g', kind: 'graph', x: 12, y: 62, w: 376, h: 110 },
        { id: 'zp', kind: 'btn', x: 340, y: 66, w: 18, h: 18, text: '+' }, { id: 'zm', kind: 'btn', x: 362, y: 66, w: 18, h: 18, text: '−' },
        { id: 'zb', kind: 'zoombox', x: 120, y: 100, w: 90, h: 50, in: [2] },
        { id: 'rp', kind: 'panel', x: 12, y: 180, w: 376, h: 62 }, { id: 'rt', kind: 'label', x: 20, y: 198, w: 100, h: 14, text: 'Readout' },
        { id: 'r1', kind: 'label', x: 20, y: 218, w: 356, h: 12, text: 'Strain 0.054 · Stress 0.102 MPa' }
      ],
      frames: [{ caption: 0, point: 'g', mark: ['g', 'rp'], set: { r1: 'Strain 0.108 · Stress 0.241 MPa' } }, { caption: 1, point: 'vw', mark: ['vw'], set: { vw: 'View: Force-time' } }, { caption: 2, point: 'zp', mark: ['zp'] }, { caption: 2, point: 'au', mark: ['au', 'zr'] }, { caption: 3, point: 'ex2', mark: ['ex2'] }] },

    { id: 'download', page: 'practice.html', where: 'under the graph on the practice page', title: 'Download the data',
      captions: ['When the test has ended, the toolbar shows Save data and New test.', 'Press Save data to download the readings as a CSV file for Excel. PNG, SVG, and Print report are under the graph.', 'Open the file in Excel, or reopen it later with Load Test.'],
      boxes: [
        { id: 'save', kind: 'btn', x: 12, y: 34, w: 90, h: 24, text: 'Save data' }, { id: 'new', kind: 'primary', x: 108, y: 34, w: 70, h: 24, text: 'New test' },
        { id: 'g', kind: 'graph', x: 12, y: 64, w: 376, h: 90 },
        { id: 'png', kind: 'btn', x: 12, y: 162, w: 70, h: 24, text: 'PNG' }, { id: 'svg', kind: 'btn', x: 88, y: 162, w: 70, h: 24, text: 'SVG' }, { id: 'prt', kind: 'btn', x: 164, y: 162, w: 90, h: 24, text: 'Print report' },
        { id: 'lt', kind: 'link', x: 300, y: 168, w: 88, h: 14, text: 'Load Test', in: [2] },
        { id: 'kp', kind: 'panel', x: 12, y: 196, w: 180, h: 46 }, { id: 'kpt', kind: 'label', x: 20, y: 216, w: 164, h: 14, text: 'Key results' },
        { id: 'file', kind: 'panel', x: 200, y: 196, w: 188, h: 46, in: [1, 2] }, { id: 'ft', kind: 'label', x: 208, y: 224, w: 172, h: 14, text: 'uniaxial-tension.csv saved', in: [1, 2] }
      ],
      frames: [{ caption: 0, point: 'new', mark: ['save', 'new'] }, { caption: 1, point: 'save', mark: ['save', 'png', 'svg', 'prt', 'file'] }, { caption: 2, point: 'lt', mark: ['lt'] }] },

    { id: 'load-compare', page: 'load-test.html', where: 'on Load Test', title: 'Load and compare files',
      captions: ['In the File sidebar, choose Compare several files.', 'Press Choose CSV files and select up to 12 files of the same test type.', 'The overlay graph and a table with the mean and standard deviation appear.'],
      boxes: [
        { id: 'sb', kind: 'panel', x: 12, y: 34, w: 150, h: 210 }, { id: 'sbt', kind: 'label', x: 20, y: 54, w: 130, h: 14, text: 'File' },
        { id: 'm1', kind: 'btn', x: 20, y: 70, w: 134, h: 24, text: 'Open one file', in: [0, 1, 2] }, { id: 'm2', kind: 'btn', x: 20, y: 100, w: 134, h: 24, text: 'Compare several files', cur: [0, 1, 2] },
        { id: 'choose', kind: 'primary', x: 170, y: 34, w: 130, h: 26, text: 'Choose CSV files', in: [1, 2] }, { id: 'up', kind: 'label', x: 170, y: 76, w: 218, h: 12, text: 'Up to 12 files, one test type.', in: [1, 2] },
        { id: 'g', kind: 'graph', x: 170, y: 92, w: 218, h: 80, in: [2] },
        { id: 'tb', kind: 'table', x: 170, y: 180, w: 218, h: 62, text: 'Mean | SD', in: [2] }
      ],
      frames: [{ caption: 0, point: 'm2', mark: ['m2'] }, { caption: 1, point: 'choose', mark: ['choose'] }, { caption: 2, point: 'tb', mark: ['g', 'tb'] }] },

    { id: 'calibration', page: 'calibration.html', where: 'on Calibration, under Enter points', title: 'Enter a calibration',
      captions: ['For each known mass, type the mass and the force the tester reported.', 'The force from the mass is calculated for you (F = m g).', 'The fitted line, the errors, and the chart appear. Press Download calibration record (CSV) to keep the result.'],
      note: 'This page changes no reading on the tester.',
      boxes: [
        { id: 'h1', kind: 'label', x: 14, y: 38, w: 100, h: 12, text: 'Known mass (g)' }, { id: 'h2', kind: 'label', x: 124, y: 38, w: 100, h: 12, text: 'Force (N)' }, { id: 'h3', kind: 'label', x: 224, y: 38, w: 100, h: 12, text: 'Tester reading (N)' },
        { id: 'm1', kind: 'field', x: 12, y: 54, w: 100, h: 24, text: '' }, { id: 'F1', kind: 'label', x: 124, y: 70, w: 90, h: 12, text: '' }, { id: 'r1', kind: 'field', x: 222, y: 54, w: 100, h: 24, text: '' },
        { id: 'm2', kind: 'field', x: 12, y: 84, w: 100, h: 24, text: '' }, { id: 'F2', kind: 'label', x: 124, y: 100, w: 90, h: 12, text: '' }, { id: 'r2', kind: 'field', x: 222, y: 84, w: 100, h: 24, text: '' },
        { id: 'res', kind: 'panel', x: 12, y: 122, w: 250, h: 70, in: [2] }, { id: 'rt', kind: 'label', x: 22, y: 142, w: 230, h: 12, text: 'Gain, zero offset, errors, chart', in: [2] },
        { id: 'dl', kind: 'primary', x: 12, y: 204, w: 240, h: 26, text: 'Download calibration record (CSV)', in: [2] }
      ],
      frames: [{ caption: 0, point: 'r1', mark: ['m1', 'r1', 'm2', 'r2'], set: { m1: '200', r1: '2.05', m2: '500', r2: '4.99' } }, { caption: 1, point: 'F2', mark: ['F1', 'F2'], set: { F1: '1.96', F2: '4.90' } }, { caption: 2, point: 'dl', mark: ['res', 'dl'] }] }
  ]
};
})();
