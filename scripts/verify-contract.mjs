#!/usr/bin/env node
/**
 * D4 · 运行时契约验证（DSH 0.2.x 适配）
 *
 * 目的：把 `injector/` 对 DeepSeek Harness 的每一处依赖，变成**可重复执行、会失败**的断言。
 * 与 `build/verify-preset-bundle.mjs`（preset bundle 生成物）互补，本脚本覆盖：
 *   A. cordis 内核契约（Fiber / Registry / Loader / Entry）
 *   B. 资源注册契约（tools / webServer / systemPrompt / client slots / client modules / agent preset）
 *   C. 本仓库源码的静态不变量（已修复的漂移不得回归）
 *   D. preset 引用的包名在目标 runtime 中真实存在
 *
 * 用法：
 *   node scripts/verify-contract.mjs
 *   DSH_RUNTIME_NODE_MODULES=<path> node scripts/verify-contract.mjs
 *
 * 只读取权威 runtime 与仓库源码；不写入任何 profile、不建 junction。
 * 退出码：0 = 全部通过；1 = 有失败。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const results = []
const ok = (id, name, detail = '') => { results.push({ id, name, pass: true, detail }); console.log(`  \u2713 ${id} ${name}${detail ? '  \u2014 ' + detail : ''}`) }
const bad = (id, name, detail = '') => { results.push({ id, name, pass: false, detail }); console.log(`  \u2717 ${id} ${name}${detail ? '  \u2014 ' + detail : ''}`) }
const check = (cond, id, name, detail = '') => cond ? ok(id, name, detail) : bad(id, name, detail)
const group = (title) => console.log('\n' + title)

/* ---------------------------------------------------------------- runtime 定位 */

// 一个部署里可能有多个 node_modules 层（profile 层多为指向真实 runtime 的 junction，
// 且历史上出现过悬空 junction）。因此**逐包定位**：对每个包取第一个真实含入口文件的根。
function candidateRoots () {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  const cands = []
  if (process.env.DSH_RUNTIME_NODE_MODULES) cands.push(process.env.DSH_RUNTIME_NODE_MODULES)
  if (process.env.DSH_PROFILE_DIR) cands.push(path.join(path.dirname(process.env.DSH_PROFILE_DIR), 'node_modules'))
  cands.push(path.join(home, 'profiles', 'node_modules'))
  cands.push(path.join(home, 'node_modules'))
  try {
    for (const d of fs.readdirSync(path.join(home, 'profiles'))) cands.push(path.join(home, 'profiles', d, 'node_modules'))
  } catch { /* 无 profiles 目录 */ }

  // profile 层的 @deepseek-ai/* 多是指向真实 runtime 树的 junction；部分包（如 dsh-agent-preset）
  // 在 profile 层根本没有链接，只存在于应用自带的 node_modules。因此从已知链接反推真实根。
  const seen = [...new Set(cands)]
  for (const r of seen) {
    for (const probe of ['cordis', 'dsh-tools']) {
      const link = path.join(r, '@deepseek-ai', probe)
      if (!fs.existsSync(link)) continue
      try {
        const real = fs.realpathSync(link)                    // …/<nm>/@deepseek-ai/<pkg>
        const realRoot = path.dirname(path.dirname(real))     // …/<nm>
        if (!seen.includes(realRoot)) seen.push(realRoot)
      } catch { /* 悬空链接，忽略 */ }
    }
  }
  return seen.filter(c => { try { return fs.existsSync(c) } catch { return false } })
}

const ENTRY_CANDIDATES = ['lib/index.js', 'lib/index.mjs', 'lib/index.cjs', 'index.js']

