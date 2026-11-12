/* How the test page talks to a tester (window.LiveLinks): USB serial (Web Serial, Chrome only). The labeled simulator is in live-sim.js and only the practice page loads it.
   Every link offers open(), send(line), close(), onLine, and onClose. The message format is in data/device.js.
   Pure move from live.js; live.js creates them with LiveLinks.create(DEVICE, isRelax). */
(function () {
  'use strict';
  window.LiveLinks = {
    create: function (DEV, isRelax) {
    /* ---------- connections ---------- */
    /* USB serial (Web Serial). Every connection type offers: open(), send(line), close(), onLine, onClose.
       A Wi-Fi connection can be added later with the same five members. */
    function SerialLink() { this.kind = 'usb'; this.port = null; this.reader = null; this.closing = false; this.queue = Promise.resolve(); }
    SerialLink.prototype.open = function () {
      var self = this;
      return navigator.serial.requestPort().then(function (port) {
        self.port = port;
        return port.open({ baudRate: DEV.baudRate });
      }).then(function () { self.loop = self.readLoop(); });
    };
    SerialLink.prototype.readLoop = async function () {
      var dec = new TextDecoder(), buf = '';
      while (this.port.readable && !this.closing) {
        this.reader = this.port.readable.getReader();
        var done = false;
        try {
          for (;;) {
            var res = await this.reader.read();
            if (res.done) { done = true; break; }
            buf += dec.decode(res.value, { stream: true });
            var parts = buf.split(/\r?\n|\r/);
            buf = parts.pop();
            for (var i = 0; i < parts.length; i++) if (this.onLine) this.onLine(parts[i]);
          }
        } catch (e) {
          /* Errors such as a framing error are not fatal; a lost device leaves port.readable empty. */
        } finally {
          try { this.reader.releaseLock(); } catch (e2) { /* already released */ }
          this.reader = null;
        }
        if (done) break;
      }
      if (!this.closing && this.onClose) this.onClose('The USB connection was lost.');
    };
    SerialLink.prototype.send = function (line) {
      var self = this;
      var p = this.queue.then(async function () {
        var w = self.port.writable.getWriter();
        try { await w.write(new TextEncoder().encode(line + DEV.lineEnding)); } finally { w.releaseLock(); }
      });
      this.queue = p.catch(function () {});
      return p;
    };
    SerialLink.prototype.close = async function () {
      this.closing = true;
      try { if (this.reader) await this.reader.cancel(); } catch (e) { /* ignore */ }
      try { await this.loop; } catch (e) { /* ignore */ }
      try { await this.queue; } catch (e) { /* ignore */ }
      try { await this.port.close(); } catch (e) { /* ignore */ }
    };

    /* The simulator is in live-sim.js and is loaded only by the practice page; the real test pages have none. */
    var SimLink = window.LiveSim ? window.LiveSim.create(DEV, isRelax).SimLink : null;

      return { SerialLink: SerialLink, SimLink: SimLink };
    }
  };
})();
