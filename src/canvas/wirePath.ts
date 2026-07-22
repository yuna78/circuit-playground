/** 导线正交折线布线（画布渲染与电流小点动画共用） */

import type { CircuitDoc, Wire } from '../model/types';
import { terminalPos } from '../model/registry';
import { GRID } from './const';

export interface Pt {
  x: number;
  y: number;
}

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
  if (y1 === y2 || x1 === x2) {
    return [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
  }
  const midX = Math.round((x1 + x2) / 2 / GRID) * GRID;
  return [
    { x: x1, y: y1 },
    { x: midX, y: y1 },
    { x: midX, y: y2 },
    { x: x2, y: y2 },
  ];
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
