# D1 · 适配性报告（S2 差异判定）

> 判定基准：`docs/compat/BASELINE.md`（S0 冻结）+ `docs/compat/CONTRACT-MATRIX.md`（S1 契约枚举）。
> 权威 runtime：`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\`（`dsh` 0.2.0-rc.2 / `cordis` 4.0.4 / `cordis-plugin-loader` 1.0.5 / `schemastery` 3.18.4 / Node v24.14.1 → ModuleLoader **v2**）。
> 硬约束：**未安装到 DSH**（D0 门禁复核见 §9）。

---

## 0. 结论摘要

| 对象 | 判定 | 硬破坏 | 漂移/瑕疵 | 死声明 | 修复性质 |
|------|------|--------|-----------|--------|----------|
| **O1** `injector/` | **不适配 · 可修复** | **2** | 5 | — | 插件内改代码 + 声明清理 + 构建链修复 |
| **O2** `graded/` | **适配 · 仅需清理** | 0 | 2 | 1 | 删 1 个死文件 + 3 处小清理 |
| **O3** `preset/` | **旧形态已废 · 须结构性迁移** | 1（形态） | 1 | — | 改打包形态（DSH 侧机制已移除） |

**总判定**：三件套**均不能原样在当前 DSH 上工作**，但**没有一件落在「无法适配」**。O2 最接近可用；O1 需要 2 处真正的代码级硬修；O3 需要按官方迁移路径重建为 bundle 形态，且必须先解决 1 个已消失的依赖包。

---

## 1. 方法与证据等级

| 等级 | 含义 |
|------|------|
| **A** | 权威 runtime 源码行级证据（`src/*.ts` 优先，其次 `lib/*.js`） |
| **B** | 随 runtime 出货的官方技能/README（`skills/cordis-plugin-development/`、`skills/editing-cordis-compositions/`、各包 `README.zh.md`） |
| **C** | 线上 profile 实测（`profiles/desktop/`） |
| **D** | 全树 grep 零命中/存在性检验 |

**方法论提醒**：该安装**不发布任何 `.d.ts`**（runtime 树 `@deepseek-ai` 下 0 个 `.d.ts`），且 `lib/` 是打包产物。凡涉及行为语义的结论均以 `src` 或 `lib` 实测为准。

---

## 2. O1 `@dsh-external/dsh-super-injector` v0.3.3

### 2.1 硬破坏（必然失败）★

| ID | 位置 | 事实 | 证据 | 官方替代路径 |
|----|------|------|------|--------------|
| **HARD-1** | `injector/src/index.ts:1063`（判定）→ `:1071`（调用） | 插件调用 `entry._dispose()` 并通过 `typeof entry._dispose !== 'function'` 守卫；**`Entry` 类没有 `_dispose` 成员，全包 grep 零命中，`Entry` 也不继承任何基类** → 该守卫**必然**抛 `Error('selfEntry 无官方 _dispose（loader 契约缺失）')`，自愈/重启链路直接失效 | A：`cordis-plugin-loader/src/config/entry.ts:43-236`（`export class Entry {`）；D：`_dispose` 零命中 | `entry.fiber.dispose()`（`entry.ts:135` 自身即如此用；`group.ts:40`）；`EntryGroup.remove(id, isDispose)`（`group.ts:37-46`）；`Entry.init()`（`entry.ts:208-235`） |
| **HARD-2** | `injector/src/index.ts:1177` | `ctx.registry.delete(fiber)` **传入的是 fiber 而非 plugin** → `registry.resolve(fiber)` 返回 `undefined` → `_internal.delete` 与后续 terminate 全部跳过，**静默 no-op**，幽灵 fiber 不被回收 | A：`cordis/src/registry.ts:258-267`（`delete(plugin: Plugin)`，非 fiber） | 传模块命名空间（同文件 `:1284`/`:1310` 的 `delete(oldPlugin)`/`delete(fresh)` 是对的） |

> 注：HARD-2 是**插件自身缺陷**，不是 runtime 漂移——`registry.delete` 的语义在 cordis 4.x 一直是「按 plugin 解析 runtime」。

### 2.2 语义/配置漂移

| ID | 位置 | 事实 | 判定 |
|----|------|------|------|
| **DRIFT-1** | `injector/src/index.ts:577` | `profileNodeModules = config.profileNodeModules \|\| join(dshHome,'profiles','web','node_modules')` —— 本部署 `DSH_PROFILE=desktop`，默认值会解析到不存在的 `profiles/web` | **在本部署必失效**；`Config` 有 `profileNodeModules` 可覆盖，故属「默认值错」而非「无法修」 |
| **DRIFT-2** | 仓库根 `package.json` | `peerDependencies` 仍是**裸名** `cordis: >=4.0.0-rc <5`、`schemastery: ^3.18.0`；真实包名是 `@deepseek-ai/cordis`、`@deepseek-ai/schemastery`（`injector/package.json` 已改 scoped，根未改） | 声明漂移（同仓库内不一致） |
| **DRIFT-3** | 仓库根 `package.json` `dsh.client.inject` | 声明 `'@deepseek-ai/dsh-client-runtime'` 与 `'@deepseek-ai/dsh-client-ui-slots'`。**`dsh-client-runtime` 在整棵 runtime 树零命中**。S2 取证已明确语义：`parseDshClient`（`dsh-client-modules/lib/index.js:63-73`）只做类型校验（`platform` 必须 string、`inject`/`external` 走 `optionalStringArray`、`immediately` 必须 boolean），而 `orderByModuleGraph`（`:415-437`）**只遍历 `entry.external` 建图，`inject` 不参与排序** | ⚠️ **S3 已降级为「惰性遗留声明」**：实测**已安装且正常工作**的 `dsh-prompt` 声明 `{"platform":"web","immediately":true,"inject":["@deepseek-ai/dsh-client-runtime","@deepseek-ai/dsh-client-ui-slots"]}` —— **与本仓库根声明逐字相同**。既然 `inject` 不参与图排序、该名字也不会被 require，它就是**惰性的** → **决定不改**（改了反而偏离一个已安装可用的同类插件写法）。详见 §10.1 |
| **DRIFT-4** | `injector/src/index.ts:2889-2890` | 自检白名单正则含 **`settings.plugin.item`（单数）**，全树 0 命中；真实槽是复数 **`settings.plugins.tab`** | 与 `:2880-2882` 注释宣称的「生成即校验、当场暴露」相反——会**误放行**注册到已移除槽位的骨架 |
| **DRIFT-5** | `README.md:34` / `injector/README.md` | 声明 DSH Target `>=0.1.0-rc.6 <0.2.0`；实测 runtime 是 **`0.2.0-rc.2`**，在区间**之外** | 兼容矩阵过期 |

### 2.3 构建链缺口

| ID | 事实 |
|----|------|
| **BUILD-1** | `injector/lib`、`injector/lib/index.js`、`injector/lib/client.js`、`injector/lib/types/index.d.ts`、`injector/node_modules` **全部不存在** → 仓库根 `main` 指向的产物未构建 |
| **BUILD-2** | 模板 `build.sh`（`injector/src/index.ts:3050`）要求 `DSH_CHECKOUT` 且 `[ -d "$CHECKOUT/packages" ]`，并 link `"$CHECKOUT/vendor/cordis"`、`"$CHECKOUT/packages/core/tools"`；文件头候选路径 `$HOME/dsh-harness`、`$HOME/dsh`、`$HOME/.dsh/dsh-harness`（`:55`）。**当前机器上系统提示声明的 checkout 不存在**（`app.asar` 是文件），只有已安装 runtime 树 → 构建脚本需改指已安装 runtime |

### 2.4 仍然成立的部分（不得误判为漂移）✔

- **FiberState 逐位一致**：`cordis/src/fiber.ts:147-154` 的 `const enum FiberState { PENDING, LOADING, ACTIVE, FAILED, DISPOSED, UNLOADING }` ↔ 插件 `:530` 的 `FIBER_NAMES` 数组 0..5。因是 `const enum`（编译期内联），插件硬编码数组是唯一可行做法。
- `ctx.loader.entries()`（`tree.ts:27-33` 生成器，含 `subtree` 递归）✔
- `ctx.loader.import(name, getOuterStack)`（`tree.ts:112-129`，第二参正是 getOuterStack，插件传 `() => []` 合法）✔
- `ctx.loader.unwrapExports(ns)`（`index.ts:201-208`）✔
- `ctx.loader.create({name,config})`（`tree.ts:82-87`，返回 entry id 字符串）✔
- `ctx.loader.internal.loadCache`（`internal.ts:24-28`，`LoadCache extends Omit<Map,…>` → **仍是 Map 子类**，未覆写 `delete`/`keys`，故 `Map.prototype.delete.call` 与 `[...cache.keys()]` 合法）✔
- `entry.options` 六字段 `{id,name,config,group,disabled,inject}`（`entry.ts:10-23`）✔；`entry.fiber`（`index.ts:52-54` 官方 `declare module` 扩展 + `:129-135` 由 loader 赋值）✔；`entry.parent`/`entry.getOuterStack`（`entry.ts:197-205`）✔
- `ctx.registry.plugin(plugin, config, getOuterStack)`（`registry.ts:316-336`）✔；`ctx.registry.get(plugin)`（`:236`）✔；`fiber.uid`（`fiber.ts:186`）、`fiber.dispose()`（`:196`）、`fiber._config`（`:192`）、`fiber.parent`、`fiber.runtime` ✔
- `ctx.webServer.register({kind:'prefix',…})` **返回 disposer**（`dsh-host-webserver/lib/index.js:177-184`）→ `ctx.effect(() => ctx.webServer.register(...))` 是正确写法；直接清 `exact/prefixes/upgrades` 三张表属多余且脆弱的旧补偿（表确实仍是 Map，`:148-150`）
- `ctx.get('clientModules')`（`dsh-client-modules/lib/index.js:526` 服务名确认）与 `ctx.get('agents')`（`dsh-agent/lib/index.js:332`）**都是真实服务** ✔
- `ctx.systemPrompt.context({name,…})` 必须带 `name`（`dsh-system-prompt/lib/index.js:266-269`）；插件 `:3199-3201` 确实传了 `name:'dsh-super-injector'`、`order:-90` ✔
- `defineTool` 仍由 `@deepseek-ai/dsh-tools` 导出（`:3714`）；参数 spec `required: true` 语义（`:603-604`）、`output.render` 返回内容块数组（`:1173-1180`）、`ToolRegistry.register` 要求 `output.render` 为函数（`:2878-2889`）全部吻合 ✔
- 客户端：`window.__ModuleLoader__.load({id, factory})` 仍是当前契约（官方模板 `templates/decoration/client.js` 逐字同形）；`ctx.slots.inject('settings.section', () => ctx.slots.register({…}, C))` 与 `dsh-cordis-client-runner/lib/client.js:4758` 官方示例**逐字同形**；`settings.section` 存活（5 个官方注册者）✔
- `patch` 的 `- insert:`（无 id）形态仍受支持：`cordis-plugin-include/src/index.ts:79-100`（`if (insert) { … else data.push(...insert) }`）✔

---

## 3. O2 `@dsh-external/dsh-graded-mode` 0.0.1-rc1

### 3.1 装配与调用面：全部成立 ✔

| 面 | 事实 | 证据 |
|----|------|------|
| bundle 声明 | `graded/package.json` `dsh.bundle.patch: ./cordis.patch.yml`；`graded/cordis.patch.yml`（7 行）= `- insert:` / `- id: dsh-graded-mode` / `name: '@dsh-external/dsh-graded-mode'` / `config: {}` → **与官方规范逐字同形** | B：`host-plugin.md:9-27` |
| 导出形态 | `src/index.js:58` `export const name`；`:59` `export const inject = ['commands','userQuestions','webServer','tools']`；`:60` `export const Config = z.object({})`；`:142` `export function apply(ctx, config)`；`:613` `export default { apply, name, inject, Config }` | B：`host-plugin.md:49-53`（允许 `export function apply` + `export const inject`/`Config`） |
| **服务存在性** | 四个注入服务**全部真实存在**：`commands`（`dsh-commands/lib/index.js:259 super(ctx,"commands")`）、`userQuestions`（`dsh-user-questions/lib/index.js:490`）、`webServer`、`tools` | A + D |
| `commands.register` 字段契约 | 要求 `name` 匹配 `COMMAND_NAME` 正则、`description` 非空 string、`handler` function、可选 `input.hint` 非空 string；返回 `layers.effect` 的 disposer。插件传 `{name:'graded', description:'…', input:{hint:'[<任务描述>\|off\|status]'}, handler}` → **全部满足** | A：`dsh-commands/lib/index.js:149-182, 266-269` |
| 命令 invocation 形状 | `Object.freeze({commandId, agent, rawInput, attachments, signal})`；插件用 `invocation.agent`（`:384`）与 `invocation.rawInput`（`:388`）→ **吻合** | A：`dsh-commands/lib/index.js:379-385` |
| 返回值契约 | handler 必须返回 `CommandResult`（`kind` 必须存在；`success.text` 可为 string；`error.text` 必须非空）→ 插件返回 `{kind:'success',text:'分级模式已关闭'}` / `{kind:'error',text:'no agent session'}` **合法** | A：`dsh-commands/lib/index.js:184-201` |
| webServer 用法 | 4 处全部 `const d = ctx.webServer.register({…})` 取 disposer（`src/index.js:233,273,295,315`）✔ | A |
| tools 用法 | `ctx.effect(() => { … for (const def of […]) { const d = ctx.tools.register(def); if (d) disposers.push(d) } return () => … }, 'graded-mode: global tools')`（`:358-367`）→ **符合「资源挂 ctx.effect」规范** | A + B：`host-plugin.md:54` |
| 私有契约面 | 全 `graded/src/*.js` **无** `loader.` / `_dispose` / `registry.` / `ctx.get(` 任何调用 → **未触碰任何私有 API** | D |
| 构建产物 | `lib/index.js`(30923B)、`lib/client.js`(29338B)、`lib/inject-text.js`、`lib/mode-state.js`、`lib/tools.js`、`lib/client/client.js` **全部存在**（`src/` 与 `lib/` 同名同尺寸） | C |

### 3.2 死声明与瑕疵

| ID | 事实 | 判定 |
|----|------|------|
| **O2-DEAD-1** | `graded/dsh.plugin.json` = `{"contributes":{"commands":["分级"]}}`。全树 grep `dsh\.plugin\.json` **0 命中**；`plugin\.json|PLUGIN_MANIFEST|pluginManifest` 限定 `*.js` **0 命中**；runtime 树内不存在任何同名文件。`grep contributes` 的 66 处**全是散文/JSDoc 措辞**，无 manifest schema 实现 | **该 manifest 形态在 0.2.0-rc.2 不被消费**；`contributes.commands` 是死声明。命令的真实注册走 `ctx.commands.register`（已成立） |
| **O2-DEF-1** | `graded/package.json` `types: ./lib/types/index.d.ts` —— **`lib/types/` 不存在** | 悬空 `types` |
| **O2-DEF-2** | `graded/package.json` `engines: { "dsh": ">=0.0.1-rc" }` —— 非标准键，无 `engines.node`；全树 grep `engines?.dsh|engines\.dsh` **0 命中** | 无人消费的装饰性声明 |
| **O2-DEF-3** | `graded/README.md:31-38` 装配命令用 `--profile web`（`DSH_HOME='<DSH_HOME>' node <NPM_GLOBAL>/@deepseek-ai/dsh/lib/bin.js plugin --profile web add <PLUGIN_DIR>`） | 与 O1 `README.md:28` 同源的 profile 名漂移 |
| **O2-DEF-4** | `graded/package.json` `dsh.client = { platform:'web', immediately:true, inject:[] }`。经 `dsh-client-modules/lib/index.js:63-73` 校验：`platform` 须为 string ✔、`inject`/`external` 须为 string 数组（空数组合法）✔、`immediately` 须为 boolean ✔；`:719` 要求声明 `dsh.client` 的包**必须导出 `./client`** —— graded 的 `exports` 含 `./client` 且 `lib/client.js` 存在 ✔ | **成立**（非瑕疵） |

### 3.3 O2 判定

**适配**。唯一的「死物」是 `graded/dsh.plugin.json`（一个不被读取的文件），既不影响装配也不影响功能。其余三项（悬空 `types`、`engines.dsh`、README profile 名）是卫生问题。**O2 不需要为适配而改代码。**

---

## 4. O3 `preset/`（router-standard / router-spec / router-react）

### 4.1 形态判定：旧形态已废（决定性）★

| 项 | 事实 | 证据 |
|----|------|------|
| 现状 | `preset/<id>/` = `preset.yml`（`name`/`description`/`order`，与旧形态描述**逐字吻合**）+ `agent.cordis.yml` + `router-bootstrap*.mjs` + `router-core*.mjs` —— 这正是 `$DSH_HOME/.agent-presets/<id>/` 的目录形态 | C |
| **权威判词** | `dsh-agent-preset/skills/editing-cordis-compositions/SKILL.md:70`：**"Before declaration rows, a user preset was a directory `$DSH_HOME/.agent-presets/<id>/` holding `preset.yml` … and `agent.cordis.yml` … Nothing reads that directory any more."** | B |
| 佐证 | 全 runtime 树 grep `\.agent-presets` **只有 1 处匹配**，即上句迁移说明本身 | D |
| 新形态 | **"Agent presets are ordinary `@deepseek-ai/dsh-agent-preset` declarations carried by bundle patches."**（同 SKILL `:8`）。声明行 config 字段：`id`（必填）、`plugins`（必填，Cordis entry list）、可选 `name`/`description`/`order`；Loader 行 id 约定 `preset-<id>`。出货 Web preset 即 `@deepseek-ai/dsh-web-app` bundle 的 `presets/<id>.patch.yml`（`:12`） | B |
| 官方示例 | `editing-cordis-compositions/SKILL.md:32-50`：bundle `package.json` 带 `dsh.bundle.patch`，patch 为 `- insert:` / `- id: preset-review` / `name: '@deepseek-ai/dsh-agent-preset'` / `config: {id, name, description, order, plugins:[…]}`。另见 `dsh-agent-preset/README.zh.md:28-46` 字段表 | B |
| 服务依赖 | `dsh-agent-preset/README.zh.md:84`：**需要 `agentPresets` 服务。重复的 preset ID 会导致声明加载失败。** | B |
| 包名 | 真实包名是**单数** `dsh-agent-preset` + `dsh-agent-preset-registry`（`lib/index.js:481 super(ctx,"agentPresets")`）。**复数 `dsh-agent-presets` 在 runtime 树不存在**，其 junction 悬空 | A + C |

→ **O3 当前形态在当前 DSH 上完全不起作用**。这不是「插件代码漂移」，而是 **DSH 侧移除了该机制**，属计划中风险 R2 的情形；但出口不是「无法适配」，而是「**须结构性迁移**」。

### 4.2 迁移阻塞（必须先解决）

| ID | 事实 | 严重度 |
|----|------|--------|
| **O3-BLOCK-1** | 三件 preset 共 **29 个唯一 `name`**，逐条存在性检验结果：**28 个 EXISTS，唯一 MISSING = `@deepseek-ai/dsh-workflow-worker-thread`**。且 `cordis-composition-reference/references/packages.md` 的 `## workflow` 组（`:500`）只有 `@deepseek-ai/dsh-tool-ralph`(`:504`)、`@deepseek-ai/dsh-tool-workflow`(`:505`)、`@deepseek-ai/dsh-workflow-ptc`(`:506`) —— **`dsh-workflow-worker-thread` 不在任何清单内** | **高**。SKILL 明文警告：*"check each plugin name against `cordis-composition-reference` because **packages renamed since the preset was written fail at activation**"*（`editing-cordis-compositions/SKILL.md:70`）。即使完成迁移，该 preset 仍会**装配失败**，必须替换或删除该行 |
| **O3-BLOCK-2** | 4 个相对路径行：`./router-bootstrap-v10.mjs`、`./router-bootstrap-v17.mjs`、`./router-bootstrap-v34.mjs?v=88`、`./gitbash-executor.mjs?v=49`。权威语义：**"inserted relative paths are anchored beside their patch file"**（`cordis-composition-reference/SKILL.md`）→ 原锚定于 preset 目录，迁移后锚定于 patch 文件旁，**须重新落位 .mjs 文件** | 中 |
| **O3-BLOCK-3** | `?v=88` / `?v=49` 查询串（缓存破坏参数）出现在**模块 specifier** 中，需确认 Loader 的 `import`/`resolveSync` 解析容忍度 | 中（未取证） |
| **O3-NOTE-1** | `preset/router-standard/agent.cordis.yml:18-24` 注释：*"A service row here MUST sit inside a group carrying an `isolate` realm. Without one it publishes into the root realm … and the second session mounting this preset collides with the first; **`dsh-agent-presets`** rejects that at mount."* —— 注释写的也是**复数**（已消失的包名），进一步佐证该 preset 写于旧世代 | 低（信息性） |
| **O3-NOTE-2** | `preset/router-standard/agent.cordis.yml` 高频引用：`cordis:group` ×4、`@deepseek-ai/dsh-tool-subagent` ×4、`@deepseek-ai/dsh-tool-bash` ×2；name 计数 router-standard=34、router-spec=31、router-react=31 | 低（信息性） |

### 4.3 O3 判定

**不适配（旧形态已废），可结构性迁移但非机械替换**。迁移路径明确（官方 SKILL 给了逐字段映射），但**必须先处理 O3-BLOCK-1 的消失依赖**，否则迁移后仍会在装配期失败。

---

## 5. 根因归属

| 类别 | 涉及 | 说明 |
|------|------|------|
| **插件自身缺陷**（与 runtime 无关） | O1 HARD-1、O1 HARD-2 | 对私有 API 的错误假设：`entry._dispose` 从来不存在；`registry.delete` 入参从来是 plugin。属「一直就是错的」 |
| **双向声明漂移** | O1 DRIFT-1/2/3/4/5、O2 README | 插件假设旧的 profile 名（`web`）、旧包名（`dsh-client-runtime`、`dsh-agent-presets`）、旧槽名（`settings.plugin.item`）、旧版本区间（`<0.2.0`） |
| **DSH 侧机制移除** | O3 全体、O2-DEAD-1 | 旧 preset 目录形态被取消、`dsh.plugin.json` 形态不再被消费 |
| **构建/环境** | O1 BUILD-1/2 | 产物未构建 + 构建脚本依赖不存在的 checkout 源码树 |

---

## 6. 修复优先级（供 S3 使用）

| 优先级 | 项 | 动作 | 风险 |
|--------|----|------|------|
| **P0** | O1 HARD-1 | 用 `entry.fiber.dispose()`（或 `EntryGroup.remove(id,true)`）替换 `entry._dispose()`；删掉 `typeof … !== 'function'` 守卫 | 改的是自愈器本身，改错会自毁（计划风险 R3）→ 隔离分支 + 一次一项 + 回滚点 |
| **P0** | O1 HARD-2 | `ctx.registry.delete(fiber)` → 传 plugin 命名空间，或改走 `fiber.parent.registry` | 同上 |
| **P0** | O1 DRIFT-1 | 默认 profile 解析改为 `DSH_PROFILE`/`DSH_PROFILE_DIR` 优先，去掉 `profiles/web` 硬编码 | 低 |
| ~~P1~~ | O1 DRIFT-3 | **已重新裁定为「不改」**（S3 实测：`inject` 不参与模块图排序、且与已安装可用的 `dsh-prompt` 声明逐字相同 → 惰性声明）。**只**删掉 `injector/tsdown.config.ts` 里的 external `'@deepseek-ai/dsh-client-runtime/client'` —— 那里的语义不同（打包允许表，一旦被 import 宿主必抛 `missed the module table`） | 低 |
| **P1** | O1 DRIFT-4 | 自检白名单 `settings.plugin.item` → `settings.plugins.tab` | 低 |
| **P1** | O3-BLOCK-1 | 为 `dsh-workflow-worker-thread` 找替代（`dsh-tool-workflow` / `dsh-workflow-ptc`）或删除该行 | 需确认该行在原 preset 中的作用 |
| **P1** | O3 全体 | 按官方映射迁移为 bundle + `@deepseek-ai/dsh-agent-preset` 声明 | 结构性改动 |
| **P2** | O1 DRIFT-2、DRIFT-5 | 根 manifest peer 改 scoped；README 兼容矩阵上移到 `0.2.x` | 低 |
| **P2** | O1 BUILD-1/2 | 补构建（指向已安装 runtime 树而非 `DSH_CHECKOUT/packages`） | 需要能解析 `@deepseek-ai/cordis` 等 |
| **P2** | O2 清理 | 删 `graded/dsh.plugin.json`；修 `types`；去 `engines.dsh`；README 改 `--profile desktop` | 低 |

---

## 7. 残余不确定性（S3 前需消除）

| # | 项 | 影响 |
|---|----|------|
| ~~U1~~ | **已消解（S3）**：`inject` 是透传给浏览器工厂的 require 名单，且 `orderByModuleGraph` 只遍历 `external` → 声明一个不存在的包是**惰性的**（不报错、不排序、不被 require）。实证：已安装的 `dsh-prompt` 与 O1 声明逐字相同且工作正常 | 结论：**保留声明不改** |
| U2 | ModuleLoader **v2** 下 `loadCache` 的实际嵌套层数（`Map<url, {[phase]: ModuleJob}>`？）；插件 `:1151` 的 `oldJob?.module?.getNamespace()` 在 v2 是否取得到 | 影响 O1 的一条恢复路径；已知 v2 下 `delete` 只置 `undefined`，被删 key 仍在 `[...keys()]`（`internal.ts:89,1151` 注释） |
| U3 | O1 `:1187`/`:1233` 用裸 `loadCache.set()`，与自身 `:994-996` 注释矛盾 | 潜在第二处硬破坏 |
| U4 | O3 的 `?v=` 查询串是否被 Loader 解析容忍 | 决定迁移时是否需剥离 |
| U5 | O1 未安装 → 上述任何修复**无法在真实装配下验证**（计划风险 R4）。默认走静态验证 + 可选进程内 scratch 装配（需批准） | 决定 S4 的验证强度 |

---

## 8. 对「是否适配」的最终回答

> **当前状态下三件套均不适配。** 但性质不同：
> - **O1** 是**真的坏了**：2 处必然失败的硬破坏（`entry._dispose` 不存在、`registry.delete(fiber)` 恒 no-op），外加在本部署必失效的 profile 默认值、3 项过期声明、以及未构建的产物。**可在插件内修复**。
> - **O2** 是**几乎没坏**：装配路径、注入的 4 个服务、命令/tools/webServer 的调用契约全部成立，且有构建产物。只剩 1 个死文件和 3 处卫生问题。**不需要为适配改代码。**
> - **O3** 是**换了机制**：旧 preset 目录形态被 DSH 移除，必须迁移为 bundle 形态；且迁移前必须先处理 1 个已消失的依赖包。**属结构性迁移，非代码修补。**
>
> **没有任何一件落在「无法适配」。** 三件套分属三个结论，不应合并陈述。

---

## 9. D0 门禁复核（硬约束）

| 检查项 | 结果 |
|--------|------|
| `profiles\desktop\node_modules\@dsh-external` | **不存在** ✔ |
| `D:\WorkSpace\Agents\DSH\super-injector` | **不存在** ✔ |
| `profiles\desktop\cordis.patch.yml` 匹配 `super-injector`/`dsh-external` | **0 匹配** ✔ |
| S1 路径事故残留 `profiles\desktop\docs` | **不存在** ✔ |
| `git status`（仓库） | 仅 `?? docs/compat/`（未跟踪）—— **无任何已跟踪文件被修改** ✔ |
| 仓库 HEAD | `195273352f23bff7f9023ebe2ec0cdbdf9c98f10`（与 S0 冻结一致）✔ |

**硬约束全程未触碰。**

> 以上为 **S2 判定时刻**的快照。S3 之后的门禁复核见 §11。

---

## 10. S3 修复实施记录

> 隔离分支 **`fix/adapt-dsh-0.2.0-rc2`**，基于 `main@195273352f23bff7f9023ebe2ec0cdbdf9c98f10`。
> **回滚点 = `main`**（S3 全程未触碰被审对象之外的分支）。

### 10.1 O1（injector）

| 项 | 动作 | 状态 |
|----|------|------|
| HARD-1 | `await entry._dispose()` + `typeof entry._dispose !== 'function'` 守卫 → `if (entry.fiber && typeof entry.fiber.dispose === 'function') await entry.fiber.dispose()` + `entry.fiber = undefined`；守卫改为 `entry.parent?.tree`（注释标注 `entry.ts:135` / `group.ts:40` 的官方用法） | ✅ |
| HARD-2 | `registry.delete(fiber)` → `registry.delete(fiber?.runtime?.callback)`（`cordis/src/registry.ts:258-267` 的入参是 plugin） | ✅ |
| DRIFT-1 | profile 解析改为 `DSH_PROFILE_DIR` → `DSH_PROFILE` → `'web'` 三级；新增 `detectRuntimeNodeModules()` 与 `detectBuildSource()` | ✅ |
| DRIFT-2 | 根 `package.json` peerDeps 裸名 → `@deepseek-ai/cordis`（`>=4.0.0-rc <5`）/ `@deepseek-ai/schemastery`（`^3.18.2`），与 `injector/package.json` 对齐 | ✅ |
| ~~DRIFT-3~~ | **不改**（重新裁定为惰性声明，见 §2.2） | ⏸️ 有意保留 |
| DRIFT-4 / D13 | **两处**白名单都删掉 `settings.plugin.item`：① 脚手架自检正则（`2889-2890`）；② **活体验证的 `KNOWN_SLOTS` 数组**。其余 9 项逐个在 0.2.0-rc.2 全树复验存活（`conversation.view` / `settings.plugins.tab` / `settings.section` / `settings.general.item` / `conversation.session.header.actions` / `conversation.session.header.utilities` / `conversation.input.dock` / `conversation.composer.dock` / `sidebar.footer.action` / `shell.overlay`） | ✅ |
| DRIFT-5 | `README.md` DSH Target `<0.2.0` → `<0.3.0`（0.2.0-rc.2 是 0.2.0 的预发布版，原上界把它排除在外） | ✅ |
| D11 | 脚手架 client 模板从已废的**单参** `register({…, component})`（`options.component` 永不读取 → 运行时空白且无报错）改为官方**双参** `register(options, Component)`，React 从浏览器模块表 `require('react')` | ✅ |
| D8 / D9c | `injector/tsdown.config.ts` 的 `CLIENT_EXTERNALS`：裸名 `'cordis'` → `'@deepseek-ai/cordis'`；**删除** `'@deepseek-ai/dsh-client-runtime/client'`（0.2.x 无该包，一旦被 import 必抛 `missed the module table`）；注释补上 9 项种子表 | ✅ |
| BUILD-1/2 | `SCAFFOLD_BUILD_SH` **重写为双依赖来源**：A) 源码 checkout（`DSH_CHECKOUT`，含 `packages/`+`vendor/`）；B) 已安装 runtime（`DSH_RUNTIME_NODE_MODULES`，或从 `$DSH_HOME/profiles/*/node_modules`、`$DSH_HOME/profiles/node_modules` 自动探测）；`dev_build_plugin` 与 `dev_self_test` 同步改为 `detectBuildSource()`（`dev_self_test` 改为直接使用该模板，不再内联旧脚本） | ✅（脚本已具备能力；**产物本身仍未构建**，见 §10.4） |
| 卫生 | 根 `package.json` 的悬空 `types: ./injector/lib/types/*.d.ts`（tsdown `dts:false`，永不生成）→ 移除并简化 `exports` | ✅ |
| 文档 | `injector/README.md`、`injector/docs/SPEC.md` 补 **0.2.x 更正块**（`_dispose`/`_start` 是语义占位，官方等价 = `entry.fiber.dispose()` / `entry.init()` / `entry.update()` / `EntryGroup.remove()`）；`README.md`、`README.en.md`、`injector/INSTALL.md`、`install.sh`、`install.ps1`、`injector/scripts/fix-patch.mjs` 的 `profiles/web` 与 `--profile web` 全量改写为 profile 自适应/占位 | ✅ |

### 10.2 O2（graded）——「仅需清理」

| 项 | 动作 | 状态 |
|----|------|------|
| O2-DEAD-1 | 删 `graded/dsh.plugin.json`（73 B；全树 0 消费者，`contributes.commands` 是死声明） | ✅ |
| O2-DEF-1 | 悬空 `types: ./lib/types/index.d.ts`（`lib/types/` 不存在）→ 移除并简化 `exports` | ✅ |
| O2-DEF-2 | `engines: { "dsh": ">=0.0.1-rc" }`（非标准键、0 消费者）→ `engines: { "node": ">=22" }` | ✅ |
| O2-DEF-3 | `graded/README.md`、`graded/docs/VERIFIABILITY.md` 的 `--profile web` → `--profile <profile>` | ✅ |

### 10.3 O3（preset）—— 结构性迁移

| 项 | 动作 | 状态 |
|----|------|------|
| O3-BLOCK-1 | 已消失的 `@deepseek-ai/dsh-workflow-worker-thread` → **`@deepseek-ai/dsh-workflow-ptc`**。依据两条：① 它是 `cordis-composition-reference/references/packages.md` 的 `## workflow` 组（`:500-506`）里唯一候补；② `dsh-workflow-ptc/lib/index.js:585-586` 的 `static Config = z.object({ provider: z.string().default("spawn"), … })` 与 preset 行内 `config: { provider: spawn }` **逐字对应**。三件 preset 各改 1 行（同时改 `id` 与 `name`） | ✅ |
| O3-MIGRATE | **新增 `scripts/gen-preset-bundle.mjs`**：把旧目录形态（`preset/<id>/{preset.yml,agent.cordis.yml}`，**仍是唯一真源**）生成 DSH 0.2.x 声明式 bundle —— `cordis.patch.yml`（**不带 id 的** `- insert:` + 每个 preset 一行 `preset-<id>` / `name: '@deepseek-ai/dsh-agent-preset'` / `config: {id,name,description,order,plugins}`）+ `package.json`（`dsh.bundle.patch`）。`plugins` 用**逐行 +10 空格文本内联** `agent.cordis.yml`，不做 YAML 解析 → 语义零改动 | ✅ |
| O3-VERIFY | 用 runtime 自带 `yaml` 解析器跑 `build/verify-preset-bundle.mjs`：**18/18 ALL PASS**，含逐件「`config.plugins` 与 `agent.cordis.yml` 的 YAML 解析结果 **JSON 完全相等**」（router-standard 19 / router-spec 18 / router-react 18 个顶层 entry），以及「无 id 的 `insert` = 追加」这一 `applyEntryPatches` 语义 | ✅ |
| O3-INSTALL | `README.md` / `README.en.md` / `install.sh` / `install.ps1` 的 preset 安装步骤从「复制目录到 `.agent-presets/`」改为「生成 bundle → `dsh plugin add`」，自检改为按 `id: preset-<id>` 断言，并提示旧目录残留可删 | ✅ |

### 10.4 仍未消除 —— 转入 S4/S5

| 项 | 为什么没改 |
|----|-----------|
| **U2**（ModuleLoader v2 下 `loadCache` 的真实嵌套层数、`:1151` 的 `oldJob?.module?.getNamespace()` 是否取得到） | 只有**真实装配**下的运行期探测能定论（计划风险 R4；硬约束不安装） |
| **U3**（`:1187` / `:1233` 用裸 `loadCache.set()`，与自身 `:994-996` 注释「必须 `Map.prototype.set.call`」矛盾） | 同上；这是回滚路径，静态上无法确定 v2 是否真的抛 `type must be string` |
| **BUILD-1**（`injector/lib` 仍未构建） | 本机**无 typescript、无 tsdown**（runtime 树 / profiles / `D:\WorkSpace\nodejs` 三处都没有）。构建脚本已改为支持安装版 runtime 形态，但产物需在有工具链的环境产出 |
| **O1 `dsh.client.inject` 保留不变** | 见 §2.2 DRIFT-3（惰性声明，与已安装的 `dsh-prompt` 逐字相同） |
| **U5**（未安装 → 无法端到端验证） | 硬约束本身。已做的**静态**验证：4 个 JSON 清单全部可解析 ✔；`node --experimental-strip-types` 语法门 2/2 通过（`index.ts` 与 `client/index.ts` 的失败点均为 `ERR_MODULE_NOT_FOUND`，即解析成功）✔；preset bundle 18/18 断言通过 ✔ |

> §8 的「当前状态下三件套均不适配」描述的是 **S2 判定时刻**。修复后的状态：**O1 已消除 2 处硬破坏与全部声明漂移（可修复适配已完成，但需构建产物才能真正装上）；O2 已清理为纯粹可用；O3 已完成结构性迁移并被 YAML 级证明。** 三件套仍**无一**落在「无法适配」。

---

## 11. S3 后 D0 门禁复核（硬约束）

| 检查项 | 结果 |
|--------|------|
| `profiles\desktop\node_modules\@dsh-external` | **不存在** ✔ |
| `D:\WorkSpace\Agents\DSH\super-injector` | **不存在** ✔ |
| `profiles\desktop\cordis.patch.yml` 匹配 `super-injector`/`dsh-external` | **0 匹配** ✔ |
| `profiles\desktop\docs`（S1 路径事故残留） | **不存在** ✔ |
| 改动落点 | 全部在隔离分支 `fix/adapt-dsh-0.2.0-rc2` 的工作区；**`main@1952733` 未被触碰**（回滚点完好） |

**硬约束在 S3 全程未被触碰。**

---

## 12. S4 验证结论（详见 `docs/compat/VERIFICATION.md`）

S4 在**不安装插件**的前提下，用「真实官方服务 + 进程内装配」把结论从静态比对升级为**可执行行为证据**：

| 层 | 手段 | 结果 |
|----|------|------|
| V0 | `scripts/verify-contract.mjs`（当场 require 安装版 runtime） | **57 / 57** |
| V1 | `build/s4-harness/assemble.mjs` 进程内真实装配（`dist` / `tsc` / `src` 三目标） | **26 / 26 × 3** |
| V2 | `tsc` 类型检查 + `tsc --noCheck` 真实构建 | 无代码级错误；产物可装配 |
| V3 | `scripts/gen-preset-bundle.mjs` + `build/verify-preset-bundle.mjs` | **18 / 18** |
| V4 | D0 硬约束门禁 | **4 / 4** |
| V5 | `build/s4-harness/client-smoke.mjs`（vm 模拟模块表，无浏览器） | **18 / 18** |

### 12.1 S4 新增确认

1. **真实分发包产物可装配**：`npm install` 的 `prepare` 钩子真实产出了 `injector/lib/{index.js,client.js}`，其中 `lib/index.js` 在真实 loader 上 **26/26 PASS** —— 「`injector/lib` 未构建」这一原本的硬阻塞在 S4 中**已消解**（该目录按仓库既有约定不入库，已加入 `.gitignore`）。
2. **`?v=` 之外的构建链缺口**：`precise` 结论见 R-8 —— `prepare` 产出的 `lib/index.js` **不是零外部依赖**（头部保留 `import { defineTool } from "@deepseek-ai/dsh-tools"` 与 `import z from "@deepseek-ai/schemastery"`），与 `injector/tsdown.config.ts:37-41` 注释宣称的设计目标不符。实测这 7 个 peer 在 `profiles/node_modules/@deepseek-ai/` 下**全部可解析**，故**不阻断装配**；达成自包含的正确路径是 S3 重写的 `scripts/build.sh`（先链接 peer 再构建）。
3. **新修复 1 处真实代码缺陷**：`injector/src/index.ts:2785` 的 `async execute(args)` 缺参数注解（`TS7006`），全文件 24 处 `execute` 中唯一一处；已补为 `args: { dir: string; profile?: string }`。补后 `tsc --noEmit` **只剩 6 条 `TS2307`（环境缺 `.d.ts` 所致），无任何代码级错误**。
4. **`@tsdown` 类型产物缺失的根因**：部署版 runtime **只发布 `*.d.ts.map`、不发布 `*.d.ts`** —— 这是 `scripts/build.sh` 必须双形态（源码 checkout / 已安装 runtime）的根因。
5. **client 侧从静态比对升级为行为验证**：真实 `lib/client.js` 在 vm 里被 `__ModuleLoader__.load` 捕获、factory 执行（仅请求 `react`）、`apply` 应用（`inject:['slots']` + `ctx.effect` + `slots.inject('settings.section')`），并断言 occupant 是**两参**形态、`options.component === undefined`、`label()` 返回 `"插件管理"`、组件可渲染 —— **18/18 PASS**。

### 12.2 残余风险

共 8 项（R-1…R-8），其中 **R-1（真装端到端）与 R-6（preset 在 DSH 内实际加载）由硬约束本身导致**，无法在本次任务内消除。清单与逐项原因见 `docs/compat/VERIFICATION.md` §8。

---

## 13. D6 · 最终结论（S5 交付）

> 判定基准不变：`docs/compat/BASELINE.md`（S0 冻结）+ `docs/compat/CONTRACT-MATRIX.md`（S1 契约枚举）。
> 全部修复落在隔离分支 **`fix/adapt-dsh-0.2.0-rc2`**，回滚点 **`main@195273352f23bff7f9023ebe2ec0cdbdf9c98f10`**。

### 13.1 一句话结论

**三件套在 DSH `0.2.0-rc.2` 上原本都不能原样工作；经本轮修复后，`injector`（O1）与 `graded`（O2）已适配，
`preset`（O3）已按官方迁移路径重建为声明式 bundle —— 没有一件落在「无法适配」。**

### 13.2 逐对象最终判定

| 对象 | S2 判定（修复前） | S5 判定（修复后） | 支撑证据 |
|---|---|---|---|
| **O1** `injector/` | 不适配 · 可修复（2 硬破坏 + 5 漂移） | ✅ **已修复适配**（v0.3.4） | 契约 **57/57** · 装配 **26/26 × 3 目标** · client **18/18** |
| **O2** `graded/` | 适配 · 仅需清理（0 硬破坏） | ✅ **适配**（0.0.1-rc1，仅清理、未升版） | 契约面仅 `webServer.register` 4 处；4 项注入服务全部存在 |
| **O3** `preset/` | 旧形态已废 · 须结构性迁移 | ✅ **已迁移**（bundle 形态；CHANGELOG v1.27.1） | preset **18/18**；29 个引用名中唯一缺失包已定位为改名 |

### 13.3 本轮实际改了什么（19 改 · 1 删 · 3 新增）

**硬破坏（不改必崩）**

1. `Entry._dispose()` 不存在 → 改用 `entry.fiber.dispose()`（`cordis-plugin-loader@1.0.5` 全包零命中）。
2. `registry.delete(fiber)` 静默 no-op → `registry.delete(fiber.runtime.callback)`（实测 `size` 7→7 与 7→6）。

**语义与配置漂移**

3. profile 路径硬编码 `web` → `DSH_PROFILE_DIR` → `DSH_PROFILE` → `web` 三级解析。
4. 死槽名 `settings.plugin.item`（0.2.x 全树 0 命中，真名是复数 `settings.plugins.tab`）从两处白名单移除。
5. 脚手架 client 模板的**单参** `slots.register` → 官方**两参**形态（`options.component` 永不被读）。
6. 裸名 peer `cordis` / `schemastery` → scoped（根 manifest、脚手架模板、tsdown externals、`package-lock.json`）。

**构建链**

7. `scripts/build.sh` 从「只认源码 checkout」重写为**双形态**（`DSH_CHECKOUT` / `DSH_RUNTIME_NODE_MODULES`）。
8. 新增 `detectRuntimeNodeModules()` / `detectBuildSource()`；`dev_build_plugin` / `dev_self_test` 不再硬依赖 checkout。
9. `async execute(args)` 补参数类型注解（`TS7006`，全文件 24 处 `execute` 中唯一一处）。
10. tsdown client externals 移除 `@deepseek-ai/dsh-client-runtime/client`；悬空 `exports["./client"].types` 去除。

**preset 迁移（O3）**

11. 三件 preset 的 `@deepseek-ai/dsh-workflow-worker-thread` → **`@deepseek-ai/dsh-workflow-ptc`**（各 3 处、共 6 处；`Config` schema 逐字对应）。
12. 新增 `scripts/gen-preset-bundle.mjs` 与 `build/verify-preset-bundle.mjs`。
13. `install.sh` / `install.ps1` 重写：profile 自适应 + bundle 生成（不再往 `.agent-presets/` 复制）。

**清理（O2）**

14. 删除 `graded/dsh.plugin.json`（死 manifest）；`engines.dsh` → `engines.node`；悬空 `types` 去除。

**文档**

15. `README.md` / `README.en.md` 新增 **DSH 兼容矩阵**；DSH Target 上移到 `>=0.1.0-rc.6 <0.3.0`。
16. `injector/CHANGELOG.md` 新增 `[0.3.4]`；`preset/CHANGELOG.md` 新增 `v1.27.1`；`graded/CHANGELOG.md` 新增未发版节。
17. `injector/README.md` / `injector/docs/SPEC.md` 补 `_dispose` 更正块（给出官方等价路径与行号）。

### 13.4 未消除项（诚实清单）

| # | 项 | 归属 | 为什么没消除 |
|---|---|---|---|
| 1 | **真装端到端**（插件实际装进 profile、重启、在 GUI 里操作） | 硬约束 | 用户明令「不安装该插件到 DSH 上」。已用**进程内真实 loader 装配**替代（26/26 × 3 目标） |
| 2 | **preset 在 DSH 内实际加载** | 硬约束 | 同上；已用 runtime 自带 YAML 解析器做**结构等价验证**（18/18，JSON 完全相等） |
| 3 | **`prepare` 产物非零外部依赖**（R-8） | 构建链 | `prepare` 阶段未链接 peer；实测这些 peer 在部署树里可解析故**不阻断**。正确自包含路径是 `scripts/build.sh` |
| 4 | ModuleLoader v2 下 `loadCache` 的嵌套层数 | 运行期 | 需要真实 import 路径才能探测；本次未构造 |
| 5 | 裸 `loadCache.set()` 与自身注释自相矛盾 | 插件内既有缺陷 | 只在回滚路径触发；无 v2 运行时证据，保留并记入残余 |
| 6 | `injector/lib` 不入库 | 仓库既有约定 | 构建产物不入库；已加入 `.gitignore`，并说明 `prepare` 与 `scripts/build.sh` 两条构建路径 |

### 13.5 最终回答

> **问**：这个插件是否还与当前的 DeepSeek Harness 适配？不适配就进行修改使它适配。
>
> **答**：**原本不适配，现已适配。** `injector` 与 `graded` 直接可用；`preset` 需按新的 bundle
> 形态安装（仓库已提供生成器 `scripts/gen-preset-bundle.mjs` 与迁移说明）。适配目标为 DSH
> **`0.2.0-rc.2`**；`>=0.3.0` 尚未验证。
>
> 全部改动落在隔离分支 `fix/adapt-dsh-0.2.0-rc2`；**未安装到 DSH、未触碰任何 profile**
> （D0 门禁终检见 §11 与 `docs/compat/VERIFICATION.md` §7）。

### 13.6 交付坐标

| 项 | 值 |
|---|---|
| 分支 | `fix/adapt-dsh-0.2.0-rc2`（HEAD 即本次适配提交） |
| 回滚点 | `main@195273352f23bff7f9023ebe2ec0cdbdf9c98f10`（未被改动） |
| 提交规模 | 两次提交：① `8654c44` 适配主体（44 files, +9013 / −260）② D14 锚点资产修复 + 真装验证证据（12 files, +613 / −60）；合计 `main..HEAD` = 49 files, +9566 / −260 |
| tag | `v0.3.4`（annotated）→ 本分支 HEAD |
| 交付文档 | `docs/compat/`：`BASELINE.md`（S0）· `CONTRACT-MATRIX.md`（S1）· 本报告（S2–S5）· `VERIFICATION.md`（S4）· `raw/`（三方审计原文 + 解压证据） |
| 交付脚本 | `scripts/verify-contract.mjs`（57 条契约断言）· `scripts/gen-preset-bundle.mjs`（preset 迁移生成器）· `scripts/verify-preset-bundle.mjs`（26 条 bundle 校验）· `build/s4-harness/*`（隔离装配验证） |

---

## 14. V6 · 真机真装验证结论（用户授权，消除 R-1 / R-6）

用户指令（m01206 / m01207）明确授权把插件真装到真机 **`web` profile** 做一次端到端验证，
以消除 S4 报告里由硬约束导致的 R-1（真装端到端）与 R-6（preset 在 DSH 内实际加载）。
**这是硬约束的唯一一次、经所有者批准的解禁**；`desktop` profile 与运行中的主 GUI 全程未被触碰。

### 14.1 做了什么

| 步 | 动作 | 结果 |
|----|------|------|
| 1 | 快照 `profiles/web/{package.json,cordis.patch.yml}` | `docs/compat/live/web-package.before.json`、`web-cordis.patch.before.yml` |
| 2 | `dsh plugin --profile web add <repo>/injector` | EXIT=0（pnpm 11.22.0，lockfile 254 条目通过供应链策略） |
| 3 | `node scripts/gen-preset-bundle.mjs <repo> $DSH_HOME/external/dsh-router-presets router-{standard,spec,react}` | EXIT=0 |
| 4 | `dsh plugin --profile web add <bundle>` | EXIT=0 |
| 5 | `dsh --profile web --dump-config` | EXIT=0，77288 字节组合树 |
| 6 | 真启动 `dsh web`（端口 43120，与桌面 GUI 的 19387 不冲突）并做 HTTP 探测 | 见 14.2 |

### 14.2 证据

- **装配**：`dsh --profile web --dump-config` 的组合树里出现
  `# == @dsh-external/dsh-super-injector` → `- id: dsh-super-injector` / `name: '@dsh-external/dsh-super-injector'`；
  以及 `# == dsh-router-presets` → `- id: preset-router-react` / `preset-router-spec` / `preset-router-standard`
  （与官方 `preset-standard` / `preset-ptc` / `preset-minimal` / `preset-cordis` 并列），
  行内 `config.plugins` 即 `agent.cordis.yml` 的内联结果。
- **真启动无错**：`dsh web` 正常起服务并打印 `http://127.0.0.1:43120/?token=…`；
  stderr 无 `super-injector` / `agent-preset` 相关错误（无 invalid plugin、无 duplicate preset ID、无缺 `agentPresets` 服务）。
- **插件 HTTP 面真实可用**：`GET /super-injector/api/list` → **200** `{"ok":true,"entries":[],"stats":{…}}`；
  未定义子路径 `/super-injector/api/nope` → 404 且 body 是插件自己的 `{"ok":false,"error":"not found: …"}`
  （证明 404 来自插件 handler，而非路由未注册）；带 token 的 `/` → 200（40204 字节 HTML）。
- **插件 `apply()` 真实执行**：`$DSH_HOME/super-injector/self-heal.log` 每次启动新增
  `purge-stale-tools: …` 与 **`client-meta-healed: client-modules pkgMeta 缓存已清并重解析（设置页插件管理 UI 注册）`** ——
  后者证明 `ctx.get('clientModules')` 的 `pkgMeta.delete()` + `processOne()`
  **在真实 web profile 里成功执行**，这也**顺带消除了 S1 遗留的 `clientModules` 契约缺口（C8 / C14 的 UNVERIFIED）**。
- **web profile 变更面**：仅 `dependencies` 增加两条 `link:`（`@dsh-external/dsh-super-injector`、`dsh-router-presets`），
  `dsh.profile.bundles` 数组尾部增加同名两项；**`cordis.patch.yml` 零改动**（before/after diff 为空）。
  快照见 `docs/compat/live/web-package.after.json`。

### 14.3 ★ 验证中发现并修复的新缺陷（D14）

**D14：preset bundle 必须随身携带锚点 `.mjs` 资产。**
`agent.cordis.yml` 里有 `name: ./router-bootstrap-v34.mjs?v=88` 这类相对引用；
cordis 的 patch 方言规定相对路径锚点是**承载它的 patch 文件所在目录**
（代码证据 `cordis-plugin-include/src/index.ts:188` `this.ctx.baseUrl = new URL('.', pathToFileURL(this.filename)).href`）。
旧形态下 `agent.cordis.yml` 与这些 `.mjs` 同目录，所以能解析；迁移成单一 bundle patch 后，
`scripts/gen-preset-bundle.mjs` 生成的目录里**只有 `cordis.patch.yml` + `package.json`**，
4 个相对引用（`router-bootstrap-v{34,10,17}.mjs`、`gitbash-executor.mjs`）在 preset **挂载**时会解析失败。

修复：生成器新增 `localRefs()`（收集 patch 引用的 `-vNN.mjs`）与 `localClosure()`
（再收集 `from './router-core-vNN.mjs'` 的同目录依赖）并平铺复制到 `<outDir>/`；
因三件 preset 引用的 basename 全局唯一，**YAML 无需改写**，语义与旧形态逐字一致。
生成器自带断言「patch 里每个 `./x.mjs` 必须落在 `<outDir>/`」。
校验器 `scripts/verify-preset-bundle.mjs`（由 `build/` 迁入、现随仓库）扩到 **26/26 PASS**
（语义 JSON 等价 + 4 个锚点资产存在 + 3 条资产内依赖闭合）。

### 14.4 残余（新增 R-9，R-1/R-6 已消除）

| # | 项 | 状态 |
|---|---|---|
| ~~R-1~~ | 真装端到端 | **已消除**（14.2） |
| ~~R-6~~ | preset 在 DSH 内被加载 | **已消除**（组合树 + 真启动无声明错误） |
| **R-9** | preset 在会话里**被挂载并跑起来**（`AgentPresets.recompose` 真正 `import './router-bootstrap-vNN.mjs'`） | 仍需在 GUI 里新建一个 Router Standard 会话才能真正触发；D14 已把该路径的**唯一已知解析风险**（锚点资产缺失）修掉 |
| R-7 | `?v=` 查询串是否被 Loader 容忍 | 随 R-9 一起才能在运行期确认（静态层面 `new URL('./x.mjs?v=88', base)` 合法，已确认） |
| R-8 | 分发包非零外部依赖 | 未变 |
| R-2 / R-3 / R-4 / R-5 | 见 §12.2 | 未变 |

