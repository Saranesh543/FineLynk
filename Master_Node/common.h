#ifndef FINELYNK_COMMON_H
#define FINELYNK_COMMON_H

/*
  =====================================================================
  FineLynk - Shared Wire Protocol
  =====================================================================
  Keep this file IDENTICAL in Master_Node/common.h and
  Flood_Node/common.h. If you change any struct below, bump
  FINELYNK_PROTOCOL_VERSION and re-copy it to BOTH folders.
  =====================================================================
*/

#define FINELYNK_PROTOCOL_VERSION 3

// All FineLynk nodes must share this Wi-Fi / ESP-NOW channel.
#define ESPNOW_CHANNEL 1

// Time without a packet before a node counts as OFFLINE.
#define NODE_TIMEOUT_MS 5000UL

// Max distinct Flood nodes the Master tracks.
#define MAX_NODES 8

// ---------------------------------------------------------
// Node  ->  Master   (telemetry / SOS / clear request)
// ---------------------------------------------------------
typedef struct __attribute__((packed)) {
  uint8_t version;        // must equal FINELYNK_PROTOCOL_VERSION
  char    nodeName[20];   // e.g. "Flood-01"
  int     waterLevel;     // raw ADC value
  bool    flood;          // water level above threshold
  bool    sos;            // true for one packet per SOS event
  char    sosType[10];    // "BUTTON" / "WEB" / "NONE"
  bool    sensorFault;    // sensor looks stuck / disconnected
  bool    clearRequest;   // NEW: node asks the Master to clear the alert
} struct_message;

// ---------------------------------------------------------
// Master  ->  Node   (commands)
// NEW in v3: makes ESP-NOW bidirectional, so "Clear Alert" on the
// Master dashboard can actually reach the Flood node.
// ---------------------------------------------------------
typedef struct __attribute__((packed)) {
  uint8_t version;
  bool    clearAlert;     // tell the node to drop its local SOS latch
} struct_command;

#endif
