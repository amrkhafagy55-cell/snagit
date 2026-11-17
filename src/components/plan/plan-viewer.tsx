"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check, Maximize, Minus, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import type { DefectStatus, Severity } from "@/lib/types";
import { MARKER_COLORS } from "./marker-colors";

export type PlanMarker = {
  id: string;
  number: number;
  severity: Severity;
  status: DefectStatus;
  x: number; // 0..1 of image width
  y: number; // 0..1 of image height
};


const MIN_Z = 1;
const MAX_Z = 8;
const TAP_SLOP = 6; // px a pointer may move and still count as a tap

type View = { z: number; tx: number; ty: number };
type Gesture =
  | { kind: "press"; id: number; x: number; y: number; tx: number; ty: number; moved: boolean }
  | { kind: "pinch"; dist: number; z: number; midX: number; midY: number; tx: number; ty: number }
  | null;

/**
 * Zoomable, pannable floor plan with severity-coloured markers.
 * Mouse: wheel to zoom, drag to pan, click to tap. Touch: pinch to zoom, drag to pan, tap.
 * Coordinates passed to onTapPlan are relative (0..1) to the plan image.
 */
export function PlanViewer({
  imageUrl,
  width,
  height,
  markers,
  selectedId,
  ghost,
  dimmedIds,
  focus,
  crosshair,
  onTapPlan,
  onTapMarker,
  labels,
  children,
  className = "",
}: {
  imageUrl: string;
  width: number;
  height: number;
  markers: PlanMarker[];
  selectedId?: string | null;
  ghost?: { x: number; y: number } | null;
  dimmedIds?: Set<string>;
  focus?: { x: number; y: number; key: string } | null;
  crosshair?: boolean;
  onTapPlan?: (x: number, y: number) => void;
  onTapMarker?: (id: string) => void;
  labels: { zoomIn: string; zoomOut: string; fit: string; plan: string };
  children?: ReactNode;
  className?: string;
}) {
  const { lang } = useI18n();
  const viewport = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [rawView, setView] = useState<View>({ z: 1, tx: 0, ty: 0 });
  const [appliedFocus, setAppliedFocus] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>(null);
  // Latest rendered view, for handlers registered outside React (wheel) and gesture starts.
  const viewRef = useRef<View>({ z: 1, tx: 0, ty: 0 });

  // Content size at zoom 1 = the plan fitted inside the viewport.
  const base = box.w && box.h ? Math.min(box.w / width, box.h / height) : 0;
  const cw = width * base;
  const ch = height * base;

  const clamp = useCallback(
    (v: View): View => {
      const z = Math.min(MAX_Z, Math.max(MIN_Z, v.z));
      const sw = cw * z;
      const sh = ch * z;
      const tx = sw <= box.w ? (box.w - sw) / 2 : Math.min(0, Math.max(box.w - sw, v.tx));
      const ty = sh <= box.h ? (box.h - sh) / 2 : Math.min(0, Math.max(box.h - sh, v.ty));
      return { z, tx, ty };
    },
    [box.w, box.h, cw, ch],
  );

  const zoomAt = useCallback(
    (px: number, py: number, nextZ: number, from: View = viewRef.current) => {
      const z = Math.min(MAX_Z, Math.max(MIN_Z, nextZ));
      const k = z / from.z;
      setView(clamp({ z, tx: px - (px - from.tx) * k, ty: py - (py - from.ty) * k }));
    },
    [clamp],
  );

  // The rendered view is always clamped to the current viewport, so resizes need no effect.
  // A new focus request (e.g. ?focus=<defect>) zooms to that point once, adjusting state during render.
  const focusView =
    focus && cw && appliedFocus !== focus.key
      ? clamp({ z: 2.5, tx: box.w / 2 - focus.x * cw * 2.5, ty: box.h / 2 - focus.y * ch * 2.5 })
      : null;
  if (focus && focusView) {
    setAppliedFocus(focus.key);
    setView(focusView);
  }
  const view = focusView ?? clamp(rawView);

  useLayoutEffect(() => {
    viewRef.current = view;
  });

  const fit = useCallback(() => setView(clamp({ z: 1, tx: 0, ty: 0 })), [clamp]);

  // Track viewport size.
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom needs a non-passive listener to prevent page scroll.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, viewRef.current.z * Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  function local(e: React.PointerEvent) {
    const r = viewport.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function startPinch() {
    const [a, b] = [...pointers.current.values()];
    const v = viewRef.current;
    gesture.current = {
      kind: "pinch",
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      z: v.z,
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
      tx: v.tx,
      ty: v.ty,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    viewport.current!.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) startPinch();
    else if (pointers.current.size === 1) {
      const v = viewRef.current;
      gesture.current = { kind: "press", id: e.pointerId, x: p.x, y: p.y, tx: v.tx, ty: v.ty, moved: false };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const z = Math.min(MAX_Z, Math.max(MIN_Z, (g.z * dist) / g.dist));
      // Keep the plan point that was under the starting midpoint under the current midpoint.
      const cx = (g.midX - g.tx) / g.z;
      const cy = (g.midY - g.ty) / g.z;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      setView(clamp({ z, tx: mx - cx * z, ty: my - cy * z }));
    } else if (g.kind === "press" && g.id === e.pointerId) {
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      if (!g.moved && Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;
      if (g.moved) setView((v) => clamp({ z: v.z, tx: g.tx + dx, ty: g.ty + dy }));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const g = gesture.current;
    const p = pointers.current.get(e.pointerId) ?? local(e);
    pointers.current.delete(e.pointerId);
    if (g?.kind === "press" && g.id === e.pointerId && !g.moved && e.type === "pointerup") {
      const v = viewRef.current;
      const x = (p.x - v.tx) / (cw * v.z);
      const y = (p.y - v.ty) / (ch * v.z);
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onTapPlan?.(x, y);
    }
    if (pointers.current.size === 1) {
      // Pinch ended with one finger still down: continue as a pan without a jump.
      const [[id, rest]] = [...pointers.current.entries()];
      const v = viewRef.current;
      gesture.current = { kind: "press", id, x: rest.x, y: rest.y, tx: v.tx, ty: v.ty, moved: true };
    } else if (pointers.current.size === 0) {
      gesture.current = null;
    }
  }

  const center = () => ({ x: box.w / 2, y: box.h / 2 });

  return (
    <div
      ref={viewport}
      className={`relative touch-none select-none overflow-hidden bg-navy-50 ${crosshair ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"} ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="application"
      aria-label={labels.plan}
      dir="ltr"
    >
      {base > 0 && (
        <div
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{ width: cw, height: ch, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})` }}
        >
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            onLoad={() => setLoaded(true)}
            className={`pointer-events-none size-full bg-white shadow-sm transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          />
          {markers.map((m) => {
            const selected = m.id === selectedId;
            const dim = dimmedIds?.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onTapMarker?.(m.id)}
                className="absolute"
                style={{ left: m.x * cw, top: m.y * ch, zIndex: selected ? 30 : 10 }}
                aria-label={`D-${m.number}`}
              >
                <span
                  className={`absolute left-0 top-0 grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-xs font-bold shadow-md ring-2 transition-shadow ${MARKER_COLORS[m.severity]} ${
                    selected ? "ring-navy-950 ring-offset-2" : "ring-white"
                  } ${dim ? "opacity-50" : ""}`}
                  style={{ transform: `translate(-50%, -50%) scale(${1 / view.z})`, transformOrigin: "center" }}
                >
                  {m.number}
                  {(m.status === "resolved" || m.status === "rejected") && (
                    <Check className="absolute -right-1 -top-1 size-3.5 rounded-full bg-emerald-500 p-0.5 text-white" aria-hidden />
                  )}
                </span>
              </button>
            );
          })}
          {ghost && (
            <span
              className="pointer-events-none absolute"
              style={{ left: ghost.x * cw, top: ghost.y * ch, zIndex: 40 }}
              aria-hidden
            >
              <span
                className="absolute left-0 top-0 block size-7 animate-pulse rounded-full border-[3px] border-accent-500 bg-accent-500/25"
                style={{ transform: `translate(-50%, -50%) scale(${1 / view.z})` }}
              />
            </span>
          )}
        </div>
      )}

      <div className="absolute right-2 top-2 z-20 flex flex-col overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-navy-100">
        {[
          { label: labels.zoomIn, icon: Plus, run: () => zoomAt(center().x, center().y, view.z * 1.5) },
          { label: labels.zoomOut, icon: Minus, run: () => zoomAt(center().x, center().y, view.z / 1.5) },
          { label: labels.fit, icon: Maximize, run: fit },
        ].map(({ label, icon: Icon, run }) => (
          <button
            key={label}
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={run}
            className="grid size-10 place-items-center text-navy-700 hover:bg-navy-50"
            title={label}
            aria-label={label}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>

      {/* Overlays (cards, banners) must not start a pan or count as a tap on the plan. */}
      <div className="contents" onPointerDown={(e) => e.stopPropagation()} dir={lang === "ar" ? "rtl" : "ltr"}>
        {children}
      </div>
    </div>
  );
}