const ROOTS = candidateRoots()
const PKG_DIRS = new Map()
function pkgDir (name) {
  if (PKG_DIRS.has(name)) return PKG_DIRS.get(name)
  let found = null
  for (const r of ROOTS) {
    const d = path.join(r, '@deepseek-ai', name)
    if (ENTRY_CANDIDATES.some(c => { try { return fs.existsSync(path.join(d, c)) } catch { return false } })) { found = d; break }
  }
  PKG_DIRS.set(name, found)
  return found
}
function rtEntry (name) {
  const d = pkgDir(name)
  if (!d) return null
  for (const c of ENTRY_CANDIDATES) if (fs.existsSync(path.join(d, c))) return path.join(d, c)
  return null
}
const rtFile = (name, rel) => { const d = pkgDir(name); return d ? path.join(d, rel) : path.join(ROOTS[0] || '', '@deepseek-ai', name, rel) }
const rtExists = (name) => pkgDir(name) !== null
const readIf = (p) => { try { return fs.readFileSync(p, 'utf8') } catch { return '' } }
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

console.log('runtime 候选根:')
for (const r of ROOTS) console.log('  - ' + r)
console.log('plugin root: ' + ROOT)

const version = (name) => { const d = pkgDir(name); try { return readJson(path.join(d, 'package.json')).version } catch { return '?' } }

/* ---------------------------------------------------------------- 加载 runtime */
// 不走裸名解析（依赖调用方环境），直接按绝对路径 import，避免受本仓库 node_modules 影响。

const loadRt = (name, rel) => {
  const target = rel ? rtFile(name, rel) : rtEntry(name)
  if (!target) throw new Error(`runtime 中找不到包 @deepseek-ai/${name}（已尝试 ${ROOTS.length} 个 node_modules 根）`)
  return import(pathToFileURL(target).href)
}

const cordis = await loadRt('cordis')
const { Context, Fiber, RegistryService } = cordis
const loaderMod = await loadRt('cordis-plugin-loader')
const { Loader, Entry, EntryGroup, EntryTree } = loaderMod
const { default: TimerService } = await loadRt('cordis-plugin-timer')
const toolsMod = await loadRt('dsh-tools')
const { ToolRuntime, defineTool, parameterSchemaSpecToJsonSchema } = toolsMod
const { default: SystemPrompt } = await loadRt('dsh-system-prompt')
const { default: WebServer } = await loadRt('dsh-host-webserver')
const slotsMod = await loadRt('dsh-client-ui-slots')
const { SlotCore, resolveSlotLabel } = slotsMod
const clientModules = await loadRt('dsh-client-modules')
const presetMod = await loadRt('dsh-agent-preset')

console.log(`cordis ${version('cordis')} · cordis-plugin-loader ${version('cordis-plugin-loader')} · dsh-tools ${version('dsh-tools')} · dsh-system-prompt ${version('dsh-system-prompt')} · dsh-host-webserver ${version('dsh-host-webserver')} · dsh-client-ui-slots ${version('dsh-client-ui-slots')}`)

const SP = (name) => path.join(ROOT, 'injector', 'src', name)
const PLUGIN = readIf(SP('index.ts'))
const PLUGIN_CLIENT = readIf(SP(path.join('client', 'index.ts')))
const FIBER_NAMES = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading']

// 静态检查必须只看**代码**：修复说明大量出现在注释里（例如"旧实现调用 entry._dispose()"）。
// 去掉块注释与行注释（用后行断言避开 URL 里的 `//`）。
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '')
const PLUGIN_CODE = stripComments(PLUGIN)
const PLUGIN_CLIENT_CODE = stripComments(PLUGIN_CLIENT)

/* ================================================================ A. cordis 内核 */

group('A. cordis 内核契约')

// A1 —— FiberState 是 const enum（运行时不可读），插件硬编码名字数组；两边顺序必须逐位一致
const fiberSrc = readIf(rtFile('cordis', 'src/fiber.ts'))
const m = fiberSrc.match(/export const enum FiberState\s*\{([^}]*)\}/)
const enumNames = m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : []
check(enumNames.length === 6 && enumNames.map(s => s.toLowerCase()).join() === FIBER_NAMES.join(),
  'A1', 'FiberState 顺序与插件 FIBER_NAMES 逐位一致',
  'runtime: [' + enumNames.join(', ') + ']')
