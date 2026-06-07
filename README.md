# Deep Pet

Deep Pet 是一个面向长期驻留桌面的陪伴宠物项目。

它的目标不是做一个会动的小玩具，也不是把聊天框挂在透明窗口里，而是做出一个真正像“生活在桌面里”的陪伴角色。它应该安静、柔和、有情绪，会根据你的状态做出反应，也能在合适的时候主动陪你一下。

当前内置宠物是 **Mochi**，一个软乎、垂耳、低打扰的像素陪伴形象。

## 项目方向

这个项目优先关注这些事情：

- 动画和驻留体验要足够自然
- 宠物即使不说话，也要有“在场感”
- 上下文感知比频繁打断更重要
- UI 是辅助陪伴角色，不是替代它
- 宠物、人格、模型能力都应该可替换、可扩展

## 当前已经具备

- 透明无边框桌宠窗口
- 基于 PixiJS 的独立渲染循环
- 平滑拖拽与瞬时反应状态
- 带情绪和上下文稳定层的有限状态行为系统
- 低打扰的桌面气泡表达规则
- 聊天和文件分析的陪伴式摘要
- 模块化宠物包加载
- 支持 TXT、代码文件、PDF、DOCX 的文件分析
- 主动提醒与工作模式提醒接入聊天面板动作

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
  rendering/
  services/
  store/

electron/
  services/
  main.ts
  preload.ts

pets/
  mochi/

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

构建应用：

```bash
npm run build
```

打包发布版本：

```bash
npm run dist
```

运行类型检查：

```bash
npm run typecheck
```

重新生成 Mochi 的 QA 预览资源：

```bash
npm run qa:mochi
```

## 开发约定

- 桌宠运行时必须保持轻量，渲染流畅本身就是产品能力。
- 优先做“轻陪伴”，不要把它做成高频打扰型助手。
- 保持整体气质：cozy、soft、minimal、immersive。
- 现阶段以 Mochi 作为默认内置宠物持续打磨。

协作说明见：[CONTRIBUTING.md](./CONTRIBUTING.md)

## 设计与规格

项目的架构和路线文档在这里：

- [docs/specs/product-architecture.md](./docs/specs/product-architecture.md)
- [docs/specs/runtime-modules.md](./docs/specs/runtime-modules.md)
- [docs/specs/phase-roadmap.md](./docs/specs/phase-roadmap.md)
- [docs/specs/release-and-packaging.md](./docs/specs/release-and-packaging.md)
- [docs/specs/github-publishing-checklist.md](./docs/specs/github-publishing-checklist.md)
- [docs/specs/media-prep.md](./docs/specs/media-prep.md)

## 当前阶段说明

- 这个项目还在继续朝“可长时间使用的桌面陪伴产品”完善
- 对外展示用的截图、动图和发布说明还没有完全准备好
- 插件系统、社区宠物包和更完整的扩展生态仍在后续阶段

## 媒体资源

仓库展示素材规划见：[media/README.md](./media/README.md)

## 开源协议

[MIT](./LICENSE)
