// FineLynk Environmental Telemetry & Edge Intelligence Model
// Phase 7A: Redundant Multi-Sensor Environmental Telemetry, Sensor Fusion & Zone Coverage
// Note: All measurements are strictly SIMULATED DEMO TELEMETRY.

import { MESH_EDGES } from '../data/graph';
import { NETWORK_NODES, getNodeSensorRole } from '../data/nodes';
import { HAZARD_ZONES, ZoneCoverageState, ZoneDetectionState } from '../data/hazards';
import { HazardType, HazardSimulation } from './types';
import { findShortestPath } from './pathfinding';

export type SensorHealth = 'ONLINE' | 'DEGRADED' | 'FAULT';
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type PriorityLevel = 'MONITORING' | 'ELEVATED' | 'URGENT' | 'EMERGENCY';

export interface FloodTelemetry {
  nodeId: number;
  waterLevel: number; // percentage (0 - 100%)
  rainfall: number; // mm/h (0 - 60 mm/h)
  soilMoisture: number; // percentage (0 - 100%)
  temperature: number; // °C
  sensorHealth: SensorHealth;
  history: number[]; // Sparkline buffer for waterLevel
}

export interface FireTelemetry {
  nodeId: number;
  smoke: number; // ppm (0 - 300 ppm)
  airQualityIndex: number; // AQI (0 - 300)
  temperature: number; // °C
  humidity: number; // percentage (0 - 100%)
  flameDetected: boolean;
  sensorHealth: SensorHealth;
  history: number[]; // Sparkline buffer for temperature
}

export interface IndustrialTelemetry {
  nodeId: number;
  vocGas: number; // ppm (0 - 250 ppm)
  temperature: number; // °C
  pressure: number; // kPa (nominal ~101.3 kPa)
  anomalyDeviation: number; // percentage (0 - 100%)
  sensorHealth: SensorHealth;
  history: number[]; // Sparkline buffer for anomalyDeviation
}

export interface RelayTelemetry {
  linkQuality: number; // percentage (0 - 100%)
  rssi: number; // dBm (-95 to -55 dBm)
  connectivity: 'CONNECTED' | 'DEGRADED' | 'ISOLATED';
  packetState: 'FORWARDING' | 'QUEUE_CLEAR' | 'DROPPED_ROUTE';
  neighborCount: number; // Active online neighbors
  totalNeighbors: number; // Total physical topology neighbors
  nodeHealth: number; // percentage (0 or 98-100%)
  sensorHealth: SensorHealth;
}

export interface CommandCenterIntelligence {
  networkHealthPct: number; // Available active edges / Total edges * 100%
  onlineNodesCount: number;
  totalNodesCount: number;
  activeEdgesCount: number;
  totalEdgesCount: number;
  activeAlertsCount: number;
  highestRiskNodeName: string;
  highestRiskScore: number;
  highestRiskLevel: RiskLevel;
  gatewayStatus: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  meshStatus: 'SELF-HEALING READY' | 'TOPOLOGY DEGRADED' | 'ISOLATED';
}

export interface EdgeRiskAssessment {
  riskScore: number; // 0 - 100
  riskLevel: RiskLevel;
  priority: PriorityLevel;
  classification: string;
  anomalyDetected: boolean;
  recommendedAction: string;
}

export interface RouteIntelligence {
  primaryPath: number[];
  currentPath: number[] | null;
  pathNodeNames: string[];
  isRerouted: boolean;
  statusText: 'PRIMARY ROUTE' | 'REROUTED — NODE FAILURE' | 'FAILOVER SENSOR ROUTE' | 'ROUTE SEVERED';
}

export interface ZoneCoverageSummary {
  zoneId: HazardType;
  zoneTitle: string;
  totalSensors: number;
  onlineSensors: number[];
  offlineSensors: number[];
  coverageState: ZoneCoverageState; // 'FULL' | 'REDUNDANT' | 'DEGRADED' | 'LOST'
  detectionState: ZoneDetectionState; // 'AVAILABLE' | 'UNAVAILABLE'
  statusText: string; // "3 / 3 ONLINE", "2 / 3 ONLINE", "1 / 3 ONLINE", "0 / 3 ONLINE"
}

export interface ZoneSensorFusion {
  zoneId: HazardType;
  zoneTitle: string;
  coverage: ZoneCoverageSummary;
  fusedRiskScore: number;
  fusedRiskLevel: RiskLevel;
  fusedPriority: PriorityLevel;
  classification: string;
  anomalyDetected: boolean;
  recommendedAction: string;
  contributingSensors: { nodeId: number; designation: string; score: number }[];
  primaryDetectionSource: { nodeId: number; designation: string } | null;
  confirmingSources: { nodeId: number; designation: string }[];
  detectionAvailable: boolean;
}

/**
 * Deterministic pseudo-random jitter generator.
 * Produces smooth, reproducible oscillations for simulated field telemetry.
 */
