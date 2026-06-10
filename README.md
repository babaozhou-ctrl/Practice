# Deep Pet

Deep Pet 是一个面向桌面长期驻留场景的陪伴型宠物项目。

它的目标不是做一个会动的桌宠 Demo，也不是把聊天功能简单挂在桌面上，而是做一个更安静、更自然、更有陪伴感的桌面角色。角色会根据当前场景调整状态、动作和表达，在不打扰用户的前提下提供持续存在感。

当前内置角色统一为 **bb7**。

## 项目定位

这个项目关注的是一类更接近“桌面陪伴角色”的产品体验：

- 常驻桌面，但不过度打扰
- 能识别上下文，理解用户大致在做什么
- 有明确的情绪状态和行为节奏
- 动画表现优先于功能堆叠
- 聊天与互动服务于陪伴感，而不是工具感

我们希望它更像一个“住在桌面里的角色”，而不是一个浮在桌面上的网页入口。

## 当前进展

目前仓库已经完成了主干能力的第一轮搭建，重点包括：

- 透明无边框桌宠窗口
- 基于 PixiJS 的独立渲染链路
- 平滑拖拽与桌面驻留
- 基于状态机的情绪 / 场景状态切换
- 编程、游戏、视频、聊天、待机等场景感知
- 桌面气泡反馈与轻互动
- 聊天面板与流式回复链路
- 长期记忆与主动互动基础能力
- 文件拖拽投喂、桌面短总结、聊天内完整分析
- 自定义宠物包导入的基础结构

现阶段更接近“可持续打磨的早期产品版本”，而不是所有细节都收口完成的正式版。

## 适合现在体验什么

如果你现在下载安装或拉源码运行，比较适合重点体验这些部分：

- bb7 在桌面上的常驻表现和基础陪伴感
- 右键菜单、拖拽、设置页、聊天页这些核心交互
- 编程、看视频、聊天、挂机等场景下的状态变化
- 把文件拖到宠物身上后的投喂分析流程
- 工作模式里的基础专注陪伴能力

## 仍在继续打磨的部分

下面这些内容已经有基础，但还不是最终状态：

- 动画细节密度和状态过渡的质感
- 主动互动的时机与频率控制
- 部分边缘场景下的上下文识别稳定性
- 初次使用流程和产品化收口
- 插件系统与社区扩展生态

## 技术栈

- Electron
- PixiJS
- React
- TypeScript
- Zustand

## 目录结构

```text
src/
  ai/
  components/
  context/
  domain/
  pets/
  plugins/
  rendering/
  services/
  shared/
  store/

electron/
  main.ts
  preload.ts
  services/

pets/
  mochi/

docs/specs/
media/
```

## 本地启动

安装依赖：

```bash
npm install
```

启动开发版桌宠：

```bash
npm run desktop:dev
```

如果你只想直接试现成版本，也可以运行安装包：

```text
release/Deep Pet-0.1.0-Setup-x64.exe
```

## 常用命令

类型检查：

```bash
npm run typecheck
```

构建前端与 Electron 产物：

```bash
npm run build
```

打包安装版：

```bash
npm run dist
```

桌宠基础冒烟检查：

```bash
npm run smoke:desktop
```

Mochi / bb7 资源 QA：

```bash
npm run qa:mochi
```

## AI 能力说明

项目已经接好 AI 对话与分析链路，但完整聊天能力需要在设置页里配置可用的 API Key。

当前如果没有填写 API Key，你仍然可以体验这些不依赖云端对话的能力：

- 桌宠窗口与动画
- 场景感知与状态切换
- 基础桌面反馈
- 设置页与工作模式
- 文件投喂的本地流程入口

如果已经配置好 AI Provider，可以继续体验：

- 流式聊天
- 更完整的文件分析
- 情绪化回复
- 记忆与主动互动

## 自定义宠物包

项目已经预留了宠物包导入结构，后续可以继续扩展为社区共享方案。

建议宠物包至少包含这些文件：

- `manifest.json`
- `animations.json`
- `states.json`
- `personality.json`
- `companion-content.json`

如需继续扩展宠物资源格式和导入结构，可以参考：

- [docs/specs/pet-package-template.md](./docs/specs/pet-package-template.md)
- [src/pets/README.md](./src/pets/README.md)

## 设计与架构文档

核心设计说明位于 `docs/specs/`，建议优先阅读：

- [docs/specs/product-architecture.md](./docs/specs/product-architecture.md)
- [docs/specs/runtime-modules.md](./docs/specs/runtime-modules.md)
- [docs/specs/phase-roadmap.md](./docs/specs/phase-roadmap.md)
- [docs/specs/release-and-packaging.md](./docs/specs/release-and-packaging.md)

## 开源协议

[MIT](./LICENSE)
