/** 选中元件的参数编辑面板（全中文），参数变化立即重解 */

import { REGISTRY } from '../model/registry';
import { useCircuitStore } from '../store/circuitStore';

export function ParamPanel() {
  const doc = useCircuitStore((s) => s.doc);
  const result = useCircuitStore((s) => s.result);
  const selection = useCircuitStore((s) => s.selection);
  const store = useCircuitStore;

  if (!selection) return null;
  const comp = doc.components.find((c) => c.id === selection);
  const wire = doc.wires.find((w) => w.id === selection);

  const closeBtn = (
    <button className="param-close" aria-label="关闭" onClick={() => store.getState().select(null)}>
      ✕
    </button>
  );

  if (wire) {
    return (
      <div className="param-panel">
        <div className="param-title-row">
          <div className="param-title">导线</div>
          {closeBtn}
        </div>
        {!wire.locked && <div className="param-hint">拖动导线中段可左右 / 上下调整走线，接点不变。</div>}
        <div className="param-actions">
          {!wire.locked && wire.mid !== undefined && (
            <button className="btn" onClick={() => store.getState().clearWireMid(wire.id)}>
              ↺ 自动走线
            </button>
          )}
          {!wire.locked && (
            <button className="btn danger" onClick={() => store.getState().removeItem(wire.id)}>
              删除导线
            </button>
          )}
        </div>
      </div>
    );
  }
  if (!comp) return null;
  const def = REGISTRY[comp.type];
  const r = result.perComponent.get(comp.id);

  return (
    <div className="param-panel">
      <div className="param-title-row">
        <div className="param-title">{def.name}</div>
        {closeBtn}
      </div>
      {def.params.map((p) => (
        <label key={p.key} className="param-row">
          <span>
            {p.label}（{p.unit}）
          </span>
          <input
            type="range"
            min={p.min}
            max={p.max}
            step={p.step}
            disabled={comp.locked}
            value={comp.params[p.key] ?? p.default}
            onChange={(e) => store.getState().setParam(comp.id, p.key, Number(e.target.value))}
          />
          <b>{comp.params[p.key] ?? p.default}</b>
        </label>
      ))}
      {comp.type === 'switch' && (
        <button className="btn" onClick={() => store.getState().toggleSwitch(comp.id)}>
          {comp.state.closed ? '断开开关' : '闭合开关'}
        </button>
      )}
      {comp.state.blown && (
        <button className="btn" onClick={() => store.getState().repairAll()}>
          🔧 修复烧毁元件
        </button>
      )}
      {r && !r.unpowered && (
        <div className="param-readout">
          <span>电流 {fmt(Math.abs(r.I))} A</span>
          <span>电压 {fmt(Math.abs(r.U))} V</span>
          <span>功率 {fmt(Math.abs(r.P))} W</span>
        </div>
      )}
      {r?.unpowered && <div className="param-readout muted">未接通</div>}
      <div className="param-actions">
        {!comp.locked && (
          <>
            <button className="btn" onClick={() => store.getState().rotateComponent(comp.id)}>
              ↻ 旋转
            </button>
            <button className="btn danger" onClick={() => store.getState().removeItem(comp.id)}>
              删除
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function fmt(v: number): string {
  if (!isFinite(v)) return '—';
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  if (Math.abs(v) < 0.005) return '0';
  return v.toFixed(2);
}
