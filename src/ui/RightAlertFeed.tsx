import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, ShieldAlert, CheckCircle2, Navigation, Radio } from 'lucide-react';
import { SimulationEventEmitter } from '../simulation/events';
import { SimulationEvent } from '../simulation/types';

export interface AlertLogItem {
  id: string;
  time: string;
  type: 'SYSTEM' | 'ALERT' | 'DISPATCH' | 'RESOLVED' | 'REROUTE';
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
  coverageState?: string;
}

interface RightAlertFeedProps {
  events?: SimulationEventEmitter;
}

export const RightAlertFeed: React.FC<RightAlertFeedProps> = ({ events }) => {
  const formatCurrentTime = () => {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  };

  const [logs, setLogs] = useState<AlertLogItem[]>([
    {
      id: 'init-1',
      time: formatCurrentTime(),
      type: 'SYSTEM',
      message: 'System online. Edge telemetry monitoring active…',
    },
  ]);

  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!events) return;

    const mapEventType = (type: SimulationEvent['type']): AlertLogItem['type'] => {
      switch (type) {
        case 'HAZARD_DETECTED':
        case 'NO_ROUTE_AVAILABLE':
          return 'ALERT';
        case 'ROUTE_RECONFIGURED':
          return 'REROUTE';
        case 'RESCUE_DISPATCHED':
          return 'DISPATCH';
        case 'HAZARD_RESOLVED':
          return 'RESOLVED';
        case 'NODE_FAILED':
        case 'NODE_RESTORED':
        case 'SIMULATION_RESET':
        default:
          return 'SYSTEM';
      }
    };

    const unsubscribe = events.on('*', (event: SimulationEvent) => {
      if (event.type === 'SIMULATION_RESET') {
        setLogs([
          {
            id: `reset-${Date.now()}`,
            time: event.timestamp,
            type: 'SYSTEM',
            message: 'System reset. Pristine operational baseline active.',
          },
        ]);
        return;
      }

      if (event.type === 'BROADCAST_STARTED' || event.type === 'RESCUE_ARRIVED') {
        return;
      }

      setLogs((prev) => {
        const newItem: AlertLogItem = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          time: event.timestamp,
          type: mapEventType(event.type),
          message: event.message,
          riskScore: event.riskScore,
          riskLevel: event.riskLevel,
          priority: event.priority,
          classification: event.classification,
          recommendedAction: event.recommendedAction,
          isRerouted: event.isRerouted,
          sources: event.sources,
          primarySource: event.primarySource,
          confirmingSources: event.confirmingSources,
          coverageStatus: event.coverageStatus,
          coverageState: event.coverageState,
        };
        // Keep up to 10 latest entries
        return [...prev.slice(-9), newItem];
      });
    });

    return () => unsubscribe();
  }, [events]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getStatusColor = (type: AlertLogItem['type'], riskLevel?: string) => {
    if (riskLevel === 'CRITICAL' || type === 'ALERT') return 'var(--critical)';
    if (type === 'DISPATCH' || riskLevel === 'HIGH') return 'var(--command)';
    if (type === 'REROUTE') return 'var(--fire)';
    if (type === 'RESOLVED') return 'var(--resolved)';
    return 'var(--cyan)';
  };

  const getStatusIcon = (type: AlertLogItem['type']) => {
    switch (type) {
      case 'ALERT':
        return <ShieldAlert size={12} />;
      case 'DISPATCH':
        return <Navigation size={12} />;
      case 'RESOLVED':
        return <CheckCircle2 size={12} />;
      case 'REROUTE':
        return <Radio size={12} />;
      case 'SYSTEM':
      default:
        return <Terminal size={12} />;
    }
  };

  return (
    <aside className="interactive glass-panel right-incident-stream" aria-label="Live Incident Stream">
      {/* Stream Header */}
      <div className="stream-header">
        <div className="stream-header-left">
          <span className="stream-kicker">FineLynk Live</span>
          <h2 className="stream-title">Incident Stream</h2>
        </div>
        <div className="rec-indicator" title="Live operational recording active">
          <span className="rec-dot" />
          <span className="rec-text">REC</span>
        </div>
      </div>

      <div className="glass-divider" />

      {/* Vertical Timeline Stream */}
      <div className="timeline-container" role="log" aria-live="polite">
        <div className="timeline-track" />
        <AnimatePresence initial={false}>
          {logs.map((log) => {
            const color = getStatusColor(log.type, log.riskLevel);
            const isCritical = log.type === 'ALERT' || log.riskLevel === 'CRITICAL';

            return (
              <motion.div
                key={log.id}
                className={`timeline-entry ${isCritical ? 'is-critical' : ''}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              >
                {/* Node on vertical timeline */}
                <div
                  className="timeline-node"
                  style={{
                    color,
                    borderColor: color,
                    boxShadow: `0 0 8px ${color}40`,
                  }}
                >
                  {getStatusIcon(log.type)}
                </div>

                {/* Entry Content */}
                <div className="entry-content">
                  <div className="entry-header-row">
                    <span className="entry-time">{log.time}</span>
                    <span
                      className="entry-badge"
                      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
                    >
                      {log.type}
                    </span>
                    {log.riskLevel && (
                      <span className={`entry-risk-pill risk-${log.riskLevel.toLowerCase()}`}>
                        {log.riskLevel}
                      </span>
                    )}
                  </div>

                  <p className="entry-msg">{log.message}</p>

                  {/* Refined Contextual Details without nested boxes */}
                  {(log.riskScore !== undefined || log.classification || log.isRerouted || log.sources || log.recommendedAction) && (
                    <div className="entry-details">
                      {log.sources && log.sources.length > 0 && (
                        <div className="detail-row">
                          <span className="detail-key">Sources</span>
                          <span className="detail-val sources">{log.sources.join(', ')}</span>
                        </div>
                      )}

                      {log.riskScore !== undefined && (
                        <div className="detail-row">
                          <span className="detail-key">Risk Score</span>
                          <span className="detail-val score" style={{ color }}>
                            {log.riskScore} / 100 {log.priority ? `(${log.priority})` : ''}
                          </span>
                        </div>
                      )}

                      {log.isRerouted && (
                        <div className="reroute-badge">
                          ⚡ Rerouted via Resilient Mesh
                        </div>
                      )}

                      {log.recommendedAction && (
                        <div className="action-row">
                          <span className="action-tag">ACTION</span>
                          <span className="action-text">{log.recommendedAction}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={listEndRef} />
      </div>

      <style>{`
        .right-incident-stream {
          width: 310px;
          margin-top: 14px;
          margin-right: 18px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          max-height: 520px;
        }

        .stream-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .stream-header-left {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .stream-kicker {
          font-family: var(--font-heading);
          font-size: 0.60rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--cyan);
        }

        .stream-title {
          font-family: var(--font-heading);
          font-size: 0.90rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: 0.02em;
          margin: 0;
        }

        .rec-indicator {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 7px;
          border-radius: var(--radius-pill);
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.25);
        }

        .rec-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--critical);
          animation: blinkRec 1.6s ease-in-out infinite;
        }

        @keyframes blinkRec {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.85); }
        }

        .rec-text {
          font-family: var(--font-mono);
          font-size: 0.60rem;
          font-weight: 700;
          color: var(--critical);
          letter-spacing: 0.05em;
        }

        .timeline-container {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
          padding-left: 20px;
          padding-right: 4px;
          flex: 1;
        }

        .timeline-track {
          position: absolute;
          top: 8px;
          bottom: 12px;
          left: 9px;
          width: 1px;
          background: rgba(255, 255, 255, 0.08);
        }

        .timeline-entry {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .timeline-node {
          position: absolute;
          left: -20px;
          top: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: rgba(8, 18, 34, 0.9);
          border: 1px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }

        .entry-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .entry-header-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .entry-time {
          font-family: var(--font-mono);
          font-size: 0.62rem;
          color: var(--text-muted);
        }

        .entry-badge {
          font-family: var(--font-mono);
          font-size: 0.54rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          padding: 1px 4px;
          border-radius: 3px;
          border: 1px solid;
        }

        .entry-risk-pill {
          margin-left: auto;
          font-family: var(--font-mono);
          font-size: 0.54rem;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 3px;
        }

        .entry-risk-pill.risk-critical {
          color: var(--critical);
          background: rgba(244, 63, 94, 0.15);
        }

        .entry-risk-pill.risk-high {
          color: var(--fire);
          background: rgba(249, 115, 22, 0.15);
        }

        .entry-risk-pill.risk-moderate {
          color: var(--command);
          background: rgba(251, 191, 36, 0.15);
        }

        .entry-risk-pill.risk-low {
          color: var(--cyan);
          background: rgba(34, 211, 238, 0.12);
        }

        .entry-msg {
          font-family: var(--font-heading);
          font-size: 0.70rem;
          color: var(--text-primary);
          line-height: 1.35;
          margin: 0;
        }

        .timeline-entry.is-critical .entry-msg {
          color: #ffffff;
          font-weight: 600;
        }

        .entry-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-left: 6px;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: 2px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.62rem;
        }

        .detail-key {
          color: var(--text-muted);
          font-size: 0.58rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .detail-val {
          font-family: var(--font-mono);
          color: var(--text-secondary);
        }

        .detail-val.sources {
          color: var(--cyan);
        }

        .detail-val.score {
          font-weight: 600;
        }

        .reroute-badge {
          display: inline-flex;
          font-family: var(--font-mono);
          font-size: 0.58rem;
          color: var(--fire);
          padding: 1px 4px;
          background: rgba(249, 115, 22, 0.08);
          border-radius: 3px;
          margin-top: 2px;
          align-self: flex-start;
        }

        .action-row {
          display: flex;
          align-items: baseline;
          gap: 5px;
          margin-top: 2px;
        }

        .action-tag {
          font-family: var(--font-mono);
          font-size: 0.52rem;
          font-weight: 700;
          color: var(--command);
          flex-shrink: 0;
        }

        .action-text {
          font-size: 0.64rem;
          color: var(--text-secondary);
          line-height: 1.25;
        }

        @media (max-width: 860px) {
          .right-incident-stream {
            display: none;
          }
        }
      `}</style>
    </aside>
  );
};
