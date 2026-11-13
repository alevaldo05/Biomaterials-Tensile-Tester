#!/usr/bin/env bash
# Builds the firmware's portable code (protocol, acquisition loop, ADS1115 driver) for this computer,
# runs its unit tests, and builds the host device program used by the app's firmware test.
# Usage: bash firmware/esp32-ads1115/test/host/build-and-test.sh [output folder]
# With HOST_ONLY=1 it only builds the host device program.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
src="$here/../../src"
out="${1:-$here/../../.host-build}"
mkdir -p "$out"
flags=(-std=c++17 -O1 -Wall -Wextra -Wpedantic -Werror -I"$src" -I"$here/../../include")
code=("$src/protocol.cpp" "$src/acquisition_core.cpp" "$src/ads1115_driver.cpp")
g++ "${flags[@]}" "${code[@]}" "$here/host_device.cpp" -o "$out/host_device"
if [ "${HOST_ONLY:-}" != "1" ] && [ -f "$here/test_native.cpp" ]; then
  g++ "${flags[@]}" "${code[@]}" "$here/test_native.cpp" -o "$out/test_native"
  "$out/test_native"
fi
echo "Built $out/host_device"
