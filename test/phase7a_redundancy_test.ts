import {
  NETWORK_NODES,
  TOTAL_NODES,
  CORE_NODES_COUNT,
  isSensorCapableNode,
  getNodeSensorRole,
  getHazardZoneSensorNodes,
} from '../src/data/nodes';
import { HAZARD_ZONES } from '../src/data/hazards';
import { MESH_EDGES, buildAdjacencyList } from '../src/data/graph';
import { findShortestPath } from '../src/simulation/pathfinding';
import {
  TelemetryService,
  getZoneCoverage,
  getZoneSensorFusion,
  selectBestDetectionSource,
  getRouteIntelligence,
} from '../src/simulation/telemetry';
import { SimulationEngine } from '../src/simulation/SimulationEngine';
import { NetworkNodes } from '../src/scene/NetworkNodes';
import { HazardEffects } from '../src/scene/HazardEffects';
import { SimulationMarkers } from '../src/scene/SimulationMarkers';
import { MeshLinks } from '../src/scene/MeshLinks';
import { HazardZones } from '../src/scene/HazardZones';
import { SimulationEvent } from '../src/simulation/types';

console.log('================================================================');
console.log('  FineLynk Phase 7A: Redundant Hazard Sensing & Zone Coverage   ');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// TEST 1: Sensor Role Architecture & Cluster Verification
// ----------------------------------------------------------------------------
console.log('--- Test 1: Sensor Role Architecture & Cluster Verification ---');
if (NETWORK_NODES.length !== 24) {
  throw new Error(`Expected exactly 24 nodes, found ${NETWORK_NODES.length}`);
}

const sensorNodes = NETWORK_NODES.filter((n) => isSensorCapableNode(n.id));
const relayOnlyNodes = NETWORK_NODES.filter((n) => !isSensorCapableNode(n.id) && !n.isCommandCenter);
const commandCenterNodes = NETWORK_NODES.filter((n) => n.isCommandCenter);

console.log(`  Sensor-capable nodes: ${sensorNodes.length} (Expected: 9)`);
console.log(`  Relay-only nodes:     ${relayOnlyNodes.length} (Expected: 14)`);
console.log(`  Command Center nodes: ${commandCenterNodes.length} (Expected: 1)`);

if (sensorNodes.length !== 9) {
  throw new Error(`Expected 9 sensor-capable nodes, got ${sensorNodes.length}`);
}
if (relayOnlyNodes.length !== 14) {
  throw new Error(`Expected 14 relay-only nodes, got ${relayOnlyNodes.length}`);
}
if (commandCenterNodes.length !== 1) {
  throw new Error(`Expected 1 command center node, got ${commandCenterNodes.length}`);
}

// Verify Flood Cluster
const floodNodes = getHazardZoneSensorNodes('flood');
const floodIds = floodNodes.map((n) => n.id);
console.log(`  Flood Sensor Cluster: ${floodNodes.map((n) => `${n.name} [${getNodeSensorRole(n.id)?.designation}]`).join(', ')}`);
if (!floodIds.includes(1) || !floodIds.includes(7) || !floodIds.includes(9)) {
  throw new Error(`Flood cluster mismatch: expected [1, 7, 9], got [${floodIds}]`);
}

// Verify Fire Cluster
const fireNodes = getHazardZoneSensorNodes('fire');
const fireIds = fireNodes.map((n) => n.id);
console.log(`  Forest Sensor Cluster: ${fireNodes.map((n) => `${n.name} [${getNodeSensorRole(n.id)?.designation}]`).join(', ')}`);
if (!fireIds.includes(2) || !fireIds.includes(11) || !fireIds.includes(13)) {
  throw new Error(`Fire cluster mismatch: expected [2, 11, 13], got [${fireIds}]`);
}

// Verify Industrial Cluster
const indusNodes = getHazardZoneSensorNodes('industrial');
const indusIds = indusNodes.map((n) => n.id);
console.log(`  Industrial Sensor Cluster: ${indusNodes.map((n) => `${n.name} [${getNodeSensorRole(n.id)?.designation}]`).join(', ')}`);
if (!indusIds.includes(3) || !indusIds.includes(15) || !indusIds.includes(17)) {
  throw new Error(`Industrial cluster mismatch: expected [3, 15, 17], got [${indusIds}]`);
}

console.log('✓ Verified: 9 sensor-capable nodes mapped to 3 distinct clusters, 14 relay-only nodes, 1 command center.');

