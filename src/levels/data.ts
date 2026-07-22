/** 前 5 章关卡内容（首发）。关卡 = 纯数据，新增关卡不改引擎。 */

import type { CircuitDoc, ComponentInstance, ComponentType, Rotation } from '../model/types';
import { REGISTRY } from '../model/registry';
import type { Chapter, Level } from './types';

/** 预置元件构建器（固定 id，供目标谓词引用） */
function pc(
  id: string,
  type: ComponentType,
  x: number,
  y: number,
  opts: {
    rot?: Rotation;
    params?: Record<string, number>;
    state?: ComponentInstance['state'];
    locked?: boolean;
  } = {},
): ComponentInstance {
  const def = REGISTRY[type];
  const params: Record<string, number> = {};
  for (const p of def.params) params[p.key] = p.default;
  Object.assign(params, opts.params ?? {});
  return {
    id,
    type,
    x,
    y,
    rot: opts.rot ?? 0,
    params,
    state: { ...def.initialState(), ...(opts.state ?? {}) },
    locked: opts.locked ?? false,
  };
}

const wire = (id: string, ca: string, ta: number, cb: string, tb: number) => ({
  id,
  a: { comp: ca, t: ta },
  b: { comp: cb, t: tb },
});

const doc = (components: ComponentInstance[], wires: CircuitDoc['wires'] = []): CircuitDoc => ({
  components,
  wires,
});

/* ================= 第 1 章 点亮它 ================= */

const L1_1: Level = {
  id: 'c1-1',
  chapter: 1,
  index: 1,
  title: '第一次点亮',
  intro: '欢迎来到电路乐园！电流要从电池正极（+）出发，穿过灯泡，再回到负极（−），形成一个完整的圈，灯才会亮。从金色端点拖出导线，把灯泡点亮吧！',
  palette: {},
  preset: doc([pc('bat1', 'battery', 6, 14, { locked: true }), pc('L1', 'bulb', 6, 5, { locked: true })]),
  goals: [{ type: 'lit', target: 'L1', label: '让灯泡亮起来' }],
  star2: [{ type: 'noBlown', label: '没有烧坏任何元件' }],
  hints: ['从电池 + 端点按住拖动，拉出一根导线，松手接到灯泡的一个端点上。', '再从灯泡另一个端点拉一根导线，接回电池的 − 端点，圈就闭合了！'],
};

const L1_2: Level = {
  id: 'c1-2',
  chapter: 1,
  index: 2,
  title: '听话的开关',
  intro: '灯总亮着可不行。在电路里加一个开关，让它像家里的电灯开关一样：闭合就亮，断开就灭。',
  palette: { switch: 1 },
  preset: doc([pc('bat1', 'battery', 6, 14, { locked: true }), pc('L1', 'bulb', 6, 5, { locked: true })]),
  goals: [
    {
      type: 'switchCausality',
      switch: '@any',
      closed: true,
      then: [{ type: 'lit', target: 'L1', label: '' }],
      label: '闭合开关时灯亮',
    },
    {
      type: 'switchCausality',
      switch: '@any',
      closed: false,
      then: [{ type: 'brightnessRange', target: 'L1', min: 0, max: 0.02, label: '' }],
      label: '断开开关时灯灭',
    },
  ],
  star2: [{ type: 'noBlown', label: '没有烧坏任何元件' }],
  hints: ['开关要串在电流的必经之路上——和灯泡在同一个圈里。', '点击开关可以让它闭合或断开，试试灯是不是跟着变。'],
};

