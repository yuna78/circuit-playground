/**
 * 解算编排：编译 → MNA 求解 → 元件量值 → 过载熔断迭代重解 → 导线电流后处理。
 * 纯函数：不修改传入的 doc；熔断发生在内部工作副本上，结果以 blownIds 返回。
 *
 * 符号约定：
 * - 元件贯穿电流 I：正方向 = 从端子 0 流入、端子 1 流出（元件内部 t0→t1）。
 * - U = V(t0) − V(t1)；P = U·I（耗能为正，电源放电为负）。
 * - 导线电流：正方向 = 从 a 端流向 b 端。
 */

import type { CircuitDoc } from '../model/types';
import { terminalKey } from '../model/types';
import { BULB_BLOW_FACTOR } from '../model/registry';
import { compile, type ShortInfo } from './netlist';
import { solveMna } from './mna';

export interface RheostatSection {
  /** 段电压（沿电流正方向：A→P / P→B） */
  U: number;
  /** 段电流（A→P / P→B 为正） */
  I: number;
  P: number;
  /** 段阻值 */
  R: number;
}

export interface ComponentResult {
  /** 贯穿电流（t0→t1 为正；变阻器为两段中电流较大一段的值） */
  I: number;
  /** 端电压 V(t0) − V(t1) */
  U: number;
  /** 功率（耗能为正；变阻器为两段功率之和） */
  P: number;
  /** 未接入任何带电源的回路 */
  unpowered: boolean;
  /** 电表读数（电压表 = U，电流表 = I），非电表为 undefined */
  reading?: number;
  /** 灯泡亮度 0..1（实际功率/额定功率，截断） */
  brightness?: number;
  /** 变阻器两段（[A–P, P–B]），仅 rheostat 有 */
  sections?: [RheostatSection, RheostatSection];
  /** 变阻器接入阻值：恰有一段通电流时 = 该段阻值（限流接法）；分压时 undefined */
  rIn?: number;
}

export interface SolveResult {
  /** 电源短路信息（含涉事电流表），null = 无 */
  short: ShortInfo | null;
  /** 端子 key → 电势（孤岛/无源子网为 0 且 unpowered） */
  potentials: Map<string, number>;
  /** 端子 key → 是否处于带电源的连通子网（电势视图着色 / 灰显用） */
  energized: Map<string, boolean>;
  perComponent: Map<string, ComponentResult>;
  /** 导线 id → 电流（a→b 为正）；闭合开关的贯穿电流也在 perComponent 里 */
  wireCurrents: Map<string, number>;
  /** 本次解算过程中熔断/烧毁的元件 id（调用方负责落回 doc 状态） */
  blownIds: string[];
}

const MAX_BLOW_ITER = 10;

