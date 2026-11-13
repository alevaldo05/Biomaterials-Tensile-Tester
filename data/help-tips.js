/* Settings for the "Need help?" button and the hints that appear by themselves (help-coach.js).
   Times are in milliseconds. Change them here. The website has no USB connection, so there are no hints for USB permission, a port in use,
   or a connection with no readings (those Troubleshooting rows were removed with the website's test pages).
   Each problem names the row of the Troubleshooting table (data/text/help.js) whose wording the hint shows: "match" is
   the start of that row's Problem text; "title" (optional) replaces the row's Problem text as the hint's heading. The hint says what could be wrong and what to do next, never that the device
   was diagnosed. Nothing here is written to the browser. scripts/check-site.js tests that every match finds a row. */
window.HELP_TIPS = {
  stuckMs: 60000,        /* stay on one step or page this long with no activity: a hint with that step's help */
  fieldErrorMs: 8000,    /* a field message that is still there after this long */
  troubleshooting: { href: 'help.html#trouble-title', label: 'Open Help > Troubleshooting' },
  problems: {
    csv:          { match: 'A CSV file cannot be opened' },
    field:        { match: 'A message beside a field' }
  }
};
