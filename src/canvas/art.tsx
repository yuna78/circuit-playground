/**
 * 元件卡通 SVG 美术（黏土玩具风：圆润、柔和渐变、高光、部分元件带表情）。
 * 本地坐标系：端子位于 (0,0) 与 (64,0)，旋转由父级 <g> 处理。
 * 所有状态（亮度/通断/熔断/发烫/指针/滑片）由 props 驱动。
 */

import { PALETTE as P, SPAN_PX } from './const';

/** 全局渐变与滤镜，挂在画布 <defs> 中一次 */
export function SharedDefs() {
  return (
    <defs>
      <linearGradient id="clay-hl" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0.08" />
        <stop offset="1" stopColor="#000" stopOpacity="0.12" />
      </linearGradient>
      <radialGradient id="bulb-glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor={P.glow} stopOpacity="0.95" />
        <stop offset="0.6" stopColor={P.glow} stopOpacity="0.45" />
        <stop offset="1" stopColor={P.glow} stopOpacity="0" />
      </radialGradient>
      <filter id="soft-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
      <filter id="heat-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>
  );
}

/** 可爱表情：眼睛 + 微笑 */
function Face({ cx, cy, s = 1, mood = 'happy' }: { cx: number; cy: number; s?: number; mood?: 'happy' | 'dizzy' }) {
  if (mood === 'dizzy') {
    // 烧毁/短路时的 ×× 眼
    const e = 3.2 * s;
    return (
      <g stroke={P.dark} strokeWidth={1.6 * s} strokeLinecap="round" fill="none">
        <path d={`M${cx - 6 * s - e} ${cy - e} l${2 * e} ${2 * e} M${cx - 6 * s - e} ${cy + e} l${2 * e} ${-2 * e}`} />
        <path d={`M${cx + 6 * s - e} ${cy - e} l${2 * e} ${2 * e} M${cx + 6 * s - e} ${cy + e} l${2 * e} ${-2 * e}`} />
        <path d={`M${cx - 3.5 * s} ${cy + 7 * s} q${3.5 * s} ${-3 * s} ${7 * s} 0`} />
      </g>
    );
  }
  return (
    <g>
      <circle cx={cx - 6 * s} cy={cy} r={2.1 * s} fill={P.dark} />
      <circle cx={cx + 6 * s} cy={cy} r={2.1 * s} fill={P.dark} />
      <circle cx={cx - 6.7 * s} cy={cy - 0.7 * s} r={0.7 * s} fill="#fff" />
      <circle cx={cx + 5.3 * s} cy={cy - 0.7 * s} r={0.7 * s} fill="#fff" />
      <path
        d={`M${cx - 3.5 * s} ${cy + 4.5 * s} q${3.5 * s} ${3.5 * s} ${7 * s} 0`}
        stroke={P.dark}
        strokeWidth={1.5 * s}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

/** 端子引脚（元件本体到端点的短导体） */
function Leads({ x1 = 8, x2 = SPAN_PX - 8 }: { x1?: number; x2?: number }) {
  return (
    <g stroke={P.silverDeep} strokeWidth="3.4" strokeLinecap="round">
      <line x1={0} y1={0} x2={x1} y2={0} />
      <line x1={x2} y1={0} x2={SPAN_PX} y2={0} />
    </g>
  );
}

/* ================= 电池 ================= */
export function BatteryArt({ hot }: { hot: boolean }) {
  return (
    <g>
      {hot && (
        <g className="heat-pulse" filter="url(#heat-glow)">
          <rect x={4} y={-18} width={56} height={36} rx={10} fill={P.heat} opacity={0.8} />
        </g>
      )}
      <Leads x1={6} x2={58} />
      {/* 负极端帽（右） + 正极凸点（左） */}
      <rect x={2} y={-6} width={7} height={12} rx={3} fill={P.silver} />
      <rect x={8} y={-15} width={30} height={30} rx={8} fill={P.orange} />
      <rect x={34} y={-15} width={22} height={30} rx={8} fill={P.dark} />
      <rect x={30} y={-15} width={8} height={30} fill={P.dark} />
      <rect x={8} y={-15} width={48} height={30} rx={8} fill="url(#clay-hl)" />
      {/* 极性标注 */}
      <path d="M14 -8 h6 M17 -11 v6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M44 8 h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <Face cx={22} cy={4} s={0.85} mood={hot ? 'dizzy' : 'happy'} />
    </g>
  );
}

/* ================= 灯泡 ================= */
export function BulbArt({ brightness, blown }: { brightness: number; blown: boolean }) {
  const b = blown ? 0 : brightness;
  const glassFill = blown ? '#D8D4CC' : b > 0.02 ? P.glassYellow : '#EFEede';
  return (
    <g>
      <Leads x1={20} x2={44} />
      {/* 辉光（半径与透明度随亮度） */}
      {b > 0.02 && (
        <circle cx={32} cy={-24} r={16 + 18 * b} fill="url(#bulb-glow)" opacity={0.35 + 0.65 * b} filter="url(#soft-glow)" />
      )}
      {/* 玻璃泡 */}
      <circle cx={32} cy={-24} r={16} fill={glassFill} stroke={blown ? '#B9B4A8' : '#E8D48A'} strokeWidth="1.5" />
      <circle cx={32} cy={-24} r={16} fill="url(#clay-hl)" opacity={0.5} />
      {/* 灯丝 */}
      {blown ? (
        <g stroke="#8A857A" strokeWidth="1.6" strokeLinecap="round" fill="none">
          <path d="M27 -14 v-6 l3 -3" />
          <path d="M37 -14 v-6 l-2 -2" />
          {/* 断口小烟 */}
          <path d="M32 -26 q2 -3 0 -6 q-2 -3 0 -5" stroke="#AAA" strokeWidth="1.2" opacity="0.8" />
        </g>
      ) : (
        <path
          d="M27 -14 v-5 l2 -4 l3 5 l3 -5 l2 4 v5"
          stroke={b > 0.05 ? '#E8862A' : '#9C957F'}
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {/* 螺口底座 */}
      <rect x={24} y={-12} width={16} height={12} rx={3} fill={P.silver} />
      <g stroke={P.silverDeep} strokeWidth="1.4">
        <line x1={24} y1={-8} x2={40} y2={-8} />
        <line x1={24} y1={-4} x2={40} y2={-4} />
      </g>
      <Face cx={32} cy={-26} s={0.75} mood={blown ? 'dizzy' : 'happy'} />
    </g>
  );
}

/* ================= 定值电阻 ================= */
export function ResistorArt({ overheat }: { overheat: boolean }) {
  return (
    <g>
      {overheat && (
        <g className="heat-pulse" filter="url(#heat-glow)">
          <rect x={10} y={-12} width={44} height={24} rx={11} fill={P.heat} opacity={0.75} />
        </g>
      )}
      <Leads x1={13} x2={51} />
      <rect x={12} y={-10} width={40} height={20} rx={10} fill={P.cream} stroke="#D9CBA8" strokeWidth="1" />
      {/* 色环 */}
      <rect x={19} y={-10} width={5} height={20} fill={P.red} />
      <rect x={27} y={-10} width={5} height={20} fill="#7D5BA6" />
      <rect x={35} y={-10} width={5} height={20} fill={P.orange} />
      <rect x={43} y={-10} width={5} height={20} fill={P.gold} />
      <rect x={12} y={-10} width={40} height={20} rx={10} fill="url(#clay-hl)" />
    </g>
  );
}

/* ================= 滑动变阻器 ================= */
export function RheostatArt({ slider }: { slider: number }) {
  const knobX = 12 + slider * 40; // 12..52
  return (
    <g>
      <Leads x1={7} x2={57} />
      <rect x={6} y={-9} width={52} height={18} rx={8} fill={P.navy} />
      <rect x={6} y={-9} width={52} height={18} rx={8} fill="url(#clay-hl)" />
      {/* 滑槽与刻度 */}
      <rect x={13} y={-3.2} width={38} height={6.4} rx={3.2} fill="#22394C" />
      <g stroke="#C6D2DC" strokeWidth="1" opacity="0.8">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <line key={i} x1={15 + i * 4.3} y1={6} x2={15 + i * 4.3} y2={8.4} />
        ))}
      </g>
      {/* 金色端钮 */}
      <circle cx={8.5} cy={0} r={3.4} fill={P.gold} />
      <circle cx={55.5} cy={0} r={3.4} fill={P.gold} />
      {/* 滑片旋钮（交互热区在画布层加大） */}
      <g data-role="rheostat-knob">
        <rect x={knobX - 6} y={-16} width={12} height={17} rx={3.5} fill={P.dark} />
        <rect x={knobX - 6} y={-16} width={12} height={17} rx={3.5} fill="url(#clay-hl)" />
        <line x1={knobX} y1={-13} x2={knobX} y2={-6} stroke="#F4EAD5" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </g>
  );
}

/* ================= 开关 ================= */
export function SwitchArt({ closed }: { closed: boolean }) {
  const angle = closed ? 0 : -32;
  return (
    <g>
      <Leads x1={10} x2={54} />
      <rect x={8} y={-6} width={48} height={16} rx={6} fill={P.cream} stroke="#DACFAF" strokeWidth="1" />
      <rect x={8} y={-6} width={48} height={16} rx={6} fill="url(#clay-hl)" />
      <circle cx={16} cy={0} r={3.6} fill={P.gold} />
      <circle cx={48} cy={0} r={3.6} fill={P.gold} />
      {/* 闸刀 */}
      <g transform={`rotate(${angle} 16 0)`}>
        <line x1={16} y1={0} x2={46} y2={0} stroke={P.dark} strokeWidth="4.6" strokeLinecap="round" />
        <circle cx={40} cy={0} r={4.6} fill={P.dark} />
        <circle cx={40} cy={-1.2} r={1.4} fill="#6E6A64" />
      </g>
      <circle cx={16} cy={0} r={2.2} fill={P.orangeDeep} />
    </g>
  );
}

/* ================= 电表（电压表/电流表共用） ================= */
export function MeterArt({
  kind,
  reading,
  fullScale,
  reversed,
}: {
  kind: 'V' | 'A';
  reading: number;
  fullScale: number;
  reversed: boolean;
}) {
  // 指针角度：0 读数 = −45°，满偏 = +45°；反接压向 −55°
  const frac = Math.min(1, Math.max(-0.12, reading / fullScale));
  const angle = -45 + frac * 90;
  const shell = kind === 'V' ? P.red : P.dark;
  return (
    <g>
      <Leads x1={12} x2={52} />
      <rect x={10} y={-34} width={44} height={40} rx={8} fill={shell} />
      <rect x={10} y={-34} width={44} height={40} rx={8} fill="url(#clay-hl)" />
      {/* 表盘 */}
      <path d="M14 2 v-26 a8 8 0 0 1 8 -8 h20 a8 8 0 0 1 8 8 v26 z" fill={P.cream} />
      {/* 刻度弧 */}
      <g stroke={P.dark} strokeWidth="1.2">
        {[-45, -22.5, 0, 22.5, 45].map((a) => (
          <line
            key={a}
            x1={32 + 16 * Math.sin((a * Math.PI) / 180)}
            y1={-6 - 16 * Math.cos((a * Math.PI) / 180)}
            x2={32 + 19 * Math.sin((a * Math.PI) / 180)}
            y2={-6 - 19 * Math.cos((a * Math.PI) / 180)}
          />
        ))}
      </g>
      <text x={32} y={-22} textAnchor="middle" fontSize="9" fontWeight="700" fill={P.dark}>
        {kind}
      </text>
      {/* 指针 */}
      <g transform={`rotate(${angle} 32 -4)`} style={{ transition: 'transform 120ms ease-out' }}>
        <line x1={32} y1={-4} x2={32} y2={-22} stroke={P.red === shell ? P.dark : P.red} strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <circle cx={32} cy={-4} r={2.4} fill={P.dark} />
      <Face cx={32} cy={-13} s={0.55} mood={reversed ? 'dizzy' : 'happy'} />
      {/* 接线柱极性 */}
      <circle cx={16} cy={2} r={3} fill={P.dark} />
      <circle cx={48} cy={2} r={3} fill={P.red} />
      <text x={16} y={12} textAnchor="middle" fontSize="8" fill={P.dark}>
        +
      </text>
      <text x={48} y={12} textAnchor="middle" fontSize="8" fill={P.dark}>
        −
      </text>
    </g>
  );
}

/* ================= 保险丝 ================= */
export function FuseArt({ blown }: { blown: boolean }) {
  return (
    <g>
      <Leads x1={11} x2={53} />
      <rect x={10} y={-8} width={10} height={16} rx={3} fill={P.silver} />
      <rect x={44} y={-8} width={10} height={16} rx={3} fill={P.silver} />
      <rect x={19} y={-7} width={26} height={14} rx={5} fill="#EDF3F5" opacity="0.9" stroke="#C6D0D4" strokeWidth="1" />
      {blown ? (
        <g>
          <line x1={21} y1={0} x2={28} y2={-2} stroke="#8A857A" strokeWidth="1.6" strokeLinecap="round" />
          <line x1={43} y1={0} x2={37} y2={2} stroke="#8A857A" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx={32} cy={0} r={2.4} fill="#6B675F" opacity="0.55" />
        </g>
      ) : (
        <line x1={21} y1={0} x2={43} y2={0} stroke="#8A857A" strokeWidth="1.6" strokeLinecap="round" />
      )}
      <rect x={19} y={-7} width={26} height={14} rx={5} fill="url(#clay-hl)" opacity="0.6" />
    </g>
  );
}
