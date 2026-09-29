import { HazardType, HazardSimulation } from './types';
import { HAZARD_ZONES } from '../data/hazards';
import { findShortestPath } from './pathfinding';
import { SimulationEventEmitter } from './events';
import { NetworkNodes } from '../scene/NetworkNodes';
import { HazardEffects } from '../scene/HazardEffects';
import { SimulationMarkers } from '../scene/SimulationMarkers';
import { NETWORK_NODES } from '../data/nodes';
import { TelemetryService } from './telemetry';

export class SimulationEngine {
  public activeSimulations: Map<HazardType, HazardSimulation> = new Map();
  public events: SimulationEventEmitter = new SimulationEventEmitter();
  public blockedNodeIds: Set<number> = new Set();
  public telemetry: TelemetryService = new TelemetryService();

  private networkNodes: NetworkNodes;
  private hazardEffects: HazardEffects;
  private markers: SimulationMarkers;
  private totalElapsedTime: number = 0;

  // Timing specifications
  private readonly BROADCAST_DURATION = 1.1; // ~1.1s alert pulse travel
  private readonly DISPATCH_DELAY = 0.4;     // ~0.4s buffer to reach ~1.5s post-detection
  private readonly RESCUE_DURATION = 3.0;    // ~3.0s rescue unit return
  private readonly RESOLVED_HOLD = 0.9;      // ~0.9s green hold before returning to safe

  constructor(
    networkNodes: NetworkNodes,
    hazardEffects: HazardEffects,
    markers: SimulationMarkers
  ) {
    this.networkNodes = networkNodes;
    this.hazardEffects = hazardEffects;
    this.markers = markers;
  }

  /**
   * Helper to format current timestamp as HH:MM:SS
   */
  private getTimestamp(): string {
    return new Date().toTimeString().split(' ')[0];
  }

  /**
   * Helper to format path as human readable node names
   */
  private formatPathNames(path: number[]): string {
    return path
      .map((id) => {
        const node = NETWORK_NODES.find((n) => n.id === id);
        return node ? node.name : `Node-${id}`;
      })
      .join(' → ');
  }

