/* The two ways the test page talks to a tester (window.LiveLinks): USB serial (Web Serial, Chrome only) and the labeled simulator.
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

    /* Simulator: behaves like the controller described in data/device.js (same commands, same reading
       lines), using the shape of the labeled sample curves. Everything it produces is marked simulated. */
    /* Steel samples densely at small strain (u * u) so its narrow elastic region gets enough points. */
    function SimLink(getSpec) { this.kind = 'sim'; this.getSpec = getSpec; this.offset = 0.04; this.pos = 0; this.clock = 0; this.job = null; this.idle = null; }
    function noise() { return Math.random() + Math.random() + Math.random() - 1.5; }
    function interp(X, Y, v) {
      if (v <= X[0]) return Y[0];
      if (v >= X[X.length - 1]) return null;
      var lo = 0, hi = X.length - 1;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (X[mid] <= v) lo = mid; else hi = mid; }
      return Y[lo] + (Y[hi] - Y[lo]) * (v - X[lo]) / (X[hi] - X[lo]);
    }
    function sampleCurve(t, mk) {
      var all = window.SAMPLE_DATA || [];
      return all.filter(function (r) { return r.test === t && r.material === mk; })[0] || all.filter(function (r) { return r.test === t; })[0];
    }
    SimLink.prototype.open = function () {
      var self = this;
      this.idle = setInterval(function () {
        if (!self.job) self.emit(self.clock, self.offset + 0.01 * noise(), self.pos);
        self.clock += 200;
      }, 200);
      return Promise.resolve();
    };
    SimLink.prototype.emit = function (tMs, F, d) {
      var cells = [], c = DEV.columns, sc = DEV.scale;
      cells[c.time] = String(Math.round(tMs / 1000 / sc.time * 1000) / 1000);
      cells[c.force] = (F / sc.force).toFixed(4);
      cells[c.displacement] = (d / sc.displacement).toFixed(5);
      if (this.onLine) this.onLine(cells.join(','));
    };
    SimLink.prototype.halt = function () { if (this.job) { clearInterval(this.job); this.job = null; } };
    SimLink.prototype.send = function (line) {
      var self = this, c = String(line).split(','), cmd = c[0].trim().toUpperCase();
      if (cmd === 'STOP') this.halt();
      else if (cmd === 'TARE') this.offset = 0;
      else if (cmd === 'START' && !this.job) {
        var s = this.getSpec(), A = s.W * s.T, k = 0, t0 = this.clock, v = (s.speed || 1) / 60;
        this.pos = 0;
        if (!isRelax) {
          var cu = sampleCurve('uniaxial', s.matKey), xEnd = cu.x[cu.x.length - 1] * 1.06, peak = Math.max.apply(null, cu.y) * A, N = 500;
          this.job = setInterval(function () {
            k++;
            var u = k / N, eps = xEnd * (s.matKey === 'steel' ? u * u : u), sgm = interp(cu.x, cu.y, eps), d = eps * s.L0;
            var F = (sgm === null ? 0 : sgm) * A + 0.001 * peak * noise() + self.offset;
            self.pos = d; self.clock = t0 + d / v * 1000;
            self.emit(self.clock, F, d);
            if (k >= N) { self.halt(); if (self.onLine) self.onLine(DEV.messages.done); }
          }, 40);
        } else {
          var cr = sampleCurve('relaxation', s.matKey), y0 = cr.y[0], e0 = s.hold_mm / s.L0;
          var s0 = y0 * e0 / cr.params.hold_strain, ramp = s.hold_mm / v, R = 60, Hn = 480;
          this.job = setInterval(function () {
            k++;
            var F, d, ts;
            if (k <= R) { var f = k / R; d = s.hold_mm * f; F = s0 * f * A; ts = ramp * f; }
            else {
              var u = (k - R) / Hn, th = s.hold_s * u * u, g = interp(cr.x, cr.y, th);
              d = s.hold_mm; F = s0 * (g === null ? cr.y[cr.y.length - 1] : g) / y0 * A; ts = ramp + th;
            }
            F += 0.001 * s0 * A * noise() + self.offset;
            self.pos = d; self.clock = t0 + ts * 1000;
            self.emit(self.clock, F, d);
            if (k >= R + Hn) { self.halt(); if (self.onLine) self.onLine(DEV.messages.done); }
          }, 40);
        }
      }
      return Promise.resolve();
    };
    SimLink.prototype.close = function () { this.halt(); clearInterval(this.idle); return Promise.resolve(); };

      return { SerialLink: SerialLink, SimLink: SimLink };
    }
  };
})();
