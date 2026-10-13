# D4 · VERIFICATION — S4 隔离验证报告

> **约束**：全程**不把插件安装到 DSH**（未写入 `profiles/desktop`、未执行 `dsh plugin add`）。
> 所有装配都在会话工作区的 scratch 环境 `build/s4-harness/` 内完成，宿主服务是**真实官方实现**，不是桩。
> **分支**：`fix/adapt-dsh-0.2.0-rc2`；**回滚点**：`main@195273352f23bff7f9023ebe2ec0cdbdf9c98f10`（完好）。

---

## 1. 验证分层

| 层 | 手段 | 证明什么 | 结果 |
|----|------|----------|------|
| **V0** | `scripts/verify-contract.mjs`（当场 require 安装版 runtime） | 每条契约断言的**运行时真值** | **57 / 57 PASS** |
| **V1** | `build/s4-harness/assemble.mjs` 进程内装配（**3 个装配目标**） | 插件能**真实装配、激活、注册资源、干净卸载** | **26 / 26 PASS × 3** |
| **V2** | `tsc -p build/s4-harness/tsconfig.build.json` | 源码**类型正确性** + **能真正构建** | 无代码级错误；产出 202571 B |
| **V3** | `scripts/gen-preset-bundle.mjs` + `build/verify-preset-bundle.mjs` | O3 迁移产物**语义等价**于唯一真源 | **18 / 18 PASS** |
| **V4** | D0 硬约束门禁 | 未安装状态**未被触碰** | **4 / 4** |
| **V5** | `build/s4-harness/client-smoke.mjs`（vm 模拟模块表，**无浏览器**） | client 浏览器产物的**契约与行为** | **18 / 18 PASS** |

---

## 2. V0 · 内核契约运行时真值（57/57）

`scripts/verify-contract.mjs` 不复制任何断言来源，而是**当场 `require` 安装版 runtime** 并执行。四个断言段：

**A 段（24 条）—— cordis / cordis-plugin-loader 内核契约**，含行为证据而非仅静态匹配：

| 断言 | 行为证据 |
|------|----------|
| A16 | `registry.delete(fiber)` 前后 `registry.size` 7 → 7 = **no-op**（坐实 HARD-2 的成因） |
| A17 | `registry.delete(plugin)` 前后 7 → 6 = **生效** |
| A18 | `registry.plugin(plugin, config, getOuterStack)` 返回值 `.ctx.fiber` 是 Fiber 实例 |
| A19 | `EntryTree.prototype.entries` 是 generator；`create()` 返回 **entry id 字符串**（非 Entry） |
| A20 | `FiberState` 是 `const enum`（0..5，运行时不可读名字） |
| A21 | Fiber 实例有 `dispose` 函数、有 `uid`、有 `_config` |
| A23 | `EntryOptions` 的 6 个字段（`id/name/config/group/disabled/inject`）在真实 entry 上齐备 |
| A24 | **Entry 原型上不存在 `_dispose`**（= HARD-1 的成因） |

**B 段 —— 资源注册契约**（错误文案逐字比对）：

| 断言 | 真实报错原文 |
|------|--------------|
| B3 | `tool "bad_tool" must declare output { schema, render, presentationMeta? }` |
| B7 | `webserver: duplicate prefix route "/verify-probe"` |
| B9 | prompt context 的 `order` 必须是有限数，否则抛错 |
| SLOT1 | `slots.register` 是**双参**（`register(options, component)`），`arity = 2` |
| SLOT2 | `SlotCore` 上**没有** `inject` 方法（`inject` 在 renderer 的 slots wrapper 上） |
| CM2 | 模块图**只由 `external` 建边**，`inject` 不参与 → 坐实 DRIFT-3 惰性 |
| AP3 | 复数包 `@deepseek-ai/dsh-agent-presets` **不存在** |

**C 段（9 条）—— 本仓库静态不变量**：`DRIFT-1` profile 解析优先 `DSH_PROFILE_DIR`、`D13` 无死槽名 `settings.plugin.item`、peerDeps 无裸名 `cordis`/`schemastery`、`dsh.bundle.patch` 声明、根 patch 是 insert 形态且 id/name 自洽、README DSH Target 上界已上移。

