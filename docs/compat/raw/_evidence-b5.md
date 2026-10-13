[assistant]
Excellent — very rich. I now have the plugin-side call points with line numbers.

Key new findings from these greps:
- L3199 `ctx.systemPrompt.context({...})` — another API surface to verify!
- L3255 `ctx.get('agents')` with `.create` — another service.
- L2538 `join(dshHome, '.agent-presets')` — preset root.
- L2819 npm-cli.js path derivation.
- L2759 `join(homedir(), '.dsh', 'dsh-harness')` — legacy checkout candidates in build.sh template.
- L500/L501 config `profileNodeModules` default `''`, L515 `z.string().default('')`.
- L478 `pkg.dsh = {...}` — the plugin writes `dsh` field into generated package.json.
- L2001 "阻断 bundle patch 自装配" — L2012 patchFile join(dirname(profileNodeModules),'cordis.patch.yml').
- L2585/L2597-2605 a tool that scans profiles/*/cordis.patch.yml.
- L1357 reload-debug.log.
- client/index.ts L173 `ctx.effect(() => ctx.slots.inject('settings.section', () => ...))`.

Also interesting: injector/README.md:163-165 uses bare `cordis` and `@deepseek-ai/dsh-llm` — doc inconsistency (B196 line was fixing src templates; README may still have bare names).

Now, the count of `ctx.loader.entries()` call sites is large (~25). Good.

I still need:
- `ctx.on(` event names list
- `webServer` usage details (L626, L2481, L337, L3281)
- `defineTool` parameter shapes (many)
- `systemPrompt.context` signature

Let me grep for events and webServer and systemPrompt specifics.

Also need the imports of the plugin for `@deepseek-ai/dsh-llm` (L214-215) — used in the daemon-loop scaffold template. And `createUserMessage`, `ReasoningEffortId` from dsh-llm. Are those still exported? That's another contract to verify — I should add to host subagent. Let me send a follow-up message to the host subagent to also check `@deepseek-ai/dsh-llm` exports + `ctx.systemPrompt.context` + `ctx.get('agents')`.

Let me do that via send_message.

Also the loader subagent should verify `entry.fiber.uid`, `entry.id`, `entry.disabled`, `fiber.runtime.callback`, `fiber.entry`, `fiber.parent.registry`, `fiber._config`, `fiber.dispose()`, `runtime.fibers`, `registry.delete/plugin/get`, `entry.options.config`. Let me add those.

And client subagent: verify `slots.inject`/`register` and also that the client bundle is loaded via `dsh.client.inject` semantics; plus whether `@deepseek-ai/dsh-client-ui-slots` is bundled as external.

Let me send follow-ups now. Meanwhile, continue greps.

Let me batch: send_message x3? No — 2 (host, loader) + maybe client. Let me send to all three with additional specific items.

Then also grep for events/webServer/systemPrompt.

Let me do it in one message: 3 send_message + 3 greps. Actually send_message to a running subagent steers at nearest step boundary; fine.

Let me write the follow-ups concisely.

Then greps:
1. `ctx\.on\('` with content to get event names
2. `webServer` context lines
3. `systemPrompt|system-prompt`

Let me go.

[assistant]
<acp tokens="66" type="text">m00112</acp>
三个 runtime 枚举仍在跑。插件侧调用点已用 grep 系统化取证，规模明确（`ctx.loader.entries()` 约 25 处调用点）。我发现了几处先前未登记的新契约面，追加给对应审计员。

[assistant • send_message]
{"target":"d7791668-b7bb-420e-8d1b-91b7f6867e97","message":"补充 3 项必须查证的契约面（插件侧已确认用到，请并入 host.md 后回复摘要）：\n\n9. `@deepseek-ai/dsh-llm` 是否仍存在于 runtime 树、仍导出 `createUserMessage` 与 `ReasoningEffortId`？插件在 scaffold 模板里生成 `import type LlmService from '@deepseek-ai/dsh-llm'` / `import { createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'`（`injector/src/index.ts:214-215`）。给出导出清单与证据。\n\n10. `ctx.systemPrompt.context({...})` 这个 API 是否存在、签名是什么？调用点 `injector/src/index.ts:3199`。它是否属于 `@deepseek-ai/dsh-system-prompt` 的 SystemPrompt 服务？还是哪个服务的 `context()`？\n\n11. `ctx.get('agents')` 及其 `.create(options)` 是否仍是真实服务契约？调用点 `injector/src/index.ts:3255`（形如 `{ create?: (options:any) => Promise<{ agent: { id: string } }> }`）。请查证 agents 服务的注册名与 create 的真实签名/返回结构。另外 `ctx.get('clientModules')` 的 `clientPath(id)` / `rebuilt(id)` / `table` 三个成员是否仍存在（调用点 `injector/src/index.ts:1350, 1701, 1726, 1737, 1832, 3227`）。"}

[assistant • send_message]
{"target":"07c0c697-526c-4f29-8bc7-692637127ee4","message":"补充：插件大量依赖 entry/fiber 的**具体成员**，请逐一见证并并入 loader.md（这些是目前最可能的漂移点）：\n\n11. `entry.fiber.uid`（`injector/src/index.ts:3079,3091` 用作 identity 对比）\n12. `entry.id`、`entry.disabled`、`entry.options.disabled`、`entry.options.config`、`entry.options.group`、`entry.options.name`（`:1348, 1877, 1988` 等）\n13. `fiber.runtime.callback`（`:1067`，用于取旧插件实例）、`fiber.entry`（`:1290,1314` 赋值 `fiber.entry.fiber = fiber`）、`fiber.parent.registry.plugin(...)`（`:1288,1312`）\n14. `fiber.dispose()` 返回 Promise/disposalTask（`:1202, 1890` 被 `await`）\n15. `fiber.await()`（`:1297` 附近等新 fiber 从 loading→active，请确认方法名）\n16. `fiber._config`（`:1312` 通过 `currentConfigOf(oldFiber._config)` 读回旧 config）——`_config` 私有字段是否仍是这个名字？官方读回 config 的正规方式是什么？\n17. `ctx.registry.get(plugin)`、`ctx.registry.delete(fiber)`、`ctx.registry.plugin(plugin, config, outerStack)` 三者的当前签名与返回。\n18. `runtime.fibers`（DisposableList）是否仍是可展开的快照来源（`:1264`）。\n19. `entry.getOuterStack`（`:1073`）。\n20. plugin-loader 的 entry id 生成规则：`name`、`id`、`group` 如何决定 entry 身份（插件用 `(!e.options.group && String(e.options.name) === TEST_PKG)` 来定位自己的 entry，需要确认这个判定在当前实现下是否可靠）。\n\n同样：每条给绝对路径 + 行号 + 代码片段，无法确证写 UNVERIFIED。"}

[assistant • send_message]
{"target":"27dda0ec-8d84-4fa6-8576-237b89f8b3b3","message":"补充 2 项：\n\n7. 插件 client 端只在 `ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register(...)))`（`injector/src/client/index.ts:173`）里注册。请见证 `ctx.effect` 在 **client 侧**是否也由 cordis 提供（即 client bundle 里 `cordis` 能 require 到且提供 `ctx.effect`/`ctx.slots`），以及 `export const inject = ['slots']` 是否是 client 插件的正确声明方式。挑 1–2 个官方 `dsh-client-ui-*` 包做同构对照。\n\n8. 插件用 `import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots'`（`injector/src/client/index.ts:14`）与 `import { createElement, useEffect, useRef } from 'react'`。请确认这两个在 **client bundle 的运行时解析**中是否可用，以及 `react` 是否在 client 模块加载器的 require 白名单里（给出白名单代码位置）。同时确认 `settings.section` 槽的 `label` 是 `() => string` 还是 `string`（插件用了 `label: () => '插件管理'`）。"}

[assistant • grep]
{"path":"D:\\WorkSpace\\AgentWorks\\DSH\\dsh-routing-suite-xsc\\injector\\src","pattern":"ctx\\.on\\(['\\x22][^'\\x22]+","only_matching":true}

[assistant • grep]
{"path":"D:\\WorkSpace\\AgentWorks\\DSH\\dsh-routing-suite-xsc\\injector\\src","pattern":"webServer\\.\\w+|\\.exact|\\.prefixes|\\.upgrades|kind: 'prefix'|kind: 'exact'|systemPrompt\\.\\w+","line_numbers":true}

[tool • send_message]
Error: active teammate "d7791668-b7bb-420e-8d1b-91b7f6867e97" not found

[tool • send_message]
Error: active teammate "07c0c697-526c-4f29-8bc7-692637127ee4" not found

[tool • send_message]
Error: active teammate "27dda0ec-8d84-4fa6-8576-237b89f8b3b3" not found

[tool • grep]
Found 2 matches

injector\src\index.ts
Line 194:   // ctx.on('system-prompt/assemble', async (_assembly: unknown, context: any, next: () => Promise<any>) => {
Line 260:   ctx.on('llm/stream', (options, next) => {

[tool • grep]
Found 6 matches

injector\src\index.ts
Line 337:   ctx.effect(() => ctx.webServer.register({
Line 338:     kind: 'prefix',
Line 3199:     ctx.systemPrompt.context({
Line 3215:     logger.warn('[super-injector] systemPrompt.context 重复注册容忍（跳过，新实例继续运行）: %s', e instanceof Error ? e.message : String(e))
Line 3281:   ctx.effect(() => ctx.webServer.register({
Line 3282:     kind: 'prefix',

[assistant]
The subagent tool returned IDs that aren't addressable teammates — they're subagent runs, not teammates. So `send_message` doesn't work for them; they're `subagent` background runs. I need to wait for their results, or use... The `subagent` tool description says "returns a subagent id you can continue with `send_message`". But the error says active teammate not found. Maybe they already finished? Or the id format needs to be different.

Let me check list_agents to see what's addressable.

Also, given they may have already completed, let me check job/agent status.

Important: my three additional questions may not reach them. I'll need to fold them into a second round or verify myself.

Let me call list_agents.

Also note grep results:
- `ctx.on('...')` — only 2 real: line 260 'llm/stream'. Line 194 is a COMMENT (commented-out example). So no live `system-prompt/assemble` registration in the shipped code — that's in a scaffold template comment. Important finding: the scaffold template's system-prompt example is commented out.
- `webServer.register({kind:'prefix', ...})` at L337 (scaffold template) and L3281 (live).
- `ctx.systemPrompt.context({...})` at L3199 (live).

So the plugin's live host-surface: `ctx.tools.register`, `ctx.webServer.register({kind:'prefix'})`, `ctx.systemPrompt.context`, `ctx.get('clientModules')`, `ctx.get('agents')`, `ctx.loader.*`, `ctx.registry.*`, `ctx.root`, `ctx.effect`, `ctx.setInterval`, `ctx.logger`, `ctx.on('llm/stream')`.

Let me check list_agents now.

[assistant • list_agents]
{}

[tool • list_agents]
[{"target":"lead","role":"lead","status":"running","model":"deepseek-flash","diagnostics":[]}]

[assistant]
The subagents are not listed as teammates — they're background subagent runs. So `send_message` can't reach them. I also don't see job ids. The subagent tool said "runs in the background by default and returns a subagent id you can continue with send_message; you are notified when the run settles."

Hmm, but list_agents shows only lead. Maybe subagent runs appear differently, or they already settled (and I'd be notified). Let me check job_list.

Anyway — the important thing: I cannot send follow-ups. So I'll incorporate the extra verification items myself, in the final cross-reference table, marking them as needing the runtime check. Or I'll do those checks myself directly — they're targeted greps/reads, quite feasible.

Actually, since I have workspace access and the runtime tree is readable, I can verify the extra items myself quickly. That's arguably better: I control evidence quality.

Let me check job_list to see if the subagents are running.

Then decide: do the extra contract checks myself.

Let me plan the remaining S1 work:
1. Wait for / collect the 3 subagent raw outputs (loader.md, host.md, client.md).
2. Meanwhile do my own targeted runtime checks for the extra items (entry.fiber.uid, fiber._config, systemPrompt.context, ctx.get('agents'), dsh-llm exports, loader-registered service names).
3. Write CONTRACT-CALLPOINTS.md (plugin side inventory) and BASELINE.md.
4. Assemble CONTRACT-MATRIX.md.

Let me check jobs first.

Actually let me combine: job_list + start my own runtime probes.

Let me write a probe script? No — simplest is targeted greps into the runtime tree. I'll use grep tool.

Let me do:
- grep in runtime for `_config` in cordis lib
- grep for `uid` 
- grep for `getOuterStack`
- grep for `_dispose`
- grep for `unwrapExports`
- grep for `loadCache`
- grep for `insert` in cordis-plugin-loader / dsh patch handling

But the runtime packages are bundled/minified? Let me look at the structure first.

Let me do a directory listing of the runtime @deepseek-ai dir and the cordis package.

Let me batch: job_list + pwsh listing.

[assistant • job_list]
{}

[assistant • pwsh]
{"command":"$rt = 'D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai'\nGet-ChildItem $rt -Force | Where-Object { $_.Name -like '*cordis*' -or $_.Name -like '*loader*' } | Select-Object Name, @{n='isLink';e={$_.LinkType}} | Format-Table -AutoSize\nWrite-Output \"=== cordis pkg files ===\"\nGet-ChildItem (Join-Path $rt 'cordis') -Recurse -File -ErrorAction SilentlyContinue | Select-Object @{n='rel';e={$_.FullName.Substring($rt.Length+1)}}, Length | Format-Table -AutoSize\nWrite-Output \"=== cordis-plugin-loader files ===\"\nGet-ChildItem (Join-Path $rt 'cordis-plugin-loader') -Recurse -File -ErrorAction SilentlyContinue | Select-Object @{n='rel';e={$_.FullName.Substring($rt.Length+1)}}, Length | Format-Table -AutoSize","description":"Inspect cordis and plugin-loader package layouts"}

[tool • job_list]
(no background jobs)

[tool • pwsh]

Name                     isLink
----                     ------
cordis                   
cordis-plugin-group      
cordis-plugin-include    
cordis-plugin-loader     
cordis-plugin-timer      
dsh-client-ui-cordis     
dsh-cordis-client-runner 
dsh-cordis-host-runner   
dsh-tool-cordis          
dsh-typert-loader        

=== cordis pkg files ===

rel                                Length
---                                ------
cordis\bin.js                         388
cordis\LICENSE                       1071
cordis\package.json                  1241
cordis\lib\index.js                 60361
cordis\lib\types\context.d.ts.map    1589
cordis\lib\types\events.d.ts.map     5420
cordis\lib\types\fiber.d.ts.map      3326
cordis\lib\types\index.d.ts.map       411
cordis\lib\types\logger.d.ts.map     2612
cordis\lib\types\reflect.d.ts.map    3153
cordis\lib\types\registry.d.ts.map   4169
cordis\lib\types\service.d.ts.map    1194
cordis\lib\types\utils.d.ts.map      1748
cordis\src\context.ts                6153
cordis\src\events.ts                14917
cordis\src\fiber.ts                 24960
cordis\src\index.ts                   815
cordis\src\logger.ts                 8644
cordis\src\reflect.ts               15434
cordis\src\registry.ts              11753
cordis\src\service.ts                4263
cordis\src\utils.ts                 10236

=== cordis-plugin-loader files ===

rel                                                    Length
---                                                    ------
cordis-plugin-loader\LICENSE                             1071
cordis-plugin-loader\package.json                        1054
cordis-plugin-loader\lib\index.js                       23896
cordis-plugin-loader\lib\types\index.d.ts.map            1899
cordis-plugin-loader\lib\types\internal.d.ts.map         3228
cordis-plugin-loader\lib\types\config\diff.d.ts.map       313
cordis-plugin-loader\lib\types\config\entry.d.ts.map     1306
cordis-plugin-loader\lib\types\config\group.d.ts.map      943
cordis-plugin-loader\lib\types\config\isolate.d.ts.map    962
cordis-plugin-loader\lib\types\config\tree.d.ts.map      1240
cordis-plugin-loader\lib\types\config\utils.d.ts.map      437
cordis-plugin-loader\src\index.ts                        7308
cordis-plugin-loader\src\internal.ts                     5765
cordis-plugin-loader\src\config\diff.ts                  2171
cordis-plugin-loader\src\config\entry.ts                 8049
cordis-plugin-loader\src\config\group.ts                 2610
cordis-plugin-loader\src\config\isolate.ts               5560
cordis-plugin-loader\src\config\tree.ts                  4260
cordis-plugin-loader\src\config\utils.ts                 1051



[assistant]
Excellent — **full TypeScript source ships with both packages**. That's a huge win for evidence quality: `cordis/src/fiber.ts`, `cordis/src/registry.ts`, `cordis-plugin-loader/src/config/entry.ts`, `src/internal.ts`.

Note: `dsh-cordis-client-runner` and `dsh-cordis-host-runner` — these might be where `loader` service is bound.

Also no `lib/types/*.d.ts` files, only `.d.ts.map` — so types are generated? Actually only .map files present, no .d.ts. Odd, but the `src/*.ts` is the authority.

The subagents may have found this. But no background jobs listed and no teammates — so did my subagents actually run? `job_list` says no background jobs. `list_agents` shows only lead. Hmm, the subagent tool returned "started subagent <id>". Maybe subagents are tracked elsewhere and I'll be notified.

This is concerning: if they're not running and not addressable, I should just do the work myself. The work is very tractable now with full TS sources.

Let me not wait. I'll do the contract enumeration myself — I have full sources. That's more reliable anyway.

Given the volume, let me be systematic and efficient. I'll read the key source files:
- `cordis/src/fiber.ts` (Fiber: uid, state, dispose, entry, parent, registry, _config, await)
- `cordis/src/registry.ts` (plugin(), delete, get)
- `cordis/src/context.ts` (effect, on, setInterval, get, root, logger)
- `cordis-plugin-loader/src/index.ts` + `internal.ts` + `config/entry.ts` (entries, import, unwrapExports, create, internal.loadCache, entry._dispose, getOuterStack, options)

Then host services: dsh-tools (defineTool, ToolRegistry), dsh-system-prompt, dsh-host-webserver, schemastery, dsh-package-manifest, dsh-llm, and service names.

And client: dsh-client-ui-slots, module loader.

That's a lot of reading. Let me use targeted greps + selective reads, and delegate the bulk to subagents again? The previous delegation may have failed silently.

Let me test: spawn one subagent with run_in_background=false to see if it works synchronously. Actually better — check whether there's a way to see subagent status. Let me just try `subagent` with run_in_background: false for one focused task; if it returns a result, delegation works and the earlier ones probably ran too (and I'll get notified).

Hmm, but that burns time. Let me instead just do the work myself with efficient greps — I know exactly what to look for.

Priority order for S1 (the user asked S0+S1):
- S1 deliverable = 契约对照表 (call points × authoritative definitions).
- I should be rigorous but bounded.

Let me structure my reading:
Batch 1: read cordis/src/fiber.ts (25KB ≈ 700 lines), cordis/src/registry.ts (11.7KB ≈ 350 lines).
Batch 2: read cordis-plugin-loader/src/index.ts (7.3KB), internal.ts (5.8KB), config/entry.ts (8KB).
Batch 3: dsh-tools, dsh-system-prompt, dsh-host-webserver key files.
Batch 4: dsh-client-ui-slots, module loader, package-manifest.

That's ~20 files. Feasible but heavy on context. Let me use grep for the specific symbols instead of full reads where possible, then read only the relevant regions.

Efficient approach: grep for each symbol across the two cordis packages with line numbers, then read surrounding regions.

Let me do a combined grep set:
- In cordis/src: `uid|_config|getOuterStack|_dispose|unwrapExports|loadCache`
- In cordis-plugin-loader/src: same + `entries(` `async import` `create(` `internal`

Let me run greps.

Actually — a much better idea: since the subagents might have already written their files! They were told to write to docs/compat/raw/*.md. Let me check if those files exist. If they do, delegation worked and I can just read them. And they might still be mid-flight.

Let me check the raw dir.

Let me batch: glob/write check + greps.

[assistant • pwsh]
{"command":"$raw = 'D:\\WorkSpace\\AgentWorks\\DSH\\dsh-routing-suite-xsc\\docs\\compat\\raw'\nGet-ChildItem $raw -File -ErrorAction SilentlyContinue | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize\nWrite-Output \"--- count: $((Get-ChildItem $raw -File -ErrorAction SilentlyContinue | Measure-Object).Count)\"\nWrite-Output \"=== dsh host service packages present? ===\"\n$rt = 'D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai'\nforeach ($n in @('dsh-tools','dsh-system-prompt','dsh-host-webserver','dsh-package-manifest','dsh-llm','dsh-client-ui-slots','dsh-client-runtime','dsh-client-modules','dsh-agent-presets','dsh-cordis-host-runner','dsh-cordis-client-runner','schemastery','cosmokit')) {\n  $p = Join-Path $rt $n\n  $v = 'MISSING'\n  if (Test-Path $p) { $v = (Get-Content (Join-Path $p 'package.json') -Raw | ConvertFrom-Json).version }\n  Write-Output (\"{0,-28} {1}\" -f $n, $v)\n}","description":"Check subagent raw outputs and host package presence"}

[assistant • grep]
{"line_numbers":true,"path":"D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai\\cordis\\src","pattern":"uid|_config|getOuterStack|_dispose|unwrapExports|loadCache|state\\b|FiberState|entry\\b|dispose\\(|async await|registry\\.|get\\(name"}

[tool • pwsh]
--- count: 0
=== dsh host service packages present? ===
dsh-tools                    0.2.0-rc.2
dsh-system-prompt            0.2.0-rc.2
dsh-host-webserver           0.2.0-rc.2
dsh-package-manifest         0.2.0-rc.2
dsh-llm                      0.2.0-rc.2
dsh-client-ui-slots          0.2.0-rc.2
dsh-client-runtime           MISSING
dsh-client-modules           0.2.0-rc.2
dsh-agent-presets            MISSING
dsh-cordis-host-runner       0.2.0-rc.2
dsh-cordis-client-runner     0.2.0-rc.2
schemastery                  3.18.4
cosmokit                     1.8.5


[tool • grep]
Found 81 matches

D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\src\context.ts
Line 5: import { RegistryService, type InjectKey } from './registry.ts'
Line 31:   /** The plugin registry. Its methods are mixed onto `ctx` (`ctx.plugin`, `ctx.inject`). */
Line 137:    * @returns a child context carrying the additional intercept entry.

