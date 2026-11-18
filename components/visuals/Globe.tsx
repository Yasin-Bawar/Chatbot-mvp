"use client";

import { Crosshair, Flag, Map as MapIcon, Satellite, Search, Tags, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Feature, Geometry, MultiPolygon, Polygon, Position } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { DARI_RIVER, greatCircle, latLonToVector, pointInPolygons, resolveCountry, vectorToLatLon } from "@/lib/visuals/geo";
import type { GlobeSpec } from "@/lib/visuals/types";
import { COUNTRIES, COUNTRY_BY_NAME, faName, flagStyle, searchCountries, type CountryInfo } from "./flags";
import { createStage, easeInOut, NoWebGLError, type Label, type Stage } from "./stage";
import { VisualError } from "./VisualError";

/**
 * The 3D Earth. Two looks:
 * - "satellite": NASA Blue Marble photo with relief (public domain), country
 *   borders and highlighted countries drawn on top;
 * - "map": a clean political map.
 * Country shapes: Natural Earth 1:50m (world-atlas). Rivers: Natural Earth.
 * "Countries" mode names every country with its flag; tap one to pick it.
 */

type View = "satellite" | "map";
type CountryFeature = Feature<Polygon | MultiPolygon, { name: string }>;
type River = { name: string; lines: [number, number][][] };

// Map look: one sand tone for land, the geography teal for the main country.
const OCEAN = "#21476d";
const LAND = "#f1ead8";
const MAIN = "#0d9488";
const OTHER = "#99d8cf";
const DISTANCE = [0, 3.1, 2.35, 1.8, 1.42];

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

interface Painter {
  canvas: HTMLCanvasElement;
  /** `selected`: index of a country to outline in yellow (-1 for none). */
  paint: (view: View, selected?: number) => void;
}

/** Paints the flat (equirectangular) texture that is wrapped around the sphere. */
function makePainter(
  width: number,
  countries: CountryFeature[],
  highlighted: Map<string, string>,
  rivers: River[],
  photo: HTMLImageElement | null,
): Painter {
  const W = width;
  const H = width / 2;
  const s = W / 2048; // line widths are designed for a 2048 px texture
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const px = (lon: number) => ((lon + 180) / 360) * W;
  const py = (lat: number) => ((90 - lat) / 180) * H;
  const rings = countries.map((f) => polygonsOf(f.geometry).flatMap((polygon) => polygon.map(unwrap)));

  const traceCountry = (index: number) => {
    ctx.beginPath();
    for (const ring of rings[index]) {
      for (const shift of [0, W, -W]) {
        const xs = ring.map(([lon]) => px(lon) + shift);
        if (Math.max(...xs) < 0 || Math.min(...xs) > W) continue;
        ring.forEach(([lon, lat], i) => (i === 0 ? ctx.moveTo(px(lon) + shift, py(lat)) : ctx.lineTo(px(lon) + shift, py(lat))));
        ctx.closePath();
      }
    }
  };

  const grid = (alpha: number) => {
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = s;
    ctx.beginPath();
    for (let lon = -180; lon <= 180; lon += 15) {
      ctx.moveTo(px(lon), 0);
      ctx.lineTo(px(lon), H);
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      ctx.moveTo(0, py(lat));
      ctx.lineTo(W, py(lat));
    }
    ctx.stroke();
  };

  const drawRivers = (color: string) => {
    ctx.strokeStyle = color;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const river of rivers) {
      ctx.lineWidth = (river.name in DARI_RIVER ? 1.6 : 1) * s;
      ctx.beginPath();
      for (const line of river.lines) {
        line.forEach(([lat, lon], i) => (i === 0 ? ctx.moveTo(px(lon), py(lat)) : ctx.lineTo(px(lon), py(lat))));
      }
      ctx.stroke();
    }
  };

  const outline = (index: number) => {
    if (index < 0) return;
    traceCountry(index);
    ctx.fillStyle = "rgba(250, 204, 21, 0.3)";
    ctx.fill("evenodd");
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2.6 * s;
    ctx.stroke();
  };

  const paint = (view: View, selected = -1) => {
    ctx.clearRect(0, 0, W, H);
    if (view === "satellite" && photo) {
      ctx.drawImage(photo, 0, 0, W, H);
      grid(0.06);
      drawRivers("rgba(147, 197, 253, 0.85)");
      // Country borders, then the highlighted countries in see-through teal.
      ctx.lineJoin = "round";
      countries.forEach((f, i) => {
        if (highlighted.has(f.properties.name)) return;
        traceCountry(i);
        ctx.strokeStyle = "rgba(255,255,255,0.45)";
        ctx.lineWidth = 0.9 * s;
        ctx.stroke();
      });
      countries.forEach((f, i) => {
        const color = highlighted.get(f.properties.name);
        if (!color) return;
        traceCountry(i);
        ctx.globalAlpha = color === MAIN ? 0.55 : 0.35;
        ctx.fillStyle = color === OTHER ? MAIN : color;
        ctx.fill("evenodd");
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2 * s;
        ctx.stroke();
      });
      outline(selected);
      return;
    }
    ctx.fillStyle = OCEAN;
    ctx.fillRect(0, 0, W, H);
    grid(0.05);
    const dim = highlighted.size > 0;
    for (const emphasis of [false, true]) {
      countries.forEach((f, i) => {
        const name = f.properties.name;
        const color = highlighted.get(name);
        if (emphasis !== Boolean(color)) return;
        traceCountry(i);
        ctx.fillStyle = name === "Antarctica" ? "#f1f5f9" : (color ?? LAND);
        ctx.globalAlpha = color || !dim ? 1 : 0.9;
        ctx.fill("evenodd");
        ctx.globalAlpha = 1;
        ctx.lineJoin = "round";
        ctx.strokeStyle = color ? "#ffffff" : "rgba(60,50,30,0.3)";
        ctx.lineWidth = (color ? 2.2 : 1) * s;
        ctx.stroke();
      });
      if (!emphasis) drawRivers("rgba(59, 130, 246, 0.55)");
    }
    outline(selected);
  };

  return { canvas, paint };
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
      void main() { float rim = 1.0 - max(dot(vNormal, vView), 0.0); float glow = pow(rim, 3.0); gl_FragColor = vec4(0.45, 0.7, 1.0, 1.0) * glow * 0.6; }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1.03, 64, 48), material);
}

