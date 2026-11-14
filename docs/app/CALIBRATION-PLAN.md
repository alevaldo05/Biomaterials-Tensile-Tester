# Calibration plan: force and displacement

Status: draft plan, for the owner's and a qualified reviewer's review. This is not a traceable calibration. The acceptance tolerance is set by the owner or advisor. Results go into calibration records in the app's setup file. The app's calibration helper (planned) fits slope and offset; until then, the force fit can be done on the website's Calibration page.

## 1. Before any calibration

- The interface circuit has been reviewed ([TESTER-INTERFACE.md](TESTER-INTERFACE.md)).
- The device-profile values (gain and offset per channel) are recorded.
- The system has warmed up for a time the owner sets (to find out).
- Record the temperature.
- The app shows volts when there is no calibration; record those volts.

## 2. Force with known masses

1. Hang a fixture or hanger in the grips. Hang only within the tester's and the load cell's rated capacity (both unknown: find out first).
2. Record the reading with only the empty hanger as the zero point. Do not use the app's Zero force during a calibration: the fit finds the offset, and a software baseline is not a calibration. (If the hanger's own mass is known, include it in each load.)
3. Use at least 5 loads across the expected test range, plus zero.
4. Load up, then unload through the same points, to see hysteresis.
5. Do 3 repeats.
6. Record volts and mass for each point. Force is F = m·g; state the local g used. Record mass certificates if there are any.
7. Fit a line: slope (N/V) and offset (N).
8. Look at the residuals and at the up/down difference.
9. Accept or reject against the owner's tolerance.

## 3. Displacement with calipers or gauge blocks

1. Move the crosshead to positions using the tester's own controls.
2. Measure the gap with calipers, or stack gauge blocks between the fixtures. Never let the crosshead push against blocks under power.
3. Use at least 5 positions across the range, in both directions (to see backlash), with 3 repeats.
4. Record volts and mm for each point.
5. Fit slope (mm/V) and offset (mm). Check linearity.

## 4. Alternatives

| Method | Pros | Cons |
|---|---|---|
| Calibrated reference load cell or proving ring in series | Better traceability | Needs the equipment |
| The tester's own force and position readout, if its accuracy is documented | Quick check | Not independent |
| Dial indicator or LVDT for displacement | Finer resolution | Needs mounting; extra equipment |
| Two-point check before each test session | Fast drift check | Not a full calibration |
| A professional calibration service | Traceable certificate | Cost and time; the tester may need to travel |

## 5. Records

| Date | Channel | Points | Slope | Offset | Max residual | By whom | Equipment |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
| | | | | | | | |

Recalibrate:
- after any wiring, circuit, or gain change (the app refuses a calibration made with a different signal path);
- periodically, at an interval the owner sets.