D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\src\events.ts
Line 4: import { Fiber, FiberState } from './fiber.ts'
Line 314:       dispose()
Line 330:   /** A plugin fiber was created or its uid was cleared on disposal. */
Line 332:   /** A fiber changed lifecycle state; receives the fiber and its previous state. */
Line 333:   'internal/status'(fiber: Fiber, oldValue: FiberState): void

D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\src\reflect.ts
Line 5: import { Fiber, FiberState } from './fiber.ts'
Line 19:     get(name: string, strict?: boolean): any
Line 233:   get(name: string, strict = true) {
Line 241:     if (strict && impl.fiber.state !== FiberState.ACTIVE) return
Line 294:       if (this.ctx.fiber.state === FiberState.ACTIVE) {
Line 312:    * @returns the fibers whose dependency state was refreshed.
Line 316:     for (const runtime of this.ctx.registry.values()) {

D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\src\index.ts
Line 10: export * from './registry.ts'

D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\src\registry.ts
Line 206:   /** Allocate the next fiber uid (increments on every read). */
Line 264:       fiber.dispose()
Line 313:    * @param getOuterStack — captures the caller stack for effect diagnostics.
Line 316:   plugin(plugin: Plugin, config?: any, getOuterStack = buildOuterStack()) {
Line 330:     const fiber = new Fiber(this.ctx, config, Inject.resolve(plugin.inject), runtime, getOuterStack)

D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\src\utils.ts
Line 240: function handleError(info: StackInfo, reason: any, getOuterStack: () => string[]): never {
Line 247:     lines.splice(1, Infinity, ...getOuterStack())
Line 262:   lines.splice(index, Infinity, ...getOuterStack())
Line 268: export function composeError<T>(callback: (info: StackInfo) => T, getOuterStack = buildOuterStack()): T {
Line 274:       return (result as any).then(undefined, (reason) => handleError(info, reason, getOuterStack)) as T
Line 279:     handleError(info, reason, getOuterStack)

D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\src\fiber.ts
Line 4: import type { Plugin } from './registry.ts'
Line 107:   getOuterStack: () => string[]
Line 115:   const result = dispose()
Line 140:  * Lifecycle state for one plugin fiber.
Line 147: export const enum FiberState {
Line 181:  * A fiber tracks dependency state, validated config, lifecycle effects, and
Line 186:   public uid: number | null
Line 192:   public _config: any
Line 193:   /** Current lifecycle state; transitions emit `internal/status`. */
Line 194:   public state = FiberState.PENDING
Line 220:    * @param getOuterStack — captures the caller stack for effect diagnostics.
Line 227:     getOuterStack: () => string[],
Line 229:     this._config = config
Line 235:       this.uid = parent.registry.counter
Line 249:         getOuterStack,
Line 268:           this.uid = null
Line 270:           if (this.ctx.registry.has(runtime.callback)) {
Line 273:               this.ctx.registry.delete(runtime.callback)
Line 284:               return FiberState.UNLOADING
Line 306:         void Promise.resolve(this.dispose()).catch(reason => this.ctx.logger.error(reason))
Line 314:       if (this.uid !== null && parent.fiber.state !== FiberState.UNLOADING) {
Line 321:       this.uid = 0
Line 323:       this.state = FiberState.ACTIVE
Line 327:         getOuterStack,
Line 349:    * @throws {CordisError} `INACTIVE_EFFECT` when the fiber's uid has been cleared.
Line 352:     if (this.uid !== null) return
Line 399:     }, runner.getOuterStack)
Line 420:     if (this.state === FiberState.UNLOADING) {
Line 455:       getOuterStack: buildOuterStack(),
Line 477:         () => dispose(),
Line 479:           await dispose()
Line 512:         return task ? disposeAfter(task) : dispose()
Line 546:       if (!runner.epoch) return dispose()
Line 575:     if (this.uid === null) return FiberState.DISPOSED
Line 576:     if (this._error) return FiberState.FAILED
Line 577:     if (this._runner.epoch !== INACTIVE) return FiberState.ACTIVE
Line 578:     return FiberState.PENDING
Line 581:   private _updateState(callback: () => void | FiberState) {
Line 582:     const oldState = this.state
Line 583:     this.state = callback() ?? this._getState()
Line 584:     if (oldState === this.state) return
Line 589:     if (oldState !== FiberState.ACTIVE && this.state !== FiberState.ACTIVE) return
Line 620:       epoch += ':' + impl.fiber.uid
Line 633:         return FiberState.LOADING
Line 636:         return FiberState.UNLOADING
Line 652:       // the load. Do not run plugin code for a stale epoch; the state update
Line 655:         this.config = this._resolveConfig(this._config)
Line 670:         return FiberState.UNLOADING
Line 682:         }, this._runner.getOuterStack)
Line 693:         return FiberState.LOADING
Line 701:    * @returns this fiber, once it has settled into a stable state.
Line 704:   async await() {
Line 738:     this._config = config
Line 739:     if (this.state !== FiberState.ACTIVE) {

[assistant]
The raw outputs don't exist (count: 0) — so my subagents did NOT deliver (they may still be running, or failed). I'll just do the work myself. Let me proceed rigorously.

Great finding: `FiberState` is a **`const enum`** at fiber.ts:147. Let me read that region for the numeric ordering — critical for `FIBER_NAMES[entry.fiber.state]`.

Also:
- `uid: number | null`
- `_config: any` — still exists ✔
- `state = FiberState.PENDING`
- `getOuterStack: () => string[]`
- `this.uid = parent.registry.counter`
- `registry.plugin(plugin, config?, getOuterStack = buildOuterStack())` — signature ✔
- `async await()` at fiber.ts:704 ✔

Let me read fiber.ts key regions: 100-200 (disposeAfter, FiberState, class head), 200-350 (constructor, load, state), 560-760 (_getState, await, updateConfig).

And registry.ts 190-350.

That's a lot of reading but essential. Let me read selectively.

Let me read:
1. fiber.ts lines 95-200
2. fiber.ts lines 200-340
3. fiber.ts lines 560-760
4. registry.ts lines 190-350

Let me batch these reads.

Actually, let me be smart about context. I'll read fiber.ts 95-200 and 560-760 and registry.ts 190-350. The 200-340 region I partially know from grep.

Hmm, I need `entry` and `parent` and `dispose()` semantics. Let me read 95-360 in one go (265 lines) and 560-760 (200 lines), plus registry 190-350 (160 lines). Total ~625 lines. Acceptable.

Let me do it.

Also I should read the loader package. Let me first do cordis.

Let me fire the reads.

Also: `FiberState` const enum ordering — need it. It's at fiber.ts:147.

Let me read.

[assistant]
<acp tokens="65" type="text">m00137</acp>
子代理产物未落盘（raw 目录为空），我不等待、改为亲自取证——runtime 树里 **cordis 与 cordis-plugin-loader 都随包附带了完整 TypeScript 源码**，证据质量比读打包产物高得多。

[assistant • read]
{"file_path":"D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai\\cordis\\src\\fiber.ts","offset":95,"limit":270}

[assistant • read]
{"file_path":"D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai\\cordis\\src\\fiber.ts","offset":560,"limit":210}

[assistant • read]
{"file_path":"D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai\\cordis\\src\\registry.ts","offset":190,"limit":160}

[tool • read]
<path>D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\src\fiber.ts</path>
<type>file</type>
<content>
95: /** Tree node used to expose nested effect labels for diagnostics. */
96: export interface EffectMeta {
97:   /** Human-readable effect label, e.g. `ctx.on("event")` or `ctx.provide("name")`. */
98:   label: string
99:   /** Metadata of nested effects registered while this effect ran. */
100:   children: EffectMeta[]
101: }
102: 
103: interface EffectRunner<T> {
104:   epoch: T
105:   execute: () => any
106:   collect: (dispose: Disposable) => void
107:   getOuterStack: () => string[]
108: }
109: 
110: // Public effect disposers remain single-shot, but structural owners and outer
111: // effects must still be able to join a cleanup that another caller started.
112: const effectInertia = new WeakMap<Disposable, () => void | Promise<void>>()
113: 
114: function runDisposable(dispose: Disposable) {
115:   const result = dispose()
116:   return effectInertia.get(dispose)?.() ?? result
117: }
118: 
119: /** Notify plugin teardown without allowing one observer to break ownership cleanup. */
120: function emitPluginDisposed(context: Context, fiber: Fiber) {
121:   const args: any[] = ['internal/plugin', fiber]
122:   let callbacks: Function[]
123:   try {
124:     callbacks = context.events.dispatch('emit', args)
125:   } catch (error) {
126:     context.logger.error(error)
127:     return
128:   }
129:   for (const callback of callbacks) {
130:     try {
131:       const returned = callback(...args)
132:       void Promise.resolve(returned).catch(error => context.logger.error(error))
133:     } catch (error) {
134:       context.logger.error(error)
135:     }
136:   }
137: }
138: 
139: /**
140:  * Lifecycle state for one plugin fiber.
141:  *
142:  * `PENDING` — waiting for required services; `LOADING` — the plugin callback
143:  * is running; `ACTIVE` — loaded and providing; `FAILED` — the callback or its
144:  * config threw; `UNLOADING` — disposers are running; `DISPOSED` — the fiber
145:  * was removed and cannot restart.
146:  */
147: export const enum FiberState {
148:   PENDING,
149:   LOADING,
150:   ACTIVE,
151:   FAILED,
152:   DISPOSED,
153:   UNLOADING,
154: }
155: 
156: /** Framework error with a stable machine-readable code. */
157: export class CordisError extends Error {
158:   /**
159:    * @param code — the stable error code; also the default message.
160:    * @param message — optional human-readable override.
161:    */
162:   constructor(public code: CordisError.Code, message?: string) {
163:     super(message ?? CordisError.Code[code])
164:   }
165: }
166: 
167: /** Cordis error code definitions. */
168: export namespace CordisError {
169:   export type Code = keyof typeof Code
170: 
171:   export const Code = {
172:     INACTIVE_EFFECT: 'cannot create effect on inactive context',
173:   } as const
174: }
175: 
176: const INACTIVE = '__INACTIVE__'
177: 
178: /**
179:  * Runtime instance of one plugin application.
180:  *
181:  * A fiber tracks dependency state, validated config, lifecycle effects, and
182:  * cleanup for the plugin context returned by `ctx.plugin()`.
183:  */
184: export class Fiber {
185:   /** Unique id within the registry; 0 for the root fiber, `null` once disposed. */
186:   public uid: number | null
187:   /** The context this fiber's plugin runs in (extends the parent context). */
188:   public readonly ctx: Context
189:   /** The validated plugin config (updated by `update()`). */
190:   public config: any
191:   /** The raw plugin config, re-resolved before each activation. */
192:   public _config: any
193:   /** Current lifecycle state; transitions emit `internal/status`. */
194:   public state = FiberState.PENDING
195:   /** Dispose this fiber: unload the plugin, then settle once cleanup finished. */
196:   public readonly dispose: () => Promise<void>
197:   /** Snapshot of required service implementations while loaded; `undefined` otherwise. */
198:   public store: Dict<Impl> | undefined
199:   /** The in-flight load/unload transition, if one is currently running. */
200:   public inertia: Promise<void> | undefined
201: 
202:   public readonly _hooks: Dict<DisposableList<Function>> = Object.create(null)
203:   public readonly _disposables = new DisposableList<Disposable>()
204: 
205:   // Same as `this.ctx`, but with a more specific type.
206:   protected context: Context
207: 
208:   private _error: any
209:   private _runner: EffectRunner<string>
210:   private _store: Dict<Impl> = Object.create(null)
211: 
212:   /**
213:    * Create a fiber. Plugin authors normally obtain fibers from `ctx.plugin()`
214:    * rather than constructing them directly.
215:    *
216:    * @param parent — the context the plugin was loaded from.
217:    * @param config — raw config, validated against the runtime's schema.
218:    * @param inject — resolved dependency map (service name → intercept config).
219:    * @param runtime — the shared plugin runtime, or `null` for the root fiber.
220:    * @param getOuterStack — captures the caller stack for effect diagnostics.
221:    */
222:   constructor(
223:     public parent: Context,
224:     config: any,
225:     public inject: Dict<any>,
226:     public runtime: Plugin.Runtime | null,
227:     getOuterStack: () => string[],
228:   ) {
229:     this._config = config
230:     const collect = (dispose: Disposable) => {
231:       this._disposables.push(dispose)
232:     }
233: 
234:     if (runtime) {
235:       this.uid = parent.registry.counter
236:       this.ctx = this.context = parent.extend({ fiber: this })
237: 
238:       const injectEntries = Object.entries(this.inject)
239:       if (injectEntries.length) {
240:         this.ctx[Context.intercept] = Object.create(parent[Context.intercept])
241:         for (const [name, config] of injectEntries) {
242:           if (isNullable(config)) continue
243:           this.ctx[Context.intercept][name] = config
244:         }
245:       }
246: 
247:       this._runner = {
248:         epoch: INACTIVE,
249:         getOuterStack,
250:         execute: function () {
251:           if (isConstructor(runtime.callback)) {
252:             // eslint-disable-next-line new-cap
253:             const instance = new runtime.callback(this.ctx, this.config)
254:             for (const hook of instance?.[symbols.initHooks] ?? []) {
255:               hook()
256:             }
257:             return instance?.[symbols.init]?.()
258:           } else {
259:             return runtime.callback(this.ctx, this.config)
260:           }
261:         },
262:         collect,
263:       }
264: 
265:       this.dispose = parent.fiber.effect(() => {
266:         const remove = runtime.fibers.push(this)
267:         return async () => {
268:           this.uid = null
269:           emitPluginDisposed(this.context, this)
270:           if (this.ctx.registry.has(runtime.callback)) {
271:             remove()
272:             if (!runtime.fibers.length) {
273:               this.ctx.registry.delete(runtime.callback)
274:             }
275:           }
276:           this._setEpoch(INACTIVE)
277:           // A PENDING fiber can already own effects registered by an
278:           // internal/plugin observer. Its epoch is still INACTIVE, so
279:           // _setEpoch() has no transition to drive; explicitly unload that
280:           // pre-activation work before reporting disposal complete.
281:           if (!this.inertia) {
282:             this._updateState(() => {
283:               this.inertia = this._unload()
284:               return FiberState.UNLOADING
285:             })
286:           }
287:           // `this.inertia` itself should never reject — both `_reload` and
288:           // `_unload` swallow their own work errors via `ctx.logger.error`.
289:           // If it *does* reject, the only remaining cause is the logger
290:           // itself failing, which we can't recover from in this exact spot
291:           // (calling the logger again is what just failed). Let the
292:           // rejection propagate; process-level crash is the honest outcome.
293:           while (this.inertia) {
294:             await this.inertia
295:           }
296:         }
297:       }, 'ctx.plugin()')
298: 
299:       try {
300:         // Publish only after the parent owns a fully assigned disposer. A
301:         // synchronous observer may dispose either this fiber or its parent.
302:         this.context.emit('internal/plugin', this)
303:       } catch (error) {
304:         // Publication failed synchronously. The disposer removes the child
305:         // from both the parent and runtime before control escapes.
306:         void Promise.resolve(this.dispose()).catch(reason => this.ctx.logger.error(reason))
307:         throw error
308:       }
309: 
310:       // Keep the initial notification's historical PENDING view. The loader
311:       // may also extend `inject` in that notification, so resolve dependencies
312:       // only after publication. A reentrant parent unload makes the child
313:       // disposer responsible for draining any PENDING effects instead.
314:       if (this.uid !== null && parent.fiber.state !== FiberState.UNLOADING) {
315:         for (const name of Object.keys(this.inject)) {
316:           this._checkImpl(name)
317:         }
318:         this._refresh()
319:       }
320:     } else {
321:       this.uid = 0
322:       this.ctx = this.context = parent
323:       this.state = FiberState.ACTIVE
324:       this.store = Object.create(null)
325:       this._runner = {
326:         epoch: '',
327:         getOuterStack,
328:         execute: () => {},
329:         collect,
330:       }
331:       this.dispose = () => this.restart()
332:     }
333:   }
334: 
335:   /** The plugin's display name, inherited from the nearest named ancestor, else `'root'`. */
336:   get name() {
337:     let fiber: Fiber = this
338:     do {
339:       if (fiber.runtime?.name) return fiber.runtime.name
340:       fiber = fiber.parent.fiber
341:     } while (fiber !== fiber.parent.fiber)
342:     return 'root'
343:   }
344: 
345:   /**
346:    * Throw if the fiber has already been disposed.
347:    *
348:    * @returns nothing when the fiber is still active.
349:    * @throws {CordisError} `INACTIVE_EFFECT` when the fiber's uid has been cleared.
350:    */
351:   assertActive() {
352:     if (this.uid !== null) return
353:     throw new CordisError('INACTIVE_EFFECT')
354:   }
355: 
356:   private _execute<T>(runner: EffectRunner<T>) {
357:     const oldEpoch = runner.epoch
358:     return composeError((info) => {
359:       const safeCollect = (dispose: void | Disposable) => {
360:         if (typeof dispose === 'function') {
361:           runner.collect(dispose)
362:         } else if (!isNullable(dispose)) {
363:           throw new TypeError('Invalid effect')
364:         }

(Showing lines 95-364 of 754. Use offset=365 to continue.)
</content>

[tool • read]
<path>D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\src\fiber.ts</path>
<type>file</type>
<content>
560:     return wrapper
561:   }
562: 
563:   /**
564:    * Return metadata for currently registered effects.
565:    *
566:    * @returns one {@link EffectMeta} tree per labeled live effect.
567:    */
568:   getEffects() {
569:     return [...this._disposables]
570:       .map<EffectMeta>(dispose => dispose[symbols.effect])
571:       .filter(Boolean)
572:   }
573: 
574:   private _getState() {
575:     if (this.uid === null) return FiberState.DISPOSED
576:     if (this._error) return FiberState.FAILED
577:     if (this._runner.epoch !== INACTIVE) return FiberState.ACTIVE
578:     return FiberState.PENDING
579:   }
580: 
581:   private _updateState(callback: () => void | FiberState) {
582:     const oldState = this.state
583:     this.state = callback() ?? this._getState()
584:     if (oldState === this.state) return
585:     // FIXME internal/fiber-info
586:     this.context.emit('internal/status', this, oldState)
587: 
588:     // only notify changes between ACTIVE and NON-ACTIVE states
589:     if (oldState !== FiberState.ACTIVE && this.state !== FiberState.ACTIVE) return
590:     for (const key of Reflect.ownKeys(this.ctx.reflect.store)) {
591:       const impl = this.ctx.reflect.store[key as symbol]
592:       if (impl.fiber !== this) continue
593:       this.ctx.reflect.notify([impl.name])
594:     }
595:   }
596: 
597:   _checkImpl(name: string) {
598:     const impl = this.ctx.reflect._getImpl(name, true)
599:     if (!impl) return delete this._store[name]
600:     try {
601:       if (impl.check && !impl.check.call(getTraceable(this.ctx, impl.value))) {
602:         return delete this._store[name]
603:       }
604:     } catch (error) {
605:       impl.fiber.ctx.logger.error(error)
606:       return delete this._store[name]
607:     }
608:     this._store[name] = impl
609:   }
610: 
611:   _refresh() {
612:     let epoch: string | boolean = false
613:     epoch = ''
614:     for (const name of Object.keys(this.inject)) {
615:       const impl = this._store[name]
616:       if (!impl) {
617:         epoch = INACTIVE
618:         break
619:       }
620:       epoch += ':' + impl.fiber.uid
621:     }
622:     this._setEpoch(epoch)
623:   }
624: 
625:   private _setEpoch(epoch: string) {
626:     const oldEpoch = this._runner.epoch
627:     if (epoch === oldEpoch) return
628:     this._runner.epoch = epoch
629:     if (this.inertia) return
630:     this._updateState(() => {
631:       if (epoch !== INACTIVE && oldEpoch === INACTIVE) {
632:         this.inertia = this._reload()
633:         return FiberState.LOADING
634:       } else {
635:         this.inertia = this._unload()
636:         return FiberState.UNLOADING
637:       }
638:     })
639:   }
640: 
641:   private _resolveConfig(config: any) {
642:     config = this.context.waterfall(this, 'internal/config', config, () => config)
643:     return this.runtime ? resolveConfig(this.runtime, config) : config
644:   }
645: 
646:   private async _reload() {
647:     this.store = { ...this._store }
648:     const oldEpoch = this._runner.epoch
649:     try {
650:       await Promise.resolve()
651:       // A disposer queued before this checkpoint may already have invalidated
652:       // the load. Do not run plugin code for a stale epoch; the state update
653:       // below will drain any effects collected while the fiber was PENDING.
654:       if (this._runner.epoch === oldEpoch) {
655:         this.config = this._resolveConfig(this._config)
656:         await this._execute(this._runner)
657:         this._error = undefined
658:       }
659:     } catch (reason) {
660:       // impl guarantees that the error is non-null (?)
661:       this.ctx.logger.error(reason)
662:       this._error = reason
663:       this._runner.epoch = INACTIVE
664:     }
665:     this._updateState(() => {
666:       if (this._runner.epoch === oldEpoch) {
667:         this.inertia = undefined
668:       } else {
669:         this.inertia = this._unload()
670:         return FiberState.UNLOADING
671:       }
672:     })
673:   }
674: 
675:   private async _unload() {
676:     await Promise.all(this._disposables.clear().map(async (dispose) => {
677:       try {
678:         await composeError(async (info) => {
679:           await Promise.resolve()
680:           info.error = new Error()
681:           await runDisposable(dispose)
682:         }, this._runner.getOuterStack)
683:       } catch (reason) {
684:         this.ctx.logger.error(reason)
685:       }
686:     }))
687:     this.store = undefined
688:     this._updateState(() => {
689:       if (this._runner.epoch === INACTIVE) {
690:         this.inertia = undefined
691:       } else {
692:         this.inertia = this._reload()
693:         return FiberState.LOADING
694:       }
695:     })
696:   }
697: 
698:   /**
699:    * Wait for current lifecycle work and rethrow startup errors.
700:    *
701:    * @returns this fiber, once it has settled into a stable state.
702:    * @throws the config-validation or plugin-startup error, if any.
703:    */
704:   async await() {
705:     while (this.inertia) {
706:       await this.inertia
707:     }
708:     if (this._error) throw this._error
709:     return this
710:   }
711: 
712:   /**
713:    * Dispose and immediately reload this plugin with its current config.
714:    *
715:    * @returns a promise resolving once the reload settled.
716:    * @throws {CordisError} `INACTIVE_EFFECT` when the fiber is already disposed.
717:    */
718:   async restart() {
719:     this.assertActive()
720:     this._setEpoch(INACTIVE)
721:     this._refresh()
722:     await this.await()
723:   }
724: 
725:   /**
726:    * Validate and apply new config, then restart the plugin.
727:    *
728:    * Runs the `internal/update` waterfall first, so update hooks (and HMR)
729:    * can veto or replace the restart.
730:    *
731:    * @param config — the new raw config; validated before anything restarts.
732:    * @param noSave — hint for persistence hooks not to write the change back.
733:    * @returns nothing; the restart runs behind the `internal/update` waterfall.
734:    * @throws {ValidationError} when the new config fails validation.
735:    */
736:   update(config: any, noSave = false) {
737:     this.assertActive()
738:     this._config = config
739:     if (this.state !== FiberState.ACTIVE) {
740:       // Config resolution may access injected services, so defer it until the
741:       // fiber can activate.
742:       this._error = undefined
743:       this._setEpoch(INACTIVE)
744:       this._refresh()
745:       return
746:     }
747:     config = this._resolveConfig(config)
748:     this.context.waterfall(this, 'internal/update', config, noSave, () => {
749:       this.config = config
750:       this._error = undefined
751:       return this.restart()
752:     })
753:   }
754: }

(End of file - total 754 lines)
</content>

[tool • read]
<path>D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\src\registry.ts</path>
<type>file</type>
<content>
190:  * Plugin registry installed as `ctx.registry` and mixed into every context.
191:  *
192:  * It normalizes plugin shapes, tracks plugin runtimes, starts fibers, and
193:  * exposes map-like inspection over active plugin callbacks.
194:  */
195: export class RegistryService {
196:   private _counter = 0
197:   private _internal = new Map<Function, Plugin.Runtime>()
198: 
199:   constructor(public ctx: Context) {
200:     defineProperty(this, symbols.tracker, {
201:       property: 'ctx',
202:       noShadow: true,
203:     })
204:   }
205: 
206:   /** Allocate the next fiber uid (increments on every read). */
207:   get counter() {
208:     return ++this._counter
209:   }
210: 
211:   /** Number of registered plugin runtimes. */
212:   get size() {
213:     return this._internal.size
214:   }
215: 
216:   /**
217:    * Resolve a supported plugin shape to its executable callback.
218:    *
219:    * @param plugin — a function, class, or `{ apply }` object plugin.
220:    * @returns the callback identifying the plugin, or `undefined` if invalid.
221:    */
222:   resolve(plugin: Plugin): Function | undefined {
223:     // plugin.apply may throw
224:     try {
225:       if (typeof plugin === 'function') return plugin
226:       if (isApplicable(plugin)) return plugin.apply
227:     } catch {}
228:   }
229: 
230:   /**
231:    * Look up the runtime record for a plugin.
232:    *
233:    * @param plugin — any supported plugin shape.
234:    * @returns the runtime, or `undefined` when the plugin is not registered.
235:    */
236:   get(plugin: Plugin) {
237:     const key = this.resolve(plugin)
238:     return key && this._internal.get(key)
239:   }
240: 
241:   /**
242:    * Check whether a plugin has a registered runtime.
243:    *
244:    * @param plugin — any supported plugin shape.
245:    * @returns `true` when at least one fiber of the plugin exists.
246:    */
247:   has(plugin: Plugin) {
248:     const key = this.resolve(plugin)
249:     return !!key && this._internal.has(key)
250:   }
251: 
252:   /**
253:    * Dispose every running fiber for a plugin and remove its runtime record.
254:    *
255:    * @param plugin — any supported plugin shape.
256:    * @returns the removed runtime, or `undefined` when none was registered.
257:    */
258:   delete(plugin: Plugin) {
259:     const key = this.resolve(plugin)
260:     const runtime = key && this._internal.get(key)
261:     if (!runtime) return
262:     this._internal.delete(key)
263:     for (const fiber of runtime.fibers) {
264:       fiber.dispose()
265:     }
266:     return runtime
267:   }
268: 
269:   /** Iterate the registered plugin callbacks. */
270:   keys() {
271:     return this._internal.keys()
272:   }
273: 
274:   /** Iterate the registered plugin runtimes. */
275:   values() {
276:     return this._internal.values()
277:   }
278: 
279:   /** Iterate `[callback, runtime]` pairs. */
280:   entries() {
281:     return this._internal.entries()
282:   }
283: 
284:   /**
285:    * Visit every registered runtime.
286:    *
287:    * @param callback — receives each runtime and its identifying callback.
288:    */
289:   forEach(callback: (value: Plugin.Runtime, key: Function) => void) {
290:     return this._internal.forEach(callback)
291:   }
292: 
293:   /**
294:    * Start a callback once the requested dependencies are available.
295:    *
296:    * @param inject — required services, as an array or a name → config map.
297:    * @param callback — plugin body called with `(ctx, config)`.
298:    * @returns the fiber; awaiting it settles once loading finished.
299:    */
300:   inject(inject: Inject, callback: Plugin.Function<void>) {
301:     return this.plugin({ inject, apply: callback, name: callback.name })
302:   }
303: 
304:   /**
305:    * Start a plugin in the current context and return its fiber.
306:    *
307:    * Creates (or reuses) the plugin's runtime record, then starts a new fiber
308:    * under the current context. Throws if `plugin` is not a supported shape or
309:    * if the current fiber is already disposed.
310:    *
311:    * @param plugin — a function, class, or `{ apply }` object plugin.
312:    * @param config — the plugin config, validated against its `Config` schema.
313:    * @param getOuterStack — captures the caller stack for effect diagnostics.
314:    * @returns the fiber; awaiting it settles once loading finished.
315:    */
316:   plugin(plugin: Plugin, config?: any, getOuterStack = buildOuterStack()) {
317:     // check if it's a valid plugin
318:     const callback = this.resolve(plugin)
319:     if (!callback) throw new Error('invalid plugin, expect function or object with an "apply" method, received ' + typeof plugin)
320:     this.ctx.fiber.assertActive()
321: 
322:     let runtime = this._internal.get(callback)
323:     if (!runtime) {
324:       let name = plugin.name
325:       if (name === 'apply') name = undefined
326:       runtime = { name, callback, fibers: new DisposableList(), Config: plugin.Config }
327:       this._internal.set(callback, runtime)
328:     }
329: 
330:     const fiber = new Fiber(this.ctx, config, Inject.resolve(plugin.inject), runtime, getOuterStack)
331:     const wrapped = Object.create(fiber) as Fiber & PromiseLike<Fiber>
332:     wrapped.then = (onFulfilled, onRejected) => {
333:       return fiber.await().then(onFulfilled, onRejected)
334:     }
335:     return wrapped
336:   }
337: }

(End of file - total 337 lines)
</content>

[assistant]
Excellent. Now I have hard evidence for the cordis core. Let me record the key findings:

**FiberState (cordis/src/fiber.ts:147-154)** — `const enum`:
```
PENDING = 0, LOADING = 1, ACTIVE = 2, FAILED = 3, DISPOSED = 4, UNLOADING = 5
```
Plugin's `FIBER_NAMES = ['pending','loading','active','failed','disposed','unloading']` → **index-exact match** ✔. This is a critical verification: the numeric enum ordering still matches. BUT it's a `const enum` and not exported from `lib/index.js` (inlined at compile time) — the plugin doesn't import it, it hardcodes the array. So as long as ordering holds, ✔. Note: `const enum` inlines means runtime can't expose names; plugin's approach is the only option. ✔ 成立.

**Fiber members verified:**
- `uid: number | null` ✔ (fiber.ts:186) — `entry.fiber.uid` ✔
- `_config: any` ✔ (fiber.ts:192) — private-ish but public TS field ✔
- `state` ✔ (fiber.ts:194)
- `dispose: () => Promise<void>` ✔ (fiber.ts:196) — awaits fine ✔
- `store`, `inertia` ✔
- `parent: Context` (constructor param `public parent`) ✔ (fiber.ts:223) → `fiber.parent.registry.plugin(...)` ✔ (registry is mixed into ctx via `ctx.registry`)
- `runtime: Plugin.Runtime | null` ✔ (fiber.ts:226) → `fiber.runtime.callback` ✔
- `await()` ✔ (fiber.ts:704)
- `restart()` ✔ (fiber.ts:718)
- `update(config, noSave)` ✔ (fiber.ts:736)
- **`fiber.entry`** — NOT in Fiber class! `entry` is a loader-side concept. The plugin assigns `fiber.entry` ad-hoc (`if (fiber.entry) fiber.entry.fiber = fiber`). It's set by the loader's Entry class. Need to check loader source. If loader sets `fiber.entry`, ✔; the plugin's manual assignment is defensive.

**RegistryService (registry.ts:195-337):**
- `get(plugin)` ✔ :236
- `has(plugin)` :247
- `delete(plugin)` :258 — **⚠️ takes a PLUGIN, not a fiber!** It resolves `plugin` → callback key. The plugin calls `ctx.registry.delete(oldPlugin)` and `ctx.registry.delete(fresh)` — passing **namespace/plugin objects**, which is correct usage ✔. But wait, earlier in the plugin there's `registry.delete(fiber)` at older line numbers (L1176-1180 from my earlier recon: `if (registry && typeof registry.delete === 'function' && typeof registry.plugin === 'function') { registry.delete(fiber); const nf = registry.plugin(fresh, ...) }`). Passing a **fiber** to `delete()` → `resolve(fiber)` → `typeof fiber === 'function'`? A Fiber instance is not a function, and `isApplicable(fiber)` → fiber.apply? Fiber has no `apply` → returns undefined → `delete` returns early. So `registry.delete(fiber)` is a **no-op**! That's a latent bug — but it's in the plugin's own healed code path and the same code then does `registry.plugin(...)`. Actually more importantly `ctx.registry.delete(oldPlugin)` where oldPlugin is a namespace object `{...exports}` — `resolve(namespace)`: `typeof ns === 'function'`? For a module namespace, no. `isApplicable(ns)` → `ns.apply` — is `apply` an export? The plugin exports `apply` as a named export! So a module namespace object DOES have `.apply` → `isApplicable` true → returns `ns.apply`. So `registry.delete(namespaceWithApplyExport)` works ✔ because the plugin export includes `apply`.

Hmm, that's subtle: `resolve` on a namespace works only if the namespace has an `apply` member (i.e., the plugin exports `apply`). The super-injector does export `apply`? Let me check: `export const name = 'dsh-super-injector'` and `export function apply(ctx)`. Yes likely. And `inject`/`Config`. So ✔.

But `registry.delete(fiber)` → no-op. Need to flag this as a **plugin-internal latent bug** (P2), not a runtime drift. Let me verify the exact line and how it's used. From the earlier grep at line 1176: `if (registry && typeof registry.delete === 'function' && typeof registry.plugin === 'function') { registry.delete(fiber) ... }`. Let me check `fiber` variable there — it's `entry.fiber`. So yes, passing fiber → no-op. Then `registry.plugin(fresh, config, ()=>[])` creates a new fiber. The old fiber isn't disposed via registry.delete... but they may dispose it elsewhere. Actually `runtime.fibers` push/dispose is handled by the fiber's own disposer (fiber.ts:265-297) registered under `parent.fiber.effect`. So the old fiber gets removed if disposed. Anyway — not a compat issue per se.

- `plugin(plugin, config?, getOuterStack = buildOuterStack())` ✔ :316 — returns `wrapped` (a Fiber-like with `.then`). Note the plugin calls `rebootCtx.registry.plugin(plugin, cfg, entry.getOuterStack)` — third arg is `getOuterStack` ✔ matches.
- `counter` getter increments ✔ :207
- `size`, `keys`, `values`, `entries`, `forEach` ✔

**Critical: `registry.plugin()` throws `INACTIVE_EFFECT`/`assertActive` if ctx.fiber disposed** (registry.ts:320 `this.ctx.fiber.assertActive()`).

Now I need the loader package. Let me read cordis-plugin-loader/src/index.ts, internal.ts, config/entry.ts.

Also need `DisposableList` for `runtime.fibers`.

Let me read those three files.

Let me also record: `Plugin.Runtime` shape = `{ name, callback, fibers: DisposableList, Config }` (registry.ts:326).

Now read loader files.

Let me batch reads: index.ts (full, 7.3KB ~200 lines), internal.ts (5.8KB ~170 lines), config/entry.ts (8KB ~230 lines).

Let me do it.

Also given context pressure, I'm accumulating a lot. I should compress soon. But let me gather first.

Actually, let me be strategic about total effort. The user asked for S0+S1. S1 = 契约面枚举 with 对照表. I should produce the deliverables. Let me not over-read; read the loader essentials, then host essentials, then client essentials, then write up.

Let me read loader now.

[assistant]
<acp tokens="60" type="text">m00145</acp>
Cordis 内核已确证。关键发现：`FiberState` 是 `const enum`，数值序 `PENDING=0, LOADING=1, ACTIVE=2, FAILED=3, DISPOSED=4, UNLOADING=5`——与插件硬编码的 `FIBER_NAMES` 逐位一致。继续读 loader。

[assistant • read]
{"file_path":"D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai\\cordis-plugin-loader\\src\\index.ts"}

[assistant • read]
{"file_path":"D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai\\cordis-plugin-loader\\src\\internal.ts"}

[assistant • read]
{"file_path":"D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai\\cordis-plugin-loader\\src\\config\\entry.ts"}

[tool • read]
<path>D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis-plugin-loader\src\index.ts</path>
<type>file</type>
<content>
1: import { Context, FiberState, Inject, Service, type Fiber } from '@deepseek-ai/cordis'
2: import { defineProperty, isNullable, type Dict } from '@deepseek-ai/cosmokit'
3: import { ModuleLoader } from './internal.ts'
4: import { Entry, type EntryOptions } from './config/entry.ts'
5: import { EntryGroup } from './config/group.ts'
6: import isolate from './config/isolate.ts'
7: import { EntryTree } from './config/tree.ts'
8: import { interpolate } from './config/utils.ts'
9: 
10: /** Re-export entry node APIs. */
11: export * from './config/entry.ts'
12: /** Re-export nested entry group APIs. */
13: export * from './config/group.ts'
14: /** Re-export service isolation helpers. */
15: export * from './config/isolate.ts'
16: /** Re-export entry tree persistence APIs. */
17: export * from './config/tree.ts'
18: /** Re-export loader config expression helpers. */
19: export * from './config/utils.ts'
20: /** Re-export Node internal module loader compatibility types. */
21: export * from './internal.ts'
22: 
23: declare module '@deepseek-ai/cordis' {
24:   interface Events {
25:     'exit'(signal: NodeJS.Signals): Promise<void>
26:     'loader/config-update'(): void
27:     'loader/entry-init'(entry: Entry): void
28:     'loader/partial-dispose'(entry: Entry, legacy: Partial<EntryOptions>, active: boolean): void
29:     /**
30:      * Volatile config values were committed into the running fiber without a remount; dispatched to the owning fiber only.
31:      * @param paths - changed config paths as key arrays; every value is committed before dispatch.
32:      * @mode emit
33:      */
34:     'loader/volatile-update'(paths: readonly (readonly string[])[]): void
35:     /**
36:      * Refresh entry context before applying config.
37:      * @param entry - entry containing the new raw config and optional current fiber.
38:      * @param next - continue context refresh and Loader's config update.
39:      * @mode waterfall
40:      */
41:     'loader/patch-context'(entry: Entry, next: () => void): void
42:   }
43: 
44:   interface Context {
45:     loader: Loader
46:   }
47: 
48:   interface EnvData {
49:     startTime?: number
50:   }
51: 
52:   interface Fiber {
53:     entry?: Entry
54:   }
55: }
56: 
57: /** Loader config and dependency intercept namespace. */
58: export namespace Loader {
59:   /** Root loader configuration. */
60:   export interface Config {
61:     /** Base URL used to resolve relative plugin specifiers and config paths. */
62:     baseUrl?: string
63:   }
64: 
65:   /** Intercept config used when other plugins depend on `loader`. */
66:   export interface Intercept {
67:     /** Keep dependent plugins pending while loader entries are still loading. */
68:     await?: boolean
69:   }
70: }
71: 
72: /**
73:  * Service that owns a loader entry tree and imports configured plugins.
74:  *
75:  * Subclasses provide persistence by implementing `write()` on `EntryTree`.
76:  */
77: export class Loader extends EntryTree {
78:   declare [Service.config]: Loader.Intercept
79: 
80:   public envData = process.env.CORDIS_SHARED
81:     ? JSON.parse(process.env.CORDIS_SHARED)
82:     : { startTime: Date.now() }
83: 
84:   public name = 'loader'
85:   public internal = ModuleLoader.fromInternal()
86: 
87:   public builtins: Dict<any> = Object.create(null)
88: 
89:   constructor(ctx: Context, public config: Loader.Config = {}) {
90:     super(ctx)
91:     if (config.baseUrl) {
92:       this.ctx.baseUrl = config.baseUrl
93:     }
94:     const self = this
95: 
96:     defineProperty(this, Service.tracker, {
97:       associate: 'loader',
98:       property: 'ctx',
99:       noShadow: true,
100:     })
101: 
102:     ctx.reflect.provide('loader', this, this[Service.check])
103: 
104:     ctx.on('internal/config', function (this: Fiber, _config, next) {
105:       const config = next()
106:       if (!this.entry || this.parent.fiber?.entry === this.entry) return config
107:       // Tree carriers (Group, Include) keep their configs literal: their
108:       // entry and patch lists hold other rows' configs, whose `!!js`
109:       // expressions belong to those rows' own fibers.
110:       const plugin = this.runtime?.callback as Record<PropertyKey, unknown> | undefined
111:       if (plugin?.[EntryGroup.key]) return config
112:       return interpolate(this.ctx, config)
113:     }, { global: true })
114: 
115:     ctx.on('internal/update', function (config, noSave, next) {
116:       if (!this.entry || noSave || this.parent.fiber?.entry === this.entry) return next()
117:       const unparse = this.runtime?.Config?.['simplify']
118:       this.entry.options.config = unparse ? unparse.call(this.runtime!.Config, config) : config
119:       this.entry.parent.tree.write()
120:       return next()
121:     }, { global: true, prepend: true })
122: 
123:     ctx.on('internal/update', function (config, _, next) {
124:       if (!this.entry || this.parent.fiber?.entry === this.entry) return next()
125:       self.showLog(this.entry, 'reload')
126:       return next()
127:     }, { global: true })
128: 
129:     ctx.on('internal/plugin', (fiber) => {
130:       // 1. set `fiber.entry`
131:       if (fiber.parent[Entry.key] && !fiber.entry) {
132:         fiber.entry = fiber.parent[Entry.key]
133:         // FIXME merge config
134:         Inject.resolve(fiber.entry!.options.inject, fiber.inject)
135:       }
136: 
137:       // 2. handle self-dispose
138:       // We only care about `ctx.fiber.dispose()`, so we need to filter out other cases.
139: 
140:       // case 1: fiber is created
141:       if (fiber.uid) return
142: 
143:       // case 2: fiber is not tracked by loader
144:       if (!fiber.entry) return
145: 
146:       // case 3: fiber is a child plugin under the entry (not the entry's root fiber)
147:       if (fiber.parent.fiber?.entry === fiber.entry) return
148: 
149:       // case 4: fiber is disposed on behalf of plugin deletion (such as plugin hmr)
150:       // self-dispose: ctx.fiber.dispose() -> fiber / runtime dispose -> delete(plugin)
151:       // plugin hmr: delete(plugin) -> runtime dispose -> fiber dispose
152:       if (!ctx.registry.has(fiber.runtime!.callback)) return
153: 
154:       // case 5: the entry's tree is being disposed
155:       const treeOwner = fiber.entry.parent.tree.ctx.fiber
156:       if (!treeOwner.uid || treeOwner.state === FiberState.UNLOADING) return
157: 
158:       this.showLog(fiber.entry, 'unload')
159: 
160:       // case 6: fiber is disposed by loader behavior
161:       // such as inject checker, config file update, ancestor group disable
162:       if (fiber.entry.disabled) return
163: 
164:       fiber.entry.options.disabled = true
165:       fiber.entry.parent.tree.write()
166:     })
167: 
168:     ctx.plugin(isolate)
169:   }
170: 
171:   write() {
172:     // Loader's root tree is in-memory; writes are no-ops.
173:   }
174: 
175:   [Service.check]() {
176:     const config: Loader.Intercept = Service.prototype[Service.resolveConfig].call(this)
177:     if (config.await && this.getTasks().length) return false
178:     return true
179:   }
180: 
181:   showLog(entry: Entry, type: string) {
182:     if (entry.options.group || !entry.parent.tree.enableLogs) return
183:     this.ctx.root.logger?.('loader').info('%s plugin %C', type, entry.options.name)
184:   }
185: 
186:   /** Return the loader entry id that owns `fiber`, if any. */
187:   locate(fiber = this.ctx.fiber) {
188:     while (1) {
189:       if (fiber.entry) return fiber.entry.id
190:       const next = fiber.parent.fiber
191:       if (fiber === next) return
192:       fiber = next
193:     }
194:   }
195: 
196:   /** Hook for hosts that can restart the process on full-reload requests. */
197:   exit() {
198:   }
199: 
200:   /** Normalize ESM/CJS/default export shapes before applying a plugin. */
201:   unwrapExports(exports: any) {
202:     if (isNullable(exports)) return exports
203:     exports = exports.default ?? exports
204:     // https://github.com/evanw/esbuild/issues/2623
205:     // https://esbuild.github.io/content-types/#default-interop
206:     if (!exports.__esModule) return exports
207:     return exports.default ?? exports
208:   }
209: }
210: 
211: export default Loader

(End of file - total 211 lines)
</content>

[tool • read]
<path>D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis-plugin-loader\src\internal.ts</path>
<type>file</type>
<content>
1: import { createRequire, type LoadHookContext } from 'node:module'
2: import type { Dict } from '@deepseek-ai/cosmokit'
3: 
4: /** Node internal module format names handled by loader hooks. */
5: export type ModuleFormat = 'builtin' | 'commonjs' | 'json' | 'module' | 'wasm'
6: /** Source payload accepted by Node internal module load hooks. */
7: export type ModuleSource = string | ArrayBuffer
8: 
9: /** Result returned by a Node internal resolve hook. */
10: export interface ResolveResult {
11:   format: ModuleFormat
12:   url: string
13: }
14: 
15: /** Result returned by a Node internal load hook. */
16: export interface LoadResult {
17:   format: ModuleFormat
18:   source?: ModuleSource
19: }
20: 
21: type LoadCacheData = ModuleJob // | Function
22: 
23: /** @see https://github.com/nodejs/node/blob/main/lib/internal/modules/esm/module_map.js */
24: interface LoadCache extends Omit<Map<string, Dict<LoadCacheData>>, 'get' | 'set' | 'has'> {
25:   get(url: string, type?: string): LoadCacheData | undefined
26:   set(url: string, type?: string, job?: LoadCacheData): this
27:   has(url: string, type?: string): boolean
28: }
29: 
30: /** Minimal Node internal ModuleWrap surface used by HMR helpers. */
31: export interface ModuleWrap {
32:   url: string
33:   getNamespace(): any
34: }
35: 
36: /** @see https://github.com/nodejs/node/blob/main/lib/internal/modules/esm/module_job.js */
37: export interface ModuleJob {
38:   url: string
39:   loader: ModuleLoader
40:   module?: ModuleWrap
41:   importAttributes: ImportAttributes
42:   linked: Promise<ModuleJob[]>
43:   instantiate(): Promise<void>
44:   run(): Promise<{ module: ModuleWrap }>
45: }
46: 
47: /**
48:  * Node 22/23 ModuleLoader interface.
49:  *
50:  * Key methods:
51:  * - getModuleJobForImport(specifier, parentURL, importAttributes)
52:  * - resolve(specifier, parentURL, importAttributes) → Promise<ResolveResult>
53:  * - resolveSync(specifier, parentURL, importAttributes) → ResolveResult
54:  */
55: export interface ModuleLoaderV1 {
56:   version: 'v1'
57:   loadCache: LoadCache
58:   import(specifier: string, parentURL: string, importAttributes: ImportAttributes): Promise<any>
59:   register(specifier: string | URL, parentURL?: string | URL, data?: any, transferList?: any[]): void
60:   getModuleJobForImport(specifier: string, parentURL: string, importAttributes: ImportAttributes): Promise<ModuleJob>
61:   resolve(specifier: string, parentURL: string, importAttributes: ImportAttributes): Promise<ResolveResult>
62:   resolveSync(specifier: string, parentURL: string, importAttributes: ImportAttributes): ResolveResult
63:   load(specifier: string, context: Pick<LoadHookContext, 'format' | 'importAttributes'>): Promise<LoadResult>
64: }
65: 
66: /** Node 24+ module request object. */
67: export interface ModuleRequest {
68:   specifier: string
69:   attributes?: ImportAttributes
70:   phase?: ModulePhase
71: }
72: 
73: /** @see https://github.com/nodejs/node/blob/main/src/module_wrap.h */
74: export const enum ModulePhase {
75:   Source = 1,
76:   Evaluation = 2,
77: }
78: 
79: /** Opaque Node internal module request type marker. */
80: export type ModuleRequestType = unknown // internal symbols
81: 
82: /**
83:  * Node 24+ ModuleLoader interface.
84:  *
85:  * Breaking changes from v1:
86:  * - getModuleJobForImport removed → getOrCreateModuleJob(parentURL, request, requestType)
87:  * - resolve removed (became private #resolve) → resolveSync(parentURL, request)
88:  * - Parameter order reversed for resolveSync, request object { specifier, attributes }
89:  * - LoadCache became typed Map<url, { [type]: ModuleJob }> with delete only setting undefined
90:  */
91: export interface ModuleLoaderV2 {
92:   version: 'v2'
93:   loadCache: LoadCache
94:   import(specifier: string, parentURL: string, importAttributes: ImportAttributes, phase?: ModulePhase, isEntryPoint?: boolean): Promise<any>
95:   register(specifier: string | URL, parentURL?: string | URL, data?: any, transferList?: any[], isInternal?: boolean): void
96:   getOrCreateModuleJob(parentURL: string, request: ModuleRequest, requestType?: ModuleRequestType): Promise<ModuleJob>
97:   resolveSync(parentURL: string, request: ModuleRequest): ResolveResult
98:   load(url: string, context: Pick<LoadHookContext, 'format' | 'importAttributes'>): Promise<LoadResult>
99: }
100: 
101: /** Supported Node internal ESM loader shapes. */
102: export type ModuleLoader = ModuleLoaderV1 | ModuleLoaderV2
103: 
104: /** Helpers for locating the current Node internal module loader. */
105: export namespace ModuleLoader {
106:   let _cachedLoader: ModuleLoader | undefined
107: 
108:   function requireInternal(id: string): any {
109:     const require = createRequire(import.meta.url)
110:     if (process.execArgv.includes('--expose-internals')) {
111:       try {
112:         return require(id)
113:       } catch {}
114:     }
115:     try {
116:       return require('node-addon-require-builtin').requireBuiltin(id)
117:     } catch {}
118:   }
119: 
120:   /**
121:    * Locate and classify the running Node internal module loader.
122:    *
123:    * The shape is decided by which module-job API the loader owns, never by the
124:    * Node version: v2 landed in 24.12.0, so a major-version test mistags every
125:    * 24.0–24.11.1 loader as v2 and makes consumers call `resolveSync` with
126:    * reversed parameters. Arity is not usable either — `resolveSync` reports 2
127:    * under both shapes. A loader owning neither API is left unclassified rather
128:    * than guessed, so consumers take their documented no-internals path.
129:    * @returns the classified loader, or `undefined` when none is reachable or its shape is unknown.
130:    */
131:   export function fromInternal(): ModuleLoader | undefined {
132:     if (_cachedLoader) return _cachedLoader
133:     const [major] = process.versions.node.split('.').map(Number)
134:     if (major < 22) return
135: 
136:     const raw = requireInternal('internal/modules/esm/loader')?.getOrInitializeCascadedLoader()
137:     if (!raw) return
138:     const version = typeof raw.getOrCreateModuleJob === 'function'
139:       ? 'v2'
140:       : typeof raw.getModuleJobForImport === 'function' ? 'v1' : undefined
141:     if (!version) return
142:     return _cachedLoader = Object.assign(raw, { version })
143:   }
144: }

(End of file - total 144 lines)
</content>

[tool • read]
<path>D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis-plugin-loader\src\config\entry.ts</path>
<type>file</type>
<content>
1: import { Context, Fiber, FiberState, Inject, resolveConfig } from '@deepseek-ai/cordis'
2: import { deepEqual, isNullable, updateVolatile, volatileEntries, type Volatile } from '@deepseek-ai/cosmokit'
3: import { Loader } from '../index.ts'
4: import { EntryGroup } from './group.ts'
5: import { EntryTree } from './tree.ts'
6: import { evaluate, isJsExpr } from './utils.ts'
7: import { equalExceptVolatile } from './diff.ts'
8: 
9: /** Serialized plugin entry options stored in loader config files. */
10: export interface EntryOptions {
11:   /** Stable id inside the containing entry tree. */
12:   id: string
13:   /** Module specifier imported by the entry tree. */
14:   name: string
15:   /** Config passed to the plugin. */
16:   config?: any
17:   /** Marks this entry as a nested group. */
18:   group?: boolean | null
19:   /** Prevents this entry and descendants from running. */
20:   disabled?: boolean | null
21:   /** Required services or service intercept config for this entry. */
22:   inject?: Inject | null
23: }
24: 
25: function takeEntries(object: {}, keys: string[]) {
26:   const result: [string, any][] = []
27:   for (const key of keys) {
28:     if (!(key in object)) continue
29:     result.push([key, object[key]])
30:     delete object[key]
31:   }
32:   return result
33: }
34: 
35: function sortKeys<T extends {}>(object: T, prepend = ['id', 'name'], append = ['config']): T {
36:   const part1 = takeEntries(object, prepend)
37:   const part2 = takeEntries(object, append)
38:   const rest = takeEntries(object, Object.keys(object)).sort(([a], [b]) => a.localeCompare(b))
39:   return Object.assign(object, Object.fromEntries([...part1, ...rest, ...part2]))
40: }
41: 
42: /** One configured plugin node inside an `EntryTree`. */
43: export class Entry {
44:   static readonly key = Symbol.for('cordis.entry')
45: 
46:   public ctx: Context
47:   public fiber?: Fiber
48:   public parent!: EntryGroup
49:   // safety: call `entry.update()` immediately after creating an entry
50:   public options = {} as EntryOptions
51:   public subgroup?: EntryGroup
52:   public subtree?: EntryTree
53: 
54:   _initTask?: Promise<void>
55: 
56:   constructor(public loader: Loader) {
57:     this.ctx = loader.ctx.extend({ [Entry.key]: this })
58:     this.context.emit('loader/entry-init', this)
59:   }
60: 
61:   get context(): Context {
62:     return this.ctx
63:   }
64: 
65:   get id() {
66:     let id = this.options.id
67:     if (this.parent.tree.ctx.fiber.entry) {
68:       id = this.parent.tree.ctx.fiber.entry.id + EntryTree.sep + id
69:     }
70:     return id
71:   }
72: 
73:   /** True when this entry or any owning parent entry is disabled. */
74:   get disabled() {
75:     // group is always enabled
76:     if (this.options.group) return false
77:     let entry: Entry | undefined = this
78:     do {
79:       if (this.disabledOf(entry.options)) return true
80:       entry = entry.parent.ctx.fiber.entry
81:     } while (entry)
82:     return false
83:   }
84: 
85:   /**
86:    * Effective disabled state: a `!!js` expression evaluates against the loader
87:    * context. The raw node stays in the options, so write-back keeps the form.
88:    */
89:   private disabledOf(options: EntryOptions): boolean {
90:     return isJsExpr(options.disabled)
91:       ? Boolean(this.evaluate(options.disabled.__jsExpr))
92:       : Boolean(options.disabled)
93:   }
94: 
95:   evaluate(expr: string) {
96:     return evaluate(this.ctx, expr)
97:   }
98: 
99:   private _patchContext(diff: string[]) {
100:     this.context.waterfall('loader/patch-context', this, () => {
101:       Object.setPrototypeOf(this.ctx, this.parent.ctx)
102: 
103:       if (this.fiber?.uid && (diff.includes('config') || this.options.group)) {
104:         this.fiber.update(this.options.config, true)
105:       }
106:     })
107:   }
108: 
109:   async refresh() {
110:     if (this.fiber) return
111:     if (this.disabled) return
112:     await this.init()
113:   }
114: 
115:   /** Merge new options, restart as needed, and persist through the parent tree. */
116:   async update(options: Partial<EntryOptions>, create = false, force = false) {
117:     const legacy = { ...this.options }
118: 
119:     // step 1: update options
120:     if (create) {
121:       this.options = options as EntryOptions
122:     } else {
123:       for (const [key, value] of Object.entries(options)) {
124:         if (isNullable(value)) {
125:           delete this.options[key]
126:         } else {
127:           this.options[key] = value
128:         }
129:       }
130:     }
131:     sortKeys(this.options)
132: 
133:     // step 2: execute
134:     if (this.disabled) {
135:       this.fiber?.dispose()
136:       return
137:     }
138: 
139:     // step 3: check if options are changed
140:     if (this.fiber?.uid) {
141:       const changes = Object.keys({ ...this.options, ...legacy })
142:         .filter(key => !deepEqual(this.options[key], legacy[key], key === 'config'))
143:       // Only an active fiber in an unchanged context takes volatile-only config changes without a remount.
144:       const volatileOnly = changes.length === 1 && changes[0] === 'config'
145:         && this.fiber.state === FiberState.ACTIVE && Object.getPrototypeOf(this.ctx) === this.parent.ctx
146:         && equalExceptVolatile(legacy.config, this.options.config, this.fiber.runtime?.Config)
147:       if (volatileOnly) this.fiber._config = this.options.config
148:       const pending = volatileOnly && this._commitVolatile() ? [] : changes
149:       if (!pending.length && !force) return
150:       this.context.emit('loader/partial-dispose', this, legacy, true)
151:       this._patchContext(pending)
152:     } else {
153:       await this.init()
154:     }
155:   }
156: 
157:   /**
158:    * Parse a volatile-only raw config change and commit its values into the running fiber's references.
159:    * An invalid candidate is logged and leaves the running references unchanged; the raw config stays retained for the next activation.
160:    * @returns `false` when an ordinary effective value changed, so the caller applies the ordinary update lifecycle.
161:    */
162:   private _commitVolatile(): boolean {
163:     const fiber = this.fiber!
164:     const refs = volatileEntries(fiber.config)
165:     if (!refs.length) return true
166:     const raw = this.options.config
167:     let candidate: unknown
168:     try {
169:       candidate = resolveConfig(fiber.runtime!, fiber.ctx.waterfall(fiber, 'internal/config', raw, () => raw))
170:     } catch (error) {
171:       this.ctx.logger.warn('volatile config update failed for %C', this.options.id)
172:       this.ctx.logger.warn(error)
173:       return true
174:     }
175:     if (!deepEqual(fiber.config, candidate, true)) {
176:       this.ctx.logger.debug('ordinary config values of %C changed with its volatile values; applying the ordinary update', this.options.id)
177:       return false
178:     }
179:     const paths = refs.flatMap(({ path, ref }) => {
180:       const source = path.reduce<unknown>((value, key) => Reflect.get(value as object, key), candidate) as Volatile<unknown>
181:       if (deepEqual(ref.get(), source.get(), true)) return []
182:       updateVolatile(ref, source)
183:       return [path]
184:     })
185:     if (!paths.length) return true
186:     const self: Context = Object.create(fiber.ctx)
187:     self[Context.filter] = (owner: Context) => owner.fiber === fiber
188:     try {
189:       fiber.ctx.emit(self, 'loader/volatile-update', paths)
190:     } catch (error) {
191:       // A listener failure must not fail the entry update; every value is already committed.
192:       this.ctx.logger.warn(error)
193:     }
194:     return true
195:   }
196: 
197:   getOuterStack = () => {
198:     let entry: Entry | undefined = this
199:     const result: string[] = []
200:     do {
201:       result.push(`    at ${entry.parent.tree.ctx.baseUrl}#${entry.options.id}`)
202:       entry = entry.parent.ctx.fiber.entry
203:     } while (entry)
204:     return result
205:   }
206: 
207:   /** Import and start the configured plugin if it is not already running. */
208:   async init() {
209:     try {
210:       await (this._initTask ??= this._init())
211:     } finally {
212:       this._initTask = undefined
213:     }
214:     const notify = () => {
215:       if (this.loader.getTasks().length) return
216:       this.ctx.reflect.notify(['loader'])
217:     }
218:     this.fiber?.await().then(notify, notify)
219:   }
220: 
221:   private async _init() {
222:     let exports: any
223:     try {
224:       exports = await this.parent.tree.import(this.options.name, this.getOuterStack)
225:     } catch (error) {
226:       this.ctx.logger.error(error)
227:       return
228:     } finally {
229:       this._initTask = undefined
230:     }
231:     const plugin = this.loader.unwrapExports(exports)
232:     this._patchContext([])
233:     this.loader.showLog(this, 'apply')
234:     this.fiber = this.ctx.registry.plugin(plugin, this.options.config, this.getOuterStack).ctx.fiber
235:   }
236: }

(End of file - total 236 lines)
</content>