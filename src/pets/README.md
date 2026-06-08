# 宠物包系统

这个目录负责宠物包 schema、加载器和跨窗口同步能力，服务于内置宠物和导入宠物两条路径。

## 核心目标

- 校验宠物包 manifest
- 解析 atlas 与动画资源
- 加载 personality 和状态映射
- 加载 companion-content 与主动互动预设
- 让新宠物接入时尽量不改核心运行时

## 当前架构方向

- 内置宠物通过小型 registry 发现，而不是直接写死在运行时里
- 当前选择的宠物会持久化并在多个窗口之间广播，保证聊天、设置和宠物窗口同步
- 宠物包自己拥有动画、状态、人格与陪伴内容元数据
- 宠物包也可以定义 prompt 指令、上下文行为和互动预设
- 宠物能力通过 typed capability 描述，再由 provider hook 或插件层满足
- 导入宠物已经接上基于 Electron IPC 的磁盘持久化路径，后面可以自然演进成真正的本地宠物库
- capability provider 已经统一过 registry/store 层，为后续插件后端接入预留了安全回退空间
- 迁移阶段允许保留少量 legacy alias，但不应该继续把它们暴露成对外主命名

## 近期重点

- 支持 package 级别的 file analysis、emote、主动互动风格开关
- 把 procedural fallback 与包身份解耦，让非 bb7 宠物也能带自己的 fallback 方案
- 逐步把内置 capability provider 替换成真实的 plugin/provider 解析链路

## 自定义宠物包说明

建议的包文件包括：

- `manifest.json`
- `animations.json`
- `states.json`
- `personality.json`
- `companion-content.json`
- `appearance.json`（可选）
- `production.json`（可选）

`personality.json` 建议定义这些内容：

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

`companion-content.json` 负责角色主动互动的文案和 follow-up chips，这样每个宠物都能保留自己的语气和节奏。

## 当前导入能力

- 导入宠物现在会同时持久化 `personality` 和 `companionContent`
- 运行时导入支持两条路径：
  - 完整包导入：导入 `manifest.json`、可选 atlas 和 companion metadata
  - 旧版 sprite 导入：导入一份旧配置 JSON 和一张 PNG sprite sheet，由应用生成默认 personality / content
- 完整包导入会把 atlas 资源保存在本地，并通过 Electron protocol 提供给运行时读取，这样导入宠物可以真正渲染自己的 atlas，而不必退回到内置资源
- 如果导入包没有提供 `previewImage`，设置页会从 atlas 或 procedural fallback 自动生成本地预览缩略图，避免卡片只剩名字
- 设置页现在会把宠物包作为完整的产品条目展示，而不是一个只有名字的下拉框

## 参考起点

- `pets/template-luna/`
- `docs/specs/pet-package-template.md`
