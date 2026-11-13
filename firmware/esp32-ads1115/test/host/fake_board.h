// A pretend ADS1115 on a pretend I2C bus, and a pretend board, for running the firmware's own code on a
// computer. The fake follows the ADS1115 register map: a config write with the OS bit starts a conversion,
// the OS bit reads 0 until it is done, and the conversion register holds the result. Time is simulated.
// The input voltages are made up; they say nothing about any real equipment.
#pragma once
#include <cmath>
#include <cstdint>
#include <cstring>
#include <functional>
#include <string>
#include <vector>

#include "../../src/acquisition_core.h"
#include "../../src/ads1115_driver.h"

namespace tt_test {

struct Clock { uint64_t now_us = 1000000; };

class FakeAds1115Bus : public tt::I2cBus {
 public:
  explicit FakeAds1115Bus(Clock& clock, uint8_t address = 0x48) : clock_(clock), address_(address) {}

  // Volts at each input (against GND), as a function of time in seconds. Index 0..3 = AIN0..AIN3.
  std::function<double(int input, double t_s)> volts = [](int input, double t_s) { return input == 0 ? 0.2 + 0.1 * t_s : input == 1 ? 0.05 * t_s : 0.0; };
  bool absent = false;       // nothing answers at the address
  bool stuck = false;        // a conversion never finishes
  int conversions = 0;
  std::vector<uint16_t> configWrites;

  bool write(uint8_t address, const uint8_t* data, std::size_t n) override {
    if (absent || address != address_ || n == 0) return false;
    pointer_ = data[0] & 0x03;
    if (n == 3 && pointer_ == 1) {
      uint16_t w = static_cast<uint16_t>((data[1] << 8) | data[2]);
      configWrites.push_back(w);
      config_ = w & 0x7FFF;
      if (w & 0x8000) start(w);
    }
    return n == 1 || n == 3;
  }
  bool read(uint8_t address, uint8_t* data, std::size_t n) override {
    if (absent || address != address_ || n != 2) return false;
    uint16_t v = pointer_ == 0 ? static_cast<uint16_t>(result_) : static_cast<uint16_t>(config_ | (busy() ? 0 : 0x8000));
    data[0] = static_cast<uint8_t>(v >> 8);
    data[1] = static_cast<uint8_t>(v & 0xFF);
    return true;
  }
  void delayMicros(uint32_t us) override { clock_.now_us += us; }
  uint64_t micros64() override { return clock_.now_us; }

 private:
  bool busy() const { return stuck || clock_.now_us < readyAt_; }
  void start(uint16_t w) {
    static const double kFs[] = {6.144, 4.096, 2.048, 1.024, 0.512, 0.256, 0.256, 0.256};
    static const int kRate[] = {8, 16, 32, 64, 128, 250, 475, 860};
    int mux = (w >> 12) & 7, pga = (w >> 9) & 7, dr = (w >> 5) & 7;
    double t = clock_.now_us / 1e6, v;
    if (mux >= 4) v = volts(mux - 4, t);
    else {
      static const int kPairs[4][2] = {{0, 1}, {0, 3}, {1, 3}, {2, 3}};
      v = volts(kPairs[mux][0], t) - volts(kPairs[mux][1], t);
    }
    double counts = std::round(v / kFs[pga] * 32768.0);
    result_ = static_cast<int16_t>(counts > 32767 ? 32767 : counts < -32768 ? -32768 : counts);
    readyAt_ = clock_.now_us + 1000000ULL / kRate[dr];
    conversions++;
  }
  Clock& clock_;
  uint8_t address_;
  uint8_t pointer_ = 0;
  uint16_t config_ = 0x0583;
  int16_t result_ = 0;
  uint64_t readyAt_ = 0;
};

class FakePlatform : public tt::Platform {
 public:
  explicit FakePlatform(Clock& clock) : clock_(clock) {}
  std::size_t room = 1 << 20;   // set to 0 to make the line to the computer "full"
  std::function<void(const std::string&)> onWrite = [](const std::string&) {};
  std::vector<std::string> lines;
  bool keep = true;
  uint64_t micros64() override { return clock_.now_us; }
  std::size_t writeRoom() override { return room; }
  void write(const std::string& line) override {
    if (keep) lines.push_back(line);
    onWrite(line);
  }

 private:
  Clock& clock_;
};

inline tt::CoreConfig exampleConfig(const std::string& bootId = "b0000001") {
  tt::CoreConfig c;
  c.deviceId = "host-0001";
  c.deviceType = "esp32-host-test";
  c.swVersion = "0.1.0";
  c.bootId = bootId;
  c.channels = {{"force", "force", "AIN0", "Force signal (test)"}, {"displacement", "displacement", "AIN1", "Displacement signal (test)"}};
  c.fullScale_mV = 4096;
  c.dataRate_sps = 128;
  return c;
}

}  // namespace tt_test
