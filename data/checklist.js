/* Pre-test checklist: the pop-up that appears when you press Start on the practice page, only if the
   "Pre-test checklist" option on the Settings page is On. The wording is the same as "Before you test" on
   the Learn page. It is a reminder, NOT a safety certification, and the wording is a draft for your
   advisor to review. Items with tissue: true are shown only for biological materials. Ticks are never
   saved. Plain text only. */
window.PRETEST_CHECKLIST = {
  title: 'Before you start',
  badge: 'Draft',
  note: 'Tick each item. This is a reminder, not a safety certification, and the on-screen STOP is not an emergency stop. Confirm the wording with your advisor.',
  groups: [
    { name: 'Specimen', items: [
      { text: 'Measure gauge length, width, and thickness; average several readings.' },
      { text: 'Mark the gauge length and note the specimen ID.' },
      { text: 'Keep tissue hydrated and note its orientation.', tissue: true },
      { text: 'Check the specimen for cuts or defects that could start a tear.' }
    ] },
    { name: 'Machine and safety', items: [
      { text: 'Check that the physical emergency stop works; the on-screen STOP is not one.' },
      { text: 'Use a load cell rated for the expected peak force.' },
      { text: 'Align the grips with the loading axis; press Tare with no load.' },
      { text: 'Wear gloves for tissue and eye protection for brittle materials.' }
    ] }
  ]
};
