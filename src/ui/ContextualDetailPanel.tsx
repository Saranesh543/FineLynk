import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  AlertOctagon,
  RotateCcw,
  Waves,
  Flame,
  Biohazard,
} from 'lucide-react';
import {
  InteractiveTarget,
  InteractiveNodeTarget,
  InteractiveHazardTarget,
  InteractiveLandmarkTarget,
} from '../interaction/types';
import { HazardType } from '../simulation/types';
import { TelemetryService } from '../simulation/telemetry';
import { Sparkline } from './Sparkline';

interface ContextualDetailPanelProps {
  target: InteractiveTarget | null;
  onClose: () => void;
  onToggleNodeFailure: (nodeId: number, failed: boolean) => void;
  isNodeFailed: (nodeId: number) => boolean;
  onTriggerHazard: (type: HazardType) => void;
  isHazardActive: (type: HazardType) => boolean;
  telemetry: TelemetryService | null;
  failedNodeIds: Set<number>;
  activeAlertsCount: number;
}

export const ContextualDetailPanel: React.FC<ContextualDetailPanelProps> = ({
  target,
  onClose,
  onToggleNodeFailure,
  isNodeFailed,
  onTriggerHazard,
  isHazardActive,
  telemetry,
  failedNodeIds,
  activeAlertsCount,
}) => {
  // Fluid live ticker for telemetry values
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const [minimizedSummary, setMinimizedSummary] = useState(false);

  // If no target is selected, render the clean Command Center System Intelligence Overview
  if (!target) {
    if (minimizedSummary) return null;

    const sysIntel = telemetry?.getCommandCenterIntelligence(failedNodeIds, activeAlertsCount);

    return (
      <AnimatePresence>
        <motion.aside
          key="system-intelligence-summary"
          className="interactive glass-panel contextual-glass-panel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          role="region"
          aria-label="Command Center Overview"
        >
          <div className="sheet-handle" />
          <div className="sheet-header">
            <div className="sheet-title-group">
              <span className="sheet-kicker">Command Center</span>
              <h3 className="sheet-title">Network Overview</h3>
            </div>
            <button
              type="button"
              className="sheet-close-btn"
              onClick={() => setMinimizedSummary(true)}
              aria-label="Minimize Overview"
              title="Minimize command center overview"
            >
              <X size={14} />
            </button>
          </div>

          <div className="sheet-body">
            {/* Section 1: Network Overview */}
            <div className="spec-row">
              <span className="spec-label">Mesh Health</span>
              <span
                className="spec-val"
                style={{
                  color:
                    (sysIntel?.networkHealthPct ?? 100) > 75
                      ? 'var(--cyan)'
                      : (sysIntel?.networkHealthPct ?? 100) > 40
                      ? 'var(--fire)'
                      : 'var(--critical)',
                }}
              >
                {sysIntel?.networkHealthPct ?? 100}%
              </span>
            </div>

            <div className="spec-row">
              <span className="spec-label">Online Nodes</span>
              <span className="spec-val">
                {sysIntel?.onlineNodesCount ?? 24} / {sysIntel?.totalNodesCount ?? 24}
              </span>
            </div>

            <div className="spec-row">
              <span className="spec-label">Active Alerts</span>
              <span
                className="spec-val"
                style={{
                  color: (sysIntel?.activeAlertsCount ?? 0) > 0 ? 'var(--critical)' : 'var(--text-primary)',
                  fontWeight: (sysIntel?.activeAlertsCount ?? 0) > 0 ? 700 : 500,
                }}
              >
                {sysIntel?.activeAlertsCount ?? 0}
              </span>
            </div>

            <div className="glass-divider" />

            {/* Section 2: Current Situation */}
            <div className="glass-section-header">
              <span>Current Situation</span>
            </div>

            <div className="spec-row">
              <span className="spec-label">Active Incidents</span>
              <span className="spec-val">
                {(sysIntel?.activeAlertsCount ?? 0) === 0 ? (
                  <span style={{ color: 'var(--resolved)' }}>Nominal — No Active Hazards</span>
                ) : (
                  <span style={{ color: 'var(--critical)' }}>{sysIntel?.activeAlertsCount} Active Incident(s)</span>
                )}
              </span>
            </div>

            <div className="spec-row">
              <span className="spec-label">Highest Edge Risk</span>
              <span
                className="spec-val"
                style={{
                  color:
                    sysIntel?.highestRiskLevel === 'CRITICAL'
                      ? 'var(--critical)'
                      : sysIntel?.highestRiskLevel === 'HIGH'
                      ? 'var(--fire)'
                      : 'var(--cyan)',
                }}
              >
                {sysIntel?.highestRiskNodeName || 'None'} ({sysIntel?.highestRiskLevel || 'LOW'})
              </span>
            </div>

            <div className="glass-divider" />

            {/* Section 3: Communication */}
            <div className="glass-section-header">
              <span>Communication</span>
            </div>

            <div className="spec-row">
              <span className="spec-label">Offline Mesh</span>
              <span className="spec-val">LoRa / Simulated P2P</span>
            </div>

            <div className="spec-row">
              <span className="spec-label">Gateway Status</span>
              <span className="sheet-status-pill online">{sysIntel?.gatewayStatus ?? 'ONLINE'}</span>
            </div>

            <div className="sheet-hint">
              <span>● Click any 3D node or territory sector to inspect live edge sensors, risk scores & telemetry.</span>
            </div>
          </div>

          <style>{panelStyles}</style>
        </motion.aside>
      </AnimatePresence>
    );
  }

  // When a Target (Node, Hazard Sector, Landmark) is selected
  return (
    <AnimatePresence>
      <motion.aside
        key={target.name}
        className="interactive glass-panel contextual-glass-panel"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        role="region"
        aria-label="Contextual Inspector"
      >
        <div className="sheet-handle" />
        {/* Panel Header */}
        <div className="sheet-header">
          <div className="sheet-title-group">
            <span className="sheet-kicker">
              {target.type === 'node'
                ? 'Node Inspector'
                : target.type === 'hazard'
                ? 'Incident Sector'
                : 'Landmark'}
            </span>
            <h3 className="sheet-title">{target.name}</h3>
          </div>
          <button
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            aria-label="Close Inspector"
            title="Deselect and close inspector"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content based on Target Type */}
        <div className="sheet-body">
          {target.type === 'node' && (
            <NodeInspectorContent
              target={target}
              isFailed={isNodeFailed(target.id)}
              onToggleFailure={(failed) => onToggleNodeFailure(target.id, failed)}
              telemetry={telemetry}
              failedNodeIds={failedNodeIds}
              activeAlertsCount={activeAlertsCount}
            />
          )}

          {target.type === 'hazard' && (
            <HazardInspectorContent
              target={target}
              isActive={isHazardActive(target.id)}
              onTrigger={() => onTriggerHazard(target.id)}
              telemetry={telemetry}
              failedNodeIds={failedNodeIds}
            />
          )}

          {target.type === 'landmark' && <LandmarkInspectorContent target={target} />}
        </div>

        <style>{panelStyles}</style>
      </motion.aside>
    </AnimatePresence>
  );
};