export function solve(doc: CircuitDoc): SolveResult {
  // 工作副本（只复制会被熔断迭代修改的 state）
  const work: CircuitDoc = {
    components: doc.components.map((c) => ({ ...c, state: { ...c.state } })),
    wires: doc.wires,
  };
  const blownIds: string[] = [];

  let iter = 0;
  for (;;) {
    const net = compile(work);
    const mna = solveMna(net.branches);

    // —— 元件量值 ——
    const perComponent = new Map<string, ComponentResult>();
    const potentials = new Map<string, number>();
    const energized = new Map<string, boolean>();

    const nodePot = (termKey: string): number => {
      const node = net.nodeOf.get(termKey);
      return node !== undefined ? (mna.potential.get(node) ?? 0) : 0;
    };
    const isEnergized = (termKey: string): boolean => {
      const node = net.nodeOf.get(termKey);
      if (node === undefined) return false;
      return mna.potential.has(node) && !mna.sourcelessNodes.has(node) && !mna.failedNodes.has(node);
    };

    for (const c of work.components) {
      const k0 = terminalKey({ comp: c.id, t: 0 });
      const k1 = terminalKey({ comp: c.id, t: 1 });
      potentials.set(k0, nodePot(k0));
      potentials.set(k1, nodePot(k1));
      energized.set(k0, isEnergized(k0));
      energized.set(k1, isEnergized(k1));

      const U = nodePot(k0) - nodePot(k1);

      if (c.type === 'rheostat') {
        // 三接线柱：分别算 A–P / P–B 两段（悬空段电流自然为 0）
        const k2 = terminalKey({ comp: c.id, t: 2 });
        potentials.set(k2, nodePot(k2));
        energized.set(k2, isEnergized(k2));
        const s = Math.min(1, Math.max(0, c.state.slider ?? 0.5));
        const rb = net.rheostatBranches.get(c.id);
        const section = (idx: number | null, uSec: number, r: number): RheostatSection => {
          if (idx === null) return { U: 0, I: 0, P: 0, R: r }; // 两端并接：段被导线短接
          return { U: uSec, I: uSec / (net.branches[idx] as { R: number }).R, P: (uSec * uSec) / (net.branches[idx] as { R: number }).R, R: (net.branches[idx] as { R: number }).R };
        };
        const uAP = nodePot(k0) - nodePot(k2);
        const uPB = nodePot(k2) - nodePot(k1);
        const ap = section(rb?.ap ?? null, uAP, s * c.params.Rmax);
        const pb = section(rb?.pb ?? null, uPB, (1 - s) * c.params.Rmax);
        const EPS = 1e-6;
        const liveAP = Math.abs(ap.I) > EPS;
        const livePB = Math.abs(pb.I) > EPS;
        const res: ComponentResult = {
          I: Math.abs(ap.I) >= Math.abs(pb.I) ? ap.I : pb.I,
          U,
          P: ap.P + pb.P,
          unpowered: !isEnergized(k0) && !isEnergized(k1) && !isEnergized(k2),
          sections: [ap, pb],
          rIn: liveAP && !livePB ? ap.R : livePB && !liveAP ? pb.R : undefined,
        };
        perComponent.set(c.id, res);
        continue;
      }

      let I = 0;
      const brIdx = net.branchOfComp.get(c.id);
      if (brIdx !== undefined) {
        const br = net.branches[brIdx];
        if (br.kind === 'vsource') {
          I = mna.vsourceCurrent.get(brIdx) ?? 0;
        } else {
          I = U / br.R;
        }
      } else if (c.type === 'switch' && c.state.closed) {
        I = 0; // 闭合开关的贯穿电流由导线后处理阶段填充
      }

      const res: ComponentResult = {
        I,
        U,
        P: U * I,
        unpowered: !isEnergized(k0) && !isEnergized(k1),
      };
      if (c.type === 'voltmeter') res.reading = U;
      if (c.type === 'ammeter') res.reading = I;
      if (c.type === 'bulb') {
        res.brightness = c.state.blown ? 0 : Math.min(1, Math.max(0, res.P / c.params.ratedP));
      }
      perComponent.set(c.id, res);
    }

    // —— 过载检查（短路状态下不做熔断判定，短路本身已是终态反馈） ——
    const newlyBlown: string[] = [];
    if (!net.short) {
      for (const c of work.components) {
        if (c.state.blown) continue;
        const r = perComponent.get(c.id)!;
        if (c.type === 'fuse' && Math.abs(r.I) > c.params.ratedI) newlyBlown.push(c.id);
        if (c.type === 'bulb' && r.P > BULB_BLOW_FACTOR * c.params.ratedP) newlyBlown.push(c.id);
      }
    }
    if (newlyBlown.length > 0 && iter < MAX_BLOW_ITER) {
      for (const id of newlyBlown) {
        const c = work.components.find((x) => x.id === id)!;
        c.state.blown = true;
        blownIds.push(id);
      }
      iter += 1;
      continue; // 拓扑变化，重解
    }

    // —— 导线 / 闭合开关电流后处理（簇内生成树流量分配） ——
    const wireCurrents = computeWireCurrents(work, perComponent);

    return { short: net.short, potentials, energized, perComponent, wireCurrents, blownIds };
  }
}

/**
 * 同一电学节点（簇）内部：端子注入电流已知，导线+闭合开关构成图。
 * 取生成树，树边电流由子树注入和唯一确定；环路边电流置 0。
 */