const L1_3: Level = {
  id: 'c1-3',
  chapter: 1,
  index: 3,
  title: '危险！短路实验',
  intro: '这一关我们故意做一次"错误实验"：用一根导线直接把电池的 + 和 − 连起来（不经过灯泡），看看会发生什么。放心，这里是虚拟实验室，烧不坏真东西。',
  palette: {},
  preset: doc(
    [pc('bat1', 'battery', 6, 14, { locked: true }), pc('L1', 'bulb', 6, 5, { locked: true })],
    [wire('pw1', 'bat1', 0, 'L1', 0), wire('pw2', 'L1', 1, 'bat1', 1)],
  ),
  goals: [{ type: 'sawShort', label: '亲眼看到一次短路（电池冒火警告）' }],
  hints: ['再拉一根导线，直接从电池 + 接到电池 −。', '看到警告了吗？电流全从"近路"跑了，又大又危险——这就是短路。记住：真实生活里绝对不能这样做！'],
};

/* ================= 第 2 章 串联世界 ================= */

const L2_1: Level = {
  id: 'c2-1',
  chapter: 2,
  index: 1,
  title: '手拉手：两灯串联',
  intro: '把两个灯泡"手拉手"串成一串（电流先过一个、再过另一个），让它们同时亮起来。注意观察：它们比单独一个灯的时候暗！',
  palette: { switch: 1 },
  preset: doc([
    pc('bat1', 'battery', 6, 16, { locked: true }),
    pc('L1', 'bulb', 2, 5, { locked: true }),
    pc('L2', 'bulb', 12, 5, { locked: true }),
  ]),
  goals: [
    { type: 'brightnessRange', target: 'L1', min: 0.05, max: 0.6, label: '灯 1 亮（串联后变暗是正常的）' },
    { type: 'brightnessRange', target: 'L2', min: 0.05, max: 0.6, label: '灯 2 亮（串联后变暗是正常的）' },
  ],
  star2: [{ type: 'noBlown', label: '没有烧坏任何元件' }],
  star3: [
    {
      type: 'switchCausality',
      switch: '@any',
      closed: false,
      then: [
        { type: 'brightnessRange', target: 'L1', min: 0, max: 0.02, label: '' },
        { type: 'brightnessRange', target: 'L2', min: 0, max: 0.02, label: '' },
      ],
      label: '加一个开关，断开时两盏灯同时熄灭',
    },
  ],
  hints: [
    '电池 + → 灯 1 → 灯 2 → 电池 −，连成一条不分岔的路。',
    '如果哪个灯特别亮（满亮度），说明你接成并联了——检查电流是不是分岔了。',
    '串联电路里开关放在任何位置，都能同时控制所有灯。',
  ],
};

const L2_2: Level = {
  id: 'c2-2',
  chapter: 2,
  index: 2,
  title: '越串越暗',
  intro: '这里已经串好了两盏灯。请把第三盏灯也串进去（先删掉一根导线，把新灯插进缺口）。看看三盏灯是不是更暗了？想一想为什么。',
  palette: { bulb: 1 },
  preset: doc(
    [
      pc('bat1', 'battery', 8, 16, { locked: true }),
      pc('L1', 'bulb', 2, 5, { locked: true }),
      pc('L2', 'bulb', 12, 5, { locked: true }),
    ],
    [wire('pw1', 'bat1', 0, 'L1', 0), wire('pw2', 'L1', 1, 'L2', 0), wire('pw3', 'L2', 1, 'bat1', 1)],
  ),
  goals: [
    { type: 'brightnessRange', target: 'L1', min: 0.02, max: 0.3, label: '三灯串联：灯 1 更暗了' },
    { type: 'brightnessRange', target: 'L2', min: 0.02, max: 0.3, label: '三灯串联：灯 2 更暗了' },
  ],
  star2: [{ type: 'noBlown', label: '没有烧坏任何元件' }],
  hints: [
    '点选一根预置导线，删除它，串联的圈就断开了一个缺口。',
    '把新灯泡放进缺口位置，用两根导线把它接进去。',
    '电池的电压被三盏灯"分着用"，每盏灯分到的更少，所以更暗——这就是串联分压！',
  ],
};

