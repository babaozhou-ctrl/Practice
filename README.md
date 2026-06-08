# Deep Pet

Deep Pet 是一个桌面陪伴宠物项目，目标不是做一个会动的小挂件，而是做出一个能长时间安静待在桌面、又真的有陪伴感的角色。

它应该像一个“住在桌面里的伙伴”：

- 平时不吵不闹，安静待着
- 会根据你当前在做什么改变状态和反应
- 能聊天，也能记住一些上下文
- 偶尔会主动互动，但不会一直打断你
- 动画和气质更接近游戏角色，而不是网页浮层

当前内置角色统一为 **bb7**。它是这个仓库现在的默认陪伴角色，也是现阶段产品气质、动画方向和交互语言的基准。

## 当前重点

这个项目现在优先追求的是：

- 陪伴感高于功能堆积
- 动画体验高于“先跑起来再说”
- 长时间驻留的舒适感高于高频提醒
- 清晰可扩展的架构高于一次性 Demo

## 当前已经具备的能力

当前仓库已经跑通了这些主链能力：

- 透明无边框桌宠窗口
- 基于 PixiJS 的独立渲染运行时
- 平滑拖拽与低打扰桌面驻留
- FSM 驱动的情绪与场景状态切换
- coding / gaming / watching_video / chatting / idle 等上下文骨架
- 陪伴式聊天面板
- 文件投喂与桌面短总结
- 长期记忆与主动轻互动的基础链路
- 专注 / 休息 / 防过劳提醒的工作模式基础能力
- 模块化宠物包导入与内置宠物切换

还在继续打磨的重点包括：

- 动画细节密度和状态切换质感
- 首次使用体验和整体产品收口
- 更稳定的长期记忆与上下文承接
- 对外展示素材和发布体验

## 技术栈

- Electron
- PixiJS
- React
- TypeScript
- Zustand

## 仓库结构

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

## 开发命令

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

## 自定义宠物包

仓库现在支持两种接入路径。

1. 完整宠物包导入

- 适合长期维护和分享的宠物包
- 支持 `manifest.json`、`animations.json`、`states.json`
- 支持 `personality.json`、`companion-content.json`
- 支持 atlas 与本地资源加载

2. 旧版 sprite 导入

- 适合快速验证单个 sprite sheet
- 只需要旧格式 JSON 配置和 PNG
- 系统会补默认的 personality 和 companion-content

如果你准备自己做宠物包，建议先看：

- [docs/specs/pet-package-template.md](./docs/specs/pet-package-template.md)
- [src/pets/README.md](./src/pets/README.md)
- [pets/template-luna/README.md](./pets/template-luna/README.md)

## 设计与架构文档

核心设计说明放在 `docs/specs/` 里，避免把 README 写成过长的技术清单。

建议优先看：

- [docs/specs/product-architecture.md](./docs/specs/product-architecture.md)
- [docs/specs/runtime-modules.md](./docs/specs/runtime-modules.md)
- [docs/specs/phase-roadmap.md](./docs/specs/phase-roadmap.md)
- [docs/specs/pet-package-template.md](./docs/specs/pet-package-template.md)
- [docs/specs/release-and-packaging.md](./docs/specs/release-and-packaging.md)
- [docs/specs/github-publishing-checklist.md](./docs/specs/github-publishing-checklist.md)

## 当前边界

这个项目已经不再是最早期的桌宠原型，但离“产品级 AI Companion”还有一段路。

- 对外展示素材还不完整
- 社区宠物包生态还在搭骨架
- 插件系统暂时还没有完全开放
- AI provider 扩展和长期记忆仍在继续深化
- 顶层产品体验还会继续做去 Demo 感收口

## 协作说明

如果你准备参与这个项目，先看这里：

- [CONTRIBUTING.md](./CONTRIBUTING.md)

如果你准备补截图、动图或仓库展示素材，也可以先看：

- [media/README.md](./media/README.md)

## 开源协议

[MIT](./LICENSE)
