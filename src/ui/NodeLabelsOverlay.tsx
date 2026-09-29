import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { NETWORK_NODES, getNodeSensorRole } from '../data/nodes';
import { projectToScreen } from '../scene/Projection';
import { ThreeScene } from '../scene/ThreeScene';

interface NodeLabelsOverlayProps {
  scene: ThreeScene | null;
  showLabels: boolean;
  selectedNodeId?: number | null;
  hoveredNodeId?: number | null;
}

// Module-level reusable vector to avoid per-frame allocations
const labelPosVec = new THREE.Vector3();

export const NodeLabelsOverlay: React.FC<NodeLabelsOverlayProps> = ({
  scene,
  showLabels,
  selectedNodeId = null,
  hoveredNodeId = null,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lastStateMap = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    if (!scene) return;

    // Register high-performance frame callback updating DOM transforms directly
    // Avoids 60 React re-renders per second & eliminates GC pressure
    const unregister = scene.addFrameCallback((camera: THREE.PerspectiveCamera, width: number, height: number) => {
      if (!showLabels) return;

      const activeRoutes = scene.simulationEngine.getActiveRoutes();

      for (const node of NETWORK_NODES) {
        const el = labelRefs.current.get(node.id);
        if (!el) continue;

        const isCore = node.id < 7;
        const isSelected = selectedNodeId === node.id;
        const isHovered = hoveredNodeId === node.id;
        const isActiveRouteNode = activeRoutes.some((path: number[]) => path.includes(node.id));

        // Core nodes always visible; Field mesh nodes visible on hover, selection, or active route per Section 34
        const shouldShow = isCore || isSelected || isHovered || isActiveRouteNode;

        const corePos = scene.networkNodes.getCoreWorldPosition(node.id);
        if (!corePos || !shouldShow) {
          el.style.display = 'none';
          continue;
        }

        // Reusable vector position slightly above the node's floating core
        labelPosVec.set(corePos.x, corePos.y + node.coreRadius + (isCore ? 0.6 : 0.45), corePos.z);

        const screenPos = projectToScreen(labelPosVec, camera, width, height);

        if (!screenPos.visible) {
          el.style.display = 'none';
        } else {
          el.style.display = 'block';
          // Use GPU-accelerated translate3d to avoid browser layout thrashing
          el.style.transform = `translate3d(${screenPos.x}px, ${screenPos.y}px, 0) translate(-50%, -100%)`;
        }

        // Update class name if status or selection state changed
        const currentStatus = scene.networkNodes.getNodeStatus(node.id) || node.status;
        const stateKey = `${currentStatus}-${isSelected}-${isHovered}-${isCore}`;

        if (lastStateMap.current.get(node.id) !== stateKey) {
          lastStateMap.current.set(node.id, stateKey);
          el.className = `node-label-item ${currentStatus} ${isCore ? 'core-node' : 'field-mesh'} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`;
        }
      }
    });

    return () => unregister();
  }, [scene, showLabels, selectedNodeId, hoveredNodeId]);

  if (!showLabels) return null;

  return (
    <div ref={containerRef} className="node-labels-container" aria-hidden="true">
      {NETWORK_NODES.map((node) => {
        const sensorRole = getNodeSensorRole(node.id);
        return (
          <div
            key={node.id}
            ref={(el) => {
              if (el) {
                labelRefs.current.set(node.id, el);
              } else {
                labelRefs.current.delete(node.id);
              }
            }}
            className={`node-label-item ${node.status}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              display: 'none',
            }}
          >
            {node.name}
            {sensorRole && <span style={{ opacity: 0.8, fontSize: '0.85em', marginLeft: 3 }}>[{sensorRole.designation}]</span>}
          </div>
        );
      })}

      <style>{`
        .node-labels-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 15;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};
