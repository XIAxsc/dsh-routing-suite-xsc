# S1 交付物（D1 前置）— 契约面枚举对照表 · v2

> **对象**：`@dsh-external/dsh-super-injector` v0.3.3（`injector/`，下称 **PLUGIN**） × 权威 runtime **dsh 0.2.0-rc.2**（cordis 4.0.4 / cordis-plugin-loader 1.0.5 / Node v24.14.1）
> **状态语义**：`成立` ｜ `成立·瑕疵`（存在但用法有缺陷） ｜ `缺失`（契约不存在） ｜ `语义漂移` ｜ `未取证`
> **本表给出 S1 证据与初步裁定**；S2 据此出正式适配性报告（D1）。

---

## 0. 别名与证据分级

| 别名 | 绝对路径 |
|------|----------|
| `PLUGIN` / `PLUGIN_CLIENT` | `injector/src/index.ts`（3163 行）／ `injector/src/client/index.ts`（161 行） |
| `ROOT_PKG` / `INJ_PKG` / `ROOT_PATCH` | 仓库根 `package.json` ／ `injector/package.json` ／ 仓库根 `cordis.patch.yml`（12 行） |
| `RT` | `D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai` |
| `CORDIS_SRC` / `LOADER_SRC` | `RT\cordis\src` ／ `RT\cordis-plugin-loader\src`（二者**随包附带完整 TS 源码**） |
| `BOOT_APP` | `RT\dsh-app-boot\lib\index.js` |
| `CLIENT_MODULES` | `RT\dsh-client-modules\lib\index.js` |
| `API_CATALOG` | `RT\dsh-tool-cordis\lib\types\api-catalog.js`（**该安装唯一的类型形状来源**） |

**证据分级**：`A` = 官方 TS 源码原文 ｜ `B` = 官方 `lib/*.js` 产物原文 ｜ `C` = 官方技能文档/模板 ｜ `D` = 运行时行为推断（须标 UNVERIFIED）

> ⚠️ **全局取证前提**：该安装**不发布任何 `.d.ts`**（全树 `@deepseek-ai` 下 0 个 `.d.ts`，`lib/types/` 只有 `.d.ts.map`）。故一切结论以 `lib/*.js` + 随包 TS 源码为准，类型形状取自 `API_CATALOG`。

---

## A. manifest / 装配层

| # | 插件侧声明 | runtime 权威语义 | 结论 | 证据 |
|---|-----------|------------------|------|------|
| A1 | `ROOT_PKG` → `dsh.bundle.patch: ./cordis.patch.yml` | bundle 由「声明 `dsh.bundle.patch`」定义；值可为字符串或**字符串数组**，否则运行时抛错 | **成立** | `BOOT_APP:487,495-499`（B）；`host-plugin.md:3,9-27`（C） |
| A2 | `ROOT_PATCH` 用 `- insert:` + 内联 `- id/name/config` | `PatchOptions.insert?: EntryOptions[]`；**无 `id` → 顶层追加** `data.push(...insert)`；有 `id` → push 进该 group 的 `config` | **成立** | `BOOT_APP:74,86-87`（B）；`cordis-plugin-include/src/index.ts:77-100`（A） |
| A3 | patch 项 `- id: dsh-super-injector` | override **整值替换** `config`（非深合并）；`name` 不一致 warn 并 skip | **成立** | `host-plugin.md:3`（C）；`applyEntryPatches :116`（A） |
| A4 | `ROOT_PKG` → `dsh.client.inject: ['@deepseek-ai/dsh-client-runtime','@deepseek-ai/dsh-client-ui-slots']` | ① 形状合法：`inject` **必须是字符串数组**；② **两个成员都无效** —— `dsh-client-runtime`：本机两套安装树都无此包（npm 上真实存在但止于 `0.1.1-rc.2`，**无 0.2.x**）；`dsh-client-ui-slots`：是 **seed word、无 graph 行 → 被静默跳过** | **语义漂移（两个成员均无效声明）** | `CLIENT_MODULES:47-51,66`（B）；`client.md` Q5（A/B） |
| A5 | `ROOT_PKG` → `dsh.client.platform: web` | 必须为字符串，且**只有 `'web'` 会被纳入 boot 图** | **成立** | `CLIENT_MODULES:714`（B） |
| A6 | `ROOT_PKG.peerDependencies` = **裸名** `cordis` / `schemastery` | 实际包名是 `@deepseek-ai/cordis`（4.0.4）／`@deepseek-ai/schemastery`（3.18.4） | **语义漂移** | `RT` 下无裸名同名包；`INJ_PKG` 已 scoped |
| A7 | `INJ_PKG.peerDependencies` 已 scoped | 与 runtime 实际包名一致 | **成立** | `INJ_PKG` |
| A8 | `INJ_PKG.main = ./lib/index.js`；`ROOT_PKG.main = ./injector/lib/index.js` | 两份 main 指向的产物**均不存在**（`injector/lib`、`injector/node_modules` 皆 False） | **不可装配（未构建）** | S0 实测 |
| A9 | `engines.node >=22` | 本机 Node **v24.14.1**（→ ModuleLoader v2 形状） | **成立** | `host.md` 环境实测 |
| A10 | `README.md:34` DSH Target `>=0.1.0-rc.6 <0.2.0` | 实测 runtime `dsh` = **0.2.0-rc.2** → **落在声明区间之外** | **语义漂移** | S0 §4.1 |
| A11 | `README.md:28` 安装命令 `dsh plugin --profile web add …` | 本机实际 profile 是 **`desktop`** | **文档漂移** | `DSH_PROFILE=desktop` |
| A12 | `INJ_PKG` peer `@deepseek-ai/dsh-tools: >=0.0.1-rc <2` | 实测 `dsh-tools` = 0.2.0-rc.2，落在区间内 | **成立** | S0 §4.1 |