**D 段（4 条）—— preset 引用的包名真实存在**：三个 preset 各 24 个包名全部存在（另 2–3 个相对/builtin 项），且 `$DSH_HOME/.agent-presets` 内 **router-\* 数量为 0**（本仓库 preset 从未投放到旧形态目录；该目录里的 `data-agent`、`liangshen` 是用户自有 preset，早于本次会话）。

> 实现要点：`candidateRoots()` 逐包定位并对 junction 做 `realpathSync` 反推真实 runtime 根（否则 `dsh-agent-preset` 会找不到）；静态断言前先 `stripComments()`（因为修复说明本身就写在注释里）。实测命中 **5 个 runtime 根**。

---

## 3. V1 · 进程内真实装配（26/26 × 3 个目标）

`build/s4-harness/assemble.mjs` 用 **Node ESM resolve hook**（`hooks.mjs`）把 `@deepseek-ai/*` 指向 DSH Desktop 的真实 runtime 树，把 `@dsh-external/dsh-super-injector` 指向被测物，然后：

1. `new Context()` 组装宿主，依次 `ctx.plugin(Loader)`、`ctx.plugin(TimerService)`、`ctx.plugin(ToolRuntime)`、`ctx.plugin(SystemPrompt)`、`ctx.plugin(WebServer)` —— **全部是官方实现**；
2. `ctx.loader.create({ name: '@dsh-external/dsh-super-injector', config })` 真实装配插件；
3. 断言模块面、fiber 状态、副作用、卸载、二次装配。

**26 条断言全部 PASS**，覆盖：

| 组 | 断言要点 |
|----|----------|
| 宿主就绪 | 5 个服务（`loader`/`timer`/`tools`/`systemPrompt`/`webServer`）均可从 `ctx` 解析 |
| 模块面 | `name` = `dsh-super-injector`；`inject` 数组齐备；`Config` 存在且带 `~standard` 校验协议；`apply` 是函数 |
| **装配成功** | `loader.create` 未抛错；entry 数 1；**`fiber.state` = active**；`fiber.uid` 已分配 |
| **契约踩坑复核** | 真实 entry 上 `typeof entry._dispose === 'undefined'` |
| **真实副作用** | 注册了 **19 个 `dev_*` 工具**（`dev_stage_add`…`dev_self_test`）；`webServer` 出现前缀路由 `/super-injector/api`；`systemPrompt` 上下文出现 `dsh-super-injector` |
| **干净卸载** | `fiber.dispose()` 后三者全部清空（工具 0、路由 0、上下文空） |
| 二次装配回归 | 再次装配不抛错、fiber 仍 active、**无重复路由**（`webserver: duplicate` 未触发） |

### 三个装配目标，全部 26/26

| 目标 | 文件 | 含义 |
|------|------|------|
| `dist` | `injector/lib/index.js`（132341 B） | **真实分发包产物**（tsdown，`prepare` 钩子产出） |
| `tsc` | `build/s4-build/lib/index.js`（202571 B） | `tsc --noCheck` 的 emit，独立构建路径 |
| `src` | `injector/src/index.ts` | TS 源码（Node 类型擦除） |

⇒ 「源码能跑」「tsc 能构建出能跑的产物」「**tsdown 的分发包产物也能跑**」三者全部成立。

---

## 4. V2 · 类型正确性与真实构建

### 4.1 ★ 关键发现：部署版 runtime 不发布 `.d.ts`

