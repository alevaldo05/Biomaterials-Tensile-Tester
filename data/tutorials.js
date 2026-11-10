/* Tutorials: short animated illustrations of the screen (tutorials.js draws them with SVG and CSS; no video, no outside files).
   DRAFT wording: the captions are short instructions naming the site's real buttons, for the owner to review.
   They are illustrations of the screen, NOT recordings of a real test, and say so.

   Each tutorial: id, title, note (optional extra line, shown under the label), captions (2 to 4 short lines),
   boxes (the simplified screen), frames (the steps the pointer takes).
   The drawing area is 400 wide and 250 tall (under a header bar drawn for you, so start at y = 30).
   A box: id, kind, x, y, w, h, text (optional), and optional lists of frame numbers:
     in   frames where the box is drawn (leave out for every frame)       cur  frames where it is highlighted as the current one
   kind: panel, tab, btn, primary, stop, field, label, link, graph, zoombox, table
   A frame: { caption: which caption to emphasize (0 is the first), point: id of the box the pointer moves to,
              mark: [ids to highlight], set: { id: 'new text' } (stays for later frames) }.
   Frames play about 2.5 s each, so 4 frames make a loop of about 10 s. With reduced motion the frames are shown one at a
   time with Back and Next. Run node scripts/check-site.js after editing: it checks every id a frame names. */
