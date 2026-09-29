import * as THREE from 'three';
import { NETWORK_NODES, isFieldMeshNode } from '../data/nodes';
import { HAZARD_ZONES } from '../data/hazards';
import { MESH_EDGES } from '../data/graph';
import { Terrain } from '../scene/Terrain';
import { InteractiveNodeTarget, InteractiveHazardTarget, InteractiveLandmarkTarget } from './types';

export class RaycastRegistry {
  public group: THREE.Group;
  private interactiveMeshes: THREE.Mesh[] = [];
  private disposables: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'raycast_interaction_proxies';

    this.buildNodeHitboxes();
    this.buildHazardHitboxes();
    this.buildLandmarkHitboxes();
  }

  public getInteractiveObjects(): THREE.Mesh[] {
    return this.interactiveMeshes;
  }

  private createInvisibleMaterial(): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    return mat;
  }

  /**
   * Generates comfortable touch/click hitboxes for all 24 network nodes.
   */
  private buildNodeHitboxes(): void {
    const nodeGeom = new THREE.CylinderGeometry(2.4, 2.4, 4.8, 12);
    const nodeMat = this.createInvisibleMaterial();
    this.disposables.push({ geometry: nodeGeom, material: nodeMat });

    NETWORK_NODES.forEach((node) => {
      const [nx, , nz] = node.position;
      const gy = Terrain.getElevationAt(nx, nz);

      const mesh = new THREE.Mesh(nodeGeom, nodeMat);
      mesh.position.set(nx, gy + 2.4, nz);

      // Compute connected node names
      const connectedNodeNames: string[] = [];
      MESH_EDGES.forEach((e) => {
        let neighborId: number | null = null;
        if (e.source === node.id) neighborId = e.target;
        else if (e.target === node.id) neighborId = e.source;

        if (neighborId !== null) {
          const neighbor = NETWORK_NODES.find((n) => n.id === neighborId);
          if (neighbor) connectedNodeNames.push(neighbor.name);
        }
      });

      const category = node.isCommandCenter
        ? 'COMMAND CENTER'
        : node.sensorRole
        ? 'ENVIRONMENT SENSOR + MESH RELAY'
        : isFieldMeshNode(node.id)
        ? 'FIELD MESH RELAY'
        : 'MULTI-HOP RELAY ROUTER';

      const targetData: InteractiveNodeTarget = {
        type: 'node',
        id: node.id,
        name: node.name,
        category,
        status: node.status,
        elevation: parseFloat(gy.toFixed(2)),
        linksCount: connectedNodeNames.length,
        connectedNodeNames,
        isCommandCenter: !!node.isCommandCenter,
        sensorRole: node.sensorRole,
      };

      mesh.userData = { interactiveTarget: targetData };
      this.group.add(mesh);
      this.interactiveMeshes.push(mesh);
    });
  }

  /**
   * Generates hitboxes for the 3 hazard territories.
   */
  private buildHazardHitboxes(): void {
    const hazardList = Object.values(HAZARD_ZONES);

    hazardList.forEach((hazard) => {
      const [cx, cz] = hazard.center;
      const cy = Terrain.getElevationAt(cx, cz);
      const geom = new THREE.CylinderGeometry(hazard.radius * 0.95, hazard.radius * 0.95, 2.0, 16);
      const mat = this.createInvisibleMaterial();
      this.disposables.push({ geometry: geom, material: mat });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(cx, cy + 1.0, cz);

      const targetNode = NETWORK_NODES.find((n) => n.id === hazard.targetNodeId);

      let description = '';
      if (hazard.id === 'flood') {
        description = 'Lowland river basin monitored by redundant flood sensor cluster (Flood-04, Flood-S1, Flood-S2).';
      } else if (hazard.id === 'fire') {
        description = 'Wooded highland sector monitored by redundant forest fire sensor cluster (Forest-07, Forest-S1, Forest-S2).';
      } else {
        description = 'Remote industrial outpost monitored by redundant industrial leak sensor cluster (Indus-02, Indus-S1, Indus-S2).';
      }

      const targetData: InteractiveHazardTarget = {
        type: 'hazard',
        id: hazard.id,
        name: hazard.name,
        zoneTitle: hazard.zoneTitle,
        targetNodeId: hazard.targetNodeId,
        targetNodeName: targetNode ? targetNode.name : `Node-${hazard.targetNodeId}`,
        sensorNodeIds: hazard.sensorNodeIds,
        sensorDesignations: hazard.sensorDesignations,
        color: hazard.color,
        description,
      };

      mesh.userData = { interactiveTarget: targetData };
      this.group.add(mesh);
      this.interactiveMeshes.push(mesh);
    });
  }

  /**
   * Generates hitboxes for key regional landmarks.
   */
  private buildLandmarkHitboxes(): void {
    const landmarks = [
      {
        id: 'landmark_flood_monitoring_station',
        name: 'Flood Monitoring Station',
        category: 'Wetland Telemetry Facility',
        coordinates: [-16.0, 21.0] as [number, number],
        radius: 2.8,
        height: 3.5,
        description:
          'Elevated timber telemetry array monitoring stream flow and basin saturation for Flood-04 approach.',
      },
      {
        id: 'landmark_forest_lookout_tower',
        name: 'Highland Watchtower',
        category: 'Forest Reconnaissance Post',
        coordinates: [28.5, -10.0] as [number, number],
        radius: 2.8,
        height: 6.0,
        description:
          'Elevated timber fire lookout cabin providing visual observation of eastern wooded ridge and highland trail.',
      },
      {
        id: 'landmark_industrial_substation',
        name: 'Industrial Power Substation',
        category: 'Regional Utility Facility',
        coordinates: [-19.0, -22.5] as [number, number],
        radius: 3.2,
        height: 3.0,
        description:
          'Step-down electrical transformer, conduit arch, and pressurized storage tanks powering outpost operations.',
      },
      {
        id: 'landmark_command_facility',
        name: 'Central Command Facility',
        category: 'Operational Headquarters',
        coordinates: [0.0, 0.0] as [number, number],
        radius: 3.6,
        height: 4.5,
        description:
          'Tactical field operations installation featuring dual photovoltaic arrays, tall antenna mast, and secure server vault.',
      },
    ];

    landmarks.forEach((lm) => {
      const [lx, lz] = lm.coordinates;
      const ly = Terrain.getElevationAt(lx, lz);
      const geom = new THREE.CylinderGeometry(lm.radius, lm.radius, lm.height, 12);
      const mat = this.createInvisibleMaterial();
      this.disposables.push({ geometry: geom, material: mat });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(lx, ly + lm.height / 2, lz);

      const targetData: InteractiveLandmarkTarget = {
        type: 'landmark',
        id: lm.id,
        name: lm.name,
        category: lm.category,
        description: lm.description,
        coordinates: lm.coordinates,
      };

      mesh.userData = { interactiveTarget: targetData };
      this.group.add(mesh);
      this.interactiveMeshes.push(mesh);
    });
  }

  public dispose(): void {
    for (const d of this.disposables) {
      d.geometry.dispose();
      d.material.dispose();
    }
    this.interactiveMeshes = [];
  }
}