// ----------------------------------------------------------------------------
// TEST 2: Deterministic Spatial Environmental Telemetry & Coverage Calculation
// ----------------------------------------------------------------------------
console.log('\n--- Test 2: Spatial Telemetry & Multi-Tier Coverage Calculation ---');
const telemetryService = new TelemetryService();

// Verify all 9 sensors generate valid telemetry assessments
for (const sn of sensorNodes) {
  const assessment = telemetryService.getSensorNodeRiskAssessment(sn.id);
  if (!assessment) throw new Error(`Missing telemetry for sensor node ${sn.id}`);
  if (assessment.riskScore < 0 || !assessment.classification) {
    throw new Error(`Invalid telemetry data on sensor node ${sn.id}`);
  }
}

// Spatial variation check: sensors in same zone have small deterministic variations, not identical
const tFlood04 = telemetryService.getSensorNodeRiskAssessment(1);
const tFloodS1 = telemetryService.getSensorNodeRiskAssessment(7);
const tFloodS2 = telemetryService.getSensorNodeRiskAssessment(9);
if (tFlood04.riskScore === tFloodS1.riskScore && tFloodS1.riskScore === tFloodS2.riskScore) {
  throw new Error('Sensor telemetry is identical across cluster! Spatial variation missing.');
}
console.log(`  Spatial variation verified: Flood-04 (${tFlood04.riskScore}) vs Flood-S1 (${tFloodS1.riskScore}) vs Flood-S2 (${tFloodS2.riskScore})`);

// Verify Coverage States: FULL -> REDUNDANT -> DEGRADED -> LOST
const blockedNone = new Set<number>();
const covFull = getZoneCoverage('fire', blockedNone);
if (covFull.coverageState !== 'FULL' || covFull.onlineSensors.length !== 3) {
  throw new Error(`Expected FULL coverage (3/3), got ${covFull.coverageState} (${covFull.onlineSensors.length}/3)`);
}

const blocked1 = new Set<number>([2]); // Forest-07 down
const covRedundant = getZoneCoverage('fire', blocked1);
if (covRedundant.coverageState !== 'REDUNDANT' || covRedundant.onlineSensors.length !== 2) {
  throw new Error(`Expected REDUNDANT coverage (2/3), got ${covRedundant.coverageState} (${covRedundant.onlineSensors.length}/3)`);
}

const blocked2 = new Set<number>([2, 11]); // Forest-07 & Forest-S1 down
const covDegraded = getZoneCoverage('fire', blocked2);
if (covDegraded.coverageState !== 'DEGRADED' || covDegraded.onlineSensors.length !== 1) {
  throw new Error(`Expected DEGRADED coverage (1/3), got ${covDegraded.coverageState} (${covDegraded.onlineSensors.length}/3)`);
}

const blocked3 = new Set<number>([2, 11, 13]); // All 3 down
const covLost = getZoneCoverage('fire', blocked3);
if (covLost.coverageState !== 'LOST' || covLost.detectionState !== 'UNAVAILABLE' || covLost.onlineSensors.length !== 0) {
  throw new Error(`Expected LOST coverage (0/3 UNAVAILABLE), got ${covLost.coverageState} ${covLost.detectionState}`);
}

console.log('✓ Verified: Coverage states (FULL -> REDUNDANT -> DEGRADED -> LOST) match specification.');

// ----------------------------------------------------------------------------
// TEST 3: Sensor Fusion & Dynamic Source Selection
// ----------------------------------------------------------------------------
console.log('\n--- Test 3: Sensor Fusion & Dynamic Source Selection ---');
// Baseline fusion with all online
const fusionFull = getZoneSensorFusion('fire', blockedNone);
const fullSources = fusionFull.contributingSensors.map((s) => s.designation);
console.log(`  Full Cluster Fusion: Fused Risk=${fusionFull.fusedRiskScore}, Contributing Sources=[${fullSources.join(', ')}]`);
if (fusionFull.contributingSensors.length !== 3) {
  throw new Error(`Expected 3 contributing sources, got ${fusionFull.contributingSensors.length}`);
}

// Fail primary (Forest-07) and evaluate fusion
const fusionFailPrimary = getZoneSensorFusion('fire', blocked1);
const failPrimarySources = fusionFailPrimary.contributingSensors.map((s) => s.designation);
console.log(`  Primary Offline Fusion: Fused Risk=${fusionFailPrimary.fusedRiskScore}, Contributing Sources=[${failPrimarySources.join(', ')}]`);
if (failPrimarySources.includes('Forest-07')) {
  throw new Error('Offline sensor Forest-07 illegally included in active fusion sources!');
}
if (fusionFailPrimary.contributingSensors.length !== 2) {
  throw new Error(`Expected 2 contributing sources when Forest-07 is down, got ${fusionFailPrimary.contributingSensors.length}`);
}

