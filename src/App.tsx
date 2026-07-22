import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Home } from './app/Home';
import { Sandbox } from './app/Sandbox';
import { LevelSelect } from './app/LevelSelect';
import { LevelPlay } from './app/LevelPlay';

export default function App() {
  return (
    <>
      {/* 窄屏（手机竖屏）友好提示，CSS 控制显隐 */}
      <div className="narrow-notice">
        <div>
          <div style={{ fontSize: 48 }}>📱➡️💻</div>
          <h2>屏幕有点小</h2>
          <p>电路乐园需要大一点的画布，请用平板（横屏）或电脑打开～</p>
        </div>
      </div>
      <div className="app-root">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/sandbox" element={<Sandbox />} />
            <Route path="/levels" element={<LevelSelect />} />
            <Route path="/levels/:id" element={<LevelPlay />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </BrowserRouter>
      </div>
    </>
  );
}