  /**
   * Toggles node operational failure status for any network node.
   * Dynamically triggers self-healing BFS path re-evaluation, sensor failovers, and emits ROUTE_RECONFIGURED events.
   */
  public setNodeBlocked(nodeId: number, blocked: boolean): void {
    const node = NETWORK_NODES.find((n) => n.id === nodeId);
    const nodeName = node ? node.name : `Node-${nodeId}`;

    if (blocked) {
      this.blockedNodeIds.add(nodeId);
      this.networkNodes.setNodeStatus(nodeId, 'offline');
      this.events.emit({
        type: 'NODE_FAILED',
        nodeId,
        timestamp: this.getTimestamp(),
        message: `NODE OFFLINE — ${nodeName} failed. Mesh auto-rerouting active paths.`,
      });
    } else {
      this.blockedNodeIds.delete(nodeId);
      const restoredStatus = node?.isCommandCenter ? 'command' : 'safe';
      this.networkNodes.setNodeStatus(nodeId, restoredStatus, true);
      this.events.emit({
        type: 'NODE_RESTORED',
        nodeId,
        timestamp: this.getTimestamp(),
        message: `NODE ONLINE — ${nodeName} restored. Mesh topology recovered.`,
      });
    }

    // Dynamic Self-Healing BFS & Sensor Failover evaluation across all active simulations
    for (const [hazardType, sim] of this.activeSimulations.entries()) {
      const spec = HAZARD_ZONES[hazardType];

      // Check if the current reporting sensor node has failed
      if (this.blockedNodeIds.has(sim.hazardNodeId)) {
        // Attempt redundant sensor failover to another healthy sensor in this hazard zone
        const failoverSensorId = this.telemetry.selectBestDetectionSource(hazardType, this.blockedNodeIds);

        if (failoverSensorId !== null) {
          const failoverPath = findShortestPath(failoverSensorId, 0, this.blockedNodeIds);

          if (failoverPath && failoverPath.length >= 2) {
            const failoverNodeName = NETWORK_NODES.find((n) => n.id === failoverSensorId)?.name || `Node-${failoverSensorId}`;
            sim.hazardNodeId = failoverSensorId;
            sim.path = failoverPath;
            this.networkNodes.setNodeStatus(failoverSensorId, 'critical');

            // Re-anchor pulse or rescue marker along new path
            this.markers.removePulse(sim.id);
            this.markers.removeRescue(sim.id);
            if (sim.stage === 'BROADCASTING') {
              this.markers.createPulse(sim.id, failoverPath);
            } else if (sim.stage === 'DISPATCHED') {
              this.markers.createRescue(sim.id, failoverPath);
            }

            const coverage = this.telemetry.getZoneCoverage(hazardType, this.blockedNodeIds);
            this.events.emit({
              type: 'ROUTE_RECONFIGURED',
              hazardType,
              hazardNodeId: failoverSensorId,
              path: failoverPath,
              isRerouted: true,
              coverageStatus: coverage.statusText,
              coverageState: coverage.coverageState,
              timestamp: this.getTimestamp(),
              message: `[SENSOR FAILOVER & SELF-HEALING] Primary sensor ${nodeName} OFFLINE. Detection shifted to ${failoverNodeName}. New Route: [${this.formatPathNames(failoverPath)}]`,
            });
            continue;
          }
        }

        // No healthy sensor available or partitioned
        this.markers.removePulse(sim.id);
        this.markers.removeRescue(sim.id);
        this.events.emit({
          type: 'NO_ROUTE_AVAILABLE',
          hazardType,
          hazardNodeId: sim.hazardNodeId,
          timestamp: this.getTimestamp(),
          message: `NO ROUTE AVAILABLE — All sensor detection and egress routes severed for ${spec.zoneTitle}. ACTION REQUIRED: Restore network connectivity.`,
        });
        continue;
      }

      // Origin sensor is still healthy; re-evaluate intermediate mesh route
      const newPath = findShortestPath(sim.hazardNodeId, 0, this.blockedNodeIds);

      if (newPath && newPath.length >= 2) {
        const isPathChanged =
          newPath.length !== sim.path.length ||
          newPath.some((id, idx) => id !== sim.path[idx]);

        if (isPathChanged) {
          sim.path = newPath;
          if (sim.stage === 'BROADCASTING') {
            this.markers.updatePulseProgress(sim.id, sim.pulseProgress);
          } else if (sim.stage === 'DISPATCHED') {
            this.markers.updateRescueProgress(sim.id, sim.rescueProgress);
          }
          this.events.emit({
            type: 'ROUTE_RECONFIGURED',
            hazardType,
            hazardNodeId: sim.hazardNodeId,
            path: newPath,
            isRerouted: true,
            timestamp: this.getTimestamp(),
            message: `[SELF-HEALING] ROUTE RECONFIGURED — Cause: ${nodeName} ${blocked ? 'OFFLINE' : 'RESTORED'}. New Route: [${this.formatPathNames(newPath)}]`,
          });
        }
      } else {
        // Intermediate path severed
        this.markers.removePulse(sim.id);
        this.markers.removeRescue(sim.id);
        this.events.emit({
          type: 'NO_ROUTE_AVAILABLE',
          hazardType,
          hazardNodeId: sim.hazardNodeId,
          timestamp: this.getTimestamp(),
          message: `NO ROUTE AVAILABLE — Communication path unavailable for Node ${sim.hazardNodeId}. ACTION REQUIRED: Restore network connectivity.`,
        });
      }
    }
  }

  public get activeAlertsCount(): number {
    return this.activeSimulations.size;
  }

  public get teamsDeployedCount(): number {
    let count = 0;
    for (const sim of this.activeSimulations.values()) {
      if (sim.stage === 'DISPATCHED') count++;
    }
    return count;
  }

