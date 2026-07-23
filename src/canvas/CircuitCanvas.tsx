/**
 * 电路搭建画布：SVG 渲染 + 网格吸附 + Pointer Events（鼠标/触摸统一）。
 * - 空白处拖动 = 平移，滚轮/双指 = 缩放
 * - 元件体拖动 = 移动（网格吸附），端子拖出 = 连线
 * - 开关点击切换、变阻器滑片拖动（逐帧重解）
 */

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { create } from 'zustand';
import type { CircuitDoc, ComponentInstance, ComponentType, TerminalRef } from '../model/types';
import { terminalKey } from '../model/types';
import { REGISTRY, terminalPos } from '../model/registry';
import { useCircuitStore } from '../store/circuitStore';
import { GRID, PALETTE, potentialColor } from './const';
import {
  BatteryArt,
  BulbArt,
  FuseArt,
  MeterArt,
  ResistorArt,
  RheostatArt,
  SharedDefs,
  SwitchArt,
} from './art';
import { DotsLayer } from '../visualization/DotsLayer';
import { ptsToPath, wireChannelAxis, wirePathPoints } from './wirePath';
import { circuitViewBox, FALLBACK_W, FALLBACK_H } from './viewBox';

/* —— 元件抽屉 → 画布 的放置状态（跨组件共享） —— */
interface PlacingStore {
  placing: ComponentType | null;
  setPlacing: (t: ComponentType | null) => void;
}
export const usePlacingStore = create<PlacingStore>((set) => ({
  placing: null,
  setPlacing: (t) => set({ placing: t }),
}));

/* —— 视图变换 —— */
interface ViewBox {
  x: number;
  y: number;
  scale: number; // px per svg-unit 倍率（1 = 原始）
}

type DragState =
  | { kind: 'pan'; startX: number; startY: number; vb: ViewBox }
  | { kind: 'move'; id: string; offX: number; offY: number }
  | { kind: 'wire'; from: TerminalRef; toX: number; toY: number; overTerminal: TerminalRef | null }
  | { kind: 'slider'; id: string }
  | { kind: 'wireMid'; id: string; axis: 'x' | 'y' }
  | null;

export interface CanvasProps {
  /** 关卡模式下限制交互（锁定件由 doc 数据控制） */
  readOnly?: boolean;
}

