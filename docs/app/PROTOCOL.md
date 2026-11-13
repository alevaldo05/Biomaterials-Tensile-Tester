# Acquisition protocol, version 1

This is the project's **own** format for talking to its own acquisition devices (the ESP32 reference firmware, a Pico, a Raspberry Pi service, the simulator). It is **not** a Shimadzu or AGS-J protocol, and it contains no message that moves the machine.

The code that defines and checks it is `packages/protocol/src/messages.ts`. If this file and the code disagree, the code is right and this file needs fixing.

## Basics

- Text, UTF-8. One JSON object per line, ending in `\n` (a `\r\n` ending is accepted).
- Every message has `"v": 1` and a `"type"`.
- A line may be at most 2048 characters. A longer line is dropped and counted.
- Over USB serial the reference setting is 921600 baud (a native USB port ignores it). A sample line is about 110 characters, so 115200 baud (about 11,500 characters per second) is too slow for even 128 conversions per second. The app and the firmware's `board_config.h` must use the same rate.
- Every line the app receives is checked at run time. A line that is not JSON, is the wrong version, or has a wrong or missing field is skipped and counted; it never becomes a reading.

## Messages from the device

| `type` | Sent | Fields |
|---|---|---|
| `hello` | in answer to `identify` (a device may also send it when it starts) | `device_id`, `device_type` (free text such as `esp32`), `sw_version`, `boot_id` (new on every start), `time_unit` (`us` or `ms`) |
| `channels` | in answer to `get_channels` | `channels`: list of `{ id, quantity (force, displacement, voltage), mode (single-ended, differential), input (for example AIN0), encoding (int16), label? }` |
| `settings` | in answer to `get_settings` and `set_settings` | `confirmed`: `{ settings_ref, adc, bits, i2c_address?, full_scale_mv, data_rate_sps, channel_order, filter? }` |
| `sample` | while streaming | `boot_id`, `seq`, `t`, `ch`, `raw`, `ref`, `q?` |
| `status` | when the stream starts or stops, and now and then | `state` (idle, streaming), `achieved_sps?`, `dropped?` |
| `fault` | when something is wrong | `code` (adc_not_responding, adc_error, buffer_overflow, settings_invalid, internal), `message` |
| `ack` | a request was carried out | `id` of the request |
| `error` | a request was refused | `id?`, `code` (unknown_request, bad_request, unsupported_version, not_allowed, busy), `message` |

### A sample

```
{"v":1,"type":"sample","boot_id":"b7f3","seq":1042,"t":5250000,"ch":"force","raw":2183,"ref":"s1"}
```

- **One sample is one conversion of one channel.** The ADS1115 converts its inputs one after another, so force and displacement are separate samples with their own times. They are never reported as measured at the same instant.
- `seq` counts every sample sent since the stream started. A jump means samples were lost; the app records where and how many.
- `t` is the device's own time of the conversion, in the unit given in `hello`. The app stores the computer's receipt time separately.
- `raw` is the ADC result as an integer, **unscaled**. The device does not convert to volts, newtons, or millimetres.
- `ref` names the settings the conversion was made with. A `settings_ref` is never reused for different values, so a sample can always be interpreted later.
- `q` lists quality flags: `overrange`, `adc_timeout`, `adc_error`, `late`, `estimated_time`.

### Settings

`data_rate_sps` is the ADC's conversion rate. Channels share it: with two channels at 128 conversions per second, each channel gets about 64 samples per second. The app reports the rate actually achieved, from the device timestamps.

`full_scale_mv` is the programmable range. Choosing a wider range does **not** allow a higher voltage on the ADC pins; that limit comes from the ADC's supply and its datasheet.

## Requests from the app

There are exactly six, all with an `id`:

`identify`, `get_channels`, `get_settings`, `set_settings` (with `settings`: any of `full_scale_mv`, `data_rate_sps`, `channel_order`), `start_stream`, `stop_stream`.

`start_stream` and `stop_stream` start and stop the sending of samples. They do not start or stop the machine. The app's encoder refuses to produce any other request, so nothing else can be sent.

## Connecting

1. The person picks the connection (the app never opens a port by itself).
2. The app sends `identify` and waits for `hello`. A USB name or vendor/product ID is not accepted as proof of what the device is.
3. If the answer has another `v`, the app stops with "incompatible protocol".
4. The app sends `get_channels`, then `get_settings`.
5. Connected. Whether it is *ready to record* is a separate question, answered by calibration.

## What the app does when things go wrong

| Event | Result |
|---|---|
| A message split across reads, or several in one read | Rebuilt by the line framer |
| Unreadable, wrong-shape, or oversized line | Skipped and counted |
| Sample from an unknown channel, or out of order | Skipped and counted |
| `seq` jumps | Gap recorded (after which sample, how many missing) |
| `boot_id` changes | The device restarted: the recording ends as interrupted, the data so far is kept, nothing is resent |
| No sample for 2 s while streaming | Data marked stale; it recovers when samples return |
| Connection lost | Recording ends as interrupted, data kept; the app does not reconnect by itself |

## From counts to a physical value

Three steps, each done in one place only:

1. **ADC conversion** (app, from the confirmed settings): volts at the ADC input = `raw × full_scale / 2^(bits−1)`.
2. **Input conditioning** (app, from the device profile): volts at the machine's output, using the reviewed circuit's gain and offset.
3. **Physical calibration** (app, from a calibration record): N or mm.

A calibration record carries the whole signal path it was made with (device type, ADC, range, input, conditioning circuit). If any part differs, the calibration is not used until it is reviewed. Without one, values are shown in volts and labeled uncalibrated, and stress and strain are not calculated.

## Versions

A change that old software cannot read gets a new `v`. Devices and apps refuse a `v` they do not know.
