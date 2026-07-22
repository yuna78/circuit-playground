# app-shell 应用外壳

## ADDED Requirements

### Requirement: 首页与模式选择
应用 SHALL 提供全中文首页，含游戏标题与两个入口：自由实验室、闯关挑战；闯关入口进入章节/关卡选择界面。

#### Scenario: 模式导航
- **WHEN** 用户打开站点根路径
- **THEN** 显示首页；点击任一模式可进入且可返回首页

### Requirement: 全中文界面
所有 UI 文案、提示、元件名称、错误反馈 SHALL 为简体中文，物理术语与人教版初中物理教材一致（如"电源""定值电阻""滑动变阻器""断路""短路"）。

#### Scenario: 术语一致性
- **WHEN** 检查任意界面文案
- **THEN** 无英文残留（开发者调试信息除外），术语与课本口径一致

### Requirement: 静态部署
项目 SHALL 构建为纯静态产物（无后端、无环境密钥），可通过 `wrangler pages deploy` 发布到 Cloudflare Pages；SPA 路由 SHALL 配置回退使刷新任意路径不 404。

#### Scenario: 构建产物自包含
- **WHEN** 运行 `npm run build` 并本地静态伺服 dist/
- **THEN** 游戏完整可玩，无外部运行时资源请求

#### Scenario: 深链刷新
- **WHEN** 用户在 /levels 路径刷新页面
- **THEN** 页面正常加载不出现 404

### Requirement: 目标设备支持
应用 SHALL 支持桌面浏览器（Chrome/Safari/Edge 最新版）与 iPad Safari 横屏；SHALL 在窄于 768px 的视口显示"请使用平板或电脑打开"的友好提示。

#### Scenario: 手机访问提示
- **WHEN** 用户用手机竖屏打开
- **THEN** 显示设备建议提示而非破碎布局
