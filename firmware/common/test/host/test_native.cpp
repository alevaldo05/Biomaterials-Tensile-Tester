// Unit tests for the firmware's portable code: protocol, ADS1115 driver, acquisition loop.
// No test framework: CHECK(cond) prints the failing line and counts it. Time is simulated (fake_board.h).
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

#include "../../acquisition_core.h"
#include "../../ads1115_driver.h"
#include "../../protocol.h"
#include "fake_board.h"

static int g_checks = 0;
static int g_failed = 0;

#define CHECK(cond)                                                    \
  do {                                                                 \
    g_checks++;                                                        \
    if (!(cond)) {                                                     \
      g_failed++;                                                      \
      std::printf("FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond);      \
    }                                                                  \
  } while (0)

using tt::ParsedRequest;
using tt::RequestProblem;
using tt::RequestType;

namespace {

bool has(const std::string& s, const std::string& part) { return s.find(part) != std::string::npos; }

// The number that follows `"key":` in a line, or -1 when the key is missing.
double numberAfter(const std::string& line, const std::string& key) {
  std::size_t p = line.find("\"" + key + "\":");
  if (p == std::string::npos) return -1;
  return std::atof(line.c_str() + p + key.size() + 3);
}

bool isType(const std::string& line, const std::string& type) { return line.rfind("{\"v\":1,\"type\":\"" + type + "\"", 0) == 0; }

std::string req(const std::string& type, const std::string& id = "r1") { return "{\"v\":1,\"type\":\"" + type + "\",\"id\":\"" + id + "\"}"; }

// ---------- 1. parseRequest ----------

void testParseAccepted() {
  struct { const char* name; RequestType type; } all[] = {
    {"identify", RequestType::Identify},       {"get_channels", RequestType::GetChannels},
    {"get_settings", RequestType::GetSettings}, {"start_stream", RequestType::StartStream},
    {"stop_stream", RequestType::StopStream},
  };
  for (const auto& a : all) {
    ParsedRequest p = tt::parseRequest(req(a.name, "abc"));
    CHECK(p.problem == RequestProblem::None);
    CHECK(p.request.type == a.type);
    CHECK(p.request.id == "abc");
    CHECK(p.id == "abc");
  }
  ParsedRequest s = tt::parseRequest(
      "{\"v\":1,\"type\":\"set_settings\",\"id\":\"s1\",\"settings\":{\"full_scale_mv\":2048,\"data_rate_sps\":250,"
      "\"channel_order\":[\"displacement\",\"force\"]}}");
  CHECK(s.problem == RequestProblem::None);
  CHECK(s.request.type == RequestType::SetSettings);
  CHECK(s.request.settings.hasFullScale && s.request.settings.fullScale_mV == 2048);
  CHECK(s.request.settings.hasDataRate && s.request.settings.dataRate_sps == 250);
  CHECK(s.request.settings.hasOrder && s.request.settings.order.size() == 2);
  CHECK(s.request.settings.order.size() == 2 && s.request.settings.order[0] == "displacement" && s.request.settings.order[1] == "force");

  // Only one setting given: the others stay unset.
  ParsedRequest one = tt::parseRequest("{\"v\":1,\"type\":\"set_settings\",\"id\":\"s2\",\"settings\":{\"data_rate_sps\":64}}");
  CHECK(one.problem == RequestProblem::None);
  CHECK(!one.request.settings.hasFullScale && one.request.settings.hasDataRate && !one.request.settings.hasOrder);

  // Whitespace is fine.
  ParsedRequest w = tt::parseRequest("  { \"v\" : 1 ,\t\"type\" : \"identify\" , \"id\" : \"w\" }  ");
  CHECK(w.problem == RequestProblem::None && w.request.id == "w");
  ParsedRequest w2 = tt::parseRequest("{ \"v\":1, \"type\":\"set_settings\", \"id\":\"w2\", \"settings\": { \"channel_order\": [ \"force\" , \"displacement\" ] } }");
  CHECK(w2.problem == RequestProblem::None && w2.request.settings.order.size() == 2);
}

void expectProblem(const std::string& line, RequestProblem want, const char* code) {
  ParsedRequest p = tt::parseRequest(line);
  if (p.problem != want) std::printf("  (line was: %s)\n", line.c_str());
  CHECK(p.problem == want);
  CHECK(std::string(tt::errorCode(p.problem)) == code);
  CHECK(!p.detail.empty());
}

void testParseRefused() {
  expectProblem("hello", RequestProblem::NotJson, "bad_request");
  expectProblem("", RequestProblem::NotJson, "bad_request");
  expectProblem("{\"v\":1,\"type\":\"identify\",\"id\":\"a\"", RequestProblem::NotJson, "bad_request");
  expectProblem("{\"v\":1,\"type\":\"identify\",\"id\":\"a\"} x", RequestProblem::NotJson, "bad_request");
  expectProblem("[1,2,3]", RequestProblem::NotJson, "bad_request");
  expectProblem("[{\"v\":1,\"type\":\"identify\",\"id\":\"a\"}]", RequestProblem::NotJson, "bad_request");

  expectProblem("{\"type\":\"identify\",\"id\":\"a\"}", RequestProblem::UnsupportedVersion, "unsupported_version");
  expectProblem("{\"v\":2,\"type\":\"identify\",\"id\":\"a\"}", RequestProblem::UnsupportedVersion, "unsupported_version");
  expectProblem("{\"v\":\"1\",\"type\":\"identify\",\"id\":\"a\"}", RequestProblem::UnsupportedVersion, "unsupported_version");

  const char* unknown[] = {"START", "STOP", "TARE", "move_to", "set_speed", "start", "Identify", "hello", ""};
  for (const char* t : unknown) expectProblem(req(t, "a"), RequestProblem::UnknownRequest, "unknown_request");

  expectProblem("{\"v\":1,\"id\":\"a\"}", RequestProblem::BadRequest, "bad_request");              // no type
  expectProblem("{\"v\":1,\"type\":5,\"id\":\"a\"}", RequestProblem::BadRequest, "bad_request");   // type not text
  expectProblem("{\"v\":1,\"type\":\"identify\"}", RequestProblem::BadRequest, "bad_request");     // no id
  expectProblem("{\"v\":1,\"type\":\"identify\",\"id\":\"\"}", RequestProblem::BadRequest, "bad_request");
  expectProblem("{\"v\":1,\"type\":\"identify\",\"id\":7}", RequestProblem::BadRequest, "bad_request");
  expectProblem("{\"v\":1,\"type\":\"start_stream\",\"id\":\"a\",\"speed\":5}", RequestProblem::BadRequest, "bad_request");
  expectProblem("{\"v\":1,\"type\":\"identify\",\"id\":\"a\",\"settings\":{}}", RequestProblem::BadRequest, "bad_request");
  expectProblem("{\"v\":1,\"type\":\"stop_stream\",\"id\":\"a\",\"settings\":{\"data_rate_sps\":8}}", RequestProblem::BadRequest, "bad_request");

  const std::string head = "{\"v\":1,\"type\":\"set_settings\",\"id\":\"a\",\"settings\":";
  expectProblem("{\"v\":1,\"type\":\"set_settings\",\"id\":\"a\"}", RequestProblem::BadRequest, "bad_request");
  expectProblem(head + "[]}", RequestProblem::BadRequest, "bad_request");
  expectProblem(head + "{\"full_scale_mv\":-4096}}", RequestProblem::BadRequest, "bad_request");
  expectProblem(head + "{\"full_scale_mv\":0}}", RequestProblem::BadRequest, "bad_request");
  expectProblem(head + "{\"full_scale_mv\":2048.5}}", RequestProblem::BadRequest, "bad_request");
  expectProblem(head + "{\"full_scale_mv\":\"4096\"}}", RequestProblem::BadRequest, "bad_request");
  expectProblem(head + "{\"data_rate_sps\":-8}}", RequestProblem::BadRequest, "bad_request");
  expectProblem(head + "{\"data_rate_sps\":1.5}}", RequestProblem::BadRequest, "bad_request");
  expectProblem(head + "{\"data_rate_sps\":\"128\"}}", RequestProblem::BadRequest, "bad_request");
  expectProblem(head + "{\"channel_order\":[]}}", RequestProblem::BadRequest, "bad_request");
  expectProblem(head + "{\"channel_order\":\"force\"}}", RequestProblem::BadRequest, "bad_request");
  expectProblem(head + "{\"channel_order\":[1]}}", RequestProblem::BadRequest, "bad_request");
  expectProblem(head + "{\"speed\":5}}", RequestProblem::BadRequest, "bad_request");
  expectProblem(head + "{\"data_rate_sps\":8,\"gain\":1}}", RequestProblem::BadRequest, "bad_request");

  // A key given twice is not valid.
  ParsedRequest d = tt::parseRequest("{\"v\":1,\"type\":\"identify\",\"id\":\"a\",\"id\":\"b\"}");
  CHECK(d.problem != RequestProblem::None);
  ParsedRequest d2 = tt::parseRequest(head + "{\"data_rate_sps\":8,\"data_rate_sps\":16}}");
  CHECK(d2.problem != RequestProblem::None);

  // Too long a line.
  std::string longLine = "{\"v\":1,\"type\":\"identify\",\"id\":\"" + std::string(tt::kMaxLine, 'x') + "\"}";
  CHECK(longLine.size() > tt::kMaxLine);
  expectProblem(longLine, RequestProblem::BadRequest, "bad_request");
  // Exactly kMaxLine long (id too long to keep, but the line itself is not refused for length).
  std::string pad = "{\"v\":1,\"type\":\"identify\",\"id\":\"a\",\"x\":\"";
  std::string atLimit = pad + std::string(tt::kMaxLine - pad.size() - 2, 'y') + "\"}";
  CHECK(atLimit.size() == tt::kMaxLine);
  CHECK(!has(tt::parseRequest(atLimit).detail, "too long"));
}

void testParseKeepsId() {
  ParsedRequest a = tt::parseRequest("{\"v\":2,\"type\":\"identify\",\"id\":\"keep-me\"}");
  CHECK(a.problem == RequestProblem::UnsupportedVersion && a.id == "keep-me");
  ParsedRequest b = tt::parseRequest(req("move_to", "m9"));
  CHECK(b.problem == RequestProblem::UnknownRequest && b.id == "m9");
  ParsedRequest c = tt::parseRequest("{\"v\":1,\"type\":\"start_stream\",\"id\":\"s7\",\"speed\":5}");
  CHECK(c.problem == RequestProblem::BadRequest && c.id == "s7");
  ParsedRequest d = tt::parseRequest("{\"v\":1,\"type\":\"identify\"}");
  CHECK(d.id.empty());
  ParsedRequest e = tt::parseRequest("{\"v\":1,\"type\":\"identify\",\"id\":5}");
  CHECK(e.id.empty());
  ParsedRequest f = tt::parseRequest("{\"v\":1,\"type\":\"identify\",\"id\":\"" + std::string(65, 'z') + "\"}");
  CHECK(f.problem == RequestProblem::BadRequest && f.id.empty());
}

// ---------- 2. message lines ----------

void checkLine(const std::string& line, const char* type) {
  CHECK(!line.empty() && line.back() == '\n');
  CHECK(line.find('\n') == line.size() - 1);
  CHECK(line.find('\r') == std::string::npos);
  CHECK(isType(line, type));
  CHECK(line.size() <= tt::kMaxLine);
}

void testMessageLines() {
  checkLine(tt::helloLine({"dev", "type", "0.1", "boot1"}), "hello");
  checkLine(tt::channelsLine({{"force", "force", "single-ended", "AIN0", "Force"}, {"d", "displacement", "differential", "AIN0-AIN1", ""}}), "channels");
  tt::SettingsInfo si;
  si.ref = "b-s1"; si.adc = "ads1115"; si.i2cAddress = 72; si.fullScale_mV = 4096; si.dataRate_sps = 128; si.order = {"force"}; si.filter = "none";
  checkLine(tt::settingsLine(si), "settings");
  checkLine(tt::sampleLine("b", 0, 123456, "force", -5, "b-s1", {}), "sample");
  checkLine(tt::sampleLine("b", 1, 123456, "force", 32767, "b-s1", {"overrange"}), "sample");
  checkLine(tt::statusLine(true, true, 127.5, 0), "status");
  checkLine(tt::statusLine(false, false, 0, 3), "status");
  checkLine(tt::faultLine("adc_error", "line1\nline2"), "fault");
  checkLine(tt::ackLine("r1"), "ack");
  checkLine(tt::errorLine("r1", "bad_request", "bad\nthing"), "error");
  checkLine(tt::errorLine("", "bad_request", "no id"), "error");

  CHECK(!has(tt::errorLine("", "bad_request", "x"), "\"id\""));
  CHECK(has(tt::errorLine("r1", "busy", "x"), "\"id\":\"r1\""));
  CHECK(has(tt::sampleLine("b", 1, 2, "force", 3, "r", {"overrange"}), "\"q\":[\"overrange\"]"));
  CHECK(!has(tt::sampleLine("b", 1, 2, "force", 3, "r", {}), "\"q\""));
  CHECK(has(tt::statusLine(true, true, 127.5, 0), "\"achieved_sps\":127.5"));

  CHECK(tt::jsonString("plain") == "\"plain\"");
  CHECK(tt::jsonString("a\"b") == "\"a\\\"b\"");
  CHECK(tt::jsonString("a\\b") == "\"a\\\\b\"");
  CHECK(tt::jsonString("\x01") == "\"\\u0001\"");
  CHECK(tt::jsonString("a\nb") == "\"a\\u000ab\"");
  CHECK(tt::jsonString("\x1f") == "\"\\u001f\"");
  CHECK(tt::jsonString("") == "\"\"");
}

// ---------- 3. ADS1115 config word ----------

void testConfigWord() {
  uint16_t w = 0;
  CHECK(tt::ads1115ConfigWord("AIN0-AIN1", 2048, 128, w) && w == 0x8583);
  CHECK(tt::ads1115ConfigWord("AIN0", 4096, 128, w) && w == 0xC383);
  // From the datasheet bit layout: OS 15, MUX 14:12, PGA 11:9, MODE 8, DR 7:5, COMP_QUE 1:0.
  // AIN3 = MUX 111, 256 mV = PGA 101, 860 SPS = DR 111.
  uint16_t want = static_cast<uint16_t>((1u << 15) | (7u << 12) | (5u << 9) | (1u << 8) | (7u << 5) | 3u);
  CHECK(tt::ads1115ConfigWord("AIN3", 256, 860, w) && w == want && w == 0xFBE3);
  // AIN2-AIN3 = MUX 011, 6144 mV = PGA 000, 8 SPS = DR 000.
  want = static_cast<uint16_t>((1u << 15) | (3u << 12) | (0u << 9) | (1u << 8) | (0u << 5) | 3u);
  CHECK(tt::ads1115ConfigWord("AIN2-AIN3", 6144, 8, w) && w == want && w == 0xB103);

  uint16_t keep = 0x1234;
  w = keep;
  CHECK(!tt::ads1115ConfigWord("AIN4", 4096, 128, w));
  CHECK(!tt::ads1115ConfigWord("AIN1-AIN0", 4096, 128, w));
  CHECK(!tt::ads1115ConfigWord("", 4096, 128, w));
  CHECK(!tt::ads1115ConfigWord("AIN0", 3000, 128, w));
  CHECK(!tt::ads1115ConfigWord("AIN0", 4096, 100, w));
  CHECK(w == keep);

  uint8_t m = 0;
  CHECK(tt::ads1115Mux("AIN0-AIN3", m) && m == 1);
  CHECK(tt::ads1115Mux("AIN1-AIN3", m) && m == 2);
  CHECK(tt::ads1115Mux("AIN1", m) && m == 5);
  uint8_t pga = 0, dr = 0;
  CHECK(tt::ads1115Pga(6144, pga) && pga == 0);
  CHECK(tt::ads1115Pga(256, pga) && pga == 5);
  CHECK(tt::ads1115Rate(475, dr) && dr == 6);

  tt_test::Clock clock;
  tt_test::FakeAds1115Bus bus(clock);
  tt::Ads1115 adc(bus, 0x48);
  CHECK(adc.supportsInput("AIN2-AIN3") && !adc.supportsInput("AIN4"));
  CHECK(adc.supportsRange(1024) && !adc.supportsRange(3000));
  CHECK(adc.supportsRate(860) && !adc.supportsRate(100));
  CHECK(adc.bits() == 16 && adc.i2cAddress() == 0x48 && std::string(adc.model()) == "ads1115");
}

// ---------- 4. Ads1115 driver on the fake bus ----------

void testDriver() {
  tt_test::Clock clock;
  tt_test::FakeAds1115Bus bus(clock);
  tt::Ads1115 adc(bus, 0x48);
  int16_t raw = 0;

  bus.volts = [](int input, double) { return input == 0 ? 0.3 : 0.0; };
  CHECK(adc.present());
  CHECK(adc.convert("AIN0", 4096, 128, raw));
  CHECK(raw == 2400);   // 0.3 V / 4.096 V * 32768
  CHECK(bus.conversions == 1);
  CHECK(!bus.configWrites.empty() && bus.configWrites.back() == 0xC383);

  bus.volts = [](int input, double) { return input == 0 ? 0.1 : input == 1 ? 0.4 : 0.0; };
  CHECK(adc.convert("AIN0-AIN1", 4096, 128, raw));
  CHECK(raw == -2400);

  bus.volts = [](int, double) { return 5.0; };
  CHECK(adc.convert("AIN0", 4096, 128, raw));
  CHECK(raw == 32767);
  bus.volts = [](int, double) { return -5.0; };
  CHECK(adc.convert("AIN0", 4096, 128, raw));
  CHECK(raw == -32768);

  int16_t before = 77;
  raw = before;
  CHECK(!adc.convert("AIN9", 4096, 128, raw));
  CHECK(!adc.convert("AIN0", 3000, 128, raw));
  CHECK(raw == before);

  // Stuck: gives up 1.1 nominal periods plus 2 ms after the start (the real rate may be up to about 10% off).
  bus.stuck = true;
  uint64_t t0 = clock.now_us;
  CHECK(!adc.convert("AIN0", 4096, 128, raw));
  uint64_t took = clock.now_us - t0;
  uint64_t nominal = 1000000 / 128;
  CHECK(took >= nominal);
  CHECK(took <= nominal + nominal / 10 + 2100);
  bus.stuck = false;
  CHECK(adc.convert("AIN0", 4096, 860, raw));

  // Absent.
  bus.absent = true;
  CHECK(!adc.present());
  CHECK(!adc.convert("AIN0", 4096, 128, raw));
  bus.absent = false;
  CHECK(adc.present());
}

// ---------- 5. AcquisitionCore ----------

struct Rig {
  tt_test::Clock clock;
  tt_test::FakeAds1115Bus bus{clock};
  tt_test::FakePlatform io{clock};
  tt::Ads1115 adc{bus, 0x48};
  tt::AcquisitionCore core;
  Rig() : core(tt_test::exampleConfig("b0000001"), adc, io) {}
  void send(const std::string& line) {
    std::string l = line + "\n";
    core.receive(l.data(), l.size());
  }
  void poll(int n) { for (int i = 0; i < n; i++) core.poll(); }
  // Polls until `seconds` of simulated time have passed.
  void pollFor(double seconds) {
    uint64_t end = clock.now_us + static_cast<uint64_t>(seconds * 1e6);
    while (clock.now_us < end) core.poll();
  }
  std::vector<std::string> take() { std::vector<std::string> v; v.swap(io.lines); return v; }
  std::vector<std::string> ofType(const char* type) const {
    std::vector<std::string> v;
    for (const std::string& l : io.lines) if (isType(l, type)) v.push_back(l);
    return v;
  }
};

void testHelloAndIdentify() {
  Rig r;
  r.core.begin();
  CHECK(r.io.lines.size() == 1 && isType(r.io.lines[0], "hello") && has(r.io.lines[0], "\"boot_id\":\"b0000001\""));
  r.take();
  r.send(req("identify"));
  CHECK(r.io.lines.size() == 1 && isType(r.io.lines[0], "hello") && has(r.io.lines[0], "b0000001"));
}

void testFraming() {
  Rig r;
  std::string line = req("identify") + "\n";
  for (std::size_t i = 0; i < line.size(); i += 5) r.core.receive(line.data() + i, std::min<std::size_t>(5, line.size() - i));
  CHECK(r.io.lines.size() == 1 && isType(r.io.lines[0], "hello"));
  r.take();

  // Split in the middle, with other bytes between.
  r.core.receive("{\"v\":1,\"ty", 10);
  CHECK(r.io.lines.empty());
  r.core.receive("pe\":\"get_channels\",\"id\":\"c1\"}", 29);
  CHECK(r.io.lines.empty());   // no newline yet
  r.core.receive("\n", 1);
  CHECK(r.io.lines.size() == 1 && isType(r.io.lines[0], "channels"));
  r.take();

  // Two requests in one call, answered in order. "\r\n" endings also work.
  std::string two = req("get_channels", "a") + "\r\n" + req("identify", "b") + "\n";
  r.core.receive(two.data(), two.size());
  CHECK(r.io.lines.size() == 2 && isType(r.io.lines[0], "channels") && isType(r.io.lines[1], "hello"));
  r.take();

  // An empty line is ignored.
  r.core.receive("\n\n", 2);
  CHECK(r.io.lines.empty());

  // An overlong line gives one error, and the next line still works.
  std::string big(tt::kMaxLine * 3, 'q');
  r.core.receive(big.data(), big.size());
  CHECK(r.io.lines.empty());
  r.core.receive("\n", 1);
  CHECK(r.io.lines.size() == 1 && isType(r.io.lines[0], "error") && has(r.io.lines[0], "\"code\":\"bad_request\""));
  r.take();
  r.send(req("identify"));
  CHECK(r.io.lines.size() == 1 && isType(r.io.lines[0], "hello"));
  r.take();

  // Not JSON and unknown requests give errors naming the id when it is readable.
  r.send("garbage");
  CHECK(r.io.lines.size() == 1 && isType(r.io.lines[0], "error") && has(r.io.lines[0], "bad_request"));
  r.take();
  r.send(req("START", "x1"));
  CHECK(r.io.lines.size() == 1 && has(r.io.lines[0], "\"id\":\"x1\"") && has(r.io.lines[0], "unknown_request"));
  r.take();
  r.send("{\"v\":2,\"type\":\"identify\",\"id\":\"x2\"}");
  CHECK(r.io.lines.size() == 1 && has(r.io.lines[0], "\"id\":\"x2\"") && has(r.io.lines[0], "unsupported_version"));
}

void testChannelsAndSettings() {
  Rig r;
  r.send(req("get_channels"));
  CHECK(r.io.lines.size() == 1);
  if (r.io.lines.size() == 1) {
    const std::string& l = r.io.lines[0];
    CHECK(isType(l, "channels"));
    CHECK(has(l, "\"id\":\"force\"") && has(l, "\"id\":\"displacement\""));
    CHECK(has(l, "\"quantity\":\"force\"") && has(l, "\"quantity\":\"displacement\""));
    CHECK(has(l, "\"input\":\"AIN0\"") && has(l, "\"input\":\"AIN1\""));
    CHECK(!has(l, "differential"));
    CHECK(has(l, "\"mode\":\"single-ended\""));
  }
  r.take();

  CHECK(r.core.settingsRef() == "b0000001-s1");
  r.send(req("get_settings"));
  CHECK(r.io.lines.size() == 1);
  if (r.io.lines.size() == 1) {
    const std::string& l = r.io.lines[0];
    CHECK(isType(l, "settings"));
    CHECK(has(l, "\"settings_ref\":\"b0000001-s1\""));
    CHECK(has(l, "\"full_scale_mv\":4096") && has(l, "\"data_rate_sps\":128"));
    CHECK(has(l, "\"channel_order\":[\"force\",\"displacement\"]"));
    CHECK(has(l, "\"adc\":\"ads1115\"") && has(l, "\"bits\":16") && has(l, "\"i2c_address\":72"));
  }
  r.take();

  // Valid change.
  r.send("{\"v\":1,\"type\":\"set_settings\",\"id\":\"s\",\"settings\":{\"full_scale_mv\":2048,\"data_rate_sps\":250,\"channel_order\":[\"displacement\"]}}");
  CHECK(r.io.lines.size() == 1 && isType(r.io.lines[0], "settings"));
  if (!r.io.lines.empty()) {
    const std::string& l = r.io.lines[0];
    CHECK(has(l, "\"settings_ref\":\"b0000001-s2\""));
    CHECK(has(l, "\"full_scale_mv\":2048") && has(l, "\"data_rate_sps\":250") && has(l, "\"channel_order\":[\"displacement\"]"));
  }
  CHECK(r.core.settingsRef() == "b0000001-s2");
  r.take();

  // Invalid changes: error, ref unchanged, values unchanged.
  const char* bad[] = {
    "{\"data_rate_sps\":100}",
    "{\"full_scale_mv\":3000}",
    "{\"channel_order\":[\"nope\"]}",
    "{\"channel_order\":[\"force\",\"force\"]}",
    "{\"channel_order\":[\"force\",\"nope\"]}",
    "{\"gain\":2}",
    "{\"full_scale_mv\":1024,\"data_rate_sps\":100}",   // one good, one bad: none applied
  };
  for (const char* s : bad) {
    r.send(std::string("{\"v\":1,\"type\":\"set_settings\",\"id\":\"e\",\"settings\":") + s + "}");
    CHECK(r.io.lines.size() == 1 && isType(r.io.lines[0], "error") && has(r.io.lines[0], "\"code\":\"bad_request\""));
    CHECK(r.core.settingsRef() == "b0000001-s2");
    r.take();
  }
  r.send(req("get_settings"));
  CHECK(r.io.lines.size() == 1 && has(r.io.lines[0], "\"full_scale_mv\":2048") && has(r.io.lines[0], "\"data_rate_sps\":250"));
  r.take();

  // Setting an empty order is refused at the parser; the ref still stays.
  r.send("{\"v\":1,\"type\":\"set_settings\",\"id\":\"e\",\"settings\":{\"channel_order\":[]}}");
  CHECK(r.io.lines.size() == 1 && isType(r.io.lines[0], "error"));
  CHECK(r.core.settingsRef() == "b0000001-s2");
}

void testAdcAbsent() {
  Rig r;
  r.bus.absent = true;
  r.send(req("get_settings"));
  CHECK(r.io.lines.size() == 1 && isType(r.io.lines[0], "fault") && has(r.io.lines[0], "\"code\":\"adc_not_responding\""));
  r.take();
  r.send(req("start_stream"));
  CHECK(r.io.lines.size() == 1 && isType(r.io.lines[0], "fault") && has(r.io.lines[0], "adc_not_responding"));
  CHECK(!r.core.streaming());
  r.take();
  r.poll(50);
  CHECK(r.io.lines.empty());
}

void testStreaming() {
  Rig r;
  r.send(req("start_stream", "go"));
  CHECK(r.io.lines.size() == 2);
  if (r.io.lines.size() == 2) {
    CHECK(isType(r.io.lines[0], "ack") && has(r.io.lines[0], "\"id\":\"go\""));
    CHECK(isType(r.io.lines[1], "status") && has(r.io.lines[1], "\"state\":\"streaming\""));
  }
  CHECK(r.core.streaming());
  r.take();

  r.poll(40);
  std::vector<std::string> samples = r.ofType("sample");
  CHECK(samples.size() == 40);
  uint64_t lastT = 0;
  for (std::size_t i = 0; i < samples.size(); i++) {
    const std::string& l = samples[i];
    CHECK(numberAfter(l, "seq") == static_cast<double>(i));
    CHECK(has(l, i % 2 == 0 ? "\"ch\":\"force\"" : "\"ch\":\"displacement\""));
    CHECK(has(l, "\"boot_id\":\"b0000001\"") && has(l, "\"ref\":\"b0000001-s1\""));
    double t = numberAfter(l, "t");
    CHECK(i == 0 || t > static_cast<double>(lastT));
    lastT = static_cast<uint64_t>(t);
    // Raw count agrees with the fake voltage at the conversion time (4096 mV full scale).
    double ts = t / 1e6;
    double volts = i % 2 == 0 ? 0.2 + 0.1 * ts : 0.05 * ts;
    double expect = std::round(volts / 4.096 * 32768.0);
    CHECK(std::fabs(numberAfter(l, "raw") - expect) <= 1.0);
    CHECK(!has(l, "\"q\""));
  }
  CHECK(r.core.dropped() == 0);

  // Stop.
  r.take();
  r.send(req("stop_stream", "halt"));
  CHECK(r.io.lines.size() == 2);
  if (r.io.lines.size() == 2) {
    CHECK(isType(r.io.lines[0], "ack") && has(r.io.lines[0], "\"id\":\"halt\""));
    CHECK(isType(r.io.lines[1], "status") && has(r.io.lines[1], "\"state\":\"idle\""));
  }
  CHECK(!r.core.streaming());
  r.take();
  int conv = r.bus.conversions;
  r.poll(20);
  CHECK(r.io.lines.empty());
  CHECK(r.bus.conversions == conv);

  // A second stream starts again at seq 0.
  r.send(req("start_stream", "again"));
  r.take();
  r.poll(1);
  CHECK(r.io.lines.size() == 1 && numberAfter(r.io.lines[0], "seq") == 0);
}

void testSettingsBusyWhileStreaming() {
  Rig r;
  r.send(req("start_stream"));
  r.take();
  r.send("{\"v\":1,\"type\":\"set_settings\",\"id\":\"s\",\"settings\":{\"data_rate_sps\":64}}");
  CHECK(r.io.lines.size() == 1 && isType(r.io.lines[0], "error") && has(r.io.lines[0], "\"code\":\"busy\"") && has(r.io.lines[0], "\"id\":\"s\""));
  CHECK(r.core.settingsRef() == "b0000001-s1");
  CHECK(r.core.streaming());
}

void testChannelOrderStreams() {
  Rig r;
  r.send("{\"v\":1,\"type\":\"set_settings\",\"id\":\"s\",\"settings\":{\"channel_order\":[\"displacement\"]}}");
  r.send(req("start_stream"));
  r.take();
  r.poll(10);
  std::vector<std::string> samples = r.ofType("sample");
  CHECK(samples.size() == 10);
  for (const std::string& l : samples) {
    CHECK(has(l, "\"ch\":\"displacement\"") && !has(l, "\"ch\":\"force\""));
    CHECK(has(l, "\"ref\":\"b0000001-s2\""));
  }
  r.send(req("stop_stream"));

  // Reversed order starts with displacement.
  Rig r2;
  r2.send("{\"v\":1,\"type\":\"set_settings\",\"id\":\"s\",\"settings\":{\"channel_order\":[\"displacement\",\"force\"]}}");
  r2.send(req("start_stream"));
  r2.take();
  r2.poll(2);
  std::vector<std::string> s2 = r2.ofType("sample");
  CHECK(s2.size() == 2 && has(s2[0], "\"ch\":\"displacement\"") && has(s2[1], "\"ch\":\"force\""));
}

void testDropped() {
  Rig r;
  r.send(req("start_stream"));
  r.take();
  r.poll(10);
  r.io.room = 0;
  r.poll(7);
  r.io.room = 1 << 20;
  CHECK(r.core.dropped() == 7);
  r.poll(5);
  std::vector<std::string> samples = r.ofType("sample");
  CHECK(samples.size() == 15);   // 10 + 5, the 7 in between were not written
  if (samples.size() == 15) {
    CHECK(numberAfter(samples[9], "seq") == 9);
    CHECK(numberAfter(samples[10], "seq") == 17);   // jumps by exactly the dropped count
    CHECK(numberAfter(samples[14], "seq") == 21);
  }
  r.take();
  r.send(req("stop_stream"));
  CHECK(r.io.lines.size() == 2 && has(r.io.lines[1], "\"dropped\":7"));
}

void testAchievedRate() {
  Rig r;
  r.send(req("start_stream"));
  r.take();
  r.pollFor(3.5);
  std::vector<std::string> status = r.ofType("status");
  CHECK(status.size() == 3);   // about one per simulated second
  for (const std::string& l : status) {
    double a = numberAfter(l, "achieved_sps");
    CHECK(a >= 0.8 * 128 && a <= 1.01 * 128);
    CHECK(has(l, "\"state\":\"streaming\""));
  }
  // Note: the nominal period is truncated to whole microseconds, so the rate can be a hair above the setting.
  // A faster rate gives a higher number.
  Rig r2;
  r2.send("{\"v\":1,\"type\":\"set_settings\",\"id\":\"s\",\"settings\":{\"data_rate_sps\":860}}");
  r2.send(req("start_stream"));
  r2.take();
  r2.pollFor(2.2);
  std::vector<std::string> st2 = r2.ofType("status");
  CHECK(st2.size() == 2);
  for (const std::string& l : st2) {
    double a = numberAfter(l, "achieved_sps");
    CHECK(a >= 0.8 * 860 && a <= 1.01 * 860);
  }
}

void testBusLostMidStream() {
  Rig r;
  r.send(req("start_stream"));
  r.take();
  r.poll(4);
  r.take();
  r.bus.absent = true;
  r.poll(1);
  std::vector<std::string> lines = r.take();
  CHECK(lines.size() == 2);
  if (lines.size() == 2) {
    CHECK(isType(lines[0], "fault") && has(lines[0], "\"code\":\"adc_error\""));
    CHECK(isType(lines[1], "status") && has(lines[1], "\"state\":\"idle\""));
  }
  CHECK(!r.core.streaming());
  r.poll(10);
  CHECK(r.io.lines.empty());

  // A stuck conversion is the same.
  Rig r2;
  r2.send(req("start_stream"));
  r2.take();
  r2.bus.stuck = true;
  r2.poll(1);
  CHECK(!r2.core.streaming());
  CHECK(r2.ofType("fault").size() == 1);
}

void testOverrange() {
  Rig r;
  r.bus.volts = [](int input, double) { return input == 0 ? 5.0 : input == 1 ? -5.0 : 0.0; };
  r.send(req("start_stream"));
  r.take();
  r.poll(2);
  std::vector<std::string> s = r.ofType("sample");
  CHECK(s.size() == 2);
  if (s.size() == 2) {
    CHECK(has(s[0], "\"raw\":32767") && has(s[0], "\"q\":[\"overrange\"]"));
    CHECK(has(s[1], "\"raw\":-32768") && has(s[1], "\"q\":[\"overrange\"]"));
  }
}

}  // namespace

int main() {
  testParseAccepted();
  testParseRefused();
  testParseKeepsId();
  testMessageLines();
  testConfigWord();
  testDriver();
  testHelloAndIdentify();
  testFraming();
  testChannelsAndSettings();
  testAdcAbsent();
  testStreaming();
  testSettingsBusyWhileStreaming();
  testChannelOrderStreams();
  testDropped();
  testAchievedRate();
  testBusLostMidStream();
  testOverrange();
  std::printf("%d checks, %d failed\n", g_checks, g_failed);
  return g_failed ? 1 : 0;
}
