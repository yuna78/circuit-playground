/** 目标谓词评估器：每次解算后运行；switchCausality 在文档副本上做多状态验证 */

import type { CircuitDoc } from '../model/types';
import type { SolveResult } from '../solver/solve';
import { solveWithSwitch } from '../store/circuitStore';
import type { Predicate } from './types';

export interface SessionFlags {
  /** 本关会话中是否烧毁过元件或发生过短路 */
  everBlown: boolean;
  /** 是否发生过短路（sawShort 教学关用） */
  sawShort: boolean;
}

export interface GoalStatus {
  pred: Predicate;
  ok: boolean;
}

export function evaluate(
  pred: Predicate,
  doc: CircuitDoc,
  result: SolveResult,
  flags: SessionFlags,
): boolean {
  switch (pred.type) {
    case 'lit': {
      const r = result.perComponent.get(pred.target);
      return (r?.brightness ?? 0) >= (pred.min ?? 0.15);
    }
    case 'brightnessRange': {
      const b = result.perComponent.get(pred.target)?.brightness ?? 0;
      return b >= pred.min && b <= pred.max;
    }
    case 'brightnessEqual': {
      const a = result.perComponent.get(pred.targets[0])?.brightness ?? 0;
      const b = result.perComponent.get(pred.targets[1])?.brightness ?? 0;
      if (a <= 0.02 || b <= 0.02) return false;
      return Math.abs(a - b) / Math.max(a, b) <= (pred.tol ?? 0.05);
    }
    case 'meterRange': {
      const reading = result.perComponent.get(pred.target)?.reading;
      if (reading === undefined) return false;
      return reading >= pred.min && reading <= pred.max;
    }
    case 'currentRange': {
      const I = Math.abs(result.perComponent.get(pred.target)?.I ?? 0);
      return I >= pred.min && I <= pred.max;
    }
    case 'voltageRange': {
      const U = Math.abs(result.perComponent.get(pred.target)?.U ?? 0);
      return U >= pred.min && U <= pred.max;
    }
    case 'switchCausality': {
      // '@any'：场上存在某个开关满足因果即可（玩家自加开关无固定 id）
      const ids =
        pred.switch === '@any'
          ? doc.components.filter((c) => c.type === 'switch').map((c) => c.id)
          : [pred.switch];
      return ids.some((id) => {
        const sub = solveWithSwitch(doc, id, pred.closed);
        if (sub.short) return false;
        return pred.then.every((p) => evaluate(p, doc, sub, flags));
      });
    }
    case 'noBlown':
      return !flags.everBlown;
    case 'maxComponents':
      return doc.components.filter((c) => !c.locked).length <= pred.count;
    case 'sawShort':
      return flags.sawShort;
  }
}

export function evaluateGoals(
  goals: Predicate[],
  doc: CircuitDoc,
  result: SolveResult,
  flags: SessionFlags,
): GoalStatus[] {
  return goals.map((pred) => ({ pred, ok: evaluate(pred, doc, result, flags) }));
}

/** 星级结算：1 星 = 过关；2/3 星需附加条件全部满足 */
export function starRating(
  passed: boolean,
  star2: Predicate[] | undefined,
  star3: Predicate[] | undefined,
  doc: CircuitDoc,
  result: SolveResult,
  flags: SessionFlags,
): 0 | 1 | 2 | 3 {
  if (!passed) return 0;
  const s2ok = !star2 || star2.every((p) => evaluate(p, doc, result, flags));
  const s3ok = !star3 || star3.every((p) => evaluate(p, doc, result, flags));
  if (s2ok && s3ok) return 3;
  if (s2ok) return 2;
  return 1;
}
