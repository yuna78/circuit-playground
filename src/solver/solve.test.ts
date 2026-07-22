import { describe, expect, it } from 'vitest';
import type { CircuitDoc, ComponentInstance, ComponentType } from '../model/types';
import { makeComponent, newId } from '../model/registry';
import { solve } from './solve';

/** 测试电路搭建器 */
function builder() {
  const doc: CircuitDoc = { components: [], wires: [] };
  let px = 0;
  const add = (
    type: ComponentType,
    params: Record<string, number> = {},
    state: Partial<ComponentInstance['state']> = {},
  ): ComponentInstance => {
    const c = makeComponent(type, (px += 6), 0);
    Object.assign(c.params, params);
    Object.assign(c.state, state);
    doc.components.push(c);
    return c;
  };
  const connect = (ca: ComponentInstance, ta: number, cb: ComponentInstance, tb: number) => {
    doc.wires.push({ id: newId('w'), a: { comp: ca.id, t: ta }, b: { comp: cb.id, t: tb } });
    return doc.wires[doc.wires.length - 1];
  };
  return { doc, add, connect };
}

const approx = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe('串联电路', () => {
  it('6V 电源 + 两个 10Ω 串联：I=0.3A，各分压 3V', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 6, r: 0 });
    const r1 = add('resistor', { R: 10 });
    const r2 = add('resistor', { R: 10 });
    connect(bat, 0, r1, 0);
    connect(r1, 1, r2, 0);
    connect(r2, 1, bat, 1);
    const res = solve(doc);
    approx(res.perComponent.get(r1.id)!.I, 0.3);
    approx(res.perComponent.get(r2.id)!.I, 0.3);
    approx(res.perComponent.get(r1.id)!.U, 3);
    approx(res.perComponent.get(r2.id)!.U, 3);
    // 电池放电：流入 + 极为负
    approx(res.perComponent.get(bat.id)!.I, -0.3);
    expect(res.short).toBeNull();
  });
});

describe('并联电路', () => {
  it('6V 电源 + 两个 10Ω 并联：各 0.6A，总 1.2A，两端均 6V', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 6, r: 0 });
    const r1 = add('resistor', { R: 10 });
    const r2 = add('resistor', { R: 10 });
    connect(bat, 0, r1, 0);
    connect(bat, 0, r2, 0);
    connect(r1, 1, bat, 1);
    connect(r2, 1, bat, 1);
    const res = solve(doc);
    approx(res.perComponent.get(r1.id)!.I, 0.6);
    approx(res.perComponent.get(r2.id)!.I, 0.6);
    approx(res.perComponent.get(r1.id)!.U, 6);
    approx(Math.abs(res.perComponent.get(bat.id)!.I), 1.2);
  });

  it('链式接线的并联：导线电流正确分流（10Ω∥20Ω）', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 6, r: 0 });
    const r1 = add('resistor', { R: 10 });
    const r2 = add('resistor', { R: 20 });
    const w1 = connect(bat, 0, r1, 0); // 干路导线：应载 0.9A
    const w2 = connect(r1, 0, r2, 0); // 支路间导线：应载 0.3A
    connect(r1, 1, bat, 1);
    connect(r2, 1, bat, 1);
    const res = solve(doc);
    approx(res.perComponent.get(r1.id)!.I, 0.6);
    approx(res.perComponent.get(r2.id)!.I, 0.3);
    approx(Math.abs(res.wireCurrents.get(w1.id)!), 0.9);
    approx(Math.abs(res.wireCurrents.get(w2.id)!), 0.3);
  });
});

describe('桥式电路（非串并联）', () => {
  it('惠斯通桥手算对拍（误差 < 1e-9）', () => {
    // 10V；A-C:1Ω A-D:2Ω C-B:3Ω D-B:4Ω 桥 C-D:5Ω
    // 手算：VC=3150/425，VD=(100+4VC)/19，I(桥 C→D)=2/17
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 10, r: 0 });
    const r1 = add('resistor', { R: 1 });
    const r2 = add('resistor', { R: 2 });
    const r3 = add('resistor', { R: 3 });
    const r4 = add('resistor', { R: 4 });
    const r5 = add('resistor', { R: 5 });
    connect(bat, 0, r1, 0);
    connect(bat, 0, r2, 0);
    connect(r1, 1, r3, 0); // 节点 C
    connect(r2, 1, r4, 0); // 节点 D
    connect(r3, 1, bat, 1);
    connect(r4, 1, bat, 1);
    connect(r5, 0, r1, 1); // 桥 C 端
    connect(r5, 1, r2, 1); // 桥 D 端
    const res = solve(doc);
    approx(res.perComponent.get(r5.id)!.I, 2 / 17);
    approx(Math.abs(res.perComponent.get(bat.id)!.I), 71 / 17);
  });
});

