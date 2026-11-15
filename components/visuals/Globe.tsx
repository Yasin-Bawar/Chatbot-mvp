"use client";

import { Crosshair, Tags } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Feature, Geometry, MultiPolygon, Polygon, Position } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { countryLabel, greatCircle, latLonToVector, resolveCountry } from "@/lib/visuals/geo";
import type { GlobeSpec } from "@/lib/visuals/types";
import { createStage, easeInOut, NoWebGLError, type Stage } from "./stage";
import { VisualError } from "./VisualError";

const TEX_W = 2048;
const TEX_H = 1024;
const HIGHLIGHT_COLORS = ["#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#ec4899", "#06b6d4", "#f97316", "#6366f1"];
const LAND_COLORS = ["#cfe3b4", "#e8d9b0", "#d6e6c0", "#efe0bb", "#c5dcac", "#e2d2a6", "#d9e4b8"];
const DISTANCE = [0, 3.1, 2.35, 1.8, 1.42];

type CountryFeature = Feature<Polygon | MultiPolygon, { name: string }>;

function polygonsOf(geometry: Geometry): Position[][][] {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

/** Longitudes made continuous (no jump at ±180°), so rings can be filled. */
function unwrap(ring: Position[]): Position[] {
  const out: Position[] = [];
  let offset = 0;
  let prev = ring[0]?.[0] ?? 0;
  for (const [lon, lat] of ring) {
    if (lon - prev > 180) offset -= 360;
    else if (prev - lon > 180) offset += 360;
    prev = lon;
    out.push([lon + offset, lat]);
  }
  return out;
}

const px = (lon: number) => ((lon + 180) / 360) * TEX_W;
const py = (lat: number) => ((90 - lat) / 180) * TEX_H;

function traceRing(ctx: CanvasRenderingContext2D, ring: Position[], shift: number) {
  ring.forEach(([lon, lat], i) => {
    const x = px(lon) + shift;
    const y = py(lat);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/** Draws a flat (equirectangular) political map that is wrapped around the sphere. */
function drawMap(countries: CountryFeature[], highlighted: Map<string, string>): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d")!;

  const ocean = ctx.createLinearGradient(0, 0, 0, TEX_H);
  ocean.addColorStop(0, "#0d3a66");
  ocean.addColorStop(0.5, "#1a64a6");
  ocean.addColorStop(1, "#0d3a66");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // Latitude / longitude grid every 15°.
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 15) {
    ctx.beginPath();
    ctx.moveTo(px(lon), 0);
    ctx.lineTo(px(lon), TEX_H);
    ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    ctx.beginPath();
    ctx.moveTo(0, py(lat));
    ctx.lineTo(TEX_W, py(lat));
    ctx.stroke();
  }
  // Equator.
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(0, py(0));
  ctx.lineTo(TEX_W, py(0));
  ctx.stroke();
  ctx.setLineDash([]);

  const dim = highlighted.size > 0;
  const paint = (feature: CountryFeature, index: number, emphasis: boolean) => {
    const name = feature.properties.name;
    const color = highlighted.get(name);
    if (emphasis !== Boolean(color)) return;
    ctx.beginPath();
    for (const polygon of polygonsOf(feature.geometry)) {
      for (const raw of polygon) {
        const ring = unwrap(raw);
        const xs = ring.map(([lon]) => px(lon));
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        traceRing(ctx, ring, 0);
        if (minX < 0) traceRing(ctx, ring, TEX_W);
        if (maxX > TEX_W) traceRing(ctx, ring, -TEX_W);
      }
    }
    if (name === "Antarctica") ctx.fillStyle = "#eef2f7";
    else ctx.fillStyle = color ?? LAND_COLORS[index % LAND_COLORS.length];
    ctx.globalAlpha = color || !dim ? 1 : 0.82;
    ctx.fill("evenodd");
    ctx.globalAlpha = 1;
    ctx.lineJoin = "round";
    ctx.strokeStyle = color ? "#ffffff" : "rgba(92,72,40,0.5)";
    ctx.lineWidth = color ? 2.6 : 1.1;
    ctx.stroke();
  };
  countries.forEach((f, i) => paint(f, i, false));
  countries.forEach((f, i) => paint(f, i, true));
  return canvas;
}

/** Visual centre of a country: centroid of its largest ring. */
function countryCentre(feature: CountryFeature): { lat: number; lon: number } {
  let best: Position[] = [];
  let bestArea = -1;
  for (const polygon of polygonsOf(feature.geometry)) {
    const ring = unwrap(polygon[0]);
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    if (Math.abs(area) > bestArea) {
      bestArea = Math.abs(area);
      best = ring;
    }
  }
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = best.length - 1; i < best.length; j = i++) {
    const f = best[j][0] * best[i][1] - best[i][0] * best[j][1];
    a += f;
    cx += (best[j][0] + best[i][0]) * f;
    cy += (best[j][1] + best[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) return { lon: best[0]?.[0] ?? 0, lat: best[0]?.[1] ?? 0 };
  let lon = cx / (3 * a);
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return { lon, lat: cy / (3 * a) };
}

const vec = (lat: number, lon: number, r = 1) => new THREE.Vector3(...latLonToVector(lat, lon, r));

function atmosphere(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    vertexShader: `varying vec3 vNormal; varying vec3 vView;
      void main() { vNormal = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vNormal; varying vec3 vView;
      void main() { float rim = 1.0 - max(dot(vNormal, vView), 0.0); float glow = pow(rim, 2.6); gl_FragColor = vec4(0.45, 0.72, 1.0, 1.0) * glow * 1.2; }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1.035, 64, 48), material);
}

function stars(): THREE.Points {
  const count = 1400;
  const positions = new Float32Array(count * 3);
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const z = rand() * 2 - 1;
    const t = rand() * Math.PI * 2;
    const r = 30 + rand() * 30;
    const s = Math.sqrt(1 - z * z);
    positions.set([r * s * Math.cos(t), r * z, r * s * Math.sin(t)], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.11, transparent: true, opacity: 0.75, depthWrite: false }));
}

export default function Globe({ spec }: { spec: GlobeSpec }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const flyRef = useRef<(() => void) | null>(null);
  const [labels, setLabels] = useState(true);
  const [status, setStatus] = useState<"loading" | "ready" | "nowebgl" | "error">("loading");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let stage: Stage;
    try {
      stage = createStage(mount);
    } catch (err) {
      queueMicrotask(() => setStatus(err instanceof NoWebGLError ? "nowebgl" : "error"));
      return;
    }
    stageRef.current = stage;
    const { scene, camera, controls } = stage;
    controls.minDistance = 1.2;
    controls.maxDistance = 5;
    controls.rotateSpeed = 0.45;

    scene.add(stars());
    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(-2.5, 2, 3);
    camera.add(sun);

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 96),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 }),
    );
    // three.js puts longitude −180° at −x; turn the map to match latLonToVector.
    earth.rotation.y = -Math.PI / 2;
    scene.add(earth);
    scene.add(atmosphere());

    // Camera: start a little to the west of the target and fly in.
    const portrait = mount.clientWidth < mount.clientHeight;
    const distance = DISTANCE[Math.round(spec.zoom)] * (portrait ? 1.3 : 1);
    const focus = spec.focus ?? (spec.markers[0] ? { lat: spec.markers[0].lat, lon: spec.markers[0].lon } : null);
    const start = focus ? vec(focus.lat * 0.6 + 8, focus.lon - 70, 4.2) : vec(18, 40, distance + 0.4);
    camera.position.copy(start);
    camera.lookAt(0, 0, 0);
    controls.autoRotate = !focus;
    controls.autoRotateSpeed = 0.5;

    // Flights are timed by the clock (not by frames), so slow phones arrive on time too.
    let flight: { from: THREE.Vector3; to: THREE.Vector3; start: number } | null = null;
    const flyToFocus = () => {
      const to = focus ? vec(focus.lat, focus.lon, distance) : camera.position.clone().setLength(distance);
      flight = { from: camera.position.clone(), to, start: performance.now() };
    };
    flyRef.current = flyToFocus;
    const stopAuto = () => {
      controls.autoRotate = false;
      flight = null;
    };
    controls.addEventListener("start", stopAuto);

    stage.onFrame(() => {
      if (!flight) return;
      const t = Math.min(1, (performance.now() - flight.start) / 1800);
      const k = easeInOut(t);
      const fromDir = flight.from.clone().normalize();
      const toDir = flight.to.clone().normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(fromDir, toDir);
      const dir = fromDir.applyQuaternion(new THREE.Quaternion().slerp(q, k));
      const len = flight.from.length() + (flight.to.length() - flight.from.length()) * k;
      camera.position.copy(dir.multiplyScalar(len));
      camera.lookAt(0, 0, 0);
      if (t >= 1) flight = null;
    });

    // Markers: a dot and a pulsing ring, with a label.
    const pulses: THREE.Mesh[] = [];
    spec.markers.forEach((m, i) => {
      const color = new THREE.Color(m.color ?? "#ef4444");
      const p = vec(m.lat, m.lon, 1.003);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), new THREE.MeshBasicMaterial({ color }));
      dot.position.copy(p);
      scene.add(dot);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.014, 0.019, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.position.copy(vec(m.lat, m.lon, 1.004));
      ring.lookAt(p.clone().multiplyScalar(2));
      ring.userData.phase = i * 0.7;
      scene.add(ring);
      pulses.push(ring);
      stage.addLabel(m.label, vec(m.lat, m.lon, 1.04), { className: "visual-label-marker", surface: true, priority: 2 });
    });
    stage.onFrame((_dt, time) => {
      for (const ring of pulses) {
        const s = 1 + ((time * 0.9 + ring.userData.phase) % 1) * 1.6;
        ring.scale.setScalar(s);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - (s - 1) / 1.6);
      }
    });

    // Routes: glowing arcs with a travelling light.
    const travellers: { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; offset: number }[] = [];
    spec.routes.forEach((route, i) => {
      const color = new THREE.Color(route.color ?? "#fde047");
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s < route.points.length - 1; s++) {
        const arc = greatCircle(route.points[s], route.points[s + 1], 24);
        arc.forEach(([x, y, z], k) => {
          if (s > 0 && k === 0) return;
          const t = k / 24;
          pts.push(new THREE.Vector3(x, y, z).multiplyScalar(1.004 + 0.035 * Math.sin(Math.PI * t)));
        });
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, pts.length * 2, 0.0045, 8, false),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
      );
      scene.add(tube);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      scene.add(light);
      travellers.push({ mesh: light, curve, offset: i * 0.33 });
      if (route.label) {
        const mid = curve.getPoint(0.5);
        stage.addLabel(route.label, mid.clone().multiplyScalar(1.03), { className: "visual-label-route", surface: true, priority: 1 });
      }
    });
    stage.onFrame((_dt, time) => {
      for (const t of travellers) t.mesh.position.copy(t.curve.getPoint((time * 0.18 + t.offset) % 1));
    });

    // The map itself (country shapes load from a small bundled file).
    (async () => {
      try {
        const [{ feature }, atlas] = await Promise.all([import("topojson-client"), import("world-atlas/countries-110m.json")]);
        if (disposed) return;
        const topology = (atlas.default ?? atlas) as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
        const collection = feature(topology, topology.objects.countries);
        const countries = collection.features as CountryFeature[];
        const names = countries.map((c) => c.properties.name);

        const highlighted = new Map<string, string>();
        const highlightLabels: { name: string; label: string }[] = [];
        spec.highlight.forEach((h, i) => {
          const name = resolveCountry(h.name, names);
          if (!name) return;
          highlighted.set(name, h.color ?? HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length]);
          highlightLabels.push({ name, label: countryLabel(name, h.label) });
        });

        const texture = new THREE.CanvasTexture(drawMap(countries, highlighted));
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
        const material = earth.material as THREE.MeshStandardMaterial;
        material.map = texture;
        material.needsUpdate = true;

        for (const { name, label } of highlightLabels) {
          const country = countries.find((c) => c.properties.name === name)!;
          const c = countryCentre(country);
          stage.addLabel(label, vec(c.lat, c.lon, 1.02), { className: "visual-label-country", surface: true, priority: 3 });
        }
        setStatus("ready");
        flyToFocus();
      } catch (err) {
        console.error("globe map failed", err);
        if (!disposed) setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      controls.removeEventListener("start", stopAuto);
      stage.dispose();
      stageRef.current = null;
      flyRef.current = null;
    };
  }, [spec]);

  useEffect(() => {
    stageRef.current?.setLabelsVisible(labels);
  }, [labels]);

  if (status === "nowebgl") return <VisualError kind="nowebgl" />;
  if (status === "error") return <VisualError kind="error" />;

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="visual-stage" />
      {status === "loading" && <div className="visual-loading">در حال آماده کردن کره زمین…</div>}
      <div className="visual-tools">
        <button type="button" onClick={() => flyRef.current?.()} className="visual-tool" aria-label="برگشت به مرکز">
          <Crosshair className="size-4" /> مرکز
        </button>
        <button
          type="button"
          onClick={() => setLabels((l) => !l)}
          className="visual-tool"
          data-active={labels ? "true" : undefined}
          aria-pressed={labels}
        >
          <Tags className="size-4" /> نام‌ها
        </button>
      </div>
      <div className="visual-hint">برای چرخاندن بکشید · برای نزدیک شدن دو انگشت را باز کنید</div>
    </div>
  );
}
