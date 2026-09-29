import { TOKENS } from './tokens';

export type ZoneCoverageState = 'FULL' | 'REDUNDANT' | 'DEGRADED' | 'LOST';
export type ZoneDetectionState = 'AVAILABLE' | 'UNAVAILABLE';

export interface HazardZoneData {
  id: 'flood' | 'fire' | 'industrial';
  name: string;
  zoneTitle: string;
  targetNodeId: number;
  sensorNodeIds: number[];
  sensorDesignations: Record<number, string>;
  center: [number, number]; // [x, z]
  radius: number;
  coverageRadius: number;
  color: string;
  opacity: number;
}

export const HAZARD_ZONES: Record<'flood' | 'fire' | 'industrial', HazardZoneData> = {
  flood: {
    id: 'flood',
    name: 'Flood — Lowland River Corridor',
    zoneTitle: 'FLOOD ZONE',
    targetNodeId: 1,
    sensorNodeIds: [1, 7, 9],
    sensorDesignations: {
      1: 'Flood-04',
      7: 'Flood-S1',
      9: 'Flood-S2',
    },
    center: [-22, 14],
    radius: 14.8,
    coverageRadius: 14.8,
    color: TOKENS.colors.flood,
    opacity: 0.14,
  },
  fire: {
    id: 'fire',
    name: 'Forest Fire — Woodland Ridge',
    zoneTitle: 'FOREST FIRE ZONE',
    targetNodeId: 2,
    sensorNodeIds: [2, 11, 13],
    sensorDesignations: {
      2: 'Forest-07',
      11: 'Forest-S1',
      13: 'Forest-S2',
    },
    center: [20, -16],
    radius: 14.8,
    coverageRadius: 14.8,
    color: TOKENS.colors.fire,
    opacity: 0.12,
  },
  industrial: {
    id: 'industrial',
    name: 'Industrial Leak — Chemical Outpost',
    zoneTitle: 'INDUSTRIAL ZONE',
    targetNodeId: 3,
    sensorNodeIds: [3, 15, 17],
    sensorDesignations: {
      3: 'Indus-02',
      15: 'Indus-S1',
      17: 'Indus-S2',
    },
    center: [-14, -26],
    radius: 14.8,
    coverageRadius: 14.8,
    color: TOKENS.colors.industrial,
    opacity: 0.12,
  },
};

// Natural forest vegetation palette (3–4 tones)
export const FOREST_FOLIAGE_TONES = [
  '#1e5e2e', // Deep forest green
  '#2e8b40', // Medium rich green
  '#4fae52', // Bright vibrant green
  '#7ac95a', // Yellow-green transition
];

export const FOREST_TRUNK_TONES = [
  '#5c3a21', // Dark bark brown
  '#6e472a', // Warm wood brown
];

export const FOREST_ROCK_TONES = [
  '#8c674b', // Weathered stone
  '#a87858', // Warm terracotta rock
  '#c98a5e', // Sandy high rock
];

// Warm settlement industrial outpost palette
export const INDUSTRIAL_WALL_TONES = [
  '#d4b896', // Warm concrete tan
  '#c4a47c', // Weathered sand tan
  '#7a4f32', // Warm structural timber/brown
  '#b87355', // Muted copper
];

export const INDUSTRIAL_ROOF_TONES = [
  '#bf573f', // Terracotta roof
  '#c85a28', // Rust orange metal roof
  '#a34324', // Deep brick red
  '#8a5d3e', // Warm oxidized iron
];

// Deterministic Pseudo-Random Number Generator (LCG)
class DeterministicPRNG {
  private state: number;
  constructor(seed: number) {
    this.state = seed % 2147483647;
    if (this.state <= 0) this.state += 2147483646;
  }
  next(): number {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }
}

export interface TreeData {
  x: number;
  z: number;
  height: number;
  radius: number;
  rotation: number;
  foliageTone: string;
  trunkTone: string;
  layers: number;
}

// Generate 24 deterministic trees with natural variation for Fire zone
export function getDeterministicFireTrees(): Array<TreeData> {
  const prng = new DeterministicPRNG(4242);
  const trees: Array<TreeData> = [];
  const [cx, cz] = HAZARD_ZONES.fire.center;
  const maxR = HAZARD_ZONES.fire.radius * 0.84;

  for (let i = 0; i < 24; i++) {
    const angle = prng.next() * Math.PI * 2;
    const r = Math.sqrt(prng.next()) * maxR;
    const x = cx + Math.cos(angle) * r;
    const z = cz + Math.sin(angle) * r;
    const height = 1.5 + prng.next() * 1.5;
    const radius = 0.55 + prng.next() * 0.45;
    const rotation = prng.next() * Math.PI * 2;
    const foliageTone = FOREST_FOLIAGE_TONES[i % FOREST_FOLIAGE_TONES.length];
    const trunkTone = FOREST_TRUNK_TONES[i % FOREST_TRUNK_TONES.length];
    const layers = prng.next() > 0.4 ? 2 : 1;

    trees.push({ x, z, height, radius, rotation, foliageTone, trunkTone, layers });
  }
  return trees;
}

