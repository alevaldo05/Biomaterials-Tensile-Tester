# Breadboard test: ESP32 + ADS1115 connected to a computer

Status: draft. Written from the reference firmware's settings (`firmware/esp32-ads1115/include/board_config.h`) and the ADS1115 and ESP32 DevKit conventions. **Nothing here has been built or tried on real parts.** Check every pin and label against your own boards before wiring.

This sheet has everything needed to draw a schematic and wire a first bench test. The test connects the board to the computer only. **The tensile tester is not connected.** Its analog output pins, signal scaling, grounding, and control protocol are unverified, and this sheet does not describe them (see [SETUP.md](SETUP.md), "What is not known").

## 1. What the test proves, and what it does not

It can show:
- the board powers up, the computer lists a serial port, and the app connects and the board identifies itself;
- the ADS1115 answers on the I²C bus;
- a known voltage (from a potentiometer, read with a meter) appears in the app as about the same number of volts;
- recording, saving, and recovery work with a real device.

It does not show anything about the tester, a force or displacement sensor, a calibration, or a safe interface circuit. The app shows **volts only** in this test; nothing is converted to force, stress, or strain.

## 2. Parts

| Part | Notes |
|---|---|
| ESP32 DevKit-style board (the reference build is `esp32dev`) | Check that the USB socket gives a serial port. Many boards use a CP210x or CH340 chip, so Windows may need that chip's driver. |
| ADS1115 breakout board (16-bit I²C ADC) | Pins are usually labelled VDD, GND, SCL, SDA, ADDR, ALERT, A0, A1, A2, A3. |
| Breadboard and jumper wires | Short wires for SDA and SCL. |
| 10 kΩ potentiometer (linear) | The bench voltage source. Any value from 1 kΩ to 100 kΩ works; 10 kΩ is a common choice. |
| USB cable that carries data | Some cables are charge-only. |
| Multimeter | The reference reading. A reading you trust more than the app's. |
| Two 4.7 kΩ resistors (only if needed) | Pull-ups for SDA and SCL, only if your ADS1115 breakout has none. Many have them. |

Not needed: the tester, any sensor, a power supply other than USB.

## 3. Wiring (nets)

Power both boards from the ESP32's **3.3 V** pin. The ESP32's I²C pins are 3.3 V and are not 5 V tolerant, so do not power the ADS1115 from 5 V in this setup.

| Net | ESP32 DevKit | ADS1115 breakout | Other |
|---|---|---|---|
| 3V3 | 3V3 pin | VDD | potentiometer end 1; pull-up resistors (if used) |
| GND | any GND pin | GND | potentiometer end 2; ADDR; A1, A2, A3 (see below); meter black lead |
| SDA | GPIO 21 | SDA | pull-up to 3V3 (only if needed) |
| SCL | GPIO 22 | SCL | pull-up to 3V3 (only if needed) |
| ADDR | (none) | ADDR → GND | sets I²C address 0x48 |
| Input A0 | (none) | A0 | potentiometer wiper (middle pin); meter red lead |
| Unused inputs | (none) | A1, A2, A3 → GND | stops floating inputs reading noise |
| ALERT | (none) | leave unconnected | the firmware does not use it |
| USB | USB socket | (none) | to the computer |

The values GPIO 21 (SDA), GPIO 22 (SCL), address 0x48, and 400 kHz come from `board_config.h` and are **examples**. They are common ESP32 DevKit defaults, but your board's labels decide. If you wire different pins, change `TT_I2C_SDA_PIN` and `TT_I2C_SCL_PIN` in `board_config.h` and rebuild.

Why this keeps the ADS1115 safe: the potentiometer is fed from 3V3, so the wiper can never go above 3.3 V. The ADS1115's input pins must stay between GND and VDD (about 0.3 V beyond is the absolute limit), and its full-scale setting (±4.096 V by default) only sets what it can measure; it does not allow a higher input. Never connect anything to A0 to A3 that can exceed the supply.

## 4. Schematic (text drawing)

```
  Computer ---- USB cable ----> [ ESP32 DevKit ]
                                   |  3V3  |  GND  | GPIO21 | GPIO22
                                   |       |       |  (SDA) |  (SCL)
   3V3 net  ------------------------+       |       |        |
   GND net  --------------------------------+       |        |
   SDA net  -----------------------------------------+        |
   SCL net  ----------------------------------------------------+

  [ ADS1115 breakout ]            connects to the nets above
     VDD  ........ 3V3 net
     GND  ........ GND net
     SDA  ........ SDA net
     SCL  ........ SCL net
     ADDR ........ GND net            (I2C address 0x48)
     A0   ........ potentiometer wiper
     A1, A2, A3 .. GND net            (unused inputs, tied low)
     ALERT ....... not connected

  [ 10k potentiometer ]
     end 1 ........ 3V3 net
     end 2 ........ GND net
     wiper ........ ADS1115 A0   (and the meter's red lead)

  Optional, only if the ADS1115 breakout has no pull-up resistors:
     4.7k between SDA net and 3V3 net, and 4.7k between SCL net and 3V3 net
```