---

## B. host 内核面（loader / entry / fiber / registry）

> 依据 `docs/compat/raw/loader.md`（1120 行，Q1–Q10，逐条含绝对路径:行号 + 原文），关键项已由本人二次 grep 复核（`raw\_evidence-b5.md`、`raw\_evidence-b6.md`）。

| # | 插件侧调用点 | runtime 权威定义 | 结论 | 证据 |
|---|-------------|------------------|------|------|
| B1 | `ctx.loader.entries()`（19 处：`PLUGIN:603,681,829,1135,1165,1196,1243,1274,1339,1374,1390,1666,1679,1877,1988,2724,3079,3091,3142`） | `EntryTree.* entries(): Generator<Entry>`（生成器，递归 `subtree`） | **成立** | `LOADER_SRC\config\tree.ts:27-33`（A） |
| B2 | `entry.options.{id,name,config,group,disabled,inject}` | `EntryOptions` 含全部 6 字段 | **成立** | `entry.ts:10-23`（A） |
| B3 | `entry.fiber`（12 处） | `Entry.fiber?: Fiber`，由 loader 的 `internal/plugin` 监听器赋值；官方 `declare module` 扩展了 `Fiber.entry` | **成立** | `entry.ts:47`；`LOADER_SRC\index.ts:52-54,129-135`（A） |
| B4 | `FIBER_NAMES[entry.fiber.state]`（`PLUGIN:530`） | `export const enum FiberState { PENDING, LOADING, ACTIVE, FAILED, DISPOSED, UNLOADING }` → 0..5 | **成立（逐位一致）** | `CORDIS_SRC\fiber.ts:147-154`（A） |
| B5 | `ctx.loader.internal?.loadCache`（`PLUGIN:613,849,3082,3112`），`Map.prototype.delete.call` / `[...keys()]` | `LoadCache extends Omit<Map<…>,'get'\|'set'\|'has'>`；Node 内部 `class LoadCache extends Map` 重载 get/set/has，**未覆写 delete/keys** | **成立** | `LOADER_SRC\internal.ts:21-28`（A） |
| B6 | **`PLUGIN:1187`、`PLUGIN:1233` 用裸 `loadCache.set()`** | 与插件自身注释 `PLUGIN:994-996`（必须 `Map.prototype.set.call`，否则抛 `type must be string`）**自相矛盾** | **成立·瑕疵（回滚路径很可能抛错）** | 自相矛盾比对 |
| B7 | `ctx.loader.import(url, () => [])`（7 处） | `EntryTree.import(name, getOuterStack?)`；第 2 参可选 | **成立** | `tree.ts:112-129`（A） |
| B8 | `ctx.loader.unwrapExports(ns)`（7 处） | `Loader` 自有实例方法 | **成立** | `LOADER_SRC\index.ts:201-208`（A） |
| B9 | `ctx.loader.create({name,config})`（3 处） | `EntryTree.create(options: Omit<EntryOptions,'id'>, …)`，`id` 由 `ensureId` 补齐；**返回 entry id 字符串** | **成立**（返回值未被使用） | `tree.ts:82-87`、`group.ts:20-29`、`tree.ts:51-58`（A） |
| B10 | **`entry._dispose()`** — `PLUGIN:1063` 判定 → `PLUGIN:1071` 调用 | **不存在**：`_dispose` 在 1.0.5 的 **src 与 lib 全树 0 命中**；`Entry` 不继承任何基类 | **缺失（phantom）→ 该路径恒抛** | `entry.ts:43-236` 成员穷举（A） |
| B11 | `entry.parent.tree.import(entry.options.name, () => [])`（`PLUGIN:1069`） | `Entry.parent: EntryGroup`，`EntryGroup.tree: EntryTree`；官方 `Entry._init()` 自身走此路径 | **成立** | `entry.ts:48`；`group.ts:11`；`entry.ts:221-235`（A） |
| B12 | `entry.getOuterStack`（作第 3 参，`PLUGIN:1073`） | **公开箭头函数实例属性**（非原型方法），天然绑定 `this`，可安全脱手 | **成立** | `entry.ts:197-205`（A） |
| B13 | `ctx.registry.plugin(plugin, config, getOuterStack)`（5 处） | 返回 `Object.create(fiber)` 包装（`Fiber & PromiseLike<Fiber>`） | **成立** | `CORDIS_SRC\registry.ts:316-336`（A） |
| B14 | `ctx.registry.get(oldPlugin)`（`PLUGIN:1192`） | `get(plugin): Plugin.Runtime \| undefined`；模块导出对象含 `apply` → `resolve` 归一为 `plugin.apply` | **成立** | `registry.ts:236,222-228`（A） |
| B15 | `ctx.registry.delete(oldPlugin)` / `delete(fresh)`（`PLUGIN:1284,1310`） | `delete(plugin: Plugin)`；命名空间带 `apply` → `isApplicable` 成立 | **成立** | `registry.ts:258-267`（A） |
| B16 | **`ctx.registry.delete(fiber)`**（`PLUGIN:1177`） | `delete` 先 `resolve(plugin)`；`Fiber` 非 function 且无 `apply` → `undefined` → **恒 no-op** | **成立·瑕疵（误导性空操作）** | `registry.ts:258-259,222-228`（A） |
| B17 | `fiber.uid` / `.dispose()` / `._config` / `.parent` / `.runtime.callback` / `.await()` | 均为 `Fiber` 公开成员 | **成立** | `fiber.ts:186,196,192,222-228,704-710`（A） |
| B18 | `PLUGIN:1290,1314` 手写 `fiber.entry = fiber` | loader 赋的是真 fiber；插件赋的是 `registry.plugin` **包装对象** → 功能等价但 `===` 不等 | **成立·瑕疵** | `LOADER_SRC\index.ts:129-135`（A） |
| B19 | `[...runtime.fibers]` 快照（`PLUGIN:1264`） | `runtime.fibers` 是 `DisposableList`（活引用） | **成立（快照做法正确）** | `fiber.ts:266`（A） |
| B20 | `rebootCtx = ctx.root as any`（`PLUGIN:811,1066`） | `ctx.root` 是 cordis `Context` 公开 accessor，指向树根、恒活跃 | **成立** | cordis `lib/index.js:1682-1688`（B） |
| B21 | `oldJob = ctx.loader.unwrapExports(oldJob?.module?.getNamespace())`（`PLUGIN:1151`） | Node 24.14.1 → **v2** 形状：`loadCache` 值是 `Dict<ModuleJob>`（`internal.ts:89` 注释），**不是** `ModuleJob` | **疑似语义漂移 → 回滚能力受损** | `internal.ts:89-99`（A）；**UNVERIFIED**：真实键名须运行期探测 |
| B22 | `[...loadCache.keys()]`（`PLUGIN:1378`） | v1 下 delete 移除 key；**v2 下 delete 只置 `undefined`，key 仍在** | **成立·瑕疵** | `internal.ts:89`（A）+ v2 行为（D） |