function computeWireCurrents(
  doc: CircuitDoc,
  perComponent: Map<string, ComponentResult>,
): Map<string, number> {
  type Edge = { id: string; a: string; b: string; isSwitch?: string };
  const edges: Edge[] = [];
  for (const w of doc.wires) {
    edges.push({ id: w.id, a: terminalKey(w.a), b: terminalKey(w.b) });
  }
  for (const c of doc.components) {
    if (c.type === 'switch' && c.state.closed) {
      edges.push({
        id: `#sw:${c.id}`,
        a: terminalKey({ comp: c.id, t: 0 }),
        b: terminalKey({ comp: c.id, t: 1 }),
        isSwitch: c.id,
      });
    }
  }

  // 端子注入：+I 在 t1（元件流出），−I 在 t0（元件吸入）
  const injection = new Map<string, number>();
  const addInj = (k: string, v: number) => injection.set(k, (injection.get(k) ?? 0) + v);
  for (const c of doc.components) {
    if (c.type === 'switch') continue; // 开关自身是边，不是注入
    const r = perComponent.get(c.id);
    if (!r) continue;
    if (c.type === 'rheostat' && r.sections) {
      // 三端子注入：A 吸入 I_ap，P 收 I_ap 放 I_pb，B 流出 I_pb
      const [ap, pb] = r.sections;
      addInj(terminalKey({ comp: c.id, t: 0 }), -ap.I);
      addInj(terminalKey({ comp: c.id, t: 2 }), ap.I - pb.I);
      addInj(terminalKey({ comp: c.id, t: 1 }), +pb.I);
      continue;
    }
    if (r.I === 0) continue;
    addInj(terminalKey({ comp: c.id, t: 0 }), -r.I);
    addInj(terminalKey({ comp: c.id, t: 1 }), +r.I);
  }

  // 邻接表（顶点 = 端子 key）
  const adj = new Map<string, { edge: Edge; other: string }[]>();
  const vertices = new Set<string>();
  for (const e of edges) {
    vertices.add(e.a);
    vertices.add(e.b);
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a)!.push({ edge: e, other: e.b });
    adj.get(e.b)!.push({ edge: e, other: e.a });
  }

  const currents = new Map<string, number>();
  for (const e of edges) currents.set(e.id, 0);

  const visited = new Set<string>();
  for (const root of vertices) {
    if (visited.has(root)) continue;
    // 迭代式 DFS 建生成树
    const parentEdge = new Map<string, Edge>();
    const parent = new Map<string, string>();
    const order: string[] = [];
    const stack = [root];
    visited.add(root);
    const usedEdges = new Set<string>();
    while (stack.length) {
      const u = stack.pop()!;
      order.push(u);
      for (const { edge, other } of adj.get(u) ?? []) {
        if (visited.has(other) || usedEdges.has(edge.id)) continue;
        visited.add(other);
        usedEdges.add(edge.id);
        parent.set(other, u);
        parentEdge.set(other, edge);
        stack.push(other);
      }
    }
    // 自底向上累计子树注入 → 树边电流
    const subtreeSum = new Map<string, number>();
    for (const v of order) subtreeSum.set(v, injection.get(v) ?? 0);
    for (let i = order.length - 1; i >= 1; i--) {
      const v = order[i];
      const p = parent.get(v);
      if (p === undefined) continue;
      const sum = subtreeSum.get(v)!;
      subtreeSum.set(p, subtreeSum.get(p)! + sum);
      const e = parentEdge.get(v)!;
      // 子树净注入 sum 需经该边流向父节点：v→p 方向电流 = sum
      // 边正方向为 a→b：若 v === e.a 则 a→b 电流 = sum，否则 = −sum
      currents.set(e.id, v === e.a ? sum : -sum);
    }
  }

  // 闭合开关贯穿电流写回 perComponent（t0→t1 为正 = 边 a→b 方向）
  for (const e of edges) {
    if (e.isSwitch) {
      const r = perComponent.get(e.isSwitch);
      if (r) {
        r.I = currents.get(e.id) ?? 0;
        r.P = 0;
      }
    }
  }

  // 剔除内部开关伪导线，只保留真实导线 id
  const out = new Map<string, number>();
  for (const w of doc.wires) out.set(w.id, currents.get(w.id) ?? 0);
  return out;
}
