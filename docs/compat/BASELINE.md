# D2 · BASELINE — 适配性分析基准快照

> **角色**：本文件是 S1 契约枚举、S2 差异判定、S3 修复的**唯一对照基准**。
> 冻结时刻之后被审对象或 runtime 若发生变化，必须重新冻结并在文末「变更日志」登记。
> **硬约束**：不安装该插件到 DeepSeek Harness（见 §5）。

---

## 1. 被审对象（范围冻结）

| 代号 | 路径 | 身份标识 | 是插件？ | 判定归属 |
|------|------|----------|----------|----------|
| **O1** | `injector/` | `@dsh-external/dsh-super-injector` **v0.3.3** — bundle 插件（声明 `dsh.bundle.patch`） | 是 | 主目标 |
| **O2** | `graded/` | `@dsh-external/dsh-graded-mode` **0.0.1-rc1** — 发布物 `graded/dsh-external-dsh-graded-mode-0.0.1-rc1.tgz`，含 `graded/dsh.plugin.json` = `{"contributes":{"commands":["分级"]}}` | 是 | 独立判定 |
| **O3** | `preset/` | agent preset（`router-standard` / `router-spec` / `router-react`），由 `dsh-agent-presets` 从 `.agent-presets/` 加载 | **否** | 独立判定（按 preset 约定，非插件契约） |

**判定原则**：三者**分开判定**，不得一刀切（风险 R8）。preset 不是插件，其结论不得与 O1 混同。

仓库根 `package.json` 的 `main: ./injector/lib/index.js` 与 `types: ./injector/lib/types/index.d.ts` 把仓库根**也**当作 O1 的分发入口，因此 O1 有**两个** manifest：仓库根与 `injector/package.json`。

---

## 2. 仓库状态

| 项 | 实测值 |
|----|--------|
| 分支 | `main` |
| HEAD | `195273352f23bff7f9023ebe2ec0cdbdf9c98f10` |
| HEAD 提交时间 | 2026-09-19 07:10:57 +0800 |
| HEAD 提交信息 | `fix: src/index.ts 的两段模板里 link_pkg cordis/cosmokit 改 scoped（B196 · 4 处）` |
| 工作树 | **clean**（`git status --porcelain` 无输出） |
| HEAD 上的 tag | 无 |
| 近邻提交 | 一串 B196 提交（`e1e710c`、`520f6dd`、`80ef9d3`、`1952733`）正在把裸 `cordis` / `schemastery` 改为 scoped 名 |

### 2.1 构建产物缺失（重要）

| 路径 | 存在？ |
|------|--------|
| `injector/lib` | **否** |
| `injector/lib/index.js` | **否** |
| `injector/lib/client.js` | **否** |
| `injector/lib/types/index.d.ts` | **否** |
| `injector/node_modules` | **否** |

→ 仓库根 `main: ./injector/lib/index.js` 与 `injector/package.json` 的 `main: ./lib/index.js` 指向的产物**均不存在**。当前源码树**未经构建、无法直接装配**。这是「源码可分析但不可运行」状态的直接证据。

### 2.2 源码规模

| 文件 | 字节 | 行数 |
|------|------|------|
| `injector/src/index.ts` | 178151 | 3163 |
| `injector/src/client/index.ts` | 8827 | 161 |

仅此两个源文件。**关键结构**：`injector/src/index.ts` 的 **L142–L400 是脚手架模板字符串**（生成 toolkit / daemon-loop / ui-panel / hybrid 四种插件骨架的源码文本），其中出现的 `ctx.on('system-prompt/assemble')`（L194，且整段为注释）、`ctx.on('llm/stream')`（L260）、`ctx.setInterval`（L289）、`ctx.webServer.register({kind:'prefix'})`（L337）、`ctx.tools.register(defineTool(...))`（L347）、`ctx.slots.inject('conversation.view', ...)`（L379）**均为模板内容，不是注入器自身的活代码**。S1 取证必须区分「活代码」与「生成给第三方的模板」。

---

## 3. 声明面基线（manifest / 装配层）

### 3.1 仓库根 `package.json`

| 字段 | 值 |
|------|-----|
| `main` | `./injector/lib/index.js` |
| `types` | `./injector/lib/types/index.d.ts` |
| `exports` | `.` / `./client` / `./package.json` |
| `engines.node` | `>=22` |
| `dsh.bundle.patch` | `./cordis.patch.yml` |
| `dsh.client.inject` | `['@deepseek-ai/dsh-client-runtime','@deepseek-ai/dsh-client-ui-slots']` |
| `dsh.client.platform` | `web` |
| `peerDependencies` | **裸名** `cordis: >=4.0.0-rc <5`、`schemastery: ^3.18.0` |

⚠️ **已知内部不一致**：`injector/package.json` 的 peerDeps 已改为 scoped（见 §3.2），根 manifest 仍是裸名。

### 3.2 `injector/package.json`

