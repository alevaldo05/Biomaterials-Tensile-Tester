/* How the website talks to the tester's controller (DRAFT – the controller code is not written yet).
   Change these values to match the controller, not the other way around, once the hardware is final.
   The live test pages (live.js) read everything from here.

   Connection: USB serial (Web Serial; in this project, Chrome on a computer). Text lines ending in "\n".

   Controller -> website, one reading per line, comma separated, in this column order:
       time_ms,force_N,displacement_mm          example:  1250,12.84,0.625
     Other lines: "DONE" when the controller finishes a test on its own,
                  "ERR <message>" for a fault (recording stops), anything else is shown as a message.

   Website -> controller (commands; {name} is replaced with the value entered on the test page):
       START,UNIAXIAL,{speed}                   speed in mm/min
       START,RELAX,{speed},{hold_mm},{hold_s}   ramp at speed to hold_mm, hold for hold_s seconds
       STOP                                     stop the motor now
       TARE                                     zero the force reading
       PING                                     sent every second during a test; the controller should
                                                stop the motor if it stops receiving it (lost connection)

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
