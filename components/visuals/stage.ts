import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * A small three.js "stage" shared by the globe and the molecule viewer:
 * renderer sized to its container, orbit controls (drag / pinch), a render
 * loop that pauses when the tab is hidden, HTML labels that follow 3D points,
 * and full cleanup.
 */

export interface Label {
  el: HTMLDivElement;
  position: THREE.Vector3;
  /** For points on a sphere around the origin: hide the label on the far side. */
  surface?: boolean;
  visible: boolean;
  /** Higher wins when labels overlap (the other one is hidden). */
  priority: number;
  size?: { w: number; h: number };
}

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  onFrame: (fn: (dt: number, time: number) => void) => void;
  addLabel: (text: string, position: THREE.Vector3, opts?: { className?: string; surface?: boolean; priority?: number }) => Label;
  setLabelsVisible: (visible: boolean) => void;
  dispose: () => void;
}

export class NoWebGLError extends Error {}

export function createStage(container: HTMLDivElement): Stage {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    throw new NoWebGLError("WebGL is not available");
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  const labelLayer = document.createElement("div");
  labelLayer.className = "visual-labels";
  container.appendChild(labelLayer);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
  scene.add(camera);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;

  let width = 1;
  let height = 1;
  const resize = () => {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = `${width}px`;
    renderer.domElement.style.height = `${height}px`;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const frameFns: ((dt: number, time: number) => void)[] = [];
  const labels: Label[] = [];
  let labelsVisible = true;
  const v = new THREE.Vector3();
  const toCamera = new THREE.Vector3();

  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const updateLabels = () => {
    placed.length = 0;
    for (const label of labels) {
      let show = labelsVisible && label.visible;
      if (show && label.surface) {
        toCamera.copy(camera.position).sub(label.position);
        // Hide labels on the far side and close to the edge, where they would pile up.
        show = toCamera.dot(label.position) > 0.35 * label.position.length() * toCamera.length();
      }
      v.copy(label.position).project(camera);
      if (show && (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1)) show = false;
      if (!show) {
        if (label.el.style.opacity !== "0") label.el.style.opacity = "0";
        continue;
      }
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (-v.y * 0.5 + 0.5) * height;
      // Skip a label that would cover a more important one.
      label.size ??= { w: label.el.offsetWidth, h: label.el.offsetHeight };
      const box = { x: x - label.size.w / 2, y: y - label.size.h / 2, w: label.size.w, h: label.size.h };
      if (placed.some((o) => box.x < o.x + o.w + 2 && o.x < box.x + box.w + 2 && box.y < o.y + o.h && o.y < box.y + box.h)) {
        if (label.el.style.opacity !== "0") label.el.style.opacity = "0";
        continue;
      }
      placed.push(box);
      label.el.style.opacity = "1";
      label.el.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  };

  let raf = 0;
  let last = performance.now();
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const fn of frameFns) fn(dt, now / 1000);
    controls.update();
    renderer.render(scene, camera);
    updateLabels();
  };
  raf = requestAnimationFrame(loop);

  return {
    scene,
    camera,
    renderer,
    controls,
    onFrame: (fn) => frameFns.push(fn),
    addLabel(text, position, opts = {}) {
      const el = document.createElement("div");
      el.className = `visual-label ${opts.className ?? ""}`;
      el.textContent = text;
      el.style.opacity = "0";
      labelLayer.appendChild(el);
      const label: Label = { el, position: position.clone(), surface: opts.surface, visible: true, priority: opts.priority ?? 0 };
      labels.push(label);
      labels.sort((a, b) => b.priority - a.priority);
      return label;
    },
    setLabelsVisible(visible) {
      labelsVisible = visible;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const m of mats) {
          for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labelLayer.remove();
    },
  };
}

/** Smooth start and stop for camera flights. */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
