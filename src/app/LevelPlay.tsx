/** 关卡游玩：预置电路 + 限量元件 + 实时目标判定 + 提示 + 过关结算 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CircuitCanvas } from '../canvas/CircuitCanvas';
import { Palette } from '../canvas/Palette';
import { ParamPanel } from '../canvas/ParamPanel';
import { HoverCard, ShortCircuitBanner, VizToggles } from '../visualization/Overlays';
import { useCircuitStore } from '../store/circuitStore';
import { findLevel, nextLevelId } from '../levels/data';
import { evaluateGoals, starRating } from '../levels/evaluate';
import { saveStar } from '../levels/progress';
import type { ComponentType } from '../model/types';

export function LevelPlay() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const level = findLevel(id);
  const store = useCircuitStore;
  const doc = useCircuitStore((s) => s.doc);
  const result = useCircuitStore((s) => s.result);
  const everBlown = useCircuitStore((s) => s.everBlown);
  const everShort = useCircuitStore((s) => s.everShort);

  const [hintIdx, setHintIdx] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [passed, setPassed] = useState<null | { stars: number }>(null);
  /** 本次尝试是否已庆祝过（避免关闭弹窗后因目标仍满足而重复弹出） */
  const [celebrated, setCelebrated] = useState(false);

  // 载入关卡（切关时重置）
  useEffect(() => {
    if (level) {
      store.getState().loadDoc(level.preset ?? { components: [], wires: [] });
      // 初中章节默认只开电流小点；第 4 章起开数值卡片
      store.getState().setViz({ dots: true, potential: false, hover: level.chapter >= 4 });
      setPassed(null);
      setCelebrated(false);
      setHintIdx(0);
      setShowHint(false);
    }
  }, [level, store]);

  const flags = useMemo(() => ({ everBlown, sawShort: everShort }), [everBlown, everShort]);

  const goalStatus = useMemo(
    () => (level ? evaluateGoals(level.goals, doc, result, flags) : []),
    [level, doc, result, flags],
  );
  const allOk = goalStatus.length > 0 && goalStatus.every((g) => g.ok);

  // 过关检测（每次尝试只弹一次）
  useEffect(() => {
    if (level && allOk && !celebrated) {
      const stars = starRating(true, level.star2, level.star3, doc, result, flags);
      saveStar(level.id, stars);
      setPassed({ stars });
      setCelebrated(true);
    }
  }, [level, allOk, celebrated, doc, result, flags]);

  if (!level) {
    return (
      <div className="home">
        <div className="home-card">
          <h1>找不到这一关</h1>
          <Link to="/levels" className="btn">
            返回关卡列表
          </Link>
        </div>
      </div>
    );
  }

  // 剩余可用元件 = 限额 − 已放置的非锁定件
  const allowance: Partial<Record<ComponentType, number>> = {};
  for (const [t, n] of Object.entries(level.palette) as [ComponentType, number][]) {
    const used = doc.components.filter((c) => c.type === t && !c.locked).length;
    allowance[t] = Math.max(0, n - used);
  }
  const hasPalette = Object.keys(level.palette).length > 0;
  const next = nextLevelId(level.id);

  return (
    <div className="play-layout">
      <header className="play-header">
        <Link to="/levels" className="btn back">
          ← 选关
        </Link>
        <b>
          {level.chapter}-{level.index} {level.title}
        </b>
        <div className="header-actions">
          <button
            className="btn"
            onClick={() => {
              setShowHint(true);
            }}
          >
            💡 提示
          </button>
          <button className="btn" onClick={() => store.getState().loadDoc(level.preset ?? { components: [], wires: [] })}>
            ↺ 重来
          </button>
        </div>
      </header>

      <div className="play-body">
        {hasPalette && <Palette allowance={allowance} />}
        <div className="canvas-wrap">
          <CircuitCanvas />
          <ShortCircuitBanner />
          <HoverCard />
          <div className="canvas-corner">
            <VizToggles compact />
          </div>
        </div>
        <aside className="goal-panel">
          <div className="goal-intro">{level.intro}</div>
          <div className="goal-list">
            <div className="goal-title">任务目标</div>
            {goalStatus.map((g, i) => (
              <div key={i} className={`goal-item ${g.ok ? 'ok' : ''}`}>
                <span className="goal-check">{g.ok ? '✅' : '⬜'}</span>
                {g.pred.label}
              </div>
            ))}
          </div>
          <ParamPanel />
        </aside>
      </div>

      {showHint && (
        <div className="modal-mask" onClick={() => setShowHint(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>💡 提示 {hintIdx + 1}/{level.hints.length}</h3>
            <p>{level.hints[hintIdx]}</p>
            <div className="modal-actions">
              {hintIdx < level.hints.length - 1 && (
                <button className="btn" onClick={() => setHintIdx(hintIdx + 1)}>
                  下一条提示
                </button>
              )}
              <button className="btn primary" onClick={() => setShowHint(false)}>
                我再试试
              </button>
            </div>
          </div>
        </div>
      )}

      {passed && (
        <div className="modal-mask">
          <div className="modal celebrate">
            <div className="celebrate-emoji">🎉</div>
            <h3>过关啦！</h3>
            <div className="big-stars">
              {[1, 2, 3].map((s) => (
                <span key={s} className={s <= passed.stars ? 'star on' : 'star'}>
                  ★
                </span>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setPassed(null)}>
                继续玩玩
              </button>
              <button
                className="btn"
                onClick={() => {
                  store.getState().loadDoc(level.preset ?? { components: [], wires: [] });
                  setPassed(null);
                  setCelebrated(false);
                }}
              >
                ↺ 重来拿三星
              </button>
              {next ? (
                <button className="btn primary" onClick={() => navigate(`/levels/${next}`)}>
                  下一关 →
                </button>
              ) : (
                <button className="btn primary" onClick={() => navigate('/levels')}>
                  返回选关
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
