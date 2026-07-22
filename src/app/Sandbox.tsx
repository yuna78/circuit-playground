/** 自由实验室：全元件、可视化开关、自动存档、清空与修复 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircuitCanvas } from '../canvas/CircuitCanvas';
import { Palette } from '../canvas/Palette';
import { ParamPanel } from '../canvas/ParamPanel';
import { HoverCard, ShortCircuitBanner, VizToggles } from '../visualization/Overlays';
import { useCircuitStore } from '../store/circuitStore';
import { clearSandbox, loadSandbox, saveSandbox } from '../levels/progress';

export function Sandbox() {
  const store = useCircuitStore;
  const doc = useCircuitStore((s) => s.doc);
  const viz = useCircuitStore((s) => s.viz);
  const hasBlown = useCircuitStore((s) => s.doc.components.some((c) => c.state.blown));
  const [confirmClear, setConfirmClear] = useState(false);
  const loaded = useRef(false);

  // 进入时恢复存档
  useEffect(() => {
    const save = loadSandbox();
    if (save) {
      store.getState().loadDoc(save.doc);
      store.getState().setViz(save.viz);
    } else {
      store.getState().clearDoc();
    }
    loaded.current = true;
    // 离开沙盒时不清空——存档已落盘
  }, [store]);

  // 自动存档（防抖）
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => saveSandbox({ doc, viz }), 400);
    return () => clearTimeout(t);
  }, [doc, viz]);

  return (
    <div className="play-layout">
      <header className="play-header">
        <Link to="/" className="btn back">
          ← 首页
        </Link>
        <b>🧪 自由实验室</b>
        <div className="header-actions">
          {hasBlown && (
            <button className="btn" onClick={() => store.getState().repairAll()}>
              🔧 修复全部
            </button>
          )}
          <button className="btn danger" onClick={() => setConfirmClear(true)}>
            🗑 清空画布
          </button>
        </div>
      </header>
      <div className="play-body">
        <Palette />
        <div className="canvas-wrap">
          <CircuitCanvas />
          <ShortCircuitBanner />
          <HoverCard />
          <div className="canvas-corner">
            <VizToggles />
          </div>
        </div>
        <ParamPanel />
      </div>

      {confirmClear && (
        <div className="modal-mask" onClick={() => setConfirmClear(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>清空画布？</h3>
            <p>当前搭建的电路会被删除，无法恢复。</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirmClear(false)}>
                取消
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  store.getState().clearDoc();
                  clearSandbox();
                  setConfirmClear(false);
                }}
              >
                清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
