/*
=========================================
        FineLynk Flood Node
=========================================
Target: ESP32 (Arduino-ESP32 core).
=========================================
*/

#include "common.h"
#include <WiFi.h>
#include <WebServer.h>
#include <esp_now.h>
#include <esp_wifi.h>

#include "espnow_sender.h"   // FIRST (defines NODE_NAME + send/recv)
#include "web_server.h"
#include "sensors.h"

const char* ssid     = "FineLynk_Flood01";
const char* password = "12345678";

WebServer server(80);

// ---------------------------------------------------------
// Master MAC Address.
// Must match the MAC printed by the Master at boot.
// Use the Master's STA MAC (the one WiFi.macAddress() prints).
// ---------------------------------------------------------
uint8_t masterAddress[] = {
  0xF4, 0x2D, 0xC9, 0x6C, 0x35, 0x88
};

struct_message data;

unsigned long lastSend = 0;

void setup() {

  Serial.begin(115200);
  delay(300);

  setupSensors();

  WiFi.mode(WIFI_AP_STA);

  setupWiFi();
  setupESPNow();

  data.version      = FINELYNK_PROTOCOL_VERSION;
  strcpy(data.nodeName, NODE_NAME);
  data.waterLevel   = 0;
  data.flood        = false;
  data.sos          = false;
  data.sensorFault  = false;
  data.clearRequest = false;
  strcpy(data.sosType, "NONE");

  Serial.println("================================");
  Serial.println(" FineLynk Flood Node Started");
  Serial.print(" This node MAC : ");
  Serial.println(WiFi.macAddress());
  Serial.println("================================");
}

void loop() {

  server.handleClient();

  readInputs();          // ADC, flood hysteresis, SOS toggle, fault check
  heartbeat();           // AFTER readInputs so it sees the fresh alertActive
  handleSendRetries();

  // Telemetry every second
  if (millis() - lastSend >= 1000) {

    lastSend = millis();

    sendPacket();

    // Debug: prove the ADC is actually moving
    Serial.print("Water=");
    Serial.print(data.waterLevel);
    Serial.print("  flood=");
    Serial.print(data.flood ? "Y" : "N");
    Serial.print("  alert=");
    Serial.print(alertActive ? "Y" : "N");
    Serial.print("  TX ok=");
    Serial.print(txOK);
    Serial.print(" fail=");
    Serial.println(txFail);

    // Reset one-shot SOS after transmission (latch stays in sosLatched)
    data.sos = false;
    strcpy(data.sosType, "NONE");
    buttonSOS = false;
  }
}
