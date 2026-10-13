// S4 探针：装配后 dump tools / systemPrompt 的真实结构，用于修正断言
import { register } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const SCRATCH = path.join(HERE, 'scratch')
process.env.DSH_HOME = path.join(SCRATCH, 'dsh-home')
fs.mkdirSync(process.env.DSH_HOME, { recursive: true })
register('./hooks.mjs', import.meta.url)

const { Context } = await import('@deepseek-ai/cordis')
const { default: Loader } = await import('@deepseek-ai/cordis-plugin-loader')
const { default: TimerService } = await import('@deepseek-ai/cordis-plugin-timer')
const { default: ToolRuntime } = await import('@deepseek-ai/dsh-tools')
const { default: SystemPrompt } = await import('@deepseek-ai/dsh-system-prompt')
const { default: WebServer } = await import('@deepseek-ai/dsh-host-webserver')

const ctx = new Context()
await ctx.plugin(Loader)
await ctx.plugin(TimerService)
await ctx.plugin(ToolRuntime)
await ctx.plugin(SystemPrompt)
await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })

await ctx.loader.create({
  name: '@dsh-external/dsh-super-injector',
  config: {
    registryFile: path.join(SCRATCH, 'registry.json'),
    profileNodeModules: path.join(SCRATCH, 'profile', 'node_modules'),
    autoRestore: false,
    intervalMs: 600000,
  },
})

const mod = await import(pathToFileURL('D:/WorkSpace/AgentWorks/DSH/dsh-routing-suite-xsc/injector/src/index.ts').href)
console.log('--- mod exports ---')
console.log(JSON.stringify(Object.keys(mod)))
console.log('typeof mod.Config =', typeof mod.Config, '| ctor =', mod.Config && mod.Config.constructor && mod.Config.constructor.name)
console.log('mod.Config["~standard"]? ', mod.Config && typeof mod.Config['~standard'])

const tr = ctx.get('tools')
console.log('\n--- tools (ToolRuntime) ---')
console.log('proto:', Object.getOwnPropertyNames(Object.getPrototypeOf(tr)).join(', '))
console.log('own:', Object.getOwnPropertyNames(tr).join(', '))
console.log('layers:', tr.layers && Object.getOwnPropertyNames(tr.layers).join(', '))
for (const scopeName of ['root', 'scope', 'global']) {
  const s = tr.layers && tr.layers[scopeName]
  if (!s) continue
  console.log(`  layers.${scopeName} own:`, Object.getOwnPropertyNames(s).join(', '))
  if (s.tools) console.log(`  layers.${scopeName}.tools type:`, s.tools.constructor && s.tools.constructor.name,
    '| keys:', typeof s.tools.keys === 'function' ? [...s.tools.keys()].join(', ') : 'n/a')
}
console.log('tr.tools?', tr.tools && typeof tr.tools, tr.tools && tr.tools.constructor && tr.tools.constructor.name)

const sp = ctx.get('systemPrompt')
console.log('\n--- systemPrompt ---')
console.log('proto:', Object.getOwnPropertyNames(Object.getPrototypeOf(sp)).join(', '))
console.log('own:', Object.getOwnPropertyNames(sp).join(', '))
console.log('layers:', sp.layers && Object.getOwnPropertyNames(sp.layers).join(', '))
for (const scopeName of ['root', 'scope', 'global']) {
  const s = sp.layers && sp.layers[scopeName]
  if (!s) continue
  console.log(`  layers.${scopeName} own:`, Object.getOwnPropertyNames(s).join(', '))
  if (s.contexts) console.log(`  layers.${scopeName}.contexts keys:`, typeof s.contexts.keys === 'function' ? [...s.contexts.keys()].join(', ') : 'n/a')
}

console.log('\n--- webServer prefixes ---')
console.log([...ctx.webServer.prefixes.keys()].join(', '))
process.exit(0)
