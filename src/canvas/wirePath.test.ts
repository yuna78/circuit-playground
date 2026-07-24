import { describe, expect, it } from 'vitest';
import type { CircuitDoc } from '../model/types';
import { makeComponent, newId } from '../model/registry';
import { wirePathPoints, type Pt } from './wirePath';

/** 折线是否存在"回头"：任一坐标轴上先增后减或先减后增（在该轴有位移的段之间） */
function hasBacktrack(pts: Pt[]): boolean {
  for (const axis of ['x', 'y'] as const) {
    let dir = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i][axis] - pts[i - 1][axis];
      if (Math.abs(d) < 0.01) continue;
      const s = Math.sign(d);
      if (dir !== 0 && s !== dir) return true; // 同轴反向 = 回头
      dir = s;
    }
  }
  return false;
}

function doc2(ax: number, ay: number, arot: 0 | 90 | 180 | 270, bx: number, by: number, brot: 0 | 90 | 180 | 270) {
  const a = makeComponent('resistor', ax, ay, arot);
  const b = makeComponent('resistor', bx, by, brot);
  const d: CircuitDoc = {
    components: [a, b],
    wires: [{ id: newId('w'), a: { comp: a.id, t: 0 }, b: { comp: b.id, t: 0 } }],
  };
  return { d, w: d.wires[0] };
}

describe('导线布线（wirePath）', () => {
  it('两个左朝端子上下错位：不回头（用户报告的电池+场景）', () => {
    // A 在上 (14,6)，B 在下 (10,18)，都取端子 0（左朝）
    const { d, w } = doc2(14, 6, 0, 10, 18, 0);
    const pts = wirePathPoints(d, w);
    expect(hasBacktrack(pts)).toBe(false);
    // 竖直通道应对齐到更靠左的端子（B 的 t0 在 x=10*16=160）
    const xs = pts.map((p) => p.x);
    expect(Math.min(...xs)).toBe(160);
  });

  it('两个右朝端子上下错位：不回头', () => {
    const { d } = doc2(14, 6, 0, 10, 18, 0);
    // 用端子 1（右朝）
    const a = d.components[0];
    const b = d.components[1];
    const w = { id: 'wr', a: { comp: a.id, t: 1 }, b: { comp: b.id, t: 1 } };
    d.wires = [w];
    const pts = wirePathPoints(d, w);
    expect(hasBacktrack(pts)).toBe(false);
  });

  it('端子同行：直线两点', () => {
    const { d, w } = doc2(10, 10, 0, 20, 10, 0);
    const pts = wirePathPoints(d, w);
    expect(pts).toHaveLength(2);
  });

  it('混合朝向（一横一竖）：两端顺着朝向离开且全程正交', () => {
    // A (10,6) rot0 t0 朝左；B (16,18) rot90 t0 朝上——目标在 A 朝向的反侧，
    // 必须先沿朝向引出再绕行（不许穿过元件本体），此时"折返"是几何必然
    const { d, w } = doc2(10, 6, 0, 16, 18, 90);
    const pts = wirePathPoints(d, w);
    // A 端首段向左离开（顺 dir）
    expect(pts[1].x).toBeLessThan(pts[0].x);
    // B 端末段从上方进入（顺 dir：离开 B 是向上）
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    expect(prev.y).toBeLessThan(last.y);
    // 全部为水平/竖直段
    for (let i = 1; i < pts.length; i++) {
      const horiz = Math.abs(pts[i].y - pts[i - 1].y) < 0.01;
      const vert = Math.abs(pts[i].x - pts[i - 1].x) < 0.01;
      expect(horiz || vert).toBe(true);
    }
  });
});

describe('变阻器 P 端子（朝上）布线', () => {
  it('P 端子位置随滑片移动，导线从 P 向上离开', () => {
    const rh = makeComponent('rheostat', 10, 10, 0);
    rh.state.slider = 0.25;
    const b = makeComponent('resistor', 8, 2, 0);
    const d: CircuitDoc = {
      components: [rh, b],
      wires: [{ id: newId('w'), a: { comp: rh.id, t: 2 }, b: { comp: b.id, t: 1 } }],
    };
    const pts = wirePathPoints(d, d.wires[0]);
    // 起点 = P 端子（网格 x = 10 + 0.5 + 3×0.25 = 11.25 → 180px；y = 10 − 1.5 = 8.5 → 136px）
    expect(pts[0].x).toBeCloseTo(180, 1);
    expect(pts[0].y).toBeCloseTo(136, 1);
    // 首段沿 P 朝向（向上，y 减小）离开——绝不向下穿过变阻器本体
    expect(pts[1].y).toBeLessThan(pts[0].y);
    // 全程正交
    for (let i = 1; i < pts.length; i++) {
      const horiz = Math.abs(pts[i].y - pts[i - 1].y) < 0.01;
      const vert = Math.abs(pts[i].x - pts[i - 1].x) < 0.01;
      expect(horiz || vert).toBe(true);
    }
  });

  it('滑片移动后 P 端子 x 跟随变化', () => {
    const rh = makeComponent('rheostat', 10, 10, 0);
    rh.state.slider = 0.75;
    const b = makeComponent('resistor', 8, 2, 0);
    const d: CircuitDoc = {
      components: [rh, b],
      wires: [{ id: newId('w'), a: { comp: rh.id, t: 2 }, b: { comp: b.id, t: 1 } }],
    };
    const pts = wirePathPoints(d, d.wires[0]);
    expect(pts[0].x).toBeCloseTo((10 + 0.5 + 3 * 0.75) * 16, 1); // 204px
  });
});