### B 段子代理裁定汇总（loader.md Q1–Q10）

| Q | 主题 | 结论 |
|---|------|------|
| Q1 | entries / options / fiber.state | 成立 |
| Q2 | `entry._dispose` | **缺失（phantom）** |
| Q3 | `entry.parent.tree.import` | 成立 |
| Q4 | `entry.getOuterStack` | 成立 |
| Q5 | `registry.plugin` 及 `fiber.*` | 成立（2 处瑕疵 = B16/B18） |
| Q6 | `loader.import` + `unwrapExports` | 成立 |
| Q7 | `loadCache` 仍是 Map | 成立（3 处风险 = B6/B21/B22） |
| Q8 | `loader.create` | 成立（返回 id 非 Entry） |
| Q9 | patch `- insert:` | **仍受支持** |
| Q10 | `bundles` / `patchReload:"live"` | bundles 成立；`patchReload` **零实现（语义漂移）** |

---

## C. host 服务面

> 依据 `docs/compat/raw/host.md`（610 行，Q1–Q8）＋本人独立取证。

| # | 插件侧调用点 | runtime 权威语义 | 结论 | 证据 |
|---|-------------|------------------|------|------|
| C1 | `ctx.tools.register(defineTool({…}))`（`PLUGIN:1471,1564,2363`） | `register()` 校验 `output.render` 必须是函数，否则 `throw new TypeError('tool "<name>" must declare output { schema, render, presentationMeta? }')`；保留名 `run_code` 抛；**返回精确 disposer** | **成立** | `TOOLS_LIB:2878-2887`（B） |
| C2 | `defineTool({name,description,parameters,output,execute})` | `parameters` 是 **author 属性表**（`type/description/title/default/examples/required`），**不是** JSON Schema；`output:{schema,render}` 仍是契约；`execute(args, exec)` 返 `Promise<unknown>` | **成立**（`execute` 单参形式兼容） | `dsh-tools\lib\types\schema.js:4,78-82,126`；`API_CATALOG:7588,7531`（B） |
| C3 | 参数 spec `{type:'string', required:true, …}` | 属性级 `required` **只允许字面 `true`**，否则 authorError；被收集进顶层 `required` 数组 | **成立** | `TOOLS_LIB:603-604,155-158`；`schema.js:78-82`（B） |
| C4 | `output.render: (_a,v) => [{type:'text',text:String(v)}]` | 官方用例同形（内容块数组） | **成立** | `TOOLS_LIB:1173-1180`（B） |
| C5 | `defineTool` 是否仍导出 | 在 `TOOLS_LIB:3714` 导出清单中 | **成立** | 导出清单（B） |
| C6 | 把注册包在 `ctx.effect(...)` 里 | `register()` **内部已做** `this.layers.effect(this.ctx, …)` → 外层 `ctx.effect` 是**冗余保险**，非硬要求 | **成立（冗余但正确）** | `TOOLS_LIB:2878-2887`（B）；`host-plugin.md:54`（C） |
| C7 | **`PLUGIN:2370-2394` 直改 `layers.global.tools` 私有 `Map`** | `ToolRuntime` **无 `unregister`** → 只能改私有 Map | **成立·越界（非契约）** | `host.md` Q2（B） |
| C8 | `ctx.systemPrompt.context({ name, order, text })`（`PLUGIN:3199-3213`） | `context(context)` = `layers.effect(ctx, layer => layer.contexts.insert(context.name, context), …)` → **必须带 `name`** | **成立**（`PLUGIN:3200` 确有 `name:'dsh-super-injector'`、`:3201` `order:-90`） | `SP_LIB:266-269`（B）；`PLUGIN:3199-3201` |
| C9 | `ctx.on('system-prompt/assemble', (assembly, context, next) => …)`（**模板内**，`PLUGIN:194` 整段为注释） | 事件**仍存在且是 Waterfall**（走 `ctx.waterfall`），必须 `await next()`；返回对象**确有 `tools`** | **成立** | `SP_LIB:355`；`API_CATALOG:5995`（B） |
| C10 | 模板用 `context.agent` | **运行期成立、类型面漂移**：公开 `AssembleContext` 只声明 `{scope?,signal?}`，`agent` 由 `dsh-agent` 额外塞入 | **成立·类型漂移** | `API_CATALOG:4511`（B）；`dsh-agent\lib\index.js:291-297`（B） |
| C11 | 模板用 `agent.session.events` | **缺失**：`Session` 只有**已弃用**的 `snapshotEvents()` / `eventAt()`；全树 `session.events` **0 命中**（`tool/call` 事件类型本身存在） | **缺失**（模板级缺陷） | `dsh-session\lib\index.js:1356-1382`（B） |
| C12 | `ctx.webServer.register({kind:'prefix', path, handler})`（`PLUGIN:3281`，在 `ctx.effect` 内） | `const table = route.kind === 'exact' ? this.exact : this.prefixes`；同 (kind,path) 重复 → 抛 `webserver: duplicate … route`；**返回 disposer** | **成立（正确写法）** | `WS_LIB:177-184`、`:148-150`（B） |
| C13 | **`kind` 的有效取值** | **仅 `'exact' \| 'prefix'`**；`kind` **不被校验也不抛错** → 传其它值会被**静默当作 prefix**（`'upgrades'` 是语义错误，升级路由须用 `registerUpgrade`） | **成立（插件无误用）**：`PLUGIN:338,3282` 只用 `kind:'prefix'`；`PLUGIN:628,2483` 出现的 `upgrades` 仅是**表名清理**，而该表确为真 `Map` | `WS_LIB:177-184`（B）；`PLUGIN:338,3282,628,2483` |
| C14 | `PLUGIN:110,624-639,2481` 直接 `.delete/.keys` 三张表 | `exact/prefixes/upgrades` 仍是真 `Map` | **成立·越界**（有了官方 disposer 后属多余补偿） | `WS_LIB:148-150,191-197`（B） |
| C15 | `export const inject = ['loader','timer','tools','systemPrompt','webServer']` | **五个服务名逐一坐实**：`loader`、`timer`、`tools`、`systemPrompt`、`webServer` | **成立** | `cordis-plugin-loader\lib\index.js:590`；`cordis-plugin-timer\lib\index.js:6`（由 `dsh-base/cordis.patch.yml:24-25` 装载）；`TOOLS_LIB:2704`；`SP_LIB:213`；`WS_LIB:158`（B） |
| C16 | `z` from `@deepseek-ai/schemastery`，用 `z.object({…}).default('')` | 3.18.4 提供 `object/string/number/boolean/array/union/const`、`.default()`、**`.required()` 仍在** | **成立** | `schemastery\src\index.ts:42-99,174-175,159-160`（A） |
| C17 | `ctx.get('clientModules')` → `pkgMeta`/`processOne`/`clientPath`/`table`/`rebuilt`（`PLUGIN:1350,1701,1726,1737,1832,3227-3237`） | 服务名**真实存在**，由 `@deepseek-ai/dsh-client-modules` 注册；成员齐全：`pkgMeta: Map`、`clientPath(id)`、`rebuilt(id)`、`processOne(entryName, onError)`、`table` | **成立** | `dsh-client-modules\lib\index.js:526`（`super(ctx,"clientModules")`）、`:510`（`pkgMeta = new Map()`）、`:569-570`（`clientPath`/`table`）、`:607`（`rebuilt`）、`:833`（`processOne`）（B） |
| C18 | `ctx.get('agents')` → `{ create?: (options) => Promise<{agent:{id}}> }`（`PLUGIN:3255`） | 服务名**真实存在**，由 `@deepseek-ai/dsh-agent` 注册；`create(options)` 存在 | **成立** | `dsh-agent\lib\index.js:332`（`super(ctx,"agents")`）、`:451`（`async create(options)`）（B） |
| C19 | `ctx.setInterval`（`PLUGIN:2302`）/ `ctx.effect` / `ctx.on` / `ctx.logger` / `ctx.root` | 全部成立；`setInterval` 由 `cordis-plugin-timer` 提供 | **成立** | cordis `lib/index.js:1169,371,1682-1688`；`cordis-plugin-timer\lib\index.js:12-22`（B） |
| C20 | `PLUGIN` **活代码不注册任何 `ctx.on` 监听** | `L142–L400` 是**脚手架模板字符串**，其 `ctx.on(...)`/`ctx.setInterval`/`ctx.webServer.register`/`ctx.slots.inject` 均为模板内容 | **无调用（但模板质量受影响：C10/C11 是模板级缺陷）** | 结构分析 |

