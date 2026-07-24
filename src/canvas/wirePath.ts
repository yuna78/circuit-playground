/** 导线正交折线布线（画布渲染与电流小点动画共用） */

import type { CircuitDoc, ComponentInstance, Wire } from '../model/types';
import { REGISTRY, terminalPos } from '../model/registry';
import { GRID } from './const';

export interface Pt {
  x: number;
  y: number;
}

/** 端子朝外方向（网格单位）：取注册表端子声明的 dir（如变阻器 P 朝上），随旋转变换 */
function terminalDir(c: ComponentInstance, t: number): Pt {
  const local: Pt = REGISTRY[c.type].terminals[t]?.dir ?? { x: 1, y: 0 };
  switch (c.rot) {
    case 0:
      return local;
    case 90:
      return { x: -local.y, y: local.x };
    case 180:
      return { x: -local.x, y: -local.y };
    case 270:
      return { x: local.y, y: -local.x };
    default:
      return local;
  }
}

/** 去掉连续重复点，保持折线整洁（避免零长段） */
function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) out.push(p);
  }
  return out;
}

/**
 * 布线：让导线顺着端子朝向自然离开元件，绝不压在元件本体上，且不"回头"。
 *
 * - 两端同方向（都朝左/右 → 竖直通道；都朝上/下 → 水平通道）：
 *   通道对齐到"最外侧那个端子"——外侧端子直接直线接入，内侧端子沿朝外方向引出后进入通道。
 *   于是一端"直上直下"、另一端"引出即入通道"，全程不折返。
 * - 两端相向/背向（同为水平或竖直但方向相反）：通道取两端中点。
 * - 一端水平、一端竖直：单拐点 L 形，拐点让两段各自顺着自己端子的朝向。
 */
export function wirePathPoints(doc: CircuitDoc, w: Wire): Pt[] {
  const ca = doc.components.find((c) => c.id === w.a.comp);
  const cb = doc.components.find((c) => c.id === w.b.comp);
  if (!ca || !cb) return [];
  const pa = terminalPos(ca, w.a.t);
  const pb = terminalPos(cb, w.b.t);
  const x1 = pa.x * GRID;
  const y1 = pa.y * GRID;
  const x2 = pb.x * GRID;
  const y2 = pb.y * GRID;

  // 端子同行/同列：直连
  if (Math.abs(x1 - x2) < 0.01 || Math.abs(y1 - y2) < 0.01) {
    return dedupe([{ x: x1, y: y1 }, { x: x2, y: y2 }]);
  }

  const dA = terminalDir(ca, w.a.t);
  const dB = terminalDir(cb, w.b.t);
  const aH = dA.x !== 0; // A 端水平朝外
  const bH = dB.x !== 0; // B 端水平朝外

  let mids: Pt[];
  if (aH && bH) {
    // 都水平 → 竖直通道
    let channelX: number;
    if (w.midAxis === 'x' && typeof w.mid === 'number') channelX = w.mid; // 手动走线
    else if (dA.x === dB.x) channelX = dA.x < 0 ? Math.min(x1, x2) : Math.max(x1, x2);
    else channelX = (x1 + x2) / 2;
    mids = [
      { x: channelX, y: y1 },
      { x: channelX, y: y2 },
    ];
  } else if (!aH && !bH) {
    // 都竖直 → 水平通道
    let channelY: number;
    if (w.midAxis === 'y' && typeof w.mid === 'number') channelY = w.mid; // 手动走线
    else if (dA.y === dB.y) channelY = dA.y < 0 ? Math.min(y1, y2) : Math.max(y1, y2);
    else channelY = (y1 + y2) / 2;
    mids = [
      { x: x1, y: channelY },
      { x: x2, y: channelY },
    ];
  } else {
    // 混合：拐点让 A 先顺自己的朝向走
    mids = aH ? [{ x: x2, y: y1 }] : [{ x: x1, y: y2 }];
  }

  return dedupe([{ x: x1, y: y1 }, ...mids, { x: x2, y: y2 }]);
}

/**
 * 导线的"可拖动通道"轴：都水平朝外 → 'x'（竖直通道左右拖）；都竖直朝外 → 'y'（水平通道上下拖）。
 * 直连或混合走向无独立通道，返回 null（不可拖）。
 */
export function wireChannelAxis(doc: CircuitDoc, w: Wire): 'x' | 'y' | null {
  const ca = doc.components.find((c) => c.id === w.a.comp);
  const cb = doc.components.find((c) => c.id === w.b.comp);
  if (!ca || !cb) return null;
  const pa = terminalPos(ca, w.a.t);
  const pb = terminalPos(cb, w.b.t);
  if (pa.x === pb.x || pa.y === pb.y) return null; // 直连
  const dA = terminalDir(ca, w.a.t);
  const dB = terminalDir(cb, w.b.t);
  const aH = dA.x !== 0;
  const bH = dB.x !== 0;
  if (aH && bH) return 'x';
  if (!aH && !bH) return 'y';
  return null; // 混合
}

export const ptsToPath = (pts: Pt[]): string =>
  pts.length ? `M${pts.map((p) => `${p.x} ${p.y}`).join(' L')}` : '';

export function polylineLength(pts: Pt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

/** 折线上距起点 s 处的坐标（s 超界时截断） */
export function pointAt(pts: Pt[], s: number): Pt {
  let rest = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (rest <= seg || i === pts.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, rest / seg);
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
      };
    }
    rest -= seg;
  }
  return pts[0] ?? { x: 0, y: 0 };
}