class TelemetryJitter {
  private phase: number;
  constructor(seed: number = 1337) {
    this.phase = seed % 1000;
  }
  public next(frequency: number = 1.0): number {
    this.phase += frequency;
    return Math.sin(this.phase * 0.42) * Math.cos(this.phase * 0.28);
  }
}

export class TelemetryService {
  // Redundant multi-sensor clusters
  public floodSensors: Map<number, FloodTelemetry> = new Map();
  public fireSensors: Map<number, FireTelemetry> = new Map();
  public industrialSensors: Map<number, IndustrialTelemetry> = new Map();

  // Backward-compatible accessors for primary nodes
  public get flood(): FloodTelemetry {
    return this.floodSensors.get(1)!;
  }
  public get fire(): FireTelemetry {
    return this.fireSensors.get(2)!;
  }
  public get industrial(): IndustrialTelemetry {
    return this.industrialSensors.get(3)!;
  }

  private jitter = new TelemetryJitter(42);
  private lastTickTime: number = 0;
  private readonly TICK_INTERVAL_MS = 600; // Controlled update cadence (600ms)

  // Canonical baseline routes when network is 100% operational
  public readonly PRIMARY_ROUTES: Record<HazardType, number[]>;

  constructor() {
    this.PRIMARY_ROUTES = {
      flood: findShortestPath(1, 0) || [1, 10, 0],
      fire: findShortestPath(2, 0) || [2, 14, 0],
      industrial: findShortestPath(3, 0) || [3, 18, 0],
    };
    this.initAllSensors();
  }

  private initAllSensors(): void {
    // Flood Cluster (Node 1, 7, 9)
    this.floodSensors.set(1, this.createInitialFloodState(1, 0, 0, 0, 0));
    this.floodSensors.set(7, this.createInitialFloodState(7, 3.2, -0.3, 1.8, -0.4));
    this.floodSensors.set(9, this.createInitialFloodState(9, -2.6, 0.4, -3.2, 0.5));

    // Fire Cluster (Node 2, 11, 13)
    this.fireSensors.set(2, this.createInitialFireState(2, 0, 0, 0, 0));
    this.fireSensors.set(11, this.createInitialFireState(11, 14, 12, 2.2, -4));
    this.fireSensors.set(13, this.createInitialFireState(13, -9, -8, -1.6, 3));

    // Industrial Cluster (Node 3, 15, 17)
    this.industrialSensors.set(3, this.createInitialIndustrialState(3, 0, 0, 0, 0));
    this.industrialSensors.set(15, this.createInitialIndustrialState(15, -8.5, -0.7, 1.4, -3.4));
    this.industrialSensors.set(17, this.createInitialIndustrialState(17, 12.5, 1.3, -1.8, 5.2));
  }

  private createInitialFloodState(
    nodeId: number,
    wOffset: number,
    rOffset: number,
    sOffset: number,
    tOffset: number
  ): FloodTelemetry {
    const baseW = 14.5 + wOffset;
    return {
      nodeId,
      waterLevel: parseFloat(baseW.toFixed(1)),
      rainfall: Math.max(0, parseFloat((0.8 + rOffset).toFixed(1))),
      soilMoisture: parseFloat((32.0 + sOffset).toFixed(1)),
      temperature: parseFloat((23.4 + tOffset).toFixed(1)),
      sensorHealth: 'ONLINE',
      history: [12, 13, 14, 13.5, 14, 15, 14.2, 14.8, baseW, baseW, baseW, baseW],
    };
  }

  private createInitialFireState(
    nodeId: number,
    sOffset: number,
    aqiOffset: number,
    tOffset: number,
    hOffset: number
  ): FireTelemetry {
    const baseT = 25.8 + tOffset;
    return {
      nodeId,
      smoke: Math.max(0, parseFloat((11.2 + sOffset).toFixed(1))),
      airQualityIndex: Math.max(0, Math.round(34 + aqiOffset)),
      temperature: parseFloat(baseT.toFixed(1)),
      humidity: Math.max(10, Math.min(100, parseFloat((58.0 + hOffset).toFixed(1)))),
      flameDetected: false,
      sensorHealth: 'ONLINE',
      history: [25.2, 25.5, 25.4, 25.6, baseT, baseT, baseT, baseT, baseT, baseT, baseT, baseT],
    };
  }

  private createInitialIndustrialState(
    nodeId: number,
    gOffset: number,
    tOffset: number,
    pOffset: number,
    aOffset: number
  ): IndustrialTelemetry {
    const baseA = Math.max(0.5, parseFloat((3.5 + aOffset).toFixed(1)));
    return {
      nodeId,
      vocGas: Math.max(0, parseFloat((14.0 + gOffset).toFixed(1))),
      temperature: parseFloat((24.2 + tOffset).toFixed(1)),
      pressure: parseFloat((101.3 + pOffset).toFixed(1)),
      anomalyDeviation: baseA,
      sensorHealth: 'ONLINE',
      history: [3.2, 3.5, 3.4, 3.6, 3.2, 3.5, 3.7, 3.4, baseA, baseA, baseA, baseA],
    };
  }

