#ifndef SENSORS_H
#define SENSORS_H

#include "common.h"

// ---------------------------
// Pins (ESP32 GPIO numbers)
// ---------------------------
#define WATER_SENSOR 32
#define SOS_BUTTON   27
#define STATUS_LED   25

// ---------------------------------------------------------
// CRITICAL ESP32 HARDWARE RULE:
// analogRead() ALWAYS returns 0 on ADC2 pins while Wi-Fi is
// active. ADC2 pins are GPIO 0,2,4,12,13,14,15,25,26,27.
// Only ADC1 pins (32,33,34,35,36,39) work with Wi-Fi enabled.
// This was a prime suspect for "sensor data reads 0".
// The guard below makes a wrong pin a COMPILE error instead of a
// silent zero at runtime.
// ---------------------------------------------------------
#if !(WATER_SENSOR == 32 || WATER_SENSOR == 33 || WATER_SENSOR == 34 || \
      WATER_SENSOR == 35 || WATER_SENSOR == 36 || WATER_SENSOR == 39)
  #error "WATER_SENSOR must be an ADC1 pin (32,33,34,35,36,39). ADC2 pins always read 0 while Wi-Fi is on."
#endif

// Flood thresholds, with hysteresis so the flag doesn't flap.
// Calibrated for this probe: dry = 0, fully submerged = 1400.
// Alert fires once the reading goes above 850.
// OFF sits 200 counts lower; that gap is the hysteresis that stops
// the alert flapping when the water sits right at the trigger line.
const int FLOOD_THRESHOLD_ON  = 850;
const int FLOOD_THRESHOLD_OFF = 650;

#define DEBOUNCE_MS 30
#define ADC_SAMPLES 8

// ---------------------------------------------------------
// Sensor-fault detection.
//
// IMPORTANT: a resistive water probe reads ~0 when DRY. Dry and
// disconnected are electrically identical on this sensor type, so
// a low reading is NOT evidence of a fault - flagging it was wrong
// and produced a permanent false "sensor fault" on a healthy dry
// sensor.
//
// Only a reading pinned at FULL SCALE is genuinely diagnostic
// (signal line shorted to VCC). Everything else is treated as a
// valid measurement.
//
// Checked on a 1-second cadence, because readInputs() runs every
// loop() iteration (hundreds of times a second).
// ---------------------------------------------------------
#define FAULT_CHECK_MS      1000
#define FAULT_STUCK_SAMPLES 10      // 10 seconds pinned at full scale
#define ADC_RAIL_HIGH       4085

// LED blink rate while an alert is active.
#define ALERT_BLINK_MS 250

bool floodState  = false;
bool buttonSOS   = false;
bool webSOS      = false;
bool webClear    = false;   // set by the node's own web page "CLEAR" button

// Local alert state (drives the STATUS_LED and the node's web page)
bool sosLatched  = false;
bool alertActive = false;

// From espnow_sender.h
void sendPacket();
void sendClearRequest();

// ---------------------------------------------------------
// Accessors used by web_server.h, which is included before this
// file and therefore cannot see the WATER_SENSOR macro.
// ---------------------------------------------------------
int readWaterRaw()   { return analogRead(WATER_SENSOR); }
int waterSensorPin() { return WATER_SENSOR; }

// ---------------------------
// Setup Pins
// ---------------------------
void setupSensors()
{
  pinMode(SOS_BUTTON, INPUT_PULLUP);
  pinMode(STATUS_LED, OUTPUT);

  // ADC configuration.
  // (Fixes: default attenuation only spans ~0-1.1V, so a 0-3.3V
  // sensor read near-0 or saturated. ADC_11db spans the full range.)
  analogReadResolution(12);              // 0..4095
  analogSetPinAttenuation(WATER_SENSOR, ADC_11db);

  digitalWrite(STATUS_LED, HIGH);        // solid = powered & safe
}