// Dynamic source selection: when Node 2 is offline, should pick Node 11 or Node 13
const bestSourceId = selectBestDetectionSource('fire', blocked1);
if (bestSourceId === null || bestSourceId === 2) {
  throw new Error(`Best source selected invalid node: ${bestSourceId}`);
}
const bestSourceNode = NETWORK_NODES[bestSourceId];
console.log(`  Dynamic Detection Source selected: ${bestSourceNode.name} [${getNodeSensorRole(bestSourceId)?.designation}]`);
console.log('✓ Verified: Sensor fusion dynamically isolates failed sensors and selects best available operational source.');

// ----------------------------------------------------------------------------
// TEST A: FOREST RESILIENCE TEST (Forest-07 OFFLINE)
// ----------------------------------------------------------------------------
console.log('\n--- Test A: Forest Primary Sensor Failure Resilience ---');
const networkNodes = new NetworkNodes();
const meshLinks = new MeshLinks(networkNodes);
const hazardZones = new HazardZones();
const hazardEffects = new HazardEffects(hazardZones);
const markers = new SimulationMarkers(networkNodes, meshLinks);
const engine = new SimulationEngine(networkNodes, hazardEffects, markers);

const capturedEvents: SimulationEvent[] = [];
engine.events.on('*', (ev) => capturedEvents.push(ev));

// Step 1: Fail Forest-07 (Node 2)
engine.setNodeBlocked(2, true);

// Step 2: Trigger Forest Fire
engine.triggerHazard('fire');

const fireSim = engine.activeSimulations.get('fire');
if (!fireSim) {
  throw new Error('Simulation failed to trigger for Forest Fire when Forest-07 was offline!');
}
console.log(`  Fire Simulation Origin Node: Node ${fireSim.hazardNodeId} (${NETWORK_NODES[fireSim.hazardNodeId].name})`);
console.log(`  Fire Route Path: [${fireSim.path.join(' → ')}]`);

if (fireSim.hazardNodeId === 2) {
  throw new Error('Fire simulation origin is still failed node Forest-07!');
}
if (fireSim.path.includes(2)) {
  throw new Error('Fire simulation path contains failed node Forest-07!');
}
if (fireSim.path[fireSim.path.length - 1] !== 0) {
  throw new Error('Fire simulation route does not terminate at Command Center (Node 0)!');
}

const fireEvent = capturedEvents.find((e) => e.type === 'HAZARD_DETECTED' && e.hazardType === 'fire');
if (!fireEvent) {
  throw new Error('HAZARD_DETECTED event not emitted for redundant fire detection!');
}
if (fireEvent.sources?.includes('Forest-07')) {
  throw new Error('Alert claimed Forest-07 as active detection source while offline!');
}
console.log(`  Captured Alert: ${fireEvent.message}`);
console.log(`  Detection Sources: [${fireEvent.sources?.join(', ')}] | Primary: ${fireEvent.primarySource}`);
console.log(`  Coverage Status: ${fireEvent.coverageStatus}`);
console.log('✓ PASS: Test A (Forest Redundancy) passed successfully.');

// Reset for next test
engine.reset();
capturedEvents.length = 0;

// ----------------------------------------------------------------------------
// TEST B: FLOOD RESILIENCE TEST (Flood-04 OFFLINE)
// ----------------------------------------------------------------------------
console.log('\n--- Test B: Flood Primary Sensor Failure Resilience ---');
// Step 1: Fail Flood-04 (Node 1)
engine.setNodeBlocked(1, true);

// Step 2: Trigger Flood
engine.triggerHazard('flood');

const floodSim = engine.activeSimulations.get('flood');
if (!floodSim) {
  throw new Error('Simulation failed to trigger for Flood when Flood-04 was offline!');
}
console.log(`  Flood Simulation Origin Node: Node ${floodSim.hazardNodeId} (${NETWORK_NODES[floodSim.hazardNodeId].name})`);
console.log(`  Flood Route Path: [${floodSim.path.join(' → ')}]`);

if (floodSim.hazardNodeId === 1) {
  throw new Error('Flood simulation origin is still failed node Flood-04!');
}
if (floodSim.path.includes(1)) {
  throw new Error('Flood simulation path contains failed node Flood-04!');
}
if (floodSim.path[floodSim.path.length - 1] !== 0) {
  throw new Error('Flood simulation route does not terminate at Command Center (Node 0)!');
}