  /**
   * Resets all telemetry models and history buffers to pristine baselines.
   */
  public reset(): void {
    this.initAllSensors();
    this.lastTickTime = 0;
  }

  /**
   * Updates telemetry values across all 9 sensor nodes periodically at controlled interval (~600ms).
   * Incorporates deterministic spatial variation per node in each cluster.
   */
  public update(
    elapsedSeconds: number,
    activeSimulations: Map<HazardType, HazardSimulation>,
    blockedNodeIds: Set<number>
  ): void {
    const nowMs = elapsedSeconds * 1000;
    if (nowMs - this.lastTickTime < this.TICK_INTERVAL_MS) {
      return;
    }
    this.lastTickTime = nowMs;

    const j1 = this.jitter.next(0.5);
    const j2 = this.jitter.next(0.7);
    const j3 = this.jitter.next(0.4);

    // -------------------------------------------------------------
    // 1. Update Flood Cluster (Nodes 1, 7, 9)
    // -------------------------------------------------------------
    const floodActive = activeSimulations.has('flood');
    const floodSim = activeSimulations.get('flood');
    const floodStage = floodSim ? floodSim.stage : 'IDLE';

    const floodOffsets: Record<number, { w: number; r: number; s: number; t: number }> = {
      1: { w: 0, r: 0, s: 0, t: 0 },
      7: { w: 3.2, r: -1.2, s: 2.0, t: -0.4 },
      9: { w: -2.6, r: 2.1, s: -3.2, t: 0.5 },
    };

    for (const [nodeId, tele] of this.floodSensors.entries()) {
      const isBlocked = blockedNodeIds.has(nodeId);
      const off = floodOffsets[nodeId] || { w: 0, r: 0, s: 0, t: 0 };

      if (isBlocked) {
        tele.sensorHealth = 'FAULT';
      } else {
        tele.sensorHealth = 'ONLINE';
        if (floodActive && (floodStage === 'BROADCASTING' || floodStage === 'DISPATCHED')) {
          tele.waterLevel = Math.min(96, Math.max(68, 78 + off.w + j1 * 4.5));
          tele.rainfall = Math.min(52, Math.max(14, 22 + off.r + j2 * 3.8));
          tele.soilMoisture = Math.min(99, Math.max(76, 86 + off.s + j3 * 2.8));
          tele.temperature = Math.min(23, Math.max(17, 20.2 + off.t + j1 * 0.7));
        } else if (floodStage === 'RESOLVED') {
          tele.waterLevel = Math.max(16, tele.waterLevel * 0.74);
          tele.rainfall = Math.max(1.2, tele.rainfall * 0.52);
          tele.soilMoisture = Math.max(38, tele.soilMoisture * 0.86);
          tele.temperature = 22.8 + off.t + j1 * 0.4;
        } else {
          tele.waterLevel = 14.5 + off.w + j1 * 1.2;
          tele.rainfall = Math.max(0, 0.8 + off.r + j2 * 0.4);
          tele.soilMoisture = 32.0 + off.s + j3 * 1.5;
          tele.temperature = 23.4 + off.t + j1 * 0.5;
        }
      }
      this.appendHistory(tele.history, tele.waterLevel);
    }

    // -------------------------------------------------------------
    // 2. Update Fire Cluster (Nodes 2, 11, 13)
    // -------------------------------------------------------------
    const fireActive = activeSimulations.has('fire');
    const fireSim = activeSimulations.get('fire');
    const fireStage = fireSim ? fireSim.stage : 'IDLE';

    const fireOffsets: Record<number, { s: number; aqi: number; t: number; h: number }> = {
      2: { s: 0, aqi: 0, t: 0, h: 0 },
      11: { s: 14, aqi: 12, t: 2.2, h: -4 },
      13: { s: -9, aqi: -8, t: -1.6, h: 3 },
    };

    for (const [nodeId, tele] of this.fireSensors.entries()) {
      const isBlocked = blockedNodeIds.has(nodeId);
      const off = fireOffsets[nodeId] || { s: 0, aqi: 0, t: 0, h: 0 };

      if (isBlocked) {
        tele.sensorHealth = 'FAULT';
      } else {
        tele.sensorHealth = 'ONLINE';
        if (fireActive && (fireStage === 'BROADCASTING' || fireStage === 'DISPATCHED')) {
          tele.smoke = Math.min(290, Math.max(150, 210 + off.s + j1 * 22));
          tele.airQualityIndex = Math.min(295, Math.max(160, 220 + off.aqi + j2 * 18));
          tele.temperature = Math.min(88, Math.max(60, 72 + off.t + j3 * 3.5));
          tele.humidity = Math.min(24, Math.max(9, 15 + off.h + j1 * 2));
          tele.flameDetected = true;
        } else if (fireStage === 'RESOLVED') {
          tele.smoke = Math.max(15, tele.smoke * 0.65);
          tele.airQualityIndex = Math.max(45, tele.airQualityIndex * 0.7);
          tele.temperature = Math.max(28, tele.temperature * 0.78);
          tele.humidity = Math.min(52, tele.humidity * 1.3);
          tele.flameDetected = false;
        } else {
          tele.smoke = Math.max(4, 11.2 + off.s + j1 * 1.5);
          tele.airQualityIndex = Math.max(12, Math.round(34 + off.aqi + j2 * 3));
          tele.temperature = 25.8 + off.t + j3 * 0.6;
          tele.humidity = Math.max(15, Math.min(95, 58.0 + off.h + j1 * 1.8));
          tele.flameDetected = false;
        }
      }
      this.appendHistory(tele.history, tele.temperature);
    }

    // -------------------------------------------------------------
    // 3. Update Industrial Cluster (Nodes 3, 15, 17)
    // -------------------------------------------------------------
    const indusActive = activeSimulations.has('industrial');
    const indusSim = activeSimulations.get('industrial');
    const indusStage = indusSim ? indusSim.stage : 'IDLE';

    const indusOffsets: Record<number, { g: number; t: number; p: number; a: number }> = {
      3: { g: 0, t: 0, p: 0, a: 0 },
      15: { g: -8.5, t: -0.7, p: 1.4, a: -3.4 },
      17: { g: 12.5, t: 1.3, p: -1.8, a: 5.2 },
    };

    for (const [nodeId, tele] of this.industrialSensors.entries()) {
      const isBlocked = blockedNodeIds.has(nodeId);
      const off = indusOffsets[nodeId] || { g: 0, t: 0, p: 0, a: 0 };

      if (isBlocked) {
        tele.sensorHealth = 'FAULT';
      } else {
        tele.sensorHealth = 'ONLINE';
        if (indusActive && (indusStage === 'BROADCASTING' || indusStage === 'DISPATCHED')) {
          tele.vocGas = Math.min(230, Math.max(120, 175 + off.g + j1 * 16));
          tele.temperature = Math.min(58, Math.max(38, 48 + off.t + j2 * 2.8));
          tele.pressure = 138.5 + off.p + j3 * 5.2;
          tele.anomalyDeviation = Math.min(98, Math.max(70, 85 + off.a + j1 * 4.5));
        } else if (indusStage === 'RESOLVED') {
          tele.vocGas = Math.max(18, tele.vocGas * 0.68);
          tele.temperature = Math.max(26, tele.temperature * 0.82);
          tele.pressure = 101.3 + (tele.pressure - 101.3) * 0.6;
          tele.anomalyDeviation = Math.max(4.5, tele.anomalyDeviation * 0.65);
        } else {
          tele.vocGas = Math.max(3, 14.0 + off.g + j1 * 1.8);
          tele.temperature = 24.2 + off.t + j2 * 0.5;
          tele.pressure = 101.3 + off.p + j3 * 0.8;
          tele.anomalyDeviation = Math.max(1, 3.5 + off.a + j1 * 0.8);
        }
      }
      this.appendHistory(tele.history, tele.anomalyDeviation);
    }
  }

