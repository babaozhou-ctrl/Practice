# 宠物包模板规范

这份文档面向准备为 Deep Pet 制作自定义宠物包的人。

目标不是只把一张图拖进去，而是做出一个真正可长期扩展、可共享、可继续打磨的宠物包结构。一个完整宠物包应该同时描述：

- 角色身份与陪伴气质
- 动画片段与状态映射
- 主动互动文案
- 资源文件与 atlas 布局
- 生产阶段状态

## 推荐目录

```text
pets/
  your-pet/
    manifest.json
    animations.json
    states.json
    personality.json
    companion-content.json
    preview.png
    appearance.json
    production.json
    asset-status.json
    sprite-definition.json
    sprite-atlas.png
    README.md
```

说明：

- `manifest.json`：宠物包入口，声明资源路径、能力、标签与 renderer 类型。
- `preview.png`：设置页和未来宠物库展示用的预览图。
- `animations.json`：定义 clip、fps、loop、micro motions、motion profile。
- `states.json`：把桌面 companion 状态映射到 clip。
- `personality.json`：定义人格、语气、上下文行为、prompt directives。
- `companion-content.json`：定义主动互动 action chips 与轻交互文案。
- `appearance.json`：描述视觉气质、轮廓与配色意图。
- `production.json`：定义 atlas 切片规则、anchor、表情语言。
- `asset-status.json`：标记当前资源是否 production-ready。
- `sprite-definition.json`：procedural fallback 结构。没有 atlas 或 production profile 时，运行时可以回退到它。
- `sprite-atlas.png`：完整 atlas 贴图。

## 两种导入路径

当前运行时支持两种导入模式：

1. 完整宠物包导入

- 适合准备开源共享、长期维护的宠物包
- 会保留 atlas、personality、companion-content、production profile
- 运行时会通过 Electron 本地协议直接读取导入包里的 atlas 资源

2. 旧版 sprite 导入

- 适合先快速测试一组 sprite
- 只需要一份旧格式 JSON 配置和一张 PNG sprite sheet
- 系统会自动补默认 personality 与 companion-content
- 更像“快速原型入口”，不适合长期当成社区包标准

## manifest.json 最小建议

```json
{
  "id": "template.luna",
  "name": "Luna",
  "version": "0.1.0",
  "schemaVersion": "1.0.0",
  "renderer": "pixi-atlas",
  "description": "A calm moonlit desktop companion.",
  "assets": {
    "atlas": "sprite-atlas.png",
    "previewImage": "preview.png",
    "animations": "animations.json",
    "states": "states.json",
    "personality": "personality.json",
    "companionContent": "companion-content.json",
    "appearance": "appearance.json",
    "productionProfile": "production.json",
    "assetStatus": "asset-status.json",
    "spriteGuide": "README.md"
  },
  "tags": ["cozy", "companion", "pixel-art"],
  "capabilities": {
    "speechBubbleAnchor": true,
    "emoteOverlay": true,
    "ambientMicroMotion": true,
    "fileAnalysis": true,
    "screenPerception": true,
    "proactiveChat": true,
    "workModeSupport": true,
    "importable": true
  }
}
```

注意：

- `id` 最好全局唯一，建议使用 `namespace.name` 风格。
- `renderer` 目前推荐 `pixi-atlas` 或 `procedural-sprite`。
- `assets.companionContent` 在当前架构里已经是正式字段，不要省略。
- `assets.previewImage` 建议始终提供。它不参与运行时动画，但会直接影响宠物包在设置页和未来社区库中的展示质量。
- 如果未提供 `assets.previewImage`，导入流程会尝试基于 atlas 首帧或 `sprite-definition.json` 自动生成一张预览图，方便包在本地库里先正常展示。但自动图只适合作为兜底，正式开源包仍建议手工提供。

## 当前导入器会重点检查什么

- `schemaVersion` 当前必须是 `1.0.0`
- `renderer` 当前必须是 `pixi-atlas` 或 `procedural-sprite`
- `manifest.json` 里声明的资源文件，导入时必须真的能找到
- `pixi-atlas` 包必须同时提供 atlas 和 `production.json`
- `procedural-sprite` 包必须提供 `sprite-definition.json`
- `states.json` 至少要有 `idle`，并且引用到的 clip 必须在 `animations.json` 里存在
- `animations.json` 里的每个 clip 至少要有一帧，`fps` 需要大于 0
- 如果你提供了 `companion-content.json`，它的各个 proactive 入口需要结构完整

这样做的目的不是故意卡人，而是避免社区包导入成功后却在运行时静默退化成错误状态。

## personality.json 建议重点

`personality.json` 至少应该覆盖这些字段：

- `identity.role`
- `identity.presence`
- `identity.responseStyle`
- `tone`
- `speechRules`
- `contextBehaviors`
- `promptDirectives.core`
- `promptDirectives.avoid`
- `promptDirectives.do`
- `memoryPolicy`

这部分决定宠物更像“陪伴角色”还是“工具型助手”。如果只写基础 tone，不写 `identity` 和 `promptDirectives`，最后很容易退回普通聊天框气质。

## companion-content.json 建议重点

这部分负责主动互动与 follow-up chips。

当前内置结构需要这些入口：

- `focusEnding`
- `breakEnding`
- `overworkFirm`
- `overworkGentle`
- `productiveSession`
- `lateNight`
- `watchTogether`
- `gentleIdle`

每个入口都应该有：

- `title`
- `actions[]`
- 每个 action 需要 `id`、`label`、`prompt`

这里建议把宠物的“陪伴方式”写进去，而不是写成通用工具提示。

## sprite-definition.json 的定位

如果你的包已经有高质量 atlas，`sprite-definition.json` 仍然建议保留。

原因：

- 它能作为运行时 fallback
- 它能作为导入阶段的保底结构
- 它让包在资源未完全生产就绪时仍然可预览

当前推荐做法：

- production-ready 包：同时提供 atlas 与 sprite-definition
- 早期包：先提供 sprite-definition，再逐步升级到 atlas

## asset-status.json 的用途

这个文件不是摆设，它让项目能区分：

- 只是可跑
- 可共享但还未打磨
- 真正 production-ready

推荐至少标清：

- `packageStage`
- `referenceAligned`
- `atlasReady`
- `runtimeFallbackEnabled`
- `speechToneReady`
- `pendingWork`

## 开源建议

如果你准备把宠物包共享给其他人，建议额外补：

- 一个包内 README
- 一张 contact sheet
- 至少一份动画预览 gif
- 使用说明与授权说明

这会直接影响社区生态是否能形成，而不是只停留在“代码能跑”。
