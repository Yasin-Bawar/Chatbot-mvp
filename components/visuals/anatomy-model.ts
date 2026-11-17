import * as THREE from "three";
import { BODY_PARTS, type BodyPoint } from "@/lib/visuals/anatomy";

/** A lightweight, bundled teaching model; intentionally schematic, not a medical mesh. */
export function createBodyModel() {
  const root = new THREE.Group();
  const shell = new THREE.Group();
  root.add(shell);
  const parts = new Map<string, THREE.Group>();
  for (const part of BODY_PARTS) {
    const group = new THREE.Group();
    group.userData.partId = part.id;
    parts.set(part.id, group);
    root.add(group);
  }
  const material = (color: string, opacity = 1) => new THREE.MeshStandardMaterial({
    color, roughness: 0.58, transparent: opacity < 1, opacity, depthWrite: opacity === 1,
  });
  const skin = material("#93b8b4", 0.13);
  const materials = new Map(BODY_PARTS.map((part) => [part.id, material(part.color)]));
  const sphereGeometry = new THREE.SphereGeometry(1, 24, 18);
  function ellipsoid(group: THREE.Group, at: BodyPoint, scale: BodyPoint, mat: THREE.MeshStandardMaterial, tilt = 0) {
    const mesh = new THREE.Mesh(sphereGeometry, mat);
    mesh.position.set(...at);
    mesh.scale.set(...scale);
    mesh.rotation.z = tilt;
    group.add(mesh);
    return mesh;
  }
  function tube(group: THREE.Group, points: BodyPoint[], radius: number, mat: THREE.MeshStandardMaterial) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(12, points.length * 8), radius, 8, false), mat);
    group.add(mesh);
  }
  const organ = (id: string, at: BodyPoint, scale: BodyPoint, tilt = 0) =>
    ellipsoid(parts.get(id)!, at, scale, materials.get(id)!, tilt);
  const path = (id: string, points: BodyPoint[], radius: number) => tube(parts.get(id)!, points, radius, materials.get(id)!);

  // Front is +z; the body's anatomical right is -x in the front view.
  ellipsoid(shell, [0, 2.58, 0], [0.43, 0.53, 0.36], skin);
  ellipsoid(shell, [0, 1.98, 0], [0.2, 0.28, 0.21], skin);
  ellipsoid(shell, [0, 1.04, 0], [0.81, 0.99, 0.4], skin);
  ellipsoid(shell, [0, -0.18, 0], [0.65, 0.8, 0.37], skin);
  ellipsoid(shell, [0, -0.98, 0], [0.65, 0.43, 0.38], skin);
  for (const side of [-1, 1]) {
    tube(shell, [[side * 0.66, 1.63, 0], [side * 1.02, 0.82, 0], [side * 1.22, 0.12, 0]], 0.17, skin);
    tube(shell, [[side * 1.22, 0.12, 0], [side * 1.35, -0.4, 0.04], [side * 1.42, -0.83, 0.04]], 0.12, skin);
    ellipsoid(shell, [side * 1.43, -1, 0.04], [0.13, 0.24, 0.08], skin);
    tube(shell, [[side * 0.35, -1.14, 0], [side * 0.37, -1.85, 0], [side * 0.38, -2.14, 0]], 0.22, skin);
    tube(shell, [[side * 0.38, -2.14, 0], [side * 0.39, -2.65, 0], [side * 0.4, -3.05, 0]], 0.15, skin);
    ellipsoid(shell, [side * 0.4, -3.08, 0.14], [0.18, 0.12, 0.32], skin);
  }

  // Two cerebral hemispheres with shallow surface folds.
  for (const side of [-1, 1]) {
    organ("brain", [side * 0.16, 2.69, 0], [0.19, 0.29, 0.27]);
    for (let i = 0; i < 5; i++) {
      const y = 2.49 + i * 0.085;
      path("brain", [[side * 0.06, y, 0.22], [side * 0.2, y + 0.06, 0.26], [side * 0.3, y, 0.14]], 0.022);
    }
  }
  path("spinal_cord", [[0, 2.4, -0.17], [0, 1.6, -0.22], [0, 0.7, -0.24], [0, -0.5, -0.22]], 0.035);
  for (const side of [-1, 1]) {
    path("nerves", [[0, 1.5, -0.2], [side * 0.7, 1.5, 0], [side * 1.15, 0.4, 0], [side * 1.43, -0.9, 0]], 0.018);
    path("nerves", [[0, -0.4, -0.22], [side * 0.3, -1.1, 0], [side * 0.38, -2, 0], [side * 0.4, -3, 0]], 0.019);
  }

  // Heart lies between lungs, slightly to the body's left.
  organ("heart", [0.13, 1.14, 0.24], [0.22, 0.28, 0.17], 0.3);
  organ("heart", [0.04, 1.34, 0.22], [0.12, 0.13, 0.12]);
  organ("heart", [0.22, 1.32, 0.24], [0.12, 0.12, 0.12]);
  path("arteries", [[0.12, 1.32, 0.12], [0.05, 1.65, 0.12], [-0.17, 1.54, 0.1], [-0.14, -0.73, 0.12]], 0.045);
  path("veins", [[-0.02, 1.23, 0.09], [0.13, 0.9, 0.08], [0.13, -0.73, 0.08]], 0.042);
  for (const id of ["arteries", "veins"]) {
    const offset = id === "arteries" ? -0.045 : 0.045;
    for (const side of [-1, 1]) {
      path(id, [[offset, 1.5, 0.1], [side * 0.7, 1.55, 0.13], [side * 1.1 + offset, 0.4, 0.1], [side * 1.4 + offset, -0.83, 0.1]], 0.022);
      path(id, [[offset, -0.65, 0.1], [side * 0.3 + offset, -1.2, 0.1], [side * 0.38 + offset, -2.1, 0.1], [side * 0.4 + offset, -3, 0.1]], 0.026);
      path(id, [[offset, 1.5, 0.1], [side * 0.13 + offset, 2.03, 0.1], [side * 0.18 + offset, 2.55, 0.1]], 0.022);
    }
  }
  organ("lungs", [-0.43, 1.22, 0], [0.28, 0.54, 0.26], -0.12);
  organ("lungs", [0.44, 1.3, -0.05], [0.24, 0.49, 0.23], 0.14);
  path("trachea", [[0, 2.08, 0.13], [0, 1.65, 0.13], [0, 1.43, 0.11]], 0.065);
  for (const side of [-1, 1]) path("trachea", [[0, 1.47, 0.11], [side * 0.2, 1.25, 0.1], [side * 0.42, 1.11, 0.05]], 0.042);
  organ("diaphragm", [0, 0.63, -0.02], [0.65, 0.12, 0.32]);
  path("esophagus", [[0, 2.09, -0.08], [0, 1.3, -0.15], [0.09, 0.6, -0.08], [0.31, 0.31, 0.15]], 0.045);
  organ("liver", [-0.28, 0.35, 0.12], [0.43, 0.22, 0.25], -0.12);
  organ("stomach", [0.32, 0.13, 0.18], [0.24, 0.29, 0.19], -0.4);
  path("stomach", [[0.36, -0.05, 0.18], [0.18, -0.17, 0.2], [0, -0.23, 0.17]], 0.07);
  const coils: BodyPoint[] = [];
  for (let row = 0; row < 5; row++) {
    const y = -0.26 - row * 0.12;
    const side = row % 2 ? -1 : 1;
    coils.push([-side * 0.28, y, 0.24], [0, y + 0.03, 0.28], [side * 0.28, y, 0.24]);
  }
  path("small_intestine", coils, 0.046);
  path("large_intestine", [[-0.43, -0.85, 0.21], [-0.49, -0.38, 0.21], [-0.4, -0.13, 0.2], [0, -0.16, 0.22], [0.43, -0.21, 0.2], [0.45, -0.68, 0.21], [0.15, -0.88, 0.2], [0, -1.13, -0.04]], 0.073);
  for (const side of [-1, 1]) {
    organ("kidneys", [side * 0.43, side < 0 ? 0.01 : 0.08, -0.2], [0.14, 0.23, 0.12], -side * 0.22);
    path("ureters", [[side * 0.35, 0, -0.14], [side * 0.25, -0.5, -0.13], [side * 0.11, -0.98, 0.08]], 0.024);
  }
  organ("bladder", [0, -1, 0.1], [0.2, 0.19, 0.15]);

  organ("skull", [0, 2.65, 0], [0.39, 0.43, 0.32]);
  organ("skull", [0, 2.29, 0.12], [0.25, 0.15, 0.22]);
  for (let i = 0; i < 19; i++) organ("spine", [0, 2.08 - i * 0.154, -0.28], [0.085, 0.058, 0.085]);
  path("ribcage", [[0, 1.67, 0.31], [0, 1.3, 0.37], [0, 0.9, 0.3]], 0.045);
  for (let i = 0; i < 7; i++) {
    const y = 1.64 - i * 0.135;
    const w = 0.44 + Math.sin(i / 7 * Math.PI) * 0.19;
    for (const side of [-1, 1]) path("ribcage", [[0, y, -0.27], [side * w, y - 0.06, -0.08], [side * w * 0.8, y - 0.14, 0.26], [side * 0.05, y - 0.16, 0.32]], 0.025);
  }
  for (const side of [-1, 1]) {
    path("pelvis", [[0, -0.8, -0.25], [side * 0.5, -0.79, -0.1], [side * 0.5, -1.06, 0.18], [side * 0.23, -1.24, 0.16], [0, -1.1, 0.2]], 0.085);
    path("limb_bones", [[side * 0.7, 1.6, 0], [side * 1.2, 0.15, 0]], 0.065);
    for (const offset of [-0.04, 0.04]) path("limb_bones", [[side * 1.2 + offset, 0.15, 0], [side * 1.42 + offset, -0.83, 0]], 0.033);
    path("limb_bones", [[side * 0.33, -1.16, 0], [side * 0.38, -2.12, 0]], 0.082);
    for (const offset of [-0.045, 0.045]) path("limb_bones", [[side * 0.38 + offset, -2.12, 0], [side * 0.4 + offset, -3.03, 0]], 0.042);
    for (const [x, y] of [[0.7, 1.6], [1.2, 0.15], [0.38, -2.12]]) organ("limb_bones", [side * x, y, 0], [0.1, 0.1, 0.1]);
    path("limb_bones", [[side * 0.4, -3.03, 0], [side * 0.4, -3.08, 0.33]], 0.065);
  }
  return { root, shell, parts, materials };
}