describe('多电源电路', () => {
  it('双电源共负载，基尔霍夫解唯一（含被充电的电源）', () => {
    // B1=6V 串 R1=2Ω，B2=3V 串 R2=1Ω，共同接 R3=4Ω。VX=24/7
    const { doc, add, connect } = builder();
    const b1 = add('battery', { emf: 6, r: 0 });
    const r1 = add('resistor', { R: 2 });
    const b2 = add('battery', { emf: 3, r: 0 });
    const r2 = add('resistor', { R: 1 });
    const r3 = add('resistor', { R: 4 });
    connect(b1, 0, r1, 0);
    connect(r1, 1, r3, 0); // 节点 X
    connect(b2, 0, r2, 0);
    connect(r2, 1, r3, 0);
    connect(r3, 1, b1, 1);
    connect(r3, 1, b2, 1);
    const res = solve(doc);
    approx(res.perComponent.get(r3.id)!.I, 6 / 7);
    approx(res.perComponent.get(r1.id)!.I, 9 / 7);
    approx(res.perComponent.get(r2.id)!.I, -3 / 7); // B2 被充电，电流反向
  });
});

describe('短路检测', () => {
  it('导线直接短接电池：返回 short 标记不抛异常', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 3, r: 0 });
    connect(bat, 0, bat, 1);
    const res = solve(doc);
    expect(res.short).not.toBeNull();
    expect(res.short!.batteryIds).toContain(bat.id);
  });

  it('电流表并联电源 = 短路，涉事电流表被标记', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 3, r: 0 });
    const am = add('ammeter');
    connect(bat, 0, am, 0);
    connect(am, 1, bat, 1);
    const res = solve(doc);
    expect(res.short).not.toBeNull();
    expect(res.short!.batteryIds).toContain(bat.id);
    expect(res.short!.ammeterIds).toContain(am.id);
  });

  it('带内阻电池被短接：不是无穷大电流，I = emf/r 可解', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 6, r: 1 });
    connect(bat, 0, bat, 1);
    const res = solve(doc);
    expect(res.short).toBeNull();
    approx(Math.abs(res.perComponent.get(bat.id)!.I), 6);
  });
});

describe('断路与孤岛', () => {
  it('开关断开：回路电流全 0，不报错', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 3, r: 0 });
    const sw = add('switch', {}, { closed: false });
    const bulb = add('bulb', { ratedV: 2.5, ratedP: 0.75 });
    connect(bat, 0, sw, 0);
    connect(sw, 1, bulb, 0);
    connect(bulb, 1, bat, 1);
    const res = solve(doc);
    approx(res.perComponent.get(bulb.id)!.I, 0);
    expect(res.perComponent.get(bulb.id)!.brightness).toBe(0);
  });

  it('开关闭合后电流恢复，且开关贯穿电流被填充', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 2.5, r: 0 });
    const sw = add('switch', {}, { closed: true });
    const bulb = add('bulb', { ratedV: 2.5, ratedP: 0.75 }); // R = 8.33Ω
    connect(bat, 0, sw, 0);
    connect(sw, 1, bulb, 0);
    connect(bulb, 1, bat, 1);
    const res = solve(doc);
    const I = 2.5 / ((2.5 * 2.5) / 0.75);
    approx(res.perComponent.get(bulb.id)!.I, I);
    approx(Math.abs(res.perComponent.get(sw.id)!.I), I);
    approx(res.perComponent.get(bulb.id)!.brightness!, 1);
  });

  it('孤立灯泡：unpowered 标记，电流 0', () => {
    const { doc, add } = builder();
    add('battery', { emf: 3, r: 0 }); // 未连接
    const bulb = add('bulb');
    const res = solve(doc);
    expect(res.perComponent.get(bulb.id)!.unpowered).toBe(true);
    approx(res.perComponent.get(bulb.id)!.I, 0);
  });
});

