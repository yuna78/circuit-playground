/**
 * 电流小点流动动画：requestAnimationFrame 直改 DOM attribute，不经 React 重渲染。
 * 速度 ∝ 电流（封顶），方向 = 正电荷定向移动方向（a→b 为正）。
 * 视觉：电光青蓝双层小点（外圈光晕 + 内核），与金色端子明确区分；
 * 支路通/断电时整条支路的点淡入/淡出（不做瞬时显隐，减少闪跳）。
 */

import { useEffect, useRef } from 'react';
import { useCircuitStore } from '../store/circuitStore';
import { pointAt, polylineLength, wirePathPoints } from '../canvas/wirePath';
import { DOT_CORE, DOT_CORE_R, DOT_CORE_STROKE, DOT_HALO, DOT_HALO_R } from '../canvas/const';

/** 像素/秒 每安培 */
const SPEED_PER_AMP = 55;
const MAX_SPEED = 160;
/** 小点间距（px） */
const SPACING = 26;
const MIN_CURRENT = 1e-4;
/** 淡入淡出速率（透明度/秒） */
const FADE_RATE = 6;

export function DotsLayer() {
  const gRef = useRef<SVGGElement>(null);
  const phases = useRef<Map<string, number>>(new Map());
  /** 每条导线的显隐透明度（0..1），用于通断电时淡入淡出 */
  const alphas = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    /** 池化：每个"点"= 一个 <g>（外圈光晕 + 内核），用 transform 移动 */
    const pool: SVGGElement[] = [];

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

      // 收集本帧全部小点位置与透明度
      const positions: { x: number; y: number; a: number }[] = [];
      for (const w of doc.wires) {
        const I = result.wireCurrents.get(w.id) ?? 0;
        const flowing = Math.abs(I) > MIN_CURRENT;
        // 透明度向目标（通电=1 / 断电=0）渐变
        let alpha = alphas.current.get(w.id) ?? 0;
        alpha += (flowing ? 1 : -1) * FADE_RATE * dt;
        alpha = Math.min(1, Math.max(0, alpha));
        alphas.current.set(w.id, alpha);
        if (alpha < 0.03) continue;

        const pts = wirePathPoints(doc, w);
        if (pts.length < 2) continue;
        const len = polylineLength(pts);
        if (len < 4) continue;
        const n = Math.max(1, Math.floor(len / SPACING));
        let phase = phases.current.get(w.id) ?? 0;
        if (flowing) {
          const v = Math.sign(I) * Math.min(MAX_SPEED, Math.abs(I) * SPEED_PER_AMP);
          phase = (((phase + v * dt) % SPACING) + SPACING) % SPACING;
          phases.current.set(w.id, phase);
        }
        for (let k = 0; k < n; k++) {
          const s = (phase + k * SPACING) % len;
          const p = pointAt(pts, s);
          positions.push({ x: p.x, y: p.y, a: alpha });
        }
      }

      // 池化更新
      const NS = 'http://www.w3.org/2000/svg';
      while (pool.length < positions.length) {
        const item = document.createElementNS(NS, 'g');
        item.setAttribute('pointer-events', 'none');
        const halo = document.createElementNS(NS, 'circle');
        halo.setAttribute('r', String(DOT_HALO_R));
        halo.setAttribute('fill', DOT_HALO);
        halo.setAttribute('opacity', '0.35');
        const core = document.createElementNS(NS, 'circle');
        core.setAttribute('r', String(DOT_CORE_R));
        core.setAttribute('fill', DOT_CORE);
        core.setAttribute('stroke', DOT_CORE_STROKE);
        core.setAttribute('stroke-width', '0.7');
        item.appendChild(halo);
        item.appendChild(core);
        g.appendChild(item);
        pool.push(item);
      }
      for (let i = 0; i < pool.length; i++) {
        if (i < positions.length) {
          pool[i].setAttribute('visibility', 'visible');
          pool[i].setAttribute('transform', `translate(${positions[i].x} ${positions[i].y})`);
          pool[i].setAttribute('opacity', String(positions[i].a));
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