---

## D. client 面

> **取证来源**：本人独立取证 ＋ `docs/compat/raw/client.md`（639 行子代理审计：Q1–Q6 ＋ 附 A 逐点对照 ＋ 附 B UNVERIFIED）。
> 补充：`slots.inject()` 由 `dsh-client-ui-renderer`（`RENDERER_LIB:1343`）提供，而非 `SLOTS_LIB`；`SLOTS_LIB` 提供的是 `register`。
> 种子表全文（`SHELL:126` 的 `rM()`，即浏览器模块表白名单）：`react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`。

| # | 插件侧调用点 | runtime 权威语义 | 结论 | 证据 |
|---|-------------|------------------|------|------|
| D1 | `window.__ModuleLoader__.load({ id, factory })`（`tsdown.config.ts` banner） | 官方 `templates/decoration/client.js` **逐字同形** | **成立** | `SKILLS\templates\decoration\client.js`（C） |
| D2 | `export const inject = ['slots']` | 官方示例同形；`slots` 服务确由 `dsh-client-ui-renderer` 提供 | **成立** | `dsh-client-ui-renderer\lib\client.js:1323`（B） |
| D3 | `ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({name:'settings.section', id:'super-injector-plugins', order:50, label:()=>'插件管理'}, () => createElement(InjectorPage))))`（`PLUGIN_CLIENT:173-180`） | 官方插槽目录给出的示例**逐字同形** | **成立** | `dsh-cordis-client-runner\lib\client.js:4710,4758`（B） |
| D4 | `label` 用 thunk | `resolveSlotLabel(label)` = `typeof label === 'function' ? label() : label` | **成立** | `SLOTS_LIB:27-28`（B） |
| D5 | `settings.section` 是否仍存在 | **活跃**：注册者 `dsh-client-ui-settings-general\lib\client.js:1201`、`-models:4059`、`-plugins:201`、`-account:4558`、`-agent-preset:1685`；渲染侧 `-settings-general:367` | **成立** | 多包交叉（B） |
| D6 | 老模板用 `conversation.view`（`PLUGIN:379`，模板内） | **仍存在**：注册者 `dsh-client-ui-chat\lib\client.js:12390`、`-trajectory:8736`；声明者 `-conversation:18213` | **成立** | 多包交叉（B） |
| D7 | `ctx.slots.register(options, Component)` 两参形态 | 存在；`label`/`inject` 等按 `!== void 0` 透传；同优先级冲突有 `occupantHint` 提示 | **成立** | `SLOTS_LIB:163-214`（B） |
| D8 | client externals 含 `@deepseek-ai/dsh-client-runtime/client` | **既不是 seed word、也无该包** → 一旦 `require` 必抛错；当前 bundle **未 require**（`import type` 已被 tsdown 擦除） | **语义漂移（latent 雷）** | `client.md` Q4d（A/B）；同 A4 |
| D9 | externals 的 React 族：`react`、`react/jsx-runtime`、`react-dom`、`react-dom/client` | 全部是 **seed word**（种子表全文见本节导语）；插件当前 bundle 实际只 require `react` | **成立** | `SHELL:126`（B）；`ui-plugin.md:9`（C） |
| D9b | externals 的 `@deepseek-ai/dsh-client-ui-slots` | 是 seed word；且插件**只 `import type`**，运行时不被 require | **成立** | `SHELL:126`（B）；`client.md` Q4b（B） |
| D9c | **externals 的裸名 `cordis`** | 种子表里是 **`@deepseek-ai/cordis`**，裸名 `cordis` **不在表内**；当前未被 require → 仅潜在雷 | **语义漂移（latent）** | `SHELL:126`（B）；`client.md` Q4c（B） |
| D10 | client 侧热重载依赖 `clientModules`（`PLUGIN:1110,1350`） | 服务已坐实（见 C17）；完整触发时机未逐一取证 | **成立（机制）／细节未取证** | `dsh-client-modules\lib\index.js:526,607,833`（B） |
| D11 | **脚手架模板 `SCAFFOLD_UI_CLIENT`（`PLUGIN:379-393`）用旧形态** `register({name,id,label,component})` | 旧形态**已废**：`options.component` **永不读取**（`SLOTS_LIB:204-219` 只取第二参数）；现行契约是双参 `register(options, Component)` | **漂移（模板级缺陷）** | `client.md` Q1c（A/B）；`SLOTS_LIB:163,204-219`（B） |
| D12 | factory 的 `id` 取值 | **必须等于包名**（`package.json` 的 `name`） | **成立** | `client.md` Q3（B） |
| D13 | **自检白名单含不存在的槽名**：`PLUGIN:2889-2890` 的 `KNOWN_SLOTS` 正则允许 `conversation.view\|settings.plugin.item\|settings.plugins.tab\|settings.section\|settings.general.item` | 五项里 **`settings.plugin.item`（单数）在整棵 runtime 树 0 命中**；真实存在的是复数 **`settings.plugins.tab`**（声明者 `dsh-client-ui-settings-plugins\lib\client.js:68,124,208`）。**后果：自检会放行一个注册到已移除槽位的骨架**，与 `PLUGIN:2880-2882` 注释宣称的「生成即校验、当场暴露」目的相反 | **漂移（自检失效）** | 本人实测 grep：`settings.plugin.item` = 0 命中；`settings.plugins.tab` / `settings.general.item` 多命中（B） |

