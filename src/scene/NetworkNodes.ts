import * as THREE from 'three';
import { NodeData, NETWORK_NODES } from '../data/nodes';
import { STATUS_COLORS, NodeStatus } from '../data/tokens';
import { Terrain } from './Terrain';

export interface NodeMeshGroup {
  data: NodeData;
  group: THREE.Group;
  platformMesh: THREE.Mesh;
  platformTrimMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  beamMesh: THREE.Mesh;
  coreMesh: THREE.Mesh;
  coreSolidMesh: THREE.Mesh;
  pointLight: THREE.PointLight;
  coreWorldPos: THREE.Vector3;
  riskScore?: number;
}

export class NetworkNodes {
  public group: THREE.Group;
  public nodeMeshes: Map<number, NodeMeshGroup> = new Map();
  private disposables: { geometry?: THREE.BufferGeometry; material?: THREE.Material }[] = [];

  // Interaction State
  private selectedNodeId: number | null = null;
  private hoveredNodeId: number | null = null;
  private selectionReticle: THREE.Group;
  private reticleMaterial: THREE.MeshBasicMaterial;

  constructor() {
    this.group = new THREE.Group();

    // Build tactical selection reticle (pulsing brackets ring)
    this.selectionReticle = new THREE.Group();
    this.selectionReticle.visible = false;

    const reticleRingGeom = new THREE.RingGeometry(2.3, 2.5, 32);
    reticleRingGeom.rotateX(-Math.PI / 2);
    this.reticleMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(STATUS_COLORS.safe),
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const reticleMesh = new THREE.Mesh(reticleRingGeom, this.reticleMaterial);
    this.selectionReticle.add(reticleMesh);

    // 4 Corner tactical bracket tick marks
    const tickGeom = new THREE.BoxGeometry(0.12, 0.04, 0.6);
    [-2.4, 2.4].forEach((tx) => {
      const tick = new THREE.Mesh(tickGeom, this.reticleMaterial);
      tick.position.set(tx, 0.02, 0);
      this.selectionReticle.add(tick);
    });
    [-2.4, 2.4].forEach((tz) => {
      const tick = new THREE.Mesh(tickGeom, this.reticleMaterial);
      tick.position.set(0, 0.02, tz);
      tick.rotation.y = Math.PI / 2;
      this.selectionReticle.add(tick);
    });

    this.disposables.push(
      { geometry: reticleRingGeom, material: this.reticleMaterial },
      { geometry: tickGeom }
    );
    this.group.add(this.selectionReticle);

    this.buildNodes();
  }