| 字段 | 值 |
|------|-----|
| `main` | `./lib/index.js` |
| `peerDependencies` | `@deepseek-ai/dsh-tools: >=0.0.1-rc <2`、`@deepseek-ai/cordis: >=4.0.0-rc <5`、`@deepseek-ai/schemastery: ^3.18.2` |
| `devDependencies` | `@deepseek-ai/cordis-plugin-loader: ^1.0.2`、`@types/node: ^24.13.3`、`tsdown: ^0.22.14`、`typescript: ^5.9.3` |

### 3.3 根 `cordis.patch.yml`（12 行，逐字结构）

```yaml
# 注释若干行
- insert:
    - id: dsh-super-injector
      name: '@dsh-external/dsh-super-injector'
      config: {}
```

注释明示 router-standard 是 agent preset、不走 bundle。

### 3.4 文档声明

| 位置 | 声明 |
|------|------|
| `README.md:34` | DSH Target `>=0.1.0-rc.6 <0.2.0`（并称「已跟进 rc.8 / 0.1.1-rc.2 / 0.1.2-alpha.1」） |
| `README.md:28` | 安装命令 `dsh plugin --profile web add github:yjh051108/dsh-routing-suite` |
| `injector/README.md:163-165` | 示例仍用**裸名** `import type { Context } from 'cordis'`、`@deepseek-ai/dsh-llm` |
| `docs/FLATTEN-MIGRATION.md` | submodule → 仓库内普通文件的扁平化迁移（分支 `refactor/flat-submodules`）；router-standard 属研发线未发布 |

---

## 4. 权威 runtime 基线（只读参照物）

### 4.1 路径与版本

