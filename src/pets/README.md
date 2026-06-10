# 宠物包系统

这个目录负责宠物包 schema、加载器和跨窗口同步能力，服务于“内置宠物”和“导入宠物”两条路径。

## 核心目标

- 校验宠物包 manifest
- 解析 atlas、动画和状态资源
- 加载 personality 与 companion content
- 让新宠物接入时尽量不改核心运行时

## 当前架构方向

- 内置宠物通过小型 registry 发现，而不是直接写死在运行时里
- 当前选择的宠物会持久化，并在多个窗口之间同步
- 每个宠物包都可以拥有自己的动画、状态、人设与陪伴内容
- 宠物包可以继续扩展 prompt 指令、上下文行为和主动互动预设
- 能力定义通过 typed capability 描述，再由 provider hook 或插件层满足
- 导入宠物已经接上基于 Electron IPC 的本地持久化路径，后续可以自然扩展成正式的本地宠物库
- 迁移阶段允许保留少量 legacy alias，但不应继续对外暴露旧命名

## 近期重点

- 支持 package 级别的 file analysis、emote 和主动互动风格开关
- 把 procedural fallback 和包身份解耦，让非 bb7 宠物也能有自己的 fallback 方案
- 逐步把内置 capability provider 替换成真实的 plugin/provider 解析链路

## 自定义宠物包建议结构

建议的包文件包括：

- `manifest.json`
- `animations.json`
- `states.json`
- `personality.json`
- `companion-content.json`
- `appearance.json`（可选）
- `production.json`（可选）

`personality.json` 一般会定义这些内容：

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

`companion-content.json` 负责角色主动互动文案、bubble 表达、feed card 文案和 follow-up chips，这样每个宠物都能保留自己的语气和节奏。

当前还支持一个可选的 `feedCard` 配置块，用来定义：

- 文件投喂确认卡标题和按钮
- 思考中状态的桌面说明
- 分析完成后的桌面结果卡文案

运行时会把 `{{petName}}`、`{{fileName}}`、`{{desktopSummary}}` 这些占位符替换成当前内容，所以不同宠物可以保留自己的投喂语气，不需要再改主程序。

另外还支持可选的 `fileAnalysis.desktopUtterance`，用来定义文件分析完成后桌面气泡里的短句模板。

- `{{lead}}`：运行时按当前场景生成的开场短句
- `{{petName}}`：当前宠物名
- `{{fileName}}`：当前文件名
- `{{desktopSummary}}`：桌面短结论

## 当前导入能力

- 导入宠物时会同时持久化 `personality` 和 `companionContent`
- 运行时支持两条导入路径：
- 完整包导入：导入 `manifest.json`、可选 atlas 和 companion metadata
- 旧版 sprite 导入：导入一份旧配置 JSON 和一张 PNG sprite sheet，由应用生成默认 personality / content
- 完整包导入会把 atlas 资源保存到本地，并通过 Electron protocol 提供给运行时读取
- 如果导入包没有提供 `previewImage`，设置页会从 atlas 或 procedural fallback 自动生成本地预览缩略图
- 设置页会把宠物包作为完整产品条目展示，而不是一个只有名字的下拉项

## 参考起点

- `pets/mochi/`
- `docs/specs/pet-package-template.md`
