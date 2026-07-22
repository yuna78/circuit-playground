/**
 * 电流小点流动动画：requestAnimationFrame 直改 DOM attribute，不经 React 重渲染。
 * 速度 ∝ 电流（封顶），方向 = 正电荷定向移动方向（a→b 为正），I≈0 静止。
 */

import { useEffect, useRef } from 'react';
import { useCircuitStore } from '../store/circuitStore';
import { pointAt, polylineLength, wirePathPoints } from '../canvas/wirePath';

/** 像素/秒 每安培 */
const SPEED_PER_AMP = 55;
const MAX_SPEED = 160;
/** 小点间距（px） */
const SPACING = 26;
const MIN_CURRENT = 1e-4;

export function DotsLayer() {
  const gRef = useRef<SVGGElement>(null);
  const phases = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const pool: SVGCircleElement[] = [];

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = gRef.current;
      if (!g) return;
      const { doc, result, viz } = useCircuitStore.getState();
      if (!viz.dots) {
        for (const c of pool) c.setAttribute('visibility', 'hidden');
        return;
      }

      // 收集本帧全部小点位置
      const positions: { x: number; y: number }[] = [];
      for (const w of doc.wires) {
        const I = result.wireCurrents.get(w.id) ?? 0;
        const pts = wirePathPoints(doc, w);
        if (pts.length < 2) continue;
        const len = polylineLength(pts);
        if (len < 4) continue;
        const n = Math.max(1, Math.floor(len / SPACING));
        let phase = phases.current.get(w.id) ?? 0;
        if (Math.abs(I) > MIN_CURRENT) {
          const v = Math.sign(I) * Math.min(MAX_SPEED, Math.abs(I) * SPEED_PER_AMP);
          phase = (((phase + v * dt) % SPACING) + SPACING) % SPACING;
          phases.current.set(w.id, phase);
        }
        // 无电流也画静止点？——不画，减少视觉噪音
        if (Math.abs(I) <= MIN_CURRENT) continue;
        for (let k = 0; k < n; k++) {
          const s = (phase + k * SPACING) % len;
          positions.push(pointAt(pts, s));
        }
      }

      // 池化更新
      while (pool.length < positions.length) {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('r', '3');
        c.setAttribute('fill', '#FFC93C');
        c.setAttribute('stroke', '#D9880F');
        c.setAttribute('stroke-width', '0.8');
        c.setAttribute('pointer-events', 'none');
        g.appendChild(c);
        pool.push(c);
      }
      for (let i = 0; i < pool.length; i++) {
        if (i < positions.length) {
          pool[i].setAttribute('visibility', 'visible');
          pool[i].setAttribute('cx', String(positions[i].x));
          pool[i].setAttribute('cy', String(positions[i].y));
        } else {
          pool[i].setAttribute('visibility', 'hidden');
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <g ref={gRef} />;
}
