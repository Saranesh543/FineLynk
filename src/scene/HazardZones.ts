import * as THREE from 'three';
import {
  HAZARD_ZONES,
  ZoneCoverageState,
  getDeterministicFireTrees,
  getDeterministicForestBushes,
  getDeterministicForestRocks,
  getDeterministicIndustrialBuildings,
} from '../data/hazards';
import { NETWORK_NODES } from '../data/nodes';
import { HazardType } from '../simulation/types';
import { Terrain } from './Terrain';

interface ColorTransitionItem {
  material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | THREE.LineBasicMaterial;
  dormantColor: THREE.Color;
  activeColor: THREE.Color;
  dormantOpacity?: number;
  activeOpacity?: number;
}

export interface TerritoryVisualState {
  type: HazardType;
  isActive: boolean;
  riskScore: number;
  progress: number; // 0 = DORMANT, 1 = ACTIVE
  transitionItems: ColorTransitionItem[];
  borderMesh?: THREE.Mesh;
  borderRibbon?: THREE.Mesh;
  borderLine?: THREE.LineLoop;
  discMesh?: THREE.Mesh;
}

export class HazardZones {
  public group: THREE.Group;
  private disposables: { geometry?: THREE.BufferGeometry; material?: THREE.Material }[] = [];
  private riverMesh: THREE.Mesh | null = null;
  private riverMaterial: THREE.MeshBasicMaterial | null = null;
  private riverBaseY: number = 0;

  // Territory Dormant ↔ Active states
  private territories: Map<HazardType, TerritoryVisualState> = new Map();

  // Territory Coverage States (Section 22)
  private territoryCoverage: Map<HazardType, ZoneCoverageState> = new Map([
    ['flood', 'FULL'],
    ['fire', 'FULL'],
    ['industrial', 'FULL'],
  ]);

  // Subtle Sensor Coverage Footprints (Section 26)
  private sensorFootprints: Map<number, THREE.Mesh> = new Map();
  private footprintGroup: THREE.Group = new THREE.Group();

  constructor() {
    this.group = new THREE.Group();
    this.group.add(this.footprintGroup);

    this.territories.set('flood', { type: 'flood', isActive: false, riskScore: 0, progress: 0, transitionItems: [] });
    this.territories.set('fire', { type: 'fire', isActive: false, riskScore: 0, progress: 0, transitionItems: [] });
    this.territories.set('industrial', { type: 'industrial', isActive: false, riskScore: 0, progress: 0, transitionItems: [] });

    this.createFloodZone();
    this.createFireZone();
    this.createIndustrialZone();
    this.buildSensorFootprints();

    // Initialize all materials to their dormant baseline
    this.applyTerritoryVisuals('flood', 0);
    this.applyTerritoryVisuals('fire', 0);
    this.applyTerritoryVisuals('industrial', 0);
  }

  // Create a muted desaturated version of any vibrant color for DORMANT state (~35% desaturated)
  private makeDormantColor(hex: string): THREE.Color {
    const c = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    // Reduce saturation by ~35% and slightly adjust lightness for a calm strategy map feel
    hsl.s = Math.max(0.12, hsl.s * 0.62);
    hsl.l = THREE.MathUtils.clamp(hsl.l * 0.95, 0.25, 0.75);
    return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
  }

  // Create terrain-conforming circular zone disc
  private createZoneDisc(
    type: HazardType,
    cx: number,
    cz: number,
    radius: number,
    colorHex: string,
    dormantOpacity: number,
    activeOpacity: number
  ): THREE.Mesh {
    const segments = 48;
    const ringSegments = 12;
    const geom = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];

    // Center vertex
    const centerElev = Terrain.getElevationAt(cx, cz) + 0.05;
    vertices.push(cx, centerElev, cz);

    // Rings from center to edge
    for (let r = 1; r <= ringSegments; r++) {
      const currentR = (r / ringSegments) * radius;
      for (let s = 0; s < segments; s++) {
        const angle = (s / segments) * Math.PI * 2;
        const px = cx + Math.cos(angle) * currentR;
        const pz = cz + Math.sin(angle) * currentR;
        const py = Terrain.getElevationAt(px, pz) + 0.05;
        vertices.push(px, py, pz);
      }
    }