window.TUTORIALS = {
  label: 'Illustration of the screen, not a recording of a real test.',
  list: [
    { id: 'run-simulated', title: 'Run a simulated test',
      captions: ['Fill in the dimensions and settings step by step, typing your own or using the Fill example links.', 'On Connection, choose Use simulator.', 'On Review and start, press Start test.', 'Press STOP when you want the test to end.'],
      boxes: [
        { id: 't1', kind: 'tab', x: 12, y: 32, w: 70, h: 22, text: 'Specimen', cur: [0] }, { id: 't2', kind: 'tab', x: 86, y: 32, w: 70, h: 22, text: 'Dimensions', cur: [0] },
        { id: 't3', kind: 'tab', x: 160, y: 32, w: 70, h: 22, text: 'Settings', cur: [0] }, { id: 't4', kind: 'tab', x: 234, y: 32, w: 70, h: 22, text: 'Connection', cur: [1] },
        { id: 't5', kind: 'tab', x: 308, y: 32, w: 80, h: 22, text: 'Review & start', cur: [2, 3] },
        { id: 'p', kind: 'panel', x: 12, y: 62, w: 376, h: 130 },
        { id: 'fill', kind: 'link', x: 24, y: 84, w: 110, h: 16, text: 'Fill example dimensions', in: [0] },
        { id: 'f1', kind: 'field', x: 24, y: 112, w: 100, h: 24, text: '10', in: [0] }, { id: 'f2', kind: 'field', x: 134, y: 112, w: 100, h: 24, text: '5', in: [0] }, { id: 'f3', kind: 'field', x: 244, y: 112, w: 100, h: 24, text: '1.5', in: [0] },
        { id: 'sim', kind: 'btn', x: 24, y: 90, w: 120, h: 26, text: 'Use simulator', in: [1] }, { id: 'usb', kind: 'btn', x: 154, y: 90, w: 150, h: 26, text: 'Connect to tester (USB)', in: [1] },
        { id: 'st', kind: 'label', x: 24, y: 140, w: 200, h: 16, text: 'Connected · simulator (not measured)', in: [2, 3] },
        { id: 'tare', kind: 'btn', x: 24, y: 90, w: 60, h: 26, text: 'Tare', in: [2, 3] }, { id: 'start', kind: 'primary', x: 92, y: 90, w: 100, h: 26, text: 'Start test', in: [2, 3] },
        { id: 'stop', kind: 'stop', x: 200, y: 90, w: 170, h: 26, text: 'STOP', in: [2, 3] },
        { id: 'g', kind: 'graph', x: 12, y: 200, w: 376, h: 44, in: [3] },
        { id: 'sn', kind: 'label', x: 20, y: 236, w: 200, h: 12, text: 'Simulated data, not measured', in: [3] }
      ],
      frames: [{ caption: 0, point: 'fill', mark: ['fill'] }, { caption: 1, point: 'sim', mark: ['sim'] }, { caption: 2, point: 'start', mark: ['start'] }, { caption: 3, point: 'stop', mark: ['stop'] }] },

    { id: 'dimensions', title: 'Enter specimen dimensions',
      captions: ['Type the gauge length L0 in mm.', 'Type the width and the thickness in mm.', 'The area A0 is calculated for you.', 'Press Next.'],
      boxes: [
        { id: 't1', kind: 'tab', x: 12, y: 32, w: 70, h: 22, text: 'Specimen' }, { id: 't2', kind: 'tab', x: 86, y: 32, w: 70, h: 22, text: 'Dimensions', cur: [0, 1, 2, 3] },
        { id: 't3', kind: 'tab', x: 160, y: 32, w: 70, h: 22, text: 'Settings' }, { id: 't4', kind: 'tab', x: 234, y: 32, w: 70, h: 22, text: 'Connection' }, { id: 't5', kind: 'tab', x: 308, y: 32, w: 80, h: 22, text: 'Review & start' },
        { id: 'p', kind: 'panel', x: 12, y: 62, w: 376, h: 150 },
        { id: 'l1', kind: 'label', x: 24, y: 80, w: 100, h: 12, text: 'Gauge length L0 (mm)' }, { id: 'f1', kind: 'field', x: 24, y: 86, w: 110, h: 26, text: '' },
        { id: 'l2', kind: 'label', x: 146, y: 80, w: 100, h: 12, text: 'Width (mm)' }, { id: 'f2', kind: 'field', x: 146, y: 86, w: 110, h: 26, text: '' },
        { id: 'l3', kind: 'label', x: 268, y: 80, w: 100, h: 12, text: 'Thickness (mm)' }, { id: 'f3', kind: 'field', x: 268, y: 86, w: 110, h: 26, text: '' },
        { id: 'area', kind: 'label', x: 24, y: 138, w: 200, h: 16, text: 'Area A0 (mm2): 7.5', in: [2, 3] },
        { id: 'next', kind: 'primary', x: 308, y: 178, w: 70, h: 26, text: 'Next' }
      ],
      frames: [{ caption: 0, point: 'f1', mark: ['f1'], set: { f1: '10' } }, { caption: 1, point: 'f3', mark: ['f2', 'f3'], set: { f2: '5', f3: '1.5' } }, { caption: 2, point: 'area', mark: ['area'] }, { caption: 3, point: 'next', mark: ['next'] }] },

    { id: 'connect-usb', title: 'Connect over USB', note: 'The hardware connection is untested.',
      captions: ['Use Chrome on a computer; USB does not work in Safari.', 'On Connection, press Connect to tester (USB) and choose the port in the browser’s box.', 'The status line changes to Connected.'],
      boxes: [
        { id: 't4', kind: 'tab', x: 234, y: 32, w: 70, h: 22, text: 'Connection', cur: [0, 1, 2] }, { id: 't1', kind: 'tab', x: 12, y: 32, w: 70, h: 22, text: 'Specimen' }, { id: 't2', kind: 'tab', x: 86, y: 32, w: 70, h: 22, text: 'Dimensions' }, { id: 't3', kind: 'tab', x: 160, y: 32, w: 70, h: 22, text: 'Settings' }, { id: 't5', kind: 'tab', x: 308, y: 32, w: 80, h: 22, text: 'Review & start' },
        { id: 'p', kind: 'panel', x: 12, y: 62, w: 376, h: 100 },
        { id: 'chrome', kind: 'label', x: 24, y: 80, w: 200, h: 14, text: 'Chrome on a computer', in: [0] },
        { id: 'usb', kind: 'btn', x: 24, y: 100, w: 160, h: 26, text: 'Connect to tester (USB)', in: [0, 1] },
        { id: 'perm', kind: 'panel', x: 200, y: 84, w: 180, h: 70, in: [1] }, { id: 'permt', kind: 'label', x: 210, y: 100, w: 160, h: 14, text: 'Choose a port to connect', in: [1] }, { id: 'permb', kind: 'btn', x: 300, y: 124, w: 70, h: 24, text: 'Connect', in: [1] },
        { id: 'st', kind: 'label', x: 24, y: 110, w: 260, h: 16, text: 'Connected · tester (USB)', in: [2] }
      ],
      frames: [{ caption: 0, point: 'chrome', mark: ['chrome'] }, { caption: 1, point: 'permb', mark: ['usb', 'permb'] }, { caption: 2, point: 'st', mark: ['st'] }] },

    { id: 'graph-zoom', title: 'Read and zoom the graph',
      captions: ['Click the graph, then use the left and right arrow keys to move the Readout along the curve.', 'Press + to zoom in.', 'Press the reset icon to see the whole curve again.'],
      boxes: [
        { id: 'g', kind: 'graph', x: 12, y: 34, w: 250, h: 170 },
        { id: 'zb', kind: 'zoombox', x: 110, y: 90, w: 70, h: 60, in: [1] },
        { id: 'zp', kind: 'btn', x: 222, y: 40, w: 18, h: 18, text: '+' }, { id: 'zm', kind: 'btn', x: 242, y: 40, w: 18, h: 18, text: '−' }, { id: 'zr', kind: 'btn', x: 202, y: 40, w: 18, h: 18, text: '↺' },
        { id: 'rp', kind: 'panel', x: 272, y: 34, w: 116, h: 170 }, { id: 'rt', kind: 'label', x: 280, y: 52, w: 100, h: 14, text: 'Readout' },
        { id: 'r1', kind: 'label', x: 280, y: 76, w: 100, h: 12, text: 'Strain  0.054' }, { id: 'r2', kind: 'label', x: 280, y: 94, w: 100, h: 12, text: 'Stress  0.102 MPa' }
      ],
      frames: [{ caption: 0, point: 'g', mark: ['g', 'rp'], set: { r1: 'Strain  0.108' } }, { caption: 1, point: 'zp', mark: ['zp'] }, { caption: 2, point: 'zr', mark: ['zr'] }] },

    { id: 'download', title: 'Download the data',
      captions: ['When the test has stopped, the download buttons appear.', 'Press Download data (CSV for Excel) to save the readings.', 'Open the file in Excel, or reopen it later with Load Test.'],
      boxes: [
        { id: 'g', kind: 'graph', x: 12, y: 34, w: 376, h: 100 },
        { id: 'csv', kind: 'btn', x: 12, y: 150, w: 130, h: 26, text: 'Download data (CSV)', in: [0, 1, 2] }, { id: 'png', kind: 'btn', x: 148, y: 150, w: 70, h: 26, text: 'PNG', in: [0, 1, 2] },
        { id: 'svg', kind: 'btn', x: 224, y: 150, w: 70, h: 26, text: 'SVG', in: [0, 1, 2] }, { id: 'prt', kind: 'btn', x: 300, y: 150, w: 88, h: 26, text: 'Print report', in: [0, 1, 2] },
        { id: 'file', kind: 'panel', x: 12, y: 190, w: 250, h: 40, in: [1, 2] }, { id: 'ft', kind: 'label', x: 22, y: 214, w: 230, h: 14, text: 'uniaxial-tension_test.csv saved', in: [1, 2] },
        { id: 'lt', kind: 'link', x: 280, y: 204, w: 100, h: 14, text: 'Load Test', in: [2] }
      ],
      frames: [{ caption: 0, point: 'png', mark: ['csv', 'png', 'svg', 'prt'] }, { caption: 1, point: 'csv', mark: ['csv', 'file'] }, { caption: 2, point: 'lt', mark: ['lt'] }] },

    { id: 'load-compare', title: 'Load and compare files',
      captions: ['On Load Test, choose Compare several files.', 'Press Choose CSV files and select up to 12 files of the same test type.', 'The overlay graph and a table with the mean and standard deviation appear.'],
      boxes: [
        { id: 'm1', kind: 'btn', x: 12, y: 34, w: 110, h: 24, text: 'Open one file', in: [0, 1, 2] }, { id: 'm2', kind: 'btn', x: 128, y: 34, w: 160, h: 24, text: 'Compare several files', cur: [0, 1, 2] },
        { id: 'choose', kind: 'primary', x: 12, y: 74, w: 130, h: 26, text: 'Choose CSV files', in: [1, 2] }, { id: 'up', kind: 'label', x: 150, y: 92, w: 220, h: 12, text: 'Up to 12 files of the same test type.', in: [1, 2] },
        { id: 'g', kind: 'graph', x: 12, y: 112, w: 190, h: 120, in: [2] },
        { id: 'tb', kind: 'table', x: 212, y: 112, w: 176, h: 120, text: 'Mean | SD', in: [2] }
      ],
      frames: [{ caption: 0, point: 'm2', mark: ['m2'] }, { caption: 1, point: 'choose', mark: ['choose'] }, { caption: 2, point: 'tb', mark: ['g', 'tb'] }] },

    { id: 'calibration', title: 'Enter a calibration',
      captions: ['For each known mass, type the mass and the force the tester reported.', 'The force from the mass is calculated for you (F = m g).', 'The fitted line, the errors, and the chart appear. Press Download calibration record (CSV) to keep the result.'],
      note: 'This page changes no reading on the tester.',
      boxes: [
        { id: 'h1', kind: 'label', x: 14, y: 46, w: 100, h: 12, text: 'Known mass (g)' }, { id: 'h2', kind: 'label', x: 124, y: 46, w: 100, h: 12, text: 'Force (N)' }, { id: 'h3', kind: 'label', x: 224, y: 46, w: 100, h: 12, text: 'Tester reading (N)' },
        { id: 'm1', kind: 'field', x: 12, y: 54, w: 100, h: 24, text: '' }, { id: 'F1', kind: 'label', x: 124, y: 70, w: 90, h: 12, text: '' }, { id: 'r1', kind: 'field', x: 222, y: 54, w: 100, h: 24, text: '' },
        { id: 'm2', kind: 'field', x: 12, y: 84, w: 100, h: 24, text: '' }, { id: 'F2', kind: 'label', x: 124, y: 100, w: 90, h: 12, text: '' }, { id: 'r2', kind: 'field', x: 222, y: 84, w: 100, h: 24, text: '' },
        { id: 'res', kind: 'panel', x: 12, y: 122, w: 250, h: 70, in: [2] }, { id: 'rt', kind: 'label', x: 22, y: 142, w: 230, h: 12, text: 'Gain, zero offset, errors, chart', in: [2] },
        { id: 'dl', kind: 'primary', x: 12, y: 204, w: 240, h: 26, text: 'Download calibration record (CSV)', in: [2] }
      ],
      frames: [{ caption: 0, point: 'r1', mark: ['m1', 'r1', 'm2', 'r2'], set: { m1: '200', r1: '2.05', m2: '500', r2: '4.99' } }, { caption: 1, point: 'F2', mark: ['F1', 'F2'], set: { F1: '1.96', F2: '4.90' } }, { caption: 2, point: 'dl', mark: ['res', 'dl'] }] }
  ]
};
