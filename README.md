# dsh-routing-suite-xsc — DSH 0.2.x 适配版（注入器 × 思维模式路由 × 分级模式）

[中文](README.md) | [English](README.en.md)

> **本仓库是 [`yjh051108/dsh-routing-suite`](https://github.com/yjh051108/dsh-routing-suite) 的 fork。**
> 上游最后一次适配停在 DSH `0.1.x`（声明 `DSH Target >=0.1.0-rc.6 <0.2.0`），没有跟进 0.2.x 的破坏性变更 ——
> 把上游原样装到当前 DSH（`0.2.0-rc.2`）上**必然装配失败**。
> 本 fork 完成了 0.2.x 适配：修掉 **2 处硬破坏 + 5 处契约漂移**，把 preset 迁移为声明式 bundle，
> 并补上双形态构建链。适配的判定依据、代码证据与验证结论全部留档在 **[docs/compat/](docs/compat/)**。

| 项 | 值 |
|---|---|
| 适配目标 | DSH **`0.2.0-rc.2`**（`cordis` 4.0.4 · `cordis-plugin-loader` 1.0.5 · `schemastery` 3.18.4 · Node v24 / ModuleLoader v2） |
| 适配分支 / tag | `fix/adapt-dsh-0.2.0-rc2` · **`v0.3.4`** |
| 组件版本 | injector **v0.3.4** · preset v0.3.0 · graded 0.0.1-rc1 |
| 验证强度 | 内核契约 **57/57** · 进程内装配 **26/26 × 3 目标** · client 冒烟 **18/18** · preset bundle **26/26** · **真机 web profile 真装**（HTTP 200） |
| 许可 | MIT（继承上游） |

---

## 本 fork 相对上游改了什么

### ① 2 处硬破坏 —— 上游装到 0.2.x 会直接抛错或静默失败

| # | 症状 | 根因（runtime 侧证据） | 本 fork 的修复 |
|---|---|---|---|
| **HARD-1** | 插件自愈 / 重启路径必定抛 `selfEntry 无官方 _dispose（loader 契约缺失）` | `cordis-plugin-loader@1.0.5` 的 `Entry` **没有 `_dispose`**：全包 grep（`src` + `lib`）零命中，且 `export class Entry {` 不继承任何基类 | 改用官方等价路径 `entry.fiber.dispose()` —— `src/config/entry.ts:135` 与 `src/config/group.ts:40` 官方自己就是这么写的；随后 `entry.fiber = undefined` |
| **HARD-2** | `ctx.registry.delete(fiber)` **静默 no-op**，旧 fiber 不释放 | `RegistryService.delete()` 的入参是 **plugin 而非 fiber**，传 fiber 会 `resolve()` 得 `undefined`（`cordis/src/registry.ts:258-267`）；实测 `registry.size` 7 → 7 | 改为 `registry.delete(fiber.runtime.callback)` |

### ② 5 处契约 / 配置漂移

1. **profile 硬编码** —— `~/.dsh/profiles/web/node_modules` 把 profile 名写死成 `web`（而实际 profile 常是 `desktop`）。
   改为三级解析：`DSH_PROFILE_DIR` → `$DSH_HOME/profiles/$DSH_PROFILE` → `web`。
2. **死槽名** —— 脚手架自检白名单与活体验证白名单里的 `settings.plugin.item`（**单数**）在 `0.2.0-rc.2` 全树**零命中**，
   真实槽是**复数** `settings.plugins.tab`。原样保留会**误放行**注册到已移除槽位的骨架 → 两处均移除。
3. **client 注册形态** —— 脚手架模板用已废的**单参** `ctx.slots.register({ …, component })`：
   官方 `register(options, component)` 只读第二个参数，`options.component` **永不被读取**，
   结果是运行时一片空白却不报错 → 改为官方**两参**形态。
4. **裸名依赖** —— `cordis` / `schemastery` → scoped `@deepseek-ai/cordis` / `@deepseek-ai/schemastery`。
   0.2.0-rc.2 的浏览器模块表（9 项）里同样没有裸名 `cordis`。
5. **构建链** —— 脚手架 `build.sh` 只认源码 checkout（要求 `$DSH_CHECKOUT/packages` 存在），
   在安装版部署里**必然 `exit 1`** → 改为**双形态**：A) 源码 checkout；B) 已安装 runtime 的 `node_modules`
   （`DSH_RUNTIME_NODE_MODULES` 指定，或自动从 `$DSH_HOME/profiles/*/node_modules` 探测）。
   同时新增 `detectRuntimeNodeModules()` / `detectBuildSource()`。

