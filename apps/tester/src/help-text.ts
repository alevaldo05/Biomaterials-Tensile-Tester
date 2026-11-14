/* The app's help, one entry per screen and part of the Test screen’s quick settings, kept here so it is available offline and edited in one place.
   Each entry says what the screen is for, what to do next, unfamiliar terms, common problems, and when to get help
   from a technician or the laboratory. Links go to the learning website. */

export interface HelpTopic {
  title: string;
  what: string;
  next: string[];
  terms?: [string, string][];
  problems?: [string, string][];
  assistance?: string;
  links?: { label: string; page: string }[];
}

const TECH = 'Ask a technician or the laboratory before connecting anything to the tester, or if the tester behaves unexpectedly. This app does not move or stop the machine.';

export const HELP: Record<string, HelpTopic> = {
  home: {
    title: 'Home',
    what: 'The starting point: begin a new test, open a recorded one, or check the device. The status bar shows each part separately: the device, the data, calibration, recording, saving on this computer, and the lab server.',
    next: ['New test to record a specimen.', 'Load test to open a recorded test.', 'Device and calibration before the first test of the day.'],
    terms: [['Interrupted recording', 'A recording that did not finish (for example the app closed). What was saved before that point can be recovered; nothing after it.']],
    problems: [['A recovery notice appears', 'Open the recording to see what was saved, or download its session file. Then mark it handled.']],
    links: [{ label: 'Help and troubleshooting on the website', page: 'help.html' }],
  },
  'test.test': {
    title: 'Test',
    what: 'The Test screen is one window: the quick settings on the left (on a narrow window, open them with Setup), the graph in the middle, and the live readings or key results on the right. Here you choose the test type and, if you have one, a saved method. A method fills in the usual settings; the specimen’s own details stay blank.',
    next: ['Pick Uniaxial tension or Stress relaxation.', 'Type the material and the speed you will set on the tester.', 'Work down the quick settings: Specimen, Connection, Setup file and calibration, then Before you start.'],
    terms: [['Crosshead speed', 'The speed you set on the tester’s own controller. The app writes it into the record; it does not set it.'], ['Offset yield', 'Optional. Where the curve crosses the fitted line moved right by the offset; an estimate.']],
    links: [{ label: 'Uniaxial tension protocol', page: 'protocol-uniaxial-tension.html' }, { label: 'Stress relaxation protocol', page: 'protocol-stress-relaxation.html' }],
  },
  'test.dimensions': {
    title: 'Specimen',
    what: 'Stress is force divided by the cross-section (width × thickness) and strain is stretch divided by the gauge length, so these numbers are needed for stress and strain.',
    next: ['Measure and type the gauge length, width, and thickness in millimetres.', 'Leave a field empty rather than guessing.', 'Temperature, environment, and notes are under More details. Notes can still be changed after the test.'],
    terms: [['Gauge length, L₀', 'The length of specimen between the grips at the start.']],
    links: [{ label: 'Glossary', page: 'learn.html#gloss-title' }],
  },
  'test.connection': {
    title: 'Connect and identify',
    what: 'Connect the acquisition device over USB. You choose the port yourself; the app then asks the device who it is, and only shows it as identified after it answers.',
    next: ['Press Connect and choose the controller’s port.', 'Check the device, channels, and achieved rate under Device details.'],
    problems: [
      ['Permission denied', 'Choose the port again and allow access.'],
      ['Port in use', 'Close other programs or windows using the port (for example a serial monitor).'],
      ['No identification', 'Wrong port, different firmware, or a missing USB driver for the board.'],
      ['Incompatible protocol', 'Update the app or the device firmware so the versions match.'],
      ['ADC not responding', 'Check the ADC power, wiring, and address. ' + TECH],
    ],
    assistance: TECH,
  },
  'test.calibration': {
    title: 'Channels and calibration',
    what: 'A calibration turns volts into newtons and millimetres. It is used only if the whole signal path matches the one it was made with. Without one, readings stay in volts.',
    next: ['Load the setup for this tester (from the lab server or a setup file).', 'If a channel says it needs review, ask whoever looks after calibration.'],
    terms: [['Zero force (software baseline)', 'A force offset taken in the app and subtracted in results; the original readings are kept. It is not a machine tare and not a calibration, and nothing is sent to the tester.'], ['Machine tare', 'Zeroing on the tester itself. Separate from this app.']],
    assistance: 'Calibrations are made and approved by the laboratory. Do not reuse one after a change to the board, ADC, conditioning circuit, or machine range.',
  },
  'test.review': {
    title: 'Before you start',
    what: 'A check of every part of the quick settings. Start recording stays unavailable, with the reason shown under it, until everything needed is ready. Ready to record means the app can save calibrated readings; it says nothing about whether the machine is ready to move.',
    next: ['Press Zero force if you want a software baseline (optional).', 'Press Start recording under the graph.', 'Then start the test on the tester’s own controller.', 'Press End recording when the test is over.'],
    assistance: TECH,
  },
  'test.recording': {
    title: 'Recording',
    what: 'Samples are being saved, in memory and on this computer about once a second. The quick settings are locked and folded to a slim rail. End recording only stops saving; it does not stop the machine.',
    next: ['Stop the machine with its own controls.', 'Press End recording when done.'],
    problems: [['Stale data', 'No readings for 2 seconds: check the USB cable and the device.'], ['Save error', 'The recording continues in memory; download the data as soon as it ends.']],
    assistance: TECH,
  },
  'test.done': {
    title: 'Results',
    what: 'The graph and key results of the test just recorded. Press the "i" beside a result to see what it is and its caveats. Strain is crosshead-based unless stated otherwise. The Specimens list at the bottom shows the tests finished since the app was opened.',
    next: ['Save data: CSV, Excel, graph pictures, the session file, or a Draft printed report (save it as a PDF from the print window).', 'Save to the lab server when signed in.', 'New test for the next specimen.'],
    links: [{ label: 'What a tensile test measures', page: 'about.html#measures-title' }],
  },
  load: {
    title: 'Load test',
    what: 'Open a recorded test: a session file saved by this app, or a CSV file. Opening a file never sends anything to a device.',
    next: ['Choose a file, or pick a recent test.', 'Export the opened test, or press Print report and save it as a PDF from the print window. The report is marked Draft and is not saved by the app.', 'To compare specimens, choose Compare tests and add up to 12 tests of one test type: the curves are overlaid, and the key results are listed with the mean and sample standard deviation.'],
    terms: [['Sample standard deviation', 'The spread of the values, divided by n − 1. It needs at least two values; a dash means it is not available.']],
    problems: [['File marked as simulated', 'The app opens recorded tests only; practice files open on the website’s Load Test page.'], ['No dimensions', 'Stress and strain need the specimen dimensions stored in the file.'], ['Cannot add a test to a comparison', 'A comparison holds one test type and at most 12 tests. Start a new comparison with Clear all for another test type.']],
  },
  methods: {
    title: 'Test methods',
    what: 'Saved setups to start a test from. Changing a method makes a new revision; tests keep the revision they used.',
    next: ['Save the current setup as a method from the Test screen.', 'Start a new test from a method here.'],
  },
  history: {
    title: 'History',
    what: 'Tests saved on the lab server. You see your own; an admin sees everyone’s.',
    next: ['Download a session file, or open it in Load test.'],
  },
  device: {
    title: 'Device and calibration',
    what: 'The connection to the acquisition device and the calibration in use, with a summary you can copy when asking for help.',
    next: ['Connect, then load the setup for this tester.', 'Check the calibration with known weights: type each mass and the force shown (or press Read force), then download or print the check.', 'Copy the diagnostic summary if something is wrong.'],
    terms: [['Calibration check', 'Compares the force the app shows with the force expected from known weights (F = m g). It changes no reading and no calibration, saves nothing, and makes no claim of traceability. A software baseline or a tare is not a calibration.']],
    assistance: TECH,
  },
  settings: {
    title: 'Settings',
    what: 'Display choices, what is stored on this computer, and (in the Windows app) the lab server address.',
    next: ['Change the theme.', 'Remove recordings you have already downloaded or saved to the lab server.', 'In the Windows app: type the lab server address (for example http://lab-pc:8080) and save it, then sign in from the top of the screen.'],
    problems: [['Lab server: Not set up', 'No address has been saved in this Windows app. Ask the lab for the address.'], ['Lab server: Not connected', 'The address is saved but the lab server does not answer from this computer. Check the address and the network; recording still works.']],
  },
  admin: {
    title: 'Admin',
    what: 'People, device profiles, calibrations, and the record of changes. Only admins see this.',
    next: ['Approve a calibration only after it has been checked.'],
  },
  help: {
    title: 'Help',
    what: 'All the help in the app, searchable. More background is on the website.',
    next: ['Type a word to search.'],
  },
};

/** The help topic for a screen and, on the Test screen, the part of the quick settings in use, or the phase. */
export function helpFor(page: string, sub?: string): HelpTopic {
  return HELP[sub ? page + '.' + sub : page] ?? HELP[page] ?? (HELP.home as HelpTopic);
}

export function searchHelp(q: string): { key: string; topic: HelpTopic }[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return Object.entries(HELP).filter(([, t]) => {
    const hay = [t.title, t.what, ...t.next, ...(t.terms ?? []).flat(), ...(t.problems ?? []).flat(), t.assistance ?? ''].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  }).map(([key, topic]) => ({ key, topic }));
}