  private buildNodes(): void {
    NETWORK_NODES.forEach((node) => {
      const nodeGroup = new THREE.Group();
      const [nx, , nz] = node.position;
      const baseY = Terrain.getElevationAt(nx, nz);

      nodeGroup.position.set(nx, baseY, nz);

      const statusColor = new THREE.Color(STATUS_COLORS[node.status]);

      // -------------------------------------------------------------
      // Layer 0 — Flat-Shaded Ground Platform (Outpost / Station base)
      // -------------------------------------------------------------
      const isCmd = node.isCommandCenter;
      const isField = node.id >= 7;
      const platRadiusTop = isCmd ? 2.1 : isField ? 0.85 : 1.35;
      const platRadiusBottom = isCmd ? 2.5 : isField ? 1.05 : 1.6;
      const platHeight = isCmd ? 0.38 : isField ? 0.16 : 0.22;
      const platSegments = isCmd ? 8 : 6; // Octagonal for Command, Hexagonal for other nodes

      const platGeom = new THREE.CylinderGeometry(
        platRadiusTop,
        platRadiusBottom,
        platHeight,
        platSegments
      );
      const platMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(isCmd ? '#243247' : isField ? '#1e293b' : '#2b3a4f'),
        flatShading: true,
        roughness: 0.85,
        metalness: 0.15,
      });
      const platformMesh = new THREE.Mesh(platGeom, platMat);
      platformMesh.position.y = platHeight / 2;
      nodeGroup.add(platformMesh);

      // Status-colored accent trim ring on platform top
      const trimGeom = new THREE.RingGeometry(platRadiusTop * 0.72, platRadiusTop * 0.94, platSegments);
      trimGeom.rotateX(-Math.PI / 2);
      const trimMat = new THREE.MeshBasicMaterial({
        color: statusColor.clone(),
        side: THREE.DoubleSide,
        depthWrite: false,
        transparent: true,
        opacity: isField ? 0.6 : 0.75,
      });
      const platformTrimMesh = new THREE.Mesh(trimGeom, trimMat);
      platformTrimMesh.position.y = platHeight + 0.015;
      nodeGroup.add(platformTrimMesh);

      // -------------------------------------------------------------
      // Physical Field Mesh Installation (Sections 32 & 33 of Phase 7)
      // Grounded compact mast, battery enclosure, antenna, and solar panels
      // -------------------------------------------------------------
      if (isField) {
        // 1. Compact weather-sealed battery/radio enclosure box
        const boxGeom = new THREE.BoxGeometry(0.32, 0.34, 0.24);
        const boxMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#334155'),
          roughness: 0.7,
          metalness: 0.3,
        });
        const boxMesh = new THREE.Mesh(boxGeom, boxMat);
        boxMesh.position.set(platRadiusTop * 0.38, platHeight + 0.17, 0);
        nodeGroup.add(boxMesh);

        // 2. Deterministic Solar Panel for subset of field nodes (~50% of nodes: even IDs)
        if (node.id % 2 === 0) {
          const solarArmGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6);
          const solarArmMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#475569') });
          const solarArmMesh = new THREE.Mesh(solarArmGeom, solarArmMat);
          solarArmMesh.position.set(-platRadiusTop * 0.32, platHeight + 0.28, 0);
          solarArmMesh.rotation.z = Math.PI / 6;
          nodeGroup.add(solarArmMesh);

