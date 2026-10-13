# DSH runtime ↔ dsh-super-injector 静态契约审计

- 审计日期：2026-02（本次会话）
- 权威 runtime 根：`D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\`
- cordis：`4.0.4`，`cordis-plugin-loader`：`1.0.5`（见各自 `package.json`）
- 运行时 Node：`v24.14.1`
- 被审计插件：`D:\WorkSpace\AgentWorks\DSH\dsh-routing-suite-xsc\injector\src\index.ts`
- 审计方式：只读。优先读官方随包发布的 `src/*.ts`（loader/cordis 均带源码），无效时读 `lib/*.js`。

> 说明：本目录下的两个包**都随包发布了 `src/`**，因此结论以 `src/*.ts` 为准，并用 `lib/*.js` 交叉验证（打包产物行号一并给出，便于日后 grep）。

### 关键路径常量（后文按缩写引用）

| 缩写 | 绝对路径 |
| --- | --- |
| `LOADER_SRC` | `D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis-plugin-loader\src` |
| `LOADER_LIB` | `D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis-plugin-loader\lib\index.js` |
| `CORDIS_SRC` | `D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\src` |
| `BOOT_APP` | `D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-app-boot\lib\index.js` |
| `HMR_LIB` | `D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh-hmr\lib\index.js` |
| `PROFILE_PKG` | `D:\WorkSpace\Agents\DSH\profiles\desktop\package.json` |
| `PROFILE_PATCH` | `D:\WorkSpace\Agents\DSH\profiles\desktop\cordis.patch.yml` |
| `PLUGIN` | `D:\WorkSpace\AgentWorks\DSH\dsh-routing-suite-xsc\injector\src\index.ts` |

---

## Q1. `loader.entries()` / `entry.options` / `entry.fiber` / `fiber.state` 枚举

### 结论

**成立（完全一致）**，四处用法均与 4.0.4 / 1.0.5 契约吻合：

1. `loader.entries()` **存在**，是 `EntryTree` 上的**生成器方法**（不是数组），递归遍历本树及 `entry.subtree`。
2. 迭代产出的是 `Entry` 实例，其 `options` 是 `EntryOptions`，字段为 `id` / `name` / `config` / `group` / `disabled` / `inject`。插件读的 `name` / `id` / `config` / `group` / `disabled` **全部存在**。
3. `entry.fiber?: Fiber` **存在**（public，可选）。
4. `fiber.state` 取值域与插件假设的 6 元字符串数组**逐位完全一致**。

### 证据

**(1) `entries()` 是生成器** — `LOADER_SRC\config\tree.ts:26-33`

```ts
  /** Iterate entries in this tree and any nested subtrees. */
  * entries(): Generator<Entry, void, void> {
    for (const entry of Object.values(this.store)) {
      yield entry
      if (!entry.subtree) continue
      yield* entry.subtree.entries()
    }
  }
