import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Home } from './app/Home';
import { Sandbox } from './app/Sandbox';
import { LevelSelect } from './app/LevelSelect';
import { LevelPlay } from './app/LevelPlay';

export default function App() {
  return (
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
  );
}
