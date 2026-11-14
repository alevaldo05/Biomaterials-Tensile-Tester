Status: planned. Nothing in this guide has been built or tried on hardware.

# Guide: a Raspberry Pi Pico backend

This guide is for someone who wants to build an acquisition device on a Raspberry Pi Pico (RP2040) or Pico 2 (RP2350) that speaks the same protocol as the ESP32 reference firmware. The app then needs no change. The protocol is in [PROTOCOL.md](PROTOCOL.md). The app design is in [ARCHITECTURE.md](ARCHITECTURE.md). What exists today is in [FEATURE-STATUS.md](FEATURE-STATUS.md). General setup steps are in [SETUP.md](SETUP.md).

## What this is and is not

- It is a second implementation of protocol v1. It is different firmware. The ESP32 binary does not run on a Pico, and no one should claim that one firmware image runs on both.
- It only reads an ADC and sends raw counts. It does not move, start, stop, or tare the machine, and it has no message that could.
- It does not replace the reviewed interface circuit between the tester and the ADC. The tester's analog output pins, signal scaling, grounding, and control protocol are unverified. This guide does not state them. Do not connect the tester until the circuit and pinout have been reviewed.

## Choose a firmware route

| Route | Good | Watch for |
|---|---|---|
| Arduino-Pico core (earlephilhower) with PlatformIO | Closest to the ESP32 reference code. Familiar `Wire` and `Serial`. Smallest port. | Arduino layers add some timing jitter. Check the core's PlatformIO support for your exact board. |
| Pico SDK in C | Most control over timing and USB. Fewest hidden delays. | More work. You write the I²C and USB serial code yourself. |
| MicroPython or CircuitPython | Quick to try. | Slowest. JSON text building and garbage collection can cause pauses. Not suitable if the achieved rate must be steady. |

Suggested order: try the Arduino-Pico core first. Move to the SDK only if measured timing is not good enough.

Whatever route you pick, measure the achieved rate and the timestamp spacing on the bench. Do not assume them.

## USB: does the board present a serial port?

- The Pico and Pico 2 connect their USB socket straight to the chip. The chip can act as a USB CDC serial device. The browser sees a serial port.
- Some third-party RP2040 boards with a USB-C socket do the same. Others route USB through a USB-to-UART chip, or use the socket only for power.
- "Has USB-C" does not prove the board presents a serial port. Check the board's documentation, or plug it in and see whether the computer lists a serial port.
- Over native USB CDC, the baud setting is ignored. The app asks for 921600 (the ESP32 reference rate); that does no harm here.
- The app never accepts a USB name or vendor/product ID as proof of what a device is. Only the `hello` message counts.

## Wiring notes

- The ADS1115 talks over I²C. Which Pico pins you use is your choice from the board's I²C-capable pins. Put the choice in `board_config.h` and check it against the board's pinout. This guide does not pick pins.
- Pico GPIO is 3.3 V and is not 5 V tolerant. Run the I²C lines at 3.3 V.
- I²C needs pull-up resistors on SDA and SCL. Many ADS1115 breakout boards already have them. Check the board, and do not stack so many pull-ups in parallel that the combined value is too low.
- Power the ADS1115 so that its supply and the Pico's logic level are compatible. The ADC's allowed input voltage depends on its supply and its datasheet. A wider programmable range does not allow a higher voltage on the pins.
- A voltage divider or a differential input is not isolation. The connection to the tester needs a reviewed interface circuit.

## What to port from the ESP32 reference

The reference lives in `firmware/esp32-ads1115/`. It may still be changing. Check the names below in the folder before you start.

| ESP32 reference file | Pico work |
|---|---|
| `firmware/common/protocol.*` | Reuse unchanged. It is plain C++ with no Arduino calls, so it should compile on the Pico. |
| `firmware/common/ads1115_driver.*` | Unchanged. The register code stays; the Pico supplies its own I²C bus class in its `main.cpp`. |
| `include/board_config.h` | New file for the Pico: I²C pins, I²C speed, ADC address, serial settings. |
| `src/main.cpp` | Rewrite the loop for the Pico. Keep the same order of work. |
| Timing source | Use `time_us_64()` for the microsecond timestamp. Report `time_unit` as `us`. |

Keep these rules from the protocol:

- Send raw ADC counts only. No volts, newtons, or millimetres.
- Read channels one after another. Each sample has its own timestamp.
- `seq` goes up by 1 for every sample sent since the stream started.
- Make a new `boot_id` on every start. Make a new `settings_ref` whenever any setting changes, and never reuse one.
- Send `status` with `achieved_sps` measured from the timestamps.
- Lines are at most 2048 characters. Each ends with a newline.
- Use `device_type` `pico` (free text). Give each board its own `device_id`.

## Requests the firmware accepts

Exactly six, each with an `id`: `identify`, `get_channels`, `get_settings`, `set_settings`, `start_stream`, `stop_stream`.

- `start_stream` and `stop_stream` only start and stop the sending of samples.
- Any other request gets an `error` with code `unknown_request`.
- A request with a wrong shape gets `bad_request`. A request with another `v` gets `unsupported_version`.
- Do not add any other request type, not even for testing.

## Checklist before use

All of these must pass on the bench, with no tester connected. Use a test source such as a battery-and-divider fixture or the ADC inputs tied to a known voltage, after review.

1. `identify` returns `hello` with a `device_id` that is unique to this board.
2. Power-cycle the board. The next `hello` has a different `boot_id`.
3. `get_channels` returns a `channels` message that passes the app's check.
4. `get_settings` and `set_settings` return a `settings` message that passes the check. A changed value gives a new `settings_ref`.
5. While streaming, every `sample` carries `raw` as an integer count, its own `t`, the current `ref`, and a `seq` that goes up by 1.
6. Force and displacement samples are separate lines. None claims the same instant.
7. The achieved rate reported in `status` matches the rate you work out from the timestamps.
8. Unplug the ADC. The device sends a `fault` (`adc_not_responding`) and does not invent samples.
9. An unknown request gets `unknown_request`.
10. Nothing other than the six requests is accepted.
11. Run the app against the board and confirm there are no skipped lines or gaps in a long stream.

## After the checks: calibration

A different board changes the signal path. The app does not reuse a calibration record automatically. It checks the device type, ADC, range, input, and conditioning circuit, and if any part differs, it waits for review.

Before real use:

1. Record the new board, its pin choices, and the circuit in the device profile.
2. Review or redo the calibration in the app for this signal path.
3. Until then, values are shown in volts and labeled uncalibrated, and stress and strain are not calculated.

## Open questions

- Which exact Pico boards will be used, and do they present native USB serial.
- Whether the Arduino-Pico route meets the timing the lab needs.
- The interface circuit between the tester and the ADC. It is not designed or reviewed.
