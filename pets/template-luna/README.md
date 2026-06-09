# Luna 模板包

这是一个给社区作者使用的示例宠物包模板，不是最终内置宠物。

它的作用是：

- 演示完整宠物包通常需要哪些文件
- 提供 `personality`、`companion-content`、`production` 的最小结构
- 给导入器和后续社区宠物包生态一个可以复制的起点

## 当前说明

- `sprite-atlas.png` 目前没有随模板附带，这个目录暂时处于 `hybrid` 阶段
- `sprite-definition.json` 仍然保留为 fallback 占位结构，方便运行时识别这个包
- 真正准备对外分发时，建议补齐完整 atlas、contact sheet 和预览 gif

## 适合怎么用

你可以把它当作一个最小起点：

- 先替换 `manifest.json` 里的角色信息
- 再补自己的 `animations.json`、`states.json`
- 然后写出自己的 `personality.json` 和 `companion-content.json`
- 最后再根据产出流程补 `production.json`

如果你的目标是做一个正式可分享的宠物包，建议不要只替换图片，而是把状态、人设、互动语气一起补齐。
