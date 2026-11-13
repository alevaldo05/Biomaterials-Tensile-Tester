/* How the practice page talks to its simulated tester (window.LiveLinks).
   The website has no USB (Web Serial) connection and no other link to a real tester: real tests are run in the separate tester app.
   The only link here is the labeled simulator, which is in live-sim.js (loaded by the practice page only).
   Every link offers open(), send(line), close(), onLine, and onClose, so live.js treats it like any other connection.
   The line format the simulator emits is in data/device.js. live.js creates the link with LiveLinks.create(DEVICE, isRelax). */
(function () {
  'use strict';
  window.LiveLinks = {
    create: function (DEV, isRelax) {
      /* The simulator is in live-sim.js and is loaded only by the practice page. */
      var SimLink = window.LiveSim ? window.LiveSim.create(DEV, isRelax).SimLink : null;
      return { SimLink: SimLink };
    }
  };
})();
