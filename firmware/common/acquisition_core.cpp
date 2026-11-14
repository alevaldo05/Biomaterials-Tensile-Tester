#include "acquisition_core.h"

#include <cstring>
#include <utility>

namespace tt {

AcquisitionCore::AcquisitionCore(CoreConfig config, AdcPort& adc, Platform& io)
    : cfg_(std::move(config)), adc_(adc), io_(io), fullScale_mV_(cfg_.fullScale_mV), dataRate_sps_(cfg_.dataRate_sps) {
  for (std::size_t i = 0; i < cfg_.channels.size(); i++) order_.push_back(i);
}

std::string AcquisitionCore::settingsRef() const { return cfg_.bootId + "-s" + std::to_string(refNo_); }

bool AcquisitionCore::send(const std::string& line) {
  if (io_.writeRoom() < line.size()) return false;
  io_.write(line);
  return true;
}

void AcquisitionCore::begin() { io_.write(helloLine({cfg_.deviceId, cfg_.deviceType, cfg_.swVersion, cfg_.bootId})); }

void AcquisitionCore::receive(const char* data, std::size_t n) {
  for (std::size_t i = 0; i < n; i++) {
    char c = data[i];
    if (c == '\n' || c == '\r') {
      if (skipping_) io_.write(errorLine("", "bad_request", "the line is too long"));
      else if (!in_.empty()) handleLine(in_);
      skipping_ = false;
      in_.clear();
    } else if (!skipping_) {
      in_ += c;
      if (in_.size() > kMaxLine) { skipping_ = true; in_.clear(); }
    }
  }
}

void AcquisitionCore::handleLine(const std::string& line) {
  ParsedRequest p = parseRequest(line);
  if (p.problem != RequestProblem::None) { io_.write(errorLine(p.id, errorCode(p.problem), p.detail)); return; }
  handle(p.request);
}

void AcquisitionCore::sendSettings() {
  SettingsInfo s;
  s.ref = settingsRef();
  s.adc = adc_.model();
  s.bits = adc_.bits();
  s.i2cAddress = adc_.i2cAddress();
  s.fullScale_mV = fullScale_mV_;
  s.dataRate_sps = dataRate_sps_;
  for (std::size_t i : order_) s.order.push_back(cfg_.channels[i].id);
  s.filter = "none (single-shot conversions, one channel after another)";
  io_.write(settingsLine(s));
}

void AcquisitionCore::stop() {
  streaming_ = false;
  windowCount_ = 0;
}

void AcquisitionCore::handle(const Request& r) {
  switch (r.type) {
    case RequestType::Identify:
      io_.write(helloLine({cfg_.deviceId, cfg_.deviceType, cfg_.swVersion, cfg_.bootId}));
      break;
    case RequestType::GetChannels: {
      std::vector<ChannelInfo> list;
      for (const ChannelConfig& c : cfg_.channels)
        list.push_back({c.id, c.quantity, std::strchr(c.input, '-') ? "differential" : "single-ended", c.input, c.label ? c.label : ""});
      io_.write(channelsLine(list));
      break;
    }
    case RequestType::GetSettings:
      if (!adc_.present()) io_.write(faultLine("adc_not_responding", std::string("no answer from the ") + adc_.model()));
      else sendSettings();
      break;
    case RequestType::SetSettings: {
      if (streaming_) { io_.write(errorLine(r.id, "busy", "stop the stream before changing settings")); break; }
      const SettingsChange& c = r.settings;
      std::vector<std::size_t> order = order_;
      if (c.hasOrder) {
        order.clear();
        for (const std::string& id : c.order) {
          std::size_t found = cfg_.channels.size();
          for (std::size_t i = 0; i < cfg_.channels.size(); i++)
            if (id == cfg_.channels[i].id) found = i;
          bool repeated = false;
          for (std::size_t k : order) repeated = repeated || k == found;
          if (found == cfg_.channels.size() || repeated) { order.clear(); break; }
          order.push_back(found);
        }
      }
      bool ok = (!c.hasFullScale || adc_.supportsRange(c.fullScale_mV)) && (!c.hasDataRate || adc_.supportsRate(c.dataRate_sps)) && !order.empty();
      if (!ok) { io_.write(errorLine(r.id, "bad_request", "a setting is outside what this ADC supports")); break; }
      if (c.hasFullScale) fullScale_mV_ = c.fullScale_mV;
      if (c.hasDataRate) dataRate_sps_ = c.dataRate_sps;
      order_ = order;
      refNo_++;   // a new reference for every change, so old samples keep their meaning
      sendSettings();
      break;
    }
    case RequestType::StartStream:
      if (!adc_.present()) { io_.write(faultLine("adc_not_responding", std::string("no answer from the ") + adc_.model())); break; }
      streaming_ = true;
      seq_ = 0;
      dropped_ = 0;
      next_ = 0;
      windowStart_ = io_.micros64();
      windowCount_ = 0;
      io_.write(ackLine(r.id));
      io_.write(statusLine(true, false, 0, 0));
      break;
    case RequestType::StopStream:
      stop();
      io_.write(ackLine(r.id));
      io_.write(statusLine(false, false, 0, dropped_));
      break;
  }
}

void AcquisitionCore::poll() {
  if (!streaming_ || order_.empty()) return;
  const ChannelConfig& ch = cfg_.channels[order_[next_]];
  next_ = (next_ + 1) % order_.size();
  uint64_t t = io_.micros64();   // the time the conversion was started
  int16_t raw = 0;
  if (!adc_.convert(ch.input, fullScale_mV_, dataRate_sps_, raw)) {
    stop();
    io_.write(faultLine("adc_error", std::string("the ") + adc_.model() + " did not complete a conversion on " + ch.input));
    io_.write(statusLine(false, false, 0, dropped_));
    return;
  }
  std::vector<std::string> flags;
  if (raw == 32767 || raw == -32768) flags.push_back("overrange");
  // The sequence number counts every conversion, sent or not, so the app sees where samples were lost.
  if (!send(sampleLine(cfg_.bootId, seq_++, t, ch.id, raw, settingsRef(), flags))) dropped_++;
  windowCount_++;
  uint64_t now = io_.micros64();
  if (now - windowStart_ >= 1000000ULL) {
    double achieved = windowCount_ * 1e6 / static_cast<double>(now - windowStart_);
    send(statusLine(true, true, achieved, dropped_));
    windowStart_ = now;
    windowCount_ = 0;
  }
}

}  // namespace tt
