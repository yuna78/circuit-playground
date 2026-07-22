/** 关卡选择：章节-关卡网格 + 星级 + 顺序解锁 */

import { Link } from 'react-router-dom';
import { CHAPTERS } from '../levels/data';
import { chapterUnlocked, loadProgress } from '../levels/progress';

export function LevelSelect() {
  const progress = loadProgress();
  return (
    <div className="level-select">
      <header className="play-header">
        <Link to="/" className="btn back">
          ← 首页
        </Link>
        <b>🏆 闯关挑战</b>
        <span />
      </header>
      <div className="chapters">
        {CHAPTERS.map((ch, i) => {
          const prevIds = i > 0 ? CHAPTERS[i - 1].levels.map((l) => l.id) : [];
          const unlocked = chapterUnlocked(ch.num, prevIds);
          return (
            <section key={ch.num} className={`chapter ${unlocked ? '' : 'locked'}`}>
              <h2>
                第 {ch.num} 章 · {ch.title}
                <small>{ch.subtitle}</small>
                {!unlocked && <span className="lock-tag">🔒 通关上一章解锁</span>}
              </h2>
              <div className="level-grid">
                {ch.levels.map((lv) => {
                  const stars = progress.stars[lv.id] ?? 0;
                  return unlocked ? (
                    <Link key={lv.id} to={`/levels/${lv.id}`} className={`level-card ${stars > 0 ? 'done' : ''}`}>
                      <span className="level-num">{ch.num}-{lv.index}</span>
                      <span className="level-title">{lv.title}</span>
                      <span className="level-stars">
                        {[1, 2, 3].map((s) => (
                          <span key={s} className={s <= stars ? 'star on' : 'star'}>
                            ★
                          </span>
                        ))}
                      </span>
                    </Link>
                  ) : (
                    <div key={lv.id} className="level-card locked">
                      <span className="level-num">{ch.num}-{lv.index}</span>
                      <span className="level-title">???</span>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
