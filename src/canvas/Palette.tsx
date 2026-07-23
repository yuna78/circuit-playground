/** 元件抽屉：点选进入放置模式（支持鼠标与触摸），移到画布上落子 */

import { REGISTRY } from '../model/registry';
import type { ComponentType } from '../model/types';
import { usePlacingStore } from './CircuitCanvas';

const ICONS: Record<ComponentType, string> = {
  battery: '🔋',
  bulb: '💡',
  resistor: '🟫',
  rheostat: '🎚️',
  switch: '🔀',
  voltmeter: '🔴',
  ammeter: '⚫',
  fuse: '🧯',
};

export interface PaletteProps {
  /** 允许的元件与剩余数量；undefined = 全部不限量（沙盒） */
  allowance?: Partial<Record<ComponentType, number>>;
}

export function Palette({ allowance }: PaletteProps) {
  const { placing, setPlacing } = usePlacingStore();
  const types = (Object.keys(REGISTRY) as ComponentType[]).filter(
    (t) => allowance === undefined || (allowance[t] ?? 0) > 0,
  );
  return (
    <div className="palette">
      <div className="palette-title">元件箱</div>
      {types.map((t) => {
        const left = allowance?.[t];
        return (
          <button
            key={t}
            className={`palette-item ${placing === t ? 'active' : ''}`}
            onPointerDown={(e) => {
              e.preventDefault();
              // 触摸端有"隐式指针捕获"：捕获落在 pointerdown 的 target（可能是按钮内的
              // 图标/文字 span）上，后续 move/up 全发给它，画布收不到。释放后事件按命中
              // 测试分发 —— 手指拖到画布上，画布的 move 画 ghost、up 落子，从而同时支持
              // "点选再点画布"与"按住直接拖入画布"两种手势。
              const captor = e.target as Element;
              if (captor.hasPointerCapture?.(e.pointerId)) {
                captor.releasePointerCapture(e.pointerId);
              }
              setPlacing(placing === t ? null : t);
            }}
          >
            <span className="palette-icon">{ICONS[t]}</span>
            <span className="palette-name">{REGISTRY[t].name}</span>
            {left !== undefined && <span className="palette-count">×{left}</span>}
          </button>
        );
      })}
      <div className="palette-tip">{placing ? '移到画布上点击放置' : '点选元件，再点画布放置；从元件金色端点拖出导线'}</div>
    </div>
  );
}
