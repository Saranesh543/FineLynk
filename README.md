# FineLynk

Offline-first disaster communication system: one or more **Flood_Node** sensor/SOS
units talk to a **Master_Node** over ESP-NOW; the Master hosts a local dashboard
over its own Wi-Fi access point.

## Target hardware: ESP32

The original project called for ESP8266, but the code (as supplied) was written
entirely against **ESP32** Arduino-core APIs: `WiFi.h`, `WebServer.h`,
`esp_now_recv_info`, `esp_now_peer_info_t`, `wifi_tx_info_t`, plus GPIO numbers
(25/26/27/32) that don't exist on ESP8266. Porting to true ESP8266 (`ESP8266WiFi.h`,
`<espnow.h>`, different callback signatures, valid GPIO0-16 only) would mean
rewriting most of the Wi-Fi/ESP-NOW logic, so this pass keeps **ESP32** as the
target and fixes everything else. If your boards are genuinely ESP8266, say so and
this needs a separate hardware-API port rather than the fixes below.

## What was fixed vs. the original code (logic kept the same)

| # | Problem | Fix |
|---|---------|-----|
| 1 | Master could only track **one** node — a second node's data overwrote the first | `Master_Node/espnow_receiver.h`: per-node table (`NodeRecord knownNodes[MAX_NODES]`) keyed by sender MAC |
| 2 | No heartbeat timeout — a dead node's last reading was shown forever | `isNodeOnline()` computed from `lastSeen` + `NODE_TIMEOUT_MS` (`common.h`) |
| 3 | `triggerAlert()` fired on every single `loop()` pass while flooding, spamming Serial | `Master_Node.ino`: edge-triggered — fires only on a state *transition* |
| 4 | Master's Wi-Fi mode was set once to `WIFI_AP`, then changed to `WIFI_AP_STA` *after* the AP/web server were already running | `wifi_manager.h`: final mode set once, before AP/server start |
| 5 | SOS button used a **blocking `while()`** loop that froze the whole node (watchdog-reset risk) | `Flood_Node/sensors.h`: non-blocking `millis()`-based debounce, edge-triggered on press |
| 6 | ESP-NOW send failures were logged but never retried — a dropped SOS/flood packet was silently lost | `Flood_Node/espnow_sender.h`: bounded retry (`MAX_SEND_RETRIES`), handled non-blockingly in `loop()` |
| 7 | `struct_message` was defined twice, independently, in the two sketches, with nothing to catch future drift | Moved into a single `common.h`, byte-identical in both `Master_Node/` and `Flood_Node/`, with a `version` field checked on receipt |
| 8 | ESP-NOW channel wasn't explicitly synchronized — it only worked because both soft-APs happened to default to channel 1 | `common.h`: single `ESPNOW_CHANNEL` constant used by both `WiFi.softAP()` calls and the ESP-NOW peer entry |
| 9 | Flood detection could "flap" true/false right at the threshold | `Flood_Node/sensors.h`: hysteresis (`FLOOD_THRESHOLD_ON` / `_OFF`) instead of a single cutoff |
| 10 | No way to tell a disconnected/stuck water sensor from a real reading | `Flood_Node/sensors.h`: best-effort "stuck reading" heuristic, surfaced as `sensorFault` on both the Flood node's local page and the Master dashboard |

## Deliberately out of scope for this pass

Real internet/backend connectivity (Wi-Fi STA join, HTTP/MQTT client, cloud
dashboard/mobile app) was **not** added. The original code had none of this — both
nodes only ever ran their own private soft-AP — so adding it would be new
functionality, not a fix to existing logic. It's a separate follow-up:
1. Add STA join + non-blocking reconnect on a gateway node.
2. Add an HTTP/MQTT client to push events to a backend when online.
3. Buffer events locally (e.g. LittleFS) while offline and flush on reconnect.
4. Re-sync `ESPNOW_CHANNEL` if joining a router forces a channel change.

