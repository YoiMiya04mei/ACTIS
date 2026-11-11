"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  DataCenterRackItem,
  RackSlotItem,
  isRackRangeFree,
} from "@/lib/dcimUtils";
import {
  RotateCcw,
  DoorOpen,
  DoorClosed,
  RefreshCw,
  Eye,
  AlertTriangle,
} from "lucide-react";

interface Rack3DViewerProps {
  rack: DataCenterRackItem;
  mode?: "view" | "select";
  requiredUnits?: number;
  selectedStartU?: number | null;
  highlightedSlotId?: string | null;
  selectedSlotId?: string | null;
  onSelectEmptyRange?: (startU: number, endU: number) => void;
  onSelectSlot?: (slot: RackSlotItem) => void;
  heightClass?: string;
}

type CameraPreset = "iso" | "front" | "rear" | "side";

function createFaceplateTexture(
  slot: RackSlotItem,
  isHighlighted: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = Math.max(64, Math.min(256, slot.unit_size * 46));
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Dark brushed server bezel gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, isHighlighted ? "#0f2744" : "#161e2e");
    grad.addColorStop(1, isHighlighted ? "#123456" : "#0b1120");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle bezel border
    ctx.strokeStyle = isHighlighted ? "#38bdf8" : "#334155";
    ctx.lineWidth = isHighlighted ? 4 : 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    // Left colored tag accent bar
    const accentColor =
      slot.status === "Reserved"
        ? "#f59e0b"
        : slot.status === "Maintenance"
        ? "#ef4444"
        : slot.color_tag || "#3b82f6";
    ctx.fillStyle = accentColor;
    ctx.fillRect(4, 4, 14, canvas.height - 8);

    // Drive bay / ventilation grille lines on right side
    ctx.fillStyle = "rgba(148, 163, 184, 0.16)";
    const ventsCount = Math.min(8, Math.max(2, Math.floor(canvas.height / 14)));
    for (let i = 0; i < ventsCount; i++) {
      ctx.fillRect(canvas.width - 115, 10 + i * 12, 85, 6);
    }

    // U-Position pill badge
    const uText =
      slot.start_u === slot.end_u
        ? `U${slot.start_u}`
        : `U${slot.start_u}-U${slot.end_u}`;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(28, 10, 86, 26);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(28, 10, 86, 26);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 15px monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(uText, 36, 23);

    // Device Name
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 18px sans-serif";
    const devLabel =
      slot.device_name.length > 26
        ? `${slot.device_name.slice(0, 24)}...`
        : slot.device_name;
    ctx.fillText(devLabel, 126, 23);

    // Sub-row info (customer + SN + status) if room
    if (canvas.height >= 64) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "13px sans-serif";
      const subParts = [
        slot.customer_name || slot.device_type,
        slot.serial_number ? `SN:${slot.serial_number}` : null,
        slot.status === "Reserved" ? "[RESERVED]" : null,
      ].filter(Boolean);
      const subText = subParts.join(" • ");
      ctx.fillText(
        subText.length > 48 ? `${subText.slice(0, 46)}...` : subText,
        28,
        canvas.height - 18
      );
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createRailLabelsTexture(totalU: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = totalU * 32;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let u = 1; u <= totalU; u++) {
      // Canvas Y=0 is top (highest U)
      const yTop = (totalU - u) * 32;
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yTop);
      ctx.lineTo(canvas.width, yTop);
      ctx.stroke();

      // Square cage-nut mounting holes
      ctx.fillStyle = "#090d16";
      ctx.fillRect(10, yTop + 6, 8, 6);
      ctx.fillRect(10, yTop + 20, 8, 6);

      ctx.fillStyle = u % 5 === 0 ? "#38bdf8" : "#94a3b8";
      ctx.font = u % 5 === 0 ? "bold 16px monospace" : "14px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(String(u).padStart(2, "0"), canvas.width - 10, yTop + 16);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createRackBannerTexture(code: string, name: string, totalU: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(0, 0, 12, 96);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 28px monospace";
    ctx.fillText(`${code} (${totalU}U)`, 28, 38);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "20px sans-serif";
    ctx.fillText(name.slice(0, 40), 28, 74);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function Rack3DViewer({
  rack,
  mode = "view",
  requiredUnits = 1,
  selectedStartU = null,
  highlightedSlotId = null,
  selectedSlotId = null,
  onSelectEmptyRange,
  onSelectSlot,
  heightClass = "h-[540px]",
}: Rack3DViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [doorOpen, setDoorOpen] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    title: string;
    subtitle: string;
    tone: "ok" | "blocked" | "info";
  } | null>(null);

  const doorOpenRef = useRef(doorOpen);
  const autoRotateRef = useRef(autoRotate);
  const cameraPresetFnRef = useRef<((preset: CameraPreset) => void) | null>(null);

  // Sync latest callbacks & dynamic props via refs so hover/click stays instant without tearing down WebGL context unnecessarily
  const propsRef = useRef({
    rack,
    mode,
    requiredUnits,
    selectedStartU,
    onSelectEmptyRange,
    onSelectSlot,
  });
  propsRef.current = {
    rack,
    mode,
    requiredUnits,
    selectedStartU,
    onSelectEmptyRange,
    onSelectSlot,
  };

  useEffect(() => {
    doorOpenRef.current = doorOpen;
  }, [doorOpen]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebglError("Browser/GPU tidak mendukung WebGL 3D. Gunakan daftar slot 2D di panel kanan.");
      return;
    }

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 520;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);

    // Subtle floor grid
    const gridHelper = new THREE.GridHelper(10, 20, 0x1e3a5f, 0x172033);
    const totalU = rack.total_u || 42;
    const U_HEIGHT = 0.088;
    const RACK_INTERIOR_H = totalU * U_HEIGHT;
    const RACK_W = 1.38;
    const RACK_D = 1.65;
    const BASE_BOTTOM_Y = -RACK_INTERIOR_H / 2;
    gridHelper.position.y = BASE_BOTTOM_Y - 0.16;
    scene.add(gridHelper);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 60);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 1.6;
    controls.maxDistance = 11.5;
    controls.maxPolarAngle = Math.PI * 0.85;

    const applyPreset = (preset: CameraPreset) => {
      const dist = Math.max(4.4, RACK_INTERIOR_H * 1.18);
      controls.target.set(0, 0, 0);
      if (preset === "front") {
        camera.position.set(0, 0.1, dist * 1.05);
      } else if (preset === "rear") {
        camera.position.set(0.3, 0.2, -dist * 1.05);
      } else if (preset === "side") {
        camera.position.set(dist * 0.95, 0.2, 0.4);
      } else {
        camera.position.set(dist * 0.62, RACK_INTERIOR_H * 0.12, dist * 0.88);
      }
      controls.update();
    };
    cameraPresetFnRef.current = applyPreset;
    applyPreset("iso");

    // Studio Lighting
    const ambient = new THREE.AmbientLight(0xdbeafe, 0.9);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(3.5, 5.5, 5.5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(-4, 2.5, -3.5);
    scene.add(rimLight);

    const interiorLight = new THREE.PointLight(0xe0f2fe, 0.9, 6);
    interiorLight.position.set(0, RACK_INTERIOR_H * 0.35, RACK_D * 0.42);
    scene.add(interiorLight);

    const rackGroup = new THREE.Group();
    scene.add(rackGroup);

    const disposables: Array<{ dispose: () => void }> = [];

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x1a2232,
      metalness: 0.72,
      roughness: 0.38,
    });
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x0f1624,
      metalness: 0.65,
      roughness: 0.48,
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.78,
      roughness: 0.32,
    });
    disposables.push(steelMat, darkSteelMat, railMat);

    // Outer Cabinet Structure (Top, Bottom Plinth + Casters, Left & Right Side Panels, Back)
    const wallT = 0.045;
    const topGeo = new THREE.BoxGeometry(RACK_W, wallT * 1.4, RACK_D);
    const topMesh = new THREE.Mesh(topGeo, steelMat);
    topMesh.position.set(0, RACK_INTERIOR_H / 2 + wallT * 0.7, 0);
    rackGroup.add(topMesh);

    const botMesh = new THREE.Mesh(topGeo, steelMat);
    botMesh.position.set(0, BASE_BOTTOM_Y - wallT * 0.7, 0);
    rackGroup.add(botMesh);

    // Top name header banner
    const bannerTex = createRackBannerTexture(rack.code, rack.name, totalU);
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });
    const bannerGeo = new THREE.PlaneGeometry(RACK_W - 0.1, 0.14);
    const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
    bannerMesh.position.set(0, RACK_INTERIOR_H / 2 + 0.1, RACK_D / 2 + 0.01);
    rackGroup.add(bannerMesh);
    disposables.push(topGeo, bannerTex, bannerMat, bannerGeo);

    // Heavy duty feet/casters
    const casterGeo = new THREE.CylinderGeometry(0.05, 0.055, 0.09, 12);
    const casterMat = new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.4, roughness: 0.7 });
    disposables.push(casterGeo, casterMat);
    for (const cx of [-RACK_W / 2 + 0.12, RACK_W / 2 - 0.12]) {
      for (const cz of [-RACK_D / 2 + 0.14, RACK_D / 2 - 0.14]) {
        const c = new THREE.Mesh(casterGeo, casterMat);
        c.position.set(cx, BASE_BOTTOM_Y - 0.11, cz);
        rackGroup.add(c);
      }
    }

    // Left & Right side walls (semi-open skeleton look with translucent side glass)
    const pillarGeo = new THREE.BoxGeometry(wallT, RACK_INTERIOR_H + 0.06, wallT);
    disposables.push(pillarGeo);
    for (const px of [-RACK_W / 2 + wallT / 2, RACK_W / 2 - wallT / 2]) {
      for (const pz of [-RACK_D / 2 + wallT / 2, RACK_D / 2 - wallT / 2]) {
        const pillar = new THREE.Mesh(pillarGeo, steelMat);
        pillar.position.set(px, 0, pz);
        rackGroup.add(pillar);
      }
    }

    const sideGlassGeo = new THREE.BoxGeometry(0.014, RACK_INTERIOR_H - 0.04, RACK_D - 0.12);
    const sideGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.34,
      roughness: 0.3,
      metalness: 0.2,
    });
    disposables.push(sideGlassGeo, sideGlassMat);
    for (const sx of [-RACK_W / 2 + 0.018, RACK_W / 2 - 0.018]) {
      const sg = new THREE.Mesh(sideGlassGeo, sideGlassMat);
      sg.position.set(sx, 0, 0);
      rackGroup.add(sg);
    }

    // Rear perforated door + vertical PDU strips inside rear
    const backDoorGeo = new THREE.BoxGeometry(RACK_W - 0.06, RACK_INTERIOR_H, 0.024);
    const backDoorMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.6,
      roughness: 0.5,
      transparent: true,
      opacity: 0.82,
    });
    const backDoor = new THREE.Mesh(backDoorGeo, backDoorMat);
    backDoor.position.set(0, 0, -RACK_D / 2 + 0.02);
    rackGroup.add(backDoor);
    disposables.push(backDoorGeo, backDoorMat);

    // Rear Vertical PDU bars (Left = Amber Power A, Right = Cyan Power B)
    const pduGeo = new THREE.BoxGeometry(0.06, RACK_INTERIOR_H * 0.88, 0.05);
    const pduMatA = new THREE.MeshStandardMaterial({ color: 0xb45309, emissive: 0x451a03, roughness: 0.4 });
    const pduMatB = new THREE.MeshStandardMaterial({ color: 0x0e7490, emissive: 0x083344, roughness: 0.4 });
    const pduA = new THREE.Mesh(pduGeo, pduMatA);
    pduA.position.set(-RACK_W / 2 + 0.11, 0, -RACK_D / 2 + 0.1);
    const pduB = new THREE.Mesh(pduGeo, pduMatB);
    pduB.position.set(RACK_W / 2 - 0.11, 0, -RACK_D / 2 + 0.1);
    rackGroup.add(pduA, pduB);
    disposables.push(pduGeo, pduMatA, pduMatB);

    // EIA-310 Left & Right U-Numbered Mounting Rails
    const INNER_W = RACK_W - 0.28;
    const RAIL_W = 0.085;
    const FRONT_RAIL_Z = RACK_D / 2 - 0.095;
    const railTex = createRailLabelsTexture(totalU);
    const railLabelMat = new THREE.MeshBasicMaterial({ map: railTex });
    const railStripGeo = new THREE.BoxGeometry(RAIL_W, RACK_INTERIOR_H, 0.028);
    const railFaceGeo = new THREE.PlaneGeometry(RAIL_W, RACK_INTERIOR_H);
    disposables.push(railTex, railLabelMat, railStripGeo, railFaceGeo);

    for (const rx of [-INNER_W / 2 - RAIL_W / 2, INNER_W / 2 + RAIL_W / 2]) {
      const strip = new THREE.Mesh(railStripGeo, railMat);
      strip.position.set(rx, 0, FRONT_RAIL_Z);
      rackGroup.add(strip);

      const labelPlane = new THREE.Mesh(railFaceGeo, railLabelMat);
      labelPlane.position.set(rx, 0, FRONT_RAIL_Z + 0.016);
      rackGroup.add(labelPlane);
    }

    // Swinging Glass Front Door (Pivot at Left Front Edge)
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-RACK_W / 2 + 0.02, 0, RACK_D / 2 + 0.01);
    rackGroup.add(doorPivot);

    const doorGlassGeo = new THREE.BoxGeometry(RACK_W - 0.06, RACK_INTERIOR_H - 0.02, 0.018);
    const doorGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.26,
      roughness: 0.12,
      metalness: 0.1,
    });
    const doorGlass = new THREE.Mesh(doorGlassGeo, doorGlassMat);
    doorGlass.position.set(RACK_W / 2 - 0.02, 0, 0);
    doorPivot.add(doorGlass);

    const doorFrameGeo = new THREE.BoxGeometry(0.045, RACK_INTERIOR_H, 0.028);
    const doorLeftBar = new THREE.Mesh(doorFrameGeo, steelMat);
    doorLeftBar.position.set(0.02, 0, 0);
    const doorRightBar = new THREE.Mesh(doorFrameGeo, steelMat);
    doorRightBar.position.set(RACK_W - 0.06, 0, 0);
    const handleGeo = new THREE.BoxGeometry(0.028, 0.24, 0.035);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8, roughness: 0.25 });
    const doorHandle = new THREE.Mesh(handleGeo, handleMat);
    doorHandle.position.set(RACK_W - 0.07, 0, 0.025);
    doorPivot.add(doorLeftBar, doorRightBar, doorHandle);
    disposables.push(doorGlassGeo, doorGlassMat, doorFrameGeo, handleGeo, handleMat);

    // Build Interactive Raycast Targets for Empty Slots + Solid Equipment Boxes
    const interactiveMeshes: THREE.Object3D[] = [];
    const ledMeshes: Array<{ mesh: THREE.Mesh; speed: number; offset: number }> = [];

    const unitCenterY = (startU: number, size: number) =>
      BASE_BOTTOM_Y + (startU - 1 + size / 2) * U_HEIGHT;

    // 1. Render Installed / Reserved / Maintenance Units
    const chDepth = RACK_D - 0.28;
    const ledGeo = new THREE.SphereGeometry(0.012, 8, 8);
    disposables.push(ledGeo);

    for (const slot of rack.slots) {
      const isHighlight =
        slot.id === highlightedSlotId || slot.id === selectedSlotId;
      const boxH = Math.max(0.04, slot.unit_size * U_HEIGHT - 0.006);
      const bodyGeo = new THREE.BoxGeometry(INNER_W - 0.015, boxH, chDepth);
      const chassisMat = new THREE.MeshStandardMaterial({
        color: slot.status === "Reserved" ? 0x3a2a12 : 0x1e293b,
        metalness: 0.65,
        roughness: 0.35,
      });

      const faceplateTex = createFaceplateTexture(slot, isHighlight);
      const faceMat = new THREE.MeshStandardMaterial({
        map: faceplateTex,
        metalness: 0.25,
        roughness: 0.45,
        emissive: isHighlight ? new THREE.Color(0x0ea5e9) : new THREE.Color(0x000000),
        emissiveIntensity: isHighlight ? 0.32 : 0,
      });

      const slotMesh = new THREE.Mesh(bodyGeo, [
        chassisMat, // right
        chassisMat, // left
        chassisMat, // top
        chassisMat, // bottom
        faceMat, // front (+Z)
        darkSteelMat, // back (-Z)
      ]);

      slotMesh.position.set(0, unitCenterY(slot.start_u, slot.unit_size), 0.01);
      slotMesh.userData = { type: "slot", slot };
      rackGroup.add(slotMesh);
      interactiveMeshes.push(slotMesh);

      // Glowing Status LED on front-right
      const ledColor =
        slot.status === "Reserved"
          ? 0xf59e0b
          : slot.status === "Maintenance"
          ? 0xef4444
          : isHighlight
          ? 0x38bdf8
          : 0x10b981;
      const ledMat = new THREE.MeshBasicMaterial({ color: ledColor });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(
        INNER_W / 2 - 0.055,
        unitCenterY(slot.start_u, slot.unit_size) + boxH * 0.2,
        FRONT_RAIL_Z + 0.015
      );
      rackGroup.add(led);
      ledMeshes.push({
        mesh: led,
        speed: slot.status === "Reserved" || isHighlight ? 5 : 1.5,
        offset: slot.start_u * 0.7,
      });

      disposables.push(bodyGeo, chassisMat, faceplateTex, faceMat, ledMat);
    }

    // 2. Render Interactive Empty U-Bay Guides (only unoccupied individual U rows)
    const occupiedMap = new Set<number>();
    for (const s of rack.slots) {
      for (let u = s.start_u; u <= s.end_u; u++) {
        occupiedMap.add(u);
      }
    }

    const emptyGuideGeo = new THREE.BoxGeometry(INNER_W - 0.04, U_HEIGHT - 0.008, chDepth * 0.75);
    const emptyGuideMatBase = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.14,
      wireframe: false,
    });
    const wireEdgeGeo = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(INNER_W - 0.04, U_HEIGHT - 0.012, 0.03)
    );
    const wireEdgeMat = new THREE.LineBasicMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.45,
    });
    disposables.push(emptyGuideGeo, emptyGuideMatBase, wireEdgeGeo, wireEdgeMat);

    for (let u = 1; u <= totalU; u++) {
      if (occupiedMap.has(u)) continue;
      const y = unitCenterY(u, 1);

      const wire = new THREE.LineSegments(wireEdgeGeo, wireEdgeMat);
      wire.position.set(0, y, FRONT_RAIL_Z - 0.02);
      rackGroup.add(wire);

      const bayHit = new THREE.Mesh(emptyGuideGeo, emptyGuideMatBase);
      bayHit.position.set(0, y, 0.05);
      bayHit.userData = { type: "empty", u };
      rackGroup.add(bayHit);
      interactiveMeshes.push(bayHit);
    }

    // 3. Dynamic Preview Boxes (Hover Ghost & Selected Allocation Block)
    const previewBoxGeo = new THREE.BoxGeometry(INNER_W - 0.01, 1, chDepth + 0.03);
    const hoverValidMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.55,
    });
    const hoverBlockedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.55,
    });
    const selectedRangeMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.72,
    });

    const hoverMesh = new THREE.Mesh(previewBoxGeo, hoverValidMat);
    hoverMesh.visible = false;
    rackGroup.add(hoverMesh);

    const selectedMesh = new THREE.Mesh(previewBoxGeo, selectedRangeMat);
    selectedMesh.visible = false;
    rackGroup.add(selectedMesh);

    disposables.push(previewBoxGeo, hoverValidMat, hoverBlockedMat, selectedRangeMat);

    // Raycaster for hover + click
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const updateHoverAtClient = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(interactiveMeshes, false);
      if (hits.length === 0) {
        hoverMesh.visible = false;
        setHoverInfo(null);
        renderer.domElement.style.cursor = "grab";
        return null;
      }

      const hit = hits[0].object;
      const data = hit.userData as
        | { type: "slot"; slot: RackSlotItem }
        | { type: "empty"; u: number };

      if (data.type === "slot") {
        hoverMesh.visible = false;
        const s = data.slot;
        const uLabel = s.start_u === s.end_u ? `U${s.start_u}` : `U${s.start_u}–U${s.end_u}`;
        setHoverInfo({
          title: `${uLabel} · ${s.device_name}`,
          subtitle: `${s.customer_name || s.device_type} • ${s.status}${
            s.serial_number ? ` • SN: ${s.serial_number}` : ""
          }`,
          tone: "info",
        });
        renderer.domElement.style.cursor = "pointer";
        return data;
      }

      // Empty U slot hovered
      const { rack: curRack, mode: curMode, requiredUnits: reqU } = propsRef.current;
      const span = curMode === "select" ? Math.max(1, reqU || 1) : 1;
      const check = isRackRangeFree(curRack.total_u, curRack.slots, data.u, span);

      hoverMesh.visible = true;
      hoverMesh.scale.set(1, span * U_HEIGHT - 0.008, 1);
      hoverMesh.position.set(0, unitCenterY(data.u, span), 0.02);
      hoverMesh.material = check.valid ? hoverValidMat : hoverBlockedMat;

      const endU = data.u + span - 1;
      const uLabel = span === 1 ? `U${data.u}` : `U${data.u}–U${endU}`;
      setHoverInfo({
        title: `${uLabel} (${span}U) — ${check.valid ? "Tersedia" : "Tidak Cukup / Bentrok"}`,
        subtitle: check.valid
          ? curMode === "select"
            ? "Klik untuk menempatkan perangkat pada posisi U ini"
            : "Slot kosong — klik untuk memasang / reservasi unit"
          : check.reason || "Rentang U terhalang perangkat lain",
        tone: check.valid ? "ok" : "blocked",
      });
      renderer.domElement.style.cursor = check.valid ? "pointer" : "not-allowed";
      return { ...data, check };
    };

    const onPointerMove = (e: PointerEvent) => {
      updateHoverAtClient(e.clientX, e.clientY);
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // Was dragging to orbit, ignore click

      const res = updateHoverAtClient(e.clientX, e.clientY);
      if (!res) return;

      const {
        rack: curRack,
        mode: curMode,
        requiredUnits: reqU,
        onSelectSlot: clickSlot,
        onSelectEmptyRange: clickEmpty,
      } = propsRef.current;

      if (res.type === "slot") {
        clickSlot?.(res.slot);
      } else if (res.type === "empty") {
        const span = curMode === "select" ? Math.max(1, reqU || 1) : 1;
        const check = isRackRangeFree(curRack.total_u, curRack.slots, res.u, span);
        if (check.valid) {
          clickEmpty?.(res.u, check.endU);
        }
      }
    };

    const onPointerLeave = () => {
      hoverMesh.visible = false;
      setHoverInfo(null);
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    let rafId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Smooth front door hinge swing
      const targetAngle = doorOpenRef.current ? -Math.PI * 0.62 : 0;
      doorPivot.rotation.y += (targetAngle - doorPivot.rotation.y) * 0.12;

      // Update selected placement block highlight
      const curSelU = propsRef.current.selectedStartU;
      const curSpan = Math.max(1, propsRef.current.requiredUnits || 1);
      if (curSelU && curSelU >= 1) {
        selectedMesh.visible = true;
        selectedMesh.scale.set(1, curSpan * U_HEIGHT - 0.008, 1);
        selectedMesh.position.set(0, unitCenterY(curSelU, curSpan), 0.025);
        selectedRangeMat.emissiveIntensity = 0.45 + Math.sin(t * 4) * 0.18;
      } else {
        selectedMesh.visible = false;
      }

      // Pulse status LEDs gently
      for (const item of ledMeshes) {
        const scale = 0.85 + Math.sin(t * item.speed + item.offset) * 0.28;
        item.mesh.scale.setScalar(scale);
      }

      controls.autoRotate = autoRotateRef.current;
      controls.autoRotateSpeed = 1.4;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      controls.dispose();
      for (const d of disposables) {
        d.dispose();
      }
      renderer.dispose();
    };
  }, [rack, highlightedSlotId, selectedSlotId]);

  if (webglError) {
    return (
      <div
        className={`w-full ${heightClass} rounded-2xl border border-amber-300 dark:border-amber-800 bg-slate-950 text-amber-300 flex flex-col items-center justify-center p-6 text-center`}
      >
        <AlertTriangle className="w-10 h-10 mb-3 text-amber-400" />
        <p className="text-sm font-semibold">{webglError}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
      {/* Three.js Canvas Mount */}
      <div ref={containerRef} className={`w-full ${heightClass} touch-none select-none`} />

      {/* Top Left Camera Presets Toolbar */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-10">
        {(
          [
            { id: "iso", label: "3D Iso" },
            { id: "front", label: "Depan" },
            { id: "side", label: "Samping" },
            { id: "rear", label: "Belakang PDU" },
          ] as Array<{ id: CameraPreset; label: string }>
        ).map((cam) => (
          <button
            key={cam.id}
            type="button"
            onClick={() => cameraPresetFnRef.current?.(cam.id)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-[11px] font-semibold backdrop-blur-md transition flex items-center space-x-1"
          >
            <Eye className="w-3 h-3 text-sky-400" />
            <span>{cam.label}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setDoorOpen((prev) => !prev)}
          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold backdrop-blur-md transition flex items-center space-x-1 ${
            doorOpen
              ? "bg-sky-950/85 border-sky-700 text-sky-300"
              : "bg-slate-900/85 border-slate-700/80 text-slate-300"
          }`}
          title="Buka / Tutup Pintu Depan Cabinet Rack"
        >
          {doorOpen ? <DoorOpen className="w-3.5 h-3.5" /> : <DoorClosed className="w-3.5 h-3.5" />}
          <span>{doorOpen ? "Tutup Pintu" : "Buka Pintu"}</span>
        </button>

        <button
          type="button"
          onClick={() => setAutoRotate((prev) => !prev)}
          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold backdrop-blur-md transition flex items-center space-x-1 ${
            autoRotate
              ? "bg-emerald-950/85 border-emerald-700 text-emerald-300"
              : "bg-slate-900/85 border-slate-700/80 text-slate-300"
          }`}
          title="Putar 3D Otomatis"
        >
          <RefreshCw className={`w-3 h-3 ${autoRotate ? "animate-spin" : ""}`} />
          <span>Auto-Rotate</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAutoRotate(false);
            cameraPresetFnRef.current?.("iso");
          }}
          className="p-1.5 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-300 border border-slate-700/80 backdrop-blur-md transition"
          title="Reset Kamera"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom Legend Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/85 border border-slate-800 text-[11px] text-slate-300 backdrop-blur-md">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            <span>Terisi (Occupied)</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span>Dipesan (Reserved)</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
            <span>Dipilih (Selected)</span>
          </span>
          <span className="text-slate-400 hidden sm:inline">
            • Drag untuk putar 360°, Scroll zoom, Klik kanan pan
          </span>
        </div>

        {hoverInfo && (
          <div
            className={`px-3.5 py-2 rounded-xl border text-xs backdrop-blur-md shadow-lg max-w-sm ${
              hoverInfo.tone === "ok"
                ? "bg-emerald-950/90 border-emerald-700 text-emerald-100"
                : hoverInfo.tone === "blocked"
                ? "bg-rose-950/90 border-rose-700 text-rose-100"
                : "bg-slate-900/95 border-slate-700 text-slate-100"
            }`}
          >
            <p className="font-bold truncate">{hoverInfo.title}</p>
            <p className="text-[11px] opacity-85 truncate">{hoverInfo.subtitle}</p>
          </div>
        )}
      </div>
    </div>
  );
}