### ③ preset 迁移：目录形态 → 声明式 bundle

DSH 0.2.x 起，preset 是 `@deepseek-ai/dsh-agent-preset` 的**声明行**，由 bundle patch 承载；
旧的 `$DSH_HOME/.agent-presets/<id>/` 目录形态**已无人读取**
（官方迁移说明 `editing-cordis-compositions/SKILL.md:70`：*“Nothing reads that directory any more.”*）。

- 新增 **`scripts/gen-preset-bundle.mjs`**：把 `preset/<id>/`（唯一真源）生成为
  `cordis.patch.yml` + `package.json`，并把 `preset.yml` 的 `name/description/order`
  与 `agent.cordis.yml` 的 entry 列表**原样内联**成声明行（不做 YAML 改写，语义逐字一致）。
- **生成物随身携带锚点 `.mjs` 资产** —— `agent.cordis.yml` 里的 `name: ./router-bootstrap-vNN.mjs`
  是相对引用，而 patch 里相对路径的锚点是 **patch 文件所在目录**
  （`cordis-plugin-include/src/index.ts:188`）。不把 `router-bootstrap-vNN.mjs`
  及其 `./router-core-vNN.mjs` 依赖一起带过去，preset **挂载时**就会解析失败。
  生成器用 `localRefs()` + `localClosure()` 收集并平铺复制，并断言「每个 `./x.mjs` 都落在 outDir」。
- 修复一个**已消失的依赖包**：`@deepseek-ai/dsh-workflow-worker-thread` 在整棵 runtime 树不存在
  → 替换为 `@deepseek-ai/dsh-workflow-ptc`（其 `static Config = z.object({ provider: …默认 "spawn" })`
  与 preset 行内的 `config: { provider: spawn }` 逐字对应；三件 preset 共 6 处）。
- 新增 **`scripts/verify-preset-bundle.mjs`**：**26 条**断言，含
  「生成物语义与源 `agent.cordis.yml` 的 YAML 解析结果 JSON 完全等价」与「锚点资产齐备且依赖闭合」。

### ④ graded 与文档 / 脚本清理

- 删除死 manifest **`graded/dsh.plugin.json`** —— `dsh.plugin.json` 与 `contributes.commands`
  形态在整棵 runtime 树 **0 消费者**（`grep contributes` 的 66 处命中全是散文/JSDoc 措辞）。
- `graded/package.json`：非标准键 `engines.dsh` → `engines.node`；移除悬空 `types`。
- 修掉一处真实的类型缺陷 **`TS7006`**（`injector/src/index.ts` 里唯一未标注参数类型的 `execute(args)`）。
- 清理 `--profile web` 与 `~/.dsh/profiles/web` 在 `README` / `injector/INSTALL.md` /
  `injector/docs/SPEC.md` / `install.sh` / `install.ps1` 里的硬编码。
- `injector/docs/SPEC.md` 顶部新增「0.2.x 更正」节，逐条给出 `_dispose` / `_start` 等旧私有 API
  在 0.2.x 的官方等价写法（与正文冲突时以该节为准）。

---

## 验证

> 完整验证报告：[docs/compat/VERIFICATION.md](docs/compat/VERIFICATION.md) ·
> 判定与结论：[docs/compat/ADAPTATION-REPORT.md](docs/compat/ADAPTATION-REPORT.md)

| 层 | 手段 | 结果 |
|---|---|---|
| **V0 内核契约** | `node scripts/verify-contract.mjs` —— 当场 `require` **安装版 runtime**，逐条断言 | **57 / 57** |
| **V1 进程内真实装配** | `build/s4-harness/assemble.mjs` —— 真 `Context` + 真 `Loader` / `Timer` / `Tools` / `SystemPrompt` / `WebServer`，走官方 `loader.create`；对 **dist / tsc / src 三个目标**各跑一遍 | **26 / 26 × 3** |
| **V2 类型与构建** | `tsc --noEmit`（只剩 6 条 `TS2307`，即部署版 runtime 不发布 `.d.ts` 所致）+ `tsc --noCheck` 真实产物 | 无代码级错误 |
| **V3 preset bundle** | `node scripts/verify-preset-bundle.mjs` | **26 / 26** |
| **V5 client 冒烟** | `build/s4-harness/client-smoke.mjs` —— 最小 React 替身 + 假 `__ModuleLoader__`，断言只请求模块表内 specifier、两参注册、`label()` 取值 | **18 / 18** |
| **V6 真机真装** | `dsh plugin --profile web add …` → `dsh --profile web --dump-config` → **真启动** `dsh web` 并探测 HTTP | 组合树含插件行与 3 个 `preset-router-*` 行；`GET /super-injector/api/list` → **200** |

