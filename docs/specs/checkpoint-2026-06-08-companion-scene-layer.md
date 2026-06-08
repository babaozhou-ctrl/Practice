# 2026-06-08 Companion Scene Layer

这次 checkpoint 不是继续堆更多 activity 判断，而是把“桌面上下文 -> 陪伴场景 -> 状态 / 文案 / 记忆”这条中间层正式拉出来。

## 为什么要加这一层

原来系统已经能识别：

- coding
- gaming
- watching_video
- chatting
- browsing
- reading
- idle

但这些仍然更像“技术分类”，还不够像产品语义。

对于桌面陪伴角色来说，真正影响表现的不是单纯 `activity`，而是更接近用户体感的 scene：

- 是深度专注，还是轻度浏览
- 是一起看内容，还是社交聊天
- 是静静陪着，还是深夜收尾
- 是暂时离开，还是重新回到桌面

如果没有 scene 层，后面的 FSM、主动互动、聊天语气、长期记忆就容易各自维护一套判断，最后出现：

- 动画状态和文案语气不一致
- AI 聊天上下文理解不到位
- 记忆里只记住“在 coding”，记不住“那是一次深夜收尾式专注”

## 这次落地了什么

- 新增 `src/domain/companion/CompanionScene.ts`
- `CompanionSnapshot` 现在正式包含 `scene`
- `CompanionStateMachine` 会基于 activity / emotion / mode / idle / workMode 解析 scene
- `attachWorkModeToSnapshot` 会在挂载 work mode 后重新计算 scene
- AI 聊天上下文现在会携带：
  - `sceneId`
  - `sceneLabel`
  - `sceneEnergy`
- Companion memory 现在会记录：
  - `lastScene`
  - 带 scene 语义的 `recentTopics`
- Pixi 微动运行时现在也会消费 scene：
  - `scene.energy` 会影响整体运动强度
  - `scene.id` 会影响呼吸、摇摆、眨眼、重心偏移和 settle 节奏

## 当前 scene 语义

目前的 scene 枚举是：

- `away`
- `deep_focus`
- `steady_focus`
- `watch_together`
- `social_corner`
- `play_session`
- `reading_nook`
- `late_night_wind_down`
- `quiet_idle`
- `soft_browsing`
- `ambient_presence`

这批 scene 先覆盖当前最重要的陪伴质感，而不是追求一次性列全所有细分场景。

## 对后续阶段的意义

这层补齐后，后面几块就有统一落点了：

1. FSM 细化
   - 可以继续把 state 决策建立在 scene 之上，而不是继续横向堆 activity 分支

2. 主动互动
   - 可以按 `deep_focus / watch_together / late_night_wind_down` 分别控制打扰强度和语气

3. AI 对话
   - prompt 可以更稳定地知道用户正处在什么“陪伴场景”里

4. 长期记忆
   - 后续可以记住“用户常在深夜收尾时想被轻一点提醒”这种更有陪伴感的模式

5. 渲染表现
   - 同一个 base clip 不再只能机械复用
   - `quiet_idle`、`deep_focus`、`watch_together`、`late_night_wind_down` 会逐渐长出不同的身体节奏

## 下一步建议

最值得接着做的不是再加更多 scene，而是让 scene 真正驱动表现：

- 把 `scene.energy` 接到渲染微动强度
- 把 `scene.tone` 接到主动互动文案模板
- 把 `sceneId` 接到 AI provider prompt 的更细颗粒度规则
- 把 `watch_together / social_corner / late_night_wind_down` 的陪伴内容模板拆出来