  private appendHistory(history: number[], value: number): void {
    history.push(parseFloat(value.toFixed(1)));
    if (history.length > 14) {
      history.shift();
    }
  }

  /**
   * Calculates logical sensor availability and coverage state for a hazard zone.
   * Section 9 & 10: FULL (3/3), REDUNDANT (2/3), DEGRADED (1/3), LOST (0/3).
   */
  public getZoneCoverage(zoneId: HazardType, blockedNodeIds: Set<number>): ZoneCoverageSummary {
    const spec = HAZARD_ZONES[zoneId];
    const totalSensors = spec.sensorNodeIds.length;
    const onlineSensors = spec.sensorNodeIds.filter((id) => !blockedNodeIds.has(id));
    const offlineSensors = spec.sensorNodeIds.filter((id) => blockedNodeIds.has(id));

    let coverageState: ZoneCoverageState = 'FULL';
    if (onlineSensors.length === totalSensors) {
      coverageState = 'FULL';
    } else if (onlineSensors.length >= 2) {
      coverageState = 'REDUNDANT';
    } else if (onlineSensors.length === 1) {
      coverageState = 'DEGRADED';
    } else {
      coverageState = 'LOST';
    }

    const detectionState: ZoneDetectionState = onlineSensors.length > 0 ? 'AVAILABLE' : 'UNAVAILABLE';
    const statusText = `${onlineSensors.length} / ${totalSensors} ONLINE`;

    return {
      zoneId,
      zoneTitle: spec.zoneTitle,
      totalSensors,
      onlineSensors,
      offlineSensors,
      coverageState,
      detectionState,
      statusText,
    };
  }