---

## E. preset 面（O3，非插件）

| # | 待判定项 | 状态 |
|---|---------|------|
| E1 | `preset/` 三件（router-standard / router-spec / router-react）的 schema 是否仍合当前 agent preset 契约 | **未取证** |
| E2 | `.agent-presets/` 加载约定（`PLUGIN:2538` 用 `join(dshHome,'.agent-presets')`） | **未取证** |
| E3 | router-standard 是 agent preset 而非 bundle（`ROOT_PATCH` 注释声明） | **声明已记录，未验证** |

---

## F. 构建 / 文档 / 脚本面

| # | 项 | 状态 | 证据 |
|---|----|------|------|
| F1 | `PLUGIN:3050` 模板 `build.sh`：`CHECKOUT="${DSH_CHECKOUT:-}"`，空或 `! -d "$CHECKOUT/packages"` 则 `exit 1` | **与部署形态不符**：声明的 checkout 不存在；权威物是**已安装 node_modules 树**，无 `packages/` 源码树 | S0 §4.1 |
| F2 | `build.sh` link 源 `"$CHECKOUT/vendor/cordis"`、`vendor/cosmokit`、`vendor/schemastery`、`"$CHECKOUT/packages/core/tools"` | 这些路径在已安装 runtime 树中不存在 | `PLUGIN:3050` |
| F3 | **该安装不发布任何 `.d.ts`**（全树 0 个，`lib/types/` 只有 `.d.ts.map`） | → 对**已安装 runtime** 做 `tsc --noEmit` **必然失败**（`import type` 解析不到声明）；S4 的验证策略必须据此调整 | `host.md` Q5.1（B） |
| F4 | `PLUGIN:55` checkout 候选 `"$HOME/dsh-harness" "$HOME/dsh" "$HOME/.dsh/dsh-harness"` | 本机无任一 | S0 |
| F5 | `PLUGIN:577` `profileNodeModules = config.profileNodeModules \|\| join(dshHome,'profiles','web','node_modules')` | **硬编码 `web`**；实际 profile 是 `desktop` | `PLUGIN:577` |
| F6 | `PLUGIN:733,814,2012,3146,3161` `patchFile = join(dirname(profileNodeModules),'cordis.patch.yml')` | 依赖 F5 → F5 漂移则 patch 路径随之错位 | `PLUGIN:733` 等 |
| F7 | `PLUGIN:737-738` id 正则 + `PLUGIN:786-792` 块提取 | 会**拆散 `- insert:` 块**（线上 patch 无 insert，未触发） | loader.md Q9-3（UNVERIFIED） |
| F8 | `PLUGIN:2585` 描述称 patch 重复 id "直接抛 duplicate loader entry id" | 该文案**未在 1.0.5 找到**；patch 层实为**静默 last-wins** | loader.md Q9-2（UNVERIFIED） |
| F9 | `PLUGIN:2001-2012` "阻断 bundle patch 自装配" | 前提（自带 patch 会 insert 自己）**成立** | 由 A2 佐证 |
| F10 | `PLUGIN:2819` npm-cli 路径推导 | 未取证 | — |
| F11 | 注入目标包是否声明 `dsh.bundle.patch` | 决定「重启后由 bundles 接管」是否成立（`reconcileProfilePlugins` 只自动加入 `dependency.bundle === true` 的依赖） | `BOOT_APP:1066-1081`（B） |
| F12 | `patchReload: "live"` | 整个已安装 runtime **0 命中、无代码读取**；live 热重载实由 **`dsh-hmr`**（chokidar 监视 + `readProfilePatches` + `reconcileProfilePatches`）无条件提供 | `HMR_LIB:36-45,80-82,293-303`（B） |

