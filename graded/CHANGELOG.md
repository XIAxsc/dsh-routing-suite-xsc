# Changelog

## 未发布（DSH 0.2.x 适配清理）

> 仅清理，无运行时行为变更 —— 因此**不升版本**，`0.0.1-rc1` 的发布物保持不变。
> 仓库内的 `dsh-external-dsh-graded-mode-0.0.1-rc1.tgz` 打包于清理之前，仍含下述已删文件；
> 下次发版时自然消失。

- **删除 `dsh.plugin.json`（死 manifest）**：内容为 `{"contributes":{"commands":["分级"]}}`。
  在 DSH `0.2.0-rc.2` 的整棵 runtime 树中，`dsh\.plugin\.json` **0 命中**，
  `pluginManifest|PLUGIN_MANIFEST` 限 `*.js` 也 **0 命中**；`contributes` 的 66 处命中
  **全部是散文/JSDoc 措辞**，没有任何 manifest schema 实现。该文件不被任何代码消费。
- **`engines` 修正**：`{"dsh": ">=0.0.1-rc"}` → `{"node": ">=22"}`。
  `engines.dsh` 是全树 **0 命中**的非标准键（无人消费）；DSH 版本要求写在 README 与
  `README.en.md` 的 DSH Target 说明里。
- **悬空 `types` 去除**：`types: ./lib/types/index.d.ts` 与 `exports["."].types` 指向的
  `graded/lib/types/` **不存在**（构建只产出 `index/client/inject-text/mode-state/tools` 六个
  `.js`），已从 manifest 移除，`exports` 简化为字符串映射。
- 文档：`graded/README.md`、`graded/docs/VERIFIABILITY.md` 中硬编码的 `--profile web`
  改为 `--profile <profile>`（profile 名以实际部署为准）。
- **契约面复核**：graded 只依赖 `ctx.webServer.register(...)`（4 处，均取 disposer），
  **无** `loader.*` / `_dispose` / `registry.*` / `ctx.get(...)` 调用；`inject` 的
  `['commands','userQuestions','webServer','tools']` 四项服务在 `0.2.0-rc.2` 全部存在
  （`dsh-commands` / `dsh-user-questions` / `dsh-host-webserver` / `dsh-tools`）。

## 0.0.1-rc1（2026-09-02）Release Candidate
- 注入淤积根治：focus 幂等键去 status（状态抖动不再重注同名引导）；执行端续轮 followup→steer + 同 turn 60ms 引导合并（消除 next-turn 堆积）
- 面板稳定：会话感知三级回退（URL/历史解析 ?sid=/盘 mtime）+防错显示；**设置面板闪退修复**（effect 一次挂载+回调 ref 化）
- 概念上限动态化：loadConceptLimit 读路径对齐设置 API（此前写读不一致致设置失效）——phaseL2/焦点注入/schema 描述全随设置（实测 8 全链断言）
- 面板视觉：已完成组默认折叠+组进度徽标+完成态侧条
- 测试 62/62；`0.0.1-exp` 为前一实验版（历史保留）

## 0.0.1-exp（2026-09-02）体验实验版
- 脑暴出题制：ask_user_question 选择题对齐（多轮歧义结清）+必选模式题（用户点选，经 commit_star(mode) 落盘）
- 时序修复：大小类引导走 next-step（同轮即时，无过期）；锁定回执=完整规格单；审核唯一确认请求；『修改』回滚开口（reject-ack）
- 小类粒度模式 item.mode（缺省继承会话；scanMode 只认用户=防漂移）
- 北极星锚定替代"开工前自问"；委派允许情景改写（验收锚=盘档规格）+委派通道自主决策（后台/阻塞）
- commit_star 修订保留阶段（修复回退 bug）；focus 模式标注修复；开源脱敏（发布面路径占位/os.homedir 回退/硬编码净化+红队两轮复核）

## 3.1.0（2026-09-01）规格化重设计
- 脑暴链→commit_star 定稿；规格化两级计划（spec/accept/do/verify 必填门控）
- 注入规格前置三段式+委派/编排/红队/双轨 skill 卡；组收官逐条核对+verify 注入
- 状态磁盘单轨（热重载零中断）；审计端点；超级面板（三层树/量化/北极星/红队灯）

## 3.0.0（2026-09-01）正式版
- 两级任务协议：大类→锁定→小类→锁定→树状审核→打卡制开发→组收官→终验
- 三模式包（correct/experience/research）；先注后键单注；当下态回执