逐目录实测 `...\DSH Desktop\resources\app\node_modules\@deepseek-ai\`：

| 包 | `lib/types/` 内容 |
|----|-------------------|
| `cordis` | **只有 `*.d.ts.map`** |
| `cordis-plugin-loader` | **只有 `*.d.ts.map`** |
| `schemastery` | **只有 `*.d.ts.map`** |
| `dsh-tools` | 只有 `*.js` |
| `dsh-system-prompt` / `dsh-host-webserver` / `dsh-client-ui-slots` | **完全没有 types 目录** |

⇒ **对已安装 runtime 无法做类型检查**。`tsc -p tsconfig.json` 依赖源码 checkout 布局（`vendor/cordis`、`packages/core/tools` …）。这是本插件的 `scripts/build.sh` 必须同时支持「源码 checkout」与「已安装 runtime」两种依赖来源的**根因**（S3 的 `build.sh` 重写正是为此）。

### 4.2 本地工具链（可重建，不入库）

`build/toolchain/` 用 `npm install --prefix` 装入 `typescript@~5.9.3`、`tsdown@^0.22.14`、`@types/node@^24.13.3`。
（注意：npm 默认 cache `D:\WorkSpace\nodejs\node_cache\_cacache` 在本机不可写，报 `EPERM`；改用 `npm_config_cache=<workspace>\build\.npm-cache` 后可用。）

### 4.3 类型检查结果

```
$ tsc -p build/s4-harness/tsconfig.build.json --noEmit
injector/src/index.ts(24,25): error TS2307: Cannot find module '@deepseek-ai/cordis' ...
injector/src/index.ts(25,25): error TS2307: Cannot find module '@deepseek-ai/cordis-plugin-loader' ...
injector/src/index.ts(26,31): error TS2307: Cannot find module '@deepseek-ai/dsh-system-prompt' ...
injector/src/index.ts(27,31): error TS2307: Cannot find module '@deepseek-ai/dsh-tools' ...
injector/src/index.ts(28,28): error TS2307: Cannot find module '@deepseek-ai/dsh-tools' ...
injector/src/index.ts(29,15): error TS2307: Cannot find module '@deepseek-ai/schemastery' ...
injector/src/index.ts(2785,19): error TS7006: Parameter 'args' implicitly has an 'any' type.
```

- 6 条 `TS2307` 是 4.1 的直接后果（**环境缺 `.d.ts`，不是插件缺陷**）。
- **1 条 `TS7006` 是真实缺陷**并在本轮修复：`injector/src/index.ts:2785` 的 `async execute(args)` 缺参数类型注解。全文件 24 处 `execute` 中**唯一**一处没有注解（其余均为 `args: {...}` / `args: any` / `a: any`），属于作者遗漏。
  修复：`async execute(args: { dir: string; profile?: string })`。
- 修复后复跑 `--noEmit`：**只剩 6 条 `TS2307`，无任何代码级错误。**

### 4.4 真实构建

```
$ tsc -p build/s4-harness/tsconfig.build.json --noCheck
BUILD_EXIT=0
build/s4-build/lib/index.js        202571 B
build/s4-build/lib/index.js.map    121951 B
build/s4-build/lib/types/index.d.ts  2976 B
```

### 4.5 ★ 发现：`prepare` 钩子产出的分发包**不是零外部依赖**

`npm install --package-lock-only`（在 `injector/` 内）触发了 `prepare` 钩子，真实产出了 `injector/lib/`：

```
injector/lib/index.js       132341 B
injector/lib/index.js.map   258586 B
injector/lib/client.js        7702 B
injector/lib/client.js.map   12849 B
```

构建日志给出警告：

```
src\index.ts (29:14) [UNRESOLVED_IMPORT] Could not resolve '@deepseek-ai/schemastery' in src/index.ts
    ╰─ Module not found, treating it as an external dependency