**一条重要事实**：部署版 runtime **不发布 `.d.ts`** —— `cordis` / `cordis-plugin-loader` / `schemastery`
的 `lib/types/` 只有 `*.d.ts.map`，`dsh-tools` 只有 `*.js`，
`dsh-system-prompt` / `dsh-host-webserver` / `dsh-client-ui-slots` 完全没有 types 目录。
所以对**已安装 runtime** 无法做类型检查（`tsc -p tsconfig.json` 需要源码 checkout）。
而 `node scripts/verify-contract.mjs` **不需要安装、不写任何 DSH profile**，随时可复验。

---

## 一键安装

```powershell
git clone https://github.com/XIAxsc/dsh-routing-suite-xsc.git
cd dsh-routing-suite-xsc
.\install.ps1            # Windows
# Linux / macOS：./install.sh
```

`install.*` 会装配注入器 + 生成并安装 router 预设 bundle + 自检布局 + 提示重启。
也可以走官方 github: 装配整个套装：

```powershell
dsh plugin --profile <profile> add github:XIAxsc/dsh-routing-suite-xsc
```

### 手动三步

```powershell
# 步骤 1：装配注入器（重启后由 bundles 接管）
dsh plugin --profile <profile> add .\injector
# dsh 不在 PATH 时：npx '@deepseek-ai/dsh' plugin --profile <profile> add .\injector

# 步骤 2：生成并安装 router 预设 bundle
# DSH 0.2.x：preset 是 @deepseek-ai/dsh-agent-preset 的声明行，由 bundle patch 承载。
# 旧形态 $DSH_HOME/.agent-presets/<id>/ 目录已无人读取 —— 不要再复制目录。
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$bundle  = Join-Path $dshHome 'external\dsh-router-presets'
node .\scripts\gen-preset-bundle.mjs . $bundle router-standard router-spec router-react
dsh plugin --profile <profile> add $bundle

# 步骤 3：重启 DSH → 新会话选择 Router Standard / Router Spec (experimental)
```

> - `preset/<id>/` 是**唯一真源**；生成物不要手改，也不要再往 `.agent-presets/` 复制目录。
> - `$bundle` 里同时出现 `cordis.patch.yml` 与若干 `.mjs` 是**正常的** —— 那些 `.mjs` 是 patch 的相对引用锚点资产（见上文 ③）。
> - 从源码构建 injector 需要依赖来源：`DSH_CHECKOUT=<源码 checkout>` 或 `DSH_RUNTIME_NODE_MODULES=<已安装 runtime 的 node_modules>`。

---

## DSH 兼容矩阵

| DSH 版本 | 状态 | 本套装版本 | 验证 | 备注 |
|---|---|---|---|---|
| **`0.2.0-rc.2`** | ✅ **已验证适配** | injector **v0.3.4** · preset v0.3.0 · graded 0.0.1-rc1 | 契约 **57/57** · 装配 **26/26 × 3** · client **18/18** · preset bundle **26/26** · **真机 web profile 真装通过** | 本 fork 的适配目标。runtime `cordis` 4.0.4 / `cordis-plugin-loader` 1.0.5 / `schemastery` 3.18.4 / Node v24（ModuleLoader v2） |
| `0.1.x`（rc.6 – 0.1.2-alpha.1） | ✅ 上游曾支持 | v0.3.0 – v0.3.3（上游） | 上游历史实测 | 0.1.x 上 `Entry._dispose` 等私有 API 尚存在；0.2.x 已移除 |
| `<0.1.0-rc.6` | ❌ 不支持 | — | — | 低于首个适配基线 |
| `>=0.3.0` | ⚠️ **未验证** | — | — | 未测试；0.2.x 之后契约面可能再次变更 |

### 关键契约依赖（任一被破坏都需重新适配）

