[assistant]
Now I have decisive evidence that `- insert:` IS still supported: `cordis-plugin-include/src/index.ts:77-100` — `const { id, insert, name, ...overrides } = patch; if (insert) { if (id) { target = map.get(id); if (!target) warn('patch insert: entry %C not found'); else target.config.push(...insert) } else data.push(...insert) }`.

So the plugin's root `cordis.patch.yml` form `- insert: [...]` (no id) → `data.push(...insert)` ✔ **VALID**.

And `dsh-agent-preset/skills/cordis-plugin-development/references/host-plugin.md:20-27` gives the canonical modern bundle patch — identical to the plugin's shape. **Confirmed adapted.**

Now I still need:
- dsh-tools: `defineTool` export + parameters/output shape
- dsh-system-prompt: `system-prompt/assemble` event + `ctx.systemPrompt.context(...)`
- dsh-host-webserver: `register({kind:'prefix'})` + `exact/prefixes/upgrades` tables
- dsh-client-ui-slots: `inject`/`register` signatures
- dsh-package-manifest: field validation
- dsh-llm: `createUserMessage`, `ReasoningEffortId`

Let me grep those lib/index.js files for the relevant symbols.

Let me batch several greps.

Also read the ui-plugin.md reference (authoritative for client plugins) and templates/decoration/client.js — that's the canonical current client plugin shape. Very valuable for comparing with the super-injector's client.

Let me batch:
1. read ui-plugin.md
2. read templates/decoration/client.js + index.js + package.json + cordis.patch.yml
3. grep dsh-tools/lib/index.js for defineTool
4. grep dsh-system-prompt/lib/index.js for assemble/context
5. grep dsh-host-webserver/lib/index.js for register/kind/prefixes/exact/upgrades
6. grep dsh-client-ui-slots/lib/index.js for inject/register/settings.section

Let me do this in one batch (6 calls).

Context is growing; I'll compress after this.

Let me go.

[assistant]
<acp tokens="75" type="text">m00181</acp>



**`- insert:` 确证仍受支持**：`cordis-plugin-include/src/index.ts:77-100` 解构 `{ id, insert, name, ...overrides }`，无 `id` 时 `data.push(...insert)`。且官方技能 `host-plugin.md:20-27` 给出的规范 patch 与插件根 `cordis.patch.yml` **逐字同形**。

[assistant • read]
{"file_path":"D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai\\dsh-agent-preset\\skills\\cordis-plugin-development\\references\\ui-plugin.md"}

[assistant • read]
{"file_path":"D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai\\dsh-agent-preset\\skills\\cordis-plugin-development\\templates\\decoration\\client.js"}

[assistant • grep]
{"line_numbers":true,"head_limit":40,"path":"D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai\\dsh-tools\\lib\\index.js","pattern":"defineTool|register\\(|parameters|render|presentation|output"}

[assistant • grep]
{"line_numbers":true,"head_limit":40,"path":"D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai\\dsh-system-prompt\\lib\\index.js","pattern":"assemble|context\\s*\\(|class SystemPrompt|tools"}

[assistant • grep]
{"line_numbers":true,"head_limit":40,"path":"D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai\\dsh-host-webserver\\lib\\index.js","pattern":"register|kind|prefixes|exact|upgrades"}

[assistant • grep]
{"line_numbers":true,"head_limit":40,"path":"D:\\WorkSpace\\Agents\\DSH-Desktop\\DSH Desktop\\resources\\app\\node_modules\\@deepseek-ai\\dsh-client-ui-slots\\lib\\index.js","pattern":"inject|register|settings\\.section|conversation\\.view|label"}

