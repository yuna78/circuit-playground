# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

**电路乐园（Circuit Playground）** —— 面向初中（+高中入门）孩子的互动电学教育游戏。拖元件、连线、实时解算、把电流电压变可见。纯前端 SPA，无后端，部署到 Cloudflare Pages，全中文界面。

本项目用 OpenSpec 规范驱动开发。完整规划文档（proposal / design / specs / tasks）不在本仓库内，而在父级合集的 `planning/circuit-game/openspec/changes/circuit-playground-mvp/` —— 改动前如能访问，先读 `design.md`（7 个关键技术决策）和相关 `specs/*/spec.md`（需求与验收场景）。开源仓库单独 clone 时以本文件与 `README.md` 的架构说明为准。

## 常用命令

```bash
npm run dev            # 开发服务器（Vite，端口 5173）
npm run build          # tsc -b && vite build → dist/（Cloudflare Pages 产物）
npm run test           # vitest run（解算器单测，全部在 src/solver/solve.test.ts）
npm run test:watch     # vitest watch
npm run lint           # oxlint
npx tsc -b             # 仅类型检查

# 跑单个测试（按名称过滤，中文名可用）
npx vitest run -t "桥式"
npx vitest run -t "短路检测"

# 部署（需先 npx wrangler login，账号操作由用户完成）
npx wrangler pages deploy dist
```

## 架构（大图景）

数据流是理解本项目的关键：

```
CircuitDoc (画布数据)
   │  用户任何编辑
   ▼
store/circuitStore.ts  ── commit() ──▶  solver/solve.ts (纯函数，同步重解)
   │                                          │
   │  result: SolveResult                     ├─ netlist.ts  CircuitDoc→抽象网表
   ▼                                          │    · union-find 合并理想导体节点
canvas/ + visualization/ (读 store 渲染)      │    · 短路预检测
                                              └─ mna.ts  改进节点分析 + 高斯消元
```

### 核心分层

- **`src/model/`** —— 数据模型与元件注册表。`types.ts` 定义 `CircuitDoc`（可 JSON 序列化，画布/存档/关卡预置共用同一格式）。`registry.ts` 是九种元件的**单一事实源**：中文名、参数 schema、端子极性/位置、默认值（课本口径）。加新元件从这里开始。

- **`src/solver/`** —— **纯函数解算内核，与 UI 完全解耦，可独立单测**。
  - `netlist.ts`：`compile()` 把 `CircuitDoc` 编译成抽象网表。关键设计：理想导线/闭合开关/电流表用 **union-find 节点合并**（不是小电阻近似），电压源被理想导体短接时**预检测**返回 short 标记（不解方程）。
  - `mna.ts`：`solveMna()` 按连通子网独立求解，每个子网选参考地；无源子网电流恒 0。
  - `solve.ts`：编排器。编译→求解→算元件量值→**过载熔断迭代重解**→**导线电流后处理**（节点合并丢失了单根导线电流，用簇内生成树流量分配补回，供电流小点动画用）。返回 `SolveResult`。**这是纯函数——熔断在内部副本上做，通过 `blownIds` 返回，调用方负责落回文档**。
  - `solve.test.ts`：19 个测试，对拍值均为手算精确解。改解算器逻辑**必须先跑这个**。

- **`src/store/circuitStore.ts`** —— Zustand 全局状态。所有文档变更走 `commit()`→同步重解→落回熔断。`solveWithSwitch()` 供关卡"开关因果"谓词在文档副本上做多状态验证。

- **`src/canvas/`** —— SVG 画布。`CircuitCanvas.tsx` 用 Pointer Events 统一鼠标/触摸；`art.tsx` 是全部元件的卡通 SVG（状态由 props 驱动：亮度/通断/熔断/指针/滑片）；`wirePath.ts` 正交折线布线（画布与动画共用）。**元件本地坐标系：端子在 (0,0) 与 (64,0)，旋转由父 `<g>` 处理**。

- **`src/visualization/`** —— `DotsLayer.tsx` 电流小点用 **requestAnimationFrame 直改 DOM，不经 React 重渲染**（60fps 性能关键，改动小心别引入 React state）。`Overlays.tsx` 短路横幅/悬停卡片/可视化开关。

- **`src/levels/`** —— 关卡系统。`types.ts` 定义声明式 `Predicate`（目标谓词）。`data.ts` 是**纯数据关卡内容**（前 5 章 17 关），加关卡不改引擎。`evaluate.ts` 谓词评估器。`progress.ts` localStorage 存档（版本化 key）。

- **`src/app/`** —— 页面：Home / Sandbox / LevelSelect / LevelPlay。路由在 `App.tsx`。

## 关键约定与坑

- **元件贯穿电流符号**：正方向 = 端子 0 流入、端子 1 流出（t0→t1）。`U = V(t0) − V(t1)`，`P = U·I`（耗能为正，电源放电为负）。电表读数正负复现真实"接反指针反打"。
- **加新元件**：改 `registry.ts`（模型+端子）→ `art.tsx`（SVG）→ 若有新电学行为改 `netlist.ts` 的 `resistanceOf()` 或支路组装 → 补 `solve.test.ts`。
- **加新关卡**：只改 `levels/data.ts`。目标用 `Predicate` 声明；预置电路里 `locked: true` 的件不可动。`switch: '@any'` 表示"场上任一开关满足因果即可"（玩家自加的开关无固定 id）。
- **加新目标类型**：在 `levels/types.ts` 的 `Predicate` 联合类型加一支，并在 `evaluate.ts` 的 switch 补一个 case（TS 会强制穷尽）。
- **电压表**建模为 10MΩ 大内阻支路；**电流表**建模为 0V 电压源（其 MNA 电流变量即读数）。
- **首发范围**：前 5 章（含滑动变阻器，初中必学）。第 6–8 章（电功率、电源内阻、动态分析）是 tasks.md 第 10 组的首发后增量。
- 面向桌面/平板，窄于 768px 显示"请用平板或电脑"提示（`App.tsx` + CSS），不做手机小屏适配。