export interface BushData {
  x: number;
  z: number;
  radius: number;
  scaleY: number;
  rotation: number;
  foliageTone: string;
}

// Generate 12 deterministic low-poly bushes
export function getDeterministicForestBushes(): Array<BushData> {
  const prng = new DeterministicPRNG(5566);
  const bushes: Array<BushData> = [];
  const [cx, cz] = HAZARD_ZONES.fire.center;
  const maxR = HAZARD_ZONES.fire.radius * 0.88;

  for (let i = 0; i < 12; i++) {
    const angle = prng.next() * Math.PI * 2;
    const r = (0.2 + prng.next() * 0.8) * maxR;
    const x = cx + Math.cos(angle) * r;
    const z = cz + Math.sin(angle) * r;
    const radius = 0.35 + prng.next() * 0.3;
    const scaleY = 0.6 + prng.next() * 0.3;
    const rotation = prng.next() * Math.PI;
    const foliageTone = FOREST_FOLIAGE_TONES[(i + 1) % FOREST_FOLIAGE_TONES.length];

    bushes.push({ x, z, radius, scaleY, rotation, foliageTone });
  }
  return bushes;
}

export interface RockData {
  x: number;
  z: number;
  radius: number;
  scaleY: number;
  rotationX: number;
  rotationY: number;
  rockTone: string;
}

// Generate 7 deterministic low-poly rocks
export function getDeterministicForestRocks(): Array<RockData> {
  const prng = new DeterministicPRNG(7788);
  const rocks: Array<RockData> = [];
  const [cx, cz] = HAZARD_ZONES.fire.center;
  const maxR = HAZARD_ZONES.fire.radius * 0.85;

  for (let i = 0; i < 7; i++) {
    const angle = prng.next() * Math.PI * 2;
    const r = (0.3 + prng.next() * 0.7) * maxR;
    const x = cx + Math.cos(angle) * r;
    const z = cz + Math.sin(angle) * r;
    const radius = 0.28 + prng.next() * 0.35;
    const scaleY = 0.5 + prng.next() * 0.4;
    const rotationX = prng.next() * Math.PI;
    const rotationY = prng.next() * Math.PI;
    const rockTone = FOREST_ROCK_TONES[i % FOREST_ROCK_TONES.length];

    rocks.push({ x, z, radius, scaleY, rotationX, rotationY, rockTone });
  }
  return rocks;
}

export interface BuildingData {
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotation: number;
  type: 'flat' | 'pitched' | 'silo';
  wallTone: string;
  roofTone: string;
}

// Generate 11 deterministic buildings for Industrial settlement outpost
export function getDeterministicIndustrialBuildings(): Array<BuildingData> {
  const prng = new DeterministicPRNG(9090);
  const buildings: Array<BuildingData> = [];
  const [cx, cz] = HAZARD_ZONES.industrial.center;
  const maxR = HAZARD_ZONES.industrial.radius * 0.82;

  const buildingTypes: Array<'flat' | 'pitched' | 'silo'> = [
    'pitched', 'flat', 'silo', 'pitched', 'flat', 'pitched', 'silo', 'flat', 'pitched', 'flat', 'silo'
  ];

  for (let i = 0; i < 11; i++) {
    const angle = prng.next() * Math.PI * 2;
    const r = (0.15 + prng.next() * 0.85) * maxR;
    const x = cx + Math.cos(angle) * r;
    const z = cz + Math.sin(angle) * r;
    const width = 1.3 + prng.next() * 1.5;
    const height = 1.8 + prng.next() * 2.5;
    const depth = 1.3 + prng.next() * 1.5;
    const rotation = prng.next() * Math.PI * 0.5;
    const type = buildingTypes[i % buildingTypes.length];
    const wallTone = INDUSTRIAL_WALL_TONES[i % INDUSTRIAL_WALL_TONES.length];
    const roofTone = INDUSTRIAL_ROOF_TONES[i % INDUSTRIAL_ROOF_TONES.length];

    buildings.push({ x, z, width, height, depth, rotation, type, wallTone, roofTone });
  }
  return buildings;
}
