# 参与协作

欢迎一起打磨 Deep Pet。

这个项目关心的不只是“功能能不能跑”，还关心一个陪伴角色长期待在桌面时，给人的感觉是不是自然、舒服、可信。所以一处改动是否成立，不只看它能不能工作，也看它会不会破坏角色气质、动画质感和长期使用体验。

## 开始之前

建议先读这几份文档：

- [README.md](./README.md)
- [docs/specs/product-architecture.md](./docs/specs/product-architecture.md)
- [docs/specs/phase-roadmap.md](./docs/specs/phase-roadmap.md)

当前内置基准角色是 **bb7**。如果你要改视觉、动作、陪伴文案或产品语气，请尽量沿着 bb7 现在的方向继续，而不是把项目带回老式桌宠 demo 或普通聊天工具的感觉。

## 我们优先关注什么

- 动画质量高于快速补视觉
- 场景感知高于高频打扰
- 清晰可扩展的模块结构高于一次性堆功能
- 角色气质一致性高于局部“功能很全”
- 对外文案尽量自然克制，不夸大还没完成的能力

## 本地检查

提交公开改动前，至少跑这两项：

```bash
npm run typecheck
npm run build
```

如果这次改动涉及 bb7 的 atlas、sprite 或动画资源，再补一项：

```bash
npm run qa:mochi
```

## 代码与产品风格约束

- 保持桌宠运行时轻量，不把重逻辑塞进渲染路径
- 避免让 React 驱动逐帧更新
- Electron 和 renderer 之间尽量保持清晰的 typed boundary
- 新代码和新文档不要重新引入旧的 `catgirl` 命名方向
- 对外说明尽量像产品文档，不要写成客服话术或 AI 宣传稿

## 宠物包与社区扩展

如果你准备贡献宠物包或宠物包模板，建议先参考：

- [docs/specs/pet-package-template.md](./docs/specs/pet-package-template.md)
- [src/pets/README.md](./src/pets/README.md)
- [pets/template-luna/README.md](./pets/template-luna/README.md)

我们更欢迎：

- 文件结构清晰的完整宠物包
- 能体现角色气质的 `personality` 和 `companion-content`
- 有清楚说明的 atlas / production 配置

不太希望看到：

- 只丢一张图，没有状态定义
- 只有功能入口，没有角色语气
- 把宠物做成普通聊天壳子

## 提交范围

每次改动尽量保持聚焦。

比较理想的提交方式：

- 一次提交只解决一类问题
- 明确说明用户可感知的变化
- 视觉或动画改动附上截图、动图或 QA 结果
- 如果还有未完成边角，直接写清楚，不要藏着
