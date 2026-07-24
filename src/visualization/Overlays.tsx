/** 短路警告横幅 + 悬停 U/I/P 卡片 + 可视化开关面板 */

import { useCircuitStore } from '../store/circuitStore';
import { REGISTRY } from '../model/registry';
import { fmt } from '../canvas/ParamPanel';

export function ShortCircuitBanner() {
  const short = useCircuitStore((s) => s.result.short);
  if (!short) return null;
  const viaAmmeter = short.ammeterIds.length > 0;
  return (
    <div className="short-banner">
      <span className="short-icon">🔥</span>
      <div>
        <b>电源短路了！</b>
        <p>
          {viaAmmeter
            ? '电流表内阻几乎为零，不能直接接在电源两端——这相当于用导线把电池连了起来，电流会非常大，电池发烫、电流表也会烧坏！'
            : '电流没有经过任何用电器就直接回到了电池，电流会非常大，电池会发烫甚至损坏。请断开短路的导线。'}
        </p>
      </div>
    </div>
  );
}

export function HoverCard() {
  const hovered = useCircuitStore((s) => s.hovered);
  const viz = useCircuitStore((s) => s.viz);
  const doc = useCircuitStore((s) => s.doc);
  const result = useCircuitStore((s) => s.result);
  if (!viz.hover || !hovered) return null;
  const comp = doc.components.find((c) => c.id === hovered);
  const r = comp && result.perComponent.get(comp.id);
  if (!comp || !r) return null;
  if (comp.type === 'rheostat' && r.sections) {
    const [ap, pb] = r.sections;
    const liveAP = Math.abs(ap.I) > 1e-6;
    const livePB = Math.abs(pb.I) > 1e-6;
    return (
      <div className="hover-card">
        <b>{REGISTRY[comp.type].name}</b>
        {r.rIn !== undefined ? (
          <span>接入 {fmt(r.rIn)} Ω / {comp.params.Rmax} Ω</span>
        ) : liveAP && livePB ? (
          <span>分压 · 总 {comp.params.Rmax} Ω</span>
        ) : (
          <span className="muted">未接入</span>
        )}
        {liveAP && <span>A–P {fmt(Math.abs(ap.U))}V·{fmt(Math.abs(ap.I))}A</span>}
        {livePB && <span>P–B {fmt(Math.abs(pb.U))}V·{fmt(Math.abs(pb.I))}A</span>}
      </div>
    );
  }
  return (
    <div className="hover-card">
      <b>{REGISTRY[comp.type].name}</b>
      {r.unpowered ? (
        <span className="muted">未接通</span>
      ) : (
        <>
          <span>U = {fmt(Math.abs(r.U))} V</span>
          <span>I = {fmt(Math.abs(r.I))} A</span>
          <span>P = {fmt(Math.abs(r.P))} W</span>
        </>
      )}
    </div>
  );
}

export function VizToggles({ compact = false }: { compact?: boolean }) {
  const viz = useCircuitStore((s) => s.viz);
  const store = useCircuitStore;
  return (
    <div className={`viz-toggles ${compact ? 'compact' : ''}`}>
      <label>
        <input type="checkbox" checked={viz.dots} onChange={(e) => store.getState().setViz({ dots: e.target.checked })} />
        电流流动
      </label>
      <label>
        <input
          type="checkbox"
          checked={viz.potential}
          onChange={(e) => store.getState().setViz({ potential: e.target.checked })}
        />
        电势透视镜
      </label>
      <label>
        <input type="checkbox" checked={viz.hover} onChange={(e) => store.getState().setViz({ hover: e.target.checked })} />
        数值卡片
      </label>
    </div>
  );
}
