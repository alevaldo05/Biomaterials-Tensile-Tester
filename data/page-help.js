/* What the "Need help?" card says on the reading pages (Home, Learn, Protocols, Materials, About, Help).
   Edit only the words between the quotation marks. Each page has a title and a few short lines: what the page is for
   and where to go next. The card also links to Help > Troubleshooting. Draft wording for the owner's review.
   The practice page, Load Test, and Calibration set their own help for each step (help-coach.js). Nothing is saved. */
window.PAGE_HELP = {
  'index.html': {
    title: 'Getting started',
    lines: [
      'Tests on the tester are run in the tester app on the lab computer. Get the app explains where to find it; the download is not yet available.',
      'To learn the steps first, open Learn and practice: it has the checklist for before you test and a practice page with a labeled simulator.',
      'To reopen a CSV file saved earlier, use Load Test (in the Learn page and the menu).'
    ]
  },
  'learn.html': {
    title: 'Learn',
    lines: [
      'Before you test is a checklist to go through before each test. It is a reminder, not a safety certification.',
      'Practice with a simulated test opens the practice page. Everything it shows is simulated data, not measured.',
      'Background explains why tensile testing matters for skin, and the Glossary defines the terms used on this website.'
    ]
  },
  'protocol-uniaxial-tension.html': {
    title: 'Uniaxial tension protocol',
    lines: [
      'The Steps tab lists the procedure in order; use "Jump to step" to go straight to one. The protocol is a draft.',
      'Specimen and equipment, and Report and notes, cover what to prepare and what to record.',
      'The example graph uses sample data, not measured data. The hardware connection is untested.'
    ]
  },
  'protocol-stress-relaxation.html': {
    title: 'Stress relaxation protocol',
    lines: [
      'The Steps tab lists the procedure in order; use "Jump to step" to go straight to one. The protocol is a draft.',
      'Specimen and equipment, and Report and notes, cover what to prepare and what to record.',
      'The example graph uses sample data, not measured data. The hardware connection is untested.'
    ]
  },
  'materials.html': {
    title: 'Materials',
    lines: [
      'Type in the Material box to narrow the list, then choose a material to see its typical properties and an example graph.',
      'The values are typical, approximate ranges marked "Typical, unreviewed". They are not measured.',
      'Example curves are sample data, not measured.'
    ]
  },
  'about.html': {
    title: 'About',
    lines: [
      'This page explains tensile testing, the project status, and where to read more.',
      'The tester hardware and its connection are untested.'
    ]
  },
  'help.html': {
    title: 'Help',
    lines: [
      'Troubleshooting lists common problems and what to do. Tutorials link to short illustrations on the pages where you do each task.',
      'Keyboard lists only the keys that work. Use the search button in the menu to find any page or section.'
    ]
  }
};
