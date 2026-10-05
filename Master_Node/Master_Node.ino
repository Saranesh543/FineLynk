/*
========================================
        FineLynk Master Node
========================================
Target: ESP32 (Arduino-ESP32 core). This project uses ESP32-specific
APIs (WiFi.h / WebServer.h / esp_now_recv_info / esp_now_peer_info_t)
and ESP32 GPIO numbers throughout, exactly as the original project
did. If your hardware is actually ESP8266, this needs a separate
port - ESP8266's Wi-Fi/ESP-NOW headers, structs, and callback
signatures are different from ESP32's. See README.md.
========================================
*/

#include "common.h"
#include <WiFi.h>
#include <WebServer.h>
#include <esp_now.h>

#include "wifi_manager.h"
#include "espnow_receiver.h"
#include "alerts.h"
#include "dashboard.h"

WebServer server(80);

// Tracks the previously-computed alert state so triggerAlert()/
// clearAlert() fire ONCE per transition instead of on every single
// loop() pass.
// (Fixes: triggerAlert() used to be called every loop() iteration
// while a flood was active, flooding Serial output.)
bool previousAlertState = false;

// ---------------------------
// Dashboard
// ---------------------------
void handleRoot() {
  // send_P: page lives in PROGMEM, so no heap is used per request.
  server.send_P(200, "text/html", getDashboard());
}

// ---------------------------
// Live Status API
// (Fixes: now reports every known node, not just one; includes
// online/offline + sensor-fault state per node.)
// ---------------------------
void handleStatus() {

  String json;
  json.reserve(128 + (knownNodeCount * 96));

  json += "{";

  json += "\"alertActive\":";
  json += previousAlertState ? "true" : "false";
  json += ",";

  json += "\"manualSOS\":";
  json += manualSOS ? "true" : "false";
  json += ",";

  json += "\"manualSOSType\":\"";
  json += manualSOSType;
  json += "\",";

  json += "\"manualSOSNode\":\"";
  json += manualSOSNode;
  json += "\",";

  json += "\"nodes\":[";

  for (int i = 0; i < knownNodeCount; i++) {
    if (i > 0) json += ",";

    json += "{";
    json += "\"name\":\"";
    json += knownNodes[i].data.nodeName;
    json += "\",";

    json += "\"water\":";
    json += String(knownNodes[i].data.waterLevel);
    json += ",";

    json += "\"flood\":";
    json += knownNodes[i].data.flood ? "true" : "false";
    json += ",";

    json += "\"sensorFault\":";
    json += knownNodes[i].data.sensorFault ? "true" : "false";
    json += ",";

    json += "\"online\":";
    json += isNodeOnline(i) ? "true" : "false";
    json += ",";

    json += "\"lastSeenMs\":";
    json += String(millis() - knownNodes[i].lastSeen);

    json += "}";
  }

  json += "]";
  json += "}";

  // no-store: without it the browser can cache the poll and the
  // dashboard freezes on stale readings.
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", json);
}

// ---------------------------
// Clear Alert API
// ---------------------------
void handleClear() {

  clearManualSOS();

  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "text/plain", "OK");
}

// ---------------------------
// Setup
// ---------------------------
void setup() {

  Serial.begin(115200);

  setupAlerts();
  setupWiFi();   // sets the final Wi-Fi mode + starts the AP

  // Web Routes
  server.on("/", handleRoot);
  server.on("/status", handleStatus);
  server.on("/clear", handleClear);

  server.begin();

  setupESPNow();

  Serial.println("================================");
  Serial.println(" FineLynk Master Online");
  Serial.println("================================");
  Serial.print("Dashboard : http://");
  Serial.println(WiFi.softAPIP());
  Serial.println("--------------------------------");
  Serial.print("MASTER STA MAC (use this in Flood_Node.ino) : ");
  Serial.println(WiFi.macAddress());
  Serial.print("MASTER AP  MAC                              : ");
  Serial.println(WiFi.softAPmacAddress());
  Serial.println("--------------------------------");
}

// ---------------------------
// Main Loop
// ---------------------------
void loop() {

  server.handleClient();

  // Edge-triggered alert: fire triggerAlert()/clearAlert() only
  // when the aggregate state actually changes.
  // (Fixes: triggerAlert() used to be called unconditionally every
  // loop() pass while any flood was active.)
  bool currentAlertState = anyNodeFlooding() || manualSOS;

  if (currentAlertState != previousAlertState) {
    previousAlertState = currentAlertState;

    if (currentAlertState) {
      triggerAlert();
    } else {
      clearAlert();
    }
  }

  // Runs the blink + beep pattern while an alert is active.
  // Non-blocking, so it must be called every loop() pass.
  updateAlert();
}
