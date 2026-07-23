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

  it('混合朝向（一横一竖）：不回头且正交', () => {
    const { d, w } = doc2(10, 6, 0, 16, 18, 90); // B 旋转 90° → 端子朝向变竖直
    const pts = wirePathPoints(d, w);
    expect(hasBacktrack(pts)).toBe(false);
    // 全部为水平/竖直段
    for (let i = 1; i < pts.length; i++) {
      const horiz = Math.abs(pts[i].y - pts[i - 1].y) < 0.01;
      const vert = Math.abs(pts[i].x - pts[i - 1].x) < 0.01;
      expect(horiz || vert).toBe(true);
    }
  });
});