export function CircuitCanvas({ readOnly = false }: CanvasProps) {
  const doc = useCircuitStore((s) => s.doc);
  const result = useCircuitStore((s) => s.result);
  const selection = useCircuitStore((s) => s.selection);
  const viz = useCircuitStore((s) => s.viz);
  const store = useCircuitStore;

  const { placing, setPlacing } = usePlacingStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState<ViewBox>({ x: -80, y: -160, scale: 1 });
  /** SVG 客户端尺寸（用 ResizeObserver 追踪）。挂载首帧/布局未定时 clientWidth 可能为 0，
   *  若直接在渲染里读 clientWidth 算 viewBox 会得到 0×0 → 整块画布空白（且无重渲染时机纠正）。 */
  const [size, setSize] = useState({ w: FALLBACK_W, h: FALLBACK_H });
  const [drag, setDrag] = useState<DragState>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  /** 按下某元件时记录，用于在 pointerup 判定"轻点"（开关切换靠它，而非脆弱的 onClick） */
  const pressRef = useRef<{ id: string; type: ComponentType; x: number; y: number; moved: boolean } | null>(null);

  /** 屏幕坐标 → SVG 坐标 */
  const toSvg = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: vb.x + (clientX - rect.left) / vb.scale,
      y: vb.y + (clientY - rect.top) / vb.scale,
    };
  };
  const snap = (v: number) => Math.round(v / GRID) * GRID;

  /* —— 追踪画布尺寸：挂载即测一次，之后随窗口/面板变化重算 viewBox —— */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => setSize({ w: svg.clientWidth || FALLBACK_W, h: svg.clientHeight || FALLBACK_H });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  /* —— 缩放 —— */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setVb((v) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const scale = Math.min(2.5, Math.max(0.45, v.scale * factor));
        return {
          scale,
          x: v.x + px / v.scale - px / scale,
          y: v.y + py / v.scale - py / scale,
        };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  /* —— 指针事件 —— */
  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    svgRef.current!.setPointerCapture(e.pointerId);
    pinchRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchRef.current.size >= 2) return; // 进入捏合，交给 move 处理
    const target = e.target as SVGElement;
    const termComp = target.getAttribute('data-term-comp');
    const compId = target.closest('[data-comp-id]')?.getAttribute('data-comp-id') ?? null;
    const role = target.closest('[data-role]')?.getAttribute('data-role');
    const p = toSvg(e.clientX, e.clientY);

    if (placing) return; // 放置模式：down 不处理，up 落子

    if (termComp && !readOnly) {
      const from: TerminalRef = { comp: termComp, t: Number(target.getAttribute('data-term-idx')) };
      setDrag({ kind: 'wire', from, toX: p.x, toY: p.y, overTerminal: null });
      return;
    }
    if (compId) {
      const comp = doc.components.find((c) => c.id === compId);
      if (!comp) return;
      store.getState().select(compId);
      if (role === 'rheostat-knob' && comp.type === 'rheostat') {
        setDrag({ kind: 'slider', id: compId });
        return;
      }
      // 记录按下，用于 pointerup 的"轻点"判定（开关切换）
      pressRef.current = { id: compId, type: comp.type, x: e.clientX, y: e.clientY, moved: false };
      if (!readOnly && !comp.locked) {
        setDrag({ kind: 'move', id: compId, offX: p.x - comp.x * GRID, offY: p.y - comp.y * GRID });
      }
      return;
    }
    const wireEl = target.closest('[data-wire-id]');
    if (wireEl) {
      const id = wireEl.getAttribute('data-wire-id')!;
      store.getState().select(id);
      const w = doc.wires.find((x) => x.id === id);
      if (w && !w.locked && !readOnly) {
        const axis = wireChannelAxis(doc, w);
        if (axis) setDrag({ kind: 'wireMid', id, axis });
      }
      return;
    }
    // 空白：取消选择 + 平移
    store.getState().select(null);
    setDrag({ kind: 'pan', startX: e.clientX, startY: e.clientY, vb });
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (pinchRef.current.has(e.pointerId)) {
      pinchRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    // 双指捏合缩放
    if (pinchRef.current.size === 2) {
      const pts = [...pinchRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const prev = (svgRef.current as unknown as { _lastPinch?: number })._lastPinch;
      (svgRef.current as unknown as { _lastPinch?: number })._lastPinch = dist;
      if (prev && Math.abs(dist - prev) > 1) {
        setVb((v) => ({ ...v, scale: Math.min(2.5, Math.max(0.45, v.scale * (dist / prev))) }));
      }
      return;
    }
    // 记录是否已构成"真正的拖动"（超过阈值则不算轻点）
    if (pressRef.current && !pressRef.current.moved) {
      if (Math.hypot(e.clientX - pressRef.current.x, e.clientY - pressRef.current.y) > 4) {
        pressRef.current.moved = true;
      }
    }
    const p = toSvg(e.clientX, e.clientY);
    if (placing) {
      setGhost({ x: snap(p.x), y: snap(p.y) });
      return;
    }
    if (!drag) return;
    if (drag.kind === 'pan') {
      setVb({
        ...drag.vb,
        x: drag.vb.x - (e.clientX - drag.startX) / drag.vb.scale,
        y: drag.vb.y - (e.clientY - drag.startY) / drag.vb.scale,
      });
    } else if (drag.kind === 'move') {
      store.getState().moveComponent(drag.id, snap(p.x - drag.offX) / GRID, snap(p.y - drag.offY) / GRID);
    } else if (drag.kind === 'wire') {
      const over = findTerminalAt(doc, p.x, p.y, drag.from);
      setDrag({ ...drag, toX: p.x, toY: p.y, overTerminal: over });
    } else if (drag.kind === 'slider') {
      const comp = doc.components.find((c) => c.id === drag.id);
      if (comp) {
        // 元件本地 x：12..52 → slider 0..1（考虑旋转取局部坐标）
        const local = toLocal(comp, p.x, p.y);
        store.getState().setSlider(drag.id, (local.x - 12) / 40);
      }
    } else if (drag.kind === 'wireMid') {
      // 拖动导线通道：沿轴吸附到网格，端点不动
      store.getState().setWireMid(drag.id, drag.axis, snap(drag.axis === 'x' ? p.x : p.y));
    }
  };

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    pinchRef.current.delete(e.pointerId);
    (svgRef.current as unknown as { _lastPinch?: number })._lastPinch = undefined;
    const p = toSvg(e.clientX, e.clientY);
    if (placing) {
      store.getState().addComponent(placing, snap(p.x) / GRID, snap(p.y) / GRID);
      setPlacing(null);
      setGhost(null);
      return;
    }
    if (drag?.kind === 'wire' && drag.overTerminal) {
      store.getState().addWire(drag.from, drag.overTerminal);
    }
    // 轻点开关 = 切换通断（在 pointerup 显式处理，避免依赖被指针捕获吞掉的 onClick）
    const press = pressRef.current;
    if (press && !press.moved && press.type === 'switch' && !readOnly) {
      store.getState().toggleSwitch(press.id);
    }
    pressRef.current = null;
    setDrag(null);
  };

  /* —— 电势归一化（能量化端子 min/max） —— */
  let potMin = Infinity;
  let potMax = -Infinity;
  if (viz.potential) {
    for (const [k, v] of result.potentials) {
      if (result.energized.get(k)) {
        potMin = Math.min(potMin, v);
        potMax = Math.max(potMax, v);
      }
    }
  }
  const potT = (termKey: string): number | null => {
    if (!result.energized.get(termKey)) return null;
    if (potMax - potMin < 1e-9) return 0.5;
    return ((result.potentials.get(termKey) ?? 0) - potMin) / (potMax - potMin);
  };

  return (
    <svg
      ref={svgRef}
      className="circuit-canvas"
      style={{ touchAction: 'none', width: '100%', height: '100%', display: 'block' }}
      viewBox={circuitViewBox(vb.x, vb.y, vb.scale, size.w, size.h)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <SharedDefs />
      <defs>
        <pattern id="grid-dots" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
          <circle cx={0.8} cy={0.8} r={0.8} fill="#C9BFA8" opacity="0.55" />
        </pattern>
      </defs>
      {/* 网格背景（超大矩形随视口） */}
      <rect x={vb.x - 200} y={vb.y - 200} width={6000} height={6000} fill="url(#grid-dots)" />

      {/* 导线层 */}
      <g>
        {doc.wires.map((w) => {
          const pts = wirePathPoints(doc, w);
          const kA = terminalKey(w.a);
          const color = viz.potential ? potentialColor(potT(kA)) : PALETTE.copper;
          const selected = selection === w.id;
          const axis = w.locked || readOnly ? null : wireChannelAxis(doc, w);
          const cursor = axis === 'x' ? 'ew-resize' : axis === 'y' ? 'ns-resize' : 'pointer';
          return (
            <g key={w.id} data-wire-id={w.id} style={{ cursor }}>
              <path d={ptsToPath(pts)} stroke="transparent" strokeWidth={14} fill="none" />
              <path
                d={ptsToPath(pts)}
                stroke={selected ? PALETTE.orangeDeep : color}
                strokeWidth={selected ? 5 : 3.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>
          );
        })}
      </g>

      {/* 连线预览 */}
      {drag?.kind === 'wire' && (
        <WirePreview doc={doc} from={drag.from} toX={drag.toX} toY={drag.toY} snapTo={drag.overTerminal} />
      )}

      {/* 元件层 */}
      <g>
        {doc.components.map((c) => (
          <ComponentView
            key={c.id}
            comp={c}
            selected={selection === c.id}
            potT={potT}
            readOnly={readOnly}
          />
        ))}
      </g>

      {/* 电流小点层（rAF 直改 DOM） */}
      {viz.dots && <DotsLayer />}

      {/* 放置 ghost */}
      {placing && ghost && (
        <g transform={`translate(${ghost.x} ${ghost.y})`} opacity={0.5} pointerEvents="none">
          <ArtFor comp={{ ...previewComp(placing) }} />
        </g>
      )}
    </svg>
  );
}

function previewComp(type: ComponentType): ComponentInstance {
  const def = REGISTRY[type];
  const params: Record<string, number> = {};
  for (const p of def.params) params[p.key] = p.default;
  return { id: '#ghost', type, x: 0, y: 0, rot: 0, params, state: def.initialState() };
}

function toLocal(c: ComponentInstance, px: number, py: number): { x: number; y: number } {
  const ox = px - c.x * GRID;
  const oy = py - c.y * GRID;
  const rad = (-c.rot * Math.PI) / 180;
  return { x: ox * Math.cos(rad) - oy * Math.sin(rad), y: ox * Math.sin(rad) + oy * Math.cos(rad) };
}

function findTerminalAt(doc: CircuitDoc, x: number, y: number, exclude: TerminalRef): TerminalRef | null {
  for (const c of doc.components) {
    const def = REGISTRY[c.type];
    for (let t = 0; t < def.terminals.length; t++) {
      if (c.id === exclude.comp && t === exclude.t) continue;
      const p = terminalPos(c, t);
      if (Math.hypot(p.x * GRID - x, p.y * GRID - y) < GRID * 0.9) return { comp: c.id, t };
    }
  }
  return null;
}

function WirePreview({
  doc,
  from,
  toX,
  toY,
  snapTo,
}: {
  doc: CircuitDoc;
  from: TerminalRef;
  toX: number;
  toY: number;
  snapTo: TerminalRef | null;
}) {
  const ca = doc.components.find((c) => c.id === from.comp);
  if (!ca) return null;
  const pa = terminalPos(ca, from.t);
  let ex = toX;
  let ey = toY;
  if (snapTo) {
    const cb = doc.components.find((c) => c.id === snapTo.comp);
    if (cb) {
      const pb = terminalPos(cb, snapTo.t);
      ex = pb.x * GRID;
      ey = pb.y * GRID;
    }
  }
  return (
    <g pointerEvents="none">
      <path
        d={`M${pa.x * GRID} ${pa.y * GRID} L${ex} ${ey}`}
        stroke={snapTo ? PALETTE.orangeDeep : '#B0A890'}
        strokeWidth={3.4}
        strokeDasharray={snapTo ? undefined : '6 5'}
        strokeLinecap="round"
        fill="none"
      />
      {snapTo && <circle cx={ex} cy={ey} r={7} fill="none" stroke={PALETTE.orangeDeep} strokeWidth={2.4} />}
    </g>
  );
}

function ArtFor({ comp }: { comp: ComponentInstance }) {
  const result = useCircuitStore((s) => s.result);
  const r = result.perComponent.get(comp.id);
  switch (comp.type) {
    case 'battery': {
      const hot =
        (result.short?.batteryIds.includes(comp.id) ?? false) ||
        ((comp.params.r ?? 0) > 0 && Math.abs(r?.I ?? 0) > 3);
      return <BatteryArt hot={hot} />;
    }
    case 'bulb':
      return <BulbArt brightness={r?.brightness ?? 0} blown={!!comp.state.blown} />;
    case 'resistor':
      return <ResistorArt overheat={Math.abs(r?.P ?? 0) > 5} />;
    case 'rheostat':
      return <RheostatArt slider={comp.state.slider ?? 0.5} />;
    case 'switch':
      return <SwitchArt closed={!!comp.state.closed} />;
    case 'voltmeter':
      return <MeterArt kind="V" reading={r?.reading ?? 0} fullScale={15} reversed={(r?.reading ?? 0) < -0.01} />;
    case 'ammeter':
      return <MeterArt kind="A" reading={r?.reading ?? 0} fullScale={3} reversed={(r?.reading ?? 0) < -0.01} />;
    case 'fuse':
      return <FuseArt blown={!!comp.state.blown} />;
  }
}

function ComponentView({
  comp,
  selected,
  potT,
  readOnly,
}: {
  comp: ComponentInstance;
  selected: boolean;
  potT: (k: string) => number | null;
  readOnly: boolean;
}) {
  const store = useCircuitStore;
  const viz = useCircuitStore((s) => s.viz);
  const def = REGISTRY[comp.type];
  const k0 = terminalKey({ comp: comp.id, t: 0 });
  const k1 = terminalKey({ comp: comp.id, t: 1 });
  void readOnly; // 交互（移动/开关）在画布指针处理里统一判定

  return (
    <g
      data-comp-id={comp.id}
      transform={`translate(${comp.x * GRID} ${comp.y * GRID}) rotate(${comp.rot})`}
      onPointerEnter={() => store.getState().setHovered(comp.id)}
      onPointerLeave={() => store.getState().setHovered(null)}
      style={{ cursor: comp.locked ? 'pointer' : 'grab' }}
    >
      {/* 命中区域 */}
      <rect x={-6} y={-40} width={GRID * 4 + 12} height={64} fill="transparent" />
      {selected && (
        <rect
          x={-8}
          y={-42}
          width={GRID * 4 + 16}
          height={68}
          rx={10}
          fill="none"
          stroke={PALETTE.orangeDeep}
          strokeWidth={2}
          strokeDasharray="7 5"
          opacity={0.9}
        />
      )}
      <ArtFor comp={comp} />
      {/* 端子 */}
      {def.terminals.map((td, i) => {
        const key = i === 0 ? k0 : k1;
        const t = potT(key);
        const fill = viz.potential ? potentialColor(t) : PALETTE.gold;
        return (
          <g key={i}>
            <circle
              data-term-comp={comp.id}
              data-term-idx={i}
              cx={i === 0 ? 0 : GRID * 4}
              cy={0}
              r={10}
              fill="transparent"
              style={{ cursor: 'crosshair' }}
            />
            <circle cx={i === 0 ? 0 : GRID * 4} cy={0} r={4.4} fill={fill} stroke="#8a7340" strokeWidth={1.2} pointerEvents="none" />
            {td.polarity && (
              <text
                x={(i === 0 ? 0 : GRID * 4) + (i === 0 ? -9 : 9)}
                y={-8}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill={PALETTE.dark}
                pointerEvents="none"
              >
                {td.polarity}
              </text>
            )}
          </g>
        );
      })}
      {comp.locked && (
        <text x={GRID * 2} y={26} textAnchor="middle" fontSize={9} fill="#9A8F76" pointerEvents="none">
          🔒
        </text>
      )}
    </g>
  );
}
