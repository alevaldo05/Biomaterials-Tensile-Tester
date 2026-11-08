/* Records script errors on check-text.html. A mistake in a text file (a missing quote or comma) stops that
   file from loading. Catch it here so the checker can say which file and which line. Must load before the text files. */
window.__textErrors = [];
window.addEventListener('error', function (e) { window.__textErrors.push({ file: e.filename || '', line: e.lineno, message: e.message }); });
