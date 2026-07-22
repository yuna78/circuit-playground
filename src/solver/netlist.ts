/**
 * CircuitDoc → 抽象网表编译
 * - 理想导线 / 闭合开关：union-find 节点合并
 * - 电阻类元件（电阻/灯泡/变阻器/电压表/保险丝）：电导支路
 * - 电池：电压源支路（内阻 r>0 时引入隐藏内部节点串联电阻）
 * - 电流表：0V 电压源支路（其电流变量即读数）
 * - 断开开关 / 烧毁元件：支路移除
 * - 纯电压源回路（电池被理想导体短接、电流表并电源等）：预检出 short 标记
 */

import type { CircuitDoc, ComponentInstance } from '../model/types';
import { terminalKey } from '../model/types';
import { BULB_BLOW_FACTOR, FUSE_R, RHEOSTAT_MIN_R, VOLTMETER_R } from '../model/registry';

/* ---------- union-find ---------- */
export class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
  connected(a: string, b: string): boolean {
    return this.find(a) === this.find(b);
  }
}

/* ---------- 网表类型 ---------- */
export interface ResistorBranch {
  kind: 'resistor';
  /** 所属元件 id（电池内阻支路为 `${id}#r`） */
  owner: string;
  nodeA: string;
  nodeB: string;
  R: number;
}
export interface VSourceBranch {
  kind: 'vsource';
  owner: string;
  /** MNA 电流变量正方向：从外部流入 nodePlus（放电电池为负，读数换算在 solve 层做） */
  nodePlus: string;
  nodeMinus: string;
  emf: number;
}
export type Branch = ResistorBranch | VSourceBranch;

export interface ShortInfo {
  /** 被短接的电池 id 列表 */
  batteryIds: string[];
  /** 参与短路回路的电流表 id 列表（电流表并电源场景） */
  ammeterIds: string[];
}

export interface Netlist {
  branches: Branch[];
  /** 端子 key → 电学节点（簇代表元） */
  nodeOf: Map<string, string>;
  /** 短路 / 电压源回路冲突信息，null = 无 */
  short: ShortInfo | null;
  /** 元件 id → 主支路索引（电池指电压源支路；开关/导线无支路） */
  branchOfComp: Map<string, number>;
}

const t0 = (c: ComponentInstance) => terminalKey({ comp: c.id, t: 0 });
const t1 = (c: ComponentInstance) => terminalKey({ comp: c.id, t: 1 });

/** 元件的等效电阻（电阻类支路），null = 不是电阻类或支路移除 */
export function resistanceOf(c: ComponentInstance): number | null {
  switch (c.type) {
    case 'resistor':
      return Math.max(c.params.R, 1e-6);
    case 'bulb': {
      if (c.state.blown) return null;
      const { ratedV, ratedP } = c.params;
      return (ratedV * ratedV) / ratedP;
    }
    case 'rheostat': {
      const slider = c.state.slider ?? 0.5;
      return Math.max(RHEOSTAT_MIN_R, slider * c.params.Rmax);
    }
    case 'voltmeter':
      return VOLTMETER_R;
    case 'fuse':
      return c.state.blown ? null : FUSE_R;
    default:
      return null;
  }
}

export function compile(doc: CircuitDoc): Netlist {
  const uf = new UnionFind();

  // 1) 理想导体合并：导线 + 闭合开关
  for (const w of doc.wires) uf.union(terminalKey(w.a), terminalKey(w.b));
  for (const c of doc.components) {
    if (c.type === 'switch' && c.state.closed) uf.union(t0(c), t1(c));
  }

  // 2) 纯电压源回路预检（理想电池 r=0 与电流表都是 0 电阻电压源）
  //    在"理想导体簇"图上对电压源边再做一次 union-find：成环 → 短路/冲突
  const vuf = new UnionFind();
  const short: ShortInfo = { batteryIds: [], ammeterIds: [] };
  const vEdges: { comp: ComponentInstance; a: string; b: string }[] = [];
  for (const c of doc.components) {
    if (c.type === 'battery' && (c.params.r ?? 0) === 0) {
      vEdges.push({ comp: c, a: uf.find(t0(c)), b: uf.find(t1(c)) });
    } else if (c.type === 'ammeter') {
      vEdges.push({ comp: c, a: uf.find(t0(c)), b: uf.find(t1(c)) });
    }
  }
  // 先记录环路里涉及的元件：任何使电压源边成环的边都标记
  for (const e of vEdges) {
    if (e.a === e.b || vuf.connected(e.a, e.b)) {
      // 成环：本边 + 已在同一连通块中的电压源边都算涉事
      if (e.comp.type === 'battery') short.batteryIds.push(e.comp.id);
      else short.ammeterIds.push(e.comp.id);
      // 找出与该环相关的其他电压源边（同一连通块）
      for (const o of vEdges) {
        if (o === e) continue;
        if (vuf.connected(o.a, e.a) || vuf.connected(o.a, e.b)) {
          if (o.comp.type === 'battery' && !short.batteryIds.includes(o.comp.id)) short.batteryIds.push(o.comp.id);
          if (o.comp.type === 'ammeter' && !short.ammeterIds.includes(o.comp.id)) short.ammeterIds.push(o.comp.id);
        }
      }
    } else {
      vuf.union(e.a, e.b);
    }
  }
  // 电流表间自环（两端并在一起）无害，剔除只含电流表且无电池的"环"？
  // —— 电流表被导线并联短接：读数 0 而已，不算危险。只有环中含电池才算短路。
  const isShort = short.batteryIds.length > 0;

  // 3) 组装支路
  const branches: Branch[] = [];
  const branchOfComp = new Map<string, number>();
  const nodeOf = new Map<string, string>();

  for (const c of doc.components) {
    const na = uf.find(t0(c));
    const nb = uf.find(t1(c));
    nodeOf.set(t0(c), na);
    nodeOf.set(t1(c), nb);

    if (c.type === 'battery') {
      if (isShort && short.batteryIds.includes(c.id)) continue; // 短路电池不进方程
      const r = c.params.r ?? 0;
      if (r > 0) {
        const mid = `#internal:${c.id}`;
        branchOfComp.set(c.id, branches.length);
        branches.push({ kind: 'vsource', owner: c.id, nodePlus: mid, nodeMinus: nb, emf: c.params.emf });
        branches.push({ kind: 'resistor', owner: `${c.id}#r`, nodeA: mid, nodeB: na, R: r });
      } else {
        branchOfComp.set(c.id, branches.length);
        branches.push({ kind: 'vsource', owner: c.id, nodePlus: na, nodeMinus: nb, emf: c.params.emf });
      }
      continue;
    }
    if (c.type === 'ammeter') {
      if (na === nb) continue; // 两端已并接，读数恒 0，无需支路
      branchOfComp.set(c.id, branches.length);
      branches.push({ kind: 'vsource', owner: c.id, nodePlus: na, nodeMinus: nb, emf: 0 });
      continue;
    }
    const R = resistanceOf(c);
    if (R !== null && na !== nb) {
      branchOfComp.set(c.id, branches.length);
      branches.push({ kind: 'resistor', owner: c.id, nodeA: na, nodeB: nb, R });
    }
  }

  return { branches, nodeOf, short: isShort ? short : null, branchOfComp };
}

export { BULB_BLOW_FACTOR };
