import React from 'react';
import { Waves, Flame, Biohazard, Network, Tag, RotateCcw, ChevronRight } from 'lucide-react';
import { HazardType } from '../simulation/types';
import { NETWORK_NODES, getNodeSensorRole } from '../data/nodes';
import { getZoneCoverage } from '../simulation/telemetry';

interface LeftControlPanelProps {
  showLinks: boolean;
  onToggleLinks: (show: boolean) => void;
  showLabels: boolean;
  onToggleLabels: (show: boolean) => void;
  activeHazards: Record<HazardType, boolean>;
  onTriggerHazard: (type: HazardType) => void;
  onResetSimulation: () => void;
  selectedNodeId?: number | null;
  onSelectNode?: (nodeId: number) => void;
  failedNodeIds?: Set<number>;
  onToggleNodeFailure?: (nodeId: number, failed: boolean) => void;
}

export const LeftControlPanel: React.FC<LeftControlPanelProps> = ({
  showLinks,
  onToggleLinks,
  showLabels,
  onToggleLabels,
  activeHazards,
  onTriggerHazard,
  onResetSimulation,
  selectedNodeId = null,
  onSelectNode,
  failedNodeIds = new Set(),
}) => {
  const floodCov = getZoneCoverage('flood', failedNodeIds);
  const fireCov = getZoneCoverage('fire', failedNodeIds);
  const indusCov = getZoneCoverage('industrial', failedNodeIds);

  const onlineNodesCount = NETWORK_NODES.length - failedNodeIds.size;

  return (
    <aside className="interactive glass-panel left-command-dock" aria-label="Incident & Network Command Dock">
      {/* Header */}
      <div className="dock-header">
        <span className="dock-kicker">FineLynk</span>
        <h2 className="dock-title">Incident Control</h2>
      </div>

      <div className="glass-divider" />

      {/* SECTION 1: INCIDENTS */}
      <div className="glass-section-header">
        <span>Incidents</span>
        <span className="header-meta">Simulate</span>
      </div>

      <div className="hazard-rows-group" role="group" aria-label="Hazard Triggers">
        {/* Flood Row */}
        <button
          type="button"
          className={`hazard-row ${activeHazards.flood ? 'is-active flood' : ''} ${
            floodCov.detectionState === 'UNAVAILABLE' ? 'is-disabled' : ''
          }`}
          onClick={() => onTriggerHazard('flood')}
          disabled={activeHazards.flood || floodCov.detectionState === 'UNAVAILABLE'}
          aria-pressed={activeHazards.flood}
          aria-label="Simulate Flood in River Basin"
        >
          <div className="hazard-icon-box flood">
            <Waves size={15} />
          </div>
          <div className="hazard-info">
            <span className="hazard-name">Flood</span>
            <span className="hazard-origin">
              Flood-04 • {floodCov.onlineSensors.length}/{floodCov.totalSensors} {floodCov.coverageState}
            </span>
          </div>
          <div className="hazard-action-indicator">
            {activeHazards.flood ? (
              <span className="active-badge flood">
                <span className="active-dot" /> ACTIVE
              </span>
            ) : (
              <ChevronRight size={14} className="action-arrow" />
            )}
          </div>
        </button>

        {/* Forest Fire Row */}
        <button
          type="button"
          className={`hazard-row ${activeHazards.fire ? 'is-active fire' : ''} ${
            fireCov.detectionState === 'UNAVAILABLE' ? 'is-disabled' : ''
          }`}
          onClick={() => onTriggerHazard('fire')}
          disabled={activeHazards.fire || fireCov.detectionState === 'UNAVAILABLE'}
          aria-pressed={activeHazards.fire}
          aria-label="Simulate Forest Fire in Mountain Sector"
        >
          <div className="hazard-icon-box fire">
            <Flame size={15} />
          </div>
          <div className="hazard-info">
            <span className="hazard-name">Forest Fire</span>
            <span className="hazard-origin">
              Forest-07 • {fireCov.onlineSensors.length}/{fireCov.totalSensors} {fireCov.coverageState}
            </span>
          </div>
          <div className="hazard-action-indicator">
            {activeHazards.fire ? (
              <span className="active-badge fire">
                <span className="active-dot" /> ACTIVE
              </span>
            ) : (
              <ChevronRight size={14} className="action-arrow" />
            )}
          </div>
        </button>

        {/* Industrial Row */}
        <button
          type="button"
          className={`hazard-row ${activeHazards.industrial ? 'is-active industrial' : ''} ${
            indusCov.detectionState === 'UNAVAILABLE' ? 'is-disabled' : ''
          }`}
          onClick={() => onTriggerHazard('industrial')}
          disabled={activeHazards.industrial || indusCov.detectionState === 'UNAVAILABLE'}
          aria-pressed={activeHazards.industrial}
          aria-label="Simulate Industrial Chemical Incident"
        >
          <div className="hazard-icon-box industrial">
            <Biohazard size={15} />
          </div>
          <div className="hazard-info">
            <span className="hazard-name">Industrial</span>
            <span className="hazard-origin">
              Indus-02 • {indusCov.onlineSensors.length}/{indusCov.totalSensors} {indusCov.coverageState}
            </span>
          </div>
          <div className="hazard-action-indicator">
            {activeHazards.industrial ? (
              <span className="active-badge industrial">
                <span className="active-dot" /> ACTIVE
              </span>
            ) : (
              <ChevronRight size={14} className="action-arrow" />
            )}
          </div>
        </button>
      </div>

      <div className="glass-divider" />

      {/* SECTION 2: COMPACT NODE NAVIGATOR (ALL 24 NODES) */}
      <div className="glass-section-header">
        <span>Nodes</span>
        <span className="node-online-count">
          {onlineNodesCount} / {NETWORK_NODES.length} Online
        </span>
      </div>

      <div className="node-navigator-list" role="listbox" aria-label="24 Node Navigator">
        {NETWORK_NODES.map((node) => {
          const isFailed = failedNodeIds.has(node.id);
          const isSelected = selectedNodeId === node.id;
          const sensorRole = getNodeSensorRole(node.id);

          return (
            <div
              key={node.id}
              role="option"
              aria-selected={isSelected}
              className={`node-nav-row ${isSelected ? 'selected' : ''} ${isFailed ? 'failed' : ''}`}
              onClick={() => onSelectNode && onSelectNode(node.id)}
              title={`${node.name} — ${isFailed ? 'OFFLINE (Select to inspect/restore)' : 'ONLINE (Select to inspect)'}`}
            >
              <div className="node-row-left">
                <span
                  className={`glass-status-dot ${
                    isFailed ? 'critical' : node.isCommandCenter ? 'command' : 'cyan'
                  }`}
                />
                <span className="node-nav-name">{node.name}</span>
                {sensorRole && (
                  <span className={`sensor-tag ${sensorRole.zoneId} ${isFailed ? 'severed' : ''}`}>
                    {sensorRole.designation}
                  </span>
                )}
              </div>
              <span className="node-row-state">
                {isFailed ? 'OFFLINE' : isSelected ? 'INSPECT' : ''}
              </span>
            </div>
          );
        })}
      </div>

      <div className="glass-divider" />

      {/* SECTION 3: NETWORK DISPLAY CONTROLS */}
      <div className="glass-section-header">
        <span>Network Layers</span>
      </div>

      <div className="network-toggles-group">
        <div
          className="glass-toggle-row"
          onClick={() => onToggleLinks(!showLinks)}
          role="switch"
          aria-checked={showLinks}
          aria-label="Toggle mesh links"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onToggleLinks(!showLinks);
            }
          }}
        >
          <div className="toggle-info">
            <Network size={13} className="toggle-icon" />
            <span className="toggle-text">Mesh Links</span>
          </div>
          <div className={`glass-switch ${showLinks ? 'active' : ''}`}>
            <div className="glass-switch-thumb" />
          </div>
        </div>

        <div
          className="glass-toggle-row"
          onClick={() => onToggleLabels(!showLabels)}
          role="switch"
          aria-checked={showLabels}
          aria-label="Toggle node labels"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onToggleLabels(!showLabels);
            }
          }}
        >
          <div className="toggle-info">
            <Tag size={13} className="toggle-icon" />
            <span className="toggle-text">Node Labels</span>
          </div>
          <div className={`glass-switch ${showLabels ? 'active' : ''}`}>
            <div className="glass-switch-thumb" />
          </div>
        </div>
      </div>

      <div className="glass-divider" />

      {/* SECTION 4: RESET CONTROL */}
      <button
        type="button"
        className="glass-btn glass-btn-reset"
        onClick={onResetSimulation}
        aria-label="Reset Simulation"
        title="Reset all active hazards, failures, and routes"
      >
        <RotateCcw size={13} />
        <span>Reset Simulation</span>
      </button>

      <style>{`
        .left-command-dock {
          width: 270px;
          margin-top: 14px;
          margin-left: 18px;
          padding: 14px;
          display: flex;
          flex-direction: column;
        }

        .dock-header {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .dock-kicker {
          font-family: var(--font-heading);
          font-size: 0.60rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--cyan);
        }

        .dock-title {
          font-family: var(--font-heading);
          font-size: 0.90rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: 0.02em;
          margin: 0;
        }

        .header-meta {
          font-size: 0.60rem;
          font-weight: 500;
          color: var(--text-muted);
          text-transform: none;
          letter-spacing: 0.02em;
        }

        .hazard-rows-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .hazard-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-control);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          text-align: left;
          width: 100%;
        }

        .hazard-row:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.16);
          transform: translateX(1px);
        }

        .hazard-row.is-disabled {
          opacity: 0.45;
          cursor: not-allowed;
          border-style: dashed;
        }

        .hazard-row.is-active {
          cursor: default;
        }

        .hazard-row.is-active.flood {
          background: rgba(56, 189, 248, 0.08);
          border-color: rgba(56, 189, 248, 0.35);
        }

        .hazard-row.is-active.fire {
          background: rgba(249, 115, 22, 0.08);
          border-color: rgba(249, 115, 22, 0.35);
        }

        .hazard-row.is-active.industrial {
          background: rgba(192, 132, 252, 0.08);
          border-color: rgba(192, 132, 252, 0.35);
        }

        .hazard-icon-box {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--glass-border);
          flex-shrink: 0;
        }

        .hazard-icon-box.flood { color: var(--flood); }
        .hazard-icon-box.fire { color: var(--fire); }
        .hazard-icon-box.industrial { color: var(--industrial); }

        .hazard-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
        }

        .hazard-name {
          font-family: var(--font-heading);
          font-size: 0.74rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .hazard-origin {
          font-family: var(--font-mono);
          font-size: 0.58rem;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hazard-action-indicator {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          margin-left: auto;
        }

        .action-arrow {
          color: var(--text-muted);
          transition: transform 0.2s ease, color 0.2s ease;
        }

        .hazard-row:hover:not(:disabled) .action-arrow {
          transform: translateX(2px);
          color: var(--text-primary);
        }

        .active-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-mono);
          font-size: 0.56rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 2px 5px;
          border-radius: 4px;
        }

        .active-badge.flood {
          color: var(--flood);
          background: rgba(56, 189, 248, 0.12);
          border: 1px solid rgba(56, 189, 248, 0.25);
        }

        .active-badge.fire {
          color: var(--fire);
          background: rgba(249, 115, 22, 0.12);
          border: 1px solid rgba(249, 115, 22, 0.25);
        }

        .active-badge.industrial {
          color: var(--industrial);
          background: rgba(192, 132, 252, 0.12);
          border: 1px solid rgba(192, 132, 252, 0.25);
        }

        .active-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
          animation: pulseDot 1.4s ease-in-out infinite;
        }

        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }

        .node-online-count {
          font-family: var(--font-mono);
          font-size: 0.60rem;
          color: var(--cyan);
          font-weight: 600;
        }

        .node-navigator-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-height: 180px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .node-nav-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 7px;
          border-radius: 5px;
          cursor: pointer;
          background: transparent;
          border: 1px solid transparent;
          transition: all 0.15s ease;
        }

        .node-nav-row:hover {
          background: rgba(255, 255, 255, 0.035);
          border-color: rgba(255, 255, 255, 0.06);
        }

        .node-nav-row.selected {
          background: rgba(34, 211, 238, 0.08);
          border-color: rgba(34, 211, 238, 0.3);
        }

        .node-nav-row.failed {
          opacity: 0.75;
          border-left: 2px solid var(--critical);
        }

        .node-row-left {
          display: flex;
          align-items: center;
          gap: 7px;
          min-width: 0;
        }

        .node-nav-name {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          color: var(--text-primary);
        }

        .sensor-tag {
          font-family: var(--font-mono);
          font-size: 0.52rem;
          padding: 1px 3px;
          border-radius: 2px;
          font-weight: 600;
        }

        .sensor-tag.flood { color: var(--flood); background: rgba(56, 189, 248, 0.12); }
        .sensor-tag.fire { color: var(--fire); background: rgba(249, 115, 22, 0.12); }
        .sensor-tag.industrial { color: var(--industrial); background: rgba(192, 132, 252, 0.12); }
        .sensor-tag.severed { text-decoration: line-through; opacity: 0.6; }

        .node-row-state {
          font-family: var(--font-mono);
          font-size: 0.56rem;
          font-weight: 700;
          color: var(--critical);
          letter-spacing: 0.03em;
        }

        .node-nav-row.selected .node-row-state {
          color: var(--cyan);
        }

        .network-toggles-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .glass-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 0;
          cursor: pointer;
        }

        .toggle-info {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
          transition: color 0.15s ease;
        }

        .glass-toggle-row:hover .toggle-info {
          color: var(--text-primary);
        }

        .toggle-icon {
          color: var(--text-muted);
        }

        .toggle-text {
          font-family: var(--font-heading);
          font-size: 0.70rem;
        }

        .glass-switch {
          position: relative;
          width: 32px;
          height: 18px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-pill);
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }

        .glass-switch.active {
          background: rgba(34, 211, 238, 0.22);
          border-color: rgba(34, 211, 238, 0.45);
        }

        .glass-switch-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--text-muted);
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease;
        }

        .glass-switch.active .glass-switch-thumb {
          transform: translateX(14px);
          background: var(--cyan);
          box-shadow: 0 0 6px rgba(34, 211, 238, 0.5);
        }

        .glass-btn-reset {
          width: 100%;
          justify-content: center;
          color: var(--text-secondary);
          padding: 7px 10px;
        }

        .glass-btn-reset:hover {
          color: var(--critical);
          border-color: rgba(244, 63, 94, 0.35);
          background: rgba(244, 63, 94, 0.08);
        }

        @media (max-width: 768px) {
          .left-command-dock {
            width: calc(100% - 28px);
            margin: 10px 14px;
            max-height: 44vh;
            overflow-y: auto;
          }
        }
      `}</style>
    </aside>
  );
};