  /**
   * Returns all active route paths across running simulations.
   */
  public getActiveRoutes(): number[][] {
    const routes: number[][] = [];
    for (const sim of this.activeSimulations.values()) {
      if (sim.path && sim.path.length > 0) {
        routes.push(sim.path);
      }
    }
    return routes;
  }

  /**
   * Triggers a hazard simulation with redundant multi-sensor detection and sensor fusion.
   * Section 14, 15, 16, 17, 18, 19, 20:
   * - Selects best available healthy sensor node from the hazard zone cluster.
   * - Performs multi-sensor fusion.
   * - Routes SOS through available mesh nodes via BFS to Command Center.
   * - If all sensors fail (0/3), environmental detection stops (no fake SOS).
   */
  public triggerHazard(type: HazardType): boolean {
    if (this.isHazardActive(type)) {
      return false;
    }

    const spec = HAZARD_ZONES[type];
    const coverage = this.telemetry.getZoneCoverage(type, this.blockedNodeIds);

    // Section 33: NO SENSOR AVAILABLE -> Detection stops, no fake SOS generated
    if (coverage.coverageState === 'LOST' || coverage.onlineSensors.length === 0) {
      console.warn(`All sensors in ${spec.zoneTitle} are OFFLINE. Detection unavailable.`);
      this.events.emit({
        type: 'NO_ROUTE_AVAILABLE',
        hazardType: type,
        timestamp: this.getTimestamp(),
        message: `DETECTION UNAVAILABLE — All sensors in ${spec.zoneTitle} are OFFLINE (0/${coverage.totalSensors} online). RESTORE SENSOR COVERAGE to detect hazard.`,
        coverageStatus: `0/${coverage.totalSensors} sensors online`,
        coverageState: 'LOST',
      });
      return false;
    }

    // Best Available Detection Source Selection (Section 19 & 20)
    const selectedSourceId = this.telemetry.selectBestDetectionSource(type, this.blockedNodeIds);
    if (selectedSourceId === null) {
      console.warn(`No operational sensor source available for ${spec.zoneTitle}`);
      return false;
    }

    const sourceNode = NETWORK_NODES.find((n) => n.id === selectedSourceId);
    const sourceNodeName = sourceNode ? sourceNode.name : `Node-${selectedSourceId}`;

    // Calculate BFS route from the selected healthy sensor to Command Center (Node 0)
    const path = findShortestPath(selectedSourceId, 0, this.blockedNodeIds);

    if (!path || path.length < 2) {
      console.warn(`No viable route from detection source ${sourceNodeName} to Command Center`);
      let failureReason = `No viable mesh path found from ${sourceNodeName}. All egress routes blocked.`;
      if (this.blockedNodeIds.has(0)) {
        failureReason = 'COMMAND NODE OFFLINE. Rescue dispatch unavailable.';
      }

      this.events.emit({
        type: 'NO_ROUTE_AVAILABLE',
        hazardType: type,
        hazardNodeId: selectedSourceId,
        timestamp: this.getTimestamp(),
        message: `NO ROUTE AVAILABLE — ${failureReason}`,
        coverageStatus: coverage.statusText,
        coverageState: coverage.coverageState,
      });

      return false;
    }

    // Immediately mark reporting sensor critical (visual urgency cue)
    this.networkNodes.setNodeStatus(selectedSourceId, 'critical');

    // Immediately start visual hazard effect
    this.hazardEffects.startHazardEffect(type);

    const simId = `${type}-${Date.now()}`;
    const simulation: HazardSimulation = {
      id: simId,
      hazardType: type,
      hazardNodeId: selectedSourceId,
      stage: 'BROADCASTING',
      path,
      stageStartedAt: 0,
      elapsedInStage: 0,
      pulseProgress: 0,
      rescueProgress: 0,
    };

    this.activeSimulations.set(type, simulation);

    // Update telemetry state and perform Sensor Fusion across healthy sensors in zone
    this.telemetry.update(this.totalElapsedTime + 0.1, this.activeSimulations, this.blockedNodeIds);
    const fusion = this.telemetry.getZoneSensorFusion(type, this.blockedNodeIds);
    const routeIntel = this.telemetry.getRouteIntelligence(type, this.blockedNodeIds, selectedSourceId);

    const sourceNames = fusion.contributingSensors.map((s) => s.designation);
    const primaryName = fusion.primaryDetectionSource?.designation || sourceNodeName;
    const confirmingNames = fusion.confirmingSources.map((s) => s.designation);
    const coverageStatusText = `${coverage.onlineSensors.length}/${coverage.totalSensors} sensors online`;

    // Emit initial detection event with complete Sensor Fusion and Edge Intelligence
    this.events.emit({
      type: 'HAZARD_DETECTED',
      hazardType: type,
      hazardNodeId: selectedSourceId,
      path,
      riskScore: fusion.fusedRiskScore,
      riskLevel: fusion.fusedRiskLevel,
      priority: fusion.fusedPriority,
      classification: fusion.classification,
      recommendedAction: fusion.recommendedAction,
      isRerouted: routeIntel.isRerouted,
      sources: sourceNames,
      primarySource: primaryName,
      confirmingSources: confirmingNames,
      coverageStatus: coverageStatusText,
      coverageState: coverage.coverageState,
      timestamp: this.getTimestamp(),
      message: `[ALERT] ${fusion.zoneTitle} — ${fusion.fusedRiskLevel} RISK (${fusion.classification}). Sources: [${sourceNames.join(', ')}]. Primary: ${primaryName}. Coverage: ${coverageStatusText}. Score: ${fusion.fusedRiskScore}/100.`,
    });

    // Start Alert Pulse marker along BFS path
    this.markers.createPulse(simId, path);
    this.events.emit({
      type: 'BROADCAST_STARTED',
      hazardType: type,
      hazardNodeId: selectedSourceId,
      path,
      riskScore: fusion.fusedRiskScore,
      riskLevel: fusion.fusedRiskLevel,
      priority: fusion.fusedPriority,
      classification: fusion.classification,
      isRerouted: routeIntel.isRerouted,
      sources: sourceNames,
      primarySource: primaryName,
      confirmingSources: confirmingNames,
      coverageStatus: coverageStatusText,
      coverageState: coverage.coverageState,
      timestamp: this.getTimestamp(),
      message: `[DISPATCH] SOS transmitted through [${this.formatPathNames(path)}] to Command Center.`,
    });

    return true;
  }