const L2_3: Level = {
  id: 'c2-3',
  chapter: 2,
  index: 3,
  title: '一关全关',
  intro: '圣诞小彩灯就是串联的：一个开关管一整串。搭一个串联电路（两盏灯 + 一个开关），让开关一断，全部熄灭。',
  palette: { switch: 1 },
  preset: doc([
    pc('bat1', 'battery', 6, 16, { locked: true }),
    pc('L1', 'bulb', 2, 5, { locked: true }),
    pc('L2', 'bulb', 12, 5, { locked: true }),
  ]),
  goals: [
    { type: 'lit', target: 'L1', label: '灯 1 亮' },
    { type: 'lit', target: 'L2', label: '灯 2 亮' },
    {
      type: 'switchCausality',
      switch: '@any',
      closed: false,
      then: [
        { type: 'brightnessRange', target: 'L1', min: 0, max: 0.02, label: '' },
        { type: 'brightnessRange', target: 'L2', min: 0, max: 0.02, label: '' },
      ],
      label: '断开开关：两盏灯全灭',
    },
  ],
  star2: [{ type: 'noBlown', label: '没有烧坏任何元件' }],
  hints: ['串联电路只有一条路，开关断开 = 整条路断掉。', '开关放在串联圈的任何位置都可以。'],
};

/* ================= 第 3 章 并联世界 ================= */

const L3_1: Level = {
  id: 'c3-1',
  chapter: 3,
  index: 1,
  title: '并排点亮',
  intro: '换一种接法：让两盏灯"并排"各走各的路（电流分成两条支流）。这次它们都能达到最亮！比较一下和串联的区别。',
  palette: {},
  preset: doc([
    pc('bat1', 'battery', 6, 18, { locked: true }),
    pc('L1', 'bulb', 2, 5, { locked: true }),
    pc('L2', 'bulb', 12, 5, { locked: true }),
  ]),
  goals: [
    { type: 'brightnessRange', target: 'L1', min: 0.7, max: 1, label: '灯 1 达到明亮（并联才做得到）' },
    { type: 'brightnessRange', target: 'L2', min: 0.7, max: 1, label: '灯 2 达到明亮（并联才做得到）' },
  ],
  star2: [{ type: 'noBlown', label: '没有烧坏任何元件' }],
  hints: [
    '两盏灯的左端都连到电池 +，右端都连到电池 −——像梯子的两根横档。',
    '并联时每盏灯都直接享受电池的全部电压，所以都是最亮。',
  ],
};

const L3_2: Level = {
  id: 'c3-2',
  chapter: 3,
  index: 2,
  title: '各管各的',
  intro: '家里的台灯关了，冰箱可不能停！让开关只控制左边的灯 L1，断开它时右边的灯 L2 照样亮。',
  palette: { switch: 1 },
  preset: doc([
    pc('bat1', 'battery', 6, 18, { locked: true }),
    pc('L1', 'bulb', 2, 5, { locked: true }),
    pc('L2', 'bulb', 12, 5, { locked: true }),
  ]),
  goals: [
    { type: 'lit', target: 'L1', label: '开关闭合时：两盏灯都亮' },
    { type: 'lit', target: 'L2', label: '（继续）两盏灯都亮' },
    {
      type: 'switchCausality',
      switch: '@any',
      closed: false,
      then: [
        { type: 'brightnessRange', target: 'L1', min: 0, max: 0.02, label: '' },
        { type: 'lit', target: 'L2', label: '' },
      ],
      label: '断开开关：L1 灭，L2 依然亮',
    },
  ],
  star2: [{ type: 'noBlown', label: '没有烧坏任何元件' }],
  hints: ['先把两盏灯并联都点亮。', '开关要串在 L1 自己的支路上，而不是大家共用的干路上。'],
};

