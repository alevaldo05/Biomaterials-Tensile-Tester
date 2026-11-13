# Setup: from the acquisition board to a recorded test

Status: draft. The reference firmware's code has been compiled and tested on a computer with a pretend ADS1115. It has **not** been run on an ESP32, the ADS1115 wiring has not been tried, and nothing has been connected to the tensile tester.

The measurement path this project plans is:

verified machine analog outputs → reviewed conditioning and protection circuit → ADS1115 ADC → ESP32 → USB serial → Windows computer → the app in Chrome.

The tester's own controller moves the crosshead. The app and the firmware only read.

## What is not known, and must be verified before connecting the tester

- Which connector and pins on the tester carry an analog output, and what each one means.
- The signal range and scaling of each output (a nominal 0–5 V is mentioned in the project documents; that does not say which pins carry it or whether a given circuit is compatible).
- How the tester's signal ground relates to the computer's ground and the board's ground.
- Any computer-control protocol. The app has no machine control and sends nothing to the tester.

Nothing in this repository assumes any of these. Do not connect the tester until the interface circuit and the pinout have been reviewed.

## Electrical restrictions

- **ADC input limits.** The ADS1115's allowed input voltage on every analog pin is set by its supply voltage and its datasheet (the absolute maximum is a little beyond the supply rails). Exceeding it can damage the ADC and the board.
- **A wider range is not permission for a higher voltage.** The programmable full-scale setting (for example ±6.144 V) only sets what the ADC can measure. It never allows a pin voltage above the supply limits. With a 3.3 V supply, the usable input is limited by the 3.3 V supply even on the ±6.144 V setting.
- **I²C logic levels and pull-ups.** The ESP32's pins are 3.3 V and are not 5 V tolerant. Power the ADS1115 so its I²C levels match, and check that SDA and SCL have pull-up resistors to 3.3 V (many breakout boards already have them; several boards in parallel can make the combined pull-up too strong).
- **Not isolation.** A voltage divider, a differential input, or a buffer does not isolate the computer from the tester. If the tester's outputs are not referenced to a safe, known ground, an isolation stage is needed. That belongs in the reviewed interface circuit.
- **Reviewed interface circuit.** Connection to the tester requires a circuit (protection, scaling, and isolation as needed) that has been designed against the verified pinout and reviewed in the laboratory.

## Where each thing is configured

| What | Where | Notes |
|---|---|---|
| I²C pins (SDA, SCL), I²C speed | `firmware/esp32-ads1115/include/board_config.h` | Example values for an ESP32 DevKit (GPIO 21 and 22). Check your board. |
| ADS1115 address | `board_config.h` | Set by the ADS1115's ADDR pin: 0x48 (GND), 0x49 (VDD), 0x4A (SDA), 0x4B (SCL). |
| Which input carries which signal; single-ended or differential | `board_config.h` (`TT_CHANNELS`) | The force/displacement assignment there is an example. Use `"voltage"` for an input that is not assigned. |
| Serial speed | `board_config.h` (`TT_SERIAL_BAUD`) and `apps/tester/src/real.ts` (`SERIAL_BAUD`) | Both 921600. They must match. |
| Starting range and conversion rate | `board_config.h` | The app can change both in its Device step, within what the ADS1115 supports. |
| USB driver | Windows | Many ESP32 boards use a CP210x or CH340 USB-to-serial chip. Windows usually installs its driver; if no COM port appears, install the chip maker's driver. Boards with native USB need none. |
| Conditioning circuit (gain and offset between the tester output and the ADC input) | The device profile in the app's setup file | Describes the reviewed circuit. A changed circuit needs a new profile. |
| Calibration (volts at the tester output → N or mm) | Calibration records in the app's setup file | Made on real equipment. Without one, the app shows volts only and calculates no force, stress, or strain. |

## Build and upload the reference firmware

On a computer with PlatformIO installed (`pip install platformio`, or the PlatformIO extension for VS Code):

```bash
cd firmware/esp32-ads1115
```

```bash
pio run -e esp32dev
```

```bash
pio run -e esp32dev -t upload
```

The first build downloads the ESP32 toolchain from the PlatformIO registry. (In the cloud session used to write this, that download was blocked, so the ESP32 build itself has not been run yet.)

To build and test the firmware's portable code on a computer, with a pretend ADS1115 (needs a C++ compiler):

```bash
bash firmware/esp32-ads1115/test/host/build-and-test.sh
```

`npm test` also runs the app's connection and recorder against this host build (`packages/recording/test/firmware.test.ts`).

## Throughput

A sample line is about 110 characters. At the default 128 conversions per second that is about 14,000 characters per second, more than 115200 baud carries (about 11,500), which is why the reference uses 921600 baud. At the ADS1115's fastest setting (860 per second) even 921600 baud is close to its limit: the firmware then drops samples it cannot send, counts them, and keeps numbering them, so the app records exactly where the gap is. The real rate is also lower than the setting, because each single-shot conversion includes the time to start it and read it; the app shows the rate actually achieved.

## Connecting in the app

1. Plug the board in. In Chrome, open the app and choose **Real acquisition**.
2. **Connection:** press Connect and pick the port in the browser's own box. The app never opens a port by itself. When an ESP32 board opens, it may restart and print a few unreadable start-up lines; the app skips them and counts them.
3. **Device:** the app asks the board who it is (the `hello` reply) and checks the protocol version, the channels, and the settings. A USB name alone is not accepted.
4. **Calibration:** load the setup file (device profile and calibration records). A calibration is used only if the whole signal path matches the one it was made with (device type, ADC, range, input, conditioning circuit). After any change to the hardware or the signal path, the calibration has to be reviewed; it is never carried over because a new board uses the same channel names.
5. Without calibration you can still record voltages only (tick "Record voltages only"); such a session never shows force, stress, or strain.
6. Enter the specimen and dimensions, press **Start recording**, then start the test on the tester's own controller.

## Problems and what they mean

| The app says | Usually means |
|---|---|
| The browser was not allowed to use the port | Choose the port again and allow access. |
| The port is already in use | Another program (a serial monitor, another tab) has it open. Close it. |
| The port could not be opened | Cable, power, or a missing USB driver for the board's USB chip. |
| The device did not identify itself | Wrong port, a board without this firmware, or a different serial speed. |
| Incompatible protocol | The firmware and the app speak different protocol versions. Update one of them. |
| The ADC is not responding | Check the ADS1115's power, the SDA/SCL wiring and pull-ups, and the address in `board_config.h`. |
| A channel is missing | `TT_CHANNELS` in `board_config.h` does not include a force and a displacement channel. |

## Other boards

- Raspberry Pi Pico: [GUIDE-pico.md](GUIDE-pico.md).
- Raspberry Pi computer running a service: [GUIDE-raspberry-pi-service.md](GUIDE-raspberry-pi-service.md).

The protocol is described in [PROTOCOL.md](PROTOCOL.md).
