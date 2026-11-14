# Firmware

Reference acquisition firmware for the tester app: an ADS1115 read over I2C, protocol v1 over USB serial ([docs/app/PROTOCOL.md](../docs/app/PROTOCOL.md)). It only reads and sends no command to the tensile tester. **It has only been compiled and run on a computer with a pretend ADS1115. It has never been run on a board, and nothing here is verified against the tester's signals or wiring.**

## Layout

| Folder | Holds |
|---|---|
| `common/` | Code shared by every board, plain C++ with no Arduino or chip calls: `protocol.*`, `acquisition_core.*`, `ads1115_driver.*`. `library.json` lets PlatformIO build it as a library. `test/host/` builds it for a computer with a pretend ADS1115 and runs its unit tests. |
| `esp32-ads1115/` | The ESP32 board folder: `platformio.ini` (pins the platform), `include/board_config.h` (pins, I2C address, channel wiring, `TT_DEVICE_TYPE`; all example values), and `src/main.cpp` (the chip-specific code, in one marked block). |

A board folder does not copy anything from `common/`. Its `platformio.ini` lists `lib_deps = symlink://../common`.

## Run the host tests

Needs a C++ compiler (`g++`). From the project root:

```bash
bash firmware/common/test/host/build-and-test.sh
```

This compiles the shared code with warnings as errors, runs the unit tests, and builds the host device program that `packages/recording/test/firmware.test.ts` drives.

## Build for the board

Needs PlatformIO and its download hosts. Compile only; upload is separate and has never been tried.

```bash
cd firmware/esp32-ads1115
pio run -e esp32dev
```

## Adding another board

1. Copy `firmware/esp32-ads1115/` to `firmware/<name>/`.
2. In its `src/main.cpp`, rewrite the board-specific block: the three small classes and functions for the I2C bus (`tt::I2cBus`), the platform (`tt::Platform`: microsecond clock, serial write), and the id and boot-id sources.
3. Edit `include/board_config.h`: pins, I2C address, channels, and `TT_DEVICE_TYPE` (the device id starts with it). Keep them marked as examples until checked against the real wiring.
4. Pin the platform in its `platformio.ini` (`platform = <platform>@<version>`, a version that has built) and keep `lib_deps = symlink://../common`.

Nothing else changes: not `common/`, not the GitHub workflow (it builds every `firmware/*/platformio.ini`), and not the app (`device_type` is free text). A green build only proves that it compiles. No firmware exists yet for any board other than the ESP32.
