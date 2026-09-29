import React from 'react';
import { Activity, ShieldAlert, Users, Radio } from 'lucide-react';

interface TopBarProps {
  totalNodes?: number;
  failedNodeCount?: number;
  activeAlerts?: number;
  teamsDeployed?: number;
  networkHealthPct?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  totalNodes = 24,
  failedNodeCount = 0,
  activeAlerts = 0,
  teamsDeployed = 0,
  networkHealthPct = 100,
}) => {
  const isDegraded = failedNodeCount > 0 || networkHealthPct < 100;
  const isCriticalAlert = activeAlerts > 0;

  return (
    <header className="interactive glass-topbar" role="banner" aria-label="FineLynk Network Telemetry Bar">
      {/* Left Branding & Live Status */}
      <div className="brand-group">
        <div className={`live-beacon ${isDegraded ? 'degraded' : 'nominal'}`}>
          <span className="beacon-core" />
          <span className="beacon-ring" />
        </div>
        <div className="brand-text-container">
          <div className="brand-name">
            FineLynk <span className="brand-tag">3D</span>
          </div>
          <div className="brand-status">
            {isDegraded
              ? `${failedNodeCount} node${failedNodeCount > 1 ? 's' : ''} offline // routing rerouted`
              : 'Live Mesh Network // 24 Nodes Active'}
          </div>
        </div>
      </div>

      {/* Right Metric Capsules */}
      <div className="metrics-group" role="region" aria-label="Live System Metrics">
        {/* Mesh Health Capsule */}
        <div
          className={`metric-capsule ${networkHealthPct < 100 ? 'capsule-warning' : ''}`}
          title="Mesh Network Health: percentage of operational multi-hop links"
        >
          <Radio size={12} className={networkHealthPct < 100 ? 'icon-warning' : 'icon-cyan'} />
          <span className="metric-label">Mesh Health</span>
          <span className="metric-value">{networkHealthPct}%</span>
        </div>

        {/* Nodes Online Capsule */}
        <div
          className={`metric-capsule ${failedNodeCount > 0 ? 'capsule-warning' : ''}`}
          title="Active online nodes in the 24-node graph"
        >
          <Activity size={12} className={failedNodeCount > 0 ? 'icon-warning' : 'icon-cyan'} />
          <span className="metric-label">Nodes</span>
          <span className="metric-value">
            {totalNodes - failedNodeCount}<span className="metric-denom">/{totalNodes}</span>
          </span>
        </div>

        {/* Active Alerts Capsule */}
        <div
          className={`metric-capsule ${isCriticalAlert ? 'capsule-alert' : ''}`}
          title="Active hazard incidents requiring response"
        >
          <ShieldAlert size={12} className={isCriticalAlert ? 'icon-alert' : 'icon-muted'} />
          <span className="metric-label">Alerts</span>
          <span className={`metric-value ${isCriticalAlert ? 'val-alert' : ''}`}>{activeAlerts}</span>
        </div>

        {/* Deployed Teams Capsule */}
        <div
          className={`metric-capsule ${teamsDeployed > 0 ? 'capsule-active' : ''}`}
          title="Active disaster dispatch teams deployed"
        >
          <Users size={12} className={teamsDeployed > 0 ? 'icon-command' : 'icon-muted'} />
          <span className="metric-label">Teams</span>
          <span className={`metric-value ${teamsDeployed > 0 ? 'val-command' : ''}`}>{teamsDeployed}</span>
        </div>
      </div>

      <style>{`
        .glass-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 24px;
          height: 52px;
          background: var(--glass-hud-bg);
          background-image: var(--glass-highlight);
          border-bottom: 1px solid var(--glass-border);
          backdrop-filter: blur(var(--glass-hud-blur));
          -webkit-backdrop-filter: blur(var(--glass-hud-blur));
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
          width: 100%;
          z-index: 20;
          transition: background-color 0.3s ease;
        }

        .brand-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .live-beacon {
          position: relative;
          width: 8px;
          height: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .beacon-core {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--cyan);
          box-shadow: 0 0 8px rgba(34, 211, 238, 0.6);
          transition: background-color 0.3s ease;
        }

        .beacon-ring {
          position: absolute;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1px solid var(--cyan);
          opacity: 0.6;
          animation: beaconPulse 2.8s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }

        .live-beacon.degraded .beacon-core {
          background: var(--fire);
          box-shadow: 0 0 8px rgba(249, 115, 22, 0.6);
        }

        .live-beacon.degraded .beacon-ring {
          border-color: var(--fire);
        }

        @keyframes beaconPulse {
          0% {
            transform: scale(0.6);
            opacity: 0.8;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }

        .brand-text-container {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .brand-name {
          font-family: var(--font-heading);
          font-weight: 700;
          font-size: 0.88rem;
          letter-spacing: 0.04em;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .brand-tag {
          font-size: 0.58rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 1px 4px;
          border-radius: 4px;
          background: rgba(34, 211, 238, 0.12);
          border: 1px solid rgba(34, 211, 238, 0.25);
          color: var(--cyan);
        }

        .brand-status {
          font-size: 0.65rem;
          color: var(--text-muted);
          letter-spacing: 0.02em;
          font-weight: 400;
        }

        .metrics-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .metric-capsule {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 4px 11px;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-pill);
          font-size: 0.70rem;
          transition: all 0.2s ease;
        }

        .metric-capsule:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--glass-border-highlight);
        }

        .metric-capsule.capsule-warning {
          border-color: rgba(249, 115, 22, 0.35);
          background: rgba(249, 115, 22, 0.07);
        }

        .metric-capsule.capsule-alert {
          border-color: rgba(244, 63, 94, 0.4);
          background: rgba(244, 63, 94, 0.08);
        }

        .metric-capsule.capsule-active {
          border-color: rgba(251, 191, 36, 0.35);
          background: rgba(251, 191, 36, 0.07);
        }

        .metric-label {
          font-family: var(--font-heading);
          color: var(--text-secondary);
          font-size: 0.64rem;
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .metric-value {
          font-family: var(--font-mono);
          font-weight: 600;
          font-size: 0.72rem;
          color: var(--text-primary);
        }

        .metric-denom {
          color: var(--text-muted);
          font-weight: 400;
          font-size: 0.66rem;
        }

        .icon-cyan { color: var(--cyan); }
        .icon-muted { color: var(--text-muted); }
        .icon-warning { color: var(--fire); }
        .icon-command { color: var(--command); }
        .icon-alert { color: var(--critical); }

        .val-alert { color: var(--critical); font-weight: 700; }
        .val-command { color: var(--command); font-weight: 700; }

        @media (max-width: 768px) {
          .glass-topbar {
            padding: 8px 14px;
            height: 48px;
          }
          .brand-status {
            display: none;
          }
          .metrics-group {
            gap: 5px;
          }
          .metric-label {
            display: none;
          }
          .metric-capsule {
            padding: 3px 8px;
          }
        }
      `}</style>
    </header>
  );
};
