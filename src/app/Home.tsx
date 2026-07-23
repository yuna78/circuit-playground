/** 首页：标题 + 双模式入口 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

export function Home() {
  const [showQr, setShowQr] = useState(false);

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
        <button className="wechat-btn" onClick={() => setShowQr(true)}>
          📢 关注公众号
        </button>
      </div>

      {showQr && (
        <div className="modal-mask" onClick={() => setShowQr(false)}>
          <div className="modal qr-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📢 关注公众号</h3>
            <p className="qr-desc">
              关注公众号「Yuna的AI修炼手册」，更多给孩子的学习资源都在这里 🦞。微信扫码 👇
            </p>
            <img
              className="qr-img"
              src="/images/qrcode.jpg"
              alt="公众号二维码"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.src =
                  'https://lobster-daily-challenge.pages.dev/images/qrcode.jpg';
              }}
            />
            <div className="modal-actions">
              <button className="wechat-btn ghost" onClick={() => setShowQr(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