---

## G. 汇总统计

| 裁定 | 数 | 条目 |
|------|----|------|
| **缺失（硬破坏）** | 2 | **B10**（`entry._dispose`，活代码路径恒抛）、**C11**（`agent.session.events`，模板级） |
| **语义漂移** | 9 | A4/D8（`dsh-client-runtime` 缺失 + `dsh-client-ui-slots` 为 seed word 无效声明）、A6（裸名 peerDeps）、A10（target 区间外）、B21（v2 loadCache 形状，疑似）、F12（`patchReload` 零实现）、F5+A11（`profiles/web` 硬编码 + README 同源）、D9c（external 裸名 `cordis`）、D11（模板用已废 `register({component})` 形态）、**D13（自检白名单含不存在的槽名 `settings.plugin.item`，导致误放行）** |
| **成立·瑕疵** | 8 | B6（裸 `loadCache.set`）、B16（`registry.delete(fiber)` 空操作）、B18（`entry.fiber` 包装对象）、B22（v2 keys 残留）、C7（直改私有 Map）、C10（`context.agent` 类型漂移）、C14（手工清表）、F7（insert 块切分） |
| **成立** | 49 | A1–A3、A5、A7、A9、A12；B1–B5、B7–B9、B11–B15、B17、B19、B20；C1–C6、C8、C9、C12、C13、C15–C19；D1–D7、D9、D9b、D10、D12 |
| **未取证** | 5 | E1–E3（O3 preset 契约）、F10（npm-cli 路径）、F11（目标包 `dsh.bundle.patch` 声明）、B21 的 v2 真实键名、D10 的完整触发时机；另 `client.md` 附 B 遗留：React 大版本、悬空 junction 成因、`dsh-client-runtime` 是否会有 0.2.x |

