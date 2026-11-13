// The device's acquisition loop, with no Arduino calls: it answers the six requests, converts the channels
// one after another, and sends raw counts with the time of each conversion. The ADC and the board are
// reached only through the two small interfaces below, so the same loop runs on the ESP32 and in the
// tests on a computer, and another ADC needs only another AdcPort.
#pragma once
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

#include "protocol.h"

namespace tt {

// One ADC. Board pins and registers stay behind this.
class AdcPort {
 public:
  virtual ~AdcPort() = default;
  virtual const char* model() const = 0;   // for example "ads1115"
  virtual int bits() const = 0;
  virtual int i2cAddress() const = 0;      // -1 when not on I2C
  virtual bool supportsInput(const char* input) const = 0;
  virtual bool supportsRange(long fullScale_mV) const = 0;
  virtual bool supportsRate(long dataRate_sps) const = 0;
  virtual bool present() = 0;
  // One single conversion of one input. False when the ADC did not answer or did not finish in time.
  virtual bool convert(const char* input, long fullScale_mV, long dataRate_sps, int16_t& raw) = 0;
};

// The board around the loop: a clock and the line to the computer.
class Platform {
 public:
  virtual ~Platform() = default;
  virtual uint64_t micros64() = 0;   // monotonic, does not wrap in practice
  virtual std::size_t writeRoom() = 0;   // bytes that can be written now without waiting
  virtual void write(const std::string& line) = 0;
};

struct ChannelConfig {
  const char* id;
  const char* quantity;   // "force", "displacement", or "voltage" when not assigned
  const char* input;      // "AIN0" (single-ended) or "AIN0-AIN1" (differential)
  const char* label;
};

struct CoreConfig {
  std::string deviceId;
  std::string deviceType;
  std::string swVersion;
  std::string bootId;     // new on every start
  std::vector<ChannelConfig> channels;
  long fullScale_mV;
  long dataRate_sps;
};

class AcquisitionCore {
 public:
  AcquisitionCore(CoreConfig config, AdcPort& adc, Platform& io);
  // Announces the device (a hello), so the app notices a restart.
  void begin();
  // Bytes received from the computer, in any pieces.
  void receive(const char* data, std::size_t n);
  // Call as often as possible. While streaming it makes one conversion per call.
  void poll();

  bool streaming() const { return streaming_; }
  uint32_t dropped() const { return dropped_; }
  std::string settingsRef() const;

 private:
  void handleLine(const std::string& line);
  void handle(const Request& r);
  void sendSettings();
  void stop();
  bool send(const std::string& line);   // false when there was no room and the line was dropped

  CoreConfig cfg_;
  AdcPort& adc_;
  Platform& io_;
  std::string in_;
  bool skipping_ = false;
  bool streaming_ = false;
  long fullScale_mV_;
  long dataRate_sps_;
  std::vector<std::size_t> order_;   // channel indexes, in conversion order
  uint32_t refNo_ = 1;
  uint32_t seq_ = 0;
  uint32_t dropped_ = 0;
  std::size_t next_ = 0;
  uint64_t windowStart_ = 0;
  uint32_t windowCount_ = 0;
};

}  // namespace tt
