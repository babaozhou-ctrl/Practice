# Deep Pet

Deep Pet 是一个面向长时间驻留桌面的 AI 陪伴宠物项目。

它的目标不是做一个会动的小挂件，也不是把聊天框贴到透明窗口里，而是做出一个真正像“生活在桌面里的陪伴角色”的产品：安静、柔和、有情绪、有上下文感知，能在合适的时候陪你说话，也能在大多数时候只是自然地待在旁边。

当前默认内置宠物是 **Mochi**。它是一只低打扰、重氛围、偏 cozy 像素风的桌面陪伴角色，也是当前整个项目的动画和产品气质基准。

## 项目方向

Deep Pet 当前优先追求这些事情：

- 陪伴感先于功能堆积
- 动画体验先于“能跑就行”
- 上下文感知先于高频打扰
- 产品气质先于炫技式 UI
- 可扩展架构先于一次性 Demo

我们希望它最终具备这些特征：

- 长时间驻留桌面也不烦人
- 会根据用户当前行为切换状态和反应
- 有自己的情绪、节奏和说话方式
- 更像陪伴角色，而不是普通 AI 助手
- 可以被持续扩展为宠物包、插件和社区生态

## 当前已经完成到哪里

当前仓库已经具备这些基础能力：

- 透明无边框桌宠窗口
- 基于 PixiJS 的独立渲染运行时
- 平滑拖拽与低干扰的桌面驻留体验
- 有限状态机驱动的情绪/场景状态切换
- coding / gaming / watching_video / chatting / idle 等上下文行为骨架
- 陪伴式聊天面板与轻量主动互动
- PDF / DOCX / TXT / 代码文件的分析入口
- 番茄钟、专注、休息、防过劳提醒等工作模式基础
- 模块化宠物包加载
- 自定义宠物导入
- 完整宠物包导入链路
- 宠物包模板与导入规范文档

已经落地但仍在继续打磨的重点：

- 动画细节密度
- 宠物包生态与社区扩展体验
- 长期记忆和更稳定的陪伴人格
- 对外展示素材与发布体验

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

如果本轮改动涉及 Mochi 的 sprite / atlas，请额外运行：

```bash
npm run qa:mochi
```

## 自定义宠物包

仓库现在支持两种导入路径：

1. 完整宠物包导入

- 适合真正要长期维护和分享的宠物包
- 支持 `manifest.json`、`animations.json`、`states.json`
- 支持 `personality.json`、`companion-content.json`
- 支持 atlas 与本地资源加载

2. 旧版 sprite 导入

- 适合快速验证一份 sprite sheet
- 只需要旧格式 JSON 配置和 PNG
- 系统会自动补默认 personality 与 companion-content

如果你准备自己做宠物包，建议从这些内容开始看：

- [docs/specs/pet-package-template.md](./docs/specs/pet-package-template.md)
- [src/pets/README.md](./src/pets/README.md)
- [pets/template-luna/README.md](./pets/template-luna/README.md)

## 设计与架构文档

核心设计说明都放在 `docs/specs/` 里，避免把 README 写成过长的技术清单。

建议优先阅读：

- [docs/specs/product-architecture.md](./docs/specs/product-architecture.md)
- [docs/specs/runtime-modules.md](./docs/specs/runtime-modules.md)
- [docs/specs/phase-roadmap.md](./docs/specs/phase-roadmap.md)
- [docs/specs/pet-package-template.md](./docs/specs/pet-package-template.md)
- [docs/specs/release-and-packaging.md](./docs/specs/release-and-packaging.md)
- [docs/specs/github-publishing-checklist.md](./docs/specs/github-publishing-checklist.md)

## 当前限制

当前项目已经不是最早期的桌宠原型，但距离最终想要的“产品级 AI Companion”还有一段路：

- 对外展示素材还不完整
- 社区宠物包生态才刚开始搭骨架
- 插件系统还没有完全开放
- AI provider 的扩展和长期记忆还在继续深化
- 顶层产品体验还会继续做去 Demo 感打磨

## 协作说明

如果你准备参与这个项目，先看这里：

- [CONTRIBUTING.md](./CONTRIBUTING.md)

如果你准备补截图、动图或仓库展示素材，可以先看：

- [media/README.md](./media/README.md)

## 开源协议

[MIT](./LICENSE)
