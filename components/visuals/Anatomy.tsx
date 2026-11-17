"use client";

import {
  Activity,
  BicepsFlexed,
  Bone,
  Brain,
  Droplets,
  Hand,
  HeartPulse,
  Pause,
  PersonStanding,
  Play,
  Utensils,
  Wind,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ORGANS, organsOf, SYSTEMS, type BodySystem } from "@/lib/visuals/anatomy";
import type { AnatomySpec } from "@/lib/visuals/types";
import { toFaDigits } from "@/lib/persian";
import { createStage, easeInOut, NoWebGLError, type Label, type Stage } from "./stage";
import { VisualError } from "./VisualError";

/**
 * A real 3D human body (BodyParts3D, built by scripts/build-body-model.mjs):
 * switch body systems, see the organs Homa points out, tap any organ to read
 * what it does.
 */

const MODEL_URL = "/models/human-body.glb";

const ICONS: Record<BodySystem | "all", React.ReactNode> = {
  all: <PersonStanding />,
  digestive: <Utensils />,
  respiratory: <Wind />,
  circulatory: <HeartPulse />,
  nervous: <Brain />,
  urinary: <Droplets />,
  skeleton: <Bone />,
  muscular: <BicepsFlexed />,
  skin: <Hand />,
};

/** Parts that move when "alive" is on (heartbeat, breathing). */
const MOVING = ["heart", "lungs", "diaphragm"];

interface Part {
  key: string;
  geometry: THREE.BufferGeometry;
  color: THREE.Color;
}

// Downloaded and prepared once per visit, shared by every body visual.
let modelPromise: Promise<Part[]> | null = null;
function loadModel(onProgress: (fraction: number) => void): Promise<Part[]> {
  modelPromise ??= new Promise<Part[]>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      MODEL_URL,
      (gltf) => {
        const parts: Part[] = [];
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh || !ORGANS[mesh.name]) return;
          const geometry = mesh.geometry;
          // Positions arrive as compact integers plus a node scale; turn them into plain metres.
          const pos = geometry.getAttribute("position");
          if (!(pos.array instanceof Float32Array)) {
            const out = new Float32Array(pos.count * 3);
            for (let i = 0; i < pos.count; i++) {
              out[i * 3] = pos.getX(i);
              out[i * 3 + 1] = pos.getY(i);
              out[i * 3 + 2] = pos.getZ(i);
            }
            geometry.setAttribute("position", new THREE.BufferAttribute(out, 3));
          }
          geometry.applyMatrix4(mesh.matrixWorld);
          geometry.computeVertexNormals();
          geometry.computeBoundingBox();
          const color = (mesh.material as THREE.MeshStandardMaterial).color.clone();
          parts.push({ key: mesh.name, geometry, color });
        });
        resolve(parts);
      },
      (e) => e.total && onProgress(e.loaded / e.total),
      (err) => {
        modelPromise = null;
        reject(err);
      },
    );
  });
  return modelPromise;
}

type Look = { visible: boolean; opacity: number };

/** How each part looks for the chosen system and the organs pointed out. */
function lookOf(key: string, system: BodySystem | null, highlight: string[]): Look {
  const own = ORGANS[key].system;
  if (key === "skin") return { visible: true, opacity: system === "skin" ? 1 : system === "muscular" ? 0.07 : 0.13 };
  if (own === "muscular") return { visible: system === "muscular", opacity: 1 };
  if (system === null) return { visible: true, opacity: highlight.length && !highlight.includes(key) ? 0.45 : 1 };
  if (system === "skin" || system === "muscular") return { visible: false, opacity: 0 };
  if (own === system) return { visible: true, opacity: highlight.length && !highlight.includes(key) ? 0.4 : 1 };
  // The skeleton stays as a faint frame so students can see where organs sit.
  if (own === "skeleton") return { visible: true, opacity: 0.16 };
  return { visible: false, opacity: 0 };
}

type Mesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