```

产物头部因此保留了**裸外部导入**：

```js
import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";
```

而 `injector/tsdown.config.ts:37-41` 的注释宣称的设计目标是：

> 打包后 lib **零外部依赖**，任何装配路径都能加载。

**结论**：该目标**未达成** —— `prepare` 阶段 peer 包未链接进 `injector/node_modules`（`injector/node_modules/@deepseek-ai/` 实测为空目录），tsdown 遂把它们降级为 external。

**实际影响：不阻断**。实测这 7 个 peer 在部署树里全部可解析：

| 包 | `profiles/node_modules/@deepseek-ai/` | `profiles/desktop/node_modules/@deepseek-ai/` |
|----|--------------------------------------|-----------------------------------------------|
| `dsh-tools` / `schemastery` / `cordis` / `dsh-system-prompt` / `dsh-host-webserver` / `dsh-client-ui-slots` / `cordis-plugin-loader` | **全部 True** | 除 `schemastery` 外全部 False |

Node 从 `profiles/desktop/node_modules/@dsh-external/dsh-super-injector/lib/index.js` 向上解析会命中 `profiles/node_modules`，因此**能加载**（V1 的 `dist` 目标 26/26 就是证据）。

但**达成自包含的正确路径是 `scripts/build.sh`**（S3 已重写为 A: 源码 checkout / B: 已安装 runtime 双形态，先链接 peer 再构建），而不是裸 `npm install` 的 `prepare`。这一点已记入残余风险 R-8。

---

## 5. V3 · O3 preset 迁移产物语义等价（18/18）

`scripts/gen-preset-bundle.mjs` 把 `preset/<id>/`（**唯一真源**）生成 DSH 0.2.x 声明式 bundle；`build/verify-preset-bundle.mjs` 用 **runtime 自带的 YAML 解析器**独立复验：

- patch 顶层是长度 1 的数组；`insert` 是数组且**不带 `id`**（= 追加语义，符合 `cordis-plugin-include` 的 `data.push(...insert)`）；
- 3 行，每行 `id === 'preset-' + config.id`（Loader 编辑地址约定）；
- 每行 `name === '@deepseek-ai/dsh-agent-preset'`；
- `config.plugins` 是数组；
- **`plugins` 与对应 `agent.cordis.yml` 的 YAML 解析结果 JSON 完全相等**（router-standard 19 / router-spec 18 / router-react 18 个顶层 entry）。

**ALL PASS（18/18）**。

---

## 6. V5 · client 浏览器产物冒烟（18/18，无浏览器）

`build/s4-harness/client-smoke.mjs` 在 `node:vm` 里造一个假沙箱：给 `__ModuleLoader__` 打桩、按**种子模块表**提供最小 React 替身，然后：

1. 执行真实分发包产物 `injector/lib/client.js`；
2. 取出 lazy factory 并用 `require` 替身（不在模块表内就抛错）执行；
3. 用假 `ctx`（`effect`/`slots.inject`/`slots.register`）执行 `apply`；
4. 断言注册形态与渲染行为。

| 断言 | 结果 |
|------|------|
| C1–C3 | client.js 产出 `__ModuleLoader__.load` 调用、**id 等于包名**、factory 是函数 |
| C4 | factory 只请求模块表内 specifier —— 实测**只有 `react`** |
| C5–C6 | `inject = ["slots"]`；导出 `apply` 函数 |
| C7 | `apply` 未抛错 |
| C8–C10 | 资源注册挂在 `ctx.effect` 内；注入 `settings.section`；恰好 1 个 occupant |
| **C11–C12** | occupant 是**两参**形态（第二参为组件），且 **`options.component` 为 `undefined`**（未使用已废的单参形态） |
| C13–C15 | `name` = `settings.section`；`id` = `super-injector-plugins`；`order` = 50 |
| C16–C17 | `label` 是 thunk，`label()` 返回 `"插件管理"` |
| C18 | occupant 可被调用且不抛错（通过假 React 渲染出 1 个元素） |

**ALL PASS（18/18）** —— 这条链把「client 产物能否被 GUI 接受」从**纯静态比对**提升为**可执行行为验证**，且完全不需要浏览器、不需要安装插件。

---

## 7. V4 · D0 硬约束门禁（4/4）

| 检查 | 结果 |
|------|------|
| `D:\WorkSpace\Agents\DSH\profiles\desktop\node_modules\@dsh-external` 存在？ | **False** |
| `D:\WorkSpace\Agents\DSH\super-injector` 存在？ | **False** |
| `D:\WorkSpace\Agents\DSH\profiles\desktop\docs`（S1 路径事故残留）存在？ | **False** |
| `profiles\desktop\cordis.patch.yml` 匹配 `super-injector\|dsh-external`？ | **0 匹配** |
| `profiles\desktop\package.json` 的 bundles 含 `routing-suite`/`super-injector`/`graded`？ | **0 匹配** |

git：分支 `fix/adapt-dsh-0.2.0-rc2`，**HEAD = main = `195273352f23bff7f9023ebe2ec0cdbdf9c98f10`**（回滚点完好）。

---

## 8. 仍未验证 / 残余风险

| # | 项 | 为什么没验 | 影响 |
|---|----|-----------|------|
| **R-1** | **真装到 DSH 后的端到端**（GUI 插件页、HMR、重启后由 `bundles` 接管） | **硬约束禁止安装** | 无法证明装配器与 DSH 的 *插件管理* 交互；但 V1 已用真实 loader 覆盖装配与卸载路径 |
| **R-2** | client 产物在**真实浏览器/GUI** 里的渲染 | 无浏览器环境 | 已由 V5 大幅收窄（契约 + 执行 + 渲染调用全部验证），仅剩 DOM/样式层未经真实渲染 |
| **R-3** | `tsc` **真正的类型检查**（非 `--noCheck`，含跨包类型） | 部署版 runtime 无 `.d.ts`；本机无源码 checkout | 只能证明「无代码级错误（在缺类型的近似环境下）」 |
| **R-4** | ModuleLoader **v2** 下 `loadCache` 嵌套层数、`oldJob?.module?.getNamespace()` | 需要路径触发（`dev_reload_package` 的特定分支），且 v2 内部结构非公开 | 影响插件「回滚/重载」路径，不影响装配与卸载 |
| **R-5** | 插件中裸 `loadCache.set()` 与自身注释矛盾 | 需真实触发重载分支 | 同上 |
| **R-6** | O3 preset 在 DSH 里**实际被加载并可选** | 需要把 bundle 装进 DSH（违反硬约束） | V3 只证明产物语义等价、包名全部真实存在 |
| **R-7** | `?v=` 查询串（`./router-bootstrap-v34.mjs?v=88`）是否被 Loader 容忍 | 需要真实装配 preset | O3 迁移的已知未知项 |
| **R-8** | **分发包不自包含**：`injector/lib/index.js` 保留裸 `@deepseek-ai/dsh-tools` / `@deepseek-ai/schemastery` 导入，与 tsdown 注释宣称的「零外部依赖」不符 | 需要链接 peer 后再构建才能达成（`scripts/build.sh` 已实现，但裸 `npm install` 的 `prepare` 未走这条路） | 实测在部署树里可解析，**不阻断**；但在「peer 不可解析」的装配路径上会复现 tsdown 注释所描述的 issue #1 |

---

## 9. 结论

**S4 判定：验证通过（受硬约束限制的范围内），证据强度已提高。**

| 层 | 结果 |
|----|------|
| V0 内核/资源契约运行时真值 | **57 / 57** |
| V1 进程内真实装配（dist / tsc / src 三目标） | **26 / 26 × 3** |
| V2 类型检查 + 真实构建 | 无代码级错误；`--noCheck` 产出可装配产物 |
| V3 O3 preset 迁移语义等价 | **18 / 18** |
| V4 硬约束门禁 | **4 / 4** |
| V5 client 产物可执行冒烟 | **18 / 18** |

- 插件的**运行时代码**在真实官方宿主上**能装配、能激活、能注册全部资源、能干净卸载、能二次装配**，且**真实分发包产物、tsc 产物、TS 源码三条路径都成立**；
- 它的每一条**内核 / 资源契约断言**都经过运行时行为验证；
- **client 侧**不再只是静态比对 —— 真实浏览器产物在 vm 里被**执行、应用、渲染**并通过 18 项断言；
- O3 的**迁移产物与唯一真源语义等价**，引用的包名全部真实存在；
- **硬约束未被触碰**；
- 本轮新发现并修复 1 处真实代码缺陷（`TS7006` 隐式 any），新发现 1 处设计目标未达成（R-8，不阻断）。

S3 的修复使插件**从「必然装配失败」变为「可装配、可运行、可卸载」**；剩余 8 项残余风险中，R-1 / R-6 由硬约束本身导致，无法在本次任务内消除。