// ----------------------------------------------------------------------------
// Subcomponent: Node Inspector Content
// ----------------------------------------------------------------------------

interface NodeInspectorContentProps {
  target: InteractiveNodeTarget;
  isFailed: boolean;
  onToggleFailure: (failed: boolean) => void;
  telemetry: TelemetryService | null;
  failedNodeIds: Set<number>;
  activeAlertsCount: number;
}

const NodeInspectorContent: React.FC<NodeInspectorContentProps> = ({
  target,
  isFailed,
  onToggleFailure,
  telemetry,
  failedNodeIds,
  activeAlertsCount,
}) => {
  const isCommand = target.isCommandCenter;
  const isHazardNode = target.id >= 1 && target.id <= 3;
  const isRelay = target.id >= 4 && target.id <= 6;
  const isFieldMesh = target.id >= 7;

  // Telemetry & Edge Intelligence
  const assessment = telemetry?.getEdgeRiskAssessment(target.id);
  const relayTelemetry = isRelay || isFieldMesh ? telemetry?.getRelayTelemetry(target.id, failedNodeIds) : null;
  const commandIntel = isCommand
    ? telemetry?.getCommandCenterIntelligence(failedNodeIds, activeAlertsCount)
    : null;

  // Route Intelligence for hazard nodes
  const hazardType =
    target.id === 1 ? 'flood' : target.id === 2 ? 'fire' : target.id === 3 ? 'industrial' : null;
  const routeIntel = hazardType ? telemetry?.getRouteIntelligence(hazardType, failedNodeIds) : null;

  const sensorHealthLabel = isFailed
    ? 'LOCAL DATA ONLY'
    : isHazardNode
    ? target.id === 1
      ? telemetry?.flood.sensorHealth ?? 'ONLINE'
      : target.id === 2
      ? telemetry?.fire.sensorHealth ?? 'ONLINE'
      : telemetry?.industrial.sensorHealth ?? 'ONLINE'
    : isRelay
    ? relayTelemetry?.sensorHealth ?? 'ONLINE'
    : 'ONLINE';

  // 5-Stage Disaster Response Pipeline calculation
  const stageEnvText = isFailed
    ? 'SEVERED'
    : isHazardNode
    ? assessment?.anomalyDetected
      ? 'ALERT'
      : 'NOMINAL'
    : 'MONITORED';
  const stageEnvClass = isFailed
    ? 'status-critical'
    : assessment?.anomalyDetected
    ? 'status-elevated'
    : 'status-nominal';

  const stageSensorText = isFailed
    ? 'LOCAL'
    : isHazardNode
    ? assessment?.anomalyDetected
      ? 'ANOMALY'
      : 'STREAM'
    : 'DIAG';
  const stageSensorClass = isFailed
    ? 'status-critical'
    : assessment?.anomalyDetected
    ? 'status-elevated'
    : 'status-nominal';

  const stageNodeText = isFailed ? 'OFFLINE' : 'ONLINE';
  const stageNodeClass = isFailed ? 'status-critical' : 'status-nominal';

  const stageMeshText = isFailed
    ? 'ISOLATED'
    : routeIntel?.isRerouted
    ? 'REROUTED'
    : routeIntel?.statusText === 'ROUTE SEVERED'
    ? 'SEVERED'
    : 'FORWARD';
  const stageMeshClass =
    isFailed || routeIntel?.statusText === 'ROUTE SEVERED'
      ? 'status-critical'
      : routeIntel?.isRerouted
      ? 'status-rerouted'
      : 'status-nominal';

  const stageCommandText =
    isFailed || routeIntel?.statusText === 'ROUTE SEVERED' ? 'LOST' : 'LINKED';
  const stageCommandClass =
    isFailed || routeIntel?.statusText === 'ROUTE SEVERED'
      ? 'status-critical'
      : 'status-nominal';

  return (
    <>
      {/* Node Identification & Role */}
      <div className="spec-row">
        <span className="spec-label">Role</span>
        <span className="spec-val" style={{ color: 'var(--cyan)' }}>
          {target.sensorRole
            ? 'Environmental Sensor & Relay'
            : isCommand
            ? 'Command Center Gateway'
            : isRelay
            ? 'Multi-Hop Relay Router'
            : 'Field Relay'}
        </span>
      </div>

      <div className="spec-row">
        <span className="spec-label">Operational State</span>
        <span className={`sheet-status-pill ${isFailed ? 'offline' : 'online'}`}>
          {isFailed ? '● OFFLINE' : '● ONLINE'}
        </span>
      </div>

      <div className="spec-row">
        <span className="spec-label">Sensor Health</span>
        <span className="spec-val" style={{ color: isFailed ? 'var(--critical)' : 'var(--resolved)' }}>
          {sensorHealthLabel}
        </span>
      </div>

      {target.sensorRole && (
        <div className="spec-row">
          <span className="spec-label">Sensor Tier</span>
          <span className="spec-val">{target.sensorRole.tier}</span>
        </div>
      )}

      {/* SECTION: COMMAND CENTER GATEWAY TELEMETRY (Node 0) */}
      {isCommand && commandIntel && (
        <>
          <div className="glass-section-header">
            <span>Gateway Intelligence</span>
            <span className="header-mono-tag">LoRa Gateway</span>
          </div>

          <div className="spec-row">
            <span className="spec-label">Network Health</span>
            <span className="spec-val" style={{ color: 'var(--cyan)' }}>
              {commandIntel.networkHealthPct}% ({commandIntel.activeEdgesCount}/{commandIntel.totalEdgesCount} Links)
            </span>
          </div>

          <div className="spec-row">
            <span className="spec-label">Online Nodes</span>
            <span className="spec-val">
              {commandIntel.onlineNodesCount} / {commandIntel.totalNodesCount} Active
            </span>
          </div>

          <div className="spec-row">
            <span className="spec-label">Active Alerts</span>
            <span className="spec-val" style={{ color: activeAlertsCount > 0 ? 'var(--critical)' : 'var(--resolved)' }}>
              {activeAlertsCount} Active Incident(s)
            </span>
          </div>

          <div className="glass-divider" />
        </>
      )}

      {/* SECTION 2: TELEMETRY & SPARKLINE (When Environmental Sensor Node 1, 2, or 3) */}
      {isHazardNode && (
        <>
          <div className="glass-section-header">
            <span>Environmental Telemetry</span>
            <span className="header-mono-tag">Edge Stream</span>
          </div>

          {target.id === 1 && telemetry && (
            <>
              <div className="telemetry-grid">
                <div className="telemetry-item">
                  <span className="t-label">Water Level</span>
                  <span className="t-val">{telemetry.flood.waterLevel.toFixed(1)} %</span>
                </div>
                <div className="telemetry-item">
                  <span className="t-label">Rainfall</span>
                  <span className="t-val">{telemetry.flood.rainfall.toFixed(1)} mm/h</span>
                </div>
                <div className="telemetry-item">
                  <span className="t-label">Soil Moisture</span>
                  <span className="t-val">{telemetry.flood.soilMoisture.toFixed(1)} %</span>
                </div>
                <div className="telemetry-item">
                  <span className="t-label">Temperature</span>
                  <span className="t-val">{telemetry.flood.temperature.toFixed(1)} °C</span>
                </div>
              </div>
              <div className="sparkline-wrapper">
                <span className="sparkline-title">Water Level Trend (% vs time)</span>
                <Sparkline data={telemetry.flood.history} color="var(--flood)" unit="%" />
              </div>
            </>
          )}

          {target.id === 2 && telemetry && (
            <>
              <div className="telemetry-grid">
                <div className="telemetry-item">
                  <span className="t-label">Smoke Level</span>
                  <span className="t-val">{telemetry.fire.smoke.toFixed(0)} ppm</span>
                </div>
                <div className="telemetry-item">
                  <span className="t-label">Air Quality</span>
                  <span className="t-val">{telemetry.fire.airQualityIndex} AQI</span>
                </div>
                <div className="telemetry-item">
                  <span className="t-label">Temperature</span>
                  <span className="t-val">{telemetry.fire.temperature.toFixed(1)} °C</span>
                </div>
                <div className="telemetry-item">
                  <span className="t-label">Humidity</span>
                  <span className="t-val">{telemetry.fire.humidity.toFixed(1)} %</span>
                </div>
              </div>
              <div className="spec-row" style={{ marginTop: '6px' }}>
                <span className="spec-label">Flame Sensor</span>
                <span
                  className="spec-val"
                  style={{
                    color: telemetry.fire.flameDetected ? 'var(--critical)' : 'var(--resolved)',
                  }}
                >
                  {telemetry.fire.flameDetected ? 'FLAME DETECTED' : 'CLEAR'}
                </span>
              </div>
              <div className="sparkline-wrapper">
                <span className="sparkline-title">Canopy Temperature Trend (°C)</span>
                <Sparkline data={telemetry.fire.history} color="var(--fire)" unit="°C" />
              </div>
            </>
          )}

          {target.id === 3 && telemetry && (
            <>
              <div className="telemetry-grid">
                <div className="telemetry-item">
                  <span className="t-label">VOC Gas</span>
                  <span className="t-val">{telemetry.industrial.vocGas.toFixed(1)} ppm</span>
                </div>
                <div className="telemetry-item">
                  <span className="t-label">Temperature</span>
                  <span className="t-val">{telemetry.industrial.temperature.toFixed(1)} °C</span>
                </div>
                <div className="telemetry-item">
                  <span className="t-label">Pressure</span>
                  <span className="t-val">{telemetry.industrial.pressure.toFixed(1)} kPa</span>
                </div>
                <div className="telemetry-item">
                  <span className="t-label">Anomaly Dev.</span>
                  <span className="t-val">{telemetry.industrial.anomalyDeviation.toFixed(1)} %</span>
                </div>
              </div>
              <div className="sparkline-wrapper">
                <span className="sparkline-title">Gas Anomaly Deviation Trend (%)</span>
                <Sparkline
                  data={telemetry.industrial.history}
                  color="var(--industrial)"
                  unit="%"
                />
              </div>
            </>
          )}

          <div className="glass-divider" />
        </>
      )}

      {/* SECTION 3: EDGE INTELLIGENCE (Risk score, priority, action) */}
      {assessment && (
        <>
          <div className="glass-section-header">
            <span>Edge Intelligence</span>
            <span className={`sheet-risk-badge badge-${assessment.riskLevel.toLowerCase()}`}>
              {assessment.riskLevel}
            </span>
          </div>

          <div className="spec-row">
            <span className="spec-label">Risk Score</span>
            <span className="spec-val">
              {assessment.riskScore} / 100 ({assessment.priority})
            </span>
          </div>

          {/* Minimalist Progress Meter */}
          <div className="meter-track">
            <div
              className={`meter-bar level-${assessment.riskLevel.toLowerCase()}`}
              style={{ width: `${assessment.riskScore}%` }}
            />
          </div>

          <div className="spec-row" style={{ marginTop: '4px' }}>
            <span className="spec-label">Classification</span>
            <span className="spec-val">{assessment.classification}</span>
          </div>

          {assessment.recommendedAction && (
            <div className="sheet-action-callout">
              <span className="callout-tag">ACTION</span>
              <p className="callout-text">{assessment.recommendedAction}</p>
            </div>
          )}

          <div className="glass-divider" />
        </>
      )}

      {/* SECTION 4: 5-STAGE OPERATIONAL PIPELINE */}
      <div className="glass-section-header">
        <span>5-Stage Operational Pipeline</span>
      </div>

      <div className="pipeline-flow">
        <div className={`pipeline-step ${stageEnvClass}`}>
          <span className="step-name">ENV</span>
          <span className="step-val">{stageEnvText}</span>
        </div>
        <span className="pipeline-arrow">›</span>
        <div className={`pipeline-step ${stageSensorClass}`}>
          <span className="step-name">SENSOR</span>
          <span className="step-val">{stageSensorText}</span>
        </div>
        <span className="pipeline-arrow">›</span>
        <div className={`pipeline-step ${stageNodeClass}`}>
          <span className="step-name">NODE</span>
          <span className="step-val">{stageNodeText}</span>
        </div>
        <span className="pipeline-arrow">›</span>
        <div className={`pipeline-step ${stageMeshClass}`}>
          <span className="step-name">MESH</span>
          <span className="step-val">{stageMeshText}</span>
        </div>
        <span className="pipeline-arrow">›</span>
        <div className={`pipeline-step ${stageCommandClass}`}>
          <span className="step-name">CMD</span>
          <span className="step-val">{stageCommandText}</span>
        </div>
      </div>

      <div className="glass-divider" />

      {/* SECTION 5: MESH TOPOLOGY & ROUTING */}
      <div className="glass-section-header">
        <span>Mesh Routing</span>
      </div>

      <div className="spec-row">
        <span className="spec-label">Connected Links</span>
        <span className="spec-val">{target.linksCount} Adjacent Links</span>
      </div>

      {routeIntel && (
        <div className="spec-row">
          <span className="spec-label">Route Path</span>
          <span className="spec-val route-flow-text">
            {routeIntel.currentPath ? routeIntel.pathNodeNames.join(' → ') : 'ISOLATED'}
          </span>
        </div>
      )}

      <div className="spec-row">
        <span className="spec-label">Pathfinding State</span>
        <span
          className="spec-val"
          style={{ color: isFailed ? 'var(--critical)' : 'var(--resolved)' }}
        >
          {isFailed ? 'EXCLUDED FROM BFS' : 'ACTIVE IN BFS'}
        </span>
      </div>

      <div className="glass-divider" />

      {/* SECTION 6: CONTEXTUAL NODE FAILURE SIMULATION ACTION BUTTON */}
      <div className="sheet-action-container">
        {isFailed ? (
          <button
            type="button"
            className="sheet-action-btn restore"
            onClick={() => onToggleFailure(false)}
            aria-label={`Restore node ${target.name}`}
          >
            <RotateCcw size={14} />
            <span>Restore Node</span>
          </button>
        ) : (
          <button
            type="button"
            className="sheet-action-btn fail"
            onClick={() => onToggleFailure(true)}
            aria-label={`Simulate failure on node ${target.name}`}
          >
            <AlertOctagon size={14} />
            <span>Simulate Failure</span>
          </button>
        )}
      </div>
    </>
  );
};

