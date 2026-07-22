/** 元件注册表：九种元件的中文名、参数、端子元数据（导线单列，不在此表） */

import type { ComponentInstance, ComponentType, Rotation } from './types';

export interface ParamDef {
  key: string;
  /** 中文名，如 "电动势" */
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface TerminalDef {
  /** 相对锚点的网格偏移（rot=0 时） */
  dx: number;
  dy: number;
  /** 极性标注：'+' | '-' | ''（电池、电表有极性） */
  polarity: '+' | '-' | '';
}

export interface ComponentDef {
  type: ComponentType;
  /** 中文名（对齐人教版初中物理术语） */
  name: string;
  terminals: TerminalDef[];
  params: ParamDef[];
  /** 初始运行状态 */
  initialState: () => ComponentInstance['state'];
  /** 占格宽度（rot=0 时横向），端子间距 */
  span: number;
}

const SPAN = 4;

export const REGISTRY: Record<ComponentType, ComponentDef> = {
  battery: {
    type: 'battery',
    name: '电池',
    span: SPAN,
    // 左端子为正极（电路图习惯：长线在左）
    terminals: [
      { dx: 0, dy: 0, polarity: '+' },
      { dx: SPAN, dy: 0, polarity: '-' },
    ],
    params: [
      { key: 'emf', label: '电动势', unit: 'V', min: 1.5, max: 12, step: 1.5, default: 3 },
      { key: 'r', label: '内阻', unit: 'Ω', min: 0, max: 5, step: 0.5, default: 0 },
    ],
    initialState: () => ({}),
  },
  bulb: {
    type: 'bulb',
    name: '灯泡',
    span: SPAN,
    terminals: [
      { dx: 0, dy: 0, polarity: '' },
      { dx: SPAN, dy: 0, polarity: '' },
    ],
    // 课本口径 "2.5V 0.75W"（≈0.3A），接 1~2 节干电池可正常点亮
    params: [
      { key: 'ratedV', label: '额定电压', unit: 'V', min: 1.5, max: 12, step: 0.5, default: 2.5 },
      { key: 'ratedP', label: '额定功率', unit: 'W', min: 0.25, max: 10, step: 0.25, default: 0.75 },
    ],
    initialState: () => ({ blown: false }),
  },
  resistor: {
    type: 'resistor',
    name: '定值电阻',
    span: SPAN,
    terminals: [
      { dx: 0, dy: 0, polarity: '' },
      { dx: SPAN, dy: 0, polarity: '' },
    ],
    params: [{ key: 'R', label: '阻值', unit: 'Ω', min: 1, max: 100, step: 1, default: 10 }],
    initialState: () => ({}),
  },
  rheostat: {
    type: 'rheostat',
    name: '滑动变阻器',
    span: SPAN,
    terminals: [
      { dx: 0, dy: 0, polarity: '' },
      { dx: SPAN, dy: 0, polarity: '' },
    ],
    params: [{ key: 'Rmax', label: '最大阻值', unit: 'Ω', min: 5, max: 200, step: 5, default: 20 }],
    initialState: () => ({ slider: 0.5 }),
  },
  switch: {
    type: 'switch',
    name: '开关',
    span: SPAN,
    terminals: [
      { dx: 0, dy: 0, polarity: '' },
      { dx: SPAN, dy: 0, polarity: '' },
    ],
    params: [],
    initialState: () => ({ closed: false }),
  },
  voltmeter: {
    type: 'voltmeter',
    name: '电压表',
    span: SPAN,
    terminals: [
      { dx: 0, dy: 0, polarity: '+' },
      { dx: SPAN, dy: 0, polarity: '-' },
    ],
    params: [],
    initialState: () => ({}),
  },
  ammeter: {
    type: 'ammeter',
    name: '电流表',
    span: SPAN,
    terminals: [
      { dx: 0, dy: 0, polarity: '+' },
      { dx: SPAN, dy: 0, polarity: '-' },
    ],
    params: [],
    initialState: () => ({}),
  },
  fuse: {
    type: 'fuse',
    name: '保险丝',
    span: SPAN,
    terminals: [
      { dx: 0, dy: 0, polarity: '' },
      { dx: SPAN, dy: 0, polarity: '' },
    ],
    params: [{ key: 'ratedI', label: '额定电流', unit: 'A', min: 0.5, max: 10, step: 0.5, default: 1 }],
    initialState: () => ({ blown: false }),
  },
};

/** 电压表内阻（大内阻模型，课本"内阻很大"口径） */
export const VOLTMETER_R = 10e6;
/** 滑动变阻器最小残余阻值，避免滑到底完全短路导致矩阵退化 */
export const RHEOSTAT_MIN_R = 0.05;
/** 保险丝自身微小电阻 */
export const FUSE_R = 0.02;
/** 灯泡超额定功率多少倍烧毁 */
export const BULB_BLOW_FACTOR = 2.0;

let seq = 0;
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}_${seq}_${Math.random().toString(36).slice(2, 7)}`;
}

export function makeComponent(type: ComponentType, x: number, y: number, rot: Rotation = 0): ComponentInstance {
  const def = REGISTRY[type];
  const params: Record<string, number> = {};
  for (const p of def.params) params[p.key] = p.default;
  return { id: newId(type), type, x, y, rot, params, state: def.initialState() };
}

/** 端子的绝对网格坐标（考虑旋转） */
export function terminalPos(c: ComponentInstance, t: number): { x: number; y: number } {
  const def = REGISTRY[c.type];
  const { dx, dy } = def.terminals[t];
  switch (c.rot) {
    case 0:
      return { x: c.x + dx, y: c.y + dy };
    case 90:
      return { x: c.x - dy, y: c.y + dx };
    case 180:
      return { x: c.x - dx, y: c.y - dy };
    case 270:
      return { x: c.x + dy, y: c.y - dx };
  }
}
