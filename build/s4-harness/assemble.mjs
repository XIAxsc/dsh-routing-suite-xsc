// S4 进程内装配 smoke —— 真实 cordis Context + 官方 Loader 装配本仓库 `injector/src/index.ts`
//
// 硬约束遵守方式：
//   * DSH_HOME 被重定向到本工作区 scratch 目录，绝不写 D:\WorkSpace\Agents\DSH
//   * 不建 junction、不写 profiles/*、不碰 profiles/desktop/cordis.patch.yml
//   * 端口用 0（随机），不占用线上 19387
import { register } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const SCRATCH = path.join(HERE, 'scratch')
const DSH_HOME = path.join(SCRATCH, 'dsh-home')
const PROFILE_NM = path.join(SCRATCH, 'profile', 'node_modules')
const WS = 'D:/WorkSpace/AgentWorks/DSH/dsh-routing-suite-xsc'

for (const d of [SCRATCH, DSH_HOME, PROFILE_NM]) fs.mkdirSync(d, { recursive: true })
process.env.DSH_HOME = DSH_HOME
process.env.DSH_RUNTIME_NODE_MODULES = 'D:/WorkSpace/Agents/DSH-Desktop/DSH Desktop/resources/app/node_modules'

register('./hooks.mjs', import.meta.url)

const results = []
const ok = (name, detail = '') => { results.push({ name, pass: true, detail }); console.log('  PASS  ' + name + (detail ? '  — ' + detail : '')) }
const bad = (name, detail = '') => { results.push({ name, pass: false, detail }); console.log('  FAIL  ' + name + (detail ? '  — ' + detail : '')) }
const check = (cond, name, detail = '') => cond ? ok(name, detail) : bad(name, detail)

const { Context } = await import('@deepseek-ai/cordis')
const { default: Loader } = await import('@deepseek-ai/cordis-plugin-loader')
const { default: TimerService } = await import('@deepseek-ai/cordis-plugin-timer')
const { default: ToolRuntime } = await import('@deepseek-ai/dsh-tools')
const { default: SystemPrompt } = await import('@deepseek-ai/dsh-system-prompt')
const { default: WebServer } = await import('@deepseek-ai/dsh-host-webserver')

const FIBER_NAMES = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading']
const stateOf = (fiber) => fiber ? FIBER_NAMES[fiber.state] : 'no-fiber'
const toolKeys = (ctx) => { try { return [...ctx.get('tools').layers.global.tools.keys()] } catch { return [] } }
const promptKeys = (ctx) => { try { return [...ctx.get('systemPrompt').layers.global.contexts.keys()] } catch { return [] } }
const routeKeys = (ctx) => { try { return [...ctx.webServer.prefixes.keys()] } catch { return [] } }

console.log('=== [1] 组装最小宿主（全部真实官方服务实现）===')
const WS_ROOT = path.join(HERE, '..', '..')
const TARGET_FILES = {
  dist: path.join(WS_ROOT, 'injector', 'lib', 'index.js'),
  tsc: path.join(HERE, '..', 's4-build', 'lib', 'index.js'),
  src: path.join(WS_ROOT, 'injector', 'src', 'index.ts'),
}
const WANT = process.env.S4_TARGET || 'dist'
const ACTIVE = fs.existsSync(TARGET_FILES[WANT]) ? WANT : (fs.existsSync(TARGET_FILES.dist) ? 'dist' : 'src')
console.log('装配目标: ' + ACTIVE + '  →  ' + TARGET_FILES[ACTIVE])
const ctx = new Context()
await ctx.plugin(Loader)
await ctx.plugin(TimerService)
await ctx.plugin(ToolRuntime)
await ctx.plugin(SystemPrompt)
await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
for (const svc of ['loader', 'timer', 'tools', 'systemPrompt', 'webServer']) {
  check(!!ctx.get(svc), '宿主已提供服务 ' + svc)
}

console.log('=== [2] 插件模块面 ===')
const mod = await import(pathToFileURL(path.join(WS, 'injector/src/index.ts')).href)
check(mod.name === 'dsh-super-injector', '导出 name', String(mod.name))
check(Array.isArray(mod.inject) && mod.inject.join() === 'loader,timer,tools,systemPrompt,webServer', '导出 inject', JSON.stringify(mod.inject))
check(mod.Config !== undefined && mod.Config['~standard'] !== undefined, '导出 Config 是 schemastery schema', 'typeof=' + typeof mod.Config)
check(typeof mod.apply === 'function', '导出 apply')