check(/const FIBER_NAMES = \['pending', 'loading', 'active', 'failed', 'disposed', 'unloading'\]/.test(PLUGIN),
  'A2', '插件内 FIBER_NAMES 字面量未被改动')

// A3 —— HARD-1 的核心：Entry 没有 _dispose
check(typeof Entry.prototype._dispose === 'undefined' && !('_dispose' in Entry.prototype),
  'A3', 'Entry 原型无 _dispose（HARD-1 的判定前提）')
check(!/class Entry\s+extends/.test(readIf(rtFile('cordis-plugin-loader', 'src/config/entry.ts'))),
  'A4', 'Entry 不继承任何基类（不存在基类提供 _dispose 的可能）')

// A5 —— 官方等价路径必须存在（dispose 是实例属性，不在原型上）
check(typeof Entry.prototype.update === 'function', 'A5', 'Entry.prototype.update 存在（入口重装配）')
check(typeof Entry.prototype.init === 'function', 'A6', 'Entry.prototype.init 存在')
check(typeof EntryGroup.prototype.remove === 'function', 'A7', 'EntryGroup.prototype.remove 存在')

// A9 —— EntryTree.entries 是生成器（插件在 19 处调用 ctx.loader.entries()）
check(typeof EntryTree.prototype.entries === 'function', 'A9', 'EntryTree.prototype.entries 存在')
const entriesFn = EntryTree.prototype.entries
check(entriesFn.constructor.name === 'GeneratorFunction', 'A10', 'EntryTree.entries 是生成器（可 for..of / 展开）',
  entriesFn.constructor.name)

// A11 —— loader.unwrapExports 语义
const unwrap = Loader.prototype.unwrapExports
check(typeof unwrap === 'function', 'A11', 'Loader.unwrapExports 存在')
if (typeof unwrap === 'function') {
  const inner = { apply () {} }
  const viaDefault = unwrap.call(Object.create(Loader.prototype), { default: inner })
  check(viaDefault === inner, 'A12', 'unwrapExports 解包 { default } 命名空间')
}

// A13 —— EntryTree.create 返回 entry id 字符串（插件三处忽略返回值）
check(/create\(options[^)]*\)\s*\{[\s\S]{0,200}?return group\.create\(options\)/.test(readIf(rtFile('cordis-plugin-loader', 'src/config/tree.ts'))),
  'A13', 'EntryTree.create 委托 EntryGroup.create 并返回其 entry id')

// A14 —— LoadCache 仍是 Map 子类（插件用 Map.prototype.delete.call / [...keys()]）
const internalSrc = readIf(rtFile('cordis-plugin-loader', 'src/internal.ts'))
check(/interface LoadCache extends Omit<Map</.test(internalSrc), 'A14', 'LoadCache 仍是 Map 子类（delete/keys 未被覆写）')

/* ============================================== A15-A18 行为断言：真实 cordis 实例 */

const ctx = new Context()
await ctx.plugin(Loader)
await ctx.plugin(TimerService)
await ctx.plugin(ToolRuntime)
await ctx.plugin(SystemPrompt)
await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })

for (const svc of ['loader', 'timer', 'tools', 'systemPrompt', 'webServer']) {
  check(!!ctx.get(svc), 'A15.' + svc, `宿主服务 ${svc} 可解析（插件的 inject 五项）`)
}

// A16 —— registry.delete(plugin) 只认 plugin：传 fiber 是 no-op（插件旧代码 BUG 的行为证据）
const probePlugin = { name: 'verify-probe', apply () {} }
const probeFiber = await ctx.plugin(probePlugin)
const sizeBefore = ctx.registry.size
ctx.registry.delete(probeFiber)
check(ctx.registry.size === sizeBefore, 'A16', 'registry.delete(fiber) 是 no-op（HARD-2 的行为证据）',
  'size ' + sizeBefore + ' -> ' + ctx.registry.size)
ctx.registry.delete(probePlugin)
check(ctx.registry.size === sizeBefore - 1, 'A17', 'registry.delete(plugin) 生效（修复后的等价路径）',
  'size ' + sizeBefore + ' -> ' + ctx.registry.size)

