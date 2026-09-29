// FineLynk Simulation Core Types

export type HazardType = 'flood' | 'fire' | 'industrial';

export type SimulationStage =
  | 'IDLE'
  | 'DETECTED'
  | 'BROADCASTING'
  | 'DISPATCHED'
  | 'RESOLVED'
  | 'COOLDOWN';

export interface HazardSimulation {
  id: string;
  hazardType: HazardType;
  hazardNodeId: number;
  stage: SimulationStage;
  path: number[]; // BFS path: [hazardNode, ..., commandCenter(0)]
  stageStartedAt: number; // in seconds
  elapsedInStage: number; // in seconds
  pulseProgress: number; // 0 to 1 along path
  rescueProgress: number; // 0 to 1 along reversed path
}

export type SimulationEventType =
  | 'HAZARD_DETECTED'
  | 'BROADCAST_STARTED'
  | 'BROADCAST_COMPLETED'
  | 'RESCUE_DISPATCHED'
  | 'RESCUE_ARRIVED'
  | 'HAZARD_RESOLVED'
  | 'NO_ROUTE_AVAILABLE'
  | 'NODE_FAILED'
  | 'NODE_RESTORED'
  | 'ROUTE_RECONFIGURED'
  | 'SIMULATION_RESET';

import { ZoneCoverageState } from '../data/hazards';

export interface SimulationEvent {
  type: SimulationEventType;
  hazardType?: HazardType;
  hazardNodeId?: number;
  nodeId?: number;
  path?: number[];
  timestamp: string; // HH:MM:SS
  message: string;
  riskScore?: number;
  riskLevel?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  priority?: 'MONITORING' | 'ELEVATED' | 'URGENT' | 'EMERGENCY';
  classification?: string;
  recommendedAction?: string;
  isRerouted?: boolean;
  sources?: string[];
  primarySource?: string;
  confirmingSources?: string[];
  coverageStatus?: string;
  coverageState?: ZoneCoverageState;
}