  /**
   * Deterministically selects the best available detection source node for an environmental zone.
   * Section 20: Factors in sensor health (must be ONLINE), reachability to Command Center via BFS,
   * fewest hop distance, risk signal strength, and canonical tier.
   */
  public selectBestDetectionSource(
    zoneId: HazardType,
    blockedNodeIds: Set<number>
  ): number | null {
    const coverage = this.getZoneCoverage(zoneId, blockedNodeIds);
    if (coverage.onlineSensors.length === 0) {
      return null;
    }

    const spec = HAZARD_ZONES[zoneId];

    interface Candidate {
      id: number;
      pathLength: number;
      isPrimary: boolean;
      tierWeight: number;
      riskScore: number;
    }

    const candidates: Candidate[] = [];

    for (const sensorId of coverage.onlineSensors) {
      const path = findShortestPath(sensorId, 0, blockedNodeIds);
      const sensorAssessment = this.getSensorNodeRiskAssessment(sensorId);
      const role = getNodeSensorRole(sensorId);
      const tierWeight = role?.tier === 'PRIMARY' ? 3 : role?.tier === 'SECONDARY' ? 2 : 1;

      candidates.push({
        id: sensorId,
        pathLength: path ? path.length : Infinity,
        isPrimary: sensorId === spec.targetNodeId,
        tierWeight,
        riskScore: sensorAssessment.riskScore,
      });
    }

    // Filter candidates that can reach Command Center (Node 0)
    const reachableCandidates = candidates.filter((c) => c.pathLength < Infinity);

    if (reachableCandidates.length > 0) {
      reachableCandidates.sort((a, b) => {
        // If primary is healthy and reachable, it is canonical source
        if (a.isPrimary !== b.isPrimary) {
          return a.isPrimary ? -1 : 1;
        }
        // Prefer fewest hops to Command
        if (a.pathLength !== b.pathLength) {
          return a.pathLength - b.pathLength;
        }
        // Prefer higher risk detection signal
        if (a.riskScore !== b.riskScore) {
          return b.riskScore - a.riskScore;
        }
        // Prefer higher tier
        return b.tierWeight - a.tierWeight;
      });

      return reachableCandidates[0].id;
    }

    // If partitioned from Command, pick highest tier candidate to report failure locally
    candidates.sort((a, b) => b.tierWeight - a.tierWeight);
    return candidates[0].id;
  }

  /**
   * Computes risk assessment for a specific sensor node.
   */
  public getSensorNodeRiskAssessment(nodeId: number): EdgeRiskAssessment {
    // 1. Flood Sensors (1, 7, 9)
    if (this.floodSensors.has(nodeId)) {
      const data = this.floodSensors.get(nodeId)!;
      if (data.sensorHealth === 'FAULT') {
        return {
          riskScore: 0,
          riskLevel: 'LOW',
          priority: 'MONITORING',
          classification: 'SENSOR OFFLINE',
          anomalyDetected: false,
          recommendedAction: 'Sensor offline — replace telemetry unit',
        };
      }

      const wNorm = Math.min(1, Math.max(0, (data.waterLevel - 10) / 80));
      const rNorm = Math.min(1, Math.max(0, data.rainfall / 35));
      const sNorm = Math.min(1, Math.max(0, (data.soilMoisture - 25) / 70));
      const tNorm = Math.min(1, Math.max(0, (26 - data.temperature) / 8));

      const rawScore = wNorm * 45 + rNorm * 25 + sNorm * 20 + tNorm * 10;
      const riskScore = Math.min(100, Math.max(0, Math.round(rawScore)));

      const riskLevel = this.scoreToLevel(riskScore);
      const priority = this.levelToPriority(riskLevel);
      const anomalyDetected = riskScore >= 25;

      return {
        riskScore,
        riskLevel,
        priority,
        classification: anomalyDetected ? 'FLOOD RISK' : 'NOMINAL',
        anomalyDetected,
        recommendedAction: anomalyDetected
          ? 'Inspect flood corridor & deploy drainage barriers'
          : 'Continuous watershed monitoring',
      };
    }

    // 2. Fire Sensors (2, 11, 13)
    if (this.fireSensors.has(nodeId)) {
      const data = this.fireSensors.get(nodeId)!;
      if (data.sensorHealth === 'FAULT') {
        return {
          riskScore: 0,
          riskLevel: 'LOW',
          priority: 'MONITORING',
          classification: 'SENSOR OFFLINE',
          anomalyDetected: false,
          recommendedAction: 'Sensor offline — replace thermal mast unit',
        };
      }

      const sNorm = Math.min(1, Math.max(0, (data.smoke - 10) / 200));
      const tNorm = Math.min(1, Math.max(0, (data.temperature - 24) / 50));
      const hNorm = Math.min(1, Math.max(0, (60 - data.humidity) / 45));
      const fNorm = data.flameDetected ? 1 : 0;

      const rawScore = sNorm * 35 + tNorm * 30 + hNorm * 20 + fNorm * 15;
      const riskScore = Math.min(100, Math.max(0, Math.round(rawScore)));

      const riskLevel = this.scoreToLevel(riskScore);
      const priority = this.levelToPriority(riskLevel);
      const anomalyDetected = riskScore >= 25;

      return {
        riskScore,
        riskLevel,
        priority,
        classification: anomalyDetected ? 'FOREST FIRE RISK' : 'NOMINAL',
        anomalyDetected,
        recommendedAction: anomalyDetected
          ? 'Deploy thermal aerial drone & isolate perimeter'
          : 'Continuous canopy thermal monitoring',
      };
    }

    // 3. Industrial Sensors (3, 15, 17)
    if (this.industrialSensors.has(nodeId)) {
      const data = this.industrialSensors.get(nodeId)!;
      if (data.sensorHealth === 'FAULT') {
        return {
          riskScore: 0,
          riskLevel: 'LOW',
          priority: 'MONITORING',
          classification: 'SENSOR OFFLINE',
          anomalyDetected: false,
          recommendedAction: 'Sensor offline — replace VOC gas sensor unit',
        };
      }

      const gNorm = Math.min(1, Math.max(0, (data.vocGas - 10) / 160));
      const aNorm = Math.min(1, Math.max(0, (data.anomalyDeviation - 3) / 80));
      const pNorm = Math.min(1, Math.max(0, Math.abs(data.pressure - 101.3) / 35));
      const tNorm = Math.min(1, Math.max(0, (data.temperature - 24) / 30));

      const rawScore = gNorm * 40 + aNorm * 30 + pNorm * 15 + tNorm * 15;
      const riskScore = Math.min(100, Math.max(0, Math.round(rawScore)));

      const riskLevel = this.scoreToLevel(riskScore);
      const priority = this.levelToPriority(riskLevel);
      const anomalyDetected = riskScore >= 25;

      return {
        riskScore,
        riskLevel,
        priority,
        classification: anomalyDetected ? 'INDUSTRIAL RISK' : 'NOMINAL',
        anomalyDetected,
        recommendedAction: anomalyDetected
          ? 'Trigger containment scrubber & inspect pipeline seals'
          : 'Air quality baseline validation',
      };
    }

    // Default for non-sensor nodes
    return {
      riskScore: 0,
      riskLevel: 'LOW',
      priority: 'MONITORING',
      classification: 'NOMINAL',
      anomalyDetected: false,
      recommendedAction: 'Normal operation',
    };
  }

