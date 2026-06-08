# Checkpoint 2026-06-08

## 当前已完成

- GitHub 仓库已改名为 `deep-pet`
- 远端地址已更新为 `https://github.com/babaozhou-ctrl/deep-pet.git`
- 仓库首页 `README` 已改为中文产品简介
- 已完成一次远端同步提交：
  - commit: `b403501`
  - message: `完善陪伴互动与中文仓库简介`

## 今天已经落地并已推送的功能

- 聊天面板已支持 `CompanionActionBridge`
- 主动提醒和工作模式提醒可以进入聊天面板，显示为可点击动作
- 文件分析拖拽链路已经接通
- `Mochi` 当前宠物资源、QA 预览和文档已更新

## 当前工作树状态

当前工作树有未提交修改，主要集中在陪伴内容层重构：

- `src/ai/CompanionDesktopSummary.ts`
- `src/domain/companion/CompanionSpeechPolicy.ts`
- `src/domain/companion/ProactiveInteractionScheduler.ts`
- `src/pet-main.ts`
- `src/domain/companion/CompanionActionContent.ts`（新文件，未提交）

这些改动正在做的方向是：

- 把主动互动 action 内容从 `pet-main.ts` 抽离出去
- 清理陪伴气泡策略、主动提醒调度器、摘要桥接里的乱码和文案问题
- 让 `pet-main.ts` 更像 runtime entry，而不是内容层堆放点

## 目前未完成的问题

1. `pet-main.ts` 仍然处于半重构状态
   - 终端展示里仍能看到乱码文本
   - startup greeting / late-night message 还没有完全收干净

2. `CompanionActionContent.ts` 已创建，但还没有完成最终接管
   - 需要确认所有主动互动 action 都从这个模块生成
   - 需要和 `pet-main.ts` 的调用保持一致

3. `CompanionSpeechPolicy.ts` 和 `ProactiveInteractionScheduler.ts`
   - 目前版本仍有乱码展示风险
   - 需要继续替换为稳定中文内容版本

4. 当前未重新跑验证
   - 需要在整理完上述文件后重新运行：
   - `tsc --noEmit`
   - `vite build`

5. 当前未推送
   - 因为这批内容层重构还没收口
   - 完成验证后，需要用中文 commit message 推到 `origin/main`

## 继续建议

推荐顺序：

1. 完成 `pet-main.ts`、`CompanionSpeechPolicy.ts`、`ProactiveInteractionScheduler.ts` 的稳定替换
2. 确认 `CompanionActionContent.ts` 真正接管主动互动内容构建
3. 跑 `tsc --noEmit`
4. 跑 `vite build`
5. `git add -A`
6. 用中文提交信息 commit
7. `git push origin main`

## 风格约定

- 产品说明、README、提交信息优先中文
- technical stack、module names、engineering terms 保持 English
- 大改动完成后要同步推送 GitHub