const L3_3: Level = {
  id: 'c3-3',
  chapter: 3,
  index: 3,
  title: '总闸与分闸',
  intro: '家里既有总闸（一断全断），每个房间又有自己的开关。用两个开关实现：S1 是总闸，S2 只管灯 L2。',
  palette: {},
  preset: doc([
    pc('bat1', 'battery', 6, 20, { locked: true }),
    pc('L1', 'bulb', 2, 5, { locked: true }),
    pc('L2', 'bulb', 14, 5, { locked: true }),
    pc('S1', 'switch', 2, 13, { state: { closed: true } }),
    pc('S2', 'switch', 14, 13, { state: { closed: true } }),
  ]),
  goals: [
    { type: 'lit', target: 'L1', label: '两个开关都闭合时：全亮' },
    { type: 'lit', target: 'L2', label: '（继续）全亮' },
    {
      type: 'switchCausality',
      switch: 'S1',
      closed: false,
      then: [
        { type: 'brightnessRange', target: 'L1', min: 0, max: 0.02, label: '' },
        { type: 'brightnessRange', target: 'L2', min: 0, max: 0.02, label: '' },
      ],
      label: '断开总闸 S1：全灭',
    },
    {
      type: 'switchCausality',
      switch: 'S2',
      closed: false,
      then: [
        { type: 'lit', target: 'L1', label: '' },
        { type: 'brightnessRange', target: 'L2', min: 0, max: 0.02, label: '' },
      ],
      label: '只断 S2：L2 灭，L1 还亮',
    },
  ],
  star2: [{ type: 'noBlown', label: '没有烧坏任何元件' }],
  hints: ['S1 放在干路上（电流分岔之前），S2 放在 L2 的支路上。', '先画干路：电池 + → S1 → 分岔点；再从分岔点画两条支路。'],
};

/* ================= 第 4 章 欧姆定律与电表 ================= */

const L4_1: Level = {
  id: 'c4-1',
  chapter: 4,
  index: 1,
  title: '电流表上岗',
  intro: '想知道电流有多大？请电流表出马！它要串联在电路里（让电流从它身体里穿过），注意让电流从 + 接线柱流进去。',
  palette: {},
  preset: doc([
    pc('bat1', 'battery', 6, 16, { locked: true }),
    pc('L1', 'bulb', 2, 5, { locked: true }),
    pc('AM1', 'ammeter', 12, 5, { locked: true }),
  ]),
  goals: [
    { type: 'lit', target: 'L1', label: '灯亮着' },
    { type: 'meterRange', target: 'AM1', min: 0.05, max: 3, label: '电流表读数为正（说明接法正确）' },
  ],
  star2: [{ type: 'noBlown', label: '没有烧坏任何元件（电流表不能直接接电池两端！）' }],
  hints: [
    '电流表和灯泡串成一条路：电池 + → 电流表 + → 电流表 − → 灯泡 → 电池 −。',
    '如果指针反打（读数为负），把电流表两端的导线对调。',
    '千万别把电流表单独接在电池两端——它内阻几乎为零，等于短路！',
  ],
};

const L4_2: Level = {
  id: 'c4-2',
  chapter: 4,
  index: 2,
  title: '电压表上岗',
  intro: '电压表测的是"两点之间的电压差"，所以它要并联在灯泡两端（像给灯泡搭个天桥）。它内阻很大，不会分走电流。',
  palette: {},
  preset: doc(
    [
      pc('bat1', 'battery', 6, 16, { locked: true }),
      pc('L1', 'bulb', 6, 5, { locked: true }),
      pc('VM1', 'voltmeter', 16, 10, { locked: true }),
    ],
    [wire('pw1', 'bat1', 0, 'L1', 0), wire('pw2', 'L1', 1, 'bat1', 1)],
  ),
  goals: [
    { type: 'lit', target: 'L1', label: '灯保持亮着（电压表没有挡路）' },
    { type: 'meterRange', target: 'VM1', min: 2.0, max: 3.5, label: '电压表读到灯泡两端电压 ≈ 3V' },
  ],
  star2: [{ type: 'noBlown', label: '没有烧坏任何元件' }],
  hints: [
    '把电压表的 + 接到灯泡靠电池 + 的那端，− 接另一端。',
    '如果接成串联，灯会熄灭——电压表内阻太大，电流过不去。这也是个知识点！',
  ],
};

