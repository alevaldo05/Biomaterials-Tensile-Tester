/* The two records to fill in on the bench, as forms: the first-connection bench record (docs/app/SETUP.md) and the
   Windows first-install checklist (docs/app/WINDOWS-APP.md). The rows here are the same words as in those files; a
   test fails if they drift apart. Pure: no screen code. The filled-in record is downloaded or printed by the person;
   the app sends it nowhere. */

export interface Sheet {
  id: 'bench' | 'windows';
  title: string;
  intro: string;
  /** Lines at the top (who, when, what). */
  header: string[];
  /** The numbered checks. */
  checks: string[];
  after: string;
}

export const SHEETS: Sheet[] = [
  {
    id: 'bench',
    title: 'First connection: bench record',
    intro: 'The first time a board is connected to the app. The tester stays disconnected. Use a bench voltage source kept inside the ADS1115’s allowed input range, and read it with a reference meter. This records what happened; it does not say what is right.',
    header: [
      'Date, person',
      'Board, ADS1115 module, firmware commit',
      'Windows and app versions (`Help` / installer name)',
      'Bench source and meter used (names, not settings from the tester)',
      'Who reviewed the wiring before power-up, and when',
    ],
    checks: [
      'Board powers up; the app lists its USB serial port; Connect works',
      'The device identifies itself (`hello`): type, protocol version, boot id shown in the app',
      'Channels and settings shown match the firmware\'s `board_config.h`',
      'Status bar shows Device connected, Data arriving; sample rate seen vs. requested',
      'With the source at a fixed, metered value: the volts shown vs. the meter reading (write both numbers)',
      'Two or three other metered values inside the range (write each pair); note any difference that grows with the value',
      'Recording 1 minute: sample count, gaps or repeated numbers reported by the app',
      'Unplug the USB cable during a recording: what the app shows; what is saved on this computer; what Recover offers',
      'Plug back in and connect again: the app reconnects only after you press Connect; boot id changes',
      'Software baseline taken: the app says it is not a calibration or a tare',
      'Calibration check with known weights is **not** done here (no force sensor on the bench)',
      'Read force: with no calibration the app shows volts only',
    ],
    after: 'Copy anything that failed into docs/app/FEATURE-STATUS.md, and keep this record with the lab’s records. Connecting the tester is a separate step that needs the verified pinout and a reviewed circuit (docs/app/TESTER-INTERFACE.md).',
  },
  {
    id: 'windows',
    title: 'Windows app: first install checklist',
    intro: 'On the Windows computer, after downloading the installer from the release. Write Pass, Fail, or a note for each row; leave a row blank if it was not tried.',
    header: ['Date, person', 'Computer and Windows version', 'Release (tag) and file names'],
    checks: [
      'The downloaded installer\'s hash matches `SHA256SUMS.txt` (`certutil -hashfile <file> SHA256`)',
      'SmartScreen warns; "More info" then "Run anyway" starts the installer',
      'Installs and starts; the window opens on the app\'s own Home screen',
      'Settings saves a lab server address and the status bar shows it; with the box empty it says "Lab server: Not set up"',
      'Connect lists the USB serial ports and lets you choose one; nothing is sent to a tester',
      'A recording makes one `.meta.json` and one `.lines.ndjson` file in the app\'s data folder (`recordings`)',
      'A second copy of the app does not start while one is running',
      'Help opens and is searchable with the network off',
      'Uninstalling removes the program; note whether the data folder stays',
      'The portable `.exe`\'s hash matches `SHA256SUMS.txt` (untried)',
      'SmartScreen warns for the portable `.exe`; "More info" then "Run anyway" starts it without installing (untried)',
      'The portable program opens on the app\'s own Home screen; note where its data folder is and whether recordings are kept after closing it (untried)',
      'Help ends with "Version 1.0.0-beta.1 · built from … · shared website files …"; the hash matches `node scripts/shared-files.js` for the commit it was built from (installer and portable)',
    ],
    after: 'Write any failure into docs/app/FEATURE-STATUS.md.',
  },
];

export interface Entries { header: string[]; checks: string[] }
export const emptyEntries = (s: Sheet): Entries => ({ header: s.header.map(() => ''), checks: s.checks.map(() => '') });

/** Plain words for screens and files: the docs' `code` and **bold** marks removed. */
export const plain = (t: string): string => t.replace(/\*\*/g, '').replace(/`/g, '');

/** The filled-in record as CSV (opens in Excel). Every cell is quoted; a cell starting with = + - @ gets an apostrophe. */
export function recordCsv(s: Sheet, e: Entries, versionLine: string, now: Date): string {
  const cell = (t: string) => { const v = /^[=+\-@]/.test(t) ? "'" + t : t; return '"' + v.replace(/"/g, '""') + '"'; };
  const rows: string[][] = [[s.title], ['Saved', now.toISOString()], ['App', versionLine], []];
  s.header.forEach((h, i) => rows.push([plain(h), e.header[i] ?? '']));
  rows.push([], ['#', 'Check', 'Result / notes']);
  s.checks.forEach((c, i) => rows.push([String(i + 1), plain(c), e.checks[i] ?? '']));
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** How many checks have an entry. */
export const filled = (e: Entries): number => e.checks.filter((t) => t.trim() !== '').length;
