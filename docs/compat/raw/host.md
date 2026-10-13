# 静态契约审计 — DSH 运行时 host 侧契约（对照第三方插件 dsh-super-injector）

- 审计类型：**只读**（未修改任何已存在文件，未安装任何包）
- 权威 runtime 根：`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\`
- 版本（本机实测）：dsh-tools 0.2.0-rc.2 · dsh-system-prompt 0.2.0-rc.2 · dsh-host-webserver 0.2.0-rc.2 · dsh-package-manifest 0.2.0-rc.2 · schemastery 3.18.4 · cordis 4.0.4
- 被审计插件：`D:\WorkSpace\AgentWorks\DSH\dsh-routing-suite-xsc\injector\src\index.ts`（3323 行）
- 重要方法学提示：**安装包不发布 `.d.ts`**（全仓 `@deepseek-ai` 下 0 个 `.d.ts`，`lib/types/*` 只有 `.d.ts.map`，无 `.d.ts`）。因此本审计以 `lib/*.js` 为权威证据；类型形状取自随包发布的类型目录 JS（`dsh-tool-cordis/lib/types/api-catalog.js`，运行时可读的同一份声明文本）。凡无该声明的项标 `UNVERIFIED`。

---

## Q1. `@deepseek-ai/dsh-tools` 是否仍导出 `defineTool`？参数形状？

**结论：成立（完全兼容）。插件当前写法逐字段合法。**

证据：

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tools\lib\index.js:3714`

```js
export { CodeRunFailedError, JsonSchemaError, RUN_CODE_NAME, TOOL_ABORTED, TOOL_ABORTED_BEFORE_DISPATCH, TOOL_RUNTIME_SCHEDULER, ToolArgsError, ToolNotFoundError, ToolOutputError, ToolRuntime, ToolRuntime as default, assertObjectJsonSchema, assertSupportedJsonSchema, defineContentToolFixture, defineTool, jsonSchemaToPy, jsonSchemaToTs, parameterSchemaSpecToJsonSchema, renderToolsSdk, renderToolsSdkPy, validateArgs, validateJsonSchemaValue, valueSchemaSpecToJsonSchema };
```

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tools\lib\index.js:838-871`

```js
function defineTool(options) {
	const userExecute = options.execute;
	const userFinalizeContent = options.finalizeContent;
	const userProjectContent = options.projectContent;
	const userRender = options.output.render;
	const userPresentationMeta = options.output.presentationMeta;
	...
	if (options.timeoutMs !== void 0 && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) throw new Error(`defineTool(${options.name}): timeoutMs must be a positive finite number`);
	const parameters = parameterSchemaSpecToJsonSchema(options.parameters);
	const outputSchema = valueSchemaSpecToJsonSchema(options.output.schema);
	const validate = (args) => validateJsonSchemaValue(parameters, args, "");
	const tool = {
		name: options.name,
		description: options.description,
		parameters,
		output: { schema: outputSchema, render(args, value) { return userRender(args, value); }, ... },
		...options.deferLoading === true ? { deferLoading: options.deferLoading } : {},
		...options.timeoutMs !== void 0 ? { timeoutMs: options.timeoutMs } : {},
		async execute(args, exec) {
			const violations = validate(args);
			if (violations.length > 0) throw new ToolArgsError(violations);
			return userExecute(args, exec);
		}
	};
```

字段级核对（**参数形状**）：`parameters` 不是 JSON Schema，而是 dsh-tools 自己的 **author schema 属性表**：

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tools\lib\types\schema.js:4` / `:78-82` / `:126`

```js
const ANNOTATION_KEYS = ['description', 'title', 'default', 'examples'];
...
if (Object.hasOwn(task.property, 'required') && task.property.required !== true) authorError(`${task.path}.required must be true when present`);
if (Object.hasOwn(task.property, 'required') && task.property.required === true) task.required.push(task.key);
...
const authorKeys = [...ANNOTATION_KEYS, ...(task.allowRequired ? ['required'] : [])];
```

即插件写的 `{ type:'string', required:true, description:'…' }` 正是允许的键集（`type` / `oneOf` / `description` / `title` / `default` / `examples` / `required`，其中 `required` 只允许字面 `true`），无需改用别的 schema。

**输出形状**（`output.schema` / `output.render` 仍成立）：

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tool-cordis\lib\types\api-catalog.js:7588`

```js
declaration: 'export interface ToolOutputDefinition {\n    readonly schema: JsonSchemaNode;\n    render(args: unknown, value: JsonValue): ContentBlock[];\n    presentationMeta?(args: unknown, value: JsonValue): JsonValue;\n}'
```

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tool-cordis\lib\types\api-catalog.js:7531`

```js
declaration: 'export interface ToolDefinition extends ToolSchema {\n    readonly output: ToolOutputDefinition;\n    execute(args: unknown, exec: ToolRunContext): Promise<unknown>;\n    projectContent?(...): ContentBlock[] | undefined;\n    finalizeContent?(...): ContentBlock[] | undefined;\n    timeoutMs?: number;\n    isConcurrencySafe?(args: unknown): boolean;\n    presentCall?(args: unknown): ToolCallView | undefined;\n    presentResult?(args: unknown, result: ToolResult): ToolResultView | undefined;\n}'
```

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tool-cordis\lib\types\api-catalog.js:7631`

```js
declaration: 'export interface ToolSchema {\n    deferLoading?: true;\n    name: string;\n    description: string;\n    parameters: Record<string, unknown>;\n}'
```

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tool-cordis\lib\types\api-catalog.js:7619`

```js
declaration: 'export interface ToolRunContext extends ToolExecution {\n    deferContext(context: UserMessage): void;\n    concludeTurn(): void;\n}'
```

`ContentBlock` 的 `text` 成员（插件 render 返回 `[{type:'text', text:String(value)}]`）：

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tool-cordis\lib\types\api-catalog.js:4787-4792`

```js
declaration: 'export interface ContentBlockMap {\n    \'text\': TextBlock;\n    \'reasoning\': ReasoningBlock;\n    \'image\': ImageBlock;\n    \'file\': FileBlock;\n    \'tool-call\': ToolCallBlock;\n    \'tool-addition\': ToolAdditionBlock;\n    \'tool-removal\': ToolRemovalBlock;\n}'
declaration: 'export type ContentBlockType = keyof ContentBlockMap;'
```

（`TextBlock` 自身的字段声明未出现在 api-catalog 中 → 其精确形状 **UNVERIFIED**；但 `type:'text'` 是合法 `ContentBlockType`，且全生态同写法，风险低。）

插件侧实际用法：`injector\src\index.ts:1491`（`safeRegister(defineTool({`）、`:2398`、`:1522`、`:1543`、`:1553`、`:1583`、`:2436`、`:2452`、`:2470`、`:2500`、`:2527`、`:2566`、`:2583`、`:2645`、`:2663`、`:2827`、`:2905`、`:2973`、`:3017`；`execute(args){…}` 单参形式与 `execute(args, exec)` 双向兼容（少声明一个参数不影响调用）。

**对插件的影响：无。** 无需改动。

---

## Q2. `ctx.tools.register(tool)` 是否存在？是否必须挂 `ctx.effect(...)`？

**结论：成立（存在 + 返回精确 disposer，且 `register()` 自身已把注册挂在 fiber effect 上 → 挂 `ctx.effect` 是「显式+幂等」的加强，不是硬性要求）。**

证据 —— 服务名与注册方法：

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tools\lib\index.js:2704`

```js
super(ctx, "tools");
```

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tools\lib\index.js:2878-2887`

```js
	register(definition) {
		const name = definition.name;
		const output = definition.output;
		if (output === void 0 || typeof output !== "object" || typeof output.render !== "function" || output.presentationMeta !== void 0 && typeof output.presentationMeta !== "function") throw new TypeError(`tool "${name}" must declare output { schema, render, presentationMeta? }`);
		assertSupportedJsonSchema(output.schema);
		const timeoutMs = definition.timeoutMs;
		if (timeoutMs !== void 0 && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) throw new TypeError(`tool "${name}" timeoutMs must be a positive finite number`);
		if (name === "run_code") throw new Error(`tool name "${RUN_CODE_NAME}" is reserved for the PTC mode presentation transport and cannot be registered or shadowed`);
		return this.layers.effect(this.ctx, (layer) => layer.tools.insert(name, definition), { label: "tools.register()" });
	}
```

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tool-cordis\lib\types\api-catalog.js:7624`

```js
declaration: 'export class ToolRuntime extends Service {\n ... register(definition: ToolDefinition): () => void;\n    restrict(filter: ToolRestriction): () => void;\n ...'
```

关键机制：`this.layers.effect(this.ctx, ...)` —— 注册生命周期已绑定到**当前 `this.ctx` 所在的 fiber**；`dispose()` 即注销。插件的 `ctx.effect(() => ctx.tools.register(tool), label)` 会拿到该 disposer 并在 fiber dispose 时再调用一次（`NamedEntries.insert` 的 undo 是幂等的：`dsh-scope\lib\index.js:32-37`）。唯一硬约束：**同名重复注册会抛**（`dsh-tools\lib\index.js:2634` → `tool "<name>" is already registered (for a per-agent variant, register through that agent's \`agent.ctx\` instead)`）。

**对插件的影响：无（成立）。** 插件注释「必须挂 ctx.effect」在语义上偏保守——真正的僵尸残留成因是**没保存 disposer 的裸注册**（裸注册仍会被 fiber effect 清理），但保留 `ctx.effect` 包裹纯属安全冗余，可继续。

**⚠️ 同类越界（超出本题范围但同属 tools 契约）：** `injector\src\index.ts:2370-2394` `purgeStaleTools()` 走 `ctx.get('tools')` 并读内部层：

```ts
const toolsSvc = ctx.get('tools') as { layers?: { global?: { tools?: Map<string, unknown> } }; unregister?: (name: string) => unknown } | undefined
...
const table = toolsSvc.layers?.global?.tools
if (table && typeof table.keys === 'function') { for (const name of table.keys()) { ... } }
for (const name of names) {
  try { if (typeof toolsSvc.unregister === 'function') toolsSvc.unregister(name); else if (table) Map.prototype.delete.call(table, name) } catch { }
}
```

实测：`this.layers = new ScopedLayers(...)`（`dsh-tools\lib\index.js:2690`），`ScopedLayers.global` 存在（`dsh-scope\lib\index.js:141 this.global = createLayer(void 0);`），`layer.tools` 是 `NamedEntries`（`dsh-tools\lib\index.js:2634`），`NamedEntries.data` 是私有 `Map`（`dsh-scope\lib\index.js:15-17`）。**`ToolRuntime` 没有 `unregister`**（见上 `api-catalog.js:7624` 全量方法表），所以该分支永远走 `Map.prototype.delete.call(table, name)` —— 直接改内部 Map，绕过 `NamedEntries` 的幂等 undo 与层机制。当前**行为上有效**（`table.keys()` 是 `NamedEntries.keys()`，`dsh-scope\lib\index.js:59-61`），但属于**非契约内部依赖**，DSH 一旦给 `NamedEntries` 加代理/改为非 Map，此清理静默失效（`catch {}` 吞掉）。

---

## Q3. `@deepseek-ai/dsh-system-prompt` 的 `system-prompt/assemble` 事件

**结论：事件成立、是 Waterfall（必须 `await next()`）、返回对象确有 `tools` 字段；但 `context` 的公开类型只有 `{scope?, signal?}` —— `context.agent` 是运行期额外字段（漂移/未文档化）；`agent.session.events` 在运行时**不存在**（漂移）。**

### 3.1 事件与 Waterfall

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tool-cordis\lib\types\api-catalog.js:4196-4198`

```js
name: 'system-prompt/assemble',
signature: '\'system-prompt/assemble\'(this: Scoped<SystemPrompt>, assembly: PromptAssembly, context: AssembleContext, next: () => Promise<PromptAssembly>): Promise<PromptAssembly>',
```

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-system-prompt\lib\index.js:355`

```js
const transformed = await this.ctx.waterfall(scopeTarget(this, scope), "system-prompt/assemble", assembly, context, () => Promise.resolve(assembly));
```

→ 是 `ctx.waterfall`（cordis 的 Waterfall 语义，注册用 `ctx.on`），**必须 `await next()`**：同仓 peer 监听器一致写法（`dsh-agent\lib\index.js:167` `agentCtx.on("system-prompt/assemble", async (_assembly, _context, next) => {...})`；`dsh-agent-preset-registry\lib\invariant.js:823`；`dsh-session-reference\lib\index.js:457`；`dsh-system-prompt\lib\invariant.js:33`）。

### 3.2 返回对象有 `tools`

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tool-cordis\lib\types\api-catalog.js:5995`

```js
declaration: 'export interface PromptAssembly {\n    sections: AssembledSection[];\n    contexts: AssembledContext[];\n    tools: ToolSchema[];\n    variables: Record<string, string | undefined>;\n}'
```

`ToolSchema = { deferLoading?: true; name: string; description: string; parameters: Record<string, unknown> }`（`api-catalog.js:7631`）。

→ 插件 `assembled.tools.filter(...)` 成立（按 `name` 过滤合法）。

### 3.3 `context.agent` —— 运行期成立，类型面漂移

公开类型：

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tool-cordis\lib\types\api-catalog.js:4511-4512`

```js
name: 'AssembleContext',
declaration: 'export interface AssembleContext {\n    scope?: ScopeKey;\n    signal?: AbortSignal;\n}',
```

但**真实调用点**传入的对象里带 `agent`：

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-agent\lib\index.js:291-297`

```js
function assembleContextFor(agent, signal) {
	return {
		agent,
		scope: agent,
		...signal === void 0 ? {} : { signal }
	};
}
```

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-agent-loop\lib\index.js:907`

```js
const assembly = await this.loopCtx.systemPrompt.assemble(assembleContextFor(this, signal));
```

→ **运行期 `context.agent` 可读（成立）**；但这是「实现比类型宽」的**非公开契约**：`AssembleContext` 未声明 `agent`，`scope`/`agent` 目前同值。插件若用 TS 严格编译会报错不得不写 `any`，且后续有被收回的风险。

### 3.4 `agent.session.events` —— **缺失（不存在）**

- `Session` 类公开的读事件 API 只有 `snapshotEvents(fromSeq = SessionLogOffset(0), toSeqExclusive = this.seq)` 与 `eventAt(seq)`，**两者均已 `@deprecated`**：`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-session\lib\index.js:1356-1382`

```js
	/**
	* Return the immutable event stored at one exact sequence number.
	* @deprecated Existing logic may remain unmigrated for now, but new calls are prohibited.
	* See the [Agent Note](../../../../.agents/notes/implemented/architecture/2026-09-09-deprecate-synchronous-session-event-reads.md).
	*/
	eventAt(seq) { return this.log[seq]; }
	...
	/** @deprecated ... new calls are prohibited. ... */
	snapshotEvents(fromSeq = SessionLogOffset(0), toSeqExclusive = this.seq) { ... }