export default function Anatomy({ spec }: { spec: AnatomySpec }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const applyRef = useRef<(system: BodySystem | null, fly: boolean) => void>(() => {});
  const aliveRef = useRef(false);
  const selectedRef = useRef<string | null>(spec.highlight[0] ?? null);
  const [system, setSystem] = useState<BodySystem | null>(spec.system);
  const [selected, setSelected] = useState<string | null>(spec.highlight[0] ?? null);
  const [spinning, setSpinning] = useState(false);
  const [alive, setAlive] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "nowebgl" | "error">("loading");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let stage: Stage;
    try {
      stage = createStage(mount);
    } catch (err) {
      queueMicrotask(() => setStatus(err instanceof NoWebGLError ? "nowebgl" : "error"));
      return;
    }
    stageRef.current = stage;
    const { scene, camera, controls, renderer } = stage;
    let disposed = false;

    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.15;
    controls.maxDistance = 4;
    controls.autoRotateSpeed = 0.8;
    controls.addEventListener("start", () => setSpinning(false));
    camera.near = 0.01;
    camera.far = 20;
    camera.position.set(0.5, 1.2, 2.6);
    controls.target.set(0, 0.95, 0);

    scene.add(new THREE.HemisphereLight("#ffffff", "#b8c2cc", 1.6));
    const key = new THREE.DirectionalLight("#ffffff", 1.5);
    key.position.set(0.6, 1, 1);
    camera.add(key);

    const meshes = new Map<string, Mesh>();
    // Heart, lungs and diaphragm sit in a pivot at their own centre, so they can beat and breathe.
    const pivots = new Map<string, THREE.Group>();
    const labels: Label[] = [];
    let tapLabel: Label | null = null;
    let tapUntil = 0;
    let flight: { from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; start: number } | null = null;
    let time = 0;
    let beat = 0;

    /** Front-surface point of a part, where its name goes. */
    const anchorOf = (k: string) => {
      const box = meshes.get(k)!.geometry.boundingBox!;
      const c = box.getCenter(new THREE.Vector3());
      return new THREE.Vector3(c.x, c.y, box.max.z * 0.6 + c.z * 0.4);
    };

    const apply = (sys: BodySystem | null, fly: boolean) => {
      const highlight = spec.highlight;
      for (const [k, mesh] of meshes) {
        const look = lookOf(k, sys, highlight);
        mesh.visible = look.visible && look.opacity > 0;
        const m = mesh.material;
        m.opacity = look.opacity;
        m.transparent = look.opacity < 1;
        m.depthWrite = look.opacity >= 1;
        mesh.renderOrder = k === "skin" ? 3 : look.opacity < 1 ? 2 : 0;
        m.needsUpdate = true;
      }
      // Names: the organs pointed out, or every organ of a small system.
      for (const l of labels) l.el.remove();
      labels.length = 0;
      const named = highlight.length ? highlight : sys && !["skin", "muscular"].includes(sys) ? organsOf(sys) : [];
      for (const k of named) {
        if (!meshes.get(k)?.visible) continue;
        labels.push(stage.addLabel(ORGANS[k].name, anchorOf(k), { className: "visual-label-organ", priority: 2 }));
      }
      if (!fly) return;
      // Fly to what matters: the organs pointed out, else the system, else the whole body.
      const focus = highlight.length
        ? highlight
        : sys && !["skin", "muscular", "skeleton"].includes(sys)
          ? organsOf(sys)
          : [...meshes.keys()].filter((k) => k !== "muscles");
      const box = new THREE.Box3();
      for (const k of focus) if (meshes.has(k)) box.union(meshes.get(k)!.geometry.boundingBox!);
      if (box.isEmpty()) return;
      const centre = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const fit = Math.max(size.y, (size.x * 1.2) / Math.max(0.6, camera.aspect));
      const distance = Math.max(0.35, (fit / 2 / Math.tan((camera.fov * Math.PI) / 360)) * 1.25);
      const dir = new THREE.Vector3(0.28, 0.12, 1).normalize();
      flight = {
        from: camera.position.clone(),
        to: centre.clone().add(dir.multiplyScalar(distance)),
        fromT: controls.target.clone(),
        toT: centre,
        start: time,
      };
    };
    applyRef.current = apply;

    stage.onFrame((dt) => {
      time += dt;
      if (flight) {
        const t = Math.min(1, (time - flight.start) / 1.1);
        const e = easeInOut(t);
        camera.position.lerpVectors(flight.from, flight.to, e);
        controls.target.lerpVectors(flight.fromT, flight.toT, e);
        if (t >= 1) flight = null;
      }
      // Heartbeat (about 72 a minute) and slow breathing.
      if (aliveRef.current) beat += dt;
      const pulse = aliveRef.current ? Math.pow(Math.max(0, Math.sin(beat * Math.PI * 2 * 1.2)), 6) : 0;
      const breath = aliveRef.current ? Math.sin(beat * Math.PI * 0.45) : 0;
      pivots.get("heart")?.scale.setScalar(1 + 0.06 * pulse);
      pivots.get("lungs")?.scale.set(1 + 0.03 * breath, 1 + 0.02 * breath, 1 + 0.04 * breath);
      pivots.get("diaphragm")?.position.setY((pivots.get("diaphragm")!.userData.y as number) - 0.012 * breath);
      // The organs pointed out, and the one tapped, glow softly.
      const glow = 0.12 + 0.1 * Math.sin(time * 3);
      for (const [k, mesh] of meshes) {
        mesh.material.emissiveIntensity = k === selectedRef.current ? 0.32 : spec.highlight.includes(k) ? glow : 0;
      }
      if (tapLabel && time > tapUntil) tapLabel.visible = false;
    });

    // Tap (not drag) on a part to see its name and what it does.
    const raycaster = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      down = null;
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const targets = [...meshes.values()].filter((m) => m.visible && m.material.opacity >= 0.3);
      const hit = raycaster.intersectObjects(targets, false)[0];
      if (!hit) return;
      const name = ORGANS[hit.object.name].name;
      if (!tapLabel) tapLabel = stage.addLabel(name, hit.point, { className: "visual-label-tap", priority: 5 });
      tapLabel.el.textContent = name;
      tapLabel.size = undefined;
      tapLabel.position.copy(hit.point);
      tapLabel.visible = true;
      tapUntil = time + 2.5;
      selectedRef.current = hit.object.name;
      setSelected(hit.object.name);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    loadModel((f) => !disposed && setProgress(f))
      .then((parts) => {
        if (disposed) return;
        for (const part of parts) {
          const material = new THREE.MeshStandardMaterial({
            color: part.color,
            roughness: part.key === "skin" ? 0.6 : 0.55,
            metalness: 0,
            emissive: part.color,
            emissiveIntensity: 0,
            side: part.key === "skin" ? THREE.FrontSide : THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(part.geometry, material);
          mesh.name = part.key;
          meshes.set(part.key, mesh);
          if (MOVING.includes(part.key)) {
            const centre = part.geometry.boundingBox!.getCenter(new THREE.Vector3());
            const pivot = new THREE.Group();
            pivot.position.copy(centre);
            pivot.userData.y = centre.y;
            mesh.position.copy(centre).multiplyScalar(-1);
            pivot.add(mesh);
            pivots.set(part.key, pivot);
            scene.add(pivot);
          } else {
            scene.add(mesh);
          }
        }
        apply(spec.system, true);
        // Start from the end of the flight, not mid-air.
        if (flight) {
          camera.position.copy(flight.to);
          controls.target.copy(flight.toT);
          flight = null;
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });

    return () => {
      disposed = true;
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      // The shared geometry stays cached for the next body visual.
      for (const mesh of meshes.values()) mesh.geometry = new THREE.BufferGeometry();
      stage.dispose();
      stageRef.current = null;
    };
  }, [spec]);

  useEffect(() => {
    if (stageRef.current) stageRef.current.controls.autoRotate = spinning;
  }, [spinning]);
  useEffect(() => {
    aliveRef.current = alive;
  }, [alive]);

  const choose = (next: BodySystem | null) => {
    setSystem(next);
    applyRef.current(next, true);
  };
  const closeInfo = () => {
    selectedRef.current = null;
    setSelected(null);
  };

  if (status === "nowebgl") return <VisualError kind="nowebgl" />;
  if (status === "error") return <VisualError kind="error" />;

  const active = SYSTEMS.find((s) => s.key === system);
  const organ = selected ? ORGANS[selected] : null;

  return (
    <div className="relative h-full w-full bg-[#eef1f5]">
      <div ref={mountRef} className="visual-stage" />
      {status === "loading" && (
        <div className="visual-loading">{progress > 0 ? `${toFaDigits(String(Math.round(progress * 100)))}٪` : "…"}</div>
      )}
      <div className="visual-credit" dir="ltr">
        BodyParts3D © DBCLS · CC BY 4.0
      </div>

      {organ && status === "ready" && (
        <div className="body-info" role="status">
          <button type="button" onClick={closeInfo} className="body-info-close" aria-label="بستن">
            <X />
          </button>
          <b>{organ.name}</b>
          <p>{organ.about}</p>
          <p className="body-info-question">{organ.question}</p>
        </div>
      )}

      <div className="body-systems" role="group" aria-label="سیستم‌های بدن">
        <button
          type="button"
          onClick={() => choose(null)}
          data-active={system === null ? "true" : undefined}
          aria-pressed={system === null}
          aria-label="تمام بدن"
          title="تمام بدن"
        >
          {ICONS.all}
          {system === null && <span>تمام بدن</span>}
        </button>
        {SYSTEMS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => choose(s.key)}
            data-active={system === s.key ? "true" : undefined}
            aria-pressed={system === s.key}
            aria-label={s.name}
            title={s.name}
          >
            {ICONS[s.key]}
            {active?.key === s.key && <span>{s.name}</span>}
          </button>
        ))}
      </div>
      <div className="visual-tools body-tools">
        <button
          type="button"
          onClick={() => setSpinning((x) => !x)}
          className="visual-icon-btn"
          aria-pressed={spinning}
          aria-label={spinning ? "توقف چرخش" : "چرخش"}
        >
          {spinning ? <Pause /> : <Play />}
        </button>
        <button
          type="button"
          onClick={() => setAlive((x) => !x)}
          className="visual-icon-btn"
          data-active={alive ? "true" : undefined}
          aria-pressed={alive}
          aria-label="تپش قلب و تنفس"
          title="تپش قلب و تنفس"
        >
          <Activity />
        </button>
      </div>
    </div>
  );
}
