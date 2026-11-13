/* The line format of the practice page's SIMULATOR (live-sim.js, read by live.js). It serves only the simulator.
   It is NOT the protocol of the tester app: the app's protocol is in docs/app/PROTOCOL.md. The website has no USB (Web Serial)
   connection and never talks to a real tester; real tests are run in the tester app. The values below are kept as they were
   (a draft guess made before the app existed), because the simulator emits and parses exactly this format.
   packages/core/reference reads this file too, so do not change the values without checking that.

   Text lines ending in "\n".

   Simulator -> page, one reading per line, comma separated, in this column order:
       time_ms,force_N,displacement_mm          example:  1250,12.84,0.625
     Other lines: "DONE" when the simulated test finishes on its own,
                  "ERR <message>" for a fault (recording stops), anything else is shown as a message.

   Page -> simulator (commands; {name} is replaced with the value entered on the practice page):
       START,UNIAXIAL,{speed}                   speed in mm/min
       START,RELAX,{speed},{hold_mm},{hold_s}   ramp at speed to hold_mm, hold for hold_s seconds
       STOP                                     stop the simulated run now
       TARE                                     zero the force reading
       PING                                     no longer sent: the page has no heartbeat, because the simulator needs none
                                                (kept here only so the values below stay as they were)

   SAFETY: the on-screen STOP button is not an emergency stop. The machine needs its own physical
   emergency-stop button that cuts motor power even if the computer, browser, or cable fails. */
window.DEVICE = {
  status: 'draft',
  baudRate: 115200,
  lineEnding: '\n',
  columns: { time: 0, force: 1, displacement: 2 },   /* position of each value in a reading line */
  scale: { time: 0.001, force: 1, displacement: 1 },  /* multiply to get s, N, mm (time arrives in ms) */
  messages: { done: 'DONE', errorPrefix: 'ERR' },
  commands: {
    startUniaxial: 'START,UNIAXIAL,{speed}',
    startRelaxation: 'START,RELAX,{speed},{hold_mm},{hold_s}',
    stop: 'STOP',
    tare: 'TARE',
    heartbeat: 'PING'
  },
  heartbeatMs: 1000,
  /* Auto-stop at break (uniaxial): after the force has reached at least minPeakForce_N, stop when it
     falls below dropFraction x peak force. */
  breakDetect: { minPeakForce_N: 1, dropFraction: 0.5 },
  maxPoints: 200000
};
