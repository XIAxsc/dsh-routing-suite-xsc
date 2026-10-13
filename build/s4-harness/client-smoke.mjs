// S4 · client 侧浏览器产物冒烟（**无浏览器**，用 vm 模拟模块表 + 最小 React）
// 验证：真实分发包产物 injector/lib/client.js 的 __ModuleLoader__ 契约、
//       注入声明、两参 slots.register 形态、以及它能被"应用"且渲染不抛错。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WS = path.resolve(HERE, '..', '..')
const BUNDLE = path.join(WS, 'injector', 'lib', 'client.js')

const PLUGIN_ID = '@dsh-external/dsh-super-injector'

// 浏览器模块表 9 项种子（dsh-web-frontend rM()）
const SEED_TABLE = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

const results = []
function check (name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) })
}

// ── 最小 React 替身 ─────────────────────────────────────────────────────────
const elementCalls = []
function createElement (type, props, ...children) {
  elementCalls.push({ type, props, children })
  return { __el: true, type, props, children }
}
const ReactStub = {
  createElement,
  Fragment: Symbol.for('react.fragment'),
  useEffect: () => {},
  useRef: (init) => ({ current: init === undefined ? null : init }),
  useState: (init) => [init, () => {}],
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  Component: class {},
}
const jsxRuntime = { jsx: createElement, jsxs: createElement, Fragment: ReactStub.Fragment }

const requested = []
function requireShim (spec) {
  requested.push(spec)
  if (spec === 'react') return ReactStub
  if (spec === 'react/jsx-runtime') return jsxRuntime
  if (spec === 'react-dom') return { createPortal: (n) => n }
  if (spec === 'react-dom/client') return { createRoot: () => ({ render: () => {}, unmount: () => {} }) }
  throw new Error('client bundle 请求了模块表外的模块: ' + spec)
}

// ── 假浏览器 + ModuleLoader ─────────────────────────────────────────────────
let loaded = null
const sandbox = { console }
sandbox.window = sandbox
sandbox.globalThis = sandbox
sandbox.__ModuleLoader__ = { load (mod) { loaded = mod } }

const code = fs.readFileSync(BUNDLE, 'utf8')
vm.createContext(sandbox)
vm.runInContext(code, sandbox, { filename: 'client.js' })

check('C1 client.js 产出了 __ModuleLoader__.load 调用', loaded !== null)
check('C2 注册 id 等于包名', loaded && loaded.id === PLUGIN_ID, loaded && loaded.id)
check('C3 注册的是 lazy factory（函数）', loaded && typeof loaded.factory === 'function', loaded && typeof loaded.factory)

if (!loaded || typeof loaded.factory !== 'function') {
  console.log(JSON.stringify({ total: results.length, passed: 0, failed: 1, failures: ['factory 缺失'] }, null, 2))
  process.exit(1)
}

// ── 执行 factory ────────────────────────────────────────────────────────────
const mod = loaded.factory(requireShim)

check('C4 factory 只请求模块表内的 specifier', requested.every((s) => SEED_TABLE.includes(s)), requested.join(', '))
check('C5 模块注入声明 inject = ["slots"]',
  Array.isArray(mod.inject) && mod.inject.length === 1 && mod.inject[0] === 'slots',
  JSON.stringify(mod.inject))
check('C6 导出 apply 函数', typeof mod.apply === 'function')

// ── 执行 apply（假 ctx）──────────────────────────────────────────────────────
const injections = []
const registrations = []
const effects = []
const ctx = {
  effect (fn) { effects.push(fn); const d = fn(); return d },
  slots: {
    inject (name, cb) { injections.push(name); return cb() },
    register (options, component) { registrations.push({ options, component }) },
  },
  get () { return undefined },
}

let applyError = null
try { mod.apply(ctx) } catch (e) { applyError = e && e.message }
check('C7 apply 未抛错', applyError === null, applyError || '')

check('C8 资源注册挂在 ctx.effect 内', effects.length >= 1, effects.length)
check('C9 注入到 settings.section 槽',
  injections.length === 1 && injections[0] === 'settings.section', JSON.stringify(injections))
check('C10 恰好注册 1 个槽 occupant', registrations.length === 1, registrations.length)

const reg = registrations[0]
if (reg) {
  const o = reg.options || {}
  check('C11 occupant 是**两参**形态（第二参为组件）', typeof reg.component === 'function')
  check('C12 未使用已废的单参 options.component', o.component === undefined, typeof o.component)
  check('C13 options.name = settings.section', o.name === 'settings.section', o.name)
  check('C14 options.id = super-injector-plugins', o.id === 'super-injector-plugins', o.id)
  check('C15 options.order = 50', o.order === 50, o.order)
  check('C16 label 是 thunk（resolveSlotLabel 会调用）', typeof o.label === 'function', typeof o.label)
  let labelValue = null
  let labelErr = null
  try { labelValue = o.label() } catch (e) { labelErr = e && e.message }
  check('C17 label() 返回非空字符串', typeof labelValue === 'string' && labelValue.length > 0, labelErr || labelValue)

  // 渲染：执行 occupant（slots 会 createElement 它）
  elementCalls.length = 0
  let renderErr = null
  try { reg.component() } catch (e) { renderErr = e && e.message }
  check('C18 组件可被调用且不抛错（渲染 1 个元素）', renderErr === null && elementCalls.length >= 1,
    renderErr || ('元素数 ' + elementCalls.length))
} else {
  for (const n of ['C11', 'C12', 'C13', 'C14', 'C15', 'C16', 'C17', 'C18']) check(n, false, '无注册记录')
}

// ── 输出 ────────────────────────────────────────────────────────────────────
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  — ' + r.detail : ''}`)
const failures = results.filter((r) => !r.ok)
console.log('\n=== 汇总 ===')
console.log(JSON.stringify({ total: results.length, passed: results.length - failures.length, failed: failures.length, failures: failures.map((f) => f.name) }, null, 2))
process.exit(failures.length ? 1 : 0)