[tool • read]
<path>D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-agent-preset\skills\cordis-plugin-development\references\ui-plugin.md</path>
<type>file</type>
<content>
1: # UI plugins in the Web page
2: 
3: Read `templates/decoration/` with the file-read tool and write its files into your bundle directory: its `package.json` adds a `dsh.client` section (`platform`, `immediately`, `inject`) and a `./client` export beside the bundle patch.
4: 
5: `index.js` exports `export function apply() {}`; the patch inserts one row named after the package. For a simple drawing, prefer a slot with allocated space, such as `conversation.composer.dock` when available. Keep the first version within that slot's flow; do not plan a motion path around host controls. Use `shell.overlay` only when the request needs an overlay and its placement is known.
6: 
7: ## Client module
8: 
9: The browser artifact registers a lazy factory whose id equals the package name. React comes from the browser module table; no duplicate React installation, CDN script, or UMD search is needed. For compiled sources, use the deployment's Client build tooling to emit this format; declare non-baseline runtime imports in `dsh.client.external`.
10: 
11: `templates/decoration/client.js` registers a lazy factory into `conversation.composer.dock` through `ctx.slots.inject` and `ctx.slots.register`; follow the selected slot's props and options from `Slots.listSubTree` when you change the slot.
12: 
13: Keep factories free of side effects. Register styles, timers, listeners and other resources inside `apply` with `ctx.effect`/`ctx.on` and return their cleanup functions. Component-local styles can render as React elements so unmounting removes them. Verify disposal for resources you add. Inherit the host theme for containers and controls; artwork may use its own colors. A page or panel beyond a decoration follows the UI rules in `references/practices.md`. Route visible UI text through the Client locale service. Do not replace the app root or append a second application to `document.body`. Do not read another plugin's DOM, stylesheet, or component source to estimate placement; choose a slot that already allocates space.

(End of file - total 13 lines)
</content>

[tool • read]
<path>D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-agent-preset\skills\cordis-plugin-development\templates\decoration\client.js</path>
<type>file</type>
<content>
1: window.__ModuleLoader__.load({
2:   id: '@local/my-decoration',
3:   factory(require) {
4:     const React = require('react');
5:     const h = React.createElement;
6:     function Decoration() {
7:       return h('svg', {
8:         viewBox: '0 0 64 64', width: 48, height: 48,
9:         'aria-hidden': true,
10:         style: { display: 'block', pointerEvents: 'none' },
11:       }, h('circle', { cx: 32, cy: 32, r: 24, fill: '#247bbf' }));
12:     }
13:     return {
14:       inject: ['slots'],
15:       apply(ctx) {
16:         ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
17:           name: 'conversation.composer.dock', id: 'my-decoration', order: 5,
18:         }, Decoration));
19:       },
20:     };
21:   },
22: });

(End of file - total 22 lines)
</content>

[tool • grep]
Found 178 matches

