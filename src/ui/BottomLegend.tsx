import React from 'react';

interface LegendItem {
  label: string;
  dotClass: string;
}

const LEGEND_ITEMS: LegendItem[] = [
  { label: 'Command', dotClass: 'command' },
  { label: 'Safe', dotClass: 'cyan' },
  { label: 'Hazard', dotClass: 'critical' },
  { label: 'Resolved', dotClass: 'resolved' },
  { label: 'Offline', dotClass: 'offline' },
];

export const BottomLegend: React.FC = () => {
  return (
    <div className="interactive glass-bottom-legend" role="region" aria-label="3D Node Map Legend">
      <div className="legend-capsule">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="legend-item">
            <span className={`glass-status-dot ${item.dotClass}`} />
            <span className="legend-label">{item.label}</span>
          </div>
        ))}
      </div>

      <style>{`
        .glass-bottom-legend {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          pointer-events: auto;
        }

        .legend-capsule {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 6px 16px;
          background: var(--glass-hud-bg);
          background-image: var(--glass-highlight);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-pill);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(var(--glass-hud-blur));
          -webkit-backdrop-filter: blur(var(--glass-hud-blur));
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.68rem;
          color: var(--text-secondary);
          white-space: nowrap;
          transition: color 0.15s ease;
        }

        .legend-item:hover {
          color: var(--text-primary);
        }

        .legend-label {
          font-family: var(--font-heading);
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        @media (max-width: 768px) {
          .glass-bottom-legend {
            bottom: 8px;
          }
          .legend-capsule {
            gap: 10px;
            padding: 5px 12px;
          }
          .legend-label {
            font-size: 0.62rem;
          }
        }
      `}</style>
    </div>
  );
};
