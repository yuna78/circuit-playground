/** 首页：标题 + 双模式入口 */

import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="home">
      <div className="home-card">
        <div className="home-logo">🔋⚡💡</div>
        <h1>电路乐园</h1>
        <p className="home-sub">拖一拖、连一连，把看不见的电变成看得见的光</p>
        <div className="home-actions">
          <Link to="/sandbox" className="mode-btn sandbox">
            <span className="mode-icon">🧪</span>
            <span className="mode-name">自由实验室</span>
            <span className="mode-desc">所有元件随便玩，想搭什么搭什么</span>
          </Link>
          <Link to="/levels" className="mode-btn levels">
            <span className="mode-icon">🏆</span>
            <span className="mode-name">闯关挑战</span>
            <span className="mode-desc">从点亮第一盏灯开始，一步步成为电学高手</span>
          </Link>
        </div>
        <p className="home-tip">建议使用平板（横屏）或电脑打开</p>
      </div>
    </div>
  );
}