// A18 —— 经官方 loader 装配一个 data: URL 探针 entry，验证 Entry/Fiber 契约面
const probeSrc = 'export const name = "verify-probe-entry"\nexport function apply () {}\n'
const probeDataUrl = 'data:text/javascript,' + encodeURIComponent(probeSrc)
let probeEntry = null
try {
  const probeEntryId = await ctx.loader.create({ name: probeDataUrl, config: {} })
  probeEntry = [...ctx.loader.entries()].at(-1)
  check(probeEntry && probeEntry.id === probeEntryId, 'A18', 'loader.create 返回的 entry id 与该 entry 一致',
    probeEntryId)
  check(probeEntry && probeEntry.fiber && FIBER_NAMES[probeEntry.fiber.state] === 'active',
    'A19', 'loader 装配的 entry.fiber 为 active（fiber.entry 由 loader 回填）',
    probeEntry && probeEntry.fiber ? FIBER_NAMES[probeEntry.fiber.state] : 'no-fiber')
  const f = probeEntry && probeEntry.fiber
  const wanted = ['uid', 'state', 'dispose', 'parent', 'runtime', '_config']
  const missing = f ? wanted.filter(k => !(k in f)) : wanted
  check(missing.length === 0, 'A20', 'Fiber 暴露插件所用的全部字段',
    missing.length ? '缺失 ' + missing.join(', ') : wanted.join(', '))
  check(!!f && typeof f.dispose === 'function', 'A21', 'Fiber 实例有 dispose（entry._dispose 的官方等价）')
  const optWanted = ['id', 'name', 'config']
  const optMissing = probeEntry ? optWanted.filter(k => !(k in probeEntry.options)) : optWanted
  check(optMissing.length === 0, 'A22', 'EntryOptions 含插件读取的核心字段',
    optMissing.length ? '缺失 ' + optMissing.join(', ') : Object.keys(probeEntry.options).join(', '))
  const entrySrc = readIf(rtFile('cordis-plugin-loader', 'src/config/entry.ts'))
  const ifaceFields = ['id: string', 'name: string', 'config?: any', 'group?: boolean | null', 'disabled?: boolean | null', 'inject?: Inject | null']
  const ifaceMissing = ifaceFields.filter(x => !entrySrc.includes(x))
  check(ifaceMissing.length === 0, 'A23', 'EntryOptions 接口含插件读取的全部字段',
    ifaceMissing.length ? '缺失 ' + ifaceMissing.join(' | ') : ifaceFields.length + ' 个字段')
  await f.dispose()
} catch (e) {
  bad('A18', 'loader 探针装配', String((e && e.message) || e))
}

/* ================================================================ B. 资源契约 */

group('B. 资源注册契约')

// B1 --defineTool 形态
const def = defineTool({
  name: 'verify_probe_tool',
  description: 'probe',
  parameters: {},
  output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
  async execute () { return 'ok' },
})
check(def && def.name === 'verify_probe_tool' && typeof def.output.render === 'function',
  'B1', 'defineTool 返回 { name, parameters, output.render }')
check(parameterSchemaSpecToJsonSchema({ a: { type: 'string', required: true } }).required?.join() === 'a',
  'B2', '参数 spec 的 required: true 被收集为 JSON Schema required 数组')

// B3 —— ToolRegistry.register 要求 output.render
let registerThrew = null
try { ctx.get('tools').register({ name: 'bad_tool', description: 'x', parameters: {} }) } catch (e) { registerThrew = e }
check(!!registerThrew, 'B3', 'tools.register 缺 output.render 时抛错',
  registerThrew ? String(registerThrew.message).slice(0, 80) : '未抛错')
let registered = false
try { registered = typeof ctx.get('tools').register(defineTool({
  name: 'verify_probe_registered', description: 'probe', parameters: {},
  output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
  async execute () { return 'ok' },
})) === 'function' } catch { registered = false }
check(registered, 'B4', 'tools.register 返回 disposer')

