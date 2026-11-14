# Tester interface: what the circuit must do (requirements for review)

Status: draft, for the owner's and a qualified reviewer's review. This is a list of requirements and a review record. It is **not** a design. Nothing is connected to the tester until every row of the review record below is signed off.

Related: [SETUP.md](SETUP.md) (what is not known, electrical restrictions), [BREADBOARD-TEST.md](BREADBOARD-TEST.md) (first bench test, tester disconnected), [CALIBRATION-PLAN.md](CALIBRATION-PLAN.md).

## 1. What is known and what is not

| Item | Status |
|---|---|
| The crosshead is driven by an 80 V DC motor | Reported by the owner. Not yet verified. |
| Analog outputs (which exist, force and displacement or others) | Unknown. A nominal 0–5 V analog output is mentioned in project documents; that is all. |
| Connector and pins | Unknown. |
| Output range and scaling (volts per N, volts per mm) | Unknown. |
| Output impedance | Unknown. |
| Ground reference of the outputs (and how it relates to the motor drive, mains earth, and the PC) | Unknown. |
| Displacement source (analog output or encoder) | Unknown. |
| Sign of the force output in tension | Unknown. |
| Load-cell capacity and sensitivity | Unknown. |
| Whether the force output is amplified | Unknown. |
| Any computer-control protocol | Unknown. The app does not use one. |

Nothing in this repository assumes any of these. Do not guess them.

## 2. Hazards of an 80 V DC motor drive (general)

- 80 V DC is above the roughly 60 V DC limit commonly used for safety extra-low voltage. Treat the drive as hazardous until a qualified person says otherwise.
- A motor drive (especially a brush motor or a PWM drive) produces electrical noise and can carry large currents in its ground wiring.
- The tester's signal ground may be tied to the motor drive or to mains earth. A direct connection to a USB-powered PC can then create a ground loop, or put a fault voltage on the PC and the USB cable.
- **Never connect anything to the motor terminals or the drive wiring.** Connect only to documented signal outputs.

## 3. Step 1: survey with a meter

Done by a qualified person. First with the tester unplugged (inspect and identify), then powered with the motor idle. Use a meter only; do not connect the board.

1. From the tester's documentation, identify which outputs exist and what they mean. Write down where each came from.
2. Measure each output against its own signal ground at rest, then through a slow manual move of the crosshead using the tester's own controls.
3. Measure DC volts and AC volts between the tester's signal ground and the PC's USB ground or chassis, with the PC side unplugged from the board.

Record:

| Output | Pin | At rest (V) | At maximum (V) | AC noise (V) | Ground to PC (V DC / V AC) | Who | Date |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |

## 4. Step 2: requirements for the circuit

Each is a requirement the reviewed design must meet. The choices (parts, values, ratings) are the reviewer's.

| # | Requirement | Reason |
|---|---|---|
| R1 | Every ADC input stays within 0–3.3 V over the whole output range and in a fault. The reviewer should consider an output shorted to its maximum and to the 80 V supply. | The ADS1115 is powered at 3.3 V. Its inputs must stay within its supply rails. The PGA range does not permit higher voltages. |
| R2 | Scale the signal to fit. For example, a 0–5 V output needs a divider or an attenuating amplifier to leave headroom below 3.3 V. The resulting gain and offset are entered in the device profile. | The app converts counts to volts to N/mm using the profile; a wrong profile gives wrong numbers. |
| R3 | Input protection: series resistance plus clamping to the rails (for example low-leakage diodes or a TVS), with the current limited. | A fault or a spike must not reach the ADC pin. |
| R4 | Anti-alias low-pass filter matched to the sampling. Two channels share the ADC, so at 128 SPS each channel gets about 64 samples/s. The cutoff must be well below half the per-channel rate; the reviewer chooses it. | Motor and drive noise would otherwise fold into the readings. |
| R5 | Galvanic isolation between the tester side and the PC/USB side. Strongly recommended because of the motor drive and the unknown grounding. Two approaches are in the table below. The isolation (working-voltage) rating must be chosen by the reviewer. | Protects the PC and the person using it; breaks ground loops. |
| R6 | Decide differential or single-ended input after the survey. The ADS1115 supports differential pairs. | Depends on how the tester's outputs are referenced. |
| R7 | Enclosure, strain relief, and labelled connectors. No exposed conductors near the tester. | Safe handling. |
| R8 | No connection to motor power, the drive, limit switches, or emergency-stop circuits. The tester's own controls and E-stop stay the only way to move or stop it. | The app only reads. |
| R9 | Documentation: schematic, part list, ratings, and the device-profile values (gain and offset per channel) the circuit produces. | The reviewer and the profile need them. |

Isolation approaches for R5 (examples to evaluate, nothing is chosen):

| Approach | Example | Pros | Cons |
|---|---|---|---|
| (a) Isolate the signal | An isolated amplifier (TI AMC1311 or ISO224 class), or an isolated ADC module, powered by an isolated DC-DC converter on the tester side | The board stays at the PC's ground, away from the tester | More parts; the isolated stage adds its own gain, offset, and noise to the profile |
| (b) Isolate the USB link | A USB isolator for full-speed USB (for example ADuM4160 or ADuM3160 based modules), so the ESP32 and ADS1115 sit on the tester's ground | Simpler | The board now shares the tester's ground, so R1 to R4 matter more; the isolator's rating must suit the hazard |

## 5. Step 3: bench check of the built circuit, before the tester

1. Feed known voltages across the full range and beyond, from a lab supply through a current-limiting resistor, and confirm with a meter that the ADC input never leaves 0–3.3 V.
2. Check isolation with a meter: no continuity between the two sides.
3. Write down the readings with the bench record in [SETUP.md](SETUP.md).

## 6. Review record (sign-off)

The bench record's "reviewed by" row in [SETUP.md](SETUP.md) refers to this table.

| Item | Checked by | Role | Date | Notes |
|---|---|---|---|---|
| Pinout verified | | | | |
| Survey done (section 3) | | | | |
| Schematic reviewed | | | | |
| Fault cases reviewed | | | | |
| Isolation reviewed | | | | |
| Bench check passed (section 5) | | | | |
| Device profile values recorded | | | | |

## 7. What the app will not do

- It sends no command to the tester: no Start, STOP, Tare, speed, or position.
- The on-screen STOP is not an emergency stop. The tester's own E-stop is the only emergency stop.
- Machine control stays "unsupported" until the tester's interface is verified and reviewed.