// ---------------------------------------------------------
// Status LED.
// (Fixes bug 1: the LED used to blink unconditionally forever.)
//   SOLID HIGH  = node online, no alert
//   BLINKING    = alert active (flood or SOS)
// ---------------------------------------------------------
void heartbeat()
{
  static unsigned long lastBlink = 0;
  static bool ledState = false;

  if (alertActive) {
    if (millis() - lastBlink >= ALERT_BLINK_MS) {
      lastBlink = millis();
      ledState = !ledState;
      digitalWrite(STATUS_LED, ledState);
    }
  } else {
    // No alert: stop blinking, hold the LED steady HIGH.
    ledState = false;
    digitalWrite(STATUS_LED, HIGH);
  }
}

// ---------------------------------------------------------
// Clear this node's local alert. Called either from the SOS
// button (2nd press), the node's own web page, or a CLEAR command
// pushed from the Master over ESP-NOW.
// NOTE: this drops the SOS latch. If the water sensor is still
// above the flood threshold, flood stays true and the alert
// re-asserts - that is intended, a real flood shouldn't be
// dismissable while the water is still there.
// ---------------------------------------------------------
void applyClearLocally()
{
  sosLatched = false;
  buttonSOS  = false;
  webSOS     = false;
  alertActive = floodState;   // only flood can keep it active
  Serial.println("Local alert cleared");
}

// ---------------------------------------------------------
// Non-blocking SOS button, now a TOGGLE.
// (Fixes bug 4: press once = raise SOS, press again = clear the
// alert everywhere - buzzer, red LED and both web pages.)
// ---------------------------------------------------------
void checkSOSButton()
{
  static bool lastReading = HIGH;
  static bool stableState = HIGH;
  static unsigned long lastChangeTime = 0;

  bool reading = digitalRead(SOS_BUTTON);

  if (reading != lastReading) {
    lastChangeTime = millis();
  }

  if ((millis() - lastChangeTime) > DEBOUNCE_MS) {
    if (reading != stableState) {
      stableState = reading;

      // Act on the press edge only (HIGH -> LOW)
      if (stableState == LOW) {

        if (alertActive) {
          // 2nd press -> clear everywhere
          Serial.println("SOS button: CLEAR");
          applyClearLocally();
          sendClearRequest();
        } else {
          // 1st press -> raise SOS
          Serial.println("SOS button: RAISE");
          buttonSOS   = true;
          sosLatched  = true;
          alertActive = true;
          data.sos    = true;
          strcpy(data.sosType, "BUTTON");
          sendPacket();
        }
      }
    }
  }

  lastReading = reading;
}

// ---------------------------
// Read Sensors
// ---------------------------
void readInputs()
{
  static int lastWaterReading = -1;
  static int stuckCount = 0;
  static unsigned long lastFaultCheck = 0;

  // Averaged ADC read (reduces jitter)
  long sum = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    sum += analogRead(WATER_SENSOR);
  }
  int water = (int)(sum / ADC_SAMPLES);
  data.waterLevel = water;

  // Flood detection with hysteresis
  if (!data.flood && water >= FLOOD_THRESHOLD_ON) {
    data.flood = true;
  } else if (data.flood && water <= FLOOD_THRESHOLD_OFF) {
    data.flood = false;
  }
  floodState = data.flood;

  // Sensor-fault heuristic, evaluated once per second (see above)
  if (millis() - lastFaultCheck >= FAULT_CHECK_MS) {
    lastFaultCheck = millis();

    // Only a stuck FULL-SCALE reading counts as a fault (see above).
    // A dry sensor sitting at 0 is normal and must not be flagged.
    bool atHighRail = (water >= ADC_RAIL_HIGH);

    if (atHighRail && water == lastWaterReading) {
      stuckCount++;
    } else {
      stuckCount = 0;
    }
    lastWaterReading = water;

    data.sensorFault = (stuckCount >= FAULT_STUCK_SAMPLES);
  }

  // Physical SOS button (non-blocking toggle)
  checkSOSButton();

  // Web SOS button on this node's own page
  if (webSOS) {
    webSOS = false;
    buttonSOS   = true;
    sosLatched  = true;
    alertActive = true;
    data.sos    = true;
    strcpy(data.sosType, "WEB");
    sendPacket();
  }

  // Web CLEAR button on this node's own page
  if (webClear) {
    webClear = false;
    applyClearLocally();
    sendClearRequest();
  }

  // Keep the aggregate local alert state up to date
  alertActive = sosLatched || data.flood;
}

#endif
