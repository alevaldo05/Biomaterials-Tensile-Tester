#include "protocol.h"

#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <utility>

namespace tt {
namespace {

// ---------- a small JSON reader: enough for the six requests, strict about the grammar ----------

struct JVal {
  enum Kind { Null, Bool, Num, Str, Arr, Obj } kind = Null;
  bool b = false;
  double n = 0;
  std::string s;
  std::vector<JVal> arr;
  std::vector<std::pair<std::string, JVal>> obj;
  const JVal* get(const std::string& k) const {
    for (const auto& p : obj)
      if (p.first == k) return &p.second;
    return nullptr;
  }
};

class Reader {
 public:
  explicit Reader(const std::string& t) : t_(t) {}
  bool parse(JVal& out) {
    ws();
    if (!value(out, 0)) return false;
    ws();
    return i_ == t_.size();
  }

 private:
  const std::string& t_;
  std::size_t i_ = 0;

  bool more() const { return i_ < t_.size(); }
  char peek() const { return t_[i_]; }
  void ws() {
    while (more() && (peek() == ' ' || peek() == '\t' || peek() == '\r' || peek() == '\n')) i_++;
  }
  bool word(const char* w) {
    std::size_t n = std::strlen(w);
    if (t_.compare(i_, n, w) != 0) return false;
    i_ += n;
    return true;
  }
  bool value(JVal& v, int depth) {
    if (depth > 4 || !more()) return false;
    char c = peek();
    if (c == '{') return object(v, depth);
    if (c == '[') return array(v, depth);
    if (c == '"') { v.kind = JVal::Str; return text(v.s); }
    if (c == 't') { v.kind = JVal::Bool; v.b = true; return word("true"); }
    if (c == 'f') { v.kind = JVal::Bool; return word("false"); }
    if (c == 'n') { v.kind = JVal::Null; return word("null"); }
    return number(v);
  }
  bool object(JVal& v, int depth) {
    v.kind = JVal::Obj;
    i_++;
    ws();
    if (more() && peek() == '}') { i_++; return true; }
    for (;;) {
      ws();
      std::string key;
      if (!more() || peek() != '"' || !text(key)) return false;
      ws();
      if (!more() || peek() != ':') return false;
      i_++;
      ws();
      JVal x;
      if (!value(x, depth + 1)) return false;
      if (v.get(key)) return false;   // a key given twice is refused
      v.obj.emplace_back(key, std::move(x));
      ws();
      if (more() && peek() == ',') { i_++; continue; }
      if (more() && peek() == '}') { i_++; return true; }
      return false;
    }
  }
  bool array(JVal& v, int depth) {
    v.kind = JVal::Arr;
    i_++;
    ws();
    if (more() && peek() == ']') { i_++; return true; }
    for (;;) {
      ws();
      JVal x;
      if (!value(x, depth + 1)) return false;
      v.arr.push_back(std::move(x));
      ws();
      if (more() && peek() == ',') { i_++; continue; }
      if (more() && peek() == ']') { i_++; return true; }
      return false;
    }
  }
  bool text(std::string& out) {
    i_++;   // the opening quote
    while (more()) {
      char c = t_[i_++];
      if (c == '"') return true;
      if (static_cast<unsigned char>(c) < 0x20) return false;
      if (c != '\\') { out += c; continue; }
      if (!more()) return false;
      char e = t_[i_++];
      switch (e) {
        case '"': out += '"'; break;
        case '\\': out += '\\'; break;
        case '/': out += '/'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        case 'u':
          if (i_ + 4 > t_.size()) return false;
          for (int k = 0; k < 4; k++)
            if (!std::isxdigit(static_cast<unsigned char>(t_[i_ + k]))) return false;
          out += '?';   // no request needs characters outside plain ASCII
          i_ += 4;
          break;
        default: return false;
      }
    }
    return false;
  }
  bool digits() {
    std::size_t s = i_;
    while (more() && std::isdigit(static_cast<unsigned char>(peek()))) i_++;
    return i_ > s;
  }
  bool number(JVal& v) {
    std::size_t s = i_;
    if (more() && peek() == '-') i_++;
    if (!digits()) return false;
    if (more() && peek() == '.') { i_++; if (!digits()) return false; }
    if (more() && (peek() == 'e' || peek() == 'E')) {
      i_++;
      if (more() && (peek() == '+' || peek() == '-')) i_++;
      if (!digits()) return false;
    }
    v.kind = JVal::Num;
    v.n = std::strtod(t_.substr(s, i_ - s).c_str(), nullptr);
    return std::isfinite(v.n);
  }
};

bool isWholePositive(const JVal* v) {
  return v && v->kind == JVal::Num && v->n > 0 && v->n <= 1e9 && v->n == std::floor(v->n);
}

struct TypeName { const char* name; RequestType type; };
const TypeName kTypes[] = {
  {"identify", RequestType::Identify},       {"get_channels", RequestType::GetChannels},
  {"get_settings", RequestType::GetSettings}, {"set_settings", RequestType::SetSettings},
  {"start_stream", RequestType::StartStream}, {"stop_stream", RequestType::StopStream},
};

ParsedRequest refuse(ParsedRequest r, RequestProblem p, const char* why) {
  r.problem = p;
  r.detail = why;
  return r;
}

std::string number(double v) {
  char buf[32];
  std::snprintf(buf, sizeof buf, "%.2f", v);
  std::string s(buf);
  while (!s.empty() && s.back() == '0') s.pop_back();
  if (!s.empty() && s.back() == '.') s.pop_back();
  return s;
}

std::string head(const char* type) {
  return std::string("{\"v\":") + std::to_string(kProtocolVersion) + ",\"type\":\"" + type + "\"";
}

}  // namespace

const char* errorCode(RequestProblem p) {
  switch (p) {
    case RequestProblem::UnsupportedVersion: return "unsupported_version";
    case RequestProblem::UnknownRequest: return "unknown_request";
    default: return "bad_request";
  }
}

ParsedRequest parseRequest(const std::string& line) {
  ParsedRequest r;
  if (line.size() > kMaxLine) return refuse(r, RequestProblem::BadRequest, "the line is too long");
  JVal root;
  Reader reader(line);
  if (!reader.parse(root) || root.kind != JVal::Obj) return refuse(r, RequestProblem::NotJson, "not a JSON object");
  const JVal* id = root.get("id");
  if (id && id->kind == JVal::Str && !id->s.empty() && id->s.size() <= 64) r.id = id->s;
  const JVal* v = root.get("v");
  if (!v || v->kind != JVal::Num || v->n != kProtocolVersion) return refuse(r, RequestProblem::UnsupportedVersion, "this device speaks protocol version 1");
  const JVal* type = root.get("type");
  if (!type || type->kind != JVal::Str) return refuse(r, RequestProblem::BadRequest, "the request has no type");
  const TypeName* known = nullptr;
  for (const auto& t : kTypes)
    if (type->s == t.name) known = &t;
  if (!known) return refuse(r, RequestProblem::UnknownRequest, "unknown request");
  if (r.id.empty()) return refuse(r, RequestProblem::BadRequest, "the request has no id");
  r.request.type = known->type;
  r.request.id = r.id;
  for (const auto& p : root.obj) {
    bool allowed = p.first == "v" || p.first == "type" || p.first == "id" || (p.first == "settings" && known->type == RequestType::SetSettings);
    if (!allowed) return refuse(r, RequestProblem::BadRequest, "unexpected field in the request");
  }
  if (known->type != RequestType::SetSettings) return r;
  const JVal* s = root.get("settings");
  if (!s || s->kind != JVal::Obj) return refuse(r, RequestProblem::BadRequest, "set_settings needs a settings object");
  SettingsChange& c = r.request.settings;
  for (const auto& p : s->obj) {
    if (p.first == "full_scale_mv") {
      if (!isWholePositive(&p.second)) return refuse(r, RequestProblem::BadRequest, "full_scale_mv must be a positive whole number");
      c.hasFullScale = true;
      c.fullScale_mV = static_cast<long>(p.second.n);
    } else if (p.first == "data_rate_sps") {
      if (!isWholePositive(&p.second)) return refuse(r, RequestProblem::BadRequest, "data_rate_sps must be a positive whole number");
      c.hasDataRate = true;
      c.dataRate_sps = static_cast<long>(p.second.n);
    } else if (p.first == "channel_order") {
      if (p.second.kind != JVal::Arr || p.second.arr.empty() || p.second.arr.size() > 16) return refuse(r, RequestProblem::BadRequest, "channel_order must list 1 to 16 channels");
      for (const auto& x : p.second.arr) {
        if (x.kind != JVal::Str || x.s.empty() || x.s.size() > 64) return refuse(r, RequestProblem::BadRequest, "channel_order must list channel ids");
        c.order.push_back(x.s);
      }
      c.hasOrder = true;
    } else {
      return refuse(r, RequestProblem::BadRequest, "unknown setting");
    }
  }
  return r;
}

std::string jsonString(const std::string& s) {
  std::string out = "\"";
  for (char ch : s) {
    unsigned char c = static_cast<unsigned char>(ch);
    if (c == '"') out += "\\\"";
    else if (c == '\\') out += "\\\\";
    else if (c < 0x20) {
      char buf[8];
      std::snprintf(buf, sizeof buf, "\\u%04x", c);
      out += buf;
    } else out += ch;
  }
  return out + "\"";
}

std::string helloLine(const Identity& id) {
  return head("hello") + ",\"device_id\":" + jsonString(id.deviceId) + ",\"device_type\":" + jsonString(id.deviceType) +
         ",\"sw_version\":" + jsonString(id.swVersion) + ",\"boot_id\":" + jsonString(id.bootId) + ",\"time_unit\":\"us\"}\n";
}

std::string channelsLine(const std::vector<ChannelInfo>& channels) {
  std::string out = head("channels") + ",\"channels\":[";
  for (std::size_t i = 0; i < channels.size(); i++) {
    const ChannelInfo& c = channels[i];
    if (i) out += ",";
    out += "{\"id\":" + jsonString(c.id) + ",\"quantity\":" + jsonString(c.quantity) + ",\"mode\":" + jsonString(c.mode) +
           ",\"input\":" + jsonString(c.input) + ",\"encoding\":\"int16\"";
    if (!c.label.empty()) out += ",\"label\":" + jsonString(c.label);
    out += "}";
  }
  return out + "]}\n";
}

std::string settingsLine(const SettingsInfo& s) {
  std::string out = head("settings") + ",\"confirmed\":{\"settings_ref\":" + jsonString(s.ref) + ",\"adc\":" + jsonString(s.adc) +
                    ",\"bits\":" + std::to_string(s.bits);
  if (s.i2cAddress >= 0) out += ",\"i2c_address\":" + std::to_string(s.i2cAddress);
  out += ",\"full_scale_mv\":" + std::to_string(s.fullScale_mV) + ",\"data_rate_sps\":" + std::to_string(s.dataRate_sps) + ",\"channel_order\":[";
  for (std::size_t i = 0; i < s.order.size(); i++) out += (i ? "," : "") + jsonString(s.order[i]);
  out += "]";
  if (!s.filter.empty()) out += ",\"filter\":" + jsonString(s.filter);
  return out + "}}\n";
}

std::string sampleLine(const std::string& bootId, uint32_t seq, uint64_t t_us, const std::string& channel, int32_t raw,
                       const std::string& ref, const std::vector<std::string>& flags) {
  std::string out = head("sample") + ",\"boot_id\":" + jsonString(bootId) + ",\"seq\":" + std::to_string(seq) +
                    ",\"t\":" + std::to_string(t_us) + ",\"ch\":" + jsonString(channel) + ",\"raw\":" + std::to_string(raw) +
                    ",\"ref\":" + jsonString(ref);
  if (!flags.empty()) {
    out += ",\"q\":[";
    for (std::size_t i = 0; i < flags.size(); i++) out += (i ? "," : "") + jsonString(flags[i]);
    out += "]";
  }
  return out + "}\n";
}

std::string statusLine(bool streaming, bool hasAchieved, double achieved_sps, uint32_t dropped) {
  std::string out = head("status") + ",\"state\":" + (streaming ? "\"streaming\"" : "\"idle\"");
  if (hasAchieved) out += ",\"achieved_sps\":" + number(achieved_sps < 0 ? 0 : achieved_sps);
  return out + ",\"dropped\":" + std::to_string(dropped) + "}\n";
}

std::string faultLine(const std::string& code, const std::string& message) {
  return head("fault") + ",\"code\":" + jsonString(code) + ",\"message\":" + jsonString(message.substr(0, 200)) + "}\n";
}

std::string ackLine(const std::string& id) { return head("ack") + ",\"id\":" + jsonString(id) + "}\n"; }

std::string errorLine(const std::string& id, const std::string& code, const std::string& message) {
  std::string out = head("error");
  if (!id.empty()) out += ",\"id\":" + jsonString(id);
  return out + ",\"code\":" + jsonString(code) + ",\"message\":" + jsonString(message.substr(0, 200)) + "}\n";
}

}  // namespace tt