  public isHazardActive(type: HazardType): boolean {
    const sim = this.activeSimulations.get(type);
    return sim !== undefined && sim.stage !== 'IDLE';
  }

  public getSimulation(type: HazardType): HazardSimulation | undefined {
    return this.activeSimulations.get(type);
  }

  /**
   * Main per-frame update loop called inside ThreeScene requestAnimationFrame.
   */
  public update(deltaTime: number): void {
    this.totalElapsedTime += deltaTime;
    this.telemetry.update(this.totalElapsedTime, this.activeSimulations, this.blockedNodeIds);

    for (const [type, sim] of Array.from(this.activeSimulations.entries())) {
      sim.elapsedInStage += deltaTime;

      switch (sim.stage) {
        case 'BROADCASTING': {
          // Pulse moves from reporting hazard sensor to Command Center
          sim.pulseProgress = Math.min(1, sim.elapsedInStage / this.BROADCAST_DURATION);
          this.markers.updatePulseProgress(sim.id, sim.pulseProgress);

          if (sim.pulseProgress >= 1) {
            this.markers.removePulse(sim.id);
            const fusion = this.telemetry.getZoneSensorFusion(type, this.blockedNodeIds);
            const reportingNode = NETWORK_NODES.find((n) => n.id === sim.hazardNodeId);
            const reportingName = reportingNode?.name || `Node-${sim.hazardNodeId}`;

            this.events.emit({
              type: 'BROADCAST_COMPLETED',
              hazardType: type,
              hazardNodeId: sim.hazardNodeId,
              path: sim.path,
              riskScore: fusion.fusedRiskScore,
              riskLevel: fusion.fusedRiskLevel,
              priority: fusion.fusedPriority,
              classification: fusion.classification,
              timestamp: this.getTimestamp(),
              message: `Alert received at Command Center from ${reportingName}. Fused Risk: ${fusion.fusedRiskScore}/100. Authorizing rescue unit.`,
            });

            // Transition to DISPATCHED with tactical buffer
            sim.stage = 'DISPATCHED';
            sim.elapsedInStage = -this.DISPATCH_DELAY;
            sim.rescueProgress = 0;

            const spec = HAZARD_ZONES[type];
            this.markers.createRescue(sim.id, sim.path);
            this.events.emit({
              type: 'RESCUE_DISPATCHED',
              hazardType: type,
              hazardNodeId: sim.hazardNodeId,
              path: [...sim.path].reverse(),
              riskScore: fusion.fusedRiskScore,
              riskLevel: fusion.fusedRiskLevel,
              priority: fusion.fusedPriority,
              classification: fusion.classification,
              recommendedAction: fusion.recommendedAction,
              timestamp: this.getTimestamp(),
              message: `[ACTION] Rescue unit dispatched for ${spec.zoneTitle}. Route: [${this.formatPathNames([...sim.path].reverse())}]. Action: ${fusion.recommendedAction}`,
            });
          }
          break;
        }

        case 'DISPATCHED': {
          if (sim.elapsedInStage < 0) {
            this.markers.updateRescueProgress(sim.id, 0);
            break;
          }

          // Rescue marker travels along reversed path
          sim.rescueProgress = Math.min(1, sim.elapsedInStage / this.RESCUE_DURATION);
          this.markers.updateRescueProgress(sim.id, sim.rescueProgress);

          if (sim.rescueProgress >= 1) {
            this.markers.removeRescue(sim.id);

            // Reporting node turns green (resolved)
            this.networkNodes.setNodeStatus(sim.hazardNodeId, 'resolved');

            // Stop hazard visual effect
            this.hazardEffects.stopHazardEffect(type);

            const reportingNode = NETWORK_NODES.find((n) => n.id === sim.hazardNodeId);
            const reportingName = reportingNode?.name || `Node-${sim.hazardNodeId}`;

            this.events.emit({
              type: 'RESCUE_ARRIVED',
              hazardType: type,
              hazardNodeId: sim.hazardNodeId,
              timestamp: this.getTimestamp(),
              message: `Rescue team arrived on site at ${reportingName}. Neutralizing hazard conditions.`,
            });

            this.events.emit({
              type: 'HAZARD_RESOLVED',
              hazardType: type,
              hazardNodeId: sim.hazardNodeId,
              timestamp: this.getTimestamp(),
              message: `Hazard resolved at ${reportingName}. Restoring environmental baselines.`,
            });

            sim.stage = 'RESOLVED';
            sim.elapsedInStage = 0;
          }
          break;
        }

        case 'RESOLVED': {
          // Hold resolved (green) status for ~0.9s
          if (sim.elapsedInStage >= this.RESOLVED_HOLD) {
            if (!this.blockedNodeIds.has(sim.hazardNodeId)) {
              this.networkNodes.setNodeStatus(sim.hazardNodeId, 'safe');
            }
            sim.stage = 'IDLE';
            this.activeSimulations.delete(type);
          }
          break;
        }

        default:
          break;
      }
    }
  }

  /**
   * Resets all simulation instances, stops hazard effects, cleans up markers, and resets nodes.
   */
  public reset(): void {
    this.markers.clearAll();
    this.hazardEffects.reset();
    this.activeSimulations.clear();
    this.blockedNodeIds.clear();
    this.telemetry.reset();
    this.totalElapsedTime = 0;
    this.networkNodes.resetAllNodes();

    this.events.emit({
      type: 'SIMULATION_RESET',
      timestamp: this.getTimestamp(),
      message: 'System online. Multi-sensor environmental monitoring active…',
    });
  }

  public dispose(): void {
    this.markers.clearAll();
    this.hazardEffects.reset();
    this.activeSimulations.clear();
    this.events.clear();
  }
}
