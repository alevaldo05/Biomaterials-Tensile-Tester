Status: planned. Nothing in this guide has been built or tried on hardware.

# Guide: a Raspberry Pi service as the acquisition device

This guide is for someone who wants a Raspberry Pi computer (for example a Pi 4 or Pi 5) to read an ADS1115 over I²C and expose protocol v1. The protocol is in [PROTOCOL.md](PROTOCOL.md). The app design is in [ARCHITECTURE.md](ARCHITECTURE.md). What exists today is in [FEATURE-STATUS.md](FEATURE-STATUS.md). General setup steps are in [SETUP.md](SETUP.md).

## What this is and is not

- It is a program that reads an ADC and sends raw counts. It does not move, start, stop, or tare the machine, and it has no message that could.
- The tester's analog output pins, signal scaling, grounding, and control protocol are unverified. This guide does not state them. Do not connect the tester until an interface circuit and the pinout have been reviewed.
- The app can already be told that a source is a Raspberry Pi service. Today that is only the simulator. No real service exists.

## A Pi is not a USB serial device by default

A Pi is a Linux computer. Plugging it into the Windows computer does not make a serial port appear. Only some models can act as a USB device, using gadget mode, and only on a specific port.

| Model | Gadget mode |
|---|---|
| Pi Zero, Zero 2 W | Yes, on the data USB port (not the power-only port). |
| Pi 4 | Yes, through the USB-C port, which is also the power input. Powering it then needs care. |
| Pi 5 | Not assumed. The USB-C port is mainly for power. Check current documentation and test before relying on it. |
| Older full-size models | Do not assume. |

Check the model's current documentation. Do not assume a port works as a gadget port.

## Three ways to connect

### a) USB gadget serial (preferred if the model supports it)

- The Pi presents a serial port (Linux `g_serial`, or a configfs ACM function). The Windows computer sees a serial port.
- The existing Web Serial transport works unchanged. The service reads and writes lines on the gadget device, usually `/dev/ttyGS0`.
- Status: planned, untested. Windows driver behavior for the gadget has not been checked.

### b) Network service (WebSocket) on the lab network

- Status: planned. Not built. It needs a new transport in `packages/acquisition/src/transports/`, next to the existing `web-serial.ts`. The Transport interface in `packages/acquisition/src/types.ts` only moves bytes, so a WebSocket transport fits it. The adapter and everything above it stay the same.
- Mixed content: a page served over HTTPS cannot open a plain `ws://` connection to another host. Options are TLS (`wss://`) with a certificate the browser trusts, or serving the app from the same machine so the connection is to localhost.
- Authentication: the service must require it. Anyone on the network could otherwise read the data or change the settings. Keep the six-request limit as well.
- Firewall: allow the port only from the lab network. Do not open it to the internet.
- A hosted website, for example one on GitHub Pages, cannot and should not reach a lab device. The network option is for an app served inside the lab.
- The person still picks the connection in the app. The app never connects by itself.

### c) The Pi runs the whole app locally in Chromium

- Status: planned, untested. The service and the app run on the same Pi. The connection is to localhost, which avoids the mixed-content problem.
- The Pi also needs to be set up as a kiosk or a normal desktop. Its performance with the app has not been checked.
- Files saved by the app stay on the Pi unless moved.

## Service design

- Language: Python (for example `smbus2`, or the Adafruit ADS1x15 library) or C. Python is easier to build. C gives steadier timing. Ask before adding any library to the project.
- Put the protocol code in its own module. Build each message and check each incoming line against the rules in PROTOCOL.md.
- Read the channels one after another, in the order given by `channel_order`. One sample is one conversion of one channel.
- Timestamps: use a monotonic clock, in microseconds. Report `time_unit` as `us`. Do not use the wall clock, because it can jump.
- Send raw counts only. Do not convert to volts, newtons, or millimetres.
- `seq` goes up by 1 for every sample sent since the stream started.
- Make a new `boot_id` every time the service starts. Make a new `settings_ref` when any setting changes, and never reuse one.
- Use `device_type` `raspberry-pi-service` (free text). Give each Pi its own `device_id`.
- Lines are at most 2048 characters, each ending with a newline.
- Accept exactly six requests: `identify`, `get_channels`, `get_settings`, `set_settings`, `start_stream`, `stop_stream`. `start_stream` and `stop_stream` only start and stop the sending of samples. Any other request gets `unknown_request`.
- Run it as a systemd unit, started at boot, restarted on failure, running as a user that is not root.
- Log to the system journal. Log starts, stops, faults, and the achieved rate. Do not log credentials.

### Timing

Linux is not a real-time system. Other work can delay a read, so sample times can jitter and samples can be late.

- Measure the achieved rate and the spacing of the timestamps. Do not assume them.
- Report the measured rate in `status` as `achieved_sps`.
- Mark samples that were clearly late with the `late` flag.
- Keep the Pi's other load small while recording.

### I²C permissions

- Turn on the I²C interface in the Pi's configuration.
- Put the service's user in the `i2c` group, so it can open the I²C device without root.
- Check that the ADC answers at its address before starting. If it does not, send a `fault` with code `adc_not_responding`. Do not invent samples.

## Electrical notes

- Pi GPIO is 3.3 V and is not 5 V tolerant. Keep the I²C lines at 3.3 V.
- The ADS1115's allowed input voltage depends on its supply and its datasheet. A wider programmable range does not allow a higher voltage on the pins.
- A voltage divider or a differential input is not isolation.
- The connection to the tester needs a reviewed interface circuit and a verified pinout. Neither exists yet.
- Ground paths between the Pi, its power supply, the Windows computer, and the tester are not verified. Review them before connecting anything.

## Checklist before use

All of these must pass on the bench, with no tester connected.

1. `identify` returns `hello` with a `device_id` that is unique to this Pi.
2. Restart the service. The next `hello` has a different `boot_id`.
3. `get_channels` returns a `channels` message that passes the app's check.
4. `get_settings` and `set_settings` return a `settings` message that passes the check. A changed value gives a new `settings_ref`.
5. While streaming, every `sample` carries `raw` as an integer count, its own `t`, the current `ref`, and a `seq` that goes up by 1.
6. Force and displacement samples are separate lines.
7. The achieved rate reported in `status` matches the rate you work out from the timestamps, over a long run.
8. Disconnect the ADC. The service sends a `fault` and does not invent samples.
9. An unknown request gets `unknown_request`.
10. Nothing other than the six requests is accepted.
11. Run the app against the service for a long stream. Check for skipped lines and gaps.
12. For the network option: check authentication, TLS, and the firewall from another computer on the lab network and from outside it.

## After the checks: calibration

A different device changes the signal path. The app does not reuse a calibration record automatically. It checks the device type, ADC, range, input, and conditioning circuit, and if any part differs, it waits for review.

1. Record the Pi, its I²C settings, and the circuit in the device profile.
2. Review or redo the calibration in the app for this signal path.
3. Until then, values are shown in volts and labeled uncalibrated, and stress and strain are not calculated.

## Open questions

- Which Pi model will be used, and whether its USB port can act as a serial gadget on a Windows computer.
- Whether the lab wants the network option, and who looks after certificates and accounts.
- Whether Linux timing meets what the lab needs.
- The interface circuit between the tester and the ADC. It is not designed or reviewed.
