"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  OpticalOtbItem,
  OtbCoreItem,
  getTiaColorForCore,
  getTiaTubeColorForTray,
} from "@/lib/dcimUtils";
import {
  Eye,
  RotateCcw,
  RefreshCw,
  Layers,
  AlertTriangle,
} from "lucide-react";

interface Otb3DViewerProps {
  otb: OpticalOtbItem;
  mode?: "view" | "select";
  selectedCores?: number[];
  activeCoreNumber?: number | null;
  onClickCore?: (port: OtbCoreItem) => void;
  heightClass?: string;
}

type OtbCameraPreset = "iso" | "front" | "top";

function createOtbHeaderTexture(otb: OpticalOtbItem): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, 768, 96);
    ctx.fillStyle = "#8b5cf6";
    ctx.fillRect(0, 0, 14, 96);

    ctx.fillStyle = "#c4b5fd";
    ctx.font = "bold 30px monospace";
    ctx.fillText(`${otb.code} • ${otb.total_cores} CORE (${otb.connector_type})`, 28, 38);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "20px sans-serif";
    ctx.fillText(`${otb.name} — ${otb.fiber_mode}`.slice(0, 64), 28, 74);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createCoreLabelTexture(coreNumber: number, tiaHex: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 36;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, 64, 36);
    ctx.fillStyle = tiaHex;
    ctx.fillRect(0, 0, 64, 7);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(coreNumber).padStart(2, "0"), 32, 23);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createTrayBadgeTexture(trayNumber: number, tubeLabel: string, tubeHex: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 56;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, 160, 56);
    ctx.fillStyle = tubeHex;
    ctx.fillRect(0, 0, 12, 56);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 20px monospace";
    ctx.fillText(`TRAY ${trayNumber}`, 20, 24);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px sans-serif";
    ctx.fillText(`Tube ${tubeLabel}`, 20, 44);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function Otb3DViewer({
  otb,
  mode = "view",
  selectedCores = [],
  activeCoreNumber = null,
  onClickCore,
  heightClass = "h-[500px]",
}: Otb3DViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const perTray = Math.max(1, otb.cores_per_tray || 12);
  const trayCount = Math.max(1, Math.ceil(otb.total_cores / perTray));

  const [openTrays, setOpenTrays] = useState<number[]>([1]);
  const [autoRotate, setAutoRotate] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [hoverPort, setHoverPort] = useState<OtbCoreItem | null>(null);

  const openTraysRef = useRef(openTrays);
  const autoRotateRef = useRef(autoRotate);
  const selectedSetRef = useRef<Set<number>>(new Set(selectedCores));
  const activeCoreRef = useRef<number | null>(activeCoreNumber);
  const onClickCoreRef = useRef(onClickCore);
  const modeRef = useRef(mode);
  const camPresetRef = useRef<((p: OtbCameraPreset) => void) | null>(null);

  openTraysRef.current = openTrays;
  autoRotateRef.current = autoRotate;
  selectedSetRef.current = new Set(selectedCores);
  activeCoreRef.current = activeCoreNumber;
  onClickCoreRef.current = onClickCore;
  modeRef.current = mode;

  // Ensure tray 1 stays in range when OTB changes
  useEffect(() => {
    const preSelectedTrays = Array.from(
      new Set(
        selectedCores.map((c) => Math.ceil(c / Math.max(1, otb.cores_per_tray || 12)))
      )
    );
    setOpenTrays(preSelectedTrays.length > 0 ? preSelectedTrays : [1]);
  }, [otb.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebglError("Browser/GPU tidak mendukung WebGL 3D. Gunakan matriks core di panel kanan.");
      return;
    }

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 480;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);

    const TRAY_H = 0.24;
    const CHASSIS_W = 2.65;
    const CHASSIS_D = 1.45;
    const CHASSIS_H = trayCount * TRAY_H + 0.24;
    const BOTTOM_Y = -CHASSIS_H / 2;

    const grid = new THREE.GridHelper(10, 20, 0x3b1d6e, 0x172033);
    grid.position.y = BOTTOM_Y - 0.18;
    scene.add(grid);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 60);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 1.4;
    controls.maxDistance = 10;

    const applyPreset = (preset: OtbCameraPreset) => {
      const dist = Math.max(3.2, CHASSIS_H * 1.4 + 1.8);
      controls.target.set(0, 0, 0.18);
      if (preset === "front") {
        camera.position.set(0, 0.15, dist * 1.05);
      } else if (preset === "top") {
        camera.position.set(0.25, dist * 0.92, dist * 0.72);
      } else {
        camera.position.set(dist * 0.56, dist * 0.42, dist * 0.95);
      }
      controls.update();
    };
    camPresetRef.current = applyPreset;
    applyPreset("iso");

    // Lights
    const ambient = new THREE.AmbientLight(0xe0e7ff, 1.0);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(3, 5, 5);
    scene.add(keyLight);

    const purpleRim = new THREE.DirectionalLight(0xa855f7, 0.65);
    purpleRim.position.set(-4, 2, -3);
    scene.add(purpleRim);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const disposables: Array<{ dispose: () => void }> = [];

    const enclosureMat = new THREE.MeshStandardMaterial({
      color: 0x1a2232,
      metalness: 0.72,
      roughness: 0.35,
    });
    const innerChassisMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.55,
      roughness: 0.5,
    });
    const trayFloorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.6,
      roughness: 0.4,
    });
    const earMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.8,
      roughness: 0.3,
    });
    disposables.push(enclosureMat, innerChassisMat, trayFloorMat, earMat);

    // Outer Enclosure Shell (Top, Bottom, Left, Right, Back — Front open for sliding trays)
    const wall = 0.04;
    const topGeo = new THREE.BoxGeometry(CHASSIS_W, wall, CHASSIS_D);
    const sideGeo = new THREE.BoxGeometry(wall, CHASSIS_H, CHASSIS_D);
    const backGeo = new THREE.BoxGeometry(CHASSIS_W, CHASSIS_H, wall);
    const earGeo = new THREE.BoxGeometry(0.12, CHASSIS_H, 0.04);

    const topPlate = new THREE.Mesh(topGeo, enclosureMat);
    topPlate.position.set(0, CHASSIS_H / 2 - wall / 2, 0);
    const botPlate = new THREE.Mesh(topGeo, enclosureMat);
    botPlate.position.set(0, BOTTOM_Y + wall / 2, 0);
    const leftWall = new THREE.Mesh(sideGeo, enclosureMat);
    leftWall.position.set(-CHASSIS_W / 2 + wall / 2, 0, 0);
    const rightWall = new THREE.Mesh(sideGeo, enclosureMat);
    rightWall.position.set(CHASSIS_W / 2 - wall / 2, 0, 0);
    const backWall = new THREE.Mesh(backGeo, innerChassisMat);
    backWall.position.set(0, 0, -CHASSIS_D / 2 + wall / 2);

    const leftEar = new THREE.Mesh(earGeo, earMat);
    leftEar.position.set(-CHASSIS_W / 2 - 0.06, 0, CHASSIS_D / 2 - 0.08);
    const rightEar = new THREE.Mesh(earGeo, earMat);
    rightEar.position.set(CHASSIS_W / 2 + 0.06, 0, CHASSIS_D / 2 - 0.08);

    rootGroup.add(topPlate, botPlate, leftWall, rightWall, backWall, leftEar, rightEar);
    disposables.push(topGeo, sideGeo, backGeo, earGeo);

    // Header nameplate on top front bezel
    const headerTex = createOtbHeaderTexture(otb);
    const headerMat = new THREE.MeshBasicMaterial({ map: headerTex });
    const headerGeo = new THREE.PlaneGeometry(CHASSIS_W - 0.14, 0.14);
    const headerMesh = new THREE.Mesh(headerGeo, headerMat);
    headerMesh.position.set(0, CHASSIS_H / 2 - 0.09, CHASSIS_D / 2 + 0.006);
    rootGroup.add(headerMesh);
    disposables.push(headerTex, headerMat, headerGeo);

    // Side fiber trunk entry cable conduit
    const trunkGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.45, 14);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.6 });
    const trunkLeft = new THREE.Mesh(trunkGeo, trunkMat);
    trunkLeft.rotation.z = Math.PI / 2;
    trunkLeft.position.set(-CHASSIS_W / 2 - 0.16, BOTTOM_Y + 0.22, -0.35);
    rootGroup.add(trunkLeft);
    disposables.push(trunkGeo, trunkMat);

    // Group ports per tray
    const portsByTray = new Map<number, OtbCoreItem[]>();
    for (const p of otb.ports) {
      const list = portsByTray.get(p.tray_number) || [];
      list.push(p);
      portsByTray.set(p.tray_number, list);
    }

    const trayGroups: Array<{ trayNumber: number; group: THREE.Group }> = [];
    const interactivePorts: THREE.Object3D[] = [];
    const portVisualRefs: Array<{
      coreNumber: number;
      status: string;
      ringMesh: THREE.Mesh;
      ringMat: THREE.MeshBasicMaterial;
      patchMesh: THREE.Mesh;
    }> = [];

    const trayFloorGeo = new THREE.BoxGeometry(CHASSIS_W - 0.14, 0.025, CHASSIS_D - 0.14);
    const frontStripGeo = new THREE.BoxGeometry(CHASSIS_W - 0.14, TRAY_H - 0.035, 0.035);
    const spliceHolderGeo = new THREE.BoxGeometry(1.15, 0.04, 0.42);
    const spliceHolderMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.4,
      metalness: 0.4,
    });
    const handleGeo = new THREE.BoxGeometry(0.04, 0.12, 0.05);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.7, roughness: 0.25 });
    const adapterGeo = new THREE.BoxGeometry(0.115, 0.105, 0.09);
    const ledRingGeo = new THREE.RingGeometry(0.056, 0.072, 16);
    const patchPlugGeo = new THREE.BoxGeometry(0.06, 0.06, 0.13);
    const patchYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
    const patchAmberMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
    const labelPlaneGeo = new THREE.PlaneGeometry(0.12, 0.068);
    const badgeGeo = new THREE.PlaneGeometry(0.28, 0.1);

    disposables.push(
      trayFloorGeo,
      frontStripGeo,
      spliceHolderGeo,
      spliceHolderMat,
      handleGeo,
      handleMat,
      adapterGeo,
      ledRingGeo,
      patchPlugGeo,
      patchYellowMat,
      patchAmberMat,
      labelPlaneGeo,
      badgeGeo
    );

    const startTopY = CHASSIS_H / 2 - 0.25;

    for (let t = 1; t <= trayCount; t++) {
      const trayPorts = (portsByTray.get(t) || []).sort((a, b) => a.core_number - b.core_number);
      const trayY = startTopY - (t - 1) * TRAY_H;
      const trayGroup = new THREE.Group();
      trayGroup.position.set(0, trayY, 0);
      rootGroup.add(trayGroup);
      trayGroups.push({ trayNumber: t, group: trayGroup });

      // Slide-out metal tray plate
      const floor = new THREE.Mesh(trayFloorGeo, trayFloorMat);
      floor.position.set(0, -TRAY_H * 0.36, 0);
      trayGroup.add(floor);

      // Fusion splice organizer tray inside cassette
      const spliceBox = new THREE.Mesh(spliceHolderGeo, spliceHolderMat);
      spliceBox.position.set(0, -TRAY_H * 0.24, -0.2);
      trayGroup.add(spliceBox);

      // Front bulkhead faceplate
      const frontStrip = new THREE.Mesh(frontStripGeo, innerChassisMat);
      frontStrip.position.set(0, 0, CHASSIS_D / 2 - 0.07);
      trayGroup.add(frontStrip);

      // Tray label & pull handle on left
      const tubeInfo = getTiaTubeColorForTray(t);
      const trayBadgeTex = createTrayBadgeTexture(t, tubeInfo.labelId, tubeInfo.hex);
      const trayBadgeMat = new THREE.MeshBasicMaterial({ map: trayBadgeTex });
      const trayBadge = new THREE.Mesh(badgeGeo, trayBadgeMat);
      trayBadge.position.set(-CHASSIS_W / 2 + 0.27, 0, CHASSIS_D / 2 - 0.048);
      trayGroup.add(trayBadge);
      disposables.push(trayBadgeTex, trayBadgeMat);

      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.position.set(CHASSIS_W / 2 - 0.14, 0, CHASSIS_D / 2 - 0.02);
      handle.userData = { type: "tray", trayNumber: t };
      trayGroup.add(handle);
      interactivePorts.push(handle);

      // Render individual fiber ports along the front bulkhead of this tray
      const portsInThisTray = trayPorts.length || perTray;
      const usableW = CHASSIS_W - 0.72;
      const startX = -usableW / 2 + 0.18;
      const stepX = portsInThisTray > 1 ? usableW / portsInThisTray : 0.18;

      trayPorts.forEach((port, idx) => {
        const px = startX + idx * stepX;
        const tia = getTiaColorForCore(port.core_number, perTray);

        // TIA-598 Colored Adapter Housing
        const adapterMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(tia.hex),
          metalness: 0.25,
          roughness: 0.42,
        });
        const adapterMesh = new THREE.Mesh(adapterGeo, adapterMat);
        adapterMesh.position.set(px, -0.015, CHASSIS_D / 2 - 0.045);
        adapterMesh.userData = { type: "port", port };
        trayGroup.add(adapterMesh);
        interactivePorts.push(adapterMesh);

        // Internal colored fiber pigtail curve inside open tray (connecting adapter to splice cassette)
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(px, -0.025, CHASSIS_D / 2 - 0.1),
          new THREE.Vector3(px * 0.65, -0.045, 0.12),
          new THREE.Vector3((idx - portsInThisTray / 2) * 0.06, -0.045, -0.2)
        );
        const tubeGeo = new THREE.TubeGeometry(curve, 10, 0.008, 6, false);
        const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(tia.hex) });
        const pigtail = new THREE.Mesh(tubeGeo, tubeMat);
        trayGroup.add(pigtail);

        // Crisp core number label above adapter
        const lblTex = createCoreLabelTexture(port.core_number, tia.hex);
        const lblMat = new THREE.MeshBasicMaterial({ map: lblTex });
        const lblMesh = new THREE.Mesh(labelPlaneGeo, lblMat);
        lblMesh.position.set(px, 0.068, CHASSIS_D / 2 - 0.048);
        trayGroup.add(lblMesh);

        // Glowing Selection / Status Ring around adapter front face
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ledRingGeo, ringMat);
        ringMesh.position.set(px, -0.015, CHASSIS_D / 2 + 0.005);
        trayGroup.add(ringMesh);

        // Protruding optical patch cord plug when Used or Reserved
        const patchMat = port.status === "Reserved" ? patchAmberMat : patchYellowMat;
        const patchMesh = new THREE.Mesh(patchPlugGeo, patchMat);
        patchMesh.position.set(px, -0.015, CHASSIS_D / 2 + 0.045);
        patchMesh.visible = port.status === "Used" || port.status === "Reserved";
        trayGroup.add(patchMesh);

        portVisualRefs.push({
          coreNumber: port.core_number,
          status: port.status,
          ringMesh,
          ringMat,
          patchMesh,
        });

        disposables.push(adapterMat, tubeGeo, tubeMat, lblTex, lblMat, ringMat);
      });
    }

    // Raycaster for hover + click
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const raycastAt = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(interactivePorts, false);
      if (hits.length === 0) {
        setHoverPort(null);
        renderer.domElement.style.cursor = "grab";
        return null;
      }

      const data = hits[0].object.userData as
        | { type: "port"; port: OtbCoreItem }
        | { type: "tray"; trayNumber: number };

      if (data.type === "port") {
        setHoverPort(data.port);
        const clickable =
          modeRef.current === "view" ||
          data.port.status === "Available" ||
          selectedSetRef.current.has(data.port.core_number);
        renderer.domElement.style.cursor = clickable ? "pointer" : "not-allowed";
      } else {
        setHoverPort(null);
        renderer.domElement.style.cursor = "pointer";
      }
      return data;
    };

    const onPointerMove = (e: PointerEvent) => {
      raycastAt(e.clientX, e.clientY);
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;

      const hit = raycastAt(e.clientX, e.clientY);
      if (!hit) return;

      if (hit.type === "tray") {
        setOpenTrays((prev) =>
          prev.includes(hit.trayNumber)
            ? prev.filter((x) => x !== hit.trayNumber)
            : [...prev, hit.trayNumber]
        );
      } else if (hit.type === "port") {
        onClickCoreRef.current?.(hit.port);
      }
    };

    const onPointerLeave = () => {
      setHoverPort(null);
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

      // Animate tray drawer slide out
      const curOpen = openTraysRef.current;
      for (const tg of trayGroups) {
        const targetZ = curOpen.includes(tg.trayNumber) ? 0.62 : 0;
        tg.group.position.z += (targetZ - tg.group.position.z) * 0.14;
      }

      // Sync port ring colors + pulse selected ports dynamically
      const selSet = selectedSetRef.current;
      const actCore = activeCoreRef.current;
      for (const pv of portVisualRefs) {
        const isSelected = selSet.has(pv.coreNumber) || actCore === pv.coreNumber;
        if (isSelected) {
          pv.ringMat.color.setHex(0x38bdf8);
          const s = 1.08 + Math.sin(t * 6) * 0.18;
          pv.ringMesh.scale.setScalar(s);
          pv.patchMesh.visible = true;
        } else {
          pv.ringMesh.scale.setScalar(1);
          if (pv.status === "Used") {
            pv.ringMat.color.setHex(0x8b5cf6);
          } else if (pv.status === "Reserved") {
            pv.ringMat.color.setHex(0xf59e0b);
          } else if (pv.status === "Damaged" || pv.status === "Maintenance") {
            pv.ringMat.color.setHex(0xef4444);
          } else {
            pv.ringMat.color.setHex(0x10b981);
          }
          pv.patchMesh.visible = pv.status === "Used" || pv.status === "Reserved";
        }
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
  }, [otb, trayCount, perTray]);

  const toggleTray = (trayNum: number) => {
    setOpenTrays((prev) =>
      prev.includes(trayNum) ? prev.filter((x) => x !== trayNum) : [...prev, trayNum]
    );
  };

  const allTraysOpen = openTrays.length === trayCount;

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
      <div ref={containerRef} className={`w-full ${heightClass} touch-none select-none`} />

      {/* Top Left Camera & Tray Slide Controls */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 z-10 pointer-events-none">
        <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
          {(
            [
              { id: "iso", label: "3D Iso" },
              { id: "front", label: "Panel Depan" },
              { id: "top", label: "Tampak Atas" },
            ] as Array<{ id: OtbCameraPreset; label: string }>
          ).map((cam) => (
            <button
              key={cam.id}
              type="button"
              onClick={() => camPresetRef.current?.(cam.id)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-[11px] font-semibold backdrop-blur-md transition flex items-center space-x-1"
            >
              <Eye className="w-3 h-3 text-purple-400" />
              <span>{cam.label}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() =>
              setOpenTrays(
                allTraysOpen ? [] : Array.from({ length: trayCount }, (_, i) => i + 1)
              )
            }
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold backdrop-blur-md transition flex items-center space-x-1 ${
              allTraysOpen
                ? "bg-purple-950/90 border-purple-700 text-purple-200"
                : "bg-slate-900/85 border-slate-700/80 text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{allTraysOpen ? "Tutup Semua Tray" : "Tarik Semua Tray"}</span>
          </button>

          <button
            type="button"
            onClick={() => setAutoRotate((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold backdrop-blur-md transition flex items-center space-x-1 ${
              autoRotate
                ? "bg-emerald-950/85 border-emerald-700 text-emerald-300"
                : "bg-slate-900/85 border-slate-700/80 text-slate-300"
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${autoRotate ? "animate-spin" : ""}`} />
            <span>Auto-Rotate</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAutoRotate(false);
              camPresetRef.current?.("iso");
            }}
            className="p-1.5 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-300 border border-slate-700/80 backdrop-blur-md transition"
            title="Reset Kamera"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Individual Tray Drawer Tabs */}
        <div className="flex flex-wrap items-center gap-1 pointer-events-auto">
          {Array.from({ length: trayCount }, (_, i) => i + 1).map((t) => {
            const isOpen = openTrays.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTray(t)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold border transition backdrop-blur-md ${
                  isOpen
                    ? "bg-purple-600/90 border-purple-400 text-white shadow-sm"
                    : "bg-slate-900/80 border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
                title={`Tarik/Masukkan Cassette Tray ${t}`}
              >
                T{t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Legend + Hover Port HUD */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/85 border border-slate-800 text-[11px] text-slate-300 backdrop-blur-md">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            <span>Available</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
            <span>Selected</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span>Reserved</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />
            <span>Used</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span>Damaged</span>
          </span>
        </div>

        {hoverPort && (
          <div className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900/95 text-slate-100 text-xs backdrop-blur-md shadow-lg max-w-sm">
            <p className="font-bold">
              Core #{hoverPort.core_number} (Tray {hoverPort.tray_number}) • Warna {hoverPort.core_color}
            </p>
            <p className="text-[11px] text-slate-300 truncate">
              Status: <b>{hoverPort.status}</b>
              {hoverPort.customer_name ? ` • ${hoverPort.customer_name}` : ""}
              {hoverPort.attenuation_db !== null && hoverPort.attenuation_db !== undefined
                ? ` • Loss ${hoverPort.attenuation_db} dB`
                : ""}
            </p>
            {hoverPort.route_pair && (
              <p className="text-[11px] text-purple-300 truncate">{hoverPort.route_pair}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

