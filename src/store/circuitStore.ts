/**
 * 全局状态：电路文档 + 解算结果 + 画布交互状态 + 可视化开关。
 * 任何文档变更同步重解（毫秒级），熔断结果落回文档状态。
 */

import { create } from 'zustand';
import type { CircuitDoc, ComponentInstance, ComponentType, Rotation, TerminalRef, Wire } from '../model/types';
import { emptyDoc } from '../model/types';
import { makeComponent, newId, REGISTRY } from '../model/registry';
import { solve, type SolveResult } from '../solver/solve';

export interface VizToggles {
  /** 电流小点 */
  dots: boolean;
  /** 电势颜色梯度 */
  potential: boolean;
  /** 悬停 U/I/P 卡片 */
  hover: boolean;
}

interface CircuitStore {
  doc: CircuitDoc;
  result: SolveResult;
  /** 选中的元件或导线 id */
  selection: string | null;
  /** 正在悬停的元件 id */
  hovered: string | null;
  viz: VizToggles;
  /** 本次会话是否烧毁过元件或发生过短路（星级判定用） */
  everBlown: boolean;
  /** 本次会话是否发生过短路（短路教学关判定用） */
  everShort: boolean;

  /* —— 文档操作（全部触发重解） —— */
  loadDoc: (doc: CircuitDoc, keepEverBlown?: boolean) => void;
  clearDoc: () => void;
  addComponent: (type: ComponentType, x: number, y: number) => ComponentInstance;
  moveComponent: (id: string, x: number, y: number) => void;
  rotateComponent: (id: string) => void;
  removeItem: (id: string) => void;
  setParam: (id: string, key: string, value: number) => void;
  toggleSwitch: (id: string) => void;
  setSlider: (id: string, v: number) => void;
  addWire: (a: TerminalRef, b: TerminalRef) => void;
  setWireMid: (id: string, axis: 'x' | 'y', value: number) => void;
  clearWireMid: (id: string) => void;
  repairAll: () => void;

  /* —— 交互状态 —— */
  select: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  setViz: (patch: Partial<VizToggles>) => void;
}

/** 解算并把熔断落回文档（返回新的 doc + result） */
function resolveDoc(doc: CircuitDoc): { doc: CircuitDoc; result: SolveResult } {
  const result = solve(doc);
  if (result.blownIds.length > 0) {
    doc = {
      ...doc,
      components: doc.components.map((c) =>
        result.blownIds.includes(c.id) ? { ...c, state: { ...c.state, blown: true } } : c,
      ),
    };
  }
  return { doc, result };
}

export const useCircuitStore = create<CircuitStore>((set, get) => {
  const commit = (doc: CircuitDoc) => {
    const r = resolveDoc(doc);
    set({
      doc: r.doc,
      result: r.result,
      everBlown: get().everBlown || r.result.blownIds.length > 0 || r.result.short !== null,
      everShort: get().everShort || r.result.short !== null,
    });
  };

  return {
    doc: emptyDoc(),
    result: solve(emptyDoc()),
    selection: null,
    hovered: null,
    viz: { dots: true, potential: false, hover: false },
    everBlown: false,
    everShort: false,

    loadDoc: (doc, keepEverBlown = false) => {
      const r = resolveDoc(structuredClone(doc));
      set({
        doc: r.doc,
        result: r.result,
        selection: null,
        hovered: null,
        everBlown: keepEverBlown ? get().everBlown : false,
        everShort: keepEverBlown ? get().everShort : false,
      });
    },
    clearDoc: () => {
      set({ selection: null, hovered: null, everBlown: false, everShort: false });
      commit(emptyDoc());
    },
    addComponent: (type, x, y) => {
      const c = makeComponent(type, x, y);
      commit({ ...get().doc, components: [...get().doc.components, c] });
      set({ selection: c.id });
      return c;
    },
    moveComponent: (id, x, y) => {
      const { doc } = get();
      commit({ ...doc, components: doc.components.map((c) => (c.id === id ? { ...c, x, y } : c)) });
    },
    rotateComponent: (id) => {
      const { doc } = get();
      commit({
        ...doc,
        components: doc.components.map((c) =>
          c.id === id ? { ...c, rot: (((c.rot + 90) % 360) as Rotation) } : c,
        ),
      });
    },
    removeItem: (id) => {
      const { doc } = get();
      const comp = doc.components.find((c) => c.id === id);
      if (comp?.locked || doc.wires.find((w) => w.id === id)?.locked) return;
      commit({
        components: doc.components.filter((c) => c.id !== id),
        wires: doc.wires.filter((w) => w.id !== id && w.a.comp !== id && w.b.comp !== id),
      });
      if (get().selection === id) set({ selection: null });
    },
    setParam: (id, key, value) => {
      const { doc } = get();
      commit({
        ...doc,
        components: doc.components.map((c) =>
          c.id === id ? { ...c, params: { ...c.params, [key]: value } } : c,
        ),
      });
    },
    toggleSwitch: (id) => {
      const { doc } = get();
      commit({
        ...doc,
        components: doc.components.map((c) =>
          c.id === id && c.type === 'switch' ? { ...c, state: { ...c.state, closed: !c.state.closed } } : c,
        ),
      });
    },
    setSlider: (id, v) => {
      const { doc } = get();
      const cl = Math.min(1, Math.max(0, v));
      commit({
        ...doc,
        components: doc.components.map((c) =>
          c.id === id && c.type === 'rheostat' ? { ...c, state: { ...c.state, slider: cl } } : c,
        ),
      });
    },
    addWire: (a, b) => {
      const { doc } = get();
      if (a.comp === b.comp && a.t === b.t) return; // 同一端点
      const dup = doc.wires.some(
        (w) =>
          (w.a.comp === a.comp && w.a.t === a.t && w.b.comp === b.comp && w.b.t === b.t) ||
          (w.a.comp === b.comp && w.a.t === b.t && w.b.comp === a.comp && w.b.t === a.t),
      );
      if (dup) return;
      const wire: Wire = { id: newId('w'), a, b };
      commit({ ...doc, wires: [...doc.wires, wire] });
    },
    // 手动走线只改几何，不影响电学 → 直接更新 doc，保留现有 result（避免拖动时反复重解）
    setWireMid: (id, axis, value) => {
      const { doc } = get();
      set({
        doc: {
          ...doc,
          wires: doc.wires.map((w) => (w.id === id ? { ...w, mid: value, midAxis: axis } : w)),
        },
      });
    },
    clearWireMid: (id) => {
      const { doc } = get();
      set({
        doc: {
          ...doc,
          wires: doc.wires.map((w) =>
            w.id === id ? { ...w, mid: undefined, midAxis: undefined } : w,
          ),
        },
      });
    },
    repairAll: () => {
      const { doc } = get();
      commit({
        ...doc,
        components: doc.components.map((c) =>
          c.state.blown ? { ...c, state: { ...c.state, blown: false } } : c,
        ),
      });
    },

    select: (id) => set({ selection: id }),
    setHovered: (id) => set({ hovered: id }),
    setViz: (patch) => set({ viz: { ...get().viz, ...patch } }),
  };
});

/** 供关卡判定复用：在强制某开关状态下解算一份文档副本 */
export function solveWithSwitch(doc: CircuitDoc, switchId: string, closed: boolean): SolveResult {
  const copy: CircuitDoc = {
    ...doc,
    components: doc.components.map((c) =>
      c.id === switchId ? { ...c, state: { ...c.state, closed } } : { ...c, state: { ...c.state } },
    ),
  };
  return solve(copy);
}

export { REGISTRY };
