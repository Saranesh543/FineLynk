#ifndef ESPNOW_RECEIVER_H
#define ESPNOW_RECEIVER_H

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include "common.h"

struct NodeRecord {
  uint8_t         mac[6];
  bool            active;
  struct_message  data;
  unsigned long   lastSeen;
};

NodeRecord knownNodes[MAX_NODES];
int knownNodeCount = 0;

bool manualSOS = false;
char manualSOSType[10] = "NONE";
char manualSOSNode[20] = "NONE";

void triggerAlert();
void clearAlert();

// ---------------------------------------------------------
// Register the sender as an ESP-NOW peer so the Master can send
// commands BACK to it. (NEW - required for bug 1 / bug 4.)
// ---------------------------------------------------------
void ensurePeer(const uint8_t *mac)
{
  if (esp_now_is_peer_exist(mac)) return;

  esp_now_peer_info_t p;
  memset(&p, 0, sizeof(p));
  memcpy(p.peer_addr, mac, 6);
  p.channel = ESPNOW_CHANNEL;
  p.encrypt = false;
  p.ifidx   = WIFI_IF_AP;

  if (esp_now_add_peer(&p) != ESP_OK) {
    Serial.println("WARNING: could not add node as peer (no reply path).");
  }
}

int findOrRegisterNode(const uint8_t *mac) {
  for (int i = 0; i < knownNodeCount; i++) {
    if (memcmp(knownNodes[i].mac, mac, 6) == 0) return i;
  }

  if (knownNodeCount < MAX_NODES) {
    int i = knownNodeCount++;
    memcpy(knownNodes[i].mac, mac, 6);
    knownNodes[i].active = true;
    ensurePeer(mac);
    Serial.printf("NEW STATION registered: %02X:%02X:%02X:%02X:%02X:%02X\n",
                  mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    return i;
  }

  Serial.println("WARNING: Node table full, ignoring new sender.");
  return -1;
}

// Only ONLINE nodes can hold the alert on - otherwise a node that
// powers off mid-flood would pin the buzzer on forever.
bool anyNodeFlooding() {
  for (int i = 0; i < knownNodeCount; i++) {
    if (knownNodes[i].active && knownNodes[i].data.flood &&
        (millis() - knownNodes[i].lastSeen) < NODE_TIMEOUT_MS) return true;
  }
  return false;
}

bool isNodeOnline(int i) {
  if (i < 0 || i >= knownNodeCount || !knownNodes[i].active) return false;
  return (millis() - knownNodes[i].lastSeen) < NODE_TIMEOUT_MS;
}

// ---------------------------------------------------------
// Push a CLEAR command to every known node (NEW).
// (Fixes bug 1: pressing CLEAR ALERT on the Master dashboard now
// actually reaches the Flood node and stops its blinking LED.)
// ---------------------------------------------------------
void sendClearToAllNodes()
{
  struct_command cmd;
  cmd.version    = FINELYNK_PROTOCOL_VERSION;
  cmd.clearAlert = true;

  for (int i = 0; i < knownNodeCount; i++) {
    if (!knownNodes[i].active) continue;
    esp_now_send(knownNodes[i].mac, (uint8_t *)&cmd, sizeof(cmd));
  }

  Serial.println("CLEAR command sent to all nodes");
}

void clearManualSOS() {
  manualSOS = false;
  strcpy(manualSOSType, "NONE");
  strcpy(manualSOSNode, "NONE");

  // Also clear the cached SOS flag per node so the dashboard
  // doesn't immediately re-latch from stale data.
  for (int i = 0; i < knownNodeCount; i++) {
    knownNodes[i].data.sos = false;
    strcpy(knownNodes[i].data.sosType, "NONE");
  }

  sendClearToAllNodes();
}

void OnDataRecv(const esp_now_recv_info *info,
                const uint8_t *incomingData,
                int len)
{
  if (len != sizeof(struct_message)) {
    Serial.print("Ignored packet: wrong size ");
    Serial.print(len);
    Serial.print(", expected ");
    Serial.println(sizeof(struct_message));
    return;
  }

  struct_message incoming;
  memcpy(&incoming, incomingData, sizeof(incoming));

  if (incoming.version != FINELYNK_PROTOCOL_VERSION) {
    Serial.println("WARNING: Protocol version mismatch, ignoring packet.");
    return;
  }

  int idx = findOrRegisterNode(info->src_addr);
  if (idx < 0) return;

  knownNodes[idx].data     = incoming;
  knownNodes[idx].lastSeen = millis();

  // Node is asking us to clear (SOS button 2nd press / node web page)
  // (Fixes bug 4.)
  if (incoming.clearRequest) {
    Serial.print("CLEAR requested by ");
    Serial.println(incoming.nodeName);
    manualSOS = false;
    strcpy(manualSOSType, "NONE");
    strcpy(manualSOSNode, "NONE");
    for (int i = 0; i < knownNodeCount; i++) {
      knownNodes[i].data.sos = false;
    }
    return;
  }

  if (incoming.sos) {
    manualSOS = true;
    strcpy(manualSOSType, incoming.sosType);
    strcpy(manualSOSNode, incoming.nodeName);
    Serial.print("*** SOS RECEIVED from ");
    Serial.print(incoming.nodeName);
    Serial.print(" via ");
    Serial.println(incoming.sosType);
  }

  // Heartbeat summary once a second so you can see the link is alive
  static unsigned long lastRxLog = 0;
  if (millis() - lastRxLog >= 1000) {
    lastRxLog = millis();
    Serial.print("RX ");
    Serial.print(incoming.nodeName);
    Serial.print(" water=");
    Serial.print(incoming.waterLevel);
    Serial.print(" flood=");
    Serial.println(incoming.flood ? "Y" : "N");
  }
}

void setupESPNow()
{
  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW Initialization Failed!");
    return;
  }

  esp_now_register_recv_cb(OnDataRecv);

  Serial.println("ESP-NOW Ready (bidirectional)");
}

#endif