Meter: red lead on the wiper (A0), black lead on GND. Read the wiper voltage while you turn the potentiometer.

## 5. Breadboard layout notes

- Put the ESP32 and the ADS1115 on the board with the I²C wires as short as you can.
- Use the two power rails: one for 3V3, one for GND. Connect the ESP32's 3V3 and GND to the rails first, with the USB unplugged.
- Wire with the USB cable **unplugged**; plug it in only after checking the wiring against the table above.
- A potentiometer has three pins: the outer two go to 3V3 and GND, the middle one (wiper) goes to A0.
- Double-check that no wire joins 3V3 and GND.

## 6. Information for drawing it in a tool

For KiCad, Fritzing, or a hand drawing, these are the facts:

| Item | Value |
|---|---|
| Parts | ESP32 DevKit (generic), ADS1115 breakout, 10 kΩ potentiometer, optional 2 × 4.7 kΩ |
| Supply | 3.3 V from the ESP32's 3V3 pin, USB powered |
| I²C bus | SDA = GPIO 21, SCL = GPIO 22, 400 kHz, ADS1115 address 0x48 (ADDR to GND) |
| Serial | USB serial to the computer, 921600 baud (matches `TT_SERIAL_BAUD` and `apps/tester/src/real.ts`) |
| ADC input | A0 single-ended against GND, from the potentiometer wiper |
| Unused | A1, A2, A3 to GND; ALERT unconnected |
| Default ADC settings | ±4.096 V full scale, 128 samples per second (changeable in the app's Device step) |

Channel names in the reference firmware: `force` on A0 and `displacement` on A1. In this bench test they are just two inputs; the first reading is the potentiometer, the second is 0 V (A1 tied to GND). The assignment in `board_config.h` is an example. If you prefer, change the second channel's quantity to `"voltage"` so the app does not label it displacement.

## 7. Before you plug in

1. Wiring matches section 3 (read it aloud against the board).
2. No wire joins 3V3 and GND; the wiper is on A0, not on 3V3.
3. The ADS1115 is powered from 3V3, not 5 V.
4. The firmware is built and uploaded (below).

## 8. Build and upload the firmware

On a computer with PlatformIO (`pip install platformio`, or the VS Code extension):

```bash
cd firmware/esp32-ads1115
```

```bash
pio run -e esp32dev -t upload
```

Some boards need the BOOT button held while the upload starts. The build was compiled on GitHub (compile only); it has never run on a board. If it does not upload, note the message.

## 9. Test steps

Fill in the bench record in [SETUP.md](SETUP.md) ("First connection: bench record") as you go.

1. Plug in USB. A COM port should appear (Windows: Device Manager, Ports). If none appears, install the USB chip's driver or try another cable.
2. Open the tester app (the Windows app, or `npm run app` in Chrome on `localhost`).
3. Connect: press **Connect** and choose the port. The app never opens a port by itself.
4. Check that the device identifies itself (Device step: device type, protocol version, boot id, channels).
5. With no calibration loaded, choose **Record voltages only**.
6. Turn the potentiometer to three or four positions. For each, write the meter's voltage and the app's volts for the first channel.
7. Record for one minute. Note the sample count and any gaps the app reports.
8. Unplug the USB cable during a recording; note what the app shows and what recovery offers. Plug in and connect again.

Expected: the app's volts are close to the meter's for the first channel (a small difference is normal; write both numbers) and about 0 V for the second channel. If the second channel is not near 0 V, A1 is floating or wired wrongly.

## 10. If something is wrong

| Symptom | Likely cause to check |
|---|---|
| No serial port | Charge-only cable, missing USB chip driver, wrong board |
| Port opens, no identification | Firmware not uploaded; baud mismatch (921600 both sides) |
| Device found, no samples or error from the ADC | SDA and SCL swapped or on other pins than `board_config.h`; no pull-ups; ADDR not tied to GND; ADS1115 not powered |
| Readings jump around | A0 or unused inputs floating; loose breadboard wire; long I²C wires |
| Reading stuck at one end | Wiper not on A0, or ends of the potentiometer not on 3V3 and GND |
| Reading clips near 3.3 V | The input is at the supply limit; that is the expected maximum with a 3.3 V supply |

## 11. What not to do

- Do not connect the tensile tester, its controller, or any sensor of unknown output to the ADS1115 inputs. Its pins, scaling, and grounding are unverified, and a connection needs a reviewed interface circuit.
- Do not put more than the supply voltage (3.3 V) on any ADS1115 input. A higher full-scale setting does not make that safe.
- Do not power the ADS1115 from 5 V while it shares I²C wires with the ESP32's 3.3 V pins.
- Do not treat a software baseline in the app as a calibration. This test has none, and the app should show volts only.

## 12. Record

Keep the completed bench record sheet and a photo of the wiring with the date. Add any failure to `docs/app/FEATURE-STATUS.md`.
