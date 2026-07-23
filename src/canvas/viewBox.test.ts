import { describe, it, expect } from 'vitest';
import { circuitViewBox, FALLBACK_W, FALLBACK_H } from './viewBox';

describe('circuitViewBox', () => {
  it('正常尺寸：直接用 clientWidth/Height（scale=1）', () => {
    expect(circuitViewBox(-80, -160, 1, 1064, 744)).toBe('-80 -160 1064 744');
  });

  it('缩放：宽高按 scale 缩放', () => {
    expect(circuitViewBox(0, 0, 2, 1000, 600)).toBe('0 0 500 300');
  });

  it('回归：挂载首帧 clientWidth=0 时回落兜底，绝不输出 0 尺寸 viewBox', () => {
    // 曾经的 bug：viewBox 输出 "-80 -160 0 0"，整块画布空白
    expect(circuitViewBox(-80, -160, 1, 0, 0)).toBe(`-80 -160 ${FALLBACK_W} ${FALLBACK_H}`);
  });

  it('回归：单边为 0 也回落该边', () => {
    expect(circuitViewBox(0, 0, 1, 0, 744)).toBe(`0 0 ${FALLBACK_W} 744`);
    expect(circuitViewBox(0, 0, 1, 1064, 0)).toBe(`0 0 1064 ${FALLBACK_H}`);
  });

  it('scale 非法（0）时回落为 1，避免除零', () => {
    expect(circuitViewBox(0, 0, 0, 900, 600)).toBe('0 0 900 600');
  });
});
