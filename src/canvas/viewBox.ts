/** 画布 viewBox 计算（纯函数，便于单测） */

/** 画布尺寸测量不到时的兜底值，保证 viewBox 永不为 0（否则整块画布空白） */
export const FALLBACK_W = 900;
export const FALLBACK_H = 600;

/**
 * 由平移/缩放状态与 SVG 客户端尺寸算出 viewBox 字符串。
 *
 * 关键不变量：clientW/clientH 在挂载首帧或布局未定时可能为 0，
 * 此时必须回落到非零兜底值——否则会输出 `x y 0 0`，画布整块空白。
 */
export function circuitViewBox(
  x: number,
  y: number,
  scale: number,
  clientW: number,
  clientH: number,
): string {
  const s = scale > 0 ? scale : 1;
  const w = (clientW > 0 ? clientW : FALLBACK_W) / s;
  const h = (clientH > 0 ? clientH : FALLBACK_H) / s;
  return `${x} ${y} ${w} ${h}`;
}