---

## H. S1 结论一页纸

1. **装配层基本成立**：`dsh.bundle.patch` + `- insert:` 仍是**一等受支持形态**（A1–A3），patch 语义与官方技能文档逐字同形。
2. **host 内核面大范围成立**：19 处 `loader.entries()`、`EntryOptions` 全字段、`FIBER_NAMES` 数值映射（**逐位一致**）、`registry.plugin`、`unwrapExports`、`loadCache` 仍是 Map —— 全部成立。
3. **唯一活代码硬破坏**：`entry._dispose()` **是 phantom API**（1.0.5 全树 0 命中）→ `PLUGIN:1063` 守卫恒真 → **reboot 自重载路径是死代码**，必落 `scheduleHeal(…,'reboot-failed')`。官方等价入口是 **`Entry.update(options, create, force)`**（内部 `_patchContext` → `fiber.update(config, true)`），或 `entry.fiber.dispose()` + `Entry.init()` / `EntryGroup.remove(id,isDispose)`。
4. **client 面运行期成立，另有 4 处 latent／自检漂移**：`__ModuleLoader__.load({id,factory})`（`id` 必须等于包名）、`inject:['slots']`、`settings.section` + 双参 `slots.register(options, Component)` 与官方插槽目录示例**逐字同形**（`settings.section` 有 5 个活跃官方注册者）。漂移项：external 裸名 `cordis`（D9c，种子表里是 `@deepseek-ai/cordis`）、external `@deepseek-ai/dsh-client-runtime/client`（**非 seed word，一旦 require 必抛**，D8）、**脚手架模板 `PLUGIN:379-393` 用已废的 `register({…,component})` 形态**（D11，`options.component` 永不读取）、以及**自检白名单把不存在的 `settings.plugin.item` 当合法槽名**（D13，实测 0 命中，真实槽是复数 `settings.plugins.tab`）。
5. **构建侧才是最硬的结构性问题**：`injector/lib` 与 `injector/node_modules` 均不存在（A8），且**该安装不发布任何 `.d.ts`**（F3）→ 现行 `build.sh`（要求 `$DSH_CHECKOUT/packages`）在本机**无法运行**，且无法对已安装 runtime 做类型检查。
6. **三处「名字在但语义变了」**：`dsh-client-runtime`（A4）、裸名 `cordis`/`schemastery`（A6）、`patchReload:"live"`（F12）。
7. **结论方向**：O1 **不是「完全不兼容」，而是「可修复适配」** —— 需要修的是一处 phantom API 调用、若干私有 API 用法瑕疵、profile 名硬编码、构建脚本与 manifest 声明；**不需要重写**。
8. **O2（graded）与 O3（preset）尚未判定**，S1 未覆盖（E 全为未取证）。

---

## I. S1 未竟项（交接 S2）

1. B21 v2 `loadCache` 值的真实键名（运行期探测，决定回滚路径严重度）
2. `dsh.client.external` 的官方文档归属与**种子表全表**（`SHELL:126` 的 `rM()` 已取到 9 项，但 `dsh.client.external` 与 seed word 的关系仍无官方文档直接陈述）
3. D10 client 侧热重载链的完整语义（`clientModules.rebuilt` / `processOne` 的调用时机与副作用）
4. E1–E3 O3 preset 契约（`.agent-presets/` 加载约定 + 三件 preset 的 schema 合法性）
5. O2 `graded/dsh.plugin.json` 的 `contributes.commands` 在 0.2.0-rc.2 是否合法
6. F10 npm-cli 路径假设；F11 注入目标包的 `dsh.bundle.patch` 声明（决定「重启后由 bundles 接管」是否成立）
7. **对 S4 验证设计的冲击**：因该安装**不发布任何 `.d.ts`**（F3），`tsc --noEmit` 只能对**带声明文件的源码树**执行，**无法**对已安装 runtime 做类型检查 —— 变更验证策略需据此重新设计
