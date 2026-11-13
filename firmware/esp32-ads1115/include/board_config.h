// Board facts for the reference ESP32 build. This is the ONLY file with pin numbers, the I2C address,
// and which ADC input carries which signal.
//
// EVERY VALUE HERE IS AN EXAMPLE. Check each one against your own board and your reviewed wiring before use.
// Nothing here describes the tensile tester: its analog output pins, signal scaling, and grounding are not
// verified, and connecting it needs a reviewed interface circuit (docs/app/SETUP.md).
#pragma once

// I2C to the ADS1115. GPIO 21 and 22 are common defaults on ESP32 DevKit boards; other boards differ.
#define TT_I2C_SDA_PIN 21
#define TT_I2C_SCL_PIN 22
#define TT_I2C_CLOCK_HZ 400000

// The ADS1115 address is set by its ADDR pin: 0x48 (to GND), 0x49 (VDD), 0x4A (SDA), 0x4B (SCL).
#define TT_ADS1115_ADDRESS 0x48

// Serial speed. A board whose USB goes through a USB-to-serial chip uses this rate; native USB ignores it.
// It must match the app (apps/tester/src/real.ts). At 115200 baud the samples do not fit; see docs/app/SETUP.md.
#define TT_SERIAL_BAUD 921600

// Starting acquisition settings (the app can change them within what the ADS1115 supports).
// The full-scale range is the ADC's measuring range only: it does NOT allow a higher voltage on any pin.
#define TT_DEFAULT_FULL_SCALE_MV 4096
#define TT_DEFAULT_DATA_RATE_SPS 128

// Channels: id, what the input is wired to measure, the ADS1115 input, a label.
// Inputs: "AIN0".."AIN3" (single-ended) or "AIN0-AIN1", "AIN0-AIN3", "AIN1-AIN3", "AIN2-AIN3" (differential).
// The assignment below is an example. Use "voltage" as the quantity for an input that is not assigned.
#define TT_CHANNELS                                                                 \
  {                                                                                 \
    {"force", "force", "AIN0", "Force signal (example assignment, verify wiring)"}, \
    {"displacement", "displacement", "AIN1", "Displacement signal (example assignment, verify wiring)"}, \
  }

#define TT_DEVICE_TYPE "esp32"
#define TT_SOFTWARE_VERSION "0.1.0"