```

- 全 `@deepseek-ai` 运行时代码里 **0 处** `session.events`（grep `\.session\.events\b|session\.events\b` 无匹配）；`dsh-session\lib\types\index.js` 中也没有 `events` getter/字段（唯一相邻的是缓存字段 `eventsSnapshot`，`dsh-session\lib\index.js:1354-1355`）。
- `tool/call` 事件类型本身**存在**：`SessionEventMap` 含 `'tool/call': { turn: number; step: number; callId: ToolCallId; name: string; arguments: string; }`（`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-api-terminal-controller\lib\typert.host.js:1070` 声明文本；同类见 `dsh-session\lib\types\known-event-types.js:72` 列表项 `'tool/call'`），生产点为 `dsh-agent-loop\lib\index.js:682 return session.append("tool/call", {...})`。

插件侧用法（当前是**注释模板**，但会被 `dev_scaffold_plugin` 写入新插件源码）：

`injector\src\index.ts:189-197`

```ts
  // 机制：system-prompt/assemble 是 Waterfall（必须 await next() 再裁剪）；
  ...
  // ctx.on('system-prompt/assemble', async (_assembly: unknown, context: any, next: () => Promise<any>) => {
  //   ...
  //   if (!agent || agent.session.events.some((e: any) => e.type === 'tool/call')) return assembled
