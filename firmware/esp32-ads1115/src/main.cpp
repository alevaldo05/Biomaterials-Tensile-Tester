// ESP32 reference acquisition firmware: ADS1115 over I2C, protocol v1 over USB serial.
// Only the board-specific wiring of the pieces is here. Board facts are in include/board_config.h.
// It reads; it sends no command to the tensile tester and has no connection to its controller.
#include <Arduino.h>
#include <Wire.h>
#include <esp_random.h>
#include <esp_timer.h>

#include "acquisition_core.h"
#include "ads1115_driver.h"
#include "board_config.h"

// ===================================================================================================
// Board-specific: ESP32 (Arduino core). Everything that calls the ESP32 or Arduino (Wire, Serial,
// esp_timer, esp_random, the efuse MAC) is in this block. Another board rewrites only this block.
// ===================================================================================================
namespace {

class WireBus : public tt::I2cBus {
 public:
  bool write(uint8_t address, const uint8_t* data, size_t n) override {
    Wire.beginTransmission(address);
    Wire.write(data, n);
    return Wire.endTransmission() == 0;
  }
  bool read(uint8_t address, uint8_t* data, size_t n) override {
    if (Wire.requestFrom(static_cast<int>(address), static_cast<int>(n)) != static_cast<int>(n)) return false;
    for (size_t i = 0; i < n; i++) data[i] = static_cast<uint8_t>(Wire.read());
    return true;
  }
  void delayMicros(uint32_t us) override { delayMicroseconds(us); }
  uint64_t micros64() override { return static_cast<uint64_t>(esp_timer_get_time()); }
};

class SerialPlatform : public tt::Platform {
 public:
  uint64_t micros64() override { return static_cast<uint64_t>(esp_timer_get_time()); }
  size_t writeRoom() override { return static_cast<size_t>(Serial.availableForWrite()); }
  void write(const std::string& line) override { Serial.write(reinterpret_cast<const uint8_t*>(line.data()), line.size()); }
};

std::string hex32(uint32_t v) {
  char buf[9];
  snprintf(buf, sizeof buf, "%08lx", static_cast<unsigned long>(v));
  return buf;
}

// Id and boot id sources. The id is stable for this chip; the boot id is new on every start.
std::string chipId() { return hex32(static_cast<uint32_t>(ESP.getEfuseMac() >> 16)); }
std::string newBootId() { return hex32(esp_random()); }

void startSerial() {
  Serial.setTxBufferSize(8192);
  Serial.begin(TT_SERIAL_BAUD);
}
void startBus() { Wire.begin(TT_I2C_SDA_PIN, TT_I2C_SCL_PIN, TT_I2C_CLOCK_HZ); }

bool serialReadByte(uint8_t& b) {
  if (!Serial.available()) return false;
  b = static_cast<uint8_t>(Serial.read());
  return true;
}

WireBus bus;
SerialPlatform platform;
// ===================================================================================================
// End of the board-specific block.
// ===================================================================================================

tt::Ads1115 adc(bus, TT_ADS1115_ADDRESS);
tt::AcquisitionCore* core = nullptr;

}  // namespace

void setup() {
  startSerial();
  startBus();
  tt::CoreConfig cfg;
  cfg.deviceId = std::string(TT_DEVICE_TYPE) + "-" + chipId();
  cfg.deviceType = TT_DEVICE_TYPE;
  cfg.swVersion = TT_SOFTWARE_VERSION;
  cfg.bootId = newBootId();   // new on every start, so the app notices a restart
  cfg.channels = TT_CHANNELS;
  cfg.fullScale_mV = TT_DEFAULT_FULL_SCALE_MV;
  cfg.dataRate_sps = TT_DEFAULT_DATA_RATE_SPS;
  core = new tt::AcquisitionCore(cfg, adc, platform);
  core->begin();
}

void loop() {
  uint8_t buf[128];
  size_t n = 0;
  while (n < sizeof buf && serialReadByte(buf[n])) n++;
  if (n) core->receive(reinterpret_cast<const char*>(buf), n);
  core->poll();
}
