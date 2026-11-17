"use client";

import { Eye, Pause, Play, RotateCcw, Tags, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BODY_PARTS, BODY_SYSTEMS, bodyPart, type BodySystem } from "@/lib/visuals/anatomy";
import type { AnatomySpec } from "@/lib/visuals/types";
import { createBodyModel } from "./anatomy-model";
import { createStage, NoWebGLError, type Label, type Stage } from "./stage";
import { VisualError } from "./VisualError";

export default function Anatomy({ spec }: { spec: AnatomySpec }) {
  const initialPart = bodyPart(spec.focus);
  const [system, setSystem] = useState<BodySystem>(initialPart?.system === "skeletal" && spec.system === "all" ? "skeletal" : spec.system);
  const [selected, setSelected] = useState(spec.focus ?? (spec.system === "all" ? "heart" : BODY_PARTS.find((p) => p.system === spec.system)!.id));
  const [labels, setLabels] = useState(true);
  const [skin, setSkin] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState<"ready" | "nowebgl" | "error">("ready");
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const bodyRef = useRef<ReturnType<typeof createBodyModel> | null>(null);
  const labelsRef = useRef(new Map<string, Label>());
  const playingRef = useRef(false);
  const info = bodyPart(selected)!;
  const visibleParts = BODY_PARTS.filter((p) => system === "all" ? p.system !== "skeletal" : p.system === system);

  function resetView(back = false) {
    const stage = stageRef.current;
    if (!stage) return;
    const distance = Math.max(8.6, 4.3 / Math.max(0.3, stage.camera.aspect));
    stage.controls.target.set(0, -0.1, 0);
    stage.camera.position.set(0, -0.1, back ? -distance : distance);
    stage.controls.update();
  }

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let stage: Stage | undefined;
    try {
      stage = createStage(mount);
      stageRef.current = stage;
      const body = createBodyModel();
      bodyRef.current = body;
      stage.scene.add(body.root);
      stage.scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2));
      const key = new THREE.DirectionalLight(0xffffff, 2.5);
      key.position.set(-3, 4, 6);
      stage.camera.add(key);
      stage.controls.minDistance = 2;
      stage.controls.maxDistance = 24;
      stage.controls.minPolarAngle = 0.15;
      stage.controls.maxPolarAngle = Math.PI - 0.15;
      const distance = Math.max(8.6, 4.3 / Math.max(0.3, stage.camera.aspect));
      stage.camera.position.set(0, -0.1, distance);
      stage.controls.target.set(0, -0.1, 0);
      stage.controls.update();
      for (const part of BODY_PARTS) {
        labelsRef.current.set(part.id, stage.addLabel(part.name, new THREE.Vector3(...part.at), { className: "anatomy-label" }));
      }
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let start = { x: 0, y: 0 };
      const down = (event: PointerEvent) => { start = { x: event.clientX, y: event.clientY }; };
      const up = (event: PointerEvent) => {
        // Rotating the model should not accidentally choose an organ.
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
        const rect = mount.getBoundingClientRect();
        pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        raycaster.setFromCamera(pointer, stage!.camera);
        const targets = [...body.parts.values()].filter((group) => group.visible);
        const hit = raycaster.intersectObjects(targets, true)[0];
        if (hit) {
          let object: THREE.Object3D | null = hit.object;
          while (object && !object.userData.partId) object = object.parent;
          if (object?.userData.partId) setSelected(String(object.userData.partId));
        }
      };
      const canvas = stage.renderer.domElement;
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointerup", up);
      let elapsed = 0;
      stage.onFrame((dt) => {
        if (playingRef.current) elapsed += dt;
        const pulse = playingRef.current ? 1 + 0.035 * Math.sin(elapsed * Math.PI * 2 * 1.2) : 1;
        body.parts.get("heart")!.scale.setScalar(pulse);
        const breath = playingRef.current ? Math.sin(elapsed * Math.PI * 0.4) : 0;
        body.parts.get("lungs")!.scale.set(1 + breath * 0.025, 1 + breath * 0.015, 1 + breath * 0.03);
        body.parts.get("diaphragm")!.position.y = -breath * 0.035;
      });
      return () => {
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointerup", up);
        stage!.dispose();
        stageRef.current = null;
        bodyRef.current = null;
        labelsRef.current.clear();
      };
    } catch (error) {
      stage?.dispose();
      stageRef.current = null;
      bodyRef.current = null;
      queueMicrotask(() => setStatus(error instanceof NoWebGLError ? "nowebgl" : "error"));
    }
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.shell.visible = skin;
    for (const part of BODY_PARTS) {
      const visible = system === "all" ? part.system !== "skeletal" : part.system === system;
      body.parts.get(part.id)!.visible = visible;
      const material = body.materials.get(part.id)!;
      material.emissive.set(part.id === selected ? part.color : "#000000");
      material.emissiveIntensity = part.id === selected ? 0.3 : 0;
      const label = labelsRef.current.get(part.id)!;
      label.visible = visible && (system !== "all" || part.id === selected);
      label.el.style.border = part.id === selected ? "2px solid #0f766e" : "2px solid transparent";
    }
    stageRef.current?.setLabelsVisible(labels);
  }, [system, selected, skin, labels]);

  useEffect(() => { playingRef.current = playing; }, [playing]);

  const chooseSystem = (next: BodySystem) => {
    setSystem(next);
    setSelected(next === "all" ? "heart" : BODY_PARTS.find((p) => p.system === next)!.id);
    resetView();
  };
  const zoom = (factor: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const offset = stage.camera.position.clone().sub(stage.controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, 2, 24));
    stage.camera.position.copy(stage.controls.target).add(offset);
    stage.controls.update();
  };

  return (
    <div className="anatomy-view" dir="rtl">
      <div className="anatomy-systems" role="group" aria-label="دستگاه‌های بدن">
        {BODY_SYSTEMS.map((item) => <button key={item.id} type="button" aria-pressed={system === item.id} onClick={() => chooseSystem(item.id)}>{item.name}</button>)}
      </div>
      <div className="anatomy-layout">
        <div className="anatomy-canvas-wrap">
          <div ref={mountRef} className="visual-stage" role="img" aria-label={`مدل سه‌بعدی بدن؛ عضو انتخاب‌شده: ${info.name}. برای انتخاب با صفحه‌کلید از فهرست اعضا استفاده کنید.`} />
          {status !== "ready" && <div className="absolute inset-0"><VisualError kind={status} /></div>}
          <div className="anatomy-view-buttons" role="group" aria-label="جهت دید">
            <button type="button" onClick={() => resetView(false)}>روبرو</button>
            <button type="button" onClick={() => resetView(true)}>پشت</button>
          </div>
          <p className="anatomy-hint">برای چرخش بکشید؛ برای انتخاب روی عضو بزنید</p>
          <div className="anatomy-tools">
            <button type="button" onClick={() => zoom(0.8)} aria-label="نزدیک‌تر"><ZoomIn /></button>
            <button type="button" onClick={() => zoom(1.25)} aria-label="دورتر"><ZoomOut /></button>
            <button type="button" onClick={() => resetView()} aria-label="دید آغازین"><RotateCcw /></button>
            <button type="button" onClick={() => setSkin((v) => !v)} aria-pressed={skin} aria-label="نمای کلی بدن"><Eye /></button>
            <button type="button" onClick={() => setLabels((v) => !v)} aria-pressed={labels} aria-label="نام اعضا"><Tags /></button>
            <button type="button" onClick={() => setPlaying((v) => !v)} aria-pressed={playing} aria-label="حرکت نمایشی قلب و تنفس">{playing ? <Pause /> : <Play />}</button>
          </div>
        </div>
        <aside className="anatomy-panel" aria-label="آشنایی با اعضای بدن">
          <p className="anatomy-system-note">{BODY_SYSTEMS.find((item) => item.id === system)?.note}</p>
          <div className="anatomy-parts" role="group" aria-label="انتخاب عضو">
            {visibleParts.map((part) => <button key={part.id} type="button" aria-pressed={selected === part.id} onClick={() => setSelected(part.id)}><span style={{ background: part.color }} />{part.name}</button>)}
          </div>
          <div className="anatomy-detail" aria-live="polite" aria-atomic="true">
            <span className="anatomy-eyebrow">عضو را بشناسیم</span>
            <h3>{info.name}</h3>
            <span className="anatomy-english" lang="en" dir="ltr">{info.english}</span>
            <p>{info.description}</p>
            <div className="anatomy-question"><strong>حالا شما بگویید</strong><p>{info.question}</p></div>
          </div>
          <p className="anatomy-disclaimer">مدل ساده آموزشی است؛ شکل، اندازه، رگ‌ها و حرکت‌ها دقیق پزشکی نیستند. در دید روبرو، سمت راست بدن در چپ تصویر است.</p>
        </aside>
      </div>
    </div>
  );
}
