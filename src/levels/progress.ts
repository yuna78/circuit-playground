/** 关卡进度与沙盒存档（localStorage，版本化 key 防格式升级冲突） */

import type { CircuitDoc } from '../model/types';

const PROGRESS_KEY = 'circuit-playground:progress:v1';
const SANDBOX_KEY = 'circuit-playground:sandbox:v1';

export interface Progress {
  /** levelId → 最高星级 1..3 */
  stars: Record<string, number>;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) return JSON.parse(raw) as Progress;
  } catch {
    /* 损坏则重置 */
  }
  return { stars: {} };
}

export function saveStar(levelId: string, stars: number): Progress {
  const p = loadProgress();
  p.stars[levelId] = Math.max(p.stars[levelId] ?? 0, stars);
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  return p;
}

/** 章节是否解锁：第 1 章恒解锁；其余需上一章至少通过一关…
 * 口径：上一章全部关卡至少 1 星 → 解锁下一章（顺序推进） */
export function chapterUnlocked(chapterNum: number, levelIdsOfPrev: string[]): boolean {
  if (chapterNum <= 1) return true;
  const p = loadProgress();
  return levelIdsOfPrev.every((id) => (p.stars[id] ?? 0) >= 1);
}

/* —— 沙盒存档 —— */
export interface SandboxSave {
  doc: CircuitDoc;
  viz: { dots: boolean; potential: boolean; hover: boolean };
}

export function loadSandbox(): SandboxSave | null {
  try {
    const raw = localStorage.getItem(SANDBOX_KEY);
    if (raw) return JSON.parse(raw) as SandboxSave;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveSandbox(save: SandboxSave): void {
  localStorage.setItem(SANDBOX_KEY, JSON.stringify(save));
}

export function clearSandbox(): void {
  localStorage.removeItem(SANDBOX_KEY);
}