// B5 —— webServer.register 返回 disposer；同 path 重复注册抛错
const disposeRoute = ctx.webServer.register({ kind: 'prefix', path: '/verify-probe', handler: () => {} })
check(typeof disposeRoute === 'function', 'B5', 'webServer.register 返回 disposer')
check(ctx.webServer.prefixes.has('/verify-probe'), 'B6', 'prefix 路由进入 prefixes 表')
let duplicateThrew = null
try { ctx.webServer.register({ kind: 'prefix', path: '/verify-probe', handler: () => {} }) } catch (e) { duplicateThrew = e }
check(!!duplicateThrew && /duplicate/.test(String(duplicateThrew.message)), 'B7', '重复 prefix 路由抛 duplicate',
  duplicateThrew ? String(duplicateThrew.message).slice(0, 80) : '未抛错')
disposeRoute()
check(!ctx.webServer.prefixes.has('/verify-probe'), 'B8', 'disposer 生效，路由已移除')

// B9 —— systemPrompt.context 需要 name 且 order 必须是有限数
const sp = ctx.get('systemPrompt')
let noOrderThrew = null
try { sp.context({ name: 'verify-probe-noorder', text: 'x' }) } catch (e) { noOrderThrew = e }
check(!!noOrderThrew && /order must be a finite number/.test(String(noOrderThrew.message)),
  'B9', 'systemPrompt.context 缺 order 时抛错（插件传 order: -90，满足）',
  noOrderThrew ? String(noOrderThrew.message).slice(0, 70) : '未抛错')
const spDispose = sp.context({ name: 'verify-probe', order: 0, text: 'x' })
check(typeof spDispose === 'function' && sp.layers.global.contexts.has('verify-probe'),
  'B10', 'systemPrompt.context({ name, order }) 注册成功并返回 disposer')

// B10 —— SlotCore：client 段的真实形态（两参 register；SlotCore 自身没有 inject）
check(typeof SlotCore.prototype.register === 'function' && SlotCore.prototype.register.length === 2,
  'SLOT1', 'SlotCore.register(options, component) 是双参', 'arity=' + SlotCore.prototype.register.length)
check(typeof SlotCore.prototype.inject === 'undefined', 'SLOT2', 'SlotCore 自身没有 inject（inject 在 client-ui-renderer 的 wrapper 上）')
check(resolveSlotLabel(() => 'x') === 'x' && resolveSlotLabel('y') === 'y', 'SLOT3', 'resolveSlotLabel 支持 thunk 与字面量')

// B13 —— dsh-client-modules 的图排序只看 external
const orderSrc = readIf(rtFile('dsh-client-modules', 'lib/index.js'))
check(typeof clientModules.orderByModuleGraph === 'function', 'CM1', 'orderByModuleGraph 存在')
check(/for \(const dep of entry\.external\)/.test(orderSrc) || /entry\.external/.test(orderSrc),
  'CM2', '模块图边只由 external 决定（inject 中的不存在包名是惰性的 → DRIFT-3 判定依据）')

// B15 —— agent preset 声明插件存在
check(!!presetMod.default, 'AP1', '@deepseek-ai/dsh-agent-preset 默认导出存在（O3 迁移目标）')
check(rtExists('dsh-agent-preset') && rtExists('dsh-agent-preset-registry'), 'AP2', 'preset 声明与其注册表包都在 runtime 中')
check(!rtExists('dsh-agent-presets'), 'AP3', '已废弃的复数包 dsh-agent-presets 不在 runtime 中（旧 .agent-presets 目录形态确已移除）')

/* ==================================================== C. 本仓库源码静态不变量 */

group('C. 本仓库静态不变量（已修复的漂移不得回归）')

