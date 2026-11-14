// The firmware's own protocol and acquisition code, run as a program on a computer with a pretend ADS1115.
// Requests arrive on stdin; the device's lines go to stdout. Lines that start with "#" control the test:
//   #step N      make N poll() calls (one conversion each while streaming)
//   #adc off|on  the ADC stops or starts answering
//   #full N      the line to the computer is full for the next N lines
//   #reboot      the device restarts (new boot id, announces itself)
// Used by packages/recording/test/firmware.test.ts to run the app against the firmware's code.
#include <iostream>
#include <memory>
#include <string>

#include "fake_board.h"

int main() {
  std::ios::sync_with_stdio(false);
  tt_test::Clock clock;
  tt_test::FakeAds1115Bus bus(clock);
  tt_test::FakePlatform io(clock);
  io.keep = false;
  int full = 0;
  io.onWrite = [](const std::string& line) { std::cout << line; };
  struct RoomGate : tt::Platform {
    tt_test::FakePlatform& inner; int& full;
    RoomGate(tt_test::FakePlatform& i, int& f) : inner(i), full(f) {}
    uint64_t micros64() override { return inner.micros64(); }
    std::size_t writeRoom() override { if (full > 0) { full--; return 0; } return inner.writeRoom(); }
    void write(const std::string& l) override { inner.write(l); }
  } gate(io, full);
  tt::Ads1115 adc(bus, 0x48);
  int boot = 1;
  auto bootId = [&]() { char b[16]; std::snprintf(b, sizeof b, "b%07d", boot); return std::string(b); };
  auto core = std::make_unique<tt::AcquisitionCore>(tt_test::exampleConfig(bootId()), adc, gate);
  core->begin();
  std::cout.flush();
  std::string line;
  while (std::getline(std::cin, line)) {
    if (line.rfind("#step ", 0) == 0) {
      long n = std::stol(line.substr(6));
      for (long i = 0; i < n; i++) { core->poll(); clock.now_us += 20; }
    } else if (line == "#adc off") bus.absent = true;
    else if (line == "#adc on") bus.absent = false;
    else if (line.rfind("#full ", 0) == 0) full = std::stoi(line.substr(6));
    else if (line == "#reboot") {
      boot++;
      clock.now_us = 400000;
      core = std::make_unique<tt::AcquisitionCore>(tt_test::exampleConfig(bootId()), adc, gate);
      core->begin();
    } else {
      line += "\n";
      core->receive(line.data(), line.size());
    }
    std::cout << "#done\n";
    std::cout.flush();
  }
  return 0;
}
