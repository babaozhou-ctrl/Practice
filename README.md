# Deep Pet

Deep Pet 是一个桌面陪伴宠物项目。
它不是“会动的小挂件”，也不是普通聊天壳子，而是一个会长期待在桌面、能感知场景、带着情绪和陪伴感的 AI Companion。

当前内置角色统一为 **bb7**。现阶段的视觉、语气、陪伴方式和交互基准，都会围绕 bb7 继续打磨。

## 下载体验

- Windows 安装包：[`Deep.Pet-0.1.0-Setup-x64.exe`](https://github.com/babaozhou-ctrl/deep-pet/releases/download/v0.1.0/Deep.Pet-0.1.0-Setup-x64.exe)
- Release 页面：[`v0.1.0`](https://github.com/babaozhou-ctrl/deep-pet/releases/tag/v0.1.0)

如果你只是想先体验当前版本，直接下载安装包即可，不需要自己拉源码构建。

## 产品方向

这个项目追求的是一种更安静、更有存在感的桌面陪伴体验：

- 平时安静待在桌面，不频繁打断用户
- 根据当前场景切换状态、动作和表达
- 聊天时有情绪、有上下文，不像工具回复
- 文件投喂、工作陪伴、轻互动都服务于“陪伴感”
- 动画和角色表现优先于功能堆砌

我们希望它更像“住在桌面里的角色”，而不是“放在桌面的应用入口”。

## 当前进展

仓库现在已经具备这些主链能力：

- 透明无边框桌宠窗口
- PixiJS 驱动的独立渲染运行时
- 平滑拖拽与桌面驻留
- 基于 FSM 的情绪 / 场景状态骨架
- coding / gaming / watching_video / chatting / idle 等上下文切换
- 聊天面板与流式 AI 回复链路
- 文件拖拽投喂、桌面短总结、聊天内完整分析
- 长期记忆与主动轻互动基础能力
- 陪伴工作模式的基础结构
- 内置宠物与自定义宠物包导入链路

还在持续打磨的重点包括：

- 动画细节密度和状态切换质感
- 首次使用体验和整体产品收口
- 更稳定的上下文承接与长期记忆
- 开源展示素材、发布流程与社区扩展体验

## 当前可用程度

目前已经可以作为一个早期可用版本来体验，适合：

- 安装后常驻桌面，观察 bb7 的基础陪伴表现
- 打开聊天面板，体验带上下文的互动链路
- 拖文件到宠物身上，体验“投喂 -> 思考 -> 桌面短总结 -> 聊天完整分析”
- 使用工作模式，体验番茄钟 / 专注陪伴的基础结构

但它还不是最终完成态，现阶段更接近：

- 一个已经跑通主链路、能稳定体验的 early product build
- 而不是所有细节都打磨完成的正式版

最近一轮重点还收敛了默认陪伴节奏，目标是让 bb7 更安静待在桌面，减少频繁发言、过度晃动和不自然的“下蹲感”。

## 技术栈

- Electron
- PixiJS
- React
- TypeScript
- Zustand

## 项目结构

```text
src/
  ai/
  components/
  domain/
  pets/
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
  template-luna/

docs/specs/
media/
```

## 常用命令

安装依赖：

```bash
npm install
```

启动桌面开发环境：

```bash
npm run desktop:dev
```

类型检查：

```bash
npm run typecheck
```

构建应用：

```bash
npm run build
```

打包发布版本：

```bash
npm run dist
```

如果本轮改动涉及 bb7 的 sprite / atlas：

```bash
npm run qa:mochi
```

当前 release 在发布前已至少做过这些检查：

- `npm run typecheck`
- `npm run build`
- `npm run dist`
- `node scripts/smoke-desktop.mjs`
- `node scripts/stability-runtime.mjs --skip-build --scenario=stability-chat --duration-ms=60000`

## 自定义宠物包

当前支持两种接入方式：

1. 完整宠物包导入
- 适合长期维护和分享的宠物包
- 支持 `manifest.json`、`animations.json`、`states.json`
- 支持 `personality.json`、`companion-content.json`
- 支持 atlas 资源与本地预览图

2. 旧版 sprite 导入
- 适合快速验证单个 sprite sheet
- 提供旧格式 JSON 和 PNG 即可
- 系统会补默认 personality 和 companion content

如果你准备自己制作宠物包，建议先看：

- [docs/specs/pet-package-template.md](./docs/specs/pet-package-template.md)
- [src/pets/README.md](./src/pets/README.md)
- [pets/template-luna/README.md](./pets/template-luna/README.md)

## 设计与架构文档

核心设计说明放在 `docs/specs/`，建议优先阅读：

- [docs/specs/product-architecture.md](./docs/specs/product-architecture.md)
- [docs/specs/runtime-modules.md](./docs/specs/runtime-modules.md)
- [docs/specs/phase-roadmap.md](./docs/specs/phase-roadmap.md)
- [docs/specs/pet-package-template.md](./docs/specs/pet-package-template.md)
- [docs/specs/release-and-packaging.md](./docs/specs/release-and-packaging.md)
- [docs/specs/github-publishing-checklist.md](./docs/specs/github-publishing-checklist.md)

## 当前边界

这个项目已经不是最早期的桌宠原型，但离“产品级 AI Companion”还有一段路：

- 对外展示素材还不完整
- 社区宠物包生态还在搭骨架
- 插件系统暂时没有完全开放
- AI provider 扩展和长期记忆仍在继续深化
- 顶层产品体验还会继续做去 Demo 感收口

## 协作说明

如果你准备参与这个项目，可以先看：

- [CONTRIBUTING.md](./CONTRIBUTING.md)

如果你准备补截图、动图或仓库展示素材，也可以先看：

- [media/README.md](./media/README.md)

## 开源协议

[MIT](./LICENSE)
