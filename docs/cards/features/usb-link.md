# USB link

Feature card. Update it in the same change as the feature.

## Purpose
Web Serial connection to the tester (Chrome only). The message format is a draft.

## Files
- `live.js` (button `c-usb`, `c-off`)
- `data/device.js` (baud rate, commands START/STOP/TARE/PING, reading columns, limits)

## What the user sees
- Connect to tester (USB), connection status, error messages

## Behavior to keep
- Message format changes only in `data/device.js`
- The page says the hardware connection is untested
- Other browsers show that USB is not offered

## Labels that must stay
- "hardware connection is untested"
- Draft badge

## Depends on
- Live test

## How to check
- Without hardware, only the simulator and the unavailable message can be checked