// ----------------------------------------------------------------------------
// Subcomponent: Hazard Sector Inspector
// ----------------------------------------------------------------------------

interface HazardInspectorContentProps {
  target: InteractiveHazardTarget;
  isActive: boolean;
  onTrigger: () => void;
  telemetry: TelemetryService | null;
  failedNodeIds: Set<number>;
}

const HazardInspectorContent: React.FC<HazardInspectorContentProps> = ({
  target,
  isActive,
  onTrigger,
  telemetry,
  failedNodeIds,
}) => {
  const getHazardIcon = () => {
    if (target.id === 'flood') return <Waves size={14} color="var(--flood)" />;
    if (target.id === 'fire') return <Flame size={14} color="var(--fire)" />;
    return <Biohazard size={14} color="var(--industrial)" />;
  };

  const fusion = telemetry?.getZoneSensorFusion(target.id, failedNodeIds);
  const coverage = fusion?.coverage;
  const isDetectionAvailable = fusion?.detectionAvailable ?? true;

  return (
    <>
      <div className="spec-row">
        <span className="spec-label">Sector Status</span>
        <span className={`sheet-status-pill ${isActive ? 'active' : 'online'}`}>
          {isActive ? '● ACTIVE' : '● DORMANT'}
        </span>
      </div>

      <div className="spec-row">
        <span className="spec-label">Zone Title</span>
        <span className="spec-val">{target.zoneTitle || target.name}</span>
      </div>

      <div className="spec-row">
        <span className="spec-label">Sensor Coverage</span>
        <span className="spec-val" style={{ color: 'var(--cyan)' }}>
          {coverage ? coverage.statusText : '3 / 3 Online'}
        </span>
      </div>

      <div className="spec-row">
        <span className="spec-label">Coverage Tier</span>
        <span className="spec-val">{coverage?.coverageState ?? 'FULL'}</span>
      </div>

      <div className="spec-row">
        <span className="spec-label">Active Sources</span>
        <span className="spec-val">
          {fusion && fusion.contributingSensors.length > 0
            ? fusion.contributingSensors.map((s) => s.designation).join(', ')
            : 'None (Coverage Lost)'}
        </span>
      </div>

      {fusion && (
        <div className="spec-row">
          <span className="spec-label">Zone Risk</span>
          <span className="spec-val">
            {fusion.fusedRiskLevel} ({fusion.fusedRiskScore}/100)
          </span>
        </div>
      )}

      <p className="sheet-description">{target.description}</p>

      {!isDetectionAvailable && (
        <div className="coverage-lost-banner">
          <strong>DETECTION UNAVAILABLE</strong>
          <span>All sensors in this zone are OFFLINE. Restore sensors to detect hazards.</span>
        </div>
      )}

      <div className="sheet-action-container">
        <button
          type="button"
          className="sheet-action-btn trigger"
          onClick={onTrigger}
          disabled={isActive || !isDetectionAvailable}
          aria-label={`Trigger hazard in ${target.name}`}
        >
          {getHazardIcon()}
          <span>
            {isActive
              ? 'Hazard Active'
              : !isDetectionAvailable
              ? 'Detection Unavailable'
              : 'Trigger Incident'}
          </span>
        </button>
      </div>
    </>
  );
};

