import { NodeStatus } from './tokens';

export interface SensorRoleData {
  zoneId: 'flood' | 'fire' | 'industrial';
  designation: string; // e.g. 'Flood-04', 'Flood-S1', 'Flood-S2'
  tier: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
  sensorRoleDescription: string;
}

export interface NodeData {
  id: number;
  name: string;
  type: 'command' | 'hazard:flood' | 'hazard:fire' | 'hazard:industrial' | 'relay' | 'mesh';
  position: [number, number, number]; // [x, y, z] base position on ground
  status: NodeStatus;
  beamHeight: number;
  coreRadius: number;
  coreElevation: number; // Height at which core and mesh-links sit (~55% of beam)
  isCommandCenter?: boolean;
  isFieldMesh?: boolean;
  sensorRole?: SensorRoleData;
}

// Unified network floating horizon altitude
// 55% of standard relay beam height (6.4 * 0.55 = 3.52)
export const NETWORK_PLANE_Y = 3.52;

// Configurable network scale per Section 1 (24 total nodes: 7 Core + 17 Field Mesh)
export const TOTAL_NODES = 24;
export const CORE_NODES_COUNT = 7;
export const FIELD_MESH_NODES_COUNT = TOTAL_NODES - CORE_NODES_COUNT; // 17

export const isCoreNode = (id: number): boolean => id >= 0 && id < CORE_NODES_COUNT;
export const isFieldMeshNode = (id: number): boolean => id >= CORE_NODES_COUNT && id < TOTAL_NODES;

// ----------------------------------------------------------------------------
// 1. Core Intelligent Nodes (IDs 0 to 6)
// Strictly preserved from previous phases for environmental intelligence,
// detailed inspectors, and hazard monitoring.
// ----------------------------------------------------------------------------
export const CORE_NODES: NodeData[] = [
  {
    id: 0,
    name: 'COMMAND CENTER',
    type: 'command',
    position: [0, 0, 0],
    status: 'command',
    beamHeight: 11.0,
    coreRadius: 1.15,
    coreElevation: NETWORK_PLANE_Y,
    isCommandCenter: true,
  },
  {
    id: 1,
    name: 'Flood-04',
    type: 'hazard:flood',
    position: [-22, 0, 14],
    status: 'safe',
    beamHeight: 6.4,
    coreRadius: 0.5,
    coreElevation: NETWORK_PLANE_Y,
    sensorRole: {
      zoneId: 'flood',
      designation: 'Flood-04',
      tier: 'PRIMARY',
      sensorRoleDescription: 'Central Flood Basin Ultrasonic Gauge',
    },
  },
  {
    id: 2,
    name: 'Forest-07',
    type: 'hazard:fire',
    position: [20, 0, -16],
    status: 'safe',
    beamHeight: 6.4,
    coreRadius: 0.5,
    coreElevation: NETWORK_PLANE_Y,
    sensorRole: {
      zoneId: 'fire',
      designation: 'Forest-07',
      tier: 'PRIMARY',
      sensorRoleDescription: 'Central Forest Canopy Thermal IR Mast',
    },
  },
  {
    id: 3,
    name: 'Indus-02',
    type: 'hazard:industrial',
    position: [-14, 0, -26],
    status: 'safe',
    beamHeight: 6.4,
    coreRadius: 0.5,
    coreElevation: NETWORK_PLANE_Y,
    sensorRole: {
      zoneId: 'industrial',
      designation: 'Indus-02',
      tier: 'PRIMARY',
      sensorRoleDescription: 'Main Chemical Outpost Vapor Sniffer',
    },
  },
  {
    id: 4,
    name: 'Relay-11',
    type: 'relay',
    position: [10, 0, 12],
    status: 'safe',
    beamHeight: 6.4,
    coreRadius: 0.5,
    coreElevation: NETWORK_PLANE_Y,
  },
  {
    id: 5,
    name: 'Relay-15',
    type: 'relay',
    position: [-8, 0, 22],
    status: 'safe',
    beamHeight: 6.4,
    coreRadius: 0.5,
    coreElevation: NETWORK_PLANE_Y,
  },
  {
    id: 6,
    name: 'Relay-19',
    type: 'relay',
    position: [24, 0, 4],
    status: 'safe',
    beamHeight: 6.4,
    coreRadius: 0.5,
    coreElevation: NETWORK_PLANE_Y,
  },
];

