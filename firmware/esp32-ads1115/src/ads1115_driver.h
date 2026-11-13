// ADS1115 register work (Texas Instruments ADS1115 datasheet, register map). Everything specific to this ADC is
// here; the acquisition loop sees only AdcPort. The I2C bus and the delay come from the board through I2cBus.
#pragma once
#include <cstddef>
#include <cstdint>

#include "acquisition_core.h"

namespace tt {

class I2cBus {
 public:
  virtual ~I2cBus() = default;
  virtual bool write(uint8_t address, const uint8_t* data, std::size_t n) = 0;
  virtual bool read(uint8_t address, uint8_t* data, std::size_t n) = 0;
  virtual void delayMicros(uint32_t us) = 0;
  virtual uint64_t micros64() = 0;
};

// Input multiplexer code for "AIN0".."AIN3" (single-ended, against GND) or the four differential pairs
// "AIN0-AIN1", "AIN0-AIN3", "AIN1-AIN3", "AIN2-AIN3".
bool ads1115Mux(const char* input, uint8_t& mux);
// Programmable range: 6144, 4096, 2048, 1024, 512, or 256 mV full scale.
bool ads1115Pga(long fullScale_mV, uint8_t& pga);
// Conversion rate: 8, 16, 32, 64, 128, 250, 475, or 860 per second.
bool ads1115Rate(long dataRate_sps, uint8_t& dr);
// The config register value that starts one single-shot conversion (comparator off).
bool ads1115ConfigWord(const char* input, long fullScale_mV, long dataRate_sps, uint16_t& word);

class Ads1115 : public AdcPort {
 public:
  Ads1115(I2cBus& bus, uint8_t address) : bus_(bus), address_(address) {}
  const char* model() const override { return "ads1115"; }
  int bits() const override { return 16; }
  int i2cAddress() const override { return address_; }
  bool supportsInput(const char* input) const override;
  bool supportsRange(long fullScale_mV) const override;
  bool supportsRate(long dataRate_sps) const override;
  bool present() override;
  bool convert(const char* input, long fullScale_mV, long dataRate_sps, int16_t& raw) override;

 private:
  bool readRegister(uint8_t reg, uint16_t& value);
  I2cBus& bus_;
  uint8_t address_;
};

}  // namespace tt