console.log('=== [3] 官方 Loader 按包名装配（等价于 bundle patch 的 insert 行）===')
const CONFIG = {
  registryFile: path.join(SCRATCH, 'registry.json'),
  profileNodeModules: PROFILE_NM,
  autoRestore: false,
  intervalMs: 600000,
}
let entryId = null
try {
  entryId = await ctx.loader.create({ name: '@dsh-external/dsh-super-injector', config: CONFIG })
} catch (e) {
  bad('loader.create 装配成功', String((e && e.stack) || e))
}
const entries = [...ctx.loader.entries()]
const entry = entries[0]
ok('loader.create 装配成功', 'entry=' + entryId)
check(entries.length === 1, 'loader 树内 entry 数', String(entries.length))
check(stateOf(entry && entry.fiber) === 'active', '插件 fiber 状态 active', stateOf(entry && entry.fiber))
check(!!(entry && entry.options && entry.options.name === '@dsh-external/dsh-super-injector'), 'entry.options.name 正确')
check(!!(entry && typeof entry.fiber.uid === 'number'), 'fiber.uid 已分配', entry && entry.fiber ? String(entry.fiber.uid) : '')
check(entry && typeof entry._dispose === 'undefined', 'Entry 无 _dispose（印证 HARD-1 判定）', 'typeof=' + (entry && typeof entry._dispose))

console.log('=== [4] 副作用断言（工具 / 路由 / 系统提示）===')
const tools = toolKeys(ctx)
const devTools = tools.filter(n => n.startsWith('dev_'))
check(devTools.length === 19, '插件注册 19 个 dev_* 工具', devTools.length + ' 个: ' + devTools.slice(0, 6).join(', ') + ' …')
const routes = routeKeys(ctx)
check(routes.includes('/super-injector/api'), '插件注册 webServer 路由', routes.join(', '))
const prompts = promptKeys(ctx)
check(prompts.includes('dsh-super-injector'), '插件注册 systemPrompt 上下文', prompts.join(', '))

console.log('=== [5] 卸载（dispose）验证 ===')
let disposeError = null
try { await entry.fiber.dispose() } catch (e) { disposeError = e }
check(!disposeError, 'entry.fiber.dispose() 未抛错', disposeError ? String((disposeError && disposeError.stack) || disposeError) : '')
check(stateOf(entry.fiber) === 'disposed', 'dispose 后 fiber 已释放', stateOf(entry.fiber))
check(toolKeys(ctx).filter(n => n.startsWith('dev_')).length === 0, 'dispose 后 dev_* 工具已注销', toolKeys(ctx).length + ' 个残留')
check(!routeKeys(ctx).includes('/super-injector/api'), 'dispose 后路由已移除', routeKeys(ctx).join(', ') || '(空)')
check(!promptKeys(ctx).includes('dsh-super-injector'), 'dispose 后系统提示上下文已移除', promptKeys(ctx).join(', ') || '(空)')

console.log('=== [6] 二次装配（回归：重复路由 / 残留）===')
let secondError = null
let entry2 = null
try {
  await ctx.loader.create({ name: '@dsh-external/dsh-super-injector', config: CONFIG })
  // 注意：create 每次分配新 entry id（ensureId 随机），第一个匹配项是被 dispose 的旧 entry —— 必须取最后一个
  entry2 = [...ctx.loader.entries()].filter(e => e.options && e.options.name === '@dsh-external/dsh-super-injector').at(-1)
} catch (e) { secondError = e }
check(!secondError, '二次装配未抛错', secondError ? String((secondError && secondError.message) || secondError) : '')
check(stateOf(entry2 && entry2.fiber) === 'active', '二次装配后 fiber active', stateOf(entry2 && entry2.fiber))
check(toolKeys(ctx).filter(n => n.startsWith('dev_')).length === 19, '二次装配后 dev_* 工具数为 19', String(toolKeys(ctx).filter(n => n.startsWith('dev_')).length))

console.log('\n=== 汇总 ===')
const failed = results.filter(r => !r.pass)
console.log(JSON.stringify({
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  failures: failed.map(f => f.name + ' :: ' + f.detail),
  scratch: SCRATCH,
}, null, 2))
process.exit(failed.length ? 1 : 0)
