#ifndef ESPNOW_SENDER_H
#define ESPNOW_SENDER_H

#include <esp_now.h>
#include <esp_wifi.h>
#include <WiFi.h>
#include "common.h"

#define NODE_NAME "Flood-01"

// Globals from .ino
extern struct_message data;
extern uint8_t masterAddress[];

// Globals from sensors.h (defined later in the same translation unit)
extern bool sosLatched;
extern bool alertActive;
extern bool floodState;
void applyClearLocally();

esp_now_peer_info_t peerInfo;

// ---------------------------------------------------------
// Telemetry is BROADCAST rather than unicast to masterAddress.
// Why: unicast only works if masterAddress exactly matches the
// Master's MAC, and the frame has to pass the receiving
// interface's MAC filter. Both softAPs sit on ESPNOW_CHANNEL, so
// a broadcast reaches the Master regardless of what its MAC is -
// which removes the single most common reason nothing arrives.
// The Master still replies UNICAST, using the source address it
// read off the packet, so CLEAR commands are unaffected.
// ---------------------------------------------------------
uint8_t broadcastAddress[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };

#define MAX_SEND_RETRIES 3

struct_message lastSentPacket;
volatile unsigned long txOK = 0, txFail = 0;
volatile bool  sendPending = false;
volatile bool  sendFailed  = false;
uint8_t        retryCount  = 0;

void transmitPacket()
{
  sendPending = true;

  esp_err_t result = esp_now_send(
      broadcastAddress,
      (uint8_t *)&lastSentPacket,
      sizeof(lastSentPacket));

  if (result != ESP_OK) {
    Serial.print("Send Error : ");
    Serial.println(result);
    sendPending = false;
    sendFailed  = true;
  }
}

// ---------------------------
// Send Callback
// ---------------------------
void OnDataSent(const wifi_tx_info_t *info,
                esp_now_send_status_t status)
{
  sendPending = false;

  if (status == ESP_NOW_SEND_SUCCESS) {
    retryCount = 0;
    sendFailed = false;
    txOK++;
  } else {
    Serial.println("TX FAILED - is the Master powered and on the same channel?");
    sendFailed = true;
    txFail++;
  }
}

// ---------------------------------------------------------
// Receive callback (NEW).
// (Fixes bug 1: the node had no way to hear the Master, so
// "Clear Alert" on the Master dashboard could never stop this
// node's LED. ESP-NOW is now bidirectional.)
// ---------------------------------------------------------
void OnDataRecvNode(const esp_now_recv_info *info,
                    const uint8_t *incomingData,
                    int len)
{
  if (len != sizeof(struct_command)) return;

  struct_command cmd;
  memcpy(&cmd, incomingData, sizeof(cmd));

  if (cmd.version != FINELYNK_PROTOCOL_VERSION) return;

  if (cmd.clearAlert) {
    Serial.println("CLEAR command received from Master");
    applyClearLocally();
  }
}

// ---------------------------
// Send Packet
// ---------------------------
void sendPacket()
{
  data.version      = FINELYNK_PROTOCOL_VERSION;
  data.clearRequest = false;
  strcpy(data.nodeName, NODE_NAME);

  lastSentPacket = data;
  retryCount = 0;
  transmitPacket();
}

// ---------------------------------------------------------
// Tell the Master to clear the alert (NEW).
// (Fixes bug 4: the SOS button can now clear the buzzer, red LED
// and dashboard, not just raise an alert.)
// ---------------------------------------------------------
void sendClearRequest()
{
  struct_message clearMsg;
  memset(&clearMsg, 0, sizeof(clearMsg));

  clearMsg.version      = FINELYNK_PROTOCOL_VERSION;
  strcpy(clearMsg.nodeName, NODE_NAME);
  clearMsg.waterLevel   = data.waterLevel;
  clearMsg.flood        = data.flood;
  clearMsg.sos          = false;
  strcpy(clearMsg.sosType, "NONE");
  clearMsg.sensorFault  = data.sensorFault;
  clearMsg.clearRequest = true;

  lastSentPacket = clearMsg;
  retryCount = 0;
  transmitPacket();
}

void handleSendRetries()
{
  if (sendFailed && !sendPending) {
    sendFailed = false;

    if (retryCount < MAX_SEND_RETRIES) {
      retryCount++;
      transmitPacket();
    } else {
      Serial.println("Packet delivery failed after max retries.");
    }
  }
}

// ---------------------------
// ESP-NOW Setup
// ---------------------------
void setupESPNow()
{
  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW Init Failed!");
    return;
  }

  esp_now_register_send_cb(OnDataSent);
  esp_now_register_recv_cb(OnDataRecvNode);   // NEW: listen for Master commands

  memset(&peerInfo, 0, sizeof(peerInfo));
  memcpy(peerInfo.peer_addr, broadcastAddress, 6);
  peerInfo.channel = ESPNOW_CHANNEL;
  peerInfo.encrypt = false;
  // Send over the AP interface, which is guaranteed to sit on
  // ESPNOW_CHANNEL. (The default ifidx is STA, which is not
  // connected to anything here and can drop packets.)
  peerInfo.ifidx = WIFI_IF_AP;

  if (!esp_now_is_peer_exist(broadcastAddress)) {
    if (esp_now_add_peer(&peerInfo) != ESP_OK) {
      Serial.println("Failed to add broadcast peer!");
      return;
    }
  }

  Serial.print("ESP-NOW ready, broadcasting on channel ");
  Serial.println(ESPNOW_CHANNEL);
}

#endif