| 契约 | 权威位置 | 本套装的用法 |
|---|---|---|
| `FiberState` 是 `const enum`（0..5，运行时读不到名字） | `cordis/src/fiber.ts:147-154` | 插件硬编码 `FIBER_NAMES` 数组 —— 唯一可行做法 |
| **`Entry` 没有 `_dispose`**（0.2.x 起） | `cordis-plugin-loader/src/config/entry.ts` | 必须用官方 `entry.fiber.dispose()`（`entry.ts:135` / `group.ts:40`） |
| `RegistryService.delete(plugin)` 的入参是 **plugin**，不是 fiber | `cordis/src/registry.ts:258-267` | 传 fiber 会 `resolve()` 得 `undefined` → 静默 no-op |
| `EntryTree.entries()/create()/import()`、`Loader.unwrapExports()`、`Loader.internal.loadCache` | `cordis-plugin-loader/src/{index,config/tree,internal}.ts` | 注入器热重载与自愈路径 |
| `defineTool` + `ToolRegistry.register` 强制 `output { schema, render }` | `dsh-tools/lib/index.js:838-864, 2878-2889` | 19 个 `dev_*` 工具 |
| `webServer.register()` 返回 disposer；`kind: 'exact' \| 'prefix'` | `dsh-host-webserver/lib/index.js:177-184` | 路由 `/super-injector/api` 挂 `ctx.effect` |
| `ctx.slots.register(options, component)` 是**两参**形态 | `dsh-client-ui-slots/lib/index.js:163-219` | 插件管理 UI 注册进 `settings.section`（`options.component` 永不被读） |
| `window.__ModuleLoader__.load({ id, factory })` | `dsh-cordis-client-runner` 官方模板 | client 产物 banner |
| `dsh.client` 由 `dsh-client-modules` 消费；模块图**只按 `external` 建边** | `dsh-client-modules/lib/index.js:415-437` | `inject` 里的 `dsh-client-runtime` 是惰性遗留声明（与已安装的 `dsh-prompt` 逐字相同，故保留不改） |
| patch 里相对路径的锚点是 **patch 文件所在目录** | `cordis-plugin-include/src/index.ts:188` | preset bundle 必须随身携带 `.mjs` 锚点资产（D14） |
| preset 是 `@deepseek-ai/dsh-agent-preset` **声明行**，由 bundle patch 承载 | `editing-cordis-compositions/SKILL.md:8` | `.agent-presets/` 旧形态已无人读取（`SKILL.md:70`） |

> 不安装、不写 DSH profile 的复验命令：`node scripts/verify-contract.mjs`
> （当场 `require` 安装版 runtime，逐条断言上表契约）。

---

## 组件