    // Indices for center fan
    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments;
      indices.push(0, 1 + s, 1 + nextS);
    }

    // Indices for concentric rings
    for (let r = 1; r < ringSegments; r++) {
      const currentRingStart = 1 + (r - 1) * segments;
      const nextRingStart = 1 + r * segments;
      for (let s = 0; s < segments; s++) {
        const nextS = (s + 1) % segments;
        const c1 = currentRingStart + s;
        const c2 = currentRingStart + nextS;
        const n1 = nextRingStart + s;
        const n2 = nextRingStart + nextS;

        indices.push(c1, n1, c2);
        indices.push(c2, n1, n2);
      }
    }

    geom.setIndex(indices);
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.computeVertexNormals();

    const dormantColor = this.makeDormantColor(colorHex);
    const activeColor = new THREE.Color(colorHex);

    const mat = new THREE.MeshBasicMaterial({
      color: dormantColor.clone(),
      transparent: true,
      opacity: dormantOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geom, mat);
    this.disposables.push({ geometry: geom, material: mat });

    // Register with territory transition system
    this.territories.get(type)?.transitionItems.push({
      material: mat,
      dormantColor,
      activeColor,
      dormantOpacity,
      activeOpacity,
    });

    return mesh;
  }

  // Create wide, readable terrain-conforming perimeter ribbon ring
  private createBorderRibbonRing(
    type: HazardType,
    cx: number,
    cz: number,
    radius: number,
    colorHex: string
  ): THREE.Group {
    const group = new THREE.Group();
    const segments = 72;
    const halfWidth = 0.32; // Width of the ribbon band

    const ribbonGeom = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];

    // Outer & inner vertices following terrain elevation
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const rInner = radius - halfWidth;
      const rOuter = radius + halfWidth;

      const pxIn = cx + cosA * rInner;
      const pzIn = cz + sinA * rInner;
      const pyIn = Terrain.getElevationAt(pxIn, pzIn) + 0.08;

      const pxOut = cx + cosA * rOuter;
      const pzOut = cz + sinA * rOuter;
      const pyOut = Terrain.getElevationAt(pxOut, pzOut) + 0.08;

      positions.push(pxIn, pyIn, pzIn);
      positions.push(pxOut, pyOut, pzOut);

      if (i < segments) {
        const v1 = i * 2;
        const v2 = i * 2 + 1;
        const v3 = (i + 1) * 2;
        const v4 = (i + 1) * 2 + 1;

        indices.push(v1, v2, v3);
        indices.push(v2, v4, v3);
      }
    }

    ribbonGeom.setIndex(indices);
    ribbonGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    ribbonGeom.computeVertexNormals();

    const dormantColor = this.makeDormantColor(colorHex);
    const activeColor = new THREE.Color(colorHex);

    const ribbonMat = new THREE.MeshBasicMaterial({
      color: dormantColor.clone(),
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const ribbonMesh = new THREE.Mesh(ribbonGeom, ribbonMat);
    group.add(ribbonMesh);

    // Add a crisp outer line loop for maximum perimeter sharpness
    const linePoints: THREE.Vector3[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const px = cx + Math.cos(angle) * (radius + halfWidth);
      const pz = cz + Math.sin(angle) * (radius + halfWidth);
      const py = Terrain.getElevationAt(px, pz) + 0.09;
      linePoints.push(new THREE.Vector3(px, py, pz));
    }
    const lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMat = new THREE.LineBasicMaterial({
      color: dormantColor.clone(),
      transparent: true,
      opacity: 0.85,
    });
    const lineLoop = new THREE.LineLoop(lineGeom, lineMat);
    group.add(lineLoop);

    this.disposables.push(
      { geometry: ribbonGeom, material: ribbonMat },
      { geometry: lineGeom, material: lineMat }
    );

    const state = this.territories.get(type);
    if (state) {
      state.borderRibbon = ribbonMesh;
      state.borderLine = lineLoop;
      state.transitionItems.push(
        {
          material: ribbonMat,
          dormantColor,
          activeColor,
          dormantOpacity: 0.65,
          activeOpacity: 0.95,
        },
        {
          material: lineMat,
          dormantColor,
          activeColor,
          dormantOpacity: 0.85,
          activeOpacity: 1.0,
        }
      );
    }

    return group;
  }

  // 1. Flood Zone (Vivid turquoise/cyan water + readable boundary ring)
  private createFloodZone(): void {
    const spec = HAZARD_ZONES.flood;
    const [cx, cz] = spec.center;
    const waterCyanHex = '#2dd4c8';

    // Disc & Ribbon Ring
    this.group.add(this.createZoneDisc('flood', cx, cz, spec.radius, waterCyanHex, 0.12, 0.22));
    this.group.add(this.createBorderRibbonRing('flood', cx, cz, spec.radius, waterCyanHex));

    // River Strip: 9 x 46 units diagonal
    const riverWidth = 9;
    const riverLength = 46;
    const riverSegmentsW = 10;
    const riverSegmentsL = 36;
    const riverGeom = new THREE.PlaneGeometry(riverWidth, riverLength, riverSegmentsW, riverSegmentsL);
    riverGeom.rotateX(-Math.PI / 2);
    const diagonalAngle = 0.65;
    riverGeom.rotateY(diagonalAngle);

    // Conform river vertices to terrain
    const pos = riverGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const rx = pos.getX(i) + cx;
      const rz = pos.getZ(i) + cz;
      const ry = Terrain.getElevationAt(rx, rz) + 0.07;
      pos.setY(i, ry);
      pos.setX(i, rx);
      pos.setZ(i, rz);
    }
    pos.needsUpdate = true;
    riverGeom.computeVertexNormals();

    const dormantWaterColor = this.makeDormantColor(waterCyanHex);
    const activeWaterColor = new THREE.Color(waterCyanHex);

    const riverMat = new THREE.MeshBasicMaterial({
      color: dormantWaterColor.clone(),
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.riverMaterial = riverMat;
    this.riverMesh = new THREE.Mesh(riverGeom, riverMat);
    this.riverBaseY = this.riverMesh.position.y;
    this.disposables.push({ geometry: riverGeom, material: riverMat });
    this.group.add(this.riverMesh);

    this.territories.get('flood')?.transitionItems.push({
      material: riverMat,
      dormantColor: dormantWaterColor,
      activeColor: activeWaterColor,
      dormantOpacity: 0.55,
      activeOpacity: 0.88,
    });
  }

  /**
   * Animate the river strip during flood hazard.
   * Preserves exact functional contract for simulation engine and tests.
   */
  public setRiverFloodProgress(progress: number): void {
    if (!this.riverMesh || !this.riverMaterial) return;
    this.riverMesh.position.y = this.riverBaseY + progress * 0.35;
    const baseOpacity = this.territories.get('flood')?.isActive ? 0.72 : 0.55;
    this.riverMaterial.opacity = baseOpacity + progress * 0.26;
  }

  // 2. Living Forest Territory
  private createFireZone(): void {
    const spec = HAZARD_ZONES.fire;
    const [cx, cz] = spec.center;
    const fireOrangeHex = spec.color;

    // Disc & Readable Ribbon Ring
    this.group.add(this.createZoneDisc('fire', cx, cz, spec.radius, fireOrangeHex, 0.10, 0.20));
    this.group.add(this.createBorderRibbonRing('fire', cx, cz, spec.radius, fireOrangeHex));

    // A. 24 Deterministic Varied Trees (Trunk + Foliage with flatShading: true)
    const trees = getDeterministicFireTrees();
    trees.forEach((tree) => {
      const treeGroup = new THREE.Group();
      const groundY = Terrain.getElevationAt(tree.x, tree.z);
      treeGroup.position.set(tree.x, groundY, tree.z);
      treeGroup.rotation.y = tree.rotation;

      // Tree Trunk
      const trunkH = tree.height * 0.38;
      const trunkR = tree.radius * 0.22;
      const trunkGeom = new THREE.CylinderGeometry(trunkR * 0.8, trunkR, trunkH, 5);
      const trunkDormant = this.makeDormantColor(tree.trunkTone);
      const trunkActive = new THREE.Color(tree.trunkTone);

      const trunkMat = new THREE.MeshStandardMaterial({
        color: trunkDormant.clone(),
        flatShading: true,
        roughness: 0.9,
      });
      const trunkMesh = new THREE.Mesh(trunkGeom, trunkMat);
      trunkMesh.position.y = trunkH / 2;
      treeGroup.add(trunkMesh);

      // Foliage Canopy: 1 or 2 stacked low-poly cones
      const foliageDormant = this.makeDormantColor(tree.foliageTone);
      const foliageActive = new THREE.Color(tree.foliageTone);

      const foliageMat = new THREE.MeshStandardMaterial({
        color: foliageDormant.clone(),
        flatShading: true,
        roughness: 0.75,
      });

      if (tree.layers === 2) {
        const bottomH = tree.height * 0.45;
        const topH = tree.height * 0.42;
        const coneGeom1 = new THREE.ConeGeometry(tree.radius, bottomH, 6);
        const coneMesh1 = new THREE.Mesh(coneGeom1, foliageMat);
        coneMesh1.position.y = trunkH + bottomH * 0.4;
        treeGroup.add(coneMesh1);

        const coneGeom2 = new THREE.ConeGeometry(tree.radius * 0.72, topH, 6);
        const coneMesh2 = new THREE.Mesh(coneGeom2, foliageMat);
        coneMesh2.position.y = trunkH + bottomH * 0.7 + topH * 0.4;
        treeGroup.add(coneMesh2);

        this.disposables.push({ geometry: coneGeom1 }, { geometry: coneGeom2 });
      } else {
        const canopyH = tree.height * 0.75;
        const coneGeom = new THREE.ConeGeometry(tree.radius, canopyH, 6);
        const coneMesh = new THREE.Mesh(coneGeom, foliageMat);
        coneMesh.position.y = trunkH + canopyH * 0.45;
        treeGroup.add(coneMesh);

        this.disposables.push({ geometry: coneGeom });
      }

      this.disposables.push(
        { geometry: trunkGeom, material: trunkMat },
        { material: foliageMat }
      );

      this.territories.get('fire')?.transitionItems.push(
        { material: trunkMat, dormantColor: trunkDormant, activeColor: trunkActive },
        { material: foliageMat, dormantColor: foliageDormant, activeColor: foliageActive }
      );

      this.group.add(treeGroup);
    });

    // B. 12 Low-Poly Bushes (Flattened icosahedrons with flatShading: true)
    const bushes = getDeterministicForestBushes();
    bushes.forEach((bush) => {
      const groundY = Terrain.getElevationAt(bush.x, bush.z);
      const bushGeom = new THREE.IcosahedronGeometry(bush.radius, 0);
      const bushDormant = this.makeDormantColor(bush.foliageTone);
      const bushActive = new THREE.Color(bush.foliageTone);

      const bushMat = new THREE.MeshStandardMaterial({
        color: bushDormant.clone(),
        flatShading: true,
        roughness: 0.8,
      });
      const bushMesh = new THREE.Mesh(bushGeom, bushMat);
      bushMesh.position.set(bush.x, groundY + bush.radius * bush.scaleY * 0.7, bush.z);
      bushMesh.scale.set(1.0, bush.scaleY, 1.0);
      bushMesh.rotation.y = bush.rotation;

      this.disposables.push({ geometry: bushGeom, material: bushMat });
      this.territories.get('fire')?.transitionItems.push({
        material: bushMat,
        dormantColor: bushDormant,
        activeColor: bushActive,
      });

      this.group.add(bushMesh);
    });

    // C. 7 Low-Poly Rocks (Faceted dodecahedrons with flatShading: true)
    const rocks = getDeterministicForestRocks();
    rocks.forEach((rock) => {
      const groundY = Terrain.getElevationAt(rock.x, rock.z);
      const rockGeom = new THREE.DodecahedronGeometry(rock.radius, 0);
      const rockDormant = this.makeDormantColor(rock.rockTone);
      const rockActive = new THREE.Color(rock.rockTone);

      const rockMat = new THREE.MeshStandardMaterial({
        color: rockDormant.clone(),
        flatShading: true,
        roughness: 0.9,
      });
      const rockMesh = new THREE.Mesh(rockGeom, rockMat);
      rockMesh.position.set(rock.x, groundY + rock.radius * rock.scaleY * 0.45, rock.z);
      rockMesh.scale.set(1.0, rock.scaleY, 1.0);
      rockMesh.rotation.set(rock.rotationX, rock.rotationY, 0);

      this.disposables.push({ geometry: rockGeom, material: rockMat });
      this.territories.get('fire')?.transitionItems.push({
        material: rockMat,
        dormantColor: rockDormant,
        activeColor: rockActive,
      });

      this.group.add(rockMesh);
    });
  }

  // 3. Warm Industrial Outpost Territory
  private createIndustrialZone(): void {
    const spec = HAZARD_ZONES.industrial;
    const [cx, cz] = spec.center;
    const industrialPurpleHex = spec.color;

    // Disc & Readable Ribbon Ring
    this.group.add(this.createZoneDisc('industrial', cx, cz, spec.radius, industrialPurpleHex, 0.10, 0.20));
    this.group.add(this.createBorderRibbonRing('industrial', cx, cz, spec.radius, industrialPurpleHex));

    // 11 Deterministic Buildings with architectural variety and warm palette
    const buildings = getDeterministicIndustrialBuildings();
    buildings.forEach((b) => {
      const buildingGroup = new THREE.Group();
      const groundY = Terrain.getElevationAt(b.x, b.z);
      buildingGroup.position.set(b.x, groundY, b.z);
      buildingGroup.rotation.y = b.rotation;

      const wallDormant = this.makeDormantColor(b.wallTone);
      const wallActive = new THREE.Color(b.wallTone);
      const roofDormant = this.makeDormantColor(b.roofTone);
      const roofActive = new THREE.Color(b.roofTone);

      const wallMat = new THREE.MeshStandardMaterial({
        color: wallDormant.clone(),
        flatShading: true,
        roughness: 0.85,
      });
      const roofMat = new THREE.MeshStandardMaterial({
        color: roofDormant.clone(),
        flatShading: true,
        roughness: 0.75,
      });

      if (b.type === 'silo') {
        // Cylindrical storage silo with conical cap
        const siloR = b.width * 0.45;
        const siloH = b.height * 0.8;
        const capH = b.height * 0.25;

        const siloGeom = new THREE.CylinderGeometry(siloR, siloR, siloH, 8);
        const siloMesh = new THREE.Mesh(siloGeom, wallMat);
        siloMesh.position.y = siloH / 2;
        buildingGroup.add(siloMesh);

        const capGeom = new THREE.ConeGeometry(siloR * 1.08, capH, 8);
        const capMesh = new THREE.Mesh(capGeom, roofMat);
        capMesh.position.y = siloH + capH / 2;
        buildingGroup.add(capMesh);

        this.disposables.push({ geometry: siloGeom }, { geometry: capGeom });
      } else if (b.type === 'pitched') {
        // Main block + pitched / pyramidal roof
        const bodyH = b.height * 0.72;
        const roofH = b.height * 0.35;

        const bodyGeom = new THREE.BoxGeometry(b.width, bodyH, b.depth);
        const bodyMesh = new THREE.Mesh(bodyGeom, wallMat);
        bodyMesh.position.y = bodyH / 2;
        buildingGroup.add(bodyMesh);

        // 4-sided pyramid pitched roof
        const roofGeom = new THREE.ConeGeometry(Math.hypot(b.width, b.depth) * 0.52, roofH, 4);
        roofGeom.rotateY(Math.PI / 4);
        const roofMesh = new THREE.Mesh(roofGeom, roofMat);
        roofMesh.position.y = bodyH + roofH / 2;
        buildingGroup.add(roofMesh);

        this.disposables.push({ geometry: bodyGeom }, { geometry: roofGeom });
      } else {
        // Flat roof outpost block with rooftop HVAC/utility unit
        const bodyGeom = new THREE.BoxGeometry(b.width, b.height, b.depth);
        const bodyMesh = new THREE.Mesh(bodyGeom, wallMat);
        bodyMesh.position.y = b.height / 2;
        buildingGroup.add(bodyMesh);

        const utilGeom = new THREE.BoxGeometry(b.width * 0.45, b.height * 0.18, b.depth * 0.45);
        const utilMesh = new THREE.Mesh(utilGeom, roofMat);
        utilMesh.position.y = b.height + (b.height * 0.18) / 2;
        buildingGroup.add(utilMesh);

        this.disposables.push({ geometry: bodyGeom }, { geometry: utilGeom });
      }

      this.disposables.push({ material: wallMat }, { material: roofMat });
      this.territories.get('industrial')?.transitionItems.push(
        { material: wallMat, dormantColor: wallDormant, activeColor: wallActive },
        { material: roofMat, dormantColor: roofDormant, activeColor: roofActive }
      );

      this.group.add(buildingGroup);
    });
  }

  /**
   * Generates subtle sensor coverage footprint rings around cluster sensor nodes (Section 26).
   */
  private buildSensorFootprints(): void {
    const zones = Object.values(HAZARD_ZONES);
    zones.forEach((hazard) => {
      const color = new THREE.Color(hazard.color);
      hazard.sensorNodeIds.forEach((nodeId) => {
        const node = NETWORK_NODES.find((n) => n.id === nodeId);
        if (!node) return;
        const [nx, , nz] = node.position;
        const ny = Terrain.getElevationAt(nx, nz) + 0.04;

        // Subtle coverage ring (radius ~3.65)
        const ringGeom = new THREE.RingGeometry(3.1, 3.55, 32);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: color.clone(),
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.position.set(nx, ny, nz);
        this.footprintGroup.add(ringMesh);
        this.sensorFootprints.set(nodeId, ringMesh);
        this.disposables.push({ geometry: ringGeom, material: ringMat });
      });
    });
  }

  /**
   * Updates visual coverage status for a hazard zone.
   * Section 22:
   * FULL: normal subtle ring
   * REDUNDANT: slight coverage indicator
   * DEGRADED: amber warning ring (#f59e0b)
   * LOST: critical visual state (#ef4444)
   */
  public setTerritoryCoverage(type: HazardType, coverage: ZoneCoverageState): void {
    this.territoryCoverage.set(type, coverage);
  }

  /**
   * Displays subtle ground footprint rings around sensor nodes when zone/sensor is selected.
   * Section 26: Only when zone/node is selected. Default view remains clean.
   */
  public setSelectedSensorCluster(selectedZone: HazardType | null, activeSensorNodeIds?: number[] | null): void {
    for (const [nodeId, mesh] of this.sensorFootprints.entries()) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const shouldShow =
        (selectedZone && HAZARD_ZONES[selectedZone]?.sensorNodeIds.includes(nodeId)) ||
        (activeSensorNodeIds && activeSensorNodeIds.includes(nodeId));

      mat.opacity = shouldShow ? 0.38 : 0;
    }
  }

  /**
   * Dynamically sets the edge risk score (0 - 100) for a territory.
   * Directly drives risk-based visual emphasis (Low, Moderate, High, Critical).
   */
  public setTerritoryRisk(type: HazardType, riskScore: number): void {
    const territory = this.territories.get(type);
    if (territory) {
      territory.riskScore = Math.max(0, Math.min(100, riskScore));
    }
  }

  /**
   * Set active state for an individual territory (triggered by simulation events).
   */
  public setTerritoryActive(type: HazardType, active: boolean): void {
    const territory = this.territories.get(type);
    if (territory) {
      territory.isActive = active;
    }
  }

  /**
   * Immediately snap all territories to clean dormant rest state.
   */
  public resetAllTerritories(): void {
    for (const [type, state] of this.territories.entries()) {
      state.isActive = false;
      state.riskScore = 0;
      state.progress = 0;
      this.territoryCoverage.set(type, 'FULL');
      this.applyTerritoryVisuals(type, 0);
      if (state.borderRibbon && state.borderRibbon.material) {
        (state.borderRibbon.material as THREE.MeshBasicMaterial).opacity = 0.65;
      }
    }
    this.setSelectedSensorCluster(null);
  }

  /**
   * Per-frame animation loop interpolating Dormant ↔ Active transitions.
   * Section 22: communicates zone coverage (FULL, REDUNDANT, DEGRADED, LOST) on boundary rings.
   */
  public update(deltaTime: number, elapsedTime: number = 0): void {
    const transitionSpeed = 1.25; // 1 / 0.8s
    for (const [type, state] of this.territories.entries()) {
      const riskTarget = (state.riskScore / 100) * 0.82;
      const target = state.isActive ? 1.0 : riskTarget;

      if (Math.abs(state.progress - target) > 0.001) {
        const step = transitionSpeed * deltaTime;
        if (state.progress < target) {
          state.progress = Math.min(target, state.progress + step);
        } else {
          state.progress = Math.max(target, state.progress - step);
        }
        this.applyTerritoryVisuals(type, state.progress);
      }

      // Coverage-aware perimeter ribbon styling
      const coverage = this.territoryCoverage.get(type) || 'FULL';
      if (state.borderRibbon && state.borderRibbon.material) {
        const mat = state.borderRibbon.material as THREE.MeshBasicMaterial;

        if (coverage === 'LOST') {
          // Critical lost state: pulsing amber-red warning
          mat.color.set('#ef4444');
          mat.opacity = 0.35 + 0.28 * Math.sin(elapsedTime * 5.0);
        } else if (coverage === 'DEGRADED') {
          // Amber warning: single sensor remaining
          mat.color.set('#f59e0b');
          mat.opacity = 0.72 + 0.15 * Math.sin(elapsedTime * 2.5);
        } else {
          // Normal zone colors (FULL or REDUNDANT)
          const activeCol = new THREE.Color(HAZARD_ZONES[type].color);
          const dormantCol = this.makeDormantColor(HAZARD_ZONES[type].color);
          mat.color.copy(dormantCol).lerp(activeCol, state.progress);

          if (state.riskScore >= 25 || state.isActive) {
            const freq = state.riskScore >= 75 || state.isActive ? 4.5 : state.riskScore >= 50 ? 2.8 : 1.5;
            const pulse = 0.55 + 0.35 * Math.sin(elapsedTime * freq);
            mat.opacity = THREE.MathUtils.lerp(0.65, 0.95, pulse * (state.riskScore / 100));
          } else {
            mat.opacity = coverage === 'REDUNDANT' ? 0.72 : 0.65;
          }
        }
      }
    }
  }

  /**
   * Interpolate all materials within a territory between dormant and active values.
   */
  private applyTerritoryVisuals(type: HazardType, progress: number): void {
    const state = this.territories.get(type);
    if (!state) return;

    for (const item of state.transitionItems) {
      // Lerp color
      if ('color' in item.material) {
        item.material.color.copy(item.dormantColor).lerp(item.activeColor, progress);
      }

      // Lerp opacity if defined
      if (item.dormantOpacity !== undefined && item.activeOpacity !== undefined) {
        item.material.opacity = THREE.MathUtils.lerp(item.dormantOpacity, item.activeOpacity, progress);
      }
    }
  }

  public getTerritory(type: HazardType): TerritoryVisualState | undefined {
    return this.territories.get(type);
  }

  public dispose(): void {
    for (const d of this.disposables) {
      d.geometry?.dispose();
      d.material?.dispose();
    }
  }
}
