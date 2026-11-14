#include "ads1115_driver.h"

#include <cstring>

namespace tt {
namespace {
constexpr uint8_t kConversionRegister = 0x00;
constexpr uint8_t kConfigRegister = 0x01;
constexpr uint16_t kStartSingle = 0x8000;   // OS bit: write 1 to start; reads 1 when no conversion is running
constexpr uint16_t kSingleShot = 0x0100;    // MODE bit
constexpr uint16_t kComparatorOff = 0x0003; // COMP_QUE = 11
}  // namespace

bool ads1115Mux(const char* input, uint8_t& mux) {
  static const struct { const char* name; uint8_t code; } kInputs[] = {
    {"AIN0-AIN1", 0}, {"AIN0-AIN3", 1}, {"AIN1-AIN3", 2}, {"AIN2-AIN3", 3},
    {"AIN0", 4}, {"AIN1", 5}, {"AIN2", 6}, {"AIN3", 7},
  };
  for (const auto& i : kInputs)
    if (std::strcmp(input, i.name) == 0) { mux = i.code; return true; }
  return false;
}

bool ads1115Pga(long fullScale_mV, uint8_t& pga) {
  static const long kRanges[] = {6144, 4096, 2048, 1024, 512, 256};
  for (uint8_t i = 0; i < 6; i++)
    if (kRanges[i] == fullScale_mV) { pga = i; return true; }
  return false;
}

bool ads1115Rate(long dataRate_sps, uint8_t& dr) {
  static const long kRates[] = {8, 16, 32, 64, 128, 250, 475, 860};
  for (uint8_t i = 0; i < 8; i++)
    if (kRates[i] == dataRate_sps) { dr = i; return true; }
  return false;
}

bool ads1115ConfigWord(const char* input, long fullScale_mV, long dataRate_sps, uint16_t& word) {
  uint8_t mux, pga, dr;
  if (!ads1115Mux(input, mux) || !ads1115Pga(fullScale_mV, pga) || !ads1115Rate(dataRate_sps, dr)) return false;
  word = kStartSingle | static_cast<uint16_t>(mux << 12) | static_cast<uint16_t>(pga << 9) | kSingleShot | static_cast<uint16_t>(dr << 5) | kComparatorOff;
  return true;
}

bool Ads1115::supportsInput(const char* input) const { uint8_t m; return ads1115Mux(input, m); }
bool Ads1115::supportsRange(long fullScale_mV) const { uint8_t p; return ads1115Pga(fullScale_mV, p); }
bool Ads1115::supportsRate(long dataRate_sps) const { uint8_t d; return ads1115Rate(dataRate_sps, d); }

bool Ads1115::readRegister(uint8_t reg, uint16_t& value) {
  uint8_t data[2];
  if (!bus_.write(address_, &reg, 1) || !bus_.read(address_, data, 2)) return false;
  value = static_cast<uint16_t>((data[0] << 8) | data[1]);
  return true;
}

bool Ads1115::present() {
  uint16_t v;
  return readRegister(kConfigRegister, v);
}

bool Ads1115::convert(const char* input, long fullScale_mV, long dataRate_sps, int16_t& raw) {
  uint16_t word;
  if (!ads1115ConfigWord(input, fullScale_mV, dataRate_sps, word)) return false;
  const uint8_t start[3] = {kConfigRegister, static_cast<uint8_t>(word >> 8), static_cast<uint8_t>(word & 0xFF)};
  if (!bus_.write(address_, start, 3)) return false;
  // Wait one nominal conversion period, then ask until the ADC says it is done. Give up at 1.1 nominal periods
  // plus 2 ms from the start: the datasheet allows the real rate to differ from the setting by about 10%.
  const uint32_t nominal = static_cast<uint32_t>(1000000L / dataRate_sps);
  const uint64_t deadline = bus_.micros64() + nominal + nominal / 10 + 2000;
  bus_.delayMicros(nominal);
  for (;;) {
    uint16_t cfg;
    if (!readRegister(kConfigRegister, cfg)) return false;
    if (cfg & kStartSingle) break;
    if (bus_.micros64() > deadline) return false;
    bus_.delayMicros(50);
  }
  uint16_t value;
  if (!readRegister(kConversionRegister, value)) return false;
  raw = static_cast<int16_t>(value);
  return true;
}

}  // namespace tt
