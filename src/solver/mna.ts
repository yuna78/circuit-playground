/**
 * MNA（改进节点分析）矩阵组装与高斯消元求解。
 * 按"支路连通子网"独立求解：每个子网取第一个节点作参考地。
 * 无电压源的子网电流恒为 0，直接跳过求解。
 */

import type { Branch } from './netlist';

export interface MnaSolution {
  /** 节点 → 电势（参考地 = 0） */
  potential: Map<string, number>;
  /** 电压源支路索引（branches 数组下标）→ 电流（正方向：从外部流入 + 极；放电电池该值为负） */
  vsourceCurrent: Map<number, number>;
  /** 求解失败的子网中包含的节点（异常保护，标记为不可用） */
  failedNodes: Set<string>;
  /** 无电压源子网的节点（"未接通"灰显用） */
  sourcelessNodes: Set<string>;
}

/** 高斯消元（部分主元）。奇异返回 null */
export function gaussSolve(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    if (piv !== col) [M[piv], M[col]] = [M[col], M[piv]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}

/** 支路图连通分量划分（节点 → 子网编号） */
function subnets(branches: Branch[]): Map<string, number> {
  const adj = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
  };
  for (const br of branches) {
    const [a, b] = br.kind === 'resistor' ? [br.nodeA, br.nodeB] : [br.nodePlus, br.nodeMinus];
    add(a, b);
    add(b, a);
  }
  const comp = new Map<string, number>();
  let cid = 0;
  for (const start of adj.keys()) {
    if (comp.has(start)) continue;
    const stack = [start];
    comp.set(start, cid);
    while (stack.length) {
      const u = stack.pop()!;
      for (const v of adj.get(u) ?? []) {
        if (!comp.has(v)) {
          comp.set(v, cid);
          stack.push(v);
        }
      }
    }
    cid++;
  }
  return comp;
}

export function solveMna(branches: Branch[]): MnaSolution {
  const potential = new Map<string, number>();
  const vsourceCurrent = new Map<number, number>();
  const failedNodes = new Set<string>();
  const sourcelessNodes = new Set<string>();

  const comp = subnets(branches);
  const numSubnets = new Set(comp.values()).size;

  for (let s = 0; s < numSubnets; s++) {
    const nodes = [...comp.entries()].filter(([, c]) => c === s).map(([n]) => n);
    const brIdx = branches
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => comp.get(b.kind === 'resistor' ? b.nodeA : b.nodePlus) === s);

    const hasSource = brIdx.some(({ b }) => b.kind === 'vsource' && b.emf !== 0);
    if (!hasSource) {
      // 无源子网：电势统一置 0，电流 0（含 0V 电流表源）
      for (const n of nodes) {
        potential.set(n, 0);
        sourcelessNodes.add(n);
      }
      for (const { b, i } of brIdx) if (b.kind === 'vsource') vsourceCurrent.set(i, 0);
      continue;
    }

    // 参考地 = 子网第一个节点
    const ground = nodes[0];
    const unknowns = nodes.filter((n) => n !== ground);
    const nodeIdx = new Map(unknowns.map((n, i) => [n, i]));
    const vs = brIdx.filter(({ b }) => b.kind === 'vsource');
    const N = unknowns.length;
    const M = vs.length;
    const size = N + M;
    const A: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
    const rhs: number[] = Array(size).fill(0);

    for (const { b } of brIdx) {
      if (b.kind !== 'resistor') continue;
      const g = 1 / b.R;
      const ia = nodeIdx.get(b.nodeA);
      const ib = nodeIdx.get(b.nodeB);
      if (ia !== undefined) A[ia][ia] += g;
      if (ib !== undefined) A[ib][ib] += g;
      if (ia !== undefined && ib !== undefined) {
        A[ia][ib] -= g;
        A[ib][ia] -= g;
      }
    }
    vs.forEach(({ b }, k) => {
      if (b.kind !== 'vsource') return;
      const ip = nodeIdx.get(b.nodePlus);
      const im = nodeIdx.get(b.nodeMinus);
      const row = N + k;
      if (ip !== undefined) {
        A[ip][row] += 1; // 电流变量 = 从节点流入 + 极
        A[row][ip] += 1;
      }
      if (im !== undefined) {
        A[im][row] -= 1;
        A[row][im] -= 1;
      }
      rhs[row] = b.emf;
    });

    const x = gaussSolve(A, rhs);
    if (x === null) {
      for (const n of nodes) {
        potential.set(n, 0);
        failedNodes.add(n);
      }
      for (const { b, i } of brIdx) if (b.kind === 'vsource') vsourceCurrent.set(i, 0);
      continue;
    }
    potential.set(ground, 0);
    unknowns.forEach((n, i) => potential.set(n, x[i]));
    vs.forEach(({ i }, k) => vsourceCurrent.set(i, x[N + k]));
  }

  return { potential, vsourceCurrent, failedNodes, sourcelessNodes };
}