check(!/\._dispose\b/.test(PLUGIN_CODE), 'C1', 'index.ts 代码中不再引用 entry._dispose（HARD-1）')
check(!/registry\.delete\(\s*fiber\s*\)/.test(PLUGIN_CODE), 'C2', 'index.ts 代码中不再 registry.delete(fiber)（HARD-2）')
check(/DSH_PROFILE_DIR/.test(PLUGIN), 'C3', 'index.ts 的 profile 解析优先 DSH_PROFILE_DIR（DRIFT-1）')
check(!/settings\.plugin\.item/.test(PLUGIN_CODE), 'C4', 'index.ts 代码中不再引用死槽名 settings.plugin.item（D13）')
check(!/settings\.plugin\.item/.test(PLUGIN_CLIENT_CODE), 'C5', 'client/index.ts 无死槽名')

const rootPkg = readJson(path.join(ROOT, 'package.json'))
const injPkg = readJson(path.join(ROOT, 'injector', 'package.json'))
const barePeers = [rootPkg, injPkg].flatMap(p => Object.keys(p.peerDependencies || {}).filter(k => k === 'cordis' || k === 'schemastery'))
check(barePeers.length === 0, 'C6', 'root/injector peerDependencies 无裸名 cordis / schemastery', barePeers.join(', ') || '(无)')
check(!!rootPkg.dsh?.bundle?.patch && !!injPkg.dsh?.bundle?.patch, 'C7', 'root/injector 均声明 dsh.bundle.patch')

const patchText = readIf(path.join(ROOT, 'cordis.patch.yml'))
check(/^- insert:/m.test(patchText) && /id: dsh-super-injector/.test(patchText) && /name: '@dsh-external\/dsh-super-injector'/.test(patchText),
  'C8', '根 cordis.patch.yml 是 insert 形态且 id/name 自洽')
check(/target.*<0\.3\.0|Target.*<0\.3\.0/.test(readIf(path.join(ROOT, 'README.md'))), 'C9', 'README 的 DSH Target 上界已上移（DRIFT-6）')

/* ================================================================ D. preset 包名 */

group('D. preset 引用的包名在 runtime 中真实存在（O3）')

const presetRoot = path.join(ROOT, 'preset')
const presetIds = fs.readdirSync(presetRoot, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(presetRoot, d.name, 'agent.cordis.yml')))
  .map(d => d.name)

for (const id of presetIds) {
  const text = readIf(path.join(presetRoot, id, 'agent.cordis.yml'))
  const names = [...text.matchAll(/^\s*name:\s*['"]?([^'"\n]+?)['"]?\s*$/gm)].map(m2 => m2[1].trim())
  const external = [...new Set(names.filter(n => n.startsWith('@')))]
  const relative = [...new Set(names.filter(n => n.startsWith('./') || n.startsWith('cordis:')))]
  const missing = external.filter(n => {
    const parts = n.split('/')
    return parts.length < 2 || !rtExists(parts[1])
  })
  check(missing.length === 0, 'D.' + id, `preset ${id} 引用的 ${external.length} 个包名全部存在`,
    missing.length ? '缺失: ' + missing.join(', ') : `${external.length} 个 ok · ${relative.length} 个相对/builtin`)
}

// 旧形态目录可能因用户自己的 preset 而存在；关键是**本仓库的 preset 不得依赖它**。
const oldPresetsDir = path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), '.agent-presets')
const legacy = fs.existsSync(oldPresetsDir) ? fs.readdirSync(oldPresetsDir).filter(n => /^router-/.test(n)) : []
check(legacy.length === 0, 'D.old-form', '本仓库 preset 未被投放到已废弃的 $DSH_HOME/.agent-presets',
  fs.existsSync(oldPresetsDir)
    ? `目录存在（内含 ${fs.readdirSync(oldPresetsDir).join(', ') || '空'}），其中 router-* 数量 ${legacy.length}`
    : '目录不存在')

/* ================================================================ 汇总 */

const failed = results.filter(r => !r.pass)
console.log('\n' + '='.repeat(72))
console.log(JSON.stringify({
  runtimeRoots: ROOTS,
  cordis: version('cordis'),
  checked: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  failures: failed.map(f => f.id + ' ' + f.name + (f.detail ? ' :: ' + f.detail : '')),
}, null, 2))
console.log('='.repeat(72))
process.exit(failed.length ? 1 : 0)