const floodEvent = capturedEvents.find((e) => e.type === 'HAZARD_DETECTED' && e.hazardType === 'flood');
if (!floodEvent) {
  throw new Error('HAZARD_DETECTED event not emitted for redundant flood detection!');
}
if (floodEvent.sources?.includes('Flood-04')) {
  throw new Error('Alert claimed Flood-04 as active detection source while offline!');
}
console.log(`  Captured Alert: ${floodEvent.message}`);
console.log(`  Detection Sources: [${floodEvent.sources?.join(', ')}] | Primary: ${floodEvent.primarySource}`);
console.log(`  Coverage Status: ${floodEvent.coverageStatus}`);
console.log('✓ PASS: Test B (Flood Redundancy) passed successfully.');

// Reset for next test
engine.reset();
capturedEvents.length = 0;

// ----------------------------------------------------------------------------
// TEST C: INDUSTRIAL RESILIENCE TEST (Indus-02 OFFLINE)
// ----------------------------------------------------------------------------
console.log('\n--- Test C: Industrial Primary Sensor Failure Resilience ---');
// Step 1: Fail Indus-02 (Node 3)
engine.setNodeBlocked(3, true);

// Step 2: Trigger Industrial Leak
engine.triggerHazard('industrial');

const indusSim = engine.activeSimulations.get('industrial');
if (!indusSim) {
  throw new Error('Simulation failed to trigger for Industrial Leak when Indus-02 was offline!');
}
console.log(`  Industrial Simulation Origin Node: Node ${indusSim.hazardNodeId} (${NETWORK_NODES[indusSim.hazardNodeId].name})`);
console.log(`  Industrial Route Path: [${indusSim.path.join(' → ')}]`);

if (indusSim.hazardNodeId === 3) {
  throw new Error('Industrial simulation origin is still failed node Indus-02!');
}
if (indusSim.path.includes(3)) {
  throw new Error('Industrial simulation path contains failed node Indus-02!');
}
if (indusSim.path[indusSim.path.length - 1] !== 0) {
  throw new Error('Industrial simulation route does not terminate at Command Center (Node 0)!');
}

const indusEvent = capturedEvents.find((e) => e.type === 'HAZARD_DETECTED' && e.hazardType === 'industrial');
if (!indusEvent) {
  throw new Error('HAZARD_DETECTED event not emitted for redundant industrial detection!');
}
if (indusEvent.sources?.includes('Indus-02')) {
  throw new Error('Alert claimed Indus-02 as active detection source while offline!');
}
console.log(`  Captured Alert: ${indusEvent.message}`);
console.log(`  Detection Sources: [${indusEvent.sources?.join(', ')}] | Primary: ${indusEvent.primarySource}`);
console.log(`  Coverage Status: ${indusEvent.coverageStatus}`);
console.log('✓ PASS: Test C (Industrial Redundancy) passed successfully.');

// Reset for next test
engine.reset();
capturedEvents.length = 0;

// ----------------------------------------------------------------------------
// TEST D: FAILURE CASCADE TEST (0/3 Sensors Online -> No Fake SOS)
// ----------------------------------------------------------------------------
console.log('\n--- Test D: Failure Cascade to 0/3 Sensors Online (No Fake SOS) ---');
// Fail Forest-07 (Node 2) + Forest-S1 (Node 11)
engine.setNodeBlocked(2, true);
engine.setNodeBlocked(11, true);

// Node 13 (Forest-S2) should still detect
const cascadeCov1 = getZoneCoverage('fire', engine.blockedNodeIds);
if (cascadeCov1.onlineSensors.length !== 1 || cascadeCov1.coverageState !== 'DEGRADED') {
  throw new Error(`Expected DEGRADED coverage with 1 online sensor, got ${cascadeCov1.coverageState}`);
}
console.log(`  Cascade Level 1 (2/3 failed): Zone coverage is DEGRADED (1/3 online). Detection AVAILABLE.`);

// Now fail the last remaining sensor: Forest-S2 (Node 13)
engine.setNodeBlocked(13, true);
const cascadeCov2 = getZoneCoverage('fire', engine.blockedNodeIds);
if (cascadeCov2.onlineSensors.length !== 0 || cascadeCov2.coverageState !== 'LOST' || cascadeCov2.detectionState !== 'UNAVAILABLE') {
  throw new Error(`Expected LOST coverage (0/3 online), got ${cascadeCov2.coverageState}`);
}
console.log(`  Cascade Level 2 (3/3 failed): Zone coverage is LOST (0/3 online). Detection UNAVAILABLE.`);

