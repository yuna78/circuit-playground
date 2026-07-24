/** 画布共享常量 */

/** 一个网格 = 16px */
export const GRID = 16;
/** 标准元件端子间距（网格数），与注册表 span 一致 */
export const SPAN_PX = 4 * GRID;

/** 定调图配色（黏土玩具风） */
export const PALETTE = {
  orange: '#F0982E',
  orangeDeep: '#D97E14',
  dark: '#33312E',
  cream: '#F4EAD5',
  navy: '#33556E',
  red: '#C24438',
  gold: '#D9A441',
  silver: '#C9C9D2',
  silverDeep: '#9C9CA8',
  copper: '#8A8F98',
  glassYellow: '#FFE9A8',
  glow: '#FFD84D',
  heat: '#FF5A36',
} as const;

/** 电流小点（流动动画）——电光青蓝，与金色端子明确区分；内核小于端子圆点(r=4.4) */
export const DOT_CORE = '#3ED0F0';
export const DOT_CORE_STROKE = '#1893B8';
export const DOT_HALO = '#7FE3FA';
export const DOT_CORE_R = 2.6;
export const DOT_HALO_R = 5;

/** 电势梯度着色：t ∈ [0,1]（0 = 最低电势，1 = 最高），未接通传 null */
export function potentialColor(t: number | null): string {
  if (t === null) return '#9AA0A6';
  // 冷(蓝) → 暖(红橙)
  const hue = 215 - 195 * Math.min(1, Math.max(0, t));
  return `hsl(${hue} 78% 52%)`;
}