| 路径 | 上游 | 版本 | 作用 |
|---|---|---|---|
| `injector/` | [dsh-super-injector](https://github.com/yjh051108/dsh-super-injector) | **v0.3.4**（本 fork；上游为 v0.3.3） | 运行时注入器：`dev_*` 工具全家桶（注入 / 热重载 / 侧挂转正 / 卸载 / 路由自愈）；`github:` 装配由 `prepare` 钩子自动构建 |
| `preset/` | [dsh-router-standard](https://github.com/yjh051108/dsh-router-standard) | v0.3.0（主线 v34 / v17 / v10） | 思维模式路由预设：router-standard（分类 persona + 完整 sections）/ router-spec（深度思考优先）/ router-react。router-pro 为规划中（planned） |
| `graded/` | 本仓库 `graded/` 目录 | v0.0.1-rc1 | 分级模式：会话级两级任务协议（脑暴选择题对齐 → 北极星定稿 → 规格化计划 → 按规格注入 → 打卡制 → 组收官 → 终验）；6 工具 + 三模式 + 小类模式粒度 + 红队门 + 审计端点；`graded/dsh-external-dsh-graded-mode-0.0.1-rc1.tgz` 可直接 `dsh plugin --profile <profile> add` |

| 组件 | 说明 | 入口 |
|---|---|---|
| **injector** | 运行时注入器：`dev_*` 工具全家桶 | [injector/README.md](injector/README.md) · [规范](injector/docs/SPEC.md) · [安装](injector/INSTALL.md) |
| **preset** | 思维模式路由预设 | [preset/README.md](preset/README.md) · [实验报告](preset/docs/experiments.md) |
| **graded** | 分级模式 | [graded/README.md](graded/README.md) · [架构](graded/docs/ARCHITECTURE.md) · [理论](graded/docs/THEORY.md) · [实测数据](graded/docs/DATA.md) |

三个组件随本仓库统一演进（`injector/`、`preset/`、`graded/` 已是仓库内普通目录，内容直接入库）；
上游独立仓库保留用于独立发布。

---

## 研究与数据（graded）

**“模型也会偷懒 —— 我们测到了，还做了对抗”** —— 分级模式插件的公开研究位：

- [🔬 模型注意力懈怠：观测笔记](graded/docs/STUDY.md) —— 长程任务里验证勤勉度衰减的真实分段数据（无协议链晚段“1 工具 / 0 读图” vs 协议链全程在线）+ 对抗机制对照
- [📊 协议 vs 无协议：实测对比](graded/docs/COMPARE.md) —— 同型 3D 任务三会话对比表 + ASCII 图
- [🧪 测量工具](graded/scripts/measure.mjs) —— `node scripts/measure.mjs 你的会话.jsonl`：任何人可对自己会话复算上述指标（脱敏：只输出数字）
- [📁 实测数据](graded/docs/DATA.md) —— 三会话脱敏指标表 + 懈怠强度表 + 审计口径

---

## router-standard 预设能力（P1-P23 实测摘要）

- **三行为带 + weak 内路由**：spec（计划-集体）/ react（执行者）/ mixed（陷阱，回避）/ weak（模型自分类）
- **按模型选 persona**：Pro = spec 句 + few-shot（区分度 +5.0）；Flash = neutral + classify（+5.7）
- **近距离引导**：每轮用户消息后注入固定引导（缓存 92-94% 命中），路由 96% + 收敛 100% + 反稀释
- **单任务三锚**（persona 静态）：回顾 + 收敛 + 反跑题 —— 开放任务完成率 0% → 100%
- **plan-mode 保留**：只替换 persona section，plan 边界不失忆
- **AI 自优化工具**：`dev_router_status` / `dev_router_mode` / `dev_mode_subagent`

---

## 与上游同步

```bash
git remote add upstream https://github.com/yjh051108/dsh-routing-suite.git
git fetch upstream
git merge upstream/main        # ⚠️ 上游未适配 0.2.x；合并后必须重跑验证
node scripts/verify-contract.mjs
node scripts/verify-preset-bundle.mjs
```

上游的 `v0.3.0` 变更（真实装配链路修复）仍然有效，完整清单见上游
[issues](https://github.com/yjh051108/dsh-routing-suite/issues)：首轮路由真实生效（#13）、
近距离引导改走 `agent/pre-step`（#34 / #36 / #55，同时去掉每轮多出的第二次 API 调用）、
缺导入（#11）、`preset.yml` YAML 引号（#53）、promoted 后完整回归（#44）、
安装脚本与文档修正（#35 / #42 / #41）、injector git 装配自动构建（#40）。

---

## 文档

| 文档 | 内容 |
|---|---|
| [docs/compat/BASELINE.md](docs/compat/BASELINE.md) | S0 基准冻结：范围、仓库状态、声明面、runtime 版本、未安装证明 |
| [docs/compat/CONTRACT-MATRIX.md](docs/compat/CONTRACT-MATRIX.md) | S1 契约矩阵：插件侧调用点 × runtime 权威定义，逐条裁定（含 `文件:行号`） |
| [docs/compat/ADAPTATION-REPORT.md](docs/compat/ADAPTATION-REPORT.md) | S2/S5 判定与结论 + S6 真机真装验证（含残余风险 R-2…R-9） |
| [docs/compat/VERIFICATION.md](docs/compat/VERIFICATION.md) | S4/S6 验证：六层手段、真实数字、真装证据 |
| [docs/compat/raw/](docs/compat/raw/) | 三方只读审计原文（loader / host / client）+ 解压证据 |
| [injector/README.md](injector/README.md) | 注入器引导（规范铁律 10 条）+ 0.2.x 更正块 |
| [injector/docs/SPEC.md](injector/docs/SPEC.md) | 注入器规范（顶部含 0.2.x 更正节） |
| [preset/docs/paper.md](preset/docs/paper.md) · [preset/docs/experiments.md](preset/docs/experiments.md) | 路由预设论文与 P1-P23 实验 |
| [docs/FLATTEN-MIGRATION.md](docs/FLATTEN-MIGRATION.md) | 仓库结构迁移（submodule → 直接文件） |

---

## 许可证

MIT。版权归上游作者 **yjh051108**（见 [LICENSE](LICENSE)）；本 fork 的适配工作由 **XIAxsc** 维护。

致谢：xiaobright/modeltest（V4.1b 评测）、xiaobright/dsh-anchored-standard（锚定机制）。