D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-tools\lib\index.js
Line 10: * Enforced JSON Schema subset shared by tool outputs, generated PTC mode
Line 330: * subagent and workflow structured outputs.
Line 337: 	if (violations.length === 0 && (!isJsonSchemaRecord(schema) || !Object.hasOwn(schema, "type") || schema.type !== "object")) violations.push("schema.type must be \"object\" (structured output is object-rooted)");
Line 803: 	const compiled = compilePropertyMap(spec, "parameters");
Line 834: * rendering for obsolete logged arguments.
Line 838: function defineTool(options) {
Line 842: 	const userRender = options.output.render;
Line 843: 	const userPresentationMeta = options.output.presentationMeta;
Line 847: 	if (options.timeoutMs !== void 0 && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) throw new Error(`defineTool(${options.name}): timeoutMs must be a positive finite number`);
Line 848: 	const parameters = parameterSchemaSpecToJsonSchema(options.parameters);
Line 849: 	const outputSchema = valueSchemaSpecToJsonSchema(options.output.schema);
Line 850: 	const validate = (args) => validateJsonSchemaValue(parameters, args, "");
Line 854: 		parameters,
Line 855: 		output: {
Line 856: 			schema: outputSchema,
Line 857: 			render(args, value) {
Line 860: 			...userPresentationMeta !== void 0 ? { presentationMeta(args, value) {
Line 906: 	description: "Execute a TypeScript program against the available tools. Takes two required arguments: `code`, the BODY of an async function (erasable syntax only; top-level `await` and `return` work), and `description`, a short summary of what the program does. Call tools as `await tools.name(args)` per the declarations in the system prompt. Only what you print or return is program output — curate it. Image-bearing subtool results are attached after the run.",
Line 913: 		description: "Execute a Python program against the available tools. Takes two required arguments: `code`, the BODY of an async function (top-level `await` and `return` work), and `description`, a short summary of what the program does. Call tools as `await tools.name(args)` per the declarations in the system prompt. Use `print(...)` and/or `return <value>` for program output — curate it. Image-bearing subtool results are attached after the run.",
Line 920: * static spec and the language-aware `parameters` getter so the two emissions
Line 1013: /** Two-space JSON presentation, matching the existing shallow `run_code` text contract. */
Line 1017: * renderer also caps TOTAL indentation there, compacting deeper subtrees, so
Line 1018: * formatted output remains linear in the canonical JSON size.
Line 1022: function renderJsonValue(value) {
Line 1059: 				if (item === void 0) throw new Error("cannot render a sparse JSON array");
Line 1086: 			if (key === void 0) throw new Error("cannot render a missing JSON object key");
Line 1089: 			if (item === void 0) throw new Error("cannot render an undefined JSON object property");
Line 1105: function renderValue(value) {
Line 1106: 	return typeof value === "string" ? value : renderJsonValue(value);
Line 1110: * `description` parameters, executed through the dispatch bridge described
Line 1112: * registry reserves it as presentation infrastructure under non-native modes,
Line 1121: 	const definition = defineTool({
Line 1124: 		parameters: {
Line 1137: 		output: {
Line 1173: 			render: (_args, value) => {
Line 1174: 				const rendered = value.result === void 0 ? "" : renderValue(value.result);
Line 1175: 				const parts = [value.logs.join("\n"), rendered].filter((part) => part.length > 0);
Line 1180: 					text: parts.length > 0 ? parts.join("\n") : "(run_code completed with no output)"
Line 1432: 					const logsText = result.logs.length > 0 ? `\nCaptured output:\n${result.logs.join("\n")}` : "";
Line 1460: 	Object.defineProperty(definition, "parameters", {
Line 1490: function renderKey(name) {
Line 1504: function renderScalar(value) {
Line 1508: function renderConstrainedScalar$1(node, type) {
Line 1510: 	if (Object.hasOwn(node, "const")) return renderScalar(node.const);
Line 1511: 	if (Object.hasOwn(node, "enum")) return node.enum.map(renderScalar).join(" | ");
Line 1542: /** Initialize one schema-render frame with empty aggregation state. */
Line 1555: function renderSupportedSchema(schema, indent) {
Line 1572: 				if (child === void 0) throw new Error("missing schema render child");
Line 1604: 				parts.push("\n", `${pad$1(frame.indent + 1)}${renderKey(name)}${required.has(name) ? "" : "?"}: `, child, ";");
Line 1633: 				finish(typeDocument(renderConstrainedScalar$1(node, node.type)));
Line 1683: 		return flattenTypeDocument(renderSupportedSchema(schema, indent));
Line 1688: /** The fixed model-facing usage contract rendered above the declarations (see the PTC mode Agent Note's "What the model sees"). */
Line 1697: - Emit results with \`return\` and/or \`console.log(...)\`. Only what you print or return is program output. A successful tool result containing an image is attached after the run so you can inspect it on the next step; every other intermediate result stays out of the conversation, so extract just what you need.
Line 1705: function renderBashExample(schemas) {
Line 1708: 	const parameters = bash.parameters;
Line 1709: 	if (parameters.type !== "object") return "";
Line 1710: 	const required = parameters.required ?? [];
Line 1712: 	if (!acceptsExampleString(parameters.properties?.command, "pwd")) return "";
Line 1714: 	if (needsDescription && !acceptsExampleString(parameters.properties?.description, "Show current directory")) return "";
Line 1723: * would render in argument order; the caller's visible-capability map is keyed
Line 1729: function renderToolsSdk(schemas) {
Line 1732: 	const outputMembers = [];
Line 1735: 		argsMembers.push(`${pad$1(1)}${renderKey(schema.name)}: ${jsonSchemaToTs(schema.parameters, 1)};`);
Line 1736: 		outputMembers.push(`${pad$1(1)}${renderKey(schema.name)}: ${jsonSchemaToTs(schema.output, 1)};`);
Line 1740: 		`interface ToolOutputMap {${outputMembers.length > 0 ? `\n${outputMembers.join("\n")}\n` : ""}}`,
Line 1754: 	return `${SDK_INSTRUCTIONS$1}${renderBashExample(sorted)}\n\n${SDK_PROGRAM_INSTRUCTIONS}\n\n\`\`\`ts\ntype JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }\n\n${declaration}\n\`\`\``;
Line 1767: * descriptions, and canonical output shapes; under `mode: 'both'` the native schemas ship
Line 1768: * alongside it and it is one of two. Object-shaped arguments and outputs therefore render as one
Line 1828: * predicate rejected. A tool named `zz-\u{1E4D0}x` with such parameters never
Line 1857: * class-syntax `TypedDict` field. Such a tool renders under subscript access
Line 1917: /** `indent`-deep line prefix (four spaces per level to match PEP 8 output). */
Line 1982: * Control characters left over after the whitespace collapse are rendered as
Line 2046: * nested parentheses`), so an array chain deeper than that would render an SDK
Line 2063: *   worst case. Reachable only through a raw `register()` whose `parameters`
Line 2068: *   the 181 site. `defineTool` compiles an object root, so the annotation is a
Line 2073: * configurable. The sibling `ts-types` renderer needs no counterpart: nothing
Line 2075: * checked. Only bracket nesting counts — a `oneOf` renders as a flat `A | B`
Line 2076: * chain and nested objects render as separate `class` statements, so neither
Line 2078: * grammatical validity; see the `oneOf` arm in {@link renderType} for the one
Line 2084: * why capping keeps the render linear). `slice` counts UTF-16 code units, so
Line 2141: * type renders directly as `None`, and the unified validator rejects a null
Line 2161: * `JSON.stringify` is also what keeps this path's output parseable, and it is
Line 2194: * parameters to int/bool/str/bytes/enum/None: a non-integral number
Line 2198: * PEP 586 admits int parameters. Harmless either way — the stub is advisory
Line 2202: function renderConstrainedScalar(node, broad, state) {
Line 2215: * collect the `TypedDict` declarations and `typing` symbols a full render
Line 2221: * {@link ./ts-types.ts | ts-types} renderer. {@link jsonSchemaToPy} is the
Line 2224: function renderType(schema, className, state) {
Line 2253: 					if (child === void 0) throw new Error("missing python render child");
Line 2313: 					finish(renderConstrainedScalar(node, "str", state));
Line 2316: 					finish(renderConstrainedScalar(node, "float", state));
Line 2319: 					finish(renderConstrainedScalar(node, "int", state));
Line 2322: 					finish(renderConstrainedScalar(node, "bool", state));
Line 2386: * to `dict[str, Any]`: naming a `TypedDict` requires the render context that
Line 2387: * {@link renderToolsSdkPy} supplies), `const`/`enum` (→ `Literal[...]`),
Line 2396: 	return renderType(schema, "", {
Line 2403: /** The fixed model-facing usage contract rendered above the declarations. */
Line 2411: - Emit the run's answer with \`print(...)\` and/or a top-level \`return <value>\`; the returned value must be lossless JSON. Only what you print and return is program output. A successful tool result containing an image is attached after the run so you can inspect it on the next step; every other intermediate result stays out of the conversation, so extract just what you need.
Line 2417: * per tool argument or output object (and per nested object) and one awaitable
Line 2419: * canonical output value out — with a `tools: Tools` singleton the model calls
Line 2420: * into. The `typing` import line lists exactly the symbols the render used.
Line 2425: * byte-equal names, so two schemas sharing a name would render in argument
Line 2428: * @param schemas - the tool schemas plus canonical output schemas to declare
Line 2432: function renderToolsSdkPy(schemas) {
Line 2443: 		const argType = renderType(schema.parameters, `${camelCase(schema.name)}Args`, state);
Line 2444: 		const outputType = renderType(schema.output, `${camelCase(schema.name)}Output`, state);
Line 2447: 			members.push(doc.length > 0 ? `${pad(1)}async def ${schema.name}(self, args: ${argType}) -> ${outputType}:` : `${pad(1)}async def ${schema.name}(self, args: ${argType}) -> ${outputType}: ...`);
Line 2451: 			members.push(`${pad(1)}# tools[${JSON.stringify(schema.name)}](args: ${argType}) -> ${outputType}`);
Line 2473: * @returns a registry-ready tool with an explicit JSON-array output contract.
Line 2478: 	return defineTool({
Line 2480: 		output: {
Line 2482: 			render: (_args, value) => value
Line 2492: * Tool registry, model presentation modes, and pre/guard/around/post/result
Line 2497: * Language → SDK-section renderer. The registry looks up the loaded
Line 2503: * its `run_code` schema strings — plus the renderer function this table points
Line 2519: 	typescript: renderToolsSdk,
Line 2520: 	python: renderToolsSdkPy
Line 2541: 	*   name IS visible and only the presentation denies calling it directly.
Line 2549: /** Thrown when a tool body or post-policy value violates its declared output. */
Line 2554: 		super(`tool "${toolName}" returned invalid output: ${violations.join("; ")}`, "INVALID_TOOL_OUTPUT");
Line 2559: /** Convert one projector exception into the canonical invalid-output failure. */
Line 2561: 	return new ToolOutputError(toolName, [`output.${projector} failed: ${errorMessage(error)}`]);
Line 2567: 		if (detached === void 0) throw new ToolOutputError(toolName, [`output.${projector} returned non-lossless JSON`]);
Line 2574: /** Snapshot one body or policy value into the canonical invalid-output failure class. */
Line 2600: /** Derive one failure message from policy feedback without changing its rendered blocks. */
Line 2661: * one visibility resolver feeds presentation, lookup, and dispatch.
Line 2697: 	* Reserved presentation transport, kept outside the filterable registration
Line 2715: 	* {@link sdkSection} is and rendering empty outside an effective `ptc`.
Line 2718: 	* them qualify how that tool is reached, and they all render before the SDK.
Line 2725: 	* `both` renders empty: native calls do execute there, so the rule is false.
Line 2739: 	* The body regenerates from the CALLING scope, and renders empty for an
Line 2742: 	* dropped from the rendered prompt.
Line 2754: 				const render = SDK_RENDERERS[runtime.language];
Line 2756: 				if (render === void 0) throw new Error(`dsh-tools: no SDK renderer for ${runtime.language}`);
Line 2757: 				return render(this.sdkSchemas(context.scope));
Line 2762: 	* The presentation one scope's agent sees: its own declaration, else the
Line 2765: 	* @returns the resolved presentation mode.
Line 2807: 	* @param mode - the presentation the covered agents' models see.
Line 2812: 		if (scopeOf(ctx) === void 0) throw new Error("tools.presentAs() requires a scoped context (agent.ctx): a context-global presentation is the `mode` config field on the tools row");
Line 2815: 				if (layer.mode !== void 0) throw new Error(`tools.presentAs("${mode}") conflicts with "${layer.mode}" already declared for this scope; one composition selects one presentation`);
Line 2868: 			throw new Error(`dsh-tools: no SDK renderer registered for runtime language ${JSON.stringify(runtime.language)} (known: ${known})`);
Line 2875: 	* @param definition - tool schema, execution, and optional finalization/presentation callbacks.
Line 2878: 	register(definition) {
Line 2880: 		const output = definition.output;
Line 2881: 		if (output === void 0 || typeof output !== "object" || typeof output.render !== "function" || output.presentationMeta !== void 0 && typeof output.presentationMeta !== "function") throw new TypeError(`tool "${name}" must declare output { schema, render, presentationMeta? }`);
Line 2882: 		assertSupportedJsonSchema(output.schema);
Line 2885: 		if (name === "run_code") throw new Error(`tool name "${RUN_CODE_NAME}" is reserved for the PTC mode presentation transport and cannot be registered or shadowed`);
Line 2886: 		return this.layers.effect(this.ctx, (layer) => layer.tools.insert(name, definition), { label: "tools.register()" });
Line 2905: 		if ([...allow ?? [], ...deny ?? []].includes("run_code")) throw new Error(`tools.restrict() cannot name reserved PTC mode presentation transport "${RUN_CODE_NAME}"; restrict end-capability tools instead`);
Line 2940: 	* scope's own registrations and the reserved presentation transport; the
Line 2947: 	* the delegation runtime registers a child's structured-output tool into the
Line 2989: 	* the calling agent so the rendered card matches the definition that
Line 3001: 	* (`get`) is presentation-agnostic; here a MODEL-DIRECT call under `ptc`
Line 3019: 	* excluding execution and presentation callbacks.
Line 3029: 			const output = snapshotJsonValue(definition.output.schema);
Line 3031: 			if (output === void 0) throw new Error(`tool "${definition.name}" output schema must be lossless JSON before SDK projection`);
Line 3034: 				output
Line 3040: 		const { name, description, parameters, deferLoading } = definition;
Line 3041: 		const detached = detachParameters ? snapshotJsonValue(parameters) : parameters;
Line 3042: 		if (detached === void 0) throw new Error(`tool "${name}" parameters must be lossless JSON before schema projection`);
Line 3046: 			parameters: detached,
Line 3092: 	* `dsh-agent-tool-presentation` exists for, and reading the deployment default would
Line 3096: 	* @param scope - the viewing scope whose effective presentation mode applies.
Line 3540: 	/** Snapshot, validate, render, and optionally project one successful body value. */
Line 3543: 		const violations = validateJsonSchemaValue(tool.output.schema, detached, "value");
Line 3546: 		let rendered;
Line 3548: 			rendered = tool.output.render(exec.arguments, value);
Line 3550: 			throw projectionError(tool.name, "render", error);
Line 3552: 		const content = snapshotProjection(tool.name, "render", rendered);
Line 3554: 		if (exec.parent === void 0 && tool.output.presentationMeta !== void 0) {
Line 3557: 				projected = tool.output.presentationMeta(exec.arguments, value);
Line 3559: 				throw projectionError(tool.name, "presentationMeta", error);
Line 3561: 			meta = snapshotProjection(tool.name, "presentationMeta", projected);
Line 3572: 	/** Normalize an around-dispatch wrapper's authored result through the owning output contract. */
Line 3592: 		const presentation = {
Line 3600: 			...presentation
Line 3605: 				...presentation,
Line 3714: export { CodeRunFailedError, JsonSchemaError, RUN_CODE_NAME, TOOL_ABORTED, TOOL_ABORTED_BEFORE_DISPATCH, TOOL_RUNTIME_SCHEDULER, ToolArgsError, ToolNotFoundError, ToolOutputError, ToolRuntime, ToolRuntime as default, assertObjectJsonSchema, assertSupportedJsonSchema, defineContentToolFixture, defineTool, jsonSchemaToPy, jsonSchemaToTs, parameterSchemaSpecToJsonSchema, renderToolsSdk, renderToolsSdkPy, validateArgs, validateJsonSchemaValue, valueSchemaSpecToJsonSchema };

[tool • grep]
Found 23 matches

D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-system-prompt\lib\index.js
Line 62: /** Reserved {@link Config.toolOrder} marker for unlisted tools. */
Line 63: const TOOL_ORDER_REST = "<unlisted-tools>";
Line 75: 	if (!seen.has("<unlisted-tools>")) throw new Error(`toolOrder must contain the "${TOOL_ORDER_REST}" rest entry (where unlisted tools are inserted)`);
Line 79: * Apply configured tool order, inserting unlisted tools lexicographically at
Line 83: function orderTools(tools, toolOrder, knownNames) {
Line 84: 	if (tools.find((tool) => tool.name === "<unlisted-tools>") !== void 0) throw new Error(`tool provider returned reserved tool name "${TOOL_ORDER_REST}" (reserved for toolOrder's rest entry)`);
Line 85: 	if (toolOrder === void 0) return tools.sort(compareToolNames);
Line 86: 	const unknown = toolOrder.filter((name) => name !== "<unlisted-tools>" && !knownNames.has(name));
Line 87: 	if (unknown.length > 0) throw new Error(`toolOrder lists unregistered tool${unknown.length > 1 ? "s" : ""} ${unknown.map((name) => `"${name}"`).join(", ")}; known tools: ${[...knownNames].sort().join(", ") || "(none)"}`);
Line 89: 	const rest = tools.filter((tool) => !listed.has(tool.name)).sort(compareToolNames);
Line 90: 	return toolOrder.flatMap((name) => name === "<unlisted-tools>" ? rest : tools.filter((tool) => tool.name === name));
Line 138: * The same snapshot, kept as the named contributions it was assembled from.
Line 199: /** Registry service for the prompt inputs assembled before each model step. */
Line 266: 	context(context) {
Line 268: 		return this.layers.effect(this.ctx, (layer) => layer.contexts.insert(context.name, context), { label: "systemPrompt.context()" });
Line 286: 	tools(provider) {
Line 287: 		return this.layers.effect(this.ctx, (layer) => layer.toolProviders.append(provider), { label: "systemPrompt.tools()" });
Line 310: 	async assemble(context = {}) {
Line 340: 				const assembled = {
Line 345: 				if (section.complete === true) completeSection = { ...assembled };
Line 346: 				return assembled;
Line 352: 			tools: orderTools(collected, this.toolOrder, knownNames),
Line 355: 		const transformed = await this.ctx.waterfall(scopeTarget(this, scope), "system-prompt/assemble", assembly, context, () => Promise.resolve(assembly));

[tool • grep]
Found 23 matches

D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-host-webserver\lib\index.js
Line 25: 	switch (row.kind) {
Line 136: * during startup with 404 until its owner registers. A listen failure rejects
Line 148: 	exact = /* @__PURE__ */ new Map();
Line 149: 	prefixes = /* @__PURE__ */ new Map();
Line 150: 	upgrades = /* @__PURE__ */ new Map();
Line 172: 	* Register a named route. Duplicate (kind, path) throws — route patterns are
Line 174: 	* @param route - kind, path, and the owning handler.
Line 177: 	register(route) {
Line 178: 		const table = route.kind === "exact" ? this.exact : this.prefixes;
Line 179: 		if (table.has(route.path)) throw new Error(`webserver: duplicate ${route.kind} route "${route.path}"`);
Line 186: 	* Register an exact-path HTTP upgrade route. Duplicate paths throw because
Line 191: 	registerUpgrade(route) {
Line 192: 		if (this.upgrades.has(route.path)) throw new Error(`webserver: duplicate upgrade route "${route.path}"`);
Line 193: 		this.upgrades.set(route.path, route);
Line 195: 			this.upgrades.delete(route.path);
Line 206: 	registerFallback(handler) {
Line 207: 		if (this.fallback !== void 0) throw new Error("webserver: fallback already registered");
Line 274: 				route = this.upgrades.get(new URL(req.url ?? "/", "http://x").pathname);
Line 322: 	/** Longest-prefix-wins over the prefix table after an exact-table miss. */
Line 324: 		const exact = this.exact.get(pathname);
Line 325: 		if (exact !== void 0) return exact;
Line 327: 		for (const [prefix, route] of this.prefixes) {
Line 334: 	* Run an index.html body through the registered taps in registration order

[tool • grep]
Found 16 matches

D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-client-ui-slots\lib\index.js
Line 4: * @param name - registered fixed or keyed source name.
Line 21: * Resolve a possibly-thunked list label at read time (thunks follow the
Line 23: * `options.label` raw).
Line 24: * @param label - the stored label.
Line 27: function resolveSlotLabel(label) {
Line 28: 	return typeof label === "function" ? label() : label;
Line 74: 	registerFactory = ((rawOptions, component) => {
Line 97: 			...options.inject === void 0 ? {} : { inject: options.inject },
Line 127: 	* Read one registered Factory definition.
Line 156: 	* Return whether a retained Factory definition is still registered.
Line 163: 	register(options, component) {
Line 168: 		const occupantHint = (occupant) => `at priority ${priority}${occupant.registrant !== void 0 ? ` (registered by ${occupant.registrant})` : ""} — register at a different priority to shadow it (lowest renders)`;
Line 210: 				...options.label !== void 0 ? { label: options.label } : {},
Line 214: 			...options.inject !== void 0 ? { inject: options.inject } : {},
Line 245: 	* Whether a previously obtained entry is still registered (the render
Line 256: 	* Snapshot the registered entries for a key. Returns the cached array