          const panelGeom = new THREE.BoxGeometry(0.38, 0.02, 0.28);
          const panelMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#0f2b48'), // Deep solar silicon blue
            roughness: 0.3,
            metalness: 0.7,
          });
          const panelMesh = new THREE.Mesh(panelGeom, panelMat);
          panelMesh.position.set(-platRadiusTop * 0.42, platHeight + 0.48, 0);
          panelMesh.rotation.x = 0.35; // Tilted towards sunlight
          panelMesh.rotation.z = 0.2;
          nodeGroup.add(panelMesh);

          this.disposables.push(
            { geometry: solarArmGeom, material: solarArmMat },
            { geometry: panelGeom, material: panelMat }
          );
        }

        this.disposables.push({ geometry: boxGeom, material: boxMat });
      }

      // -------------------------------------------------------------
      // Physical Field Sensor Deployment (Section 22 of Phase 6B)
      // Grounded, low-poly physical sensor equipment on hazard outposts
      // -------------------------------------------------------------
      if (node.id === 1) {
        // Flood-04: Water-Level Gauge Rod + Miniature Rain Gauge Funnel
        const probeGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8);
        const probeMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#384b66'),
          roughness: 0.6,
          metalness: 0.3,
        });
        const probeMesh = new THREE.Mesh(probeGeom, probeMat);
        probeMesh.position.set(platRadiusTop * 0.82, 0.75, platRadiusTop * 0.35);
        nodeGroup.add(probeMesh);

        // Water level calibration ring notches (turquoise and white)
        [-0.3, 0.0, 0.3].forEach((offsetY) => {
          const notchGeom = new THREE.TorusGeometry(0.046, 0.012, 4, 12);
          notchGeom.rotateX(Math.PI / 2);
          const notchMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#2dd4c8') });
          const notchMesh = new THREE.Mesh(notchGeom, notchMat);
          notchMesh.position.set(platRadiusTop * 0.82, 0.75 + offsetY, platRadiusTop * 0.35);
          nodeGroup.add(notchMesh);
          this.disposables.push({ geometry: notchGeom, material: notchMat });
        });

        // Mini rain funnel collector
        const funnelGeom = new THREE.ConeGeometry(0.12, 0.22, 8);
        const funnelMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#475569'),
          roughness: 0.5,
          metalness: 0.4,
        });
        const funnelMesh = new THREE.Mesh(funnelGeom, funnelMat);
        funnelMesh.rotation.x = Math.PI; // Inverted cone = funnel
        funnelMesh.position.set(-platRadiusTop * 0.75, platHeight + 0.35, -platRadiusTop * 0.4);
        nodeGroup.add(funnelMesh);

        // Funnel stanchion post
        const funnelPostGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.28, 6);
        const funnelPostMesh = new THREE.Mesh(funnelPostGeom, probeMat);
        funnelPostMesh.position.set(-platRadiusTop * 0.75, platHeight + 0.14, -platRadiusTop * 0.4);
        nodeGroup.add(funnelPostMesh);

        this.disposables.push(
          { geometry: probeGeom, material: probeMat },
          { geometry: funnelGeom, material: funnelMat },
          { geometry: funnelPostGeom }
        );
      } else if (node.id === 2) {
        // Forest-07: Compact Environmental Sensing Mast (Thermal IR detector + Weather mast)
        const mastGeom = new THREE.CylinderGeometry(0.035, 0.04, 1.6, 8);
        const mastMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#334155'),
          roughness: 0.7,
          metalness: 0.3,
        });
        const mastMesh = new THREE.Mesh(mastGeom, mastMat);
        mastMesh.position.set(platRadiusTop * 0.8, 0.8, -platRadiusTop * 0.4);
        nodeGroup.add(mastMesh);

        // Angled thermal IR sensing head directed outward toward forest canopy
        const headGeom = new THREE.BoxGeometry(0.12, 0.09, 0.16);
        const headMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#1e293b'),
          roughness: 0.4,
          metalness: 0.6,
        });
        const headMesh = new THREE.Mesh(headGeom, headMat);
        headMesh.position.set(platRadiusTop * 0.8, 1.55, -platRadiusTop * 0.4);
        headMesh.rotation.y = 0.8;
        headMesh.rotation.x = 0.2;
        nodeGroup.add(headMesh);

        // Emissive IR sensor lens
        const lensGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8);
        lensGeom.rotateX(Math.PI / 2);
        const lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#f97316') });
        const lensMesh = new THREE.Mesh(lensGeom, lensMat);
        lensMesh.position.set(platRadiusTop * 0.8 + 0.06, 1.55, -platRadiusTop * 0.4 + 0.07);
        nodeGroup.add(lensMesh);

        this.disposables.push(
          { geometry: mastGeom, material: mastMat },
          { geometry: headGeom, material: headMat },
          { geometry: lensGeom, material: lensMat }
        );
      } else if (node.id === 3) {
        // Indus-02: Hazardous Vapor & Gas Sniffer Sensor Canister
        const canisterGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.38, 10);
        const canisterMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#384152'),
          roughness: 0.3,
          metalness: 0.7,
        });
        const canisterMesh = new THREE.Mesh(canisterGeom, canisterMat);
        canisterMesh.position.set(-platRadiusTop * 0.78, platHeight + 0.28, platRadiusTop * 0.5);
        nodeGroup.add(canisterMesh);

        // Slotted intake sensor grille ring
        const grilleGeom = new THREE.TorusGeometry(0.095, 0.015, 6, 12);
        grilleGeom.rotateX(Math.PI / 2);
        const grilleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#c084fc') });
        const grilleMesh = new THREE.Mesh(grilleGeom, grilleMat);
        grilleMesh.position.set(-platRadiusTop * 0.78, platHeight + 0.36, platRadiusTop * 0.5);
        nodeGroup.add(grilleMesh);

        // Canister stanchion post
        const postGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6);
        const postMesh = new THREE.Mesh(postGeom, canisterMat);
        postMesh.position.set(-platRadiusTop * 0.78, platHeight + 0.09, platRadiusTop * 0.5);
        nodeGroup.add(postMesh);

        this.disposables.push(
          { geometry: canisterGeom, material: canisterMat },
          { geometry: grilleGeom, material: grilleMat },
          { geometry: postGeom }
        );
      } else if (node.id === 7 || node.id === 9) {
        // Flood Secondary / Tertiary Sensors (Flood-S1, Flood-S2): Hydrometric Water Probe Stanchion
        const probeGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6);
        const probeMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#384b66'),
          roughness: 0.6,
          metalness: 0.3,
        });
        const probeMesh = new THREE.Mesh(probeGeom, probeMat);
        probeMesh.position.set(-platRadiusTop * 0.45, platHeight + 0.45, platRadiusTop * 0.3);
        nodeGroup.add(probeMesh);

        // Water level sensor collar ring (turquoise)
        const collarGeom = new THREE.TorusGeometry(0.035, 0.01, 4, 8);
        collarGeom.rotateX(Math.PI / 2);
        const collarMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#2dd4c8') });
        const collarMesh = new THREE.Mesh(collarGeom, collarMat);
        collarMesh.position.set(-platRadiusTop * 0.45, platHeight + 0.65, platRadiusTop * 0.3);
        nodeGroup.add(collarMesh);

        this.disposables.push(
          { geometry: probeGeom, material: probeMat },
          { geometry: collarGeom, material: collarMat }
        );
      } else if (node.id === 11 || node.id === 13) {
        // Forest Secondary / Tertiary Sensors (Forest-S1, Forest-S2): Pyro-Thermal IR Sensor Head
        const mastGeom = new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6);
        const mastMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#334155'),
          roughness: 0.7,
          metalness: 0.3,
        });
        const mastMesh = new THREE.Mesh(mastGeom, mastMat);
        mastMesh.position.set(-platRadiusTop * 0.45, platHeight + 0.5, platRadiusTop * 0.3);
        nodeGroup.add(mastMesh);

        const headGeom = new THREE.BoxGeometry(0.08, 0.07, 0.12);
        const headMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#1e293b'),
          roughness: 0.4,
          metalness: 0.6,
        });
        const headMesh = new THREE.Mesh(headGeom, headMat);
        headMesh.position.set(-platRadiusTop * 0.45, platHeight + 0.98, platRadiusTop * 0.3);
        headMesh.rotation.y = 0.5;
        nodeGroup.add(headMesh);

        // Emissive IR sensor lens (orange)
        const lensGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.015, 6);
        lensGeom.rotateX(Math.PI / 2);
        const lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#f97316') });
        const lensMesh = new THREE.Mesh(lensGeom, lensMat);
        lensMesh.position.set(-platRadiusTop * 0.45 + 0.04, platHeight + 0.98, platRadiusTop * 0.3 + 0.05);
        nodeGroup.add(lensMesh);

        this.disposables.push(
          { geometry: mastGeom, material: mastMat },
          { geometry: headGeom, material: headMat },
          { geometry: lensGeom, material: lensMat }
        );
      } else if (node.id === 15 || node.id === 17) {
        // Industrial Secondary / Tertiary Sensors (Indus-S1, Indus-S2): Vapor Sniffer Canister
        const canisterGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.28, 8);
        const canisterMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#384152'),
          roughness: 0.3,
          metalness: 0.7,
        });
        const canisterMesh = new THREE.Mesh(canisterGeom, canisterMat);
        canisterMesh.position.set(-platRadiusTop * 0.45, platHeight + 0.22, platRadiusTop * 0.3);
        nodeGroup.add(canisterMesh);

        // Slotted intake sensor grille ring (purple)
        const grilleGeom = new THREE.TorusGeometry(0.065, 0.01, 4, 8);
        grilleGeom.rotateX(Math.PI / 2);
        const grilleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#c084fc') });
        const grilleMesh = new THREE.Mesh(grilleGeom, grilleMat);
        grilleMesh.position.set(-platRadiusTop * 0.45, platHeight + 0.28, platRadiusTop * 0.3);
        nodeGroup.add(grilleMesh);

        this.disposables.push(
          { geometry: canisterGeom, material: canisterMat },
          { geometry: grilleGeom, material: grilleMat }
        );
      }

      // -------------------------------------------------------------
      // Layer 1 — Ground Ring: Floating status ring above platform
      // -------------------------------------------------------------
      const ringRadiusInner = isCmd ? 1.6 : isField ? 0.72 : 1.08;
      const ringRadiusOuter = isCmd ? 1.95 : isField ? 0.92 : 1.32;
      const ringGeom = new THREE.RingGeometry(ringRadiusInner, ringRadiusOuter, 32);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: statusColor.clone(),
        transparent: true,
        opacity: isField ? 0.45 : 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.y = platHeight + 0.12;
      nodeGroup.add(ringMesh);

      // -------------------------------------------------------------
      // Layer 2 — Beam: Thin vertical cylinder with punchy visibility
      // -------------------------------------------------------------
      const beamRadius = isCmd ? 0.08 : isField ? 0.032 : 0.06;
      const beamGeom = new THREE.CylinderGeometry(beamRadius, beamRadius, node.beamHeight, 12);
      const beamMat = new THREE.MeshBasicMaterial({
        color: statusColor.clone(),
        transparent: true,
        opacity: isField ? 0.28 : 0.42,
      });
      const beamMesh = new THREE.Mesh(beamGeom, beamMat);
      beamMesh.position.y = node.beamHeight / 2;
      nodeGroup.add(beamMesh);

      // -------------------------------------------------------------
      // Layer 3 — Core: Punchy Luminous Solid Core + Wireframe Facet
      // Emissive Intensity ~1.1 to 1.3 for daytime map clarity
      // -------------------------------------------------------------
      const coreGeom = node.isCommandCenter
        ? new THREE.OctahedronGeometry(node.coreRadius, 0)
        : isField
        ? new THREE.OctahedronGeometry(node.coreRadius, 0)
        : new THREE.IcosahedronGeometry(node.coreRadius, 0);

      const coreWireMat = new THREE.MeshBasicMaterial({
        color: statusColor.clone(),
        wireframe: true,
      });
      const coreMesh = new THREE.Mesh(coreGeom, coreWireMat);
      coreMesh.position.y = node.coreElevation;

      // Solid luminous inner core
      const innerRadius = node.coreRadius * 0.78;
      const coreSolidGeom = node.isCommandCenter
        ? new THREE.OctahedronGeometry(innerRadius, 0)
        : isField
        ? new THREE.OctahedronGeometry(innerRadius, 0)
        : new THREE.IcosahedronGeometry(innerRadius, 0);

      const coreSolidMat = new THREE.MeshStandardMaterial({
        color: statusColor.clone(),
        emissive: statusColor.clone(),
        emissiveIntensity: isField ? 1.0 : 1.25,
        flatShading: true,
        roughness: 0.2,
      });
      const coreSolidMesh = new THREE.Mesh(coreSolidGeom, coreSolidMat);
      coreMesh.add(coreSolidMesh);

      nodeGroup.add(coreMesh);

      // -------------------------------------------------------------
      // Layer 4 — Beacon Light: Punchy local point light at core elevation
      // -------------------------------------------------------------
      const initialIntensity = node.isCommandCenter ? 1.4 : isField ? 0.75 : 1.15;
      const lightDistance = isCmd ? 18 : isField ? 10 : 16;
      const pointLight = new THREE.PointLight(statusColor.clone(), initialIntensity, lightDistance);
      pointLight.position.set(0, node.coreElevation, 0);
      nodeGroup.add(pointLight);

      // Store world position of the core center for mesh links and labels
      const coreWorldPos = new THREE.Vector3(nx, baseY + node.coreElevation, nz);

      this.group.add(nodeGroup);
      this.nodeMeshes.set(node.id, {
        data: node,
        group: nodeGroup,
        platformMesh,
        platformTrimMesh,
        ringMesh,
        beamMesh,
        coreMesh,
        coreSolidMesh,
        pointLight,
        coreWorldPos,
      });

      this.disposables.push(
        { geometry: platGeom, material: platMat },
        { geometry: trimGeom, material: trimMat },
        { geometry: ringGeom, material: ringMat },
        { geometry: beamGeom, material: beamMat },
        { geometry: coreGeom, material: coreWireMat },
        { geometry: coreSolidGeom, material: coreSolidMat }
      );
    });
  }

  // Update loop for subtle tactical core rotation & breathing
  public update(time: number): void {
    // Animate selection reticle if active
    if (this.selectedNodeId !== null && this.selectionReticle.visible) {
      this.selectionReticle.rotation.y = time * 0.8;
      const pulse = 0.65 + 0.35 * Math.sin(time * 3.5);
      this.reticleMaterial.opacity = pulse;
    }

    this.nodeMeshes.forEach(({ coreMesh, beamMesh, ringMesh, pointLight, data, riskScore = 0 }) => {
      if (data.status === 'offline') {
        coreMesh.rotation.y = time * 0.15;
        coreMesh.scale.set(1.0, 1.0, 1.0);
        (ringMesh.material as THREE.MeshBasicMaterial).opacity = 0.22;
        (beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.12;
        pointLight.intensity = 0.08;
        return;
      }

      if (data.status === 'critical' || riskScore >= 75) {
        // High-urgency tactical pulse
        const urgencySpeed = 2.4;
        coreMesh.rotation.y = time * urgencySpeed;
        coreMesh.rotation.x = Math.sin(time * 4.0) * 0.25;

        // Tactical scale oscillation
        const scale = 1.0 + 0.16 * Math.sin(time * 8.0);
        coreMesh.scale.set(scale, scale, scale);

        // Pulsing ring, beam, and point light intensity
        (ringMesh.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.35 * Math.sin(time * 8.0);
        (beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.38 + 0.25 * Math.sin(time * 8.0);
        pointLight.intensity = 1.35 + 0.65 * Math.sin(time * 8.0);
      } else if (riskScore >= 25) {
        // Developing / Elevated Risk visual state
        const rotSpeed = 0.8 + (riskScore / 100) * 0.8;
        coreMesh.rotation.y = time * rotSpeed;
        coreMesh.rotation.x = Math.sin(time * 1.5) * 0.18;

        const pulseFreq = riskScore >= 50 ? 4.0 : 2.0;
        const pulse = Math.sin(time * pulseFreq);
        const scale = 1.0 + 0.08 * (riskScore / 100) * pulse;
        coreMesh.scale.set(scale, scale, scale);

        (ringMesh.material as THREE.MeshBasicMaterial).opacity = 0.65 + 0.25 * pulse;
        (beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.18 * pulse;
        pointLight.intensity = 1.25 + 0.45 * pulse * (riskScore / 100);
      } else {
        // Normal subtle idle animation
        const rotSpeed = data.isCommandCenter ? 0.35 : 0.65;
        coreMesh.rotation.y = time * rotSpeed;
        coreMesh.rotation.x = Math.sin(time * 0.5) * 0.15;
        
        // Retain hover scale if hovered, otherwise 1.0
        if (this.hoveredNodeId === data.id) {
          coreMesh.scale.set(1.12, 1.12, 1.12);
        } else {
          coreMesh.scale.set(1.0, 1.0, 1.0);
        }

        // Default opacities and steady beacon light
        (ringMesh.material as THREE.MeshBasicMaterial).opacity = 0.65;
        (beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.42;
        pointLight.intensity = data.isCommandCenter ? 1.4 : 1.15;
      }
    });
  }

  /**
   * Updates edge risk score for a node (0 - 100).
   * Dynamically elevates beacon light and pulse frequency when risk develops.
   */
  public updateNodeRisk(nodeId: number, riskScore: number): void {
    const nodeItem = this.nodeMeshes.get(nodeId);
    if (nodeItem) {
      nodeItem.riskScore = Math.max(0, Math.min(100, riskScore));
    }
  }

  public setSelectedNode(nodeId: number | null): void {
    this.selectedNodeId = nodeId;
    if (nodeId !== null && this.nodeMeshes.has(nodeId)) {
      const nodeItem = this.nodeMeshes.get(nodeId)!;
      const [nx, , nz] = nodeItem.data.position;
      const gy = Terrain.getElevationAt(nx, nz);
      this.selectionReticle.position.set(nx, gy + 0.05, nz);
      this.selectionReticle.visible = true;
      const col = new THREE.Color(STATUS_COLORS[nodeItem.data.status]);
      this.reticleMaterial.color.copy(col);
    } else {
      this.selectionReticle.visible = false;
    }
  }

  public setHoveredNode(nodeId: number | null): void {
    this.hoveredNodeId = nodeId;
  }

  public getSelectedNodeId(): number | null {
    return this.selectedNodeId;
  }

  /**
   * Dynamically update node status and all visual layers.
   */
  public setNodeStatus(nodeId: number, status: NodeStatus, force: boolean = false): void {
    const nodeItem = this.nodeMeshes.get(nodeId);
    if (!nodeItem) return;

    // Do not overwrite offline status with hazard statuses unless forced or restoring
    if (!force && nodeItem.data.status === 'offline' && status !== 'safe' && status !== 'offline') {
      return;
    }

    nodeItem.data.status = status;
    const color = new THREE.Color(STATUS_COLORS[status]);

    (nodeItem.platformTrimMesh.material as THREE.MeshBasicMaterial).color.copy(color);
    (nodeItem.ringMesh.material as THREE.MeshBasicMaterial).color.copy(color);
    (nodeItem.beamMesh.material as THREE.MeshBasicMaterial).color.copy(color);
    (nodeItem.coreMesh.material as THREE.MeshBasicMaterial).color.copy(color);

    const solidMat = nodeItem.coreSolidMesh.material as THREE.MeshStandardMaterial;
    solidMat.color.copy(color);
    solidMat.emissive.copy(color);

    nodeItem.pointLight.color.copy(color);

    // If offline, reduce beam/ring opacity and dim light
    if (status === 'offline') {
      (nodeItem.ringMesh.material as THREE.MeshBasicMaterial).opacity = 0.2;
      (nodeItem.beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.12;
      solidMat.emissiveIntensity = 0.2;
      nodeItem.pointLight.intensity = 0.1;
    } else {
      (nodeItem.ringMesh.material as THREE.MeshBasicMaterial).opacity = 0.65;
      (nodeItem.beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.42;
      solidMat.emissiveIntensity = 1.25;
      nodeItem.pointLight.intensity = nodeItem.data.isCommandCenter
        ? 1.4
        : nodeItem.data.id >= 7
        ? 0.75
        : 1.15;
    }
  }

  public resetAllNodes(): void {
    this.nodeMeshes.forEach((nodeItem) => {
      const defaultStatus: NodeStatus = nodeItem.data.isCommandCenter ? 'command' : 'safe';
      this.setNodeStatus(nodeItem.data.id, defaultStatus, true);
      nodeItem.coreMesh.scale.set(1.0, 1.0, 1.0);
    });
  }

  public getNodeStatus(nodeId: number): NodeStatus | undefined {
    return this.nodeMeshes.get(nodeId)?.data.status;
  }

  public getCoreWorldPosition(nodeId: number): THREE.Vector3 | null {
    const node = this.nodeMeshes.get(nodeId);
    return node ? node.coreWorldPos.clone() : null;
  }

  public getNodeMesh(nodeId: number) {
    return this.nodeMeshes.get(nodeId);
  }

  public dispose(): void {
    for (const d of this.disposables) {
      d.geometry?.dispose();
      d.material?.dispose();
    }
  }
}