  /**
   * Sensor Fusion Engine across all online sensors in a hazard zone.
   * Section 12: Combines contributing healthy sensor readings into a unified risk assessment.
   * If all sensors fail, risk score is 0 and detection is UNAVAILABLE.
   */
  public getZoneSensorFusion(
    zoneId: HazardType,
    blockedNodeIds: Set<number>
  ): ZoneSensorFusion {
    const spec = HAZARD_ZONES[zoneId];
    const coverage = this.getZoneCoverage(zoneId, blockedNodeIds);

    if (coverage.onlineSensors.length === 0) {
      // Zero sensors online — environmental detection lost completely
      return {
        zoneId,
        zoneTitle: spec.zoneTitle,
        coverage,
        fusedRiskScore: 0,
        fusedRiskLevel: 'LOW',
        fusedPriority: 'MONITORING',
        classification: 'DETECTION UNAVAILABLE',
        anomalyDetected: false,
        recommendedAction: 'RESTORE SENSOR COVERAGE — All environmental sensors in this zone are OFFLINE.',
        contributingSensors: [],
        primaryDetectionSource: null,
        confirmingSources: [],
        detectionAvailable: false,
      };
    }

    // Evaluate each online sensor's individual risk assessment
    const contributingSensors = coverage.onlineSensors.map((sensorId) => {
      const assessment = this.getSensorNodeRiskAssessment(sensorId);
      const designation = spec.sensorDesignations[sensorId] || `Node-${sensorId}`;
      return {
        nodeId: sensorId,
        designation,
        score: assessment.riskScore,
      };
    });

    // Sensor Fusion algorithm:
    // Mean of online sensors + multi-sensor confirmation boost
    const totalScore = contributingSensors.reduce((sum, s) => sum + s.score, 0);
    let fusedRiskScore = Math.round(totalScore / contributingSensors.length);

    // Multi-sensor corroboration: If >= 2 sensors detect elevated readings (>= 25)
    const elevatedCount = contributingSensors.filter((s) => s.score >= 25).length;
    if (elevatedCount >= 2) {
      fusedRiskScore = Math.min(100, Math.round(fusedRiskScore * 1.05));
    }

    const fusedRiskLevel = this.scoreToLevel(fusedRiskScore);
    const fusedPriority = this.levelToPriority(fusedRiskLevel);
    const anomalyDetected = fusedRiskScore >= 25;

    const bestSourceId = this.selectBestDetectionSource(zoneId, blockedNodeIds);
    const primaryDetectionSource = bestSourceId !== null
      ? { nodeId: bestSourceId, designation: spec.sensorDesignations[bestSourceId] || `Node-${bestSourceId}` }
      : null;

    const confirmingSources = contributingSensors
      .filter((s) => s.nodeId !== bestSourceId)
      .map((s) => ({ nodeId: s.nodeId, designation: s.designation }));

    let classification = 'NOMINAL';
    let recommendedAction = 'Continuous baseline monitoring';

    if (zoneId === 'flood') {
      classification = anomalyDetected ? 'FLOOD RISK' : 'NOMINAL';
      recommendedAction = anomalyDetected
        ? 'Inspect flood corridor & deploy drainage barriers'
        : 'Continuous watershed monitoring';
    } else if (zoneId === 'fire') {
      classification = anomalyDetected ? 'FOREST FIRE RISK' : 'NOMINAL';
      recommendedAction = anomalyDetected
        ? 'Deploy thermal aerial drone & isolate perimeter'
        : 'Continuous canopy thermal monitoring';
    } else if (zoneId === 'industrial') {
      classification = anomalyDetected ? 'INDUSTRIAL RISK' : 'NOMINAL';
      recommendedAction = anomalyDetected
        ? 'Trigger containment scrubber & inspect pipeline seals'
        : 'Air quality baseline validation';
    }

    return {
      zoneId,
      zoneTitle: spec.zoneTitle,
      coverage,
      fusedRiskScore,
      fusedRiskLevel,
      fusedPriority,
      classification,
      anomalyDetected,
      recommendedAction,
      contributingSensors,
      primaryDetectionSource,
      confirmingSources,
      detectionAvailable: true,
    };
  }

