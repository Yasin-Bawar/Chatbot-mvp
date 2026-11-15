"use client";

import { Pause, Play, Tags } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { buildMolecule, elementInfo, type Vec3 } from "@/lib/visuals/molecules";
import type { MoleculeSpec } from "@/lib/visuals/types";
import { Markdown } from "@/components/markdown/Markdown";
import { createStage, NoWebGLError, type Stage } from "./stage";
import { VisualError } from "./VisualError";

const UP = new THREE.Vector3(0, 1, 0);

/** A cylinder from a to b (two halves, each in its atom's colour). */
function addBond(group: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, colorA: string, colorB: string, radius: number, opacity = 1) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  for (const [from, to, color] of [
    [a, mid, colorA],
    [mid, b, colorB],
  ] as const) {
    const dir = to.clone().sub(from);
    const length = dir.length();
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, 16, 1),
      new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05, transparent: opacity < 1, opacity }),
    );
    mesh.position.copy(from).add(dir.multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(UP, to.clone().sub(from).normalize());
    group.add(mesh);
  }
}

/** A direction perpendicular to the bond, in the plane of a neighbouring atom when possible. */
function sideways(a: Vec3, b: Vec3, neighbor: Vec3 | null): THREE.Vector3 {
  const axis = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  let ref = neighbor ? new THREE.Vector3(neighbor[0] - a[0], neighbor[1] - a[1], neighbor[2] - a[2]) : new THREE.Vector3(0, 0, 1);
  if (Math.abs(ref.clone().normalize().dot(axis)) > 0.95) ref = new THREE.Vector3(1, 0, 0);
  if (Math.abs(ref.clone().normalize().dot(axis)) > 0.95) ref = new THREE.Vector3(0, 1, 0);
  return ref.sub(axis.clone().multiplyScalar(ref.dot(axis))).normalize();
}

export default function Molecule({ spec }: { spec: MoleculeSpec }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [labels, setLabels] = useState(true);
  const [spinning, setSpinning] = useState(true);
  const [status, setStatus] = useState<"ready" | "nowebgl" | "error">("ready");
  const molecule = useMemo(() => buildMolecule(spec), [spec]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !molecule) return;
    let stage: Stage;
    try {
      stage = createStage(mount);
    } catch (err) {
      queueMicrotask(() => setStatus(err instanceof NoWebGLError ? "nowebgl" : "error"));
      return;
    }
    stageRef.current = stage;
    const { scene, camera, controls } = stage;

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1e1b4b, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 4, 5);
    camera.add(key);
    const rim = new THREE.DirectionalLight(0xa5b4fc, 1.1);
    rim.position.set(4, -2, -3);
    camera.add(rim);

    const group = new THREE.Group();
    scene.add(group);
    const crystal = molecule.crystal;
    const ballScale = crystal ? 1.35 : 1;
    const positions = molecule.atoms.map((a) => new THREE.Vector3(...a.pos));

    molecule.atoms.forEach((atom, i) => {
      const info = elementInfo(atom.el);
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(info.ball * ballScale, 40, 28),
        new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.32, metalness: 0.06 }),
      );
      sphere.position.copy(positions[i]);
      group.add(sphere);
    });

    const neighbors = molecule.atoms.map(() => [] as number[]);
    for (const [i, j] of molecule.bonds) {
      neighbors[i].push(j);
      neighbors[j].push(i);
    }
    for (const [i, j, order] of molecule.bonds) {
      const ca = elementInfo(molecule.atoms[i].el).color;
      const cb = elementInfo(molecule.atoms[j].el).color;
      if (crystal) {
        addBond(group, positions[i], positions[j], "#c7d2fe", "#c7d2fe", 0.035, 0.55);
        continue;
      }
      const a = positions[i];
      const b = positions[j];
      if (order <= 1) {
        addBond(group, a, b, ca, cb, 0.075);
        continue;
      }
      const other = neighbors[i].find((k) => k !== j) ?? neighbors[j].find((k) => k !== i);
      const side = sideways(molecule.atoms[i].pos, molecule.atoms[j].pos, other !== undefined ? molecule.atoms[other].pos : null);
      const offsets = order === 2 ? [-0.075, 0.075] : [-0.115, 0, 0.115];
      for (const o of offsets) {
        const shift = side.clone().multiplyScalar(o);
        addBond(group, a.clone().add(shift), b.clone().add(shift), ca, cb, 0.05);
      }
    }

    if (!crystal) {
      molecule.atoms.forEach((atom, i) => {
        stage.addLabel(atom.el, positions[i], { className: "visual-label-atom" });
      });
    }

    // Fit the camera to the molecule.
    const radius = Math.max(1, ...positions.map((p) => p.length())) + 0.6;
    const portrait = mount.clientWidth < mount.clientHeight;
    const distance = (radius / Math.tan((camera.fov * Math.PI) / 360)) * (portrait ? 1.35 : 1.05);
    camera.position.set(distance * 0.35, distance * 0.25, distance);
    camera.lookAt(0, 0, 0);
    controls.minDistance = radius * 1.2;
    controls.maxDistance = distance * 2.5;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6;

    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [molecule]);

  useEffect(() => {
    stageRef.current?.setLabelsVisible(labels);
  }, [labels]);
  useEffect(() => {
    if (stageRef.current) stageRef.current.controls.autoRotate = spinning;
  }, [spinning]);

  if (!molecule) return <VisualError kind="error" />;
  if (status !== "ready") return <VisualError kind={status} />;

  const elements = [...new Set(molecule.atoms.map((a) => a.el))];

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="visual-stage" />
      <div className="visual-formula" dir="ltr">
        <Markdown text={`$\\mathrm{${molecule.formula}}$`} />
      </div>
      <div className="visual-legend">
        {elements.map((el) => {
          const info = elementInfo(el);
          return (
            <span key={el} className="visual-legend-item">
              <span className="visual-legend-dot" style={{ background: info.color }} />
              <b dir="ltr">{el}</b>
              {info.name && <span>{info.name}</span>}
            </span>
          );
        })}
      </div>
      <div className="visual-tools">
        <button type="button" onClick={() => setSpinning((s) => !s)} className="visual-tool" aria-pressed={spinning}>
          {spinning ? <Pause className="size-4" /> : <Play className="size-4" />} {spinning ? "توقف چرخش" : "چرخش"}
        </button>
        {!molecule.crystal && (
          <button type="button" onClick={() => setLabels((l) => !l)} className="visual-tool" data-active={labels ? "true" : undefined} aria-pressed={labels}>
            <Tags className="size-4" /> نام اتوم‌ها
          </button>
        )}
      </div>
    </div>
  );
}