const L4_3: Level = {
  id: 'c4-3',
  chapter: 4,
  index: 3,
  title: '探究欧姆定律',
  intro: '实验室经典实验：定值电阻 R=10Ω，用滑动变阻器调节它两端的电压，电压表监视 U、电流表读出 I。把 U 调到 2.0V，看看 I 是多少？再算算 U÷I！',
  palette: {},
  preset: doc([
    pc('bat1', 'battery', 8, 20, { params: { emf: 6 }, locked: true }),
    pc('R1', 'resistor', 2, 5, { locked: true }),
    pc('RH1', 'rheostat', 14, 20, { params: { Rmax: 50 }, locked: true }),
    pc('AM1', 'ammeter', 14, 5, { locked: true }),
    pc('VM1', 'voltmeter', 2, 12, { locked: true }),
  ]),
  goals: [
    { type: 'meterRange', target: 'VM1', min: 1.8, max: 2.2, label: '拖动滑片，把电阻两端电压调到约 2V' },
    { type: 'meterRange', target: 'AM1', min: 0.17, max: 0.23, label: '电流表应读到约 0.2A（因为 I = U/R = 2/10）' },
  ],
  star2: [{ type: 'noBlown', label: '没有烧坏任何元件' }],
  hints: [
    '接法：电池 + → 电流表 → 电阻 R → 滑动变阻器 → 电池 −；电压表并在 R 两端。',
    '滑动变阻器阻值变大 → 分走的电压多 → R 两端电压变小。反着拖就变大。',
    'U=2.0V 时 I=0.2A；U=IR，这就是欧姆定律！',
  ],
};

const L4_4: Level = {
  id: 'c4-4',
  chapter: 4,
  index: 4,
  title: '算出来的电流',
  intro: '挑战：电源 6V。请让电流表恰好读到 0.30A。想一想：总电阻应该是多少欧姆？（提示：R = U ÷ I）',
  palette: { resistor: 2 },
  preset: doc([
    pc('bat1', 'battery', 6, 16, { params: { emf: 6 }, locked: true }),
    pc('AM1', 'ammeter', 6, 5, { locked: true }),
  ]),
  goals: [{ type: 'meterRange', target: 'AM1', min: 0.29, max: 0.31, label: '电流表读数 0.30A（±0.01）' }],
  star2: [{ type: 'noBlown', label: '没有烧坏任何元件' }],
  star3: [{ type: 'maxComponents', count: 1, label: '只用一个电阻做到（改它的阻值！）' }],
  hints: [
    '6V ÷ 0.3A = 20Ω，你需要总电阻 20Ω。',
    '两个 10Ω 串联 = 20Ω；或者选中一个电阻，把阻值直接调到 20Ω。',
  ],
};

/* ================= 第 5 章 滑动变阻器 ================= */

const L5_1: Level = {
  id: 'c5-1',
  chapter: 5,
  index: 1,
  title: '调光台灯',
  intro: '台灯太刺眼？把滑动变阻器串进电路，拖动滑片，让灯光变得柔和（亮度调到 10%~40% 之间）。',
  palette: {},
  preset: doc([
    pc('bat1', 'battery', 6, 16, { locked: true }),
    pc('L1', 'bulb', 2, 5, { locked: true }),
    pc('RH1', 'rheostat', 12, 5, { locked: true }),
  ]),
  goals: [{ type: 'brightnessRange', target: 'L1', min: 0.1, max: 0.4, label: '灯光调到柔和的暗光' }],
  star2: [{ type: 'noBlown', label: '没有烧坏任何元件' }],
  hints: ['变阻器要串联在灯泡的电路里。', '按住滑片左右拖：电阻变大，灯变暗；电阻变小，灯变亮。'],
};

