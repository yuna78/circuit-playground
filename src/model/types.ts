/** 电路文档数据模型 —— 画布、存档、关卡预置电路共用同一格式（可 JSON 序列化） */

export type ComponentType =
  | 'battery' // 电池
  | 'bulb' // 灯泡
  | 'resistor' // 定值电阻
  | 'rheostat' // 滑动变阻器
  | 'switch' // 开关
  | 'voltmeter' // 电压表
  | 'ammeter' // 电流表
  | 'fuse'; // 保险丝

export type Rotation = 0 | 90 | 180 | 270;

/** 元件可变运行状态（区别于 params：这些是玩的过程中变的） */
export interface ComponentState {
  /** 开关是否闭合 */
  closed?: boolean;
  /** 保险丝熔断 / 灯泡烧毁 */
  blown?: boolean;
  /** 滑动变阻器滑片位置 0..1（0 = 阻值最小端） */
  slider?: number;
}

export interface ComponentInstance {
  id: string;
  type: ComponentType;
  /** 锚点（左端子）所在网格坐标，整数 */
  x: number;
  y: number;
  rot: Rotation;
  /** 电学参数，键由注册表的 paramSchema 定义，如 { emf: 3, r: 0 } */
  params: Record<string, number>;
  state: ComponentState;
  /** 关卡预置电路中锁定：不可移动/删除/改参数（可交互态仍可动，如开关） */
  locked?: boolean;
}

/** 端子引用：元件 id + 端子序号 */
export interface TerminalRef {
  comp: string;
  t: number;
}

/** 导线：端子到端子，渲染为正交折线（路径由布线算法算出） */
export interface Wire {
  id: string;
  a: TerminalRef;
  b: TerminalRef;
  locked?: boolean;
  /** 手动走线：通道坐标覆盖值（配合 midAxis）。未设置时由布线算法自动决定 */
  mid?: number;
  /** mid 作用的轴：'x' = 竖直通道左右移，'y' = 水平通道上下移 */
  midAxis?: 'x' | 'y';
}

export interface CircuitDoc {
  components: ComponentInstance[];
  wires: Wire[];
}

export const emptyDoc = (): CircuitDoc => ({ components: [], wires: [] });

export const terminalKey = (r: TerminalRef): string => `${r.comp}:${r.t}`;