describe('电表', () => {
  it('电压表并联于电阻：读数 = 分压（误差 < 0.1%）', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 6, r: 0 });
    const r1 = add('resistor', { R: 10 });
    const r2 = add('resistor', { R: 20 });
    const vm = add('voltmeter');
    connect(bat, 0, r1, 0);
    connect(r1, 1, r2, 0);
    connect(r2, 1, bat, 1);
    connect(vm, 0, r2, 0);
    connect(vm, 1, r2, 1);
    const res = solve(doc);
    expect(Math.abs(res.perComponent.get(vm.id)!.reading! - 4)).toBeLessThan(4 * 0.001);
  });

  it('电压表误串联：回路电流近 0，灯泡不亮，不报错', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 6, r: 0 });
    const vm = add('voltmeter');
    const bulb = add('bulb', { ratedV: 2.5, ratedP: 0.75 });
    connect(bat, 0, vm, 0);
    connect(vm, 1, bulb, 0);
    connect(bulb, 1, bat, 1);
    const res = solve(doc);
    expect(Math.abs(res.perComponent.get(bulb.id)!.I)).toBeLessThan(1e-5);
    expect(res.perComponent.get(bulb.id)!.brightness!).toBeLessThan(0.01);
    // 电压表读数几乎等于电源电压（全部电压落在表上）
    expect(Math.abs(res.perComponent.get(vm.id)!.reading! - 6)).toBeLessThan(0.01);
  });

  it('电流表正接读数为正、反接为负', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 6, r: 0 });
    const r = add('resistor', { R: 10 });
    const am = add('ammeter');
    // 正接：电流从 + 接线柱流入（电池 + → 电流表 +）
    connect(bat, 0, am, 0);
    connect(am, 1, r, 0);
    connect(r, 1, bat, 1);
    const res1 = solve(doc);
    approx(res1.perComponent.get(am.id)!.reading!, 0.6);
    // 反接
    doc.wires = [];
    connect(bat, 0, am, 1);
    connect(am, 0, r, 0);
    connect(r, 1, bat, 1);
    const res2 = solve(doc);
    approx(res2.perComponent.get(am.id)!.reading!, -0.6);
  });
});

describe('电源内阻（高中）', () => {
  it('EMF 6V 内阻 1Ω 接 5Ω 负载：I=1A 端电压 5V', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 6, r: 1 });
    const r = add('resistor', { R: 5 });
    connect(bat, 0, r, 0);
    connect(r, 1, bat, 1);
    const res = solve(doc);
    approx(res.perComponent.get(r.id)!.I, 1);
    approx(Math.abs(res.perComponent.get(bat.id)!.U), 5); // 端电压 = emf − I·r
  });
});

describe('过载熔断', () => {
  it('保险丝过流熔断，重解后回路电流 0', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 6, r: 0 });
    const fuse = add('fuse', { ratedI: 1 });
    const r = add('resistor', { R: 3 }); // I ≈ 2A > 1A
    connect(bat, 0, fuse, 0);
    connect(fuse, 1, r, 0);
    connect(r, 1, bat, 1);
    const res = solve(doc);
    expect(res.blownIds).toContain(fuse.id);
    approx(res.perComponent.get(r.id)!.I, 0);
  });

  it('灯泡超额定功率烧毁', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 12, r: 0 });
    const bulb = add('bulb', { ratedV: 2.5, ratedP: 0.75 }); // 12V 下 P≈17W >> 1.5W
    connect(bat, 0, bulb, 0);
    connect(bulb, 1, bat, 1);
    const res = solve(doc);
    expect(res.blownIds).toContain(bulb.id);
    expect(res.perComponent.get(bulb.id)!.brightness).toBe(0);
  });

  it('连锁熔断：灯泡烧毁导致保险丝过流，迭代收敛', () => {
    // 12V；串 1Ω；并联[灯泡 8.33Ω ∥ (保险丝2.3A + 4Ω)]
    // 初始保险丝 2.18A < 2.3 安全；灯泡 P≈9.2W 烧毁后保险丝 2.39A > 2.3 熔断
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 12, r: 0 });
    const rs = add('resistor', { R: 1 });
    const bulb = add('bulb', { ratedV: 2.5, ratedP: 0.75 });
    const fuse = add('fuse', { ratedI: 2.3 });
    const r4 = add('resistor', { R: 4 });
    connect(bat, 0, rs, 0);
    connect(rs, 1, bulb, 0);
    connect(rs, 1, fuse, 0);
    connect(fuse, 1, r4, 0);
    connect(bulb, 1, bat, 1);
    connect(r4, 1, bat, 1);
    const res = solve(doc);
    expect(res.blownIds).toContain(bulb.id);
    expect(res.blownIds).toContain(fuse.id);
    approx(res.perComponent.get(r4.id)!.I, 0);
    // 传入的 doc 不被修改（纯函数）
    expect(bulb.state.blown).toBe(false);
    expect(fuse.state.blown).toBe(false);
  });
});

describe('滑动变阻器', () => {
  it('滑片位置改变阻值：中点 = Rmax/2', () => {
    const { doc, add, connect } = builder();
    const bat = add('battery', { emf: 6, r: 0 });
    const rh = add('rheostat', { Rmax: 20 }, { slider: 0.5 });
    connect(bat, 0, rh, 0);
    connect(rh, 1, bat, 1);
    const res = solve(doc);
    approx(res.perComponent.get(rh.id)!.I, 0.6); // 6V / 10Ω
  });
});