const L5_2: Level = {
  id: 'c5-2',
  chapter: 5,
  index: 2,
  title: '音量旋钮的秘密',
  intro: '收音机的音量旋钮、风扇的调速档，里面都是变阻器！这次把灯调到最亮（85% 以上），但变阻器必须还在电路里工作（有电流通过它）。',
  palette: {},
  preset: doc([
    pc('bat1', 'battery', 6, 16, { locked: true }),
    pc('L1', 'bulb', 2, 5, { locked: true }),
    pc('RH1', 'rheostat', 12, 5, { locked: true }),
  ]),
  goals: [
    { type: 'brightnessRange', target: 'L1', min: 0.85, max: 1, label: '灯达到最亮' },
    { type: 'currentRange', target: 'RH1', min: 0.01, max: 10, label: '变阻器仍在电路中通电工作' },
  ],
  star2: [{ type: 'noBlown', label: '没有烧坏任何元件' }],
  hints: ['把滑片拖到电阻最小的一端，变阻器几乎不"挡路"，灯就最亮。', '从最暗慢慢拖到最亮，观察电流小点的速度变化！'],
};

const L5_3: Level = {
  id: 'c5-3',
  chapter: 5,
  index: 3,
  title: '保护小灯泡',
  intro: '危险任务：电源有 6V，可小灯泡只能承受 2.5V！直接接上去会烧毁。用滑动变阻器帮它分担电压，把灯安全地点亮。',
  palette: {},
  preset: doc([
    pc('bat1', 'battery', 6, 16, { params: { emf: 6 }, locked: true }),
    pc('L1', 'bulb', 2, 5, { locked: true }),
    pc('RH1', 'rheostat', 12, 5, { params: { Rmax: 30 }, locked: true }),
  ]),
  goals: [
    { type: 'brightnessRange', target: 'L1', min: 0.3, max: 1, label: '灯泡安全点亮' },
    { type: 'noBlown', label: '全程没有烧毁灯泡' },
  ],
  star3: [{ type: 'brightnessRange', target: 'L1', min: 0.8, max: 1.0, label: '精细操作：调到接近正常最亮又不烧毁' }],
  hints: [
    '先把滑片拖到电阻最大的一端，再接通电路——这是实验室的标准安全操作！',
    '然后慢慢减小电阻，灯渐渐变亮。太贪心就会"砰"！',
  ],
};

/* ================= 汇总 ================= */

export const CHAPTERS: Chapter[] = [
  { num: 1, title: '点亮它', subtitle: '回路 · 断路 · 短路', levels: [L1_1, L1_2, L1_3] },
  { num: 2, title: '串联世界', subtitle: '一条路 · 分压 · 越串越暗', levels: [L2_1, L2_2, L2_3] },
  { num: 3, title: '并联世界', subtitle: '分岔路 · 各管各的 · 家庭电路', levels: [L3_1, L3_2, L3_3] },
  { num: 4, title: '欧姆定律与电表', subtitle: '测量 · U=IR', levels: [L4_1, L4_2, L4_3, L4_4] },
  { num: 5, title: '滑动变阻器', subtitle: '调光 · 调速 · 保护电路', levels: [L5_1, L5_2, L5_3] },
];

export function findLevel(id: string): Level | undefined {
  for (const ch of CHAPTERS) {
    const lv = ch.levels.find((l) => l.id === id);
    if (lv) return lv;
  }
  return undefined;
}

export function nextLevelId(id: string): string | null {
  const flat = CHAPTERS.flatMap((c) => c.levels);
  const i = flat.findIndex((l) => l.id === id);
  return i >= 0 && i < flat.length - 1 ? flat[i + 1].id : null;
}
