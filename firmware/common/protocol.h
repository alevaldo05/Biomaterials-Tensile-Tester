// Acquisition protocol, version 1: the project's own format (docs/app/PROTOCOL.md).
// It is not a Shimadzu or AGS-J protocol and has no message that moves the machine.
// Plain C++ with no Arduino calls, so it is tested on a computer (test/host).
#pragma once
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace tt {

constexpr int kProtocolVersion = 1;
constexpr std::size_t kMaxLine = 2048;   // longest line accepted or sent, in characters

// ---------- requests from the app (there are exactly six, all about acquisition) ----------

enum class RequestType { Identify, GetChannels, GetSettings, SetSettings, StartStream, StopStream };

struct SettingsChange {
  bool hasFullScale = false;
  long fullScale_mV = 0;
  bool hasDataRate = false;
  long dataRate_sps = 0;
  bool hasOrder = false;
  std::vector<std::string> order;
};

struct Request {
  RequestType type = RequestType::Identify;
  std::string id;
  SettingsChange settings;
};

enum class RequestProblem { None, NotJson, UnsupportedVersion, UnknownRequest, BadRequest };

struct ParsedRequest {
  RequestProblem problem = RequestProblem::None;
  Request request;
  std::string id;       // the request id when it could be read, so an error can name it
  std::string detail;   // a short reason, sent back in the error message
};

// Checks one received line. Anything that is not one of the six requests, exactly, is refused.
ParsedRequest parseRequest(const std::string& line);

// The error code the protocol uses for a problem.
const char* errorCode(RequestProblem p);

// ---------- messages to the app (each function returns one whole line, ending in "\n") ----------

struct Identity {
  std::string deviceId;
  std::string deviceType;
  std::string swVersion;
  std::string bootId;
};

struct ChannelInfo {
  std::string id;
  std::string quantity;   // "force", "displacement", or "voltage" when not assigned
  std::string mode;       // "single-ended" or "differential"
  std::string input;      // for example "AIN0" or "AIN0-AIN1"
  std::string label;
};

struct SettingsInfo {
  std::string ref;        // never reused for different values
  std::string adc;
  int bits = 16;
  int i2cAddress = -1;    // -1: not sent
  long fullScale_mV = 0;
  long dataRate_sps = 0;
  std::vector<std::string> order;
  std::string filter;     // empty: not sent
};

std::string jsonString(const std::string& s);
std::string helloLine(const Identity& id);
std::string channelsLine(const std::vector<ChannelInfo>& channels);
std::string settingsLine(const SettingsInfo& s);
// t_us: device time of the conversion in microseconds. raw: the ADC result, unscaled.
std::string sampleLine(const std::string& bootId, uint32_t seq, uint64_t t_us, const std::string& channel, int32_t raw,
                       const std::string& ref, const std::vector<std::string>& flags);
std::string statusLine(bool streaming, bool hasAchieved, double achieved_sps, uint32_t dropped);
std::string faultLine(const std::string& code, const std::string& message);
std::string ackLine(const std::string& id);
std::string errorLine(const std::string& id, const std::string& code, const std::string& message);

}  // namespace tt
