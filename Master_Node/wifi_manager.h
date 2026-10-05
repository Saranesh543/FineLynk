#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include "common.h"

const char* ssid     = "FineLynk";
const char* password = "finelynk123";

// ---------------------------------------------------------
// Wi-Fi setup.
// Sets the FINAL Wi-Fi mode and starts the AP on the fixed
// ESPNOW_CHANNEL *before* the web server or ESP-NOW are touched.
// (Fixes: mode used to be set to WIFI_AP here, then changed again
// to WIFI_AP_STA later inside setupESPNow() - AFTER the AP and web
// server were already running - which could restart the Wi-Fi
// driver/beacon and drop already-connected dashboard clients.)
// ---------------------------------------------------------
void setupWiFi() {

  WiFi.mode(WIFI_AP_STA);

  bool result = WiFi.softAP(ssid, password, ESPNOW_CHANNEL);

  if (result) {

    Serial.println("================================");
    Serial.println("FineLynk Access Point Started");
    Serial.print("SSID : ");
    Serial.println(ssid);

    Serial.print("Password : ");
    Serial.println(password);

    Serial.print("Channel : ");
    Serial.println(ESPNOW_CHANNEL);

    Serial.print("IP Address : ");
    Serial.println(WiFi.softAPIP());

    Serial.println("================================");

  } else {

    Serial.println("Failed to start Access Point");

  }

}

#endif