  /**
   * Returns edge risk assessment for a node.
   * If the node is a sensor node, returns its individual sensor assessment.
   */
  public getEdgeRiskAssessment(nodeId: number): EdgeRiskAssessment {
    return this.getSensorNodeRiskAssessment(nodeId);
  }

  private scoreToLevel(score: number): RiskLevel {
    if (score >= 75) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 25) return 'MODERATE';
    return 'LOW';
  }

  private levelToPriority(level: RiskLevel): PriorityLevel {
    switch (level) {
      case 'CRITICAL':
        return 'EMERGENCY';
      case 'HIGH':
        return 'URGENT';
      case 'MODERATE':
        return 'ELEVATED';
      case 'LOW':
      default:
        return 'MONITORING';
    }
  }

  /**
   * Retrieves relay node telemetry derived from actual physical network topology.
   */
  public getRelayTelemetry(nodeId: number, blockedNodeIds: Set<number>): RelayTelemetry {
    const isNodeOffline = blockedNodeIds.has(nodeId);

    // Compute online neighbors from MESH_EDGES
    let totalNeighbors = 0;
    let onlineNeighbors = 0;

    for (const edge of MESH_EDGES) {
      let neighborId: number | null = null;
      if (edge.source === nodeId) neighborId = edge.target;
      else if (edge.target === nodeId) neighborId = edge.source;

      if (neighborId !== null) {
        totalNeighbors++;
        if (!blockedNodeIds.has(neighborId)) {
          onlineNeighbors++;
        }
      }
    }

    if (isNodeOffline) {
      return {
        linkQuality: 0,
        rssi: -115,
        connectivity: 'ISOLATED',
        packetState: 'DROPPED_ROUTE',
        neighborCount: 0,
        totalNeighbors,
        nodeHealth: 0,
        sensorHealth: 'FAULT',
      };
    }

    const connectivity =
      onlineNeighbors === totalNeighbors
        ? 'CONNECTED'
        : onlineNeighbors > 0
        ? 'DEGRADED'
        : 'ISOLATED';

    const qualityRatio = totalNeighbors > 0 ? onlineNeighbors / totalNeighbors : 1;
    const linkQuality = Math.round(65 + qualityRatio * 32);
    const rssi = Math.round(-88 + qualityRatio * 22);

    return {
      linkQuality,
      rssi,
      connectivity,
      packetState: onlineNeighbors > 0 ? 'FORWARDING' : 'DROPPED_ROUTE',
      neighborCount: onlineNeighbors,
      totalNeighbors,
      nodeHealth: 99,
      sensorHealth: connectivity === 'ISOLATED' ? 'DEGRADED' : 'ONLINE',
    };
  }

  /**
   * Calculates overall System & Network Health from actual topology state.
   */
  public getCommandCenterIntelligence(
    blockedNodeIds: Set<number>,
    activeAlertsCount: number
  ): CommandCenterIntelligence {
    const totalNodesCount = NETWORK_NODES.length; // 24
    const offlineNodesCount = blockedNodeIds.size;
    const onlineNodesCount = totalNodesCount - offlineNodesCount;

    const totalEdgesCount = MESH_EDGES.length; // 39
    let activeEdgesCount = 0;

    for (const edge of MESH_EDGES) {
      if (!blockedNodeIds.has(edge.source) && !blockedNodeIds.has(edge.target)) {
        activeEdgesCount++;
      }
    }

    const commandOffline = blockedNodeIds.has(0);
    const networkHealthPct = commandOffline
      ? 0
      : Math.round((activeEdgesCount / totalEdgesCount) * 100);

    // Find current highest risk among all 3 hazard zones (using sensor fusion)
    let highestRiskScore = 0;
    let highestRiskNodeName = 'All Zones Nominal';
    let highestRiskLevel: RiskLevel = 'LOW';

    const zones: HazardType[] = ['flood', 'fire', 'industrial'];
    for (const zoneId of zones) {
      const fusion = this.getZoneSensorFusion(zoneId, blockedNodeIds);
      if (fusion.fusedRiskScore > highestRiskScore) {
        highestRiskScore = fusion.fusedRiskScore;
        highestRiskNodeName = fusion.zoneTitle;
        highestRiskLevel = fusion.fusedRiskLevel;
      }
    }

    const gatewayStatus = commandOffline
      ? 'OFFLINE'
      : activeEdgesCount >= 2
      ? 'ONLINE'
      : 'DEGRADED';

    const meshStatus =
      activeEdgesCount === totalEdgesCount
        ? 'SELF-HEALING READY'
        : activeEdgesCount > 0
        ? 'TOPOLOGY DEGRADED'
        : 'ISOLATED';

    return {
      networkHealthPct,
      onlineNodesCount,
      totalNodesCount,
      activeEdgesCount,
      totalEdgesCount,
      activeAlertsCount,
      highestRiskNodeName,
      highestRiskScore,
      highestRiskLevel,
      gatewayStatus,
      meshStatus,
    };
  }

  /**
   * Evaluates the routing intelligence for a hazard zone.
   * Compares the actual current BFS route with the canonical primary route to
   * detect and explain redundant sensing failovers and self-healing reroutes.
   */
  public getRouteIntelligence(
    hazardType: HazardType,
    blockedNodeIds: Set<number>,
    sourceNodeId?: number
  ): RouteIntelligence {
    const primaryPath = this.PRIMARY_ROUTES[hazardType];
    const canonicalNodeId = primaryPath[0];

    // Determine actual source node: explicit or best available detection source
    const effectiveSourceId = sourceNodeId ?? this.selectBestDetectionSource(hazardType, blockedNodeIds);

    if (effectiveSourceId === null) {
      return {
        primaryPath,
        currentPath: null,
        pathNodeNames: [],
        isRerouted: false,
        statusText: 'ROUTE SEVERED',
      };
    }

    const currentPath = findShortestPath(effectiveSourceId, 0, blockedNodeIds);

    if (!currentPath || currentPath.length < 2) {
      return {
        primaryPath,
        currentPath: null,
        pathNodeNames: [],
        isRerouted: false,
        statusText: 'ROUTE SEVERED',
      };
    }

    const isFailoverSource = effectiveSourceId !== canonicalNodeId;
    const isPathRerouted =
      currentPath.length !== primaryPath.length ||
      currentPath.some((id, idx) => id !== primaryPath[idx]);

    const pathNodeNames = currentPath.map((id) => {
      const node = NETWORK_NODES.find((n) => n.id === id);
      return node ? node.name : `Node-${id}`;
    });

    let statusText: RouteIntelligence['statusText'] = 'PRIMARY ROUTE';
    if (isFailoverSource) {
      statusText = 'FAILOVER SENSOR ROUTE';
    } else if (isPathRerouted) {
      statusText = 'REROUTED — NODE FAILURE';
    }

    return {
      primaryPath,
      currentPath,
      pathNodeNames,
      isRerouted: isPathRerouted || isFailoverSource,
      statusText,
    };
  }
}

// Standalone module-level helpers for UI components and test harnesses
export const defaultTelemetryService = new TelemetryService();

export function getZoneCoverage(zoneId: HazardType, blockedNodeIds: Set<number>): ZoneCoverageSummary {
  return defaultTelemetryService.getZoneCoverage(zoneId, blockedNodeIds);
}

export function selectBestDetectionSource(zoneId: HazardType, blockedNodeIds: Set<number>): number | null {
  return defaultTelemetryService.selectBestDetectionSource(zoneId, blockedNodeIds);
}

export function getZoneSensorFusion(zoneId: HazardType, blockedNodeIds: Set<number>) {
  return defaultTelemetryService.getZoneSensorFusion(zoneId, blockedNodeIds);
}

export function getRouteIntelligence(
  hazardType: HazardType,
  blockedNodeIds: Set<number> = new Set(),
  sourceNodeId?: number
): RouteIntelligence {
  return defaultTelemetryService.getRouteIntelligence(hazardType, blockedNodeIds, sourceNodeId);
}

