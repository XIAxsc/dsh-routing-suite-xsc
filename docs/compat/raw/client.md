# DSH client（浏览器侧）插件契约审计 — 静态、只读

- 审计对象：`dsh-routing-suite-xsc` 的 **client half**（浏览器侧）
- 被审计插件源码：`D:\WorkSpace\AgentWorks\DSH\dsh-routing-suite-xsc\injector\src\client\index.ts`（181 行）
- 权威 runtime 根：`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\`
- profile 链接树：`D:\WorkSpace\Agents\DSH\profiles\node_modules\@deepseek-ai\`（全为 Junction）
- 已确认版本：`dsh-client-ui-slots` `0.2.0-rc.2`、`dsh-client-modules` `0.2.0-rc.2`、`dsh-client-store` `0.2.0-rc.2`、`dsh-client-resources` `0.2.0-rc.2`、`dsh-client-ui-renderer` `0.2.0-rc.2`
- 审计方式：只读。优先读 `.d.ts`；**多数 `dsh-client-*` 包未随包发布 `lib/types/`**（仅 `dsh-client-file-upload` 有），因此结论以 `lib/*.js`（打包产物，含 `//#region lib/types/index.js` 之类区域注释）为准。
- 本次未修改任何已存在文件，未安装任何包。

### 关键路径常量（后文按缩写引用）

| 缩写 | 绝对路径 |
| --- | --- |
| `RT` | `D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\` |
| `SLOTS_LIB` | `RT` + `dsh-client-ui-slots\lib\index.js` |
| `RENDERER_LIB` | `RT` + `dsh-client-ui-renderer\lib\client.js` |
| `RUNNER_LIB` | `RT` + `dsh-cordis-client-runner\lib\client.js` |
| `MODULES_LIB` | `RT` + `dsh-client-modules\lib\index.js` |
| `MODULES_CLIENT` | `RT` + `dsh-client-modules\lib\client.js` |
| `SETTINGS_GENERAL` | `RT` + `dsh-client-ui-settings-general\lib\client.js` |
| `CONVERSATION` | `RT` + `dsh-client-ui-conversation\lib\client.js` |
| `SHELL` | `RT` + `dsh-web-frontend\dist\assets\index-5SrrfWpU.js` |
| `PLUGIN_CLIENT` | `D:\WorkSpace\AgentWorks\DSH\dsh-routing-suite-xsc\injector\src\client\index.ts` |
| `PLUGIN_HOST` | `D:\WorkSpace\AgentWorks\DSH\dsh-routing-suite-xsc\injector\src\index.ts` |
| `PLUGIN_TSDOWN` | `D:\WorkSpace\AgentWorks\DSH\dsh-routing-suite-xsc\injector\tsdown.config.ts` |
| `PLUGIN_PKG` | `D:\WorkSpace\AgentWorks\DSH\dsh-routing-suite-xsc\injector\package.json` |
| `PROFILE_NM` | `D:\WorkSpace\Agents\DSH\profiles\node_modules\@deepseek-ai` |
| `NPX_CACHE` | `D:\WorkSpace\nodejs\node_cache\_npx\1e7f6d9597241db0` |

---

## 0. 摘要表

| # | 契约点 | 结论 |
| --- | --- | --- |
| 1 | `slots.inject(slotName, fn)` | **成立**（由 `RENDERER_LIB:1343` 提供，非 `SLOTS_LIB`） |
| 1b | `slots.register(options, component)` 双参新形态 | **成立**（`SLOTS_LIB:163`） |
| 1c | 旧形态 `register({name,id,label,component})` | **漂移（已废）**——`options.component` 永不读取 |
| 2 | 槽名 `settings.section` | **成立** |
| 2b | 槽名 `conversation.view` | **成立** |
| 2c | 插件 `KNOWN_SLOTS` 白名单含 `settings.plugin.item` | **漂移**——该槽名在 `0.2.0-rc.2` 全树 1514 个 `.js` 中 **0 命中** |
| 3 | `window.__ModuleLoader__.load({id, factory})` | **成立**；`id` = 包名（package.json `name`） |
| 4 | externals：`react` / `react-dom*` / `react/jsx-runtime` | **成立**（seed word，且当前 bundle 只用 `react`） |
| 4b | externals：`@deepseek-ai/dsh-client-ui-slots` | **成立**（seed word；且仅 `import type`，运行时不被 require） |
| 4c | externals：`cordis`（裸名） | **漂移**——正确名为 `@deepseek-ai/cordis`；当前未被 require，仅潜在雷 |
| 4d | externals：`@deepseek-ai/dsh-client-runtime/client` | **漂移**——非 seed word、无该包；一旦 require 必抛错。当前未被 require |
| 5 | `dsh.client.inject` 里的 `@deepseek-ai/dsh-client-ui-slots` | **无效声明**（seed word，无 graph 行 → 静默跳过） |
| 5b | `dsh.client.inject` 里的 `@deepseek-ai/dsh-client-runtime` | **缺失**（本机两套安装树都没有；npm 上真实存在但止于 `0.1.1-rc.2`，无 `0.2.x`） |
| 6 | client 侧 `export const inject = ['slots']` | **成立且必需** |

---

## Q1. `SlotsService` 的 `inject` / `register` 当前签名

### 结论

`@deepseek-ai/dsh-client-ui-slots@0.2.0-rc.2` **只导出底层注册表 `SlotCore` 及若干错误/工具**：

```
SLOTS_LIB:575: export { SlotCore, SlotOwnershipError, StaleAuthorizationError, resolveSlotLabel, standardHookPropName };
```

**`SlotCore` 上不存在 `inject` 方法。** 全文件 `inject` 只出现 2 次，都是 options 透传：

```
SLOTS_LIB:97 : ...options.inject === void 0 ? {} : { inject: options.inject },
SLOTS_LIB:214: ...options.inject !== void 0 ? { inject: options.inject } : {},
```

`slots.inject(slotName, fn)` 是由 **`dsh-client-ui-renderer` 里的 slots 服务类** 提供的（该类即 `ctx.slots`）：

```
RENDERER_LIB:1323: super(ctx, "slots");
RENDERER_LIB:1343: inject(key, callback) {
```

`register` 是**双参**：

```
SLOTS_LIB:163: register(options, component) {
SLOTS_LIB:164:   const rec = this.records.get(options.name);
SLOTS_LIB:165:   if (!rec?.spec) throw new Error(`slot "${options.name}" is not declared (a parent entry's children table must declare it)`);
```

第二个参数才是 component，落在 entry 上：

```
SLOTS_LIB:204: const entry = {
SLOTS_LIB:205:   component,
SLOTS_LIB:206:   options: { ...key/id/order/label/priority... },
```

**`options.component` 在全文件中从未被读取** → 旧形态（把 component 塞进 options）会让 `entry.component === undefined`。

槽位种类与必需字段（`SLOTS_LIB:169-190`）：

| kind | 必需字段 | 冲突键 |
| --- | --- | --- |
| `single` | — | `priority` |
| `keyed` | `options.key` | `key` + `priority` |
| `list` | `options.id` | `id` + `priority` |
| `chain` | `options.select` | — |

另有**工厂/声明**形态 `registerFactory(rawOptions, component)`（`SLOTS_LIB:74`），同样双参，用于声明整棵 `children` 子树。

### 证据

- 新形态（`settings.section` 官方注册，双参 + React 组件）：

```
SETTINGS_GENERAL:1201: ctx.slots.inject("settings.section", () => ctx.slots.register({
SETTINGS_GENERAL:1202:   name: "settings.section",
SETTINGS_GENERAL:1203:   id: "general",
SETTINGS_GENERAL:1204:   order: 0,
SETTINGS_GENERAL:1205:   label: () => t("general.nav"),
SETTINGS_GENERAL:1206:   locale: NS,
SETTINGS_GENERAL:1207:   children: { "settings.general.item": {
SETTINGS_GENERAL:1208:     kind: "list",
SETTINGS_GENERAL:1209:     scope: "root"
SETTINGS_GENERAL:1210:   } }
SETTINGS_GENERAL:1211: }, GeneralSection));
```

- 无 `id` 的 list 槽注册会抛错：`SLOTS_LIB:182 if (options.id === void 0) throw new Error(\`list slot "${options.name}" requires options.id\`);`
- `slots.inject` 的运行时语义（`RENDERER_LIB:1328-1343` 文档注释 + 实现）：按**声明世代**（`declarationEpoch`）订阅槽位；槽位已声明则 callback **同步**执行，否则在声明提交后执行；`callback` 返回单个 disposer 或 disposer iterable；controller 归属调用方 fiber，插件卸载即取消等待并移除已生效的贡献。实现要点：`RENDERER_LIB:1361 const spec = this._core.specDynamic(key);`、`:1369 const disposeEffect = ctx.effect(callback, \`slots.inject(${JSON.stringify(key)}): declaration\`);`

- 插件当前形态（**新形态，正确**）`PLUGIN_CLIENT:172-180`：

```ts
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.slots.inject('settings.section', () => ctx.slots.register(
      { name: 'settings.section', id: 'super-injector-plugins', order: 50, label: () => '插件管理' },
      () => createElement(InjectorPage),
    )),
    'super-injector: settings page',
  )
}
```

- 插件的 scaffold 模板仍是**旧形态**（`PLUGIN_HOST:363-397`，`const SCAFFOLD_UI_CLIENT = (pkgName: string): string => \`/**` 起，`component:` 字段落在 `PLUGIN_HOST:384`）：

```ts
ctx.effect(() => ctx.slots.inject('conversation.view', () => ctx.slots.register({
  name: 'conversation.view', id: '${pkgName}-panel', label: () => ${JSON.stringify(pkgName)},
  component: () => ({ render() { const el = document.createElement('div'); ... return el } })
})), '${pkgName}: panel')
```

该模板把 component 写成 options 的 `component` 字段、且其值是「返回带 `render()` 方法的对象」——**0.0.x 时代的形态**，在 `0.2.0-rc.2` 下 `entry.component === undefined`，且返回值也不是 React 元素。

模板里那句注释本身也是过时认知（`PLUGIN_HOST:368`）：

```
PLUGIN_HOST:368: * 如 conversation.view）——缺 name 报 "slot undefined is not declared"。
```

即它认为"缺 name 才会报 slot undefined is not declared"，而当前真正的失败是**双参形态下 component 落空**（`:165` 的 `slot "${options.name}" is not declared` 只在 name 未声明时触发，与此无关）。

该模板的两个真实出口（会被写进新插件的 `src/client/index.ts` 与 `tsdown.config.ts`）：

```
PLUGIN_HOST:2867: files.push(['src/client/index.ts', SCAFFOLD_UI_CLIENT(pkgName)]);
PLUGIN_HOST:2868: files.push(['tsdown.config.ts', SCAFFOLD_TSDOWN(pkgName)]);
PLUGIN_HOST:2872-2873: 同款（第二分支）
```

### 对插件的影响

- `PLUGIN_CLIENT` 的**实际运行形态已适配**（`:8-12` 的注释准确记录了这次修复：宿主 ui-settings 的 `settings.section` 期望 React 渲染函数，旧实现抛 React #130 / slot entry crashed）。
- **但 `PLUGIN_HOST` 的 scaffold 模板仍是旧契约**：任何用 `SCAFFOLD_UI_CLIENT` 生成的新插件 client 都会带上已废的 `component:` 字段与 `.render()` 对象，宿主渲染时失败。这是本插件**自身要修**的一处漂移（模板是插件的"对外产出"，不只是文档）。
- 注意 `PLUGIN_CLIENT:14 import type { SlotsService }` 是 **type-only**：`SlotsService` 类型在本 runtime **不可解析**（`dsh-client-ui-slots` 无 `lib/types/`），所以 `tsc --noEmit` 类检查在本机装不出类型；运行时无影响（被擦除）。

---

## Q2. 槽名 `settings.section` / `conversation.view` 是否仍存在

### 结论

**两者都存在，都是 `kind: "list"`**，因此注册时**必须带 `options.id`**。

- `settings.section` — `scope: "root"`，声明者是 `dsh-client-ui-settings-general` 的 `SettingsRoot` 注册的 children 表。
- `conversation.view` — `scope: "session"`，声明者是 `dsh-client-ui-conversation` 的 `conversation.session` 注册的 children 表。

（槽位合法性由 `SLOTS_LIB:165` 强制：未在某个父 entry 的 `children` 表里声明过的 key，`register` 直接抛 `slot "..." is not declared`。因此「声明点」= 某处 `register/registerFactory` 的 `children` 表。）

当前**正确槽名清单**（以本次枚举到的声明点为准，非穷举全部官方包）：`settings.trigger` / `settings.header` / `settings.action` / `settings.close` / `settings.section` / `settings.onboarding` / `settings.general.item` / `conversation.session` / `conversation.view` / `conversation.composer.dock`。

### 证据

`settings.section` 声明点（`SETTINGS_GENERAL:1160-1176`）：

```
SETTINGS_GENERAL:1166: "settings.section": {
SETTINGS_GENERAL:1167:   kind: "list",
SETTINGS_GENERAL:1168:   scope: "root"
SETTINGS_GENERAL:1169: },
SETTINGS_GENERAL:1170: "settings.onboarding": {
...（兄弟：settings.close / settings.section / settings.onboarding）...
SETTINGS_GENERAL:1175: inject: shellInjected
SETTINGS_GENERAL:1176: }, SettingsRoot);
```

`conversation.view` 声明点（`CONVERSATION:18211-18216`）：

```
CONVERSATION:18211: const registerConversationSession = () => slots.register({
CONVERSATION:18212:   name: "conversation.session",
CONVERSATION:18213:   children: { "conversation.view": {
CONVERSATION:18214:     kind: "list",
CONVERSATION:18215:     scope: "session"
CONVERSATION:18216:   } },
```

同一文件的主注册路径 `CONVERSATION:18210` 以 `}, ConversationContent);` 结束 —— 再次印证双参形态。
`conversation.view` 的官方消费点：`RT\dsh-client-ui-chat\lib\client.js:12390 ctx.slots.inject("conversation.view", () => {`（多行体）；`RT\dsh-client-ui-trajectory\lib\client.js:8737` 注册 `conversation.view`。
`settings.section` 的其它官方消费点：`RT\dsh-client-ui-agent-preset\lib\client.js:1685`、`RT\dsh-client-ui-settings-plugins\lib\client.js:202`。
官方 skill 模板亦用同款形态：`RT\dsh-agent-preset\skills\cordis-plugin-development\templates\decoration\client.js:16` → `ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({...`

### 对插件的影响

- `PLUGIN_CLIENT` 使用的 `settings.section` **没有漂移**，槽名 + `kind:list` 所需的 `id: 'super-injector-plugins'` 都在位。
- 但**插件没有在 `dsh.client.inject` 里声明 `@deepseek-ai/dsh-client-ui-settings`**（官方页插件惯例，见 `dsh-client-ui-settings-plugins` 的 `inject: ["@deepseek-ai/dsh-client-locale","@deepseek-ai/dsh-client-ui-settings"]`）。由于 `slots.inject` 自带"等声明出现"的语义（`RENDERER_LIB:1359-1374`），这**不是必须**；只影响宿主图排序与诊断可读性。
- 声明者是 `dsh-client-ui-settings-general`（不是 `dsh-client-ui-settings`）：如果该包在某个 profile 里未启用，`settings.section` 就永远不会被声明，`slots.inject` 会一直**静默等待**（无报错、无 UI）。这是"页面不出现"时第一个要查的点。

---

## Q2c.（附加发现）插件自带的 `KNOWN_SLOTS` 白名单含死槽名

### 结论

`PLUGIN_HOST:2890` 的校验白名单是：

```
conversation.view / settings.plugin.item / settings.plugins.tab / settings.section / settings.general.item
```

在 `0.2.0-rc.2` 全树（1514 个 `.js`）逐名扫描：

| 槽名 | 命中文件数 | 判定 |
| --- | --- | --- |
| `settings.plugin.item` | **0** | **死槽名（已移除）** |
| `settings.plugins.tab` | 3 | 存在 |
| `settings.section` | 6 | 存在 |
| `settings.general.item` | 9 | 存在 |
| `conversation.view` | 5 | 存在 |

### 证据

```
dsh-client-ui-settings-plugin-inventory\lib\client.js:792   settings.plugins.tab
dsh-client-ui-settings-plugins\lib\client.js:68             settings.plugins.tab
dsh-cordis-client-runner\lib\client.js:4664                 settings.plugins.tab

dsh-client-ui-agent-preset\lib\client.js:1685               settings.section
dsh-client-ui-settings-account\lib\client.js:4558           settings.section
dsh-client-ui-settings-general\lib\client.js:367            settings.section
dsh-client-ui-settings-models\lib\client.js:4003            settings.section
dsh-client-ui-settings-plugins\lib\client.js:201            settings.section
dsh-cordis-client-runner\lib\client.js:4403                 settings.section

dsh-client-ui-chat\lib\client.js:8862                       conversation.view
dsh-client-ui-conversation\lib\client.js:2883               conversation.view
dsh-client-ui-tool\lib\client.js:4294                       conversation.view
dsh-client-ui-trajectory\lib\client.js:1645                 conversation.view
dsh-cordis-client-runner\lib\client.js:2538                 conversation.view
```

`settings.plugin.item`：**0 命中**（对 `Get-ChildItem -Recurse -File -Filter *.js` 的 1514 个文件逐个 `Select-String -SimpleMatch`）。

另一处同源提示 `PLUGIN_HOST:2113`：

```
problems.push(`slots.register 缺合法 name（应为已知 slot：${KNOWN_SLOTS.join(' / ')}——缺了报 slot undefined is not declared）`)
```

### 对插件的影响

- 白名单里留一个死槽名 → 生成器的自检会**放行**针对 `settings.plugin.item` 的注册代码（该槽在 0.2.x 已不存在），而宿主在 `SLOTS_LIB:165` 抛 `slot "settings.plugin.item" is not declared`。这是"自检误报通过"型漂移，比漏报更隐蔽。
- 顺带印证：0.1.x → 0.2.x 期间插件页槽位发生过迁移（`settings.plugin.item` 消失，改为 `settings.plugins.tab` / `settings.section` 体系）。凡是从旧版本生成/沿袭的插槽名都需按本节方式逐一在 0.2.0-rc.2 树内扫描确认。

---

## Q3. client 插件的加载/打包契约：`window.__ModuleLoader__.load({id, factory})`

### 结论

**该全局入口在 `0.2.0-rc.2` 仍是契约**，分两个阶段：

1. **queue 阶段**：HTML 预热的 `dsh-client-modules/client.js` 之前，`window.__ModuleLoader__` 只是排队门面 —— `load(registration)` 把登记推进 `pendingQueue`。
2. **live 阶段**：模块系统 boot 后，`load` 被替换为直接 `register`；此时 `pendingQueue` 里排队的登记按序补投。

`id` **就是包名**（＝该包 `package.json` 的 `name`），官方 100% 如此；宿主图行以同一名字为 key。

**但没有交叉校验**：`register` 只做重复检测，不校验 `id` 是否对应 boot graph 中的行。`id` 与宿主行名不一致 ⇒ 工厂注册在一个永不 materialize 的名字下 ⇒ **插件静默不生效（不报错）**。

### 证据

queue 阶段门面（`MODULES_LIB:456-474` 内，`bootInjections`）：

```
MODULES_LIB:456-474（区域）: window.__ModuleLoader__ = { mode: "queue", pendingQueue, load(registration) { pendingQueue.push(registration) }, create(options) { ... } };
MODULES_LIB:464: client-modules: HTML did not preload @deepseek-ai/dsh-client-modules/client.js
```

live 阶段切换 + 注册（`MODULES_CLIENT`）：

```
MODULES_CLIENT:548: this.seed = new Map(Object.entries(options.staticModules));
MODULES_CLIENT:550: for (const row of options.manifest.modules) this.graphRows.set(row.id, row);
MODULES_CLIENT:560: if (target.mode !== "queue") throw new Error("client-modules: window.__ModuleLoader__.create called after module-system boot");
MODULES_CLIENT:561: const pending = target.pendingQueue.splice(0);
MODULES_CLIENT:562: target.mode = "live";
MODULES_CLIENT:563: target.load = (registration) => {
MODULES_CLIENT:564:   this.register(registration);
MODULES_CLIENT:565: };
MODULES_CLIENT:566: for (const registration of pending) target.load(registration);
MODULES_CLIENT:569: register(registration) {
MODULES_CLIENT:570:   const ownerId = stripClientSuffix(registration.id);
MODULES_CLIENT:572:   const id = registration.chunk === void 0 ? ownerId : chunkId(ownerId, registration.chunk);
MODULES_CLIENT:573:   if (this.bootstrapIds.has(id) || this.factories.has(id)) {
MODULES_CLIENT:575:     throw new Error(`client-modules: duplicate factory registration for "${registrationName}" (bundle executed twice without invalidate?)`);
```

`id` = 包名的官方实例（每个官方 bundle 第 1 行）：

```
RT\dsh-client-ui-settings-plugins\lib\client.js:1: window.__ModuleLoader__.load({ id: "@deepseek-ai/dsh-client-ui-settings-plugins", factory: (require) => {
RT\dsh-client-ui-settings\lib\client.js:1    同款
RT\dsh-client-locale\lib\client.js:1         同款
RT\dsh-client-modules\lib\client.js:1        同款
RT\dsh-client-ui-chat\lib\client.js:1        同款
```

`stripClientSuffix`（`MODULES_LIB` 导出/内联）：

```
stripClientSuffix(spec) { return spec.endsWith("/client") ? spec.slice(0, -7) : spec; }
```

插件 banner（`PLUGIN_TSDOWN:30`）：

```ts
banner: 'window.__ModuleLoader__.load({ id: ' + JSON.stringify(PLUGIN_ID) + ', factory: (require) => {',
footer: 'return module.exports; } });',
intro: 'var module = { exports: {} }; var exports = module.exports;',
```

其中 `PLUGIN_TSDOWN:4 const PLUGIN_ID = '@dsh-external/dsh-super-injector'`，与 `PLUGIN_PKG.name` 一致。

### 对插件的影响

- banner/footer/intro 三件套**完全符合契约**：CJS 工厂形态（`factory: (require) => {...}` + `module.exports`）、`codeSplitting: false`、`format: 'cjs'`。
- `id = '@dsh-external/dsh-super-injector'` 不带 `/client` 后缀，`stripClientSuffix` 不改动，与 package.json `name` 一致 ⇒ 只要宿主按包名建行，工厂就能被 materialize。
- **交付前置条件**：`injector/lib/` 当前**不存在**（未构建），而 `PLUGIN_PKG.exports["./client"]` 指向 `./lib/client.js`。宿主 `clientExportOf` 只检查 exports 声明（`MODULES_LIB:718-719`：声明了 `dsh.client` 却没 `./client` 导出会抛 `declares dsh.client but exports no "./client" bundle`），**不检查文件是否存在** → 装一个未构建的包，失败会在浏览器加载 bundle 时以 transport 失败出现（`MODULES_CLIENT:640` 附近 `client-modules: could not load "${id}": ...`）。

---

## Q4. 外部依赖白名单核对

### 结论

client 侧"可 require 的名字" = **平台 seed 表** ∪ **已 materialize 的模块** ∪ **已注册的包工厂**。seed 表由 web shell 注入：

seed word 全集 = `react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`。

逐条核对 `PLUGIN_TSDOWN:6-11` 的 `CLIENT_EXTERNALS`：

| 声明为 external | 是 seed word？ | 会被 bundle 真的 `require` 吗？ | 判定 |
| --- | --- | --- | --- |
| `react` | ✅ | ✅ `PLUGIN_CLIENT:15` | **成立** |
| `react/jsx-runtime` | ✅ | ❌ 无 import | 无害（多余但合法） |
| `react-dom` | ✅ | ❌ 无 import | 无害 |
| `react-dom/client` | ✅ | ❌ 无 import | 无害 |
| `cordis`（裸名） | ❌ | ❌ 无 import | **漂移（潜在雷）** |
| `@deepseek-ai/dsh-client-ui-slots` | ✅ | ❌ 仅 `import type`，被擦除 | **成立** |
| `@deepseek-ai/dsh-client-runtime/client` | ❌ | ❌ 无 import | **漂移（潜在雷）** |

三点关键回答：

- **`cordis` 还是 `@deepseek-ai/cordis`？** → **`@deepseek-ai/cordis`**。裸 `cordis` 不是 seed word。官方每个 client bundle 都 require 带 scope 的形式。
- **`@deepseek-ai/dsh-client-runtime/client` 子路径是否仍存在？** → 在**已发布的 0.1.x 包**里存在（`exports["./client"] → ./lib/client.js`）；但在**本机 runtime 里该包整体不在**（见 Q5），所以此子路径**当前无法解析**。
- **`react` 的实际可解析名？** → 字面 `react`，是 seed word。

### 证据

seed 表（web shell，minified）：

```
SHELL:126: function rM(){return{react:Ef,"react/jsx-runtime":If,"react-dom":Rf,"react-dom/client":Df,"@deepseek-ai/cordis":sf,"@deepseek-ai/dsh-client-store":lh,"@deepseek-ai/dsh-client-ui-slots":hh,"@deepseek-ai/dsh-client-ui-primitives":sE,"@deepseek-ai/dsh-client-ui-dockkit":XS}}
```

同一 shell 文件的 boot 类把 `rM()` 作为 `staticModules` 交给模块系统：

```
SHELL（同文件）: this.modules=o.create({boot:n.__DSH_BOOT__,staticModules:rM(),...})
```

seed 落表：

```
MODULES_CLIENT:548: this.seed = new Map(Object.entries(options.staticModules));
```

`require` 的解析表与失败文案：

```
MODULES_CLIENT:697: makeRequire(ownerId, edges) {
MODULES_CLIENT:698:   const require = (spec) => {
MODULES_CLIENT:699:     edges.add(spec);
MODULES_CLIENT:700:     if (this.seed.has(spec)) return this.seed.get(spec);
MODULES_CLIENT:701:     const id = stripClientSuffix(spec);
MODULES_CLIENT:702:     const record = this.loadCache.get(id);
MODULES_CLIENT:703:     if (record !== void 0) return record.exports;
MODULES_CLIENT:704:     if (this.factories.has(id)) return this.materialize(id).exports;
MODULES_CLIENT:705:     throw new Error(`client-modules: require("${spec}") missed the module table — not a platform seed word, not a materialized module, and no registered package factory (a build-time externals drift, or a dynamic dependency that did not arrive)`);
```

动态 `import` 的对应文案：

```
MODULES_CLIENT:751: throw new Error(`client-modules: cannot resolve "${specifier}" — not a seed word, not a materialized module, and not a row in the boot graph (the runtime mirror of the bundle purity gate)`);
```

官方 client bundle 一律用带 scope 的 cordis：

```
RT\dsh-api-gateway\lib\client.js:7: let _deepseek_ai_cordis = require("@deepseek-ai/cordis");
RT\dsh-client-ui-renderer\lib\client.js:15: 同款
RT\dsh-client-ui-conversation\lib\client.js:32: 同款
RT\dsh-cordis-client-runner\lib\client.js:31: 同款
```

插件 client 源码的全部 import（`grep -n '^\s*(import|export|const .*require\()' PLUGIN_CLIENT`）：

```
PLUGIN_CLIENT:14: import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots'
PLUGIN_CLIENT:15: import { createElement, useEffect, useRef } from 'react'
PLUGIN_CLIENT:21: export const inject = ['slots']
PLUGIN_CLIENT:172: export function apply(ctx: ClientContext): void {
```

→ 唯一会被 emit 的 `require` 是 `react`（第 14 行是 type-only，tsdown/esbuild 擦除）。

### 对插件的影响

- **当前不会抛错**：`cordis` 与 `@deepseek-ai/dsh-client-runtime/client` 只出现在 `neverBundle` 列表里，源码从未 import 它们，打包产物里不会有对应 `require`。白名单是"允许多列"的声明式配置，多列不构成错误。
- **但两处是 latent 雷**：进一步：template 里把 externals 复制给生成的插件（`PLUGIN_HOST:404 const CLIENT_EXTERNALS = [`, `:423 neverBundle: [...CLIENT_EXTERNALS]`, `:424 alwaysBundle: (id: string) => !CLIENT_EXTERNALS.includes(id)`）。一旦生成的 client 源码写了 `import { ... } from 'cordis'` 或 `from '@deepseek-ai/dsh-client-runtime/client'`，宿主立刻在 `MODULES_CLIENT:705` 抛 `missed the module table`，插件页面整体崩掉。正确写法：cordis 用 `@deepseek-ai/cordis`；`dsh-client-runtime/*` 在 0.2.x 下**没有任何替代子路径可 require**，需要它的能力时应改为 require seed word（`@deepseek-ai/dsh-client-store` / `@deepseek-ai/dsh-client-ui-slots` / `@deepseek-ai/dsh-client-ui-primitives`）或改为依赖某个 `dsh-client-*` 包的行（该包会被作为 graph row 加载，可 require 其包名）。
- `react/jsx-runtime` 在"生成 JSX 的插件"里会用得上，保留它是正确的；本插件自身用 `createElement` 所以不触发。

---

## Q5. `dsh.client.inject` 里两个包是否真实存在

### 结论

`PLUGIN_PKG`：

```json
"dsh": { "client": { "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-slots"], "platform": "web" } }
```

- **`@deepseek-ai/dsh-client-ui-slots`**：真实存在（`0.2.0-rc.2`），但它是 **seed word**，不构成 graph row。"写进 inject"是**无效声明**——宿主查不到行，client 侧**静默跳过**。
- **`@deepseek-ai/dsh-client-runtime`**：本机**两套安装树都没有**；profile 树里是一个**悬空 junction**。它在 npm 上**是真实合法包**，但已发布版本**止于 `0.1.1-rc.2`，没有 `0.2.x`**。宿主/client 两侧都查不到它 → **静默跳过**（不报错）。

`dsh.client.inject` 的正确语义（官方惯例）：列**其它 client bundle 的包名**（由宿主建行、按序加载）。本次枚举的 50+ 个官方 `dsh.client` 声明中，`inject` **全部**是 `@deepseek-ai/dsh-client-*` / `@deepseek-ai/dsh-api-*` 包名，**从不**出现 `react` / `cordis` / seed word。`external` 则是 `<pkg>/client` 形式（例：`dsh-api-job-controller` → `external: ["@deepseek-ai/dsh-api-gateway/client"]`）。

### 证据

**（a）seeds 与选并行：** `dsh.client.inject` 名不是 seed word 时，只查 graph row，查不到就跳过：

```
MODULES_CLIENT:643: /** Register each injected package and unresolved dynamic request before its consumer. */
MODULES_CLIENT:650: for (const request of row.external) {
MODULES_CLIENT:651:   const id = stripClientSuffix(request);
MODULES_CLIENT:652:   if (this.seed.has(request) || this.loadCache.has(id)) continue;
MODULES_CLIENT:653:   const dependency = this.graphRows.get(id);
MODULES_CLIENT:654:   if (dependency !== void 0) await this.arriveDependency(row.id, dependency, next, visited);
MODULES_CLIENT:655: }
MODULES_CLIENT:656: for (const packageName of row.inject) {
MODULES_CLIENT:657:   const dependency = this.graphRows.get(packageName);
MODULES_CLIENT:658:   if (dependency !== void 0) await this.arriveDependency(row.id, dependency, [], visited);
MODULES_CLIENT:659: }
```

（`:658` 的 `if (dependency !== void 0)` 就是"静默跳过"。）宿主侧排序同理：

```
MODULES_LIB:415: function orderByModuleGraph(entries) {
MODULES_LIB:426:   for (const name of entry.external ?? []) {
MODULES_LIB:427:     const dependency = rowsById.get(name) ?? rowsById.get(stripClientSuffix(name));
MODULES_LIB:428:     if (dependency === entry) throw new Error(`client-modules: "${entry.id}" requests module "${name}" that it answers itself — a row must not declare its own package in dsh.client.external`);
MODULES_LIB:429:     if (dependency !== void 0) visit(dependency);
```

注意 `orderByModuleGraph` **只看 `external`，不看 `inject`**；且 `entries` 来自实际加载的插件（`MODULES_LIB:398-403` 组装行），声明式 `inject` **不会**凭空建行。

**（b）`@deepseek-ai/dsh-client-runtime` 在本机的存在性：**

- 主 runtime 根**无此包**：`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\` 目录枚举中不存在 `dsh-client-runtime`，也不存在 `dsh-client-web` / `dsh-client-web-react` / `dsh-client-schema-form` / `dsh-host-apiproxy`。
- profile 树里是**悬空 junction**：

```
PROFILE_NM\dsh-client-runtime  ->  D:\WorkSpace\nodejs\node_cache\_npx\1e7f6d9597241db0\node_modules\@deepseek-ai\dsh-client-runtime
```

  `Test-Path` 对 junction 本身返回 True，但其 `package.json` **不可读**；直接对 target 目录做 `Test-Path -PathType Container` 返回 **False**。同一 pattern 的还有 `dsh-client-web`、`dsh-client-web-react`、`dsh-client-schema-form`、`dsh-host-apiproxy`、`dsh-tool-subagent-report`、`node-addon-landlock-run` 共 7 个，**全部悬空**。
- npx 缓存确实不含它们（`NPX_CACHE\node_modules\@deepseek-ai\` 枚举 + `Test-Path` 逐项返回 `False`）。
- npx 安装自己的 `package-lock.json`（`NPX_CACHE\package-lock.json`，346151 字节）里，client 家族**只有** `dsh-client-modules`：

```
NPX_CACHE\package-lock.json:1275: "node_modules/@deepseek-ai/dsh-client-modules": {
```

  `dsh-client-runtime` / `dsh-client-web` / `dsh-client-store` / `dsh-client-ui-slots` / `dsh-client-ui-primitives` / `dsh-client-ui-dockkit` / `dsh-host-apiproxy` 均 `NOT IN LOCK`。
- runtime 树内**没有任何文件**含字面串 `dsh-client-runtime`（对 `*.js` / `*.json` / `*.yaml` / `*.yml` 全文 grep，0 命中）。

**（c）npm registry 上的真实状态**（`https://registry.npmjs.org/@deepseek-ai%2Fdsh-client-runtime`，HTTP 200）：

```
"dist-tags": { "latest": "0.0.1-rc.1", "next": "0.1.1-rc.2" }
versions（全部）：0.0.1-rc.1, 0.0.1-rc.2, 0.0.1-rc.3, 0.0.1-rc.5,
                  0.1.0-rc.2, 0.1.0-rc.3, 0.1.0-rc.6, 0.1.0-rc.7, 0.1.0-rc.8,
                  0.1.1-rc.1, 0.1.1-rc.2
time.modified: 2026-08-21T12:38:03.816Z
description: "Client core services: SlotRegistry, SessionRuntime (scope tree + object layer)"
exports: { ".": {...}, "./invariant": {...}, "./client": {"types":"./lib/types/client/index.d.ts","default":"./lib/client.js"}, "./src/*": ..., "./package.json": ... }
"dsh": { "client": { "inject": ["@deepseek-ai/dsh-client-connection","@deepseek-ai/dsh-typert-registry","@deepseek-ai/dsh-api-remotes"], "platform": "web", "immediately": true } }
0.1.1-rc.2 peerDependencies: @deepseek-ai/cordis ^4.0.1, ...（无 react peer）
0.1.1-rc.2 dependencies: immer ^10.1.1, zustand ~4.4.7
```

→ **没有任何 `0.2.x` 版本**。而本机 runtime 是 `0.2.0-rc.2`。在 0.2.x 线里，`slots` 服务已改由 `dsh-client-ui-renderer` 提供（`RENDERER_LIB:1323 super(ctx, "slots");`），`@deepseek-ai/dsh-client-runtime` 不再随发行。

**（d）`dsh.client` 字段的合法性由 `parseDshClient` 强制**（`MODULES_LIB:63-72`）：`platform` 必须是字符串，`inject` / `external` 必须是字符串数组，`immediately` 是布尔。声明了 `dsh.client` 但 `platform !== "web"` 会被忽略（`MODULES_LIB:713-717`）；`platform === "web"` 却无 `./client` 导出会抛错（`MODULES_LIB:718-719`）。

### 对插件的影响

1. **不会硬失败**：声明里两个名字都查不到 graph row，client 侧 `MODULES_CLIENT:658` 静默跳过，页面不会因此报错。这是一种"**声明与运行时脱节的静默漂移**"，代价是丢失加载顺序保证与自检能力。
2. **悬空 junction 的实际后果（宿主侧更严重）**：profile 树里那 7 个 junction 的 target 不存在 ⇒ 任何从 profile 路径解析这些包的代码都会 `MODULE_NOT_FOUND`。对本插件的 client half 而言，因为 `dsh-client-runtime` 从未被 require，不构成直接故障；但它意味着**任何以 `@deepseek-ai/dsh-client-runtime` 为 peerDependency 的第三方插件**（生态里大量存在：`dsh-lazeword` `>=0.1.0-rc.0 <0.2.0`、`@xmoon76/dsh-profile-settings` `^0.1.1-rc.2`、`dsh-model-picker` `*`、`@steven-wu/dsh-cost-meter`、`@sanqi-normal/dsh-webui-market-plugin` 等）在此 profile 下都无法满足 peer —— 这正是 `docs/compat/raw` 里同类审计要交叉引用的环境事实。
3. **`external` 字段整块缺失**：插件把模块依赖写进了 `inject`，`dsh.client.external` 完全没写。按 `MODULES_LIB:405-409` 的文档语义，seed word（`react` 等）应该（如果非要声明）放在 `external`（"a static-table name that adds no graph edge"），而 `inject` 应只留**真实存在、需要前置加载的 client 包**。建议把 `inject` 改为 `["@deepseek-ai/dsh-client-ui-settings"]`（官方 settings 页插件惯例），或直接**清空** `inject`。
4. **`platform: "web"` 正确**；缺 `immediately`（可选，默认为 false）。本插件注册的是按需出现的 settings 页，不需要 `immediately`。

---

## Q6. client 侧是否也要求 `export const inject = ['slots']`

### 结论

**要求，且官方一致。** 注意与 `package.json` 的 `dsh.client.inject` 是**两套不同的东西**：

| 位置 | 形式 | 语义 |
| --- | --- | --- |
| `package.json` → `dsh.client.inject` | 包名字符串数组 | **模块依赖**：先加载这些 client bundle |
| client bundle 内 `export const inject = [...]` | cordis **服务名**数组 | **服务依赖**：声明我要用 `ctx.<service>` |

`slots` 是服务名，只能出现在 bundle 内的 `export const inject` 里；`@deepseek-ai/dsh-client-ui-slots` 是包名，只能出现在 package.json。**插件目前把两者搞混了方向**（见 Q5），但 bundle 内的 `export const inject = ['slots']` 是**正确**的。

未声明的服务访问会被运行时守卫拒绝。

### 证据

官方 client bundle 的导出范式：

```
RT\dsh-client-ui-settings-plugins\lib\client.js:162: const inject = ["slots", "locale"];
RT\dsh-client-ui-settings-plugins\lib\client.js:216: exports.inject = inject;
RT\dsh-client-ui-settings-general\lib\client.js:972: const inject = [
RT\dsh-client-ui-settings-general\lib\client.js:1216: exports.inject = inject;
RT\dsh-client-ui-jobs\lib\client.js:596 / :625            同款
RT\dsh-client-locale\lib\client.js:1491 / :1568          同款
RT\dsh-client-ui-chat\lib\client.js:12258 / :12509       同款
```

`slots` 服务的提供者与 `inject` 声明无冲突：

```
RENDERER_LIB:1323: super(ctx, "slots");
RT\dsh-client-ui-renderer\package.json → "dsh": {"client": {"platform":"web","immediately":true}}   ← 只提供者，不 inject
```

运行时守卫（未声明就访问服务 → 拒绝）：

```
RUNNER_LIB:323-338（区域）:
  const declared = new Set(Object.keys(ctx.fiber.inject));
  ...
RUNNER_LIB:331: if (ctx.get(prop) !== void 0) return rejectGuard(env, `service "${prop}" is not declared by your plugin. Declare it on the plugin you return: { inject: ['${prop}', …], apply(ctx) { … } } ...`)
RUNNER_LIB:338: if (name === "slots") return guardedSlots(service, env);
```

服务未声明时的另一半守卫在 `guardedSlots`（`RUNNER_LIB:250-275`），它用 Proxy 包住 `slots.register` 并读 `slots.spec(slot)`：

```
RUNNER_LIB:258: slots.register(options, component) needs an options object with a `name`
```

（再次印证双参 + `name` 必填。）

client half 忘记 `return` 时的错误文案（`RUNNER_LIB:183`）：

```
client half returned `undefined` — did you forget `return`?
  ✓ return (ctx) => { … }
  ✓ return { name: '…', inject: ['slots'], apply(ctx) { … } }
```

### 对插件的影响

- `PLUGIN_CLIENT:21 export const inject = ['slots']` **成立**；`apply` 内 `ctx.slots` 的访问因此不会被守卫拒绝。
- 插件 client half 用的是 `export function apply(ctx)` + `export const inject` 两段式（而非返回对象/函数），这在 `RUNNER_LIB:183` 的两种推荐形态之外，但官方包普遍如此（`exports.apply` / `exports.inject`，如 `SETTINGS_GENERAL:1216`），所以**没问题**。
- **需要留意的一点**：`PLUGIN_CLIENT:172 export function apply(ctx: ClientContext)` 里调了 `ctx.effect(...)`（第 173 行），但 `export const inject` **只声明了 `slots`**。`effect` 是 cordis context 自带能力（非服务），不需要声明，所以此处成立；但若 `ctx.effect` 在同一守卫体系下也需要声明，则应写成 `inject = ['slots']`（不变）——本次未发现对 `effect` 的服务级守卫，判定为非问题。

---

## 附 A. 与插件当前代码的逐点对照（便于直接开工）

| 位置 | 现状 | 判定 | 建议 |
| --- | --- | --- | --- |
| `PLUGIN_CLIENT:14` `import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots'` | type-only | 无害但**本机不可解析**（包无 `lib/types/`） | 可自备最小接口类型，或改从 `dsh-client-ui-runtime` 类型来源；不影响运行时 |
| `PLUGIN_CLIENT:15` `import { createElement, useEffect, useRef } from 'react'` | seed word | **成立** | 保持 |
| `PLUGIN_CLIENT:21` `export const inject = ['slots']` | 服务依赖 | **成立且必需** | 保持 |
| `PLUGIN_CLIENT:172-180` `slots.inject('settings.section', () => slots.register({...}, () => createElement(InjectorPage)))` | 双参 + React 元素 | **成立** | 保持 |
| `PLUGIN_TSDOWN:6-11` `CLIENT_EXTERNALS` 含 `cordis` / `@deepseek-ai/dsh-client-runtime/client` | 未使用 | **latent 漂移** | 改为 `@deepseek-ai/cordis`；删除 `@deepseek-ai/dsh-client-runtime/client` |
| `PLUGIN_TSDOWN:30-32` banner/footer/intro | CJS 工厂 | **成立** | 保持 |
| `PLUGIN_PKG` `dsh.client.inject: ["@deepseek-ai/dsh-client-runtime","@deepseek-ai/dsh-client-ui-slots"]` | 两个名字都无 graph 行 | **无效声明**（静默跳过） | 清空，或换成 `["@deepseek-ai/dsh-client-ui-settings"]`；如需声明 seed word 应改用 `dsh.client.external` |
| `PLUGIN_HOST:363-397` `SCAFFOLD_UI_CLIENT`（`component:` 在 `:384`） | `register({..., component: () => ({render(){...}})})` | **漂移（已废形态）** | 模板改为 `inject(name, () => register({name,id,order,label}, () => createElement(...)))` |
| `PLUGIN_HOST:399`+ `SCAFFOLD_TSDOWN`（`CLIENT_EXTERNALS` 在 `:404`，`neverBundle` 在 `:423`） | 复制同一份 externals | 随 `CLIENT_EXTERNALS` 一并修 | 同步 `@deepseek-ai/cordis` |
| `PLUGIN_HOST:2890` `KNOWN_SLOTS` 校验白名单含 `settings.plugin.item` | 该槽名在 `0.2.0-rc.2` **0 命中**（全树 1514 个 `.js` 扫描） | **漂移（死槽名）** | 从白名单删除 `settings.plugin.item`，保留 `settings.plugins.tab` / `settings.section` / `settings.general.item` / `conversation.view` |
| `injector/lib/` | **不存在**（未构建） | 交付前置条件 | 发布前 `tsdown`；`exports["./client"]` 已指向 `./lib/client.js` |

## 附 B. UNVERIFIED（卡点说明）

1. **`SHELL` 的文件名**（`dist\assets\index-5SrrfWpU.js`）是构建产物哈希。**seed 表的"内容"已确证**；若 web shell 重新构建，文件名会变，需按 `function rM()` 或 `staticModules` 重新定位。未验证存在第二个同样注入 seed 的 shell bundle。
2. **seed 表里 React 的具体大版本**：`SHELL:126` 的 `Ef/If/Rf/Df` 是 minify 后的别名，未回溯到 `react` 包的 `version` 字段，因此 **`react` 的 major 版本 UNVERIFIED**。旁证：仓库内 `@deepseek-ai/dsh-client-runtime` 的 0.1.x 发布元数据一律固定 `react ^18.2.0`；插件 peerDependencies 亦为 18.x。这对本插件无影响（只用 `createElement`/`useRef`/`useEffect`）。
3. **悬空 junction 的成因**（哪一个 `dsh plugin add` / profile 同步步骤写入了这 7 条指向 `NPX_CACHE` 的链接）**UNVERIFIED**——只确证了"目标不存在"这一事实。未尝试修复链接（任务要求只读）。
4. **是否会发布 `0.2.x` 的 `@deepseek-ai/dsh-client-runtime`** UNVERIFIED；registry 快照只到 `0.1.1-rc.2`（`time.modified` 2026-08-21），本机 `0.2.0-rc.2` 树中无此包。
5. 官方槽名清单为**本次枚举所得**（`grep` 到的 `children` 声明 + 消费点），**非官方完整 SlotMap 导出**；`settings.*` 系列之外的槽（如 `sidebar.*`、`conversation.composer.*`）未做穷举。