// ----------------------------------------------------------------------------
// Subcomponent: Landmark Inspector
// ----------------------------------------------------------------------------

interface LandmarkInspectorContentProps {
  target: InteractiveLandmarkTarget;
}

const LandmarkInspectorContent: React.FC<LandmarkInspectorContentProps> = ({ target }) => {
  return (
    <>
      <div className="spec-row">
        <span className="spec-label">Classification</span>
        <span className="spec-val">{target.category}</span>
      </div>

      <div className="spec-row">
        <span className="spec-label">Coordinates</span>
        <span className="spec-val">
          [{target.coordinates[0].toFixed(1)}, {target.coordinates[1].toFixed(1)}]
        </span>
      </div>

      <div className="spec-row">
        <span className="spec-label">Facility State</span>
        <span className="sheet-status-pill online">ONLINE</span>
      </div>

      <p className="sheet-description">{target.description}</p>
    </>
  );
};

// ----------------------------------------------------------------------------
// Styling: Minimal Glass Command Sheet
// ----------------------------------------------------------------------------

const panelStyles = `
  .contextual-glass-panel {
    position: absolute;
    left: 304px;
    top: 66px;
    width: 320px;
    max-height: 80vh;
    overflow-y: auto;
    padding: 14px;
    display: flex;
    flex-direction: column;
    z-index: 25;
  }

  .sheet-handle {
    display: none;
    width: 36px;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-pill);
    margin: 0 auto 10px auto;
  }

  .sheet-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .sheet-title-group {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .sheet-kicker {
    font-family: var(--font-heading);
    font-size: 0.60rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--cyan);
  }

  .sheet-title {
    font-family: var(--font-heading);
    font-size: 0.94rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: 0.02em;
  }

  .sheet-close-btn {
    background: transparent;
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    color: var(--text-muted);
    cursor: pointer;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .sheet-close-btn:hover {
    color: var(--text-primary);
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.05);
  }

  .sheet-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .spec-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.70rem;
    padding: 3px 0;
  }

  .spec-label {
    font-family: var(--font-heading);
    color: var(--text-muted);
    font-size: 0.64rem;
    letter-spacing: 0.02em;
  }

  .spec-val {
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.68rem;
    text-align: right;
  }

  .header-mono-tag {
    font-family: var(--font-mono);
    font-size: 0.56rem;
    color: var(--text-muted);
    text-transform: none;
    letter-spacing: 0.02em;
  }

  .sheet-status-pill {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: var(--radius-pill);
    letter-spacing: 0.03em;
  }

  .sheet-status-pill.online {
    color: var(--resolved);
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .sheet-status-pill.offline {
    color: var(--critical);
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid rgba(244, 63, 94, 0.3);
  }

  .sheet-status-pill.active {
    color: var(--fire);
    background: rgba(249, 115, 22, 0.12);
    border: 1px solid rgba(249, 115, 22, 0.3);
  }

  .sheet-risk-badge {
    font-family: var(--font-mono);
    font-size: 0.56rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
  }

  .sheet-risk-badge.badge-critical { color: var(--critical); background: rgba(244, 63, 94, 0.15); }
  .sheet-risk-badge.badge-high { color: var(--fire); background: rgba(249, 115, 22, 0.15); }
  .sheet-risk-badge.badge-moderate { color: var(--command); background: rgba(251, 191, 36, 0.15); }
  .sheet-risk-badge.badge-low { color: var(--cyan); background: rgba(34, 211, 238, 0.15); }

  .telemetry-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-top: 2px;
  }

  .telemetry-item {
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid var(--glass-border-subtle);
    border-radius: 6px;
    padding: 5px 8px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .t-label {
    font-family: var(--font-heading);
    font-size: 0.58rem;
    color: var(--text-muted);
  }

  .t-val {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .sparkline-wrapper {
    margin-top: 6px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--glass-border-subtle);
    border-radius: 6px;
    padding: 6px;
  }

  .sparkline-title {
    font-family: var(--font-heading);
    font-size: 0.58rem;
    color: var(--text-muted);
    display: block;
    margin-bottom: 2px;
  }

  .meter-track {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-pill);
    overflow: hidden;
    margin: 3px 0 6px 0;
  }

  .meter-bar {
    height: 100%;
    transition: width 0.4s ease;
  }

  .meter-bar.level-low { background: var(--cyan); }
  .meter-bar.level-moderate { background: var(--command); }
  .meter-bar.level-high { background: var(--fire); }
  .meter-bar.level-critical { background: var(--critical); }

  .sheet-action-callout {
    background: rgba(251, 191, 36, 0.07);
    border-left: 2px solid var(--command);
    padding: 4px 8px;
    margin-top: 4px;
    border-radius: 0 4px 4px 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .callout-tag {
    font-family: var(--font-mono);
    font-size: 0.52rem;
    font-weight: 700;
    color: var(--command);
  }

  .callout-text {
    font-size: 0.65rem;
    color: var(--text-secondary);
    line-height: 1.3;
    margin: 0;
  }

  .pipeline-flow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
    margin: 4px 0;
  }

  .pipeline-step {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3px 2px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--glass-border-subtle);
    border-radius: 4px;
    min-width: 0;
  }

  .step-name {
    font-family: var(--font-heading);
    font-size: 0.54rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .step-val {
    font-family: var(--font-mono);
    font-size: 0.50rem;
    font-weight: 600;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .pipeline-step.status-nominal .step-name { color: var(--cyan); }
  .pipeline-step.status-elevated .step-name { color: var(--fire); }
  .pipeline-step.status-critical .step-name { color: var(--critical); }
  .pipeline-step.status-rerouted .step-name { color: var(--command); }

  .pipeline-arrow {
    color: var(--text-muted);
    font-size: 0.70rem;
    opacity: 0.4;
  }

  .route-flow-text {
    max-width: 190px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sheet-action-container {
    margin-top: 8px;
  }

  .sheet-action-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: var(--radius-control);
    font-family: var(--font-heading);
    font-size: 0.74rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .sheet-action-btn.fail {
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid rgba(244, 63, 94, 0.35);
    color: var(--critical);
  }

  .sheet-action-btn.fail:hover {
    background: rgba(244, 63, 94, 0.22);
    border-color: rgba(244, 63, 94, 0.5);
  }

  .sheet-action-btn.restore {
    background: rgba(34, 211, 238, 0.12);
    border: 1px solid rgba(34, 211, 238, 0.35);
    color: var(--cyan);
  }

  .sheet-action-btn.restore:hover {
    background: rgba(34, 211, 238, 0.22);
    border-color: rgba(34, 211, 238, 0.5);
  }

  .sheet-action-btn.trigger {
    background: rgba(34, 211, 238, 0.12);
    border: 1px solid rgba(34, 211, 238, 0.35);
    color: var(--cyan);
  }

  .sheet-action-btn.trigger:hover:not(:disabled) {
    background: rgba(34, 211, 238, 0.22);
  }

  .sheet-action-btn.trigger:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .sheet-description {
    font-size: 0.68rem;
    color: var(--text-secondary);
    line-height: 1.35;
    margin-top: 4px;
  }

  .coverage-lost-banner {
    background: rgba(244, 63, 94, 0.1);
    border: 1px solid rgba(244, 63, 94, 0.3);
    border-radius: 6px;
    padding: 6px 8px;
    margin-top: 6px;
    font-size: 0.66rem;
    color: var(--critical);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sheet-hint {
    font-size: 0.62rem;
    color: var(--text-muted);
    line-height: 1.3;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed var(--glass-border);
    border-radius: 6px;
    margin-top: 6px;
  }

  @media (max-width: 860px) {
    .contextual-glass-panel {
      left: 14px;
      right: 14px;
      top: auto;
      bottom: 60px;
      width: calc(100% - 28px);
      max-height: 48vh;
      border-radius: 18px 18px 0 0;
    }

    .sheet-handle {
      display: block;
    }
  }
`;