// ----------------------------------------------------------------------------
// 2. Field Mesh Nodes (IDs 7 to 23)
// Geographically distributed across valleys, roads, settlements, forest edges,
// flood corridors, industrial approaches, and elevated ridges per Section 3 & 4.
// Physically compact with low-poly masts, equipment boxes, and solar arrays.
// ----------------------------------------------------------------------------
export const FIELD_MESH_NODES: NodeData[] = [
  // Flood corridor / Western Lowlands
  {
    id: 7,
    name: 'Mesh-01',
    type: 'mesh',
    position: [-30, 0, 6],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
    sensorRole: {
      zoneId: 'flood',
      designation: 'Flood-S1',
      tier: 'SECONDARY',
      sensorRoleDescription: 'Downstream Fluvial Hydrometric Station',
    },
  },
  {
    id: 8,
    name: 'Mesh-02',
    type: 'mesh',
    position: [-18, 0, 30],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
  },
  {
    id: 9,
    name: 'Mesh-03',
    type: 'mesh',
    position: [-34, 0, 22],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
    sensorRole: {
      zoneId: 'flood',
      designation: 'Flood-S2',
      tier: 'TERTIARY',
      sensorRoleDescription: 'Lowland Runoff & Soil Saturation Sensor',
    },
  },
  {
    id: 10,
    name: 'Mesh-04',
    type: 'mesh',
    position: [-12, 0, 8],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
  },

  // Forest Highland & Eastern Ridge
  {
    id: 11,
    name: 'Mesh-05',
    type: 'mesh',
    position: [14, 0, -28],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
    sensorRole: {
      zoneId: 'fire',
      designation: 'Forest-S1',
      tier: 'SECONDARY',
      sensorRoleDescription: 'Highland Ridge Canopy Pyro-Thermal Station',
    },
  },
  {
    id: 12,
    name: 'Mesh-06',
    type: 'mesh',
    position: [30, 0, -8],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
  },
  {
    id: 13,
    name: 'Mesh-07',
    type: 'mesh',
    position: [26, 0, -26],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
    sensorRole: {
      zoneId: 'fire',
      designation: 'Forest-S2',
      tier: 'TERTIARY',
      sensorRoleDescription: 'Eastern Crest Timber Smolder & Humidity Probe',
    },
  },
  {
    id: 14,
    name: 'Mesh-08',
    type: 'mesh',
    position: [10, 0, -8],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
  },

  // Industrial Compound & Southern Roads
  {
    id: 15,
    name: 'Mesh-09',
    type: 'mesh',
    position: [-26, 0, -18],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
    sensorRole: {
      zoneId: 'industrial',
      designation: 'Indus-S1',
      tier: 'SECONDARY',
      sensorRoleDescription: 'Perimeter Gas & VOC Plume Sensor',
    },
  },
  {
    id: 16,
    name: 'Mesh-10',
    type: 'mesh',
    position: [-4, 0, -28],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
  },
  {
    id: 17,
    name: 'Mesh-11',
    type: 'mesh',
    position: [-22, 0, -34],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
    sensorRole: {
      zoneId: 'industrial',
      designation: 'Indus-S2',
      tier: 'TERTIARY',
      sensorRoleDescription: 'Storage Tank Farm Vapor & Pressure Sniffer',
    },
  },
  {
    id: 18,
    name: 'Mesh-12',
    type: 'mesh',
    position: [-7, 0, -14],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
  },

  // Regional Backbone, Crossroads & Perimeters
  {
    id: 19,
    name: 'Mesh-13',
    type: 'mesh',
    position: [2, 0, -18],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
  },
  {
    id: 20,
    name: 'Mesh-14',
    type: 'mesh',
    position: [18, 0, 20],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
  },
  {
    id: 21,
    name: 'Mesh-15',
    type: 'mesh',
    position: [32, 0, 16],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
  },
  {
    id: 22,
    name: 'Mesh-16',
    type: 'mesh',
    position: [-2, 0, 26],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
  },
  {
    id: 23,
    name: 'Mesh-17',
    type: 'mesh',
    position: [-18, 0, -6],
    status: 'safe',
    beamHeight: 4.2,
    coreRadius: 0.32,
    coreElevation: NETWORK_PLANE_Y,
    isFieldMesh: true,
  },
];

// Unified Array of all 24 nodes
export const NETWORK_NODES: NodeData[] = [...CORE_NODES, ...FIELD_MESH_NODES];

export const isSensorCapableNode = (id: number): boolean => {
  const node = NETWORK_NODES.find((n) => n.id === id);
  return !!node?.sensorRole;
};

export const getNodeSensorRole = (id: number): SensorRoleData | undefined => {
  return NETWORK_NODES.find((n) => n.id === id)?.sensorRole;
};

export const getHazardZoneSensorNodes = (zoneId: 'flood' | 'fire' | 'industrial'): NodeData[] => {
  return NETWORK_NODES.filter((n) => n.sensorRole?.zoneId === zoneId);
};

