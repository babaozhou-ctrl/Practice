# 参与协作

感谢你愿意来看 Deep Pet。

这个项目不只是做功能，更在意“陪伴角色”的长期体验。所以一个改动是否成功，不只看它能不能运行，也要看它会不会破坏宠物的安静感、可读性和长期驻留体验。

## 开始之前

建议先看这些内容：

- [README.md](./README.md)
- [docs/specs/product-architecture.md](./docs/specs/product-architecture.md)
- [docs/specs/phase-roadmap.md](./docs/specs/phase-roadmap.md)

当前内置基准宠物仍然是 **Mochi**。如果你要做视觉、动画、陪伴内容或产品语气相关改动，尽量以 Mochi 的方向为参考，而不是把项目带回旧 demo 风格。

## 我们优先关注什么

- 动画质量高于快速视觉补丁
- 场景感知高于高频打扰
- 模块化架构高于一次性捷径
- 宠物气质一致性高于单点功能堆叠
- 清晰可读的公开提交高于“大而全”的混合修改

## 本地检查

在提交公开改动前，至少跑这两项：

```bash
npm run typecheck
npm run build
```

如果这次改动涉及 Mochi 的动画、atlas 或 sprite 资源，请再补一项：

```bash
npm run qa:mochi
```

## 代码与产品风格约定

- 保持桌宠运行时轻量，不要把重逻辑塞进渲染路径
- 避免让 React 驱动逐帧更新
- Electron 与 renderer 之间尽量保持清晰的 typed boundary
- 新代码和新文档不要重新引入旧的 catgirl 命名方向
- 对外文案不要夸大未完成能力，也不要写成 AI 味很重的宣传稿

## 宠物包与社区扩展

如果你准备贡献宠物包或宠物包模板，先参考这些内容：

- [docs/specs/pet-package-template.md](./docs/specs/pet-package-template.md)
- [src/pets/README.md](./src/pets/README.md)
- [pets/template-luna/README.md](./pets/template-luna/README.md)

我们更欢迎：

- 文件结构清晰的完整宠物包
- 能体现角色气质的 `personality` 和 `companion-content`
- 有清楚说明的 atlas / production 配置

不太希望看到：

- 只丢一张图但没有状态定义
- 只有功能入口、没有角色语气
- 把宠物做成普通聊天壳子

## 提交范围

每次改动尽量保持聚焦。

比较理想的提交方式：

- 一个提交只解决一类问题
- 明确说明用户可感知的变化
- 视觉或动画改动附带截图、动图或 QA 结果
- 如果有未完成边角，直接写清楚，不要隐藏