| 项 | 实测值 |
|----|--------|
| 权威 runtime 根 | `D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\` |
| 系统提示声明的 checkout | `D:\WorkSpace\Agents\DeepseekHarness\resources\app.asar\dsh\` — **不存在**（`app.asar` 是文件，不是目录） |
| `dsh` | **0.2.0-rc.2** |
| 同版本包 | `dsh-tools`、`dsh-client-ui-slots`、`dsh-system-prompt`、`dsh-package-manifest`、`dsh-host-webserver`、`dsh-plugin-package-inventory-deepseek` = 0.2.0-rc.2 |
| `cordis` | 4.0.4 |
| `cordis-plugin-loader` | 1.0.5 |
| `schemastery` | 3.18.4 |
| `cosmokit` | 1.8.5 |

**取证质量优势**：`cordis` 与 `cordis-plugin-loader` 随包附带**完整 TypeScript 源码**（`cordis/src/*.ts`、`cordis-plugin-loader/src/**/*.ts`），另有 `lib/*.js` 与 `lib/types/*.d.ts.map`。本基线一切内核契约以 **`src` 为准**。

### 4.2 profile 侧 junction 指向

`D:\WorkSpace\Agents\DSH\profiles\node_modules\@deepseek-ai\` 下多为 junction，指向 §4.1 的 runtime 树。两个例外：

| 包 | junction 目标 |
|----|---------------|
| `dsh-client-runtime` | `D:\WorkSpace\nodejs\node_cache\_npx\1e7f6d9597241db0\node_modules\@deepseek-ai\dsh-client-runtime` |
| `dsh-agent-presets` | `D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-agent-presets` |

⚠️ **关键缺包**：`dsh-client-runtime` 与 `dsh-agent-presets` 在**权威 runtime 树内不存在**；且在整棵 runtime 树内 grep `@deepseek-ai/dsh-client-runtime` **零匹配**。该名字只出现在插件自身的 `dsh.client.inject` 与 `injector/tsdown.config.ts` 的 externals 里。**待 S2 判定**。

### 4.3 环境变量

| 变量 | 值 |
|------|-----|
| `DSH_HOME` | `D:\WorkSpace\Agents\DSH` |
| `DSH_PROFILE` | `desktop` |
| `DSH_PROFILE_DIR` | `D:\WorkSpace\Agents\DSH\profiles\desktop` |
| `DSH_WEB_URL` | `http://127.0.0.1:19387` |

### 4.4 线上 profile 参照物

`D:\WorkSpace\Agents\DSH\profiles\desktop\`

| 项 | 值 |
|----|-----|
| `cordis.patch.yml` | 162 行，**全部是 `- id:` 条目**（config 覆盖 / `disabled:` 开关），**无任何 `insert`** |
| 其中 webserver 行 | `- id: webserver` / `name: '@deepseek-ai/dsh-host-webserver'` / `config.host: '0.0.0.0'` / `port: 19387` |
| 其中模型行 | `agent-default-model`：`provider: deepseek-account` / `model: deepseek-flash` / `reasoningEffort: max` |
| `package.json` | `dsh.profile.bundles` 共 **21** 项；含 `"patchReload": "live"` |
| bundles 列表 | `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`、`@deepseek-ai/dsh-experimental-agent-team-profile`、`@deepseek-ai/dsh-experimental-auto-review`、`dshmarket`、`@changfenhuang/dsh-genui`、`@tt-a1i/archify-dsh`、`@linxin666/dsh-web-all`、`dsh-whale-widget`、`billion-context`、`dsh-context`、`dsh-better-sidebar`、`dsh-free-search`、`dsh-llm-verifier`、`dsh-ops`、`dsh-prompt`、`dsh-prompt-enhance`、`dsh-mnemon`、`clearai-dsh`、`dsh-workspace-acl-allow`、`@wenbin_wb/dsh-bridge` |

---

## 5. 硬约束基线（不安装证明）★

约束：**不安装该插件到 DeepSeek Harness 上**。以下三项在 S0 冻结时均为「未安装」，构成本次分析的**基线事实**，S1–S5 全程**不得改变**：

| 检查项 | 结果 |
|--------|------|
| `D:\WorkSpace\Agents\DSH\profiles\desktop\node_modules\@dsh-external` 存在？ | **否**（False） |
| `D:\WorkSpace\Agents\DSH\super-injector` 存在？ | **否**（False） |
| `profiles\desktop\cordis.patch.yml` 匹配 `super-injector` 或 `dsh-external`？ | **无匹配** |

**未安装证明的含义**：O1 **从未被装配**，因此其 `inject` 依赖（`['loader','timer','tools','systemPrompt','webServer']`）从未被 runtime 解析过，`injector/src/index.ts` 中那些「实测踩坑」注释里的行为（例如 `ctx.root` 重启器、幽灵 entry 清理）在当前 runtime 上**没有运行证据**。S2 的判定只能基于**静态契约对齐**，不能基于「它跑起来过」。

同时，desktop profile 的 21 个 bundles 里**没有**任何 `dsh-routing-suite` / `super-injector` / `graded-mode` 条目 —— 与本约束一致。

---

## 6. S0 阶段已浮现的候选缺口（待 S1/S2 用证据裁定）

以下**不是结论**，而是 S0 冻结时肉眼可见、必须由 S1 契约枚举逐一证伪或坐实的候选点：

| # | 候选缺口 | 位置 |
|---|----------|------|
| G1 | profile 解析硬编码 `web`：`join(dshHome,'profiles','web','node_modules')`，而实际 profile 是 `desktop` | `injector/src/index.ts:577`（另见 L245/L575 的 `dshHome` 推导） |
| G2 | `entry._dispose()` 契约存疑 | `injector/src/index.ts:1063`（判定）/ `:1071`（调用） |
| G3 | `ctx.registry.delete(fiber)` 传参语义存疑 | `injector/src/index.ts:1177` |
| G4 | 根 manifest peerDependencies 裸名 `cordis` / `schemastery` | 仓库根 `package.json` |
| G5 | `dsh.client.inject` 含 runtime 树内不存在的 `@deepseek-ai/dsh-client-runtime` | 仓库根 `package.json` |
| G6 | README 声明的 DSH Target 上界 `<0.2.0`，而实测 runtime 是 `0.2.0-rc.2`（区间外） | `README.md:34` |
| G7 | 构建产物缺失（`injector/lib`、`injector/node_modules` 均不存在），无 checkout 源码树 | §2.1、§4.1 |
| G8 | `ctx.get('clientModules')` / `ctx.get('agents')` 为非正式服务名，契约面未取证 | `injector/src/index.ts:1350/1701/1726/1737/1832/3227`、`:3255` |
| G9 | 模板 `build.sh` 与文件头 checkout 探测依赖 `$DSH_CHECKOUT/packages`，与当前部署形态不符 | `injector/src/index.ts:55`、`:3050` |
| G10 | `graded/dsh.plugin.json` 的 `contributes.commands` 形态是否仍是合法 manifest | `graded/` |
| G11 | `preset/` 的 `.agent-presets/` 加载约定是否仍成立 | `preset/` |
| G12 | `patchReload` 字段消费者未定位 | `profiles/desktop/package.json` vs `dsh-app-boot` |

---

## 7. 未取证清单（S1 未竟项，交接给后续步骤）

1. `ctx.get('clientModules')` 契约：`processOne` / `clientPath` / `table` / `rebuilt`（包位置未定位）
2. `ctx.get('agents')` 契约：`{ create?: (options) => Promise<{agent:{id}}> }`
3. `dsh.profile.patchReload` 的消费者
4. `dsh.plugin.json` / `contributes.commands`（O2）在当前 DSH 的合法性
5. O3 preset 的 `.agent-presets/` 加载约定、三件 preset 的 schema 合法性
6. `dsh.client.external` 的合法取值与语义（vs `dsh.client.inject`）
7. `dsh.client.platform` 的取值集
8. `engines.node >=22` 与当前 Node 实际版本的关系
9. `@deepseek-ai/cordis` 在插件安装位置能否被解析（peerDeps 声明 vs 可解析性）
10. `@deepseek-ai/cordis` 的 `vendor/` 与 `packages/core/tools` 路径在**已安装** runtime 树中是否存在（模板 build.sh 依赖）

---

## 8. 变更日志

| 时刻 | 事件 |
|------|------|
| S0 冻结 | 建立本基线。HEAD `1952733`，工作树 clean。未安装证明三项均为否。 |

> 若 §2 的 HEAD、§4 的版本、§5 的三项检查在后续任一时刻发生变化，本基线作废，必须重新冻结。