## Uploading

- Board: any ESP32 dev board (Arduino IDE → Tools → Board → ESP32).
- Flash `Master_Node/Master_Node.ino` to the Master board and `Flood_Node/Flood_Node.ino`
  to each Flood sensor board.
- `Flood_Node.ino`'s `masterAddress[]` must match the Master board's actual MAC
  address — update per physical unit.
- Multiple Flood nodes can now run simultaneously (`MAX_NODES` in `common.h`,
  default 8) and will each show up separately on the Master's dashboard.


---

## v3 bug-fix round (bidirectional ESP-NOW)

Four field-reported bugs, and what changed:

### 1. Flood node LED kept blinking after "Clear Alert" on the Master
**Root cause:** two problems. `heartbeat()` in `sensors.h` blinked
unconditionally forever regardless of alert state, AND ESP-NOW was one-way
(Flood -> Master only), so the Master physically had no way to tell the node
anything.

**Fix:** `common.h` gains a `struct_command` (Master -> Node). The Master now
registers each sender as a peer (`ensurePeer()`) and `clearManualSOS()` calls
`sendClearToAllNodes()`. The Flood node registers `OnDataRecvNode()` and calls
`applyClearLocally()` on a CLEAR command. LED semantics are now:
**solid HIGH = online & safe, blinking = alert active.**

### 2. Flood node website wouldn't load
**Fix:** the page moved to `PROGMEM` + `server.send_P()` instead of building
~3KB of HTML with repeated `String +=` on every request (heap fragmentation
could make `server.send()` fail). Also added explicit `softAPConfig()` so the
IP is always `192.168.4.1`, a settle delay before `server.begin()`, and an
`onNotFound` redirect so phones probing for a captive portal land on the page.

If it still won't load: **turn off mobile data** on the phone. Android/iOS see
an AP with no internet and silently route the request to cellular.

### 3. Sensor read 0 / never updated
**Two separate causes:**
- **Reads 0:** on ESP32, `analogRead()` **always returns 0 on ADC2 pins while
  Wi-Fi is active** (GPIO 0,2,4,12,13,14,15,25,26,27). Only ADC1
  (32,33,34,35,36,39) works. `sensors.h` now has a `#error` guard that makes a
  wrong pin a compile failure instead of a silent zero. Also added
  `analogSetPinAttenuation(ADC_11db)` (default range is only ~0-1.1V, not the
  full 0-3.3V) and 8-sample averaging.
- **Never updated on the node's page:** the water level was baked into the HTML
  server-side, so it froze at page-load value. The page now polls a new
  `/status` JSON endpoint every 500ms, same as the Master dashboard.

Serial now prints `Water=... flood=... alert=...` once a second so you can
confirm the ADC is actually moving.

### 4. SOS button couldn't clear the alert
**Fix:** `checkSOSButton()` is now a **toggle** - first press raises SOS, second
press clears it. Clearing sends a `clearRequest` to the Master, which drops the
latch and turns off the buzzer + red LED. A CLEAR button was also added to the
Flood node's own web page (`/clear`).

**Note:** clearing drops the *SOS latch* only. If the water sensor is still above
the flood threshold, the alert re-asserts - a genuine flood shouldn't be
dismissable while the water is still there.

### Also fixed while in here
- ESP-NOW peers now use `ifidx = WIFI_IF_AP` (the AP interface is guaranteed to
  be on `ESPNOW_CHANNEL`; the default STA interface isn't connected here and can
  drop packets). This is a likely secondary cause of data not reaching the Master.
- The Master prints **both** its STA and AP MAC at boot, so you can copy the
  right one into `Flood_Node.ino`'s `masterAddress[]`.
- An offline node can no longer pin the alert on forever - only nodes heard from
  within `NODE_TIMEOUT_MS` count toward the flood state.
- Protocol bumped to **v3**. Re-flash **both** boards; a v2 node talking to a v3
  Master will be rejected by the version check.
