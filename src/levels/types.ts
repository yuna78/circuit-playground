/** 关卡声明式定义（纯数据；新增关卡不改引擎代码） */

import type { CircuitDoc, ComponentType } from '../model/types';

/* —— 目标谓词 —— */
export type Predicate =
  /** 灯泡点亮（亮度 ≥ min，默认 0.15） */
  | { type: 'lit'; target: string; min?: number; label: string }
  /** 灯泡亮度区间 */
  | { type: 'brightnessRange'; target: string; min: number; max: number; label: string }
  /** 两个灯泡亮度相同（相对差 ≤ tol，默认 5%） */
  | { type: 'brightnessEqual'; targets: [string, string]; tol?: number; label: string }
  /** 电表读数区间（电压表 V / 电流表 A） */
  | { type: 'meterRange'; target: string; min: number; max: number; label: string }
  /** 指定元件电流区间（取绝对值） */
  | { type: 'currentRange'; target: string; min: number; max: number; label: string }
  /** 指定元件电压区间（取绝对值） */
  | { type: 'voltageRange'; target: string; min: number; max: number; label: string }
  /** 开关因果：强制某开关到指定状态后，子条件成立（多状态验证） */
  | { type: 'switchCausality'; switch: string; closed: boolean; then: Predicate[]; label: string }
  /** 未烧毁任何元件且未发生短路（本关会话内） */
  | { type: 'noBlown'; label: string }
  /** 场上元件总数 ≤ count（不含导线与锁定预置件） */
  | { type: 'maxComponents'; count: number; label: string }
  /** 发生过短路（教学关：故意制造短路来观察） */
  | { type: 'sawShort'; label: string };

export interface Level {
  id: string;
  chapter: number;
  /** 章内序号（1 起） */
  index: number;
  title: string;
  /** 引导文案（对孩子说的话） */
  intro: string;
  /** 可用元件与数量上限（不含预置） */
  palette: Partial<Record<ComponentType, number>>;
  /** 预置电路（元件可带 locked） */
  preset?: CircuitDoc;
  /** 过关目标（全部满足过关） */
  goals: Predicate[];
  /** 2 星与 3 星的附加条件（1 星 = 过关） */
  star2?: Predicate[];
  star3?: Predicate[];
  hints: string[];
}

export interface Chapter {
  num: number;
  title: string;
  subtitle: string;
  levels: Level[];
}