```

`lib` 侧交叉验证：`LOADER_LIB:142` `*entries() {`（生成器语法原样保留）。
`Loader` 继承 `EntryTree`，故 `ctx.loader.entries()` 就是这一份：`LOADER_SRC\index.ts:77` `export class Loader extends EntryTree {`。

> 生成器本身不会妨碍插件的用法：插件在 `PLUGIN:603/681/829/1135/1165/1196/1243` 用的是 `for (const entry of ctx.loader.entries())`，在 `BOOT_APP:3486` 与插件其它位置用的是 `[...ctx.loader.entries()]` —— 两者对生成器都成立。**唯一约束**：`entries()` 是**一次性**迭代器，不能存下来遍历两次。

**(2) `EntryOptions` 字段** — `LOADER_SRC\config\entry.ts:9-23`

```ts
/** Serialized plugin entry options stored in loader config files. */
export interface EntryOptions {
  /** Stable id inside the containing entry tree. */
  id: string
  /** Module specifier imported by the entry tree. */
  name: string
  /** Config passed to the plugin. */
  config?: any
  /** Marks this entry as a nested group. */
  group?: boolean | null
  /** Prevents this entry and descendants from running. */
  disabled?: boolean | null
  /** Required services or service intercept config for this entry. */
  inject?: Inject | null
}
```

`Entry.options` 声明：`LOADER_SRC\config\entry.ts:50` `public options = {} as EntryOptions`。

**(3) `entry.fiber`** — `LOADER_SRC\config\entry.ts:46-52`

```ts
export class Entry {
  static readonly key = Symbol.for('cordis.entry')

  public ctx: Context
  public fiber?: Fiber
  public parent!: EntryGroup
  // safety: call `entry.update()` immediately after creating an entry
  public options = {} as EntryOptions
```

**(4) `FiberState` 枚举与数字顺序** — `CORDIS_SRC\fiber.ts:139-154`

```ts
/**
 * Lifecycle state for one plugin fiber.
 *
 * `PENDING` — waiting for required services; `LOADING` — the plugin callback
 * is running; `ACTIVE` — loaded and providing; `FAILED` — the callback or its
 * config threw; `UNLOADING` — disposers are running; `DISPOSED` — the fiber
 * was removed and cannot restart.
 */
export const enum FiberState {
  PENDING,
  LOADING,
  ACTIVE,
  FAILED,
  DISPOSED,
  UNLOADING,
}
```

即 `PENDING=0, LOADING=1, ACTIVE=2, FAILED=3, DISPOSED=4, UNLOADING=5`。

插件侧 `PLUGIN:530`：

```ts
const FIBER_NAMES = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading']
```

逐位比对：`0 pending=PENDING` ✅、`1 loading=LOADING` ✅、`2 active=ACTIVE` ✅、`3 failed=FAILED` ✅、`4 disposed=DISPOSED` ✅、`5 unloading=UNLOADING` ✅。

`fiber.state` 的初始化与赋值来源：`CORDIS_SRC\fiber.ts:194` `public state = FiberState.PENDING`，经 `_updateState()`（`CORDIS_SRC\fiber.ts:581-583` `this.state = callback() ?? this._getState()`）变更；`_getState()`（`CORDIS_SRC\fiber.ts:574-579`）只返回 `DISPOSED` / `FAILED` / `ACTIVE` / `PENDING` 四个之一。`UNLOADING` 与 `LOADING` 由 `_setEpoch` / `_reload` / `_unload` 显式置入（`fiber.ts:633,636,670,693`）。

### 对插件的影响

**用法成立，无漂移。** 唯一可注意点：`FiberState` 是 `const enum`，编译期被内联为数字字面量，因此运行时不存在 `FiberState` 对象可读；但 `fiber.state` 存的是数字，故 `FIBER_NAMES[entry.fiber.state]` 的映射运行期永远正确。

---

## Q2. `entry._dispose` 是否存在？

### 结论

**缺失（契约不存在）——这不是漂移，是彻底没有这个方法。** `_dispose` 在 cordis-plugin-loader 1.0.5 的 **src 与 lib、全部文件**中**出现 0 次**；整个 `@deepseek-ai/cordis-plugin-loader` 中 `_dispose` 与 `_disposing` 的匹配数均为 **0**。

因此 `PLUGIN:1063` 的守卫

```ts
if (!entry || typeof entry._dispose !== 'function') {
  throw new Error('selfEntry 无官方 _dispose（loader 契约缺失）')
}
```

**恒为真 → 恒抛错**，自重载（self-reload）的 reboot 路径是**死代码**，必然落到 `PLUGIN:1120` `scheduleHeal(selfEntry, 'reboot-failed')`。注意这**不是静默降级**：`PLUGIN:1116-1118` 会先 `logger.error` + `console.error` + `auditLog('reboot-failed', ...)`。

**无类型声明的私有 API** 判定：这里应当是反向的 —— 插件的注释把 `_dispose` 当作"官方契约"，但**官方从来就没有这个成员**（至少在 1.0.5 没有）。插件注释引用的 `entry.ts L214-246` 在该版本对应的是 `init()` / `_init()`，并非 REPLACE 分支：

- `LOADER_SRC\config\entry.ts:208-219` 是 `init()`
- `LOADER_SRC\config\entry.ts:221-235` 是 `_init()`

### 证据

穷举搜索（`src` + `lib`，全部扩展名，正则 `_dispose|_disposing`）返回空集。完整 `Entry` 类成员清单（`LOADER_SRC\config\entry.ts:43-236`，全文已读）为：

| 成员 | 行号 | 可见性 |
| --- | --- | --- |
| `static key` | 44 | public static |
| `ctx` | 46 | public |
| `fiber?` | 47 | public |
| `parent!` | 48 | public |
| `options` | 50 | public |
| `subgroup?` | 51 | public |
| `subtree?` | 52 | public |
| `_initTask?` | 54 | **public（唯一带下划线的 public 字段）** |
| `constructor` | 56 | — |
| `get context()` | 61 | public |
| `get id()` | 65 | public |
| `get disabled()` | 74 | public |
| `private disabledOf()` | 89 | private |
| `evaluate()` | 95 | public |
| `private _patchContext()` | 99 | private |
| `refresh()` | 109 | public |
| `update()` | 116 | public |
| `private _commitVolatile()` | 162 | private |
| `getOuterStack` | 197 | **public（箭头函数属性）** |
| `init()` | 208 | public |
| `private _init()` | 221 | private |

类边界终止于 `LOADER_SRC\config\entry.ts:236`（`}`）。**不存在 `_dispose`。**

唯一出现 `_dispose` 语义的替代物是 `EntryGroup.remove(id, isDispose)`（`LOADER_SRC\config\group.ts:37-46`）与 `entry.fiber?.dispose()`（`CORDIS_SRC\fiber.ts:196` 的 `public readonly dispose: () => Promise<void>`）。

### 对插件的影响

**严重不成立（缺失）。** `PLUGIN:1071` 的 `await entry._dispose()` 以及其承载的"官方 REPLACE 语义"（注释见 `PLUGIN:1049-1061`）无法执行。受影响的路径：

- `PLUGIN:1063` 守卫抛错 → `PLUGIN:1115-1120` catch → `scheduleHeal(..., 'reboot-failed')`
- 自愈（`PLUGIN:807` `scheduleHeal`）第一步是 **touch profile patch**（`PLUGIN:824` `appendFileSync(patchFile, '\n# super-injector heal ...')`），这在官方 HMR 下**确实有效**（见 Q10 的机制），所以"注入器缺席后自动复活"仍可能成功 —— 但自愈是**基于**死掉的 reboot 路径，且 `PLUGIN:1049-1061` 整套"REPLACE 语义"注释描述的机制在当前 runtime 中并不存在。

**修复方向**（供父 agent 决策，本次只读未改动）：官方等价的"重装配单条 entry"入口是 `Entry.update(options, create = false, force = false)`（`LOADER_SRC\config\entry.ts:116`）——其内部走 `_patchContext(pending)` → `fiber.update(this.options.config, true)`（`entry.ts:99-107`）完成 fiber 级重启；`force = true` 可绕过"options 无变化就早退"（`entry.ts:149` `if (!pending.length && !force) return`）。这不依赖任何 `_dispose`。

---

## Q3. `entry.parent.tree.import(name, fn)` 是否存在？

### 结论

**成立。**

- `entry.parent` 是 `EntryGroup`（`LOADER_SRC\config\entry.ts:48` `public parent!: EntryGroup`）。
- `EntryGroup.tree` 是 `EntryTree`（`LOADER_SRC\config\group.ts:11` `constructor(public ctx: Context, public tree: EntryTree) {`）。
- `EntryTree.import(name, getOuterStack?)` **存在**，签名与插件的调用方式 `(name, () => [])` 吻合。

### 证据

`LOADER_SRC\config\tree.ts:111-129`：

```ts
  /** Import a plugin module from a specifier or `cordis:` builtin. */
  import(name: string, getOuterStack?: () => string[]) {
    if (name.startsWith('cordis:')) {
      return this.ctx.loader.builtins[name.slice(7)]
    }
    return composeError(async (info) => {
      // ModuleJob.run
      // onImport.tracePromise.__proto__
      // internal.import
      info.offset += 3
      if (this.ctx.loader.internal) {
        return await this.ctx.loader.internal.import(name, this.ctx.baseUrl!, {})
      } else if (name.startsWith('.')) {
        return await import(/* @vite-ignore */new URL(name, this.ctx.baseUrl).href)
      } else {
        return await import(/* @vite-ignore */name)
      }
    }, getOuterStack)
  }
```

官方自身就是这样调用的（`LOADER_SRC\config\entry.ts:224`）：

```ts
      exports = await this.parent.tree.import(this.options.name, this.getOuterStack)
```

插件用法：`PLUGIN:1069` `await entry.parent.tree.import(entry.options.name, () => [])`。

### 对插件的影响

**成立。** 注释 `PLUGIN:1051` "import 新模块（经 entry.parent.tree——与 include 装配同路径）" 准确：`Entry._init()` 正是走 `parent.tree.import`。传 `() => []`（空 outer stack）是合法降级——第二个参数只是诊断用的栈帧生成器，官方在 include 装配时传 `entry.getOuterStack`。副作用：插件经此路径 import 的模块，报错栈不会带上 loader entry 位置信息。

---

## Q4. `entry.getOuterStack` 是否存在？

### 结论

**成立。**

它是 `Entry` 上的一个**公开箭头函数实例属性**（不是原型方法），因此天然已绑定 `this`，**可以安全地脱手传递**——这正是插件 `PLUGIN:1073` 把它当作 `registry.plugin(plugin, config, entry.getOuterStack)` 第三个参数直接传的前提。

### 证据

`LOADER_SRC\config\entry.ts:197-205`：

```ts
  getOuterStack = () => {
    let entry: Entry | undefined = this
    const result: string[] = []
    do {
      result.push(`    at ${entry.parent.tree.ctx.baseUrl}#${entry.options.id}`)
      entry = entry.parent.ctx.fiber.entry
    } while (entry)
    return result
  }
```

返回 `string[]`，每项形如 `    at <baseUrl>#<id>`。

注意 `entry.ts:201` 用的是**模板字符串反引号**，`${entry.parent.tree.ctx.baseUrl}` 与 `${entry.options.id}` 会被正常求值（不是 Q1 里 API 名的字符串化问题）；`entry.options.id` 在此恒有值，因为 `EntryGroup.create` 会先 `this.tree.ensureId(options)` 补齐 id（`LOADER_SRC\config\group.ts:21`）。

官方调用点（三处一致）：`LOADER_SRC\config\entry.ts:224`、`entry.ts:234`（`this.ctx.registry.plugin(plugin, this.options.config, this.getOuterStack)`）。

### 对插件的影响

**成立。** 插件在 `PLUGIN:1073` 传 `entry.getOuterStack`（而非 `() => []`）是对的：保持新 fiber 的错误栈可追溯到 loader entry，与官方 `_init()` 行为一致。

---

## Q5. `ctx.registry.plugin(plugin, config, outerStack)` / `fiber.await()` / `fiber.entry` / `fiber.parent` / `fiber.runtime.callback`

### 结论

**全部成立。** 逐项：

| 用法 | 位置 | 结论 |
| --- | --- | --- |
| `ctx.registry` | `PLUGIN:1175` `(ctx as any).registry`、`PLUGIN:1192` `ctx.registry.get(...)` | 成立（`Context` 上的访问器） |
| `registry.plugin(plugin, config, getOuterStack)` | `PLUGIN:1073/1178/1209` | 成立，第三参就是 `getOuterStack`，签名自 1.0.5 起含第三参 |
| 返回 fiber | `PLUGIN:1179` `nf.entry = entry` | 成立——返回**被 `Object.create(fiber)` 包装过的 fiber**（`Fiber & PromiseLike<Fiber>`），原型链继承真实 fiber，故 `nf.entry = ...` / `entry.fiber = nf` 都能被 loader 的 `internal/plugin` 观察者读到 |
| `fiber.await()` | `PLUGIN:1076` `await fiber.await()` | 成立（`CORDIS_SRC\fiber.ts:704`） |
| `fiber.entry` | `PLUGIN:1074` | 成立（loader 对 `Fiber` 的 module augmentation） |
| `fiber.parent` | `PLUGIN:1067`… 间接 | 成立（`CORDIS_SRC\fiber.ts:223` 构造器第一参 `public parent: Context`） |
| `fiber.runtime.callback` | `PLUGIN:1067` `entry.fiber?.runtime?.callback ?? null` | 成立（`Plugin.Runtime.callback`） |

### 证据

**`registry.plugin()`** — `CORDIS_SRC\registry.ts:316-336`

```ts
  plugin(plugin: Plugin, config?: any, getOuterStack = buildOuterStack()) {
    // check if it's a valid plugin
    const callback = this.resolve(plugin)
    if (!callback) throw new Error('invalid plugin, expect function or object with an "apply" method, received ' + typeof plugin)
    this.ctx.fiber.assertActive()

    let runtime = this._internal.get(callback)
    if (!runtime) {
      let name = plugin.name
      if (name === 'apply') name = undefined
      runtime = { name, callback, fibers: new DisposableList(), Config: plugin.Config }
      this._internal.set(callback, runtime)
    }

    const fiber = new Fiber(this.ctx, config, Inject.resolve(plugin.inject), runtime, getOuterStack)
    const wrapped = Object.create(fiber) as Fiber & PromiseLike<Fiber>
    wrapped.then = (onFulfilled, onRejected) => {
      return fiber.await().then(onFulfilled, onRejected)
    }
    return wrapped
  }
```

**官方对返回值取真实 fiber 的方式** — `LOADER_SRC\config\entry.ts:234`

```ts
    this.fiber = this.ctx.registry.plugin(plugin, this.options.config, this.getOuterStack).ctx.fiber
```

即官方用 `.ctx.fiber` 解包。**插件 `PLUGIN:1073-1075` 用的是另一种等价写法**：

```ts
const fiber = rebootCtx.registry.plugin(plugin, entry.options.config ?? {}, entry.getOuterStack)
fiber.entry = entry
entry.fiber = fiber
```

因为 `wrapped = Object.create(fiber)`，`wrapped.ctx` 经原型链即 `fiber.ctx`，且 `wrapped.ctx.fiber === fiber`（`CORDIS_SRC\fiber.ts:236` `this.ctx = this.context = parent.extend({ fiber: this })`）。所以 `entry.fiber = wrapped` 与官方 `entry.fiber = <真 fiber>` 在**读 `state` / `await()` / `parent` / `runtime` 时等价**（全部经原型链）。差异仅在于 `entry.fiber` 恒等性：`entry.fiber !== entry.fiber.ctx.fiber`（前者是包装对象）。这一点若被后续代码用 `===` 比较需注意，本次审计未见此类比较。

> 与 Q2 的对比要点：**官方赋值 `this.fiber` 时用的是真 fiber**；插件自行赋 `wrapped`。由于 `wrapped` 继承一切，实际功能风险低，但它是"非官方形状"。

**`inactive context` 的成因（插件 `PLUGIN:1055-1061` 的注释）** — `registry.plugin()` 第一件事就是 `this.ctx.fiber.assertActive()`（`registry.ts:320`），实现见 `CORDIS_SRC\fiber.ts:351-354`：

```ts
  assertActive() {
    if (this.uid !== null) return
    throw new CordisError('INACTIVE_EFFECT')
  }
```

`uid` 在 dispose 时被置 `null`（`CORDIS_SRC\fiber.ts:268` `this.uid = null`）。这**证实**了插件注释的判断：自重载时若用自身已销毁的 `ctx`（或其派生 ctx）作为 `registry` 的宿主，必抛 `INACTIVE_EFFECT`；走 `ctx.root`（`PLUGIN:1066` `const rebootCtx = ctx.root as any`）是对的——`ctx.root` 的 `fiber.uid === 0`（`CORDIS_SRC\fiber.ts:321`）恒非 null。

**`fiber.await()`** — `CORDIS_SRC\fiber.ts:704-710`

```ts
  async await() {
    while (this.inertia) {
      await this.inertia
    }
    if (this._error) throw this._error
    return this
  }
```

**`fiber.entry`** — `LOADER_SRC\index.ts:52-54`（module augmentation）

```ts
  interface Fiber {
    entry?: Entry
  }
```

loader 的真实写入点：`LOADER_SRC\index.ts:129-135`

```ts
    ctx.on('internal/plugin', (fiber) => {
      // 1. set `fiber.entry`
      if (fiber.parent[Entry.key] && !fiber.entry) {
        fiber.entry = fiber.parent[Entry.key]
```

**重要推论**：该赋值要求 `fiber.parent[Entry.key]` 为真。插件经 `rebootCtx.registry.plugin(...)` 创建 fiber 时，parent 是 `ctx.root` 的 ctx —— **root ctx 上没有 `Entry.key`**，所以 loader 不会自动设 `fiber.entry`。这正是插件注释 `PLUGIN:1058-1059` 所说 "reboot 上下文的必要适配"，其 `fiber.entry = entry`（`PLUGIN:1074`）**是必需的**，不是多余防御。✅ 注释准确。

**`fiber.runtime.callback`** — `CORDIS_SRC\registry.ts:136-145`

```ts
  /** Mutable registry record shared by all fibers of one plugin callback. */
  export interface Runtime {
    /** Display name copied from the first registered plugin shape. */
    name?: string
    /** Every live fiber of this plugin (one per `ctx.plugin()` call). */
    fibers: DisposableList<Fiber>
    /** The executable entrypoint all fibers share (registry identity key). */
    callback: globalThis.Function
    /** Standard-schema validator applied to each fiber's config. */
    Config?: StandardSchemaV1
  }
```

`fiber.runtime` 声明为 `public runtime: Plugin.Runtime | null`（`CORDIS_SRC\fiber.ts:226`），root fiber 时为 `null` —— 插件 `PLUGIN:1067` 用 `entry.fiber?.runtime?.callback ?? null` 已正确处理 null。✅

**`ctx.registry.get(plugin)` / `registry.delete(fiber)`**（`PLUGIN:1176/1177/1192`）— `CORDIS_SRC\registry.ts:236-239` 与 `258-267`：

```ts
  get(plugin: Plugin) {
    const key = this.resolve(plugin)
    return key && this._internal.get(key)
  }
```
```ts
  delete(plugin: Plugin) {
    const key = this.resolve(plugin)
    const runtime = key && this._internal.get(key)
    if (!runtime) return
    this._internal.delete(key)
    for (const fiber of runtime.fibers) {
      fiber.dispose()
    }
    return runtime
  }
```

> ⚠️ 注意语义陷阱（非漂移，但插件 `PLUGIN:1177` 用了它）：`registry.delete(fiber)` 的参数被 `this.resolve(plugin)` 处理（`registry.ts:222-228`），对 `Fiber` 实例 `resolve` 返回 `undefined`（既不是 function 也没有 `apply`），因此 **`delete(fiber)` 恒为 no-op**，紧接着的 `registry.plugin(fresh, ...)`（`PLUGIN:1178`）会**复用旧的 runtime**（`registry.ts:322` 命中 `_internal`），并在旧 runtime.fibers 上**追加**一个新 fiber，而旧 fiber 已在 `PLUGIN:1173` 被 `fiber.dispose()`。`dispose` 内部会把自身从 `runtime.fibers` 移除（`CORDIS_SRC\fiber.ts:266-275`），故不会残留——功能上侥幸成立，但 `registry.delete` 那一行是**空操作**，属于误导性代码。`registry.get(oldPlugin)`（`PLUGIN:1192`）用**模块导出对象**作 key 是正确的（`resolve` 会把 `{apply}` 归一为 `plugin.apply` 作为 key）。

### 对插件的影响

**主体成立**；两处需记录：
1. `PLUGIN:1177` `registry.delete(fiber)` 传 fiber，恒 no-op（应为 `registry.delete(oldPlugin)` 或用 `fiber.dispose()`）。不致命。
2. `entry.fiber = wrapped`（包装对象）而非真 fiber，与官方形状不同但功能等价（见上）。

---

## Q6. `loader.import(url, () => [])` 与 `loader.unwrapExports(ns)`

### 结论

**两者都存在，签名与插件用法吻合，成立。**

- `Loader.import` **不是** `Loader` 自己声明的，而是从 `EntryTree` 继承（`LOADER_SRC\index.ts:77` `export class Loader extends EntryTree`）。签名 `import(name: string, getOuterStack?: () => string[])`，返回 `Promise<any>`。插件 `PLUGIN:921/1009/1164/1208/1231` 全部是 `loader.import(<fileUrl>, () => [])` ✅
- `Loader.unwrapExports(exports)` 是 `Loader` 的**自有实例方法**，`PLUGIN:1010/1068/1151` 用法正确 ✅

**关于插件传 `() => []` 而非真实 outer stack**：这是合法的（可选参）。但存在一处**后续依赖**需要注意 —— 经 `loader.import(url, () => [])` 拿到的 `ModuleJob`，其 `getNamespace()` 上的 `default` 才是插件本体，必须先 `unwrapExports`。插件确实每处都配了 `unwrapExports`（`PLUGIN:1010/1068/1151`），做法正确。**唯一漏网**：见 Q7 末尾对 `PLUGIN:1151` 形状的核对。

### 证据

`LOADER_SRC\config\tree.ts:111-129`（已引，全文见 Q3）。关键点：`EntryTree.import` 是 `Entry`/`Include`/`Group`/`Loader` 共用的同一份实现，因此 `ctx.loader.import` 与 `entry.parent.tree.import` 走完全相同的路径（`this.ctx.loader.internal.import(...)` 或原生 `import()`）。

`LOADER_SRC\index.ts:200-208`：

```ts
  /** Normalize ESM/CJS/default export shapes before applying a plugin. */
  unwrapExports(exports: any) {
    if (isNullable(exports)) return exports
    exports = exports.default ?? exports
    // https://github.com/evanw/esbuild/issues/2623
    // https://esbuild.github.io/content-types/#default-interop
    if (!exports.__esModule) return exports
    return exports.default ?? exports
  }
```

`lib` 交叉验证：`LOADER_LIB:664` `unwrapExports(exports) {`。

### 对插件的影响

**成立。** 注释 `PLUGIN:895-896`「loader.import 会重新解析磁盘文件并填充缓存」与实现一致：`EntryTree.import` 在有 `loader.internal` 时直接调 Node 内部 loader 的 `import()`，**绕过 loadCache**（Node 内部 `import` 内部照常查/填 `loadCache`），因此 purge 后 `import(realpathURL)` 必然读到磁盘新内容——插件 `PLUGIN:916-921` 的 realpath 策略成立。

---

## Q7. `loader.internal.loadCache` 是否仍是 `Map`？（Node 内部特殊 Map）

### 结论

**成立，但形状随 Node 版本分叉；当前 runtime 是 v2 形状。** `loadCache` 确实是 **`Map` 的子类实例**（Node 内部 loader 自己 `class LoadCache extends Map`），且：

- `Liskov` 层面可直接当 `Map` 枚举/删除：插件 `PLUGIN:616` `[...loadCache.keys()]`、`PLUGIN:619/1000/1004` `Map.prototype.delete.call(loadCache, u)`、`PLUGIN:617/999` `.get` / `Map.prototype.get` —— 全部合法且是**正确**的调用方式。
- **必须**用 `Map.prototype.*.call(...)` 而非 `loadCache.set(...)`：官方 `LoadCache` 接口**重载了 `get`/`set`/`has`**（`LOADER_SRC\internal.ts:24-28`），`set(url, type?, job?)` 直接调用会触发 Node 内部参数校验。插件 `PLUGIN:994-996` 的注释与 `PLUGIN:1005` 的 `Map.prototype.set.call(loadCache, u, job)`、`PLUGIN:1187/1233` 的 `loadCache.set(u, job)` —— **后者（`PLUGIN:1187` 与 `PLUGIN:1233`）是裸 `.set()`，与 `PLUGIN:994-996` 的注释自相矛盾**，属于真实缺陷（见"影响"）。
- **形状漂移**：Node 22/23 = v1，值为 `ModuleJob`；Node 24.12+ = v2，值为 `Dict<ModuleJob>`（按 format 分槽）。本机 Node 为 **v24.14.1**，故实际是 v2。

### 证据

**接口定义（含重载与形状说明）** — `LOADER_SRC\internal.ts:21-28`

```ts
type LoadCacheData = ModuleJob // | Function

/** @see https://github.com/nodejs/node/blob/main/lib/internal/modules/esm/module_map.js */
interface LoadCache extends Omit<Map<string, Dict<LoadCacheData>>, 'get' | 'set' | 'has'> {
  get(url: string, type?: string): LoadCacheData | undefined
  set(url: string, type?: string, job?: LoadCacheData): this
  has(url: string, type?: string): boolean
}
```

**v1 / v2 的关键差异（官方注释直述）** — `LOADER_SRC\internal.ts:82-93`

```ts
/**
 * Node 24+ ModuleLoader interface.
 *
 * Breaking changes from v1:
 * - getModuleJobForImport removed → getOrCreateModuleJob(parentURL, request, requestType)
 * - resolve removed (became private #resolve) → resolveSync(parentURL, request)
 * - Parameter order reversed for resolveSync, request object { specifier, attributes }
 * - LoadCache became typed Map<url, { [type]: ModuleJob }> with delete only setting undefined
 */
export interface ModuleLoaderV2 {
  version: 'v2'
  loadCache: LoadCache
```

**版本判定不是靠 Node 版本号，而是靠 API 形状** — `LOADER_SRC\internal.ts:120-143`

```ts
  /**
   * Locate and classify the running Node internal module loader.
   *
   * The shape is decided by which module-job API the loader owns, never by the
   * Node version: v2 landed in 24.12.0, so a major-version test mistags every
   * 24.0–24.11.1 loader as v2 and makes consumers call `resolveSync` with
   * reversed parameters. Arity is not usable either — `resolveSync` reports 2
   * under both shapes. A loader owning neither API is left unclassified rather
   * than guessed, so consumers take their documented no-internals path.
   * @returns the classified loader, or `undefined` when none is reachable or its shape is unknown.
   */
  export function fromInternal(): ModuleLoader | undefined {
    if (_cachedLoader) return _cachedLoader
    const [major] = process.versions.node.split('.').map(Number)
    if (major < 22) return

    const raw = requireInternal('internal/modules/esm/loader')?.getOrInitializeCascadedLoader()
    if (!raw) return
    const version = typeof raw.getOrCreateModuleJob === 'function'
      ? 'v2'
      : typeof raw.getModuleJobForImport === 'function' ? 'v1' : undefined
    if (!version) return
    return _cachedLoader = Object.assign(raw, { version })
  }
```

**`Loader.internal` 的赋值** — `LOADER_SRC\index.ts:85`

```ts
  public internal = ModuleLoader.fromInternal()
```

`internal` 可被置 `undefined`（`fromInternal` 在 Node <22、拿不到 raw、或形状未知时返回 `undefined`）——这也解释了插件在 `PLUGIN:884` `if (!internal) return 'ERROR: loader.internal 不可用'` 与多处 `internal?.loadCache` 的防御。

**reachability 已确证**：`requireInternal` 依赖 `node-addon-require-builtin`（`internal.ts:116`）或 `--expose-internals`（`internal.ts:110`）。前者在 runtime 中**确实存在**：

```
D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app\node_modules\node-addon-require-builtin
```

本机 `node -v` → **`v24.14.1`**（> 24.12.0），故运行时 `loadCache` 值是 **`Dict<ModuleJob>`**（`{ [format]: ModuleJob }`），且 `delete` **只把值置为 `undefined`，不移除 key**（`internal.ts:89`）。

### 对插件的影响

**机制成立，但有 3 处真实风险**（按严重度）：

1. **严重（形状漂移）**：v2 下 `loadCache.get(url)` 返回的是 `Dict<ModuleJob>`，**不是** `ModuleJob`。插件 `PLUGIN:1144-1151`：

   ```ts
   const oldJob = loadCache.get(entryUrlFinal)
   oldPlugin = ctx.loader.unwrapExports(oldJob?.module?.getNamespace())
   ```

   在 v2 形状下，`oldJob.module` 需解释为 `oldJob[<format>].module` 才是 `ModuleWrap`。若 `Object.keys(oldJob)` 是 `['module']`（format 恰为 `'module'`）则侥幸成立；若真是 `{module: ModuleJob}` 嵌套（即 `ModuleJob` 当作 `Dict` 的一层），则 `oldJob.module` 是 `ModuleJob`，`.getNamespace` 不存在 → `oldPlugin` 为 `undefined` → `oldJobUsable=false` → 走 `PLUGIN:1156` 的"坏 job 兜底"分支（不回滚）。**该行为需实机确认 `Object.keys(loadCache.get(url))` 才能定论；本静态审计无法判定 v2 下 Node 的实际嵌套层数 → 标记 `UNVERIFIED`（卡点：Node 内部 `module_map.js` 的 `ModuleMap` 是 `Map<url, Object<format, ModuleJob>>`，但 `LoadCache` 在 Node 24 的实际 key 是否含 format 分槽、以及 `Dict` 的键名，需要运行期探测）。**
2. **中（自相矛盾的写法）**：`PLUGIN:1187` `loadCache.set(u, job)` 与 `PLUGIN:1233` `loadCache.set(u, job)` 用的是裸 `.set()`，但 `PLUGIN:994-996` 的注释明确写着「写入必须 `Map.prototype.set.call`（直接 `.set()` 触发内部参数校验，对 ModuleJob 抛 `type must be string`）」。这两处回滚路径**很可能直接抛错**。位置：`PLUGIN:1187`（坏缓存兜底的回滚）、`PLUGIN:1233`（import 失败回滚）。而另两处回滚 `PLUGIN:1005`（预检回滚）用的是 `Map.prototype.set.call` —— 同一份代码里两种写法并存，是明确的一致性缺陷。
3. **中（v2 的 delete 语义）**：`internal.ts:89` 明确「delete only setting undefined」。因此 v2 下 `Map.prototype.delete.call(loadCache, u)` 归**删除语义**（把 value 置 `undefined`），插件随后用 `[...loadCache.keys()]`（`PLUGIN:616/888/923`）枚举时**仍会看到该死 key**，只是 `get` 返回 `undefined`。后果：`PLUGIN:888-891` / `PLUGIN:923-925` 的「按 URL 过滤」仍选中该 key（因为过滤只看 key 字符串），于是 `PLUGIN:937` `entryUrl = urls.find(u => u.endsWith('/lib/index.js'))` 可能选中一个"已删"（值为 undefined）的 key —— 随后 `await ctx.loader.import(entryUrlFinal, ...)` 因 Node 内部见 `undefined` 而重新解析磁盘，**功能上仍能工作**，但 `PLUGIN:1144` 的 `oldJob = loadCache.get(...)` 会是 `undefined`，`oldJobUsable=false`，回滚能力丢失。这与插件 `PLUGIN:892-896` 的"P0 根治"降级设计部分重叠、互相掩盖，属于**可工作但退化**。

---

## Q8. `loader.create({name, config})` 是否存在？

### 结论

**成立。** 它是 `EntryTree` 的公开方法（`Loader extends EntryTree` 继承之），签名允许只传 `{name, config}`（`id` 由 `ensureId` 自动补齐）。两处用到：`PLUGIN:857` `await rebootCtx.loader.create({ name: pkgName, config: cfg })`、以及自愈注释 `PLUGIN:800-804` 所述语义。

**一处非致命漂移**：`create()` 的**返回值是 entry id 字符串**（不是 `Entry`），而 `PLUGIN:857` 未接收返回值（仅 `await`），故无实际影响；若将来有人接住返回值当 `Entry` 用会出错。

### 证据

`LOADER_SRC\config\tree.ts:81-87`（`EntryTree.create`）：

```ts
  /** Create an entry in the root group or a nested group. */
  async create(options: Omit<EntryOptions, 'id'>, parent: string | null = null, position = Infinity) {
    const group = this.resolveGroup(parent)
    group.data.splice(position, 0, options as EntryOptions)
    group.tree.write()
    return group.create(options)
  }
```

`LIB` 交叉验证：`LOADER_LIB:187` `async create(options, parent = null, position = Infinity) {`。

`EntryGroup.create` —— 补 id、建 Entry、**以 `create=true` 强制替换 options 并启动**，返回 `entry.id`（字符串）— `LOADER_SRC\config\group.ts:20-29`：

```ts
  async create(options: Omit<EntryOptions, 'id'>) {
    const id = this.tree.ensureId(options)
    const entry: Entry = this.tree.store[id] ??= new Entry(this.ctx.loader)
    // Entry may be moved from another group,
    // so we need to update the parent reference.
    entry.parent = this
    // Use `create: true` to replace existing entry.options.
    await entry.update(options, true, true)
    return entry.id
  }
```

`ensureId` —— `LOADER_SRC\config\tree.ts:51-58`：

```ts
  ensureId(options: Partial<EntryOptions>) {
    if (!options.id) {
      do {
        options.id = Math.random().toString(16).slice(2, 10)
      } while (this.store[options.id])
    }
    return options.id!
  }
```

因此 `{ name: 'dsh-super-injector', config: {...} }` 完全满足 `Omit<EntryOptions, 'id'>`（`id` 可省，`name` 必填）。

### 对插件的影响

**成立。** 插件 `PLUGIN:798-806` 的注释「loader.create 会新建**幽灵 entry**，与官方 bundles entry 并存时 loader 对账防双实例会把官方 entry 标 disabled——所以自愈优先走官方装配（touch profile patch）」在代码中可验证为**真实机制**：`loader.create` 走 `group.data.splice` + `tree.write()`，会在 profile 的根树里凭空插一条 options，而**同时** loader 的 `internal/plugin` 观察者会把自毁的官方 entry 标 `disabled=true`：

`LOADER_SRC\index.ts:160-165`（case 6）：

```ts
      // case 6: fiber is disposed by loader behavior
      // such as inject checker, config file update, ancestor group disable
      if (fiber.entry.disabled) return

      fiber.entry.options.disabled = true
      fiber.entry.parent.tree.write()
```

这正是插件 `PLUGIN:1077-1086` 需要"兜底清 disabled"（`delete entry.options.disabled` / `delete d.disabled`）的原因。✅ 判断准确。

---

## Q9. patch 机制：`cordis.patch.yml` 支持的条目形态，`- insert:` 是否仍受支持

### 结论

**文件格式仍是"顶层 YAML 数组，元素为 loader patch 条目（`PatchOptions`）"，`- insert:` 仍完全受支持，且解析/应用位置明确。**

四种受支持的条目形态（由 `applyEntryPatches` 的实际分支穷举得出）：

| 形态 | 判定 | 行为 |
| --- | --- | --- |
| `{ insert: [...], id?: <groupId> }` | `patch.insert` 为真值 **且** 有 `id` | 把 `insert` 追加到**目标 group** 的 `config` 数组尾部；目标不存在 → `warn("patch insert: entry %C not found")` 跳过；目标非 group → `warn("patch insert: entry %C is not a group")` 跳过 |
| `{ insert: [...] }`（无 id） | `patch.insert` 为真值 **且** 无 `id` | 直接 `data.push(...insert)`（追加到顶层列表尾） |
| `{ id: <entryId>, ...overrides }` | 无 `insert`，有 `id` | 对目标 entry **逐键覆盖**（`target[key] = value`）；`id` 自身被跳过；未命中 → warn 跳过 |
| `{ ...overrides }`（无 id 无 insert） | 其余 | `warn("patch: id is required for non-insert patches")` 跳过 |

- **`!!js` 表达式**：受支持。YAML dialect 是 `yaml.JSON_SCHEMA.extend(JsExpr)`；`JsExpr` 把 `!!js <expr>` 解析为 `{ __jsExpr: string }`，由 loader 在 entry 激活/配置解析时用 `evaluate(ctx, expr)` 求值。
- **`disabled`**：受支持，且**只是一个普通 override 键**（无特殊分支）——`for (const [key, value] of Object.entries(overrides)) target[key] = value`。也支持 `!!js`（`Entry.disabledOf` 会识别 `__jsExpr`）。
- **按 `id` 定向 config 覆盖**：受支持，但**是整值替换（`target.config = value`），不是深合并**。
- `name` 特殊：若不是 `insert` 条目且提供了 `name`，会**先校验** `name === target.name`，不一致则 warn 跳过（防 id 撞车改错行）。

**解析该 YAML 的代码位置**（两处，同 schema，语义相同）：

1. **profile/overlay 装配路径（boot 时）**：`BOOT_APP:3568-3580` `parsePatchList()`，schema 为 `userPatchesSchema`（`BOOT_APP:3469`），调用点 `loadOptionalPatches`（`BOOT_APP:3517`）与 `loadOverlayPatches`（`BOOT_APP:3536`）。
2. **include 插件自身挂载/热更新路径**：`BOOT_APP:151-169` `Include.read()`，`BOOT_APP:155` `yaml.load(content, { schema: entryListSchema })`；patch 应用为 `Include.applyPatches()`（`BOOT_APP:170`）→ `applyEntryPatches`。

**注意**：**当前线上 profile 的 `cordis.patch.yml` 完全没有使用 `- insert:` 形态**，全部是 `- id:` 定向覆盖/`disabled` 形态。

### 证据

**patch 算法（权威实现，"THE patch semantics of this include"）** — `BOOT_APP:47-110`

```js
/**
 * Apply patch lists to an entry list — THE patch semantics of this include,
 * shared by mounting (`applyPatches`) and offline config tooling
 * (`dsh --dump-config`) so a dump can never drift from what boots. The input
 * is never mutated: patching shared entry objects would bake earlier patch
 * values into the cached parse, so repeated application (config hot-reloads)
 * could never revert a removed or changed patch. Inserted entries are indexed
 * as they are added, so a later patch in the same list can target a row an
 * earlier patch inserted. A patch that matches nothing warns and is skipped.
 * @param data - the parsed entry list (JSON-safe plain data).
 * @param patches - the patch list to apply, in order.
 * @param warn - sink for skipped-patch diagnostics (printf-style, `%C` = code).
 * @returns a detached entry list with every applicable patch applied.
 */
function applyEntryPatches(data, patches, warn) {
	if (!patches?.length) return [...data];
	data = structuredClone(data);
	const entryMap = /* @__PURE__ */ new Map();
	const buildMap = (entries) => {
		for (const entry of entries) {
			if (entry.id) entryMap.set(entry.id, entry);
			if (entry.group && Array.isArray(entry.config)) buildMap(entry.config);
		}
	};
	buildMap(data);
	for (const patch of patches) {
		const { id, insert, name, ...overrides } = patch;
		if (insert) {
			if (id) {
				const target = entryMap.get(id);
				if (!target) {
					warn("patch insert: entry %C not found", id);
					continue;
				}
				if (!target.group) {
					warn("patch insert: entry %C is not a group", id);
					continue;
				}
				if (!Array.isArray(target.config)) target.config = [];
				target.config.push(...insert);
			} else data.push(...insert);
			buildMap(insert);
			continue;
		}
		if (!id) {
			warn("patch: id is required for non-insert patches");
			continue;
		}
		const target = entryMap.get(id);
		if (!target) {
			warn("patch: entry %C not found", id);
			continue;
		}
		if (name && name !== target.name) {
			warn("patch: name mismatch for %C (expected %C, got %C), skipping", id, target.name, name);
			continue;
		}
		for (const [key, value] of Object.entries(overrides)) {
			if (key === "id") continue;
			target[key] = value;
		}
	}
	return data;
}
```

**`insert` 是唯一有特殊语义的 key（`- insert:` 仍受支持）**：`BOOT_APP:74` `if (insert) {`；`BOOT_APP:86` `target.config.push(...insert);`（group 定向插入）；`BOOT_APP:87` `else data.push(...insert);`（顶层追加）。

**`!!js` dialect** — `BOOT_APP:28-34`：

```js
/*
 * The entry-list YAML dialect: `!!js` scalars round-trip as expression nodes
 * the Loader evaluates at entry activation. Exported so config tooling
 * (`dsh --dump-config`) parses and prints exactly the dialect this include
 * mounts.
 */
const entryListSchema = yaml.JSON_SCHEMA.extend(JsExpr);
const schema = entryListSchema;
```

`JsExpr` 的实现与求值 — `LOADER_SRC\config\utils.ts:25-32` 与 `utils.ts:5-9`：

```ts
/** Return true when a value is a serialized loader JavaScript expression. */
export function isJsExpr(value: any): value is JsExpr {
  return value instanceof Object && '__jsExpr' in value
}

/** Serialized JavaScript expression produced by the include YAML tag. */
export interface JsExpr {
  __jsExpr: string
}
```
```ts
/** Evaluate a JavaScript expression against a loader context scope. */
export const evaluate = new Function('ctx', 'expr', `
  with (ctx) {
    return eval(expr)
  }
`) as ((ctx: object, expr: string) => any)
```

**解析器 + 顶层形态校验 + 文档语义** — `BOOT_APP:3506-3526`（`loadOptionalPatches` 的 JSDoc 即官方对形态的权威描述）：

```js
/**
 * Load an optional patch-list file: a top-level YAML array of loader patch
 * entries (`@deepseek-ai/cordis-plugin-include`'s `PatchOptions`): id-targeted config
 * overrides and `insert` lists, with `!!js` expressions allowed. A missing
 * file means "no layer"; an unreadable, unparsable, or non-array file throws —
 * a present patch file that cannot apply is a misconfiguration and must fail
 * loud at boot, never be silently skipped.
 * @param binName - the diagnostic prefix on the thrown error.
 * @param file - absolute path of the patch file.
 * @returns the parsed patches, or `undefined` when the file does not exist.
 */
function loadOptionalPatches(binName, file) {
	let content;
	try {
		content = readFileSync(file, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") return void 0;
		throw new Error(`${binName}: failed to read patches ${file}: ${String(error)}`);
	}
	return parsePatchList(binName, file, content, "patches");
}
```

`BOOT_APP:3568-3580`（真正的 `yaml.load` 调用 + 形态校验）：

```js
function parsePatchList(binName, file, content, label) {
	let parsed;
	try {
		parsed = yaml.load(content, { schema: userPatchesSchema });
	} catch (error) {
		throw new Error(`${binName}: failed to parse ${label} ${file}: ${String(error)}`);
	}
	if (!Array.isArray(parsed)) throw new Error(`${binName}: ${label} ${file} must be a top-level YAML array of loader patch entries`);
	parsed.forEach((entry, index) => {
		if (typeof entry !== "object" || entry === null || Array.isArray(entry)) throw new Error(`${binName}: ${label} entry ${index + 1} in ${file} must be a mapping (a loader patch entry)`);
	});
	return anchorInsertedPluginNames(parsed, file);
}
```

`BOOT_APP:3469`（schema 绑定）：

```js
const userPatchesSchema = entryListSchema;
```

**`insert` 条目的相对路径锚定（附加语义）** — `BOOT_APP:3545-3554`：`insert` 里以 `./`、`../` 或绝对路径写的 `name` 会被转换为**相对 patch 文件所在目录**的 `file://` URL（`anchorInsertedPluginNames`），group 的嵌套 `insert`（`entry.group && Array.isArray(entry.config)`）也会递归处理。这对"插入本地插件包"是关键便利。

**`disabled` 的运行时语义（不只在 patch 层）** — `LOADER_SRC\config\entry.ts:73-93`：`entry.disabled` 是 **getter**，会向上遍历祖先 entry；而 `entry.options.disabled`（插件读的）是**原始值**，可能是 `boolean` 或 `{__jsExpr}`：

```ts
  /** True when this entry or any owning parent entry is disabled. */
  get disabled() {
    // group is always enabled
    if (this.options.group) return false
    let entry: Entry | undefined = this
    do {
      if (this.disabledOf(entry.options)) return true
      entry = entry.parent.ctx.fiber.entry
    } while (entry)
    return false
  }

  /**
   * Effective disabled state: a `!!js` expression evaluates against the loader
   * context. The raw node stays in the options, so write-back keeps the form.
   */
  private disabledOf(options: EntryOptions): boolean {
    return isJsExpr(options.disabled)
      ? Boolean(this.evaluate(options.disabled.__jsExpr))
      : Boolean(options.disabled)
  }
```

**当前线上 patch 文件的实际形态** — `PROFILE_PATCH:1-10`（文件头自述，与官方一致）：

```yaml
# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; `!!js` expressions allowed).
- id: desktop-shell
  name: dsh-plugin-desktop
  config:
    mode: advanced
```

全文 162 行**未出现任何 `- insert:`**；形态分布为：`- id: ... / name: ... / config: {...}` 与 `- id: ... / disabled: true|false`。例：`PROFILE_PATCH:44-46`(`- id: web-ui-ssh` / `disabled: false`)、`PROFILE_PATCH:88-89`(`- id: web-ui-usage` / `disabled: true`)、`PROFILE_PATCH:153-157`（`- id: webserver` 定向覆盖 host/port/compression）。

### 对插件的影响

**插件对 patch 的用法成立，且与官方语义一致。** 插件两个关键假设被证实：

1. `PLUGIN:715-719` 注释「官方 patch 初始是顶层 `[]`（空数组）；盲 append `- id:` 会产生两个顶层 YAML 值 → 解析必炸」—— 与 `parsePatchList` 的 `if (!Array.isArray(parsed)) throw ...`（`BOOT_APP:3575`）**完全吻合**。官方模板确实是 `[]`：`BOOT_APP:588-589`

   ```js
   const patchPath = join(dir, PROFILE_PATCH_FILENAME);
   if (!existsSync(patchPath)) writeFileSync(patchPath, PROFILE_PATCH_TEMPLATE);
   ```

   因此插件 `PLUGIN:756` `kept.join('').replace(/^\s*\[\]\s*$/m, '')` 的"先移除顶层 `[]` 再追加"是**必要且正确**的。
2. `PLUGIN:721-727` 注释「同 id entry 出现两次 → loader 装配遇同 id 直接抛 `duplicate loader entry id`，整个 plugin tree 加载失败」—— 该错误字符串未在 cordis/loader 源码中出现（**本审计未在 `@deepseek-ai/cordis-plugin-loader` 中找到该确切文案**），但 `EntryGroup.update` 的 `Object.fromEntries(...)` 按 id 建 map（`LOADER_SRC\config\group.ts:51-52`）会**静默吞掉重复 id**（后者覆盖前者），而 `entryMap` 同理由 `applyEntryPatches` 的 `buildMap` 构建（`BOOT_APP:67` `if (entry.id) entryMap.set(entry.id, entry)`）—— **重复 id 在 patch 层是静默 last-wins，不是抛错**。此条标记 `UNVERIFIED`（可能来自别的版本/别的 harness 层的校验；也可能是插件作者的经验推断）。插件的去重逻辑本身无害且更安全，保留即可。

`- insert:` 受支持意味着插件 `PLUGIN:737-738` 的正则

```ts
const appendIds = [...appendText.matchAll(/^\s*- id:\s*([^\s#]+)/gm)].map((m) => m[1])
```

在 **`- insert:` 包裹块**场景下**抓不到被插入条目的 id**（被插入条目形如 `      - id: xxx`，虽也匹配 `^\s*- id:`，但若 appendText 是 `- insert:\n    - id: x\n` 则能抓到 `x`——**取决于缩进与换行，需实机验证**）。更重要的隐患：`PLUGIN:786-792` `extractPatchBlocks` 对 `- insert:` 的**包裹行**（顶格 `- insert:`）只作"杂散行保留"，而它下面的 `- id:` 会被当成**新条目块**提取并按 id 去重 —— 这会把一个 insert 块**拆散**。当前线上文件没有 `insert`，所以尚未暴露。**若该插件要支持 `- insert:` 形态，`writePatch`/`extractPatchBlocks` 需要加固**（标记：潜在缺陷，当前未触发）。

---

## Q10. `dsh.profile.bundles` 与 `patchReload: "live"` 的语义与实现位置

### 结论

**`dsh.profile.bundles`：成立、有明确实现。`patchReload: "live"`：在已安装 runtime 中完全不存在（no-op / 声明式残留）——热重载能力实际由 `dsh-hmr` 无条件提供。**

1. **`dsh.profile.bundles`** = profile 的**有序插件包清单**，是"装配顺序 + 激活开关"的单一事实来源：
   - 决定 bundle 层叠顺序（数组顺序就是 layer 顺序，**后者覆盖前者**）；
   - 决定一个已安装依赖是否 `enabled`（`readProfilePlugins` 用 `bundles.includes(name)`）；
   - 每个 bundle 包通过**自己的** `cordis.patch.yml` 贡献一层 patch（由 `dsh.bundle.patch` 声明）。
2. **`patchReload: "live"`**：`PROFILE_PKG:29` 声明了它，但**整个已安装 runtime 中该标识符出现 0 次**（穷举搜索 `resources\app` 下全部 `*.js/*.mjs/*.cjs`，以及全部 `@deepseek-ai` 包的 `*.js/*.ts`）。因此当前版本**没有任何代码读取它**：它既不生效也不报错，是**声明式残留 / 面向未来或面向外层 shell 的字段**。
3. **"live" 热重载的真实实现位置是 `dsh-hmr`**，且**不以 `patchReload` 为开关**：它用 `chokidar` 监视 profile 的 patch 文件与 `package.json`，变化时重读 patch 并调用 `reconcileProfilePatches`。

### 证据

**(1) `dsh.profile.bundles` 的声明** — `PROFILE_PKG:1-31`（节选）：

```json
{
  "name": "dsh-profile-desktop",
  "private": true,
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        ...
        "@wenbin_wb/dsh-bridge"
      ],
      "patchReload": "live"
    }
  },
```

**(2) 消费 bundles 的实现** — `BOOT_APP:1066-1081`（`readProfilePlugins`）：

```js
function readProfilePlugins(location) {
	const manifest = readProfileManifest(location.binName, location.profileDir);
	const bundles = manifest.dsh?.profile?.bundles ?? [];
	return {
		manifest,
		dependencies: Object.entries(manifest.dependencies ?? {}).map(([name, spec]) => {
			const installed = optionalManifest(location.binName, join(location.profileDir, "node_modules", name));
			return {
				name,
				version: typeof installed?.version === "string" ? installed.version : spec,
				bundle: bundleManifest(location, name)?.dsh?.bundle?.patch !== void 0,
				enabled: bundles.includes(name)
			};
		})
	};
}
```

`bundle: <pkg>.dsh.bundle.patch !== undefined` 即"该包是否贡献 bundle patch"；写回在 `writeProfileBundles`（`BOOT_APP:1089-1102`）与 `reconcileProfilePlugins`（`BOOT_APP:1110-1129`，含"新依赖自动激活"与 `preserveDisabled` 语义）。

**bundle 层的加载（含顺序）** — `BOOT_APP:932-937`：

```js
		const patchPaths = bundlePatchPaths(packageDir, bundle);
		const patches = patchPaths.flatMap((patchPath) => loadOverlayPatches(binName, patchPath));
```

profile 自身那一层 — `BOOT_APP:946-952`：

```js
	const patchPath = join(dir, PROFILE_PATCH_FILENAME);
	const patches = options.userLayer !== false && existsSync(patchPath) ? loadOverlayPatches(binName, patchPath) : [];
```

**layers 顺序（官方注释即权威语义）** — `BOOT_APP:75-77` 与 `BOOT_APP:120-124`：

```js
 * patch layers (bundle layers in `dsh.profile.bundles` order, the profile's
 * own `cordis.patch.yml`, `--patch` overlays, the telemetry switch), mount the
```
```js
# each bundle in package.json's dsh.profile.bundles, then cordis.patch.yml, then any
# --patch overlays. Edit cordis.patch.yml, not this file.
```

`PROFILE_PATCH:1` 自述一致：`# Your patch layer for this dsh profile, applied after every bundle layer:`。

**完整层叠顺序** — `BOOT_APP:1029-1037`（`readProfilePatches`）：

```js
	const patches = structuredClone([
		...profile.layers.flatMap((layer) => layer.patches),
		...initialProfile?.patches ?? loadOptionalPatches(binName, context.patchPath) ?? [],
		...loadOptionalPatches(binName, join(context.home, "cordis.patch.yml")) ?? [],
		...context.overlays
	]);
	const telemetryPatch = resolveTelemetryPatch(context.telemetryDisabledEnv, composeEntries([patches]).some((row) => row.id === TELEMETRY_ROW_ID));
	if (telemetryPatch !== void 0) patches.push(telemetryPatch);
	return patches;
```

即：**bundle layers（按 `dsh.profile.bundles` 顺序） → profile `cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml` → `--patch` overlays → telemetry patch**。注意官方注释 `BOOT_APP:110` 把 `$DSH_HOME/cordis.patch.yml` 称为 "home-level user patch layer"。
（另注：`PROFILE_TEMPLATES` 中 desktop 模板的 `bundles` 见 `BOOT_APP` 的 `dsh-plugin-desktop` 相关模板；`DEFAULT_PROFILE_BUNDLES` 在 `BOOT_APP:4146` 导出。）

**(3) `patchReload` 的搜索证据** — 对 `D:\WorkSpace\Agents\DSH-Desktop\DSH Desktop\resources\app` 递归搜索 `*.js,*.mjs,*.cjs` 中的 `patchReload`：**0 命中**；对全部 `@deepseek-ai\**\*.js|*.ts` 搜索：**0 命中**。`PROFILE_PKG:29` 是唯一出现处。

**(4) live 热重载的真实实现** — `HMR_LIB:5-8`：

```js
import { watch } from "chokidar";
import { PROFILE_PATCH_FILENAME, readProfileManifest, readProfilePatches, reconcileProfilePatches } from "@deepseek-ai/dsh-app-boot";
```

`HMR_LIB:365-376`（重读 patch 并调和 + 注册 watcher；行号区间据 `Select-String` 命中 369/370/375/376）：

```js
					const patches = readProfilePatches("dsh", profile);
					const warnings = await reconcileProfilePatches(this.ownerContext.root, patches, "dsh");
					...
				for (const filename of patchFiles) await this.watchConfig(filename, () => refresh(false));
				await this.watchConfig(manifestPath, () => refresh(true));
```

`watchConfig` 的 JSDoc（`HMR_LIB:36-45` 区间）自述其职责：

```js
* Watch one patch path, including missing parents, and serialize refresh callbacks.
* @param ctx Context that owns watcher disposal and receives refresh failures.
```

watcher 事件绑定（`HMR_LIB:80-82`）：`watcher.on("add", onChange)` / `on("change", onChange)` / `on("unlink", onChange)`；`HMR_LIB:293-303` 的 `async watchConfig(filename, refresh)` 是公开入口。配置文件模块 `HMR_LIB:13-14` 注释：`//#region lib/types/watch-config.js` / `/** Exact-path watching for live profile patch files outside Cordis module roots. */` —— **"live" 这个词出现在这里**，说明 live 语义的归属是 HMR 而非 `patchReload`。

**(5) `reconcileProfilePatches` 如何把新 patch 送进已挂载的 include** — `BOOT_APP:3477-3505`（节选）：

```js
async function reconcileProfilePatches(ctx, patches, binName, requiredIds = []) {
	const entry = bootstrapIncludes.get(ctx);
	if (entry === void 0) throw new Error(`${binName}: profile reload requires the root Include entry`);
	...
	const { patches: _previous, ...includeConfig } = entry.options.config;
	const parentURL = new URL(".", new URL(includeConfig.path, entry.parent.tree.ctx.baseUrl)).href;
	const prepared = prepareProfilePatches(ctx, patches, parentURL, binName);
	await entry.update({ config: {
		...includeConfig,
		patches: prepared
	} });
	...
	ctx.emit("app-boot/config-reload");
	return failures.map(inactiveDiagnostic);
}
```

`entry.update({config: {...}})` → `Entry._patchContext`（`LOADER_SRC\config\entry.ts:99-107`）→ `this.fiber.update(this.options.config, true)` → 触发 include 的 `internal/update` 监听器 → `Include` 重跑 `applyPatches` 并把新 entry 列表交给 `this.root.update(...)`。

`Include` 上的那个监听器正是这一环的落地处 — `BOOT_APP:134-141`：

```js
		ctx.on("internal/update", (config, _, next) => {
			if (config.path !== this.config.path) return next();
			this.config = config;
			this.root.update(this.applyPatches(this.data, config.patches)).catch((error) => {
				this.ctx.logger.warn("config update at %C failed", this.filename);
				this.ctx.logger.warn(error);
			});
		});
```

`Include.applyPatches` → `applyEntryPatches`（`BOOT_APP:170-171`）：

```js
	applyPatches(data, patches = this.config.patches) {
		return applyEntryPatches(data, patches, (message, ...args) => {
```

**这也解释了插件 `PLUGIN:820-846` 自愈的第一步为何有效**：`appendFileSync(patchPath, '\n# super-injector heal ...')` 改变了被 chokidar 监视的文件 → `dsh-hmr` 重读并 `reconcileProfilePatches` → include 重装 bundles → 官方 entry 复活。插件注释 `PLUGIN:825`「给 include.refresh 一个窗口」的 3000ms 等待与此机制吻合（`PLUGIN:826` `await new Promise((r) => globalThis.setTimeout(r, 3000))`）。

> 附带发现：`Include` 自己在 `BOOT_APP:151-169` 的 `read(forced)` 里也做了 `this.content === content` 短路（`BOOT_APP:153` `if (!forced && this.content === content) return false;`）——这是 include 的**文件读**入口，但**没有任何 watcher 调用它**（watcher 在 dsh-hmr，且走 `reconcileProfilePatches`）。因此 patch 文件的"live"生效**依赖 dsh-hmr 存在并激活**；若 `dsh-hmr` 未装配，patch 改动只在下次启动生效，且 `patchReload: "live"` 不会有任何补偿作用。

### 对插件的影响

- **`bundles` 语义**：插件 `PLUGIN:8-9` 注释「dev_install_package — 双路径热装配（profile package.json + junction + loader.create，重启后由 bundles 接管）」——**与实现一致**：`reconcileProfilePlugins`（`BOOT_APP:1118`）会把新装的 bundle 依赖自动 push 进 `dsh.profile.bundles`：

  ```js
  	for (const dependency of after.dependencies) if (dependency.bundle && !disabled.has(dependency.name) && !bundles.includes(dependency.name)) bundles.push(dependency.name);
  ```

  但注意前置条件：只有 `dependency.bundle === true`（即包声明了 `dsh.bundle.patch`）才会被自动加入。**若插件注入的第三方包没有声明 `dsh.bundle.patch`，它永远不会进 `bundles`**，重启后不会被接管 —— 这可能是插件"重启后由 bundles 接管"预期的一个隐性缺口。标记：**需实机核对目标包的 `dsh.bundle.patch` 声明**（本审计只读，未遍历目标包）。
- **`patchReload` 语义**：**不能依赖它**。当前 runtime 中它是纯声明、零实现。插件若（现在或将来的版本）以 `patchReload === 'live'` 作为"可以热改 patch"的前置判断，该判断**永远不成立**；反之，即使 profile 不写这个字段，live 热重载**依然可用**（因为实现方 `dsh-hmr` 不看它）。这是一条**语义漂移**：字段名暗示了能力，但能力的实际开关在别处。
- 与 Q2 的联动：`reconcileProfilePatches` 用 **`entry.update({config})`** 完成重装配，**全程不碰 `_dispose`**（`BOOT_APP:3490-3496`）。这佐证了 Q2 的修复方向：官方路径本来就是 `Entry.update`，插件自造的 `_dispose()` + `registry.plugin()` REPLACE 组合没有对应的官方实现，属于**自建机制**，其组件之一（`_dispose`）在 1.0.5 中不存在。

---

## 附：审计覆盖范围与未能确证项

### 已逐字读取并作为结论依据的文件

| 文件 | 覆盖 |
| --- | --- |
| `LOADER_SRC\config\entry.ts` | 全文（1-236） |
| `LOADER_SRC\config\tree.ts` | 全文（1-133） |
| `LOADER_SRC\config\group.ts` | 全文（1-90） |
| `LOADER_SRC\config\utils.ts` | 全文（1-32） |
| `LOADER_SRC\index.ts` | 全文（1-211） |
| `LOADER_SRC\internal.ts` | 全文（1-144） |
| `CORDIS_SRC\fiber.ts` | 全文（1-754） |
| `CORDIS_SRC\registry.ts` | 全文（1-337） |
| `BOOT_APP` | 1-171（Include）、1023-1172（profile patches/plugins）、3440-3579（env/layers/parsePatchList）、3569-3668（parsePatchList 尾/renderConfigDump） |
| `HMR_LIB` | 关键命中行（36-45、80-102、293-303、365-383） |
| `PROFILE_PATCH` | 全文（1-162） |
| `PROFILE_PKG` | 全文（1-51） |
| `PLUGIN` | 1-1262（覆盖全部相关 API 用法；文件总 3323 行，未读部分为工具定义/自检逻辑，Q9 的 `writePatch`/`extractPatchBlocks` 已读） |

### `UNVERIFIED` 清单（不猜测）

1. **Q7-1（v2 `loadCache` 值的嵌套层数）**：Node 24.14.1 下 `loadCache.get(url)` 究竟返回 `{module: ModuleJob}` 还是 `ModuleWrap`，需运行期 `Object.keys(loadCache.get(<realpathUrl>))` 探测。静态读 `LOADER_SRC\internal.ts:89` 只给出"became typed Map<url, { [type]: ModuleJob }>"，未给出真实键名。影响：`PLUGIN:1144-1151` 的回滚能力是否可用。
2. **Q9-2（`duplicate loader entry id` 错误文案）**：该确切字符串未在 1.0.5 的 `cordis-plugin-loader` 中找到；patch 层重复 id 实际是**静默 last-wins**（`applyEntryPatches` 的 `buildMap` 与 `EntryGroup.update` 的 `Object.fromEntries`）。插件注释所述"直接抛错"可能来自其他层/其他版本 → 未确证。
3. **Q10-2（`dsh.bundle.patch` 声明是否覆盖插件的注入目标包）**：需遍历目标包 `package.json` 才能判定"重启后由 bundles 接管"是否成立。
4. **Q9-3（`- insert:` 场景下 `writePatch` 的 id 抓取与 `extractPatchBlocks` 的块切分）**：当前线上文件无 `insert` 条目，未触发；加固与否需先决定是否要支持该形态。

### 本次审计的硬性约束遵守情况

- 未修改任何已存在文件；未安装任何包（全部操作均为 `read` / `pwsh` 只读查询 + 一次 `write` 到任务指定的新文件 `docs\compat\raw\loader.md`）。
- 所有结论均给出绝对路径 + 行号 + 代码原文；无法确证者标 `UNVERIFIED` 并说明卡点。
- 标注了"无类型声明的私有 API"的**反向情形**：`_dispose` 既无类型声明也**无实现**（phantom），而非"有实现无声明"。
