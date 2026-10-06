<div align="center">

# FineLynk

**An offline-first flood detection and emergency alert network built on ESP-NOW.**

[![Platform](https://img.shields.io/badge/platform-ESP32-informational)](https://www.espressif.com/en/products/socs/esp32)
[![Framework](https://img.shields.io/badge/framework-Arduino-00979D)](https://www.arduino.cc/)
[![Protocol](https://img.shields.io/badge/protocol-ESP--NOW-orange)](https://www.espressif.com/en/solutions/low-power-solutions/esp-now)
[![Connectivity](https://img.shields.io/badge/connectivity-offline--first-success)](#design-rationale)
[![Status](https://img.shields.io/badge/status-prototype-yellow)](#project-status)

</div>

---

## Table of contents

1. [Overview](#overview)
2. [Design rationale](#design-rationale)
3. [System architecture](#system-architecture)
4. [Technical specifications](#technical-specifications)
5. [Bill of materials](#bill-of-materials)
6. [Pin assignments](#pin-assignments)
7. [Installation](#installation)
8. [Verification](#verification)
9. [Operation](#operation)
10. [Configuration reference](#configuration-reference)
11. [Sensor calibration](#sensor-calibration)
12. [HTTP API reference](#http-api-reference)
13. [ESP-NOW protocol specification](#esp-now-protocol-specification)
14. [Repository structure](#repository-structure)
15. [Troubleshooting](#troubleshooting)
16. [Design constraints](#design-constraints)
17. [Roadmap](#roadmap)
18. [Project status](#project-status)
19. [License](#license)

---

## Overview

FineLynk is a distributed flood monitoring system composed of autonomous sensor
stations and a central master unit. Stations measure water level, detect
threshold breaches, and accept manual distress input. Alerts propagate to the
master unit over ESP-NOW, a connectionless peer-to-peer radio protocol operating
independently of any Wi-Fi infrastructure.

The system requires **no internet connection, router, gateway, or cellular
service** at any point in the alert path. Both the master unit and each sensor
station host a self-contained web interface served directly from the
microcontroller over its own access point.

### Capabilities

| Capability | Implementation |
|---|---|
| Automatic flood detection | Threshold comparison with hysteresis on a resistive water level probe |
| Manual distress signalling | Physical push button and web-based trigger, both latching |
| Multi-station monitoring | Master unit tracks up to eight stations concurrently, auto-registered |
| Station liveness detection | Five-second heartbeat timeout with per-station last-seen timestamps |
| Local alarm output | Blinking indicator and pulsed audible alarm at the master unit |
| Bidirectional command | Master issues clear commands to stations by unicast |
| Delivery assurance | Transmit-status callback with bounded automatic retry |
| Web interfaces | Served from program memory on both unit types, zero external dependencies |

---

## Design rationale

Conventional telemetry systems publish sensor data to a cloud endpoint over
Wi-Fi or cellular. In a flood scenario this dependency chain fails early and
predictably: mains power is lost, customer-premises equipment goes offline, and
cellular capacity saturates.

FineLynk eliminates the dependency entirely. The complete detection-to-alarm
path — sensor acquisition, threshold evaluation, radio transmission, reception,
and alarm actuation — executes within radio range on local power. Network
infrastructure is not a prerequisite for operation and its absence does not
degrade the system.

Web interfaces are served from the microcontrollers themselves. A responder
associates with a station's access point and receives a live interface with no
supporting infrastructure.

---

## System architecture

```
┌─────────────────────────┐    ┌─────────────────────────┐
│   SENSOR STATION        │    │   SENSOR STATION        │
│   Flood-01              │    │   Flood-02              │
├─────────────────────────┤    ├─────────────────────────┤
│ Resistive water probe   │    │ Resistive water probe   │
│ SOS push button         │    │ SOS push button         │
│ Status indicator        │    │ Status indicator        │
│ SoftAP + HTTP server    │    │ SoftAP + HTTP server    │
└───────────┬─────────────┘    └───────────┬─────────────┘
            │                              │
            │   ESP-NOW broadcast, channel 1
            │   1 Hz telemetry, event-driven on alert
            └──────────────┬───────────────┘
                           ▼
            ┌──────────────────────────────┐
            │       MASTER UNIT            │
            ├──────────────────────────────┤
            │ Station table, max 8         │
            │ Visual and audible alarm     │
            │ SoftAP + HTTP dashboard      │
            └──────────────┬───────────────┘
                           │  ESP-NOW unicast
                           │  clear command
                           ▼
                  stations silence alarm
```

### Alert paths

| Path | Trigger condition | Propagation latency |
|---|---|---|
| Automatic | Water level exceeds `FLOOD_THRESHOLD_ON` | ≤ 1 s, next telemetry interval |
| Manual | SOS button or web trigger at a station | Immediate, transmitted on event |

---

## Technical specifications

| Parameter | Value |
|---|---|
| Target microcontroller | ESP32 (Xtensa LX6, dual core) |
| Framework | Arduino-ESP32 core 3.x |
| Radio protocol | ESP-NOW, 2.4 GHz, channel 1 (configurable) |
| Nominal range | 100–200 m line of sight |
| Telemetry interval | 1 s |
| ADC resolution | 12-bit (0–4095), 11 dB attenuation |
| Sample averaging | 8 samples per reading |
| Flood threshold, assert | 850 counts |
| Flood threshold, release | 650 counts |
| Button debounce | 30 ms |
| Station timeout | 5000 ms |
| Maximum stations | 8 |
| Transmit retry limit | 3 |
| Protocol version | 3 |
| Telemetry frame size | 39 bytes |
| Command frame size | 2 bytes |
| HTTP poll interval | 600 ms (station), 700 ms (master) |
| Web interface footprint | 10.8 KB (station), 15.6 KB (master), stored in PROGMEM |

---

## Bill of materials

### Master unit

| Qty | Component | Specification |
|---|---|---|
| 1 | ESP32 development board | ESP32-DevKitC or equivalent |
| 1 | LED, red | Alarm indicator |
| 1 | LED, green | Power and online indicator |
| 2 | Resistor | 220 Ω, LED current limiting |
| 1 | Buzzer | Active or passive, both supported |

### Sensor station (per unit)

| Qty | Component | Specification |
|---|---|---|
| 1 | ESP32 development board | ESP32-DevKitC or equivalent |
| 1 | Water level sensor | Resistive probe, 3-pin (VCC, GND, analog out) |
| 1 | Push button | Momentary, normally open |
| 1 | LED | Status indicator |
| 1 | Resistor | 220 Ω, LED current limiting |

> **Target platform constraint**
>
> This firmware targets ESP32 exclusively. It uses ESP32-specific APIs
> (`WiFi.h`, `WebServer.h`, `esp_now_recv_info`, `esp_now_peer_info_t`) and
> ESP32 GPIO numbering. The ESP8266 ESP-NOW implementation exposes a different
> API with incompatible callback signatures and would require a full port.

---

## Pin assignments

### Master unit

| Signal | GPIO | Configuration |
|---|---|---|
| Green LED | 25 | Output, series 220 Ω to GND |
| Red LED | 26 | Output, series 220 Ω to GND |
| Buzzer | 14 | Output, buzzer negative to GND |

### Sensor station

| Signal | GPIO | Configuration |
|---|---|---|
| Water probe, analog out | 32 | ADC1 input, 11 dB attenuation |
| Water probe, VCC | 3V3 | **3.3 V only** |
| Water probe, GND | GND | Common ground with ESP32 required |
| SOS button | 27 | `INPUT_PULLUP`, button to GND |
| Status LED | 25 | Output, series 220 Ω to GND |

> **ADC channel constraint**
>
> On ESP32, `analogRead()` returns 0 on all ADC2 pins whenever Wi-Fi is active.
> ADC2 comprises GPIO 0, 2, 4, 12, 13, 14, 15, 25, 26, and 27. The water probe
> must therefore use an ADC1 pin: **GPIO 32, 33, 34, 35, 36, or 39**.
>
> `sensors.h` enforces this with a preprocessor guard, converting an invalid
> pin selection into a compile-time error rather than a silent zero reading.

> **Sensor characteristic**
>
> A resistive probe reads approximately 0 when dry. This is expected behaviour.
> Dry and disconnected states are electrically indistinguishable on this sensor
> type; consequently only a reading pinned at full scale is classified as a
> fault.

---

## Installation

### Prerequisites

| Requirement | Version |
|---|---|
| Arduino IDE | 2.x or later |
| Arduino-ESP32 core | 3.x (validated on 3.3.11) |
| External libraries | None |

### Toolchain configuration

1. Open **File → Preferences**.
2. Add the following to **Additional Board Manager URLs**:

   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```

3. Open **Tools → Board → Boards Manager**, search for `esp32`, and install
   **esp32 by Espressif Systems**.
4. Select **Tools → Board → ESP32 Arduino → ESP32 Dev Module**. Default board
   options are suitable.

### Build and flash

The repository contains two independent sketches. Header files resolve
automatically from each sketch directory.

| Unit | Sketch | Procedure |
|---|---|---|
| Master | `Master_Node/Master_Node.ino` | Open, select port, upload |
| Station | `Flood_Node/Flood_Node.ino` | Open, select port, upload |

### Provisioning additional stations

Each station requires a unique identifier. In `Flood_Node/espnow_sender.h`:

```cpp
#define NODE_NAME "Flood-01"    // increment per station
```

Access point credentials may also be differentiated in `Flood_Node/Flood_Node.ino`:

```cpp
const char* ssid     = "FineLynk_Flood01";
const char* password = "12345678";
```

> **Protocol version coherence**
>
> `common.h` is duplicated in both sketch directories and must remain
> byte-identical. The protocol version is validated on every received frame; a
> mismatch causes silent rejection. After modifying `common.h`, copy it to the
> other directory and re-flash **all** units.

---

## Verification

Connect a serial monitor at **115200 baud** to each unit.

### Master unit, expected output

```
Alert self-test: red LED + buzzer...
Self-test done. Saw a flash and heard a beep? Wiring is good.
================================
FineLynk Access Point Started
SSID : FineLynk
Password : finelynk123
Channel : 1
IP Address : 192.168.4.1
================================
ESP-NOW Ready (bidirectional)
```

The power-on self-test actuates the red LED and buzzer twice. A visible flash
without audible output indicates a passive buzzer; see
[Configuration reference](#configuration-reference).

### Sensor station, expected output

```
--------------------------------
Flood Node AP Started
SSID    : FineLynk_Flood01
Channel : 1
OPEN THIS URL -> http://192.168.4.1
--------------------------------
ESP-NOW ready, broadcasting on channel 1
Water=412  flood=N  alert=N  TX ok=37 fail=0
```

### Radio link confirmation

The master unit reports station registration on first contact:

```
NEW STATION registered: A1:B2:C3:D4:E5:F6
RX Flood-01 water=412 flood=N
```

Absence of the `NEW STATION` line indicates a link fault. Refer to
[Troubleshooting](#troubleshooting).

---

## Operation

### Interface access

Each unit hosts an independent access point. Associate with one at a time; both
serve at the same address.

| Interface | SSID | Passphrase | URL |
|---|---|---|---|
| Master dashboard | `FineLynk` | `finelynk123` | `http://192.168.4.1` |
| Sensor station | `FineLynk_Flood01` | `12345678` | `http://192.168.4.1` |

> **Client configuration**
>
> Disable mobile data before accessing the interface. Mobile operating systems
> detect access points without internet connectivity and route requests to the
> cellular interface, where the address does not resolve. This is the most
> frequent cause of reported connectivity failures.

### Master dashboard

- Status banner with aggregate system state and clear-alert control
- Station count, active reporters, flood alerts, and distress signals
- Multi-station water level chart with threshold annotation
- Station table reporting level, last-seen interval, and state
- Session activity log

### Station interface

- Station status banner
- Water level as percentage with threshold marker
- Distress and clear-alert controls
- Station detail table and operating description

### Alert state transitions

| Event | System response |
|---|---|
| Level exceeds 850 | Station asserts flood state; master alarm activates |
| SOS button, first press | Manual alert asserted and transmitted immediately |
| SOS button, second press | Alert cleared across all units |
| Web distress control | Equivalent to physical button |
| Clear control, either interface | Master alarm and all station indicators reset |

> Clearing releases the **manual distress latch** only. If the measured level
> remains above threshold, the flood alert re-asserts on the next evaluation
> cycle. This is intentional: an active hazard condition must not be
> dismissable.

### Indicator reference

| Unit | Indicator | State | Meaning |
|---|---|---|---|
| Station | Status LED | Continuous | Online, no alert |
| Station | Status LED | Blinking, 250 ms | Alert asserted |
| Master | Green LED | Continuous | Unit powered and operational |
| Master | Red LED + buzzer | Blinking 300 ms, pulsed 250 ms | Alert asserted |

---

## Configuration reference

### `common.h` — shared protocol definitions

Identical copies are required in both sketch directories.

| Identifier | Default | Description |
|---|---|---|
| `FINELYNK_PROTOCOL_VERSION` | `3` | Frame format version; increment on structural change |
| `ESPNOW_CHANNEL` | `1` | Radio channel; must match across all units |
| `NODE_TIMEOUT_MS` | `5000` | Silence interval before a station is marked offline |
| `MAX_NODES` | `8` | Station table capacity |

### `Flood_Node/sensors.h`

| Identifier | Default | Description |
|---|---|---|
| `WATER_SENSOR` | `32` | Probe input; ADC1 pins only, compile-enforced |
| `SOS_BUTTON` | `27` | Distress input, internally pulled up |
| `STATUS_LED` | `25` | Station status output |
| `FLOOD_THRESHOLD_ON` | `850` | Assert threshold, raw ADC counts |
| `FLOOD_THRESHOLD_OFF` | `650` | Release threshold, raw ADC counts |
| `DEBOUNCE_MS` | `30` | Button debounce window |
| `ADC_SAMPLES` | `8` | Samples averaged per acquisition |
| `FAULT_STUCK_SAMPLES` | `10` | Seconds at full scale before fault assertion |
| `ALERT_BLINK_MS` | `250` | Status LED period during alert |

### `Flood_Node/espnow_sender.h`

| Identifier | Default | Description |
|---|---|---|
| `NODE_NAME` | `"Flood-01"` | Station identifier; must be unique per unit |
| `MAX_SEND_RETRIES` | `3` | Retransmission attempts before abandonment |

### `Master_Node/alerts.h`

| Identifier | Default | Description |
|---|---|---|
| `BUZZER_PASSIVE` | `0` | Set to `1` for passive buzzers |
| `BUZZER_TONE_HZ` | `2400` | Drive frequency, passive buzzers only |
| `ALERT_BLINK_MS` | `300` | Red LED period during alert |
| `BEEP_ON_MS` / `BEEP_OFF_MS` | `250` / `250` | Audible alarm duty pattern |

> **Buzzer type selection**
>
> An active buzzer contains an internal oscillator and sounds on a static logic
> high. A passive buzzer is an undriven transducer: a static high produces a
> single transient and then silence, a symptom indistinguishable from a failed
> component. If the power-on self-test produces a visible flash without audible
> output, set `BUZZER_PASSIVE` to `1` and re-flash. Active buzzers are
> typically sealed; passive buzzers expose the coil on the underside.

---

## Sensor calibration

Threshold values are specific to the probe geometry and the conductivity of the
water being measured. Tap water, deionised water, and saline solutions produce
materially different readings at identical immersion depths.

**Procedure**

1. Connect a serial monitor at 115200 baud and observe the `Water=` field.
2. Record the dry reading with the probe out of water.
3. Record the wet reading at the immersion depth defining a flood condition.
4. Set thresholds in `Flood_Node/sensors.h`:

   ```cpp
   const int FLOOD_THRESHOLD_ON  = 850;   // ≈60% of the dry-to-wet span
   const int FLOOD_THRESHOLD_OFF = 650;   // 200 counts below assert
   ```

Maintain a separation of approximately 200 counts between assert and release
thresholds. This hysteresis band prevents alarm oscillation when the level
remains near the trigger point.

Default values assume a dry reading of 0 and a fully immersed reading of 1400.

### Diagnostic endpoint

`GET /raw` on a sensor station returns 20 consecutive unaveraged ADC samples.

| Observation | Interpretation |
|---|---|
| Values vary between samples | ADC and wiring functional; adjust thresholds |
| Constant 0 | No input signal: wiring, pin selection, or probe supply |
| Constant 4095 | Input shorted to supply rail |

**Continuity test.** Bridge 3V3 to GPIO 32 momentarily. A reading near 4095
confirms the ADC path is functional and isolates the fault to the probe or its
wiring.

---

## HTTP API reference

Both unit types serve over their respective access points at `192.168.4.1`.
All responses include `Cache-Control: no-store`; omitting this header causes
client-side caching of poll responses and results in a frozen display.

### Sensor station

| Method | Endpoint | Response |
|---|---|---|
| `GET` | `/` | Station web interface, `text/html` |
| `GET` | `/status` | Station state, `application/json` |
| `GET` | `/sos` | Asserts distress signal, `text/plain` |
| `GET` | `/clear` | Releases local alert, `text/plain` |
| `GET` | `/raw` | 20 ADC samples, `text/plain` |

**`GET /status`**

```json
{
  "node": "Flood-01",
  "water": 412,
  "raw": 415,
  "pin": 32,
  "up": 8130,
  "flood": false,
  "sos": false,
  "alert": false,
  "fault": false
}
```

| Field | Type | Description |
|---|---|---|
| `node` | string | Station identifier |
| `water` | integer | Averaged ADC reading |
| `raw` | integer | Single unaveraged sample |
| `pin` | integer | Active probe GPIO |
| `up` | integer | Uptime, seconds |
| `flood` | boolean | Level above assert threshold |
| `sos` | boolean | Manual distress latch asserted |
| `alert` | boolean | Either condition active |
| `fault` | boolean | Probe pinned at full scale |

### Master unit

| Method | Endpoint | Response |
|---|---|---|
| `GET` | `/` | Dashboard, `text/html` |
| `GET` | `/status` | Aggregate state, `application/json` |
| `GET` | `/clear` | Clears alert locally and on all stations, `text/plain` |

**`GET /status`**

```json
{
  "alertActive": false,
  "manualSOS": false,
  "manualSOSType": "NONE",
  "manualSOSNode": "NONE",
  "nodes": [
    {
      "name": "Flood-01",
      "water": 412,
      "flood": false,
      "sensorFault": false,
      "online": true,
      "lastSeenMs": 640
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `alertActive` | boolean | Aggregate alarm state |
| `manualSOS` | boolean | Distress latch asserted by any station |
| `manualSOSType` | string | Trigger source: `BUTTON`, `WEB`, or `NONE` |
| `manualSOSNode` | string | Originating station identifier |
| `nodes[].lastSeenMs` | integer | Milliseconds since last received frame |

---

## ESP-NOW protocol specification

Transport is ESP-NOW on a fixed channel defined by `ESPNOW_CHANNEL`.

### Station to master, telemetry

Transmitted to the broadcast address `FF:FF:FF:FF:FF:FF` at 1 Hz, and
immediately on any distress or clear event.

```c
typedef struct __attribute__((packed)) {
  uint8_t version;        // equals FINELYNK_PROTOCOL_VERSION
  char    nodeName[20];   // station identifier
  int     waterLevel;     // averaged ADC counts
  bool    flood;          // above assert threshold
  bool    sos;            // one frame per distress event
  char    sosType[10];    // "BUTTON" | "WEB" | "NONE"
  bool    sensorFault;    // probe pinned at full scale
  bool    clearRequest;   // station requests alert release
} struct_message;
```

> **Broadcast addressing rationale**
>
> Unicast transmission requires the station to hold the master's exact MAC
> address, and the frame must additionally satisfy the receiving interface's
> address filter. Either condition failing produces total silence with no
> diagnostic. Broadcasting on a shared channel eliminates both failure modes.
> The master continues to reply by unicast using the source address extracted
> from the received frame, so downstream commands are unaffected.

### Master to station, command

Transmitted by unicast to the station's source address.

```c
typedef struct __attribute__((packed)) {
  uint8_t version;
  bool    clearAlert;     // release the manual distress latch
} struct_command;
```

### Reliability mechanisms

| Mechanism | Implementation |
|---|---|
| Delivery confirmation | ESP-NOW transmit-status callback |
| Retransmission | Up to `MAX_SEND_RETRIES`, non-blocking |
| Frame validation | Length and protocol version checked before processing |
| Station registration | Automatic on first valid frame, bounded by `MAX_NODES` |
| Liveness | Per-station `millis()` timestamp, evaluated against `NODE_TIMEOUT_MS` |

---

## Repository structure

```
FineLynk/
├── Master_Node/
│   ├── Master_Node.ino      Entry point, HTTP routes, status serialisation
│   ├── common.h             Shared protocol definitions
│   ├── wifi_manager.h       Access point initialisation
│   ├── espnow_receiver.h    Station table, receive callback, command dispatch
│   ├── alerts.h             Indicator and alarm actuation, power-on self-test
│   └── dashboard.h          Dashboard interface, PROGMEM
│
├── Flood_Node/
│   ├── Flood_Node.ino       Entry point, telemetry scheduling
│   ├── common.h             Shared protocol definitions, identical copy
│   ├── sensors.h            Acquisition, thresholds, distress input, indicator
│   ├── espnow_sender.h      Broadcast transmission, retry, command reception
│   └── web_server.h         Station interface and JSON API, PROGMEM
│
└── README.md
```

Both web interfaces are stored in program memory and served using `send_P`,
eliminating heap allocation per request. Interfaces are fully self-contained
with no external stylesheets, fonts, or scripts, as clients associated with
these access points have no internet connectivity.

---

## Troubleshooting

### No stations appear on the dashboard

Inspect station serial output and match against the table below.

| Observation | Diagnosis | Resolution |
|---|---|---|
| `TX ok=0 fail=n` | Transmission failing | Verify `ESPNOW_CHANNEL` matches across all units |
| `TX ok=n fail=0`, no `NEW STATION` at master | Frames sent, not received | Confirm master powered; reduce separation distance |
| `Protocol version mismatch` at master | Firmware revision skew | Re-flash all units from the same source tree |
| `Ignored packet: wrong size` | `common.h` divergence | Synchronise both copies, re-flash all units |

### Web interface does not load

| Check | Detail |
|---|---|
| Mobile data disabled | Most frequent cause; the OS routes to cellular |
| Scheme specified | Enter `http://192.168.4.1` explicitly |
| Stale cache | Both units share an address; use a private window |
| `Web Server Started` present in serial log | Absence indicates the access point failed to initialise |

### Probe reads zero continuously

| Check | Requirement |
|---|---|
| ADC channel | GPIO 32–39 only; ADC2 returns 0 with Wi-Fi active |
| Probe supply | VCC connected to 3V3, not 5 V |
| Ground reference | Common ground between probe and ESP32 |
| Output pin | Analog output (`S`/`AO`), not digital output (`DO`) |
| Continuity | Perform the 3V3 bridge test described in [Sensor calibration](#sensor-calibration) |

A dry probe reading zero is correct behaviour and does not indicate a fault.

### Audible alarm inoperative, visual indicator functional

Set `BUZZER_PASSIVE` to `1` in `Master_Node/alerts.h` and re-flash the master unit.

### Alert oscillates between states

The measured level is near the threshold boundary. Increase the separation
between `FLOOD_THRESHOLD_ON` and `FLOOD_THRESHOLD_OFF`.

### Station reported offline while powered

No frame received within `NODE_TIMEOUT_MS`. Verify channel agreement, reduce
separation distance, and check for increasing `TX fail` at the station.

---

## Design constraints

The following are deliberate boundaries of the current design, not defects.

| Constraint | Detail |
|---|---|
| No external connectivity | Architectural. No remote access, off-site notification, or cloud retention. |
| Single-hop topology | ESP-NOW range of 100–200 m line of sight, substantially reduced indoors. No relaying. |
| No persistent history | Charts and activity logs are constructed client-side and reset on reload. No on-device retention. |
| Station capacity | Eight stations maximum, governed by `MAX_NODES` in both copies of `common.h`. |
| Unencrypted transport | ESP-NOW frames are broadcast in plaintext. Any device on the channel can observe or inject traffic. Unsuitable for untrusted environments without modification. |
| Open registration | Any station transmitting a valid frame is registered, up to capacity. No address allow-list. |
| Partial fault detection | Only a full-scale reading is detectable. A disconnected probe is electrically identical to a dry probe. |
| Static configuration | Credentials, identifiers, and thresholds are compile-time constants requiring re-flash to modify. |
| Probe degradation | Continuous DC bias across a resistive probe induces electrolysis and electrode erosion, causing measurement drift over extended deployment. |
| Fixed interface theme | Interfaces are light-themed and optimised for well-lit environments. |

---

## Roadmap

Prioritised by operational value.

**Reliability**
- MAC-based station allow-list with rejection of unregistered transmitters
- ESP-NOW payload encryption using a pre-shared key
- Multi-hop relaying to extend effective coverage beyond single-hop range
- Supply voltage monitoring and low-battery reporting

**Data retention**
- Flash-backed event log surviving power cycles
- Server-side historical series replacing client-side buffers
- CSV export of recorded measurements

**Optional connectivity**
- Station-mode operation at the master when infrastructure is available
- Local queueing with flush-on-reconnect, preserving offline-first semantics
- GSM gateway for notification beyond radio range

**Usability**
- Web-based configuration of thresholds and identifiers without re-flashing
- Dark interface variant for low-light deployment
- Interface localisation

---

## Project status

Functional prototype. The detection, alerting, and clearing paths are
implemented and validated on hardware. The system is suitable for demonstration
and field trial. It is **not** production-hardened: transport encryption,
station authentication, and persistent storage are not implemented. Review
[Design constraints](#design-constraints) before deployment in any setting where
failure carries consequence.

---

## License

No license has been applied. A license must be selected prior to distribution
or publication.

---

<div align="center">

**FineLynk** · Offline-first flood detection

</div>