// Attempt to trigger Fire hazard when detection is UNAVAILABLE
engine.triggerHazard('fire');

if (engine.activeSimulations.has('fire')) {
  throw new Error('SimulationEngine illegally started an active fire simulation when all sensors are OFFLINE!');
}

const noRouteEvent = capturedEvents.find((e) => e.type === 'NO_ROUTE_AVAILABLE' && e.hazardType === 'fire');
if (!noRouteEvent) {
  throw new Error('Expected NO_ROUTE_AVAILABLE / DETECTION UNAVAILABLE event when all sensors failed!');
}
console.log(`  Captured Rejection Event: ${noRouteEvent.message}`);
console.log('✓ PASS: Test D (Cascade failure stops sensing; no fake SOS generated) passed successfully.');

// Reset for next test
engine.reset();
capturedEvents.length = 0;

// ----------------------------------------------------------------------------
// TEST E: COMBINED RESILIENCE TEST (Sensor Failure + Relay Failure)
// ----------------------------------------------------------------------------
console.log('\n--- Test E: Combined Resilience (Primary Sensor + Relay Failure) ---');
// Block Forest-07 (Node 2) [SENSOR FAILURE]
engine.setNodeBlocked(2, true);

// Discover what relay Node 11 (Forest-S1) would nominally take to Node 0
const nominalPathFrom11 = findShortestPath(11, 0, new Set<number>([2]))!;
console.log(`  Nominal Path from Forest-S1 (Node 11) to Command: [${nominalPathFrom11.join(' → ')}]`);
const intermediateRelay = nominalPathFrom11[1]; // First mesh relay after sensor

// Block that intermediate relay [MESH RELAY FAILURE]
console.log(`  Simulating Relay Failure: Blocking intermediate Node ${intermediateRelay} (${NETWORK_NODES[intermediateRelay].name})`);
engine.setNodeBlocked(intermediateRelay, true);

// Trigger Forest Fire
engine.triggerHazard('fire');

const combinedSim = engine.activeSimulations.get('fire');
if (!combinedSim) {
  throw new Error('Combined resilience failed: no route found despite surviving sensors and alternative mesh relays!');
}

console.log(`  Surviving Origin Sensor: Node ${combinedSim.hazardNodeId} (${NETWORK_NODES[combinedSim.hazardNodeId].name})`);
console.log(`  Rerouted Path to Command: [${combinedSim.path.join(' → ')}]`);

if (combinedSim.path.includes(2)) {
  throw new Error('Combined test path illegally contains failed sensor Node 2!');
}
if (combinedSim.path.includes(intermediateRelay)) {
  throw new Error(`Combined test path illegally contains failed relay Node ${intermediateRelay}!`);
}
if (combinedSim.path[combinedSim.path.length - 1] !== 0) {
  throw new Error('Combined test path does not reach Command Center!');
}

console.log(`✓ Hero Demonstration Verified: Forest-S1 detected hazard AND mesh self-healed around Relay ${intermediateRelay} to reach Command.`);
console.log('✓ PASS: Test E (Combined Sensor + Mesh Relay failure) passed successfully.');

// ----------------------------------------------------------------------------
// TEST F: FULL RESET VERIFICATION
// ----------------------------------------------------------------------------
console.log('\n--- Test F: Full Reset Verification ---');
engine.reset();

if (engine.blockedNodeIds.size !== 0) {
  throw new Error(`Expected 0 blocked nodes after reset, found ${engine.blockedNodeIds.size}`);
}
if (engine.activeSimulations.size !== 0) {
  throw new Error(`Expected 0 active simulations after reset, found ${engine.activeSimulations.size}`);
}

for (const hazard of ['flood', 'fire', 'industrial'] as const) {
  const cov = getZoneCoverage(hazard, engine.blockedNodeIds);
  if (cov.coverageState !== 'FULL' || cov.onlineSensors.length !== 3) {
    throw new Error(`Zone ${hazard} failed to reset to FULL (3/3) coverage!`);
  }
}
console.log('✓ Verified: Engine reset successfully restores all 24 nodes, all 9 sensors, and all 3 zone coverages.');

console.log('\n================================================================');
console.log('  ALL PHASE 7A REDUNDANCY TESTS PASSED SUCCESSFULLY!            ');
console.log('================================================================\n');