```

**对插件的影响：**
1. `assemble` 的 `await next()` + 返回 `{...assembled, tools: assembled.tools.filter(...)}` —— **成立，保持**。
2. `context.agent` —— **运行期可用但类型面未声明**，建议收敛为 `(context as { agent?: Agent }).agent`，或改走 `scope`/`agent/request` 等公开面。
3. `agent.session.events` —— **不存在**，模板一旦启用即 `TypeError: Cannot read properties of undefined (reading 'some')`（除非某处 monkey-patch）。等价公开替代：`agent.session.snapshotEvents()`（**已弃用**）或用事件投影（`dsh-session-projection` / `ctx.on('session/event')`）。“哪些工具被调用过”的官方读法应由 `dsh-session-query` / `dsh-session-stats` 侧投影提供（`dsh-session-stats\lib\index.js:127 case "tool/call": return {`），建议优先接入投影而非读裸日志。

---

## Q4. `@deepseek-ai/dsh-host-webserver` 服务 API

**结论：`ctx.webServer.register({kind, path, handler})` 成立。`kind` 的**有效**取值是 `'exact'` 与 `'prefix'`（非 `'exact'` 一律落入 prefix 表，**不校验、不抛错**）。`exact` / `prefixes` / `upgrades` 三张内部表**确实仍是 Map**，但它们是内部实现（`register()` 返回 disposer 才是契约）；存在官方替代。另：`register({kind:'upgrades'})` 语义错误——升级路由的正规入口是 `registerUpgrade({path, handler})`。**

服务名与表结构：`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-host-webserver\lib\index.js:139-158`

```js
var WebServer = class extends Service {
	config;
	static Config = z.object({
		host: z.union([z.const("127.0.0.1"), z.const("0.0.0.0")]).required(),
		port: z.natural().max(65535).required(),
		compression: ...,
		compressionLevel: ...,
		compressionThresholdBytes: ...
	});
	exact = /* @__PURE__ */ new Map();
	prefixes = /* @__PURE__ */ new Map();
	upgrades = /* @__PURE__ */ new Map();
	upgradedSockets = /* @__PURE__ */ new Set();
	indexTaps = [];
	fallback;
	server;
	listenedPort;
	gzip;
	constructor(ctx, config) { super(ctx, "webServer"); this.config = config; ... }
```

注册：

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-host-webserver\lib\index.js:172-197`

```js
	/**
	* Register a named route. Duplicate (kind, path) throws — ...
	* @returns the disposer removing the route.
	*/
	register(route) {
		const table = route.kind === "exact" ? this.exact : this.prefixes;
		if (table.has(route.path)) throw new Error(`webserver: duplicate ${route.kind} route "${route.path}"`);
		table.set(route.path, route);
		return () => { table.delete(route.path); };
	}
	registerUpgrade(route) {
		if (this.upgrades.has(route.path)) throw new Error(`webserver: duplicate upgrade route "${route.path}"`);
		this.upgrades.set(route.path, route);
		return () => { this.upgrades.delete(route.path); };
	}
```

匹配与其余 API：`match(pathname)`（最长前缀胜出）`index.js:322-332`；`registerFallback(handler)` `index.js:206-212`；`tapIndex(transform)` `index.js:220-226`；另有 `collectIndexInjections()` / `renderIndex(html)` `index.js:350-363`。`register()` 未挂 `ctx.effect`，**必须自己保存 disposer**（该服务只在 `[Service.init]` 里为自己的 listen 用了 `this.ctx.effect(...)`，`index.js:306`）。

插件侧用法：

`injector\src\index.ts:337-345`

```ts
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/${pkgName}/api',
    handler: async (req: any, res: any) => { ... },
  }), '${pkgName}: api')
```

`injector\src\index.ts:3281-3283`：`ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/super-injector/api', handler: ... }), 'super-injector: plugin-manager-api')`

`injector\src\index.ts:624-639`（直接清内部表）

```ts
  /** 按包名匹配清理 webserver 路由残留（强制登记守卫的自愈部分）。 */
  function clearRoutesByMatch(match: string): string[] {
    const hs = ctx.webServer
    const cleaned: string[] = []
    for (const tableName of ['exact', 'prefixes', 'upgrades'] as const) {
      const table = hs?.[tableName]
      if (!table || typeof table.delete !== 'function') continue
      for (const k of [...table.keys()]) {
        if (String(k).includes(match)) { table.delete(k); cleaned.push(`${tableName}[${k}]`) }
      }
    }
    return cleaned
  }
```

**对插件的影响：**
- `kind:'prefix'` + `path` + `handler(req,res)` —— **成立**（handler 拥有完整响应生命周期；`match()` 语义是 `pathname === prefix || pathname.startsWith(prefix + '/')`，插件内部再自剥前缀，行为正确）。
- `clearRoutesByMatch` 直接删三张表：**当前有效**（都是真实 Map），但属**内部实现依赖**，且**绕过 disposer**：被删路由的持有 fiber 之后 dispose 时 disposer 再删一次（幂等，无害），真正风险是「表结构改名/改为非 Map」→ 清理静默失效 → duplicate route 抛异常而不是被自愈。
- 官方替代存在：保存 `register()`/`registerUpgrade()` 返回的 disposer 并挂 `ctx.effect`（DSH 自身与所有官方插件的做法）。**升级/WS 路由必须用 `registerUpgrade`，不能用 `register({kind:'upgrades'})`** —— 后者会静默写进 `prefixes` 表并在 HTTP 上生效，导致该 path 的 upgrade 握手永远拿不到 owner（`upgrades` 表空）而 `socket.destroy()`（`index.js:280-283`）。

---

## Q5. `@deepseek-ai/dsh-package-manifest`：`DshBundleManifest` / `DshClientManifest` 完整字段

**结论：接口源文件未随安装包发布 → 精确字段定义 `UNVERIFIED`；但「合法用法」= 成立（由 README + 运行时校验双重确证）：`dsh.bundle.patch` 接受**字符串或字符串数组**；`dsh.client.inject` 是**字符串数组**（依赖边，语义为信息性/初始化次序）；`dsh.client.platform` 必须是字符串，实际生效值只有 `'web'`。**

### 5.1 包内容（缺 types 的硬证据）

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-package-manifest\lib\index.js` 全文 1 行：

```js
export {};
```

该包目录下**只有** `lib/index.js`、`LICENSE`、`package.json`、`README.i18n.yaml`、`README.zh.md`（无 `lib/types/`）。`package.json` 声明 `"types": "lib/types/index.d.ts"`（`dsh-package-manifest\package.json`）。全 `@deepseek-ai` 树中 grep `DshBundleManifest|DshClientManifest` → **0 命中**。

### 5.2 `dsh.bundle.patch` 接受数组（运行时强制）

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-app-boot\lib\index.js:488-499`

```js
/**
* The patch files a bundle declares, as written: one file for a string
* `patch`, the listed files in order for an array.
* ...
* @throws {Error} when `patch` is neither a string nor a list of strings.
*/
function bundlePatchFiles(bundle) {
	const declared = typeof bundle.patch === "string" ? [bundle.patch] : bundle.patch;
	if (!Array.isArray(declared) || !declared.every((file) => typeof file === "string")) throw new Error("dsh.bundle.patch must be a file path or a list of file paths");
	return declared;
}
```

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-package-manifest\README.zh.md`：「`DshBundleManifest.patch` 是一个 patch 文件路径，或一个有序的路径列表，均相对于包根目录；launcher 按列表顺序把它们作为同一个组合包层应用。」

### 5.3 `dsh.client.*` 运行时校验

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-client-modules\lib\index.js:47-75`

```js
function optionalStringArray(subject, field, value) {
	if (value === void 0) return void 0;
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`client-modules: ${subject} ${field} must be a string array`);
	return value;
}
...
function parseDshClient(pkgName, value) {
	if (value === void 0) return void 0;
	if (typeof value !== "object" || value === null) throw new Error(`client-modules: ${pkgName} has a non-object dsh.client declaration`);
	const decl = value;
	if (typeof decl.platform !== "string") throw new Error(`client-modules: ${pkgName} dsh.client.platform must be a string`);
	const inject = optionalStringArray(pkgName, "dsh.client.inject", decl.inject);
	const external = optionalStringArray(pkgName, "dsh.client.external", decl.external);
	if (decl.immediately !== void 0 && typeof decl.immediately !== "boolean") throw new Error(`client-modules: ${pkgName} dsh.client.immediately must be a boolean`);
	return { platform: decl.platform, ...(inject !== void 0 ? { inject } : {}), ...(external !== void 0 ? { external } : {}), ...(decl.immediately !== void 0 ? { immediately: decl.immediately } : {}) };
}
```

- `platform`：必需，仅要求字符串；但**只有 `'web'` 会被真正纳入 boot 图**：`dsh-client-modules\lib\index.js:714 if (decl === void 0 || decl.platform !== "web") {` → 其他值=该包被跳过。
- `inject` 语义（`dsh.client.inject`）：字符串数组 = 声明式依赖边。`dsh-client-ui-workspace\lib\client.js:4103` 注释：「`dsh.client.inject` edges are informational」；`parseDshClient` 把它并入 boot 行并按模块图顺序排布 → 语义为「加载次序/初始化前置依赖声明」，不是强校验约束。
- 额外（插件未用，但同属该声明）：`dsh.client.external`（string[]）、`dsh.client.immediately`（boolean）。

### 5.4 插件 manifest 核对

`D:\WorkSpace\AgentWorks\DSH\dsh-routing-suite-xsc\package.json`（与 `...\injector\package.json` 一致）

```json
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "inject": [ "@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-slots" ], "platform": "web" }
  },
```

→ `patch` 为字符串（合法）；`inject` 为字符串数组（合法）；`platform: "web"`（合法且唯一生效值）。**未声明 `dsh.manifestVersion`、未声明 `engines.dsh`** —— 二者均可选（README：「以下元数据字段均可选」，且「当前安装器和加载器不强制检查 `dsh.manifestVersion` 或 `engines.dsh`」，`dsh-package-manifest\README.zh.md`「兼容性仅作声明」）。

**对插件的影响：无（成立）。** 建议（非必需）补 `dsh.manifestVersion: 1` 与 `engines.dsh` 以表达兼容意图；`DshBundleManifest` / `DshClientManifest` 的**精确字段集（是否还有未文档化字段）无法从本机运行时确证 = UNVERIFIED**，卡点：该包发布物缺失 `lib/types/**/*.d.ts`，且全树无其他 `Dsh*.d.ts` 或运行期声明文本。

---

## Q6. `schemastery` 3.18.4 API

**结论：全部成立。`z.object({...})` / `z.string()` / `z.number()` / `z.boolean()` / `z.array(...)` 均在；`.default(v)` 在；`.required()` 仍在且在 **3.18.4 内部被大量使用**。类型声明文件同样未随包发布（`lib/types/` 下只有 `index.d.ts.map`）。**

证据（该包 `package.json` `"version": "3.18.4"`，`"types": "lib/types/index.d.ts"`，但该 `.d.ts` 实际不存在）：

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\schemastery\src\index.ts:42-99`（`Schema.Static` 工厂方法声明）

```ts
    /** Static constructor and factory methods exposed by the default `Schema` export. */
    export interface Static {
      resolve: Resolve
      from<X = any>(source?: X): From<X>
      extend(type: string, resolve: Resolve): void
      any<T = any>(): Schema<T>
      never(): Schema<never>
      const<const T>(value: T): Schema<T>
      string(): Schema<string>
      number(): Schema<number>
      natural(): Schema<number>
      percent(): Schema<number>
      boolean(): Schema<boolean>
      date(): Schema<string | Date, Date>
      ...
      array<X>(inner: X): Schema<TypeS<X>[], TypeT<X>[]>
      dict<X, Y extends Schema<any, string> = Schema<string>>(inner: X, sKey?: Y): Schema<...>
      tuple<const X extends readonly any[]>(list: X): Schema<...>
      object<X extends Dict>(dict: X): Schema<ObjectS<NoInfer<X>>, ObjectT<NoInfer<X>>>
      union<const X>(list: readonly X[]): Schema<TypeS<X>, TypeT<X>>
      intersect<const X>(list: readonly X[]): Schema<IntersectS<X>, IntersectT<X>>
      ...
```

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\schemastery\src\index.ts:159-160`（`.required()` 仍在，签名带泛型）

```ts
    /** Mark nullable input as invalid unless a default supplies a fallback. */
    required<R extends boolean = true>(value?: R): Schema<S, T, SetRequired<Mode, R>>
```

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\schemastery\src\index.ts:174-175`（`.default`）

```ts
    /** Set the fallback value used for nullable input. */
    default(value: T | NoInfer<Partial<S>>): Schema<S, T, SetRequired<Mode, true>>
```

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\schemastery\src\index.ts:194-195`（`.step`，一并确认 `number().step(1).min(0).max(9)` 这类链式用法）

```ts
    /** Set the numeric increment constraint. */
    step(value: number): Schema<S, T, Mode>
```

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\schemastery\src\index.ts:556-570`、`:588-593`（`.required()`/工厂在 3.18.4 内部真实调用）

```ts
Schema.from = function from(source: any) {
	if (isNullable(source)) { return Schema.any() }
	else if (['string', 'number', 'boolean'].includes(typeof source)) { return Schema.const(source).required() }
	...
	case String: return Schema.string().required()
	case Number: return Schema.number().required()
	case Boolean: return Schema.boolean().required()
...
Schema.natural = function natural() { return Schema.number().step(1).min(0) }
```

旁证（同一运行时的官方包正用这套 API）：`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-host-webserver\lib\index.js:141-147` `z.object({ host: z.union([...]).required(), port: z.natural().max(65535).required(), compression: z.union([...]).default(DEFAULT_COMPRESSION), compressionLevel: z.number().step(1).min(0).max(9).default(DEFAULT_COMPRESSION_LEVEL), compressionThresholdBytes: z.natural().default(DEFAULT_COMPRESSION_THRESHOLD_BYTES) })`。

插件侧用法：`injector\src\index.ts:331-333` `export const Config = z.object({ title: z.string().default('面板') })`。

**对插件的影响：无。** 注意点：`.required()` 是**实例方法**（不是无参属性）；`.default()` 一旦给出，该字段解析时不再必填。若插件在某处用 `z.array(...).default([])` 之类链式写法，均属已声明的 API。

---

## Q7. `export const inject = [...]` 的合法服务名集合

**结论：`'loader'` / `'timer'` / `'tools'` / `'systemPrompt'` / `'webServer'` 五个全部成立（均为真实注册名）。另：`'slots'` 是 client 侧服务（`injector\src\index.ts:376` 的 client 骨架用），也真实存在，但只在**浏览器端**容器里。**

注册名 → 注册位置（全部为 `super(ctx, "<name>")` 形式，即 cordis Service 的公开容器名）：

| 服务名 | 注册位置（绝对路径:行号） | 代码 |
|---|---|---|
| `loader` | `...\@deepseek-ai\cordis-plugin-loader\lib\index.js:590` | `name = "loader";`（并 `internal = ModuleLoader.fromInternal();` @ `:591`） |
| `timer` | `...\@deepseek-ai\cordis-plugin-timer\lib\index.js:6` | `super(ctx, "timer");` |
| `timer`（client 半） | `...\@deepseek-ai\dsh-cordis-client-runner\lib\client.js:6345` | `super(ctx, "timer");` |
| `slots` | `...\@deepseek-ai\dsh-client-ui-renderer\lib\client.js:1323` | `super(ctx, "slots");` |
| `tools` | `...\@deepseek-ai\dsh-tools\lib\index.js:2704` | `super(ctx, "tools");` |
| `systemPrompt` | `...\@deepseek-ai\dsh-system-prompt\lib\index.js:213` | `super(ctx, "systemPrompt");` |
| `webServer` | `...\@deepseek-ai\dsh-host-webserver\lib\index.js:158` | `super(ctx, "webServer");` |
| `llm` | `...\@deepseek-ai\dsh-llm\lib\index.js:1801` | `super(ctx, "llm");`（插件 daemon-loop 模板另用） |

装载证据（这些服务在 Web 组合里确实被拉起）：`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-base\cordis.patch.yml:24-25`

```yaml
    - id: timer
      name: '@deepseek-ai/cordis-plugin-timer'
```

同文件 `:499-500 - id: tools / name: '@deepseek-ai/dsh-tools'`、`:504-505 - id: system-prompt / name: '@deepseek-ai/dsh-system-prompt'`。

插件侧声明：`injector\src\index.ts:495 export const inject = ['loader', 'timer', 'tools', 'systemPrompt', 'webServer']`；`:325 export const inject = ['tools', 'webServer']`（模板）；`:161 export const inject = ['tools']`；`:227 export const inject = ['timer', 'llm']`；`:376 export const inject = ['slots']`（client）。

**对插件的影响：无。** 名称拼写与宿主注册名逐字一致（注意 `systemPrompt` 是 camelCase，`webServer` 是 camelCase，二者都正确）。服务名全集（97 处 `super(ctx, "...")`）已核对，未见插件使用不存在的名字。

---

## Q8. `ctx.setInterval` / `ctx.effect` / `ctx.on` / `ctx.logger` / `ctx.root`

**结论：全部成立。** 前四项在题面所述 checkout 的 `cordis\lib\types\*.d.ts` 已不发布（`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\lib\types\` 下只有 `context.d.ts.map`/`events.d.ts.map`/`fiber.d.ts.map`/`index.d.ts.map`/`logger.d.ts.map`/`reflect.d.ts.map`/`registry.d.ts.map`/`service.d.ts.map`/`utils.d.ts.map`，**无 `.d.ts`**），故以实现为准（cordis 4.0.4，`cordis\package.json` `"version": "4.0.4"`）：

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\lib\index.js:1169-1173`

```js
	effect(execute, label = "anonymous") {
		this.assertActive();
		if (this.state === 5) throw new CordisError("INACTIVE_EFFECT");
		const disposables = [];
```

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\lib\index.js:371`（事件注册，`on(name, listener, options)`）

```js
	on(name, listener, options) {
```

（`emit` @ `:280`、`bail` @ `:301`、`waterfall` @ `:317` —— `system-prompt/assemble` 走 waterfall。）

`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\lib\index.js:1682-1688`

```js
		this.root = self;
...
		this.logger = new LoggerService(self);
```

`ctx.setInterval(fn, ms)`：不在 cordis 核心，由 `timer` 服务扩展提供 —— `D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis-plugin-timer\lib\index.js:12-22`

```js
			"setTimeout",
			"setInterval"
...
	setTimeout(callback, delay) { ... }
	setInterval(callback, delay) { ... }
```

（该插件 `inject` 已含 `'timer'`；`injector\src\index.ts:289` 与 `:2302` 用 `ctx.setInterval(...)`，正确。）

`ctx.logger` 用法形态：`ctx.logger` 本身可调用（`context.logger.error(...)` 见 `cordis\lib\index.js:975/980/982`），插件用 `logger.info/warn/error`（`injector\src\index.ts` 大量，例如 `:838`、`:876`、`:3215`），成立。

`ctx.root`：`cordis\lib\index.js:1682`，成立（插件未直接使用，仅在类型面 `Context` 上可用）。

**对插件的影响：无。** 唯一"漂移"性质的是**该 cordis 安装不发布 `.d.ts`**：插件 `tsconfig.json` 若 `strict` 且依赖 `@deepseek-ai/cordis` 类型，则 `import type { Context } from '@deepseek-ai/cordis'` 会解析失败（`cordis\package.json` 声明 `"types": "lib/types/index.d.ts"` 但文件缺失）。这属于**构建期**风险，不是运行期契约失效；`injector\lib\` 已构建产物不受影响。建议以 `dsh-tool-cordis/lib/types/api-catalog.js` 的声明文本或源码 `src/*.ts` 作为类型来源（`cordis\src\` 存在）。

---

## 汇总（结论强度）

| # | 问题 | 结论 | 风险 |
|---|---|---|---|
| 1 | `defineTool` + `parameters`/`output.schema`/`output.render`/`execute` | 成立 | 无 |
| 2 | `ctx.tools.register` / 是否必须 `ctx.effect` | 成立（`ctx.effect` 为冗余保险） | `purgeStaleTools` 直改 `layers.global.tools` 内部 Map = 非契约 |
| 3 | `system-prompt/assemble`（Waterfall + `tools` 过滤） | 成立 | `context.agent` 类型面未声明；`agent.session.events` **不存在** |
| 4 | `webServer.register` / `kind` / 三张内部表 | 成立（`kind` 仅 `exact`\|`prefix`） | 直删内部表 = 非契约；`kind:'upgrades'` 语义错误（须 `registerUpgrade`） |
| 5 | `dsh-package-manifest` 字段 | 合法用法成立；**精确字段 `UNVERIFIED`**（发布物缺 `.d.ts`） | 低（有 README + 运行时双证） |
| 6 | `schemastery` 3.18.4 API | 成立（含 `.required()`） | 该包 `.d.ts` 同样未发布 |
| 7 | `inject` 服务名（loader/timer/tools/systemPrompt/webServer） | 全部成立 | 无 |
| 8 | `ctx.setInterval/effect/on/logger/root` | 成立 | cordis 不发布 `.d.ts` → 构建期类型解析风险 |

**UNVERIFIED 清单（禁止推测）**
1. `ToolOutputDefinition.render` 返回的 `ContentBlock` 中 `TextBlock` 的精确字段（`text` 之外是否还有必填项）—— api-catalog 只有 `ContentBlockMap` 键映射，无 `TextBlock` 声明。
2. `DshPackageManifest` / `DshBundleManifest` / `DshClientManifest` / `DshManifest` 的**完整**字段集（含 `manifestVersion`、`engines.dsh`、`bundle`/`client` 之外是否有其他键）—— 该包仅发布 `lib/index.js`(`export {}`) + README，无 `lib/types/**`；全树无其他声明文本。
3. cordis 各 `ctx.*` 方法的**类型签名**（`.d.ts` 未发布），本报告以 `lib/index.js` 实现为准。
4. `dsh.client.platform` 的**枚举全集**：运行时只校验"是字符串"，其余分支仅接受 `"web"`；是否存在其他合法值（如 `"electron"`）在本机运行时代码中**无证据**。