function stars(): THREE.Points {
  const count = 600;
  const positions = new Float32Array(count * 3);
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) {
    const z = rand() * 2 - 1;
    const t = rand() * Math.PI * 2;
    const r = 30 + rand() * 30;
    const s = Math.sqrt(1 - z * z);
    positions.set([r * s * Math.cos(t), r * z, r * s * Math.sin(t)], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.45, depthWrite: false }),
  );
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // the map look still works without the photo
    img.src = src;
  });
}

export default function Globe({ spec }: { spec: GlobeSpec }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const flyRef = useRef<(() => void) | null>(null);
  const repaintRef = useRef<((view: View) => void) | null>(null);
  const [labels, setLabels] = useState(true);
  const [view, setView] = useState<View>(spec.view);
  const viewRef = useRef<View>(spec.view);
  // "Countries" mode: every country with its flag; tap or search to pick one.
  const [countriesOn, setCountriesOn] = useState(spec.countries);
  const countriesOnRef = useRef(spec.countries);
  const showCountriesRef = useRef<((on: boolean) => void) | null>(null);
  const pickRef = useRef<((name: string | null, fly: boolean) => void) | null>(null);
  const [picked, setPicked] = useState<CountryInfo | null>(null);
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchCountries(query), [query]);
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
    const { scene, camera, controls, renderer } = stage;
    controls.minDistance = 1.15;
    controls.maxDistance = 5;
    controls.rotateSpeed = 0.45;

    scene.add(stars());
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-2.5, 2, 3);
    camera.add(sun);

    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), material);
    // three.js puts longitude −180° at −x; turn the map to match latLonToVector.
    earth.rotation.y = -Math.PI / 2;
    scene.add(earth);
    scene.add(atmosphere());

    // Relief: mountains such as the Hindu Kush catch the light.
    new THREE.TextureLoader().load("/textures/earth-relief-2k.jpg", (relief) => {
      if (disposed) return relief.dispose();
      material.bumpMap = relief;
      material.bumpScale = 3;
      material.needsUpdate = true;
    });

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

    // Markers: a dark dot with a white edge and a pulsing ring, with a label.
    const pulses: THREE.Mesh[] = [];
    spec.markers.forEach((m, i) => {
      const color = new THREE.Color(m.color ?? "#1e293b");
      const p = vec(m.lat, m.lon, 1.003);
      const edge = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      edge.position.copy(p);
      scene.add(edge);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 16, 12), new THREE.MeshBasicMaterial({ color }));
      dot.position.copy(vec(m.lat, m.lon, 1.0075));
      scene.add(dot);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.016, 0.02, 32),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
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

    // Routes: arcs with a travelling light.
    const travellers: { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; offset: number }[] = [];
    spec.routes.forEach((route, i) => {
      const color = new THREE.Color(route.color ?? "#f59e0b");
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s < route.points.length - 1; s++) {
        const arc = greatCircle(route.points[s], route.points[s + 1], 24);
        arc.forEach(([x, y, z], k) => {
          if (s > 0 && k === 0) return;
          pts.push(new THREE.Vector3(x, y, z).multiplyScalar(1.004 + 0.035 * Math.sin(Math.PI * (k / 24))));
        });
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      scene.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(curve, pts.length * 2, 0.0045, 8, false),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
        ),
      );
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      scene.add(light);
      travellers.push({ mesh: light, curve, offset: i * 0.33 });
      if (route.label) {
        stage.addLabel(route.label, curve.getPoint(0.5).multiplyScalar(1.03), {
          className: "visual-label-route",
          surface: true,
          priority: 1,
        });
      }
    });
    stage.onFrame((_dt, time) => {
      for (const t of travellers) t.mesh.position.copy(t.curve.getPoint((time * 0.18 + t.offset) % 1));
    });

    // Tap a country to see its name (a tap, not a drag).
    let tapLabel: Label | null = null;
    let tapTimer = 0;
    let countriesRef: CountryFeature[] = [];
    const raycaster = new THREE.Raycaster();
    let down: { x: number; y: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY, t: performance.now() });
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || performance.now() - down.t > 500) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(earth)[0];
      if (!hit || !tapLabel) return;
      const { lat, lon } = vectorToLatLon(hit.point.x, hit.point.y, hit.point.z);
      const country = countriesRef.find((c) => pointInPolygons(lon, lat, polygonsOf(c.geometry)));
      if (!country) return;
      if (countriesOnRef.current) {
        pickRef.current?.(country.properties.name, false);
        return;
      }
      tapLabel.el.textContent = faName(country.properties.name);
      tapLabel.size = undefined;
      tapLabel.position.copy(hit.point).multiplyScalar(1.03);
      tapLabel.visible = true;
      window.clearTimeout(tapTimer);
      tapTimer = window.setTimeout(() => tapLabel && (tapLabel.visible = false), 2500);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // Map data, rivers and the satellite photo load only when the Earth opens.
    (async () => {
      try {
        const [{ feature }, atlas, rivers, photo] = await Promise.all([
          import("topojson-client"),
          import("world-atlas/countries-50m.json"),
          fetch("/data/rivers.json")
            .then((r) => (r.ok ? (r.json() as Promise<River[]>) : []))
            .catch(() => [] as River[]),
          loadImage("/textures/earth-2k.jpg"),
        ]);
        if (disposed) return;
        const topology = (atlas.default ?? atlas) as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
        const countries = feature(topology, topology.objects.countries).features as CountryFeature[];
        countriesRef = countries;
        const names = countries.map((c) => c.properties.name);

        const highlighted = new Map<string, string>();
        const highlightLabels: { name: string; label: string }[] = [];
        spec.highlight.forEach((h, i) => {
          const name = resolveCountry(h.name, names);
          if (!name) return;
          highlighted.set(name, h.color ?? (i === 0 ? MAIN : OTHER));
          highlightLabels.push({ name, label: h.label?.trim() || faName(name) });
        });

        // A sharper texture on bigger screens.
        const big = Math.min(window.screen.width, window.screen.height) >= 700;
        const width = big && renderer.capabilities.maxTextureSize >= 4096 ? 4096 : 2048;
        const painter = makePainter(width, countries, highlighted, rivers, photo);
        const texture = new THREE.CanvasTexture(painter.canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        let selected = -1;
        const repaint = (v: View) => {
          painter.paint(v, selected);
          texture.needsUpdate = true;
        };
        repaint(viewRef.current);
        repaintRef.current = repaint;
        material.map = texture;
        material.needsUpdate = true;

        const shownHighlights: Label[] = [];
        for (const { name, label } of highlightLabels) {
          const c = countryCentre(countries.find((x) => x.properties.name === name)!);
          shownHighlights.push(
            stage.addLabel(label, vec(c.lat, c.lon, 1.02), { className: "visual-label-country", surface: true, priority: 3 }),
          );
        }
        if (spec.rivers) {
          for (const river of rivers) {
            const fa = DARI_RIVER[river.name];
            if (!fa) continue;
            const longest = river.lines.reduce((a, b) => (b.length > a.length ? b : a), river.lines[0]);
            const [lat, lon] = longest[Math.floor(longest.length / 2)];
            stage.addLabel(fa, vec(lat, lon, 1.02), { className: "visual-label-river", surface: true, priority: 1 });
          }
        }
        tapLabel = stage.addLabel("", new THREE.Vector3(), { className: "visual-label-country", surface: true, priority: 4 });
        tapLabel.visible = false;

        // Countries mode. Bigger countries win when labels overlap; zoom in to see the small ones.
        const indexByName = new Map(countries.map((c, i) => [c.properties.name, i]));
        let flagLabels: Label[] | null = null;
        const pick = (name: string | null, fly: boolean) => {
          selected = name ? (indexByName.get(name) ?? -1) : -1;
          repaint(viewRef.current);
          const info = name ? (COUNTRY_BY_NAME.get(name) ?? null) : null;
          setPicked(info);
          if (info && fly) {
            controls.autoRotate = false;
            const d = Math.min(3.1, Math.max(1.7, camera.position.length()));
            flight = { from: camera.position.clone(), to: vec(info.lat, info.lon, d), start: performance.now() };
          }
        };
        const showCountries = (on: boolean) => {
          if (on && !flagLabels) {
            flagLabels = COUNTRIES.map((c) => {
              const label = stage.addLabel(faName(c.name), vec(c.lat, c.lon, 1.015), {
                className: "visual-label-flag",
                surface: true,
                priority: 1 + 0.99 * (1 - c.rank / COUNTRIES.length),
              });
              if (c.flag !== null) {
                const flag = document.createElement("span");
                flag.className = "flag";
                Object.assign(flag.style, flagStyle(c.flag, 18));
                label.el.prepend(flag);
              }
              return label;
            });
          }
          for (const l of flagLabels ?? []) l.visible = on;
          for (const l of shownHighlights) l.visible = !on;
          if (!on && selected >= 0) pick(null, false);
        };
        pickRef.current = pick;
        showCountriesRef.current = showCountries;
        if (countriesOnRef.current) showCountries(true);

        setStatus("ready");
        flyToFocus();
      } catch (err) {
        console.error("globe map failed", err);
        if (!disposed) setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      window.clearTimeout(tapTimer);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.removeEventListener("start", stopAuto);
      stage.dispose();
      stageRef.current = null;
      flyRef.current = null;
      repaintRef.current = null;
      pickRef.current = null;
      showCountriesRef.current = null;
    };
  }, [spec]);

  useEffect(() => {
    stageRef.current?.setLabelsVisible(labels);
  }, [labels]);

  const toggleCountries = () => {
    const next = !countriesOn;
    countriesOnRef.current = next;
    setCountriesOn(next);
    showCountriesRef.current?.(next);
    if (!next) setQuery("");
  };

  const choose = (c: CountryInfo) => {
    pickRef.current?.(c.name, true);
    setQuery("");
  };

  const switchView = () => {
    const next: View = view === "satellite" ? "map" : "satellite";
    viewRef.current = next;
    setView(next);
    repaintRef.current?.(next);
  };

  if (status === "nowebgl") return <VisualError kind="nowebgl" />;
  if (status === "error") return <VisualError kind="error" />;

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="visual-stage" />
      {status === "loading" && <div className="visual-loading">…</div>}
      {countriesOn && status === "ready" && (
        <div className="globe-search">
          <label>
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && results[0] && choose(results[0])}
              placeholder="جستجوی کشور…"
              aria-label="جستجوی کشور"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="پاک کردن">
                <X />
              </button>
            )}
          </label>
          {results.length > 0 && (
            <div className="globe-search-results">
              {results.map((c) => (
                <button key={c.name} type="button" onClick={() => choose(c)}>
                  {c.flag !== null && <span className="flag" style={flagStyle(c.flag, 24)} />}
                  <span>{faName(c.name)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {picked && countriesOn && (
        <div className="globe-country-card" role="status">
          {picked.flag !== null && <span className="flag" style={flagStyle(picked.flag, 64)} />}
          <div className="min-w-0">
            <b>{faName(picked.name)}</b>
            <small dir="ltr">{picked.name}</small>
          </div>
          <button type="button" onClick={() => pickRef.current?.(null, false)} aria-label="بستن">
            <X />
          </button>
        </div>
      )}
      <div className="visual-tools">
        <button
          type="button"
          onClick={toggleCountries}
          className="visual-icon-btn"
          data-active={countriesOn ? "true" : undefined}
          aria-pressed={countriesOn}
          aria-label="کشورها و بیرق‌ها"
          title="کشورها و بیرق‌ها"
        >
          <Flag />
        </button>
        <button
          type="button"
          onClick={() => flyRef.current?.()}
          className="visual-icon-btn"
          aria-label="برگشت به مرکز"
          title="مرکز"
        >
          <Crosshair />
        </button>
        <button
          type="button"
          onClick={() => setLabels((l) => !l)}
          className="visual-icon-btn"
          data-active={labels ? "true" : undefined}
          aria-pressed={labels}
          aria-label="نام‌ها"
          title="نام‌ها"
        >
          <Tags />
        </button>
        <button
          type="button"
          onClick={switchView}
          className="visual-icon-btn"
          aria-label={view === "satellite" ? "نقشه سیاسی" : "تصویر ماهواره‌ای"}
          title={view === "satellite" ? "نقشه" : "ماهواره"}
        >
          {view === "satellite" ? <MapIcon /> : <Satellite />}
        </button>
      </div>
      <div className="visual-credit">{view === "satellite" ? "تصویر زمین: NASA" : "Natural Earth"}</div>
    </div>
  );
}
