// 校验生成的 preset bundle patch 合法，且 plugins 文本内联与原 agent.cordis.yml 语义完全一致；
// 并校验 agent.cordis.yml 里 `name: ./x.mjs` 相对引用的锚点资产在 bundle 目录里齐全。
//
// 用法：node scripts/verify-preset-bundle.mjs <runtimeNodeModules> <outDir> [repoRoot]
//   <runtimeNodeModules> 例如 "D:/.../DSH Desktop/resources/app/node_modules"（提供 yaml 解析器）
//
// 为什么必须查资产：cordis-composition-reference 规定 patch 里相对路径的锚点是承载它的
// patch 文件所在目录；代码证据 cordis-plugin-include/src/index.ts:188
//   this.ctx.baseUrl = new URL('.', pathToFileURL(this.filename)).href
// 所以 <outDir>/ 下必须同时存在这些 .mjs，否则 preset 挂载时 import 失败。
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const RT = process.argv[2]
const OUT = process.argv[3] ?? 'build/presets-test'
const REPO = process.argv[4] ?? process.cwd()
if (!RT) {
  console.error('usage: node scripts/verify-preset-bundle.mjs <runtimeNodeModules> <outDir> [repoRoot]')
  process.exit(1)
}
const require = createRequire(join(RT, 'noop.js'))
const YAML = require('yaml')

let fail = 0
const ok = (c, m) => {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`)
  if (!c) fail++
}

const patchPath = join(OUT, 'cordis.patch.yml')
const patchText = readFileSync(patchPath, 'utf8')
let patch
try {
  patch = YAML.parse(patchText)
  ok(true, 'cordis.patch.yml 可被 YAML 解析')
} catch (e) {
  ok(false, 'cordis.patch.yml 解析失败: ' + e.message)
  process.exit(1)
}

ok(Array.isArray(patch) && patch.length === 1, `顶层是长度为 1 的数组（实际 ${Array.isArray(patch) ? patch.length : typeof patch}）`)
const entry = patch[0]
ok(entry && Array.isArray(entry.insert), 'patch[0].insert 是数组')
ok(!('id' in entry), 'insert patch 不带 id（无 id 的 insert = 追加，见 cordis-plugin-include applyEntryPatches）')

const rows = entry.insert
ok(Array.isArray(rows) && rows.length > 0, `insert 有 ${rows?.length} 行`)
for (const row of rows) {
  const id = row?.config?.id
  ok(typeof row?.id === 'string' && row.id === `preset-${id}`, `Loader 行 id 约定 preset-<id>：${row?.id}`)
  ok(row?.name === '@deepseek-ai/dsh-agent-preset', `${id}: name = @deepseek-ai/dsh-agent-preset`)
  ok(Array.isArray(row?.config?.plugins), `${id}: config.plugins 是数组`)
  const srcPath = join(REPO, 'preset', String(id), 'agent.cordis.yml')
  if (!existsSync(srcPath)) {
    ok(false, `${id}: 找不到源文件 ${srcPath}`)
    continue
  }
  const src = YAML.parse(readFileSync(srcPath, 'utf8'))
  const a = JSON.stringify(row.config.plugins)
  const b = JSON.stringify(src)
  ok(a === b, `${id}: plugins 与 agent.cordis.yml 语义一致（${src.length} 个顶层 entry）`)
  if (a !== b) {
    console.log('  gen :', a.slice(0, 300))
    console.log('  orig:', b.slice(0, 300))
  }
}

// ── 锚点资产齐全性 ────────────────────────────────────────────────
const refRe = /^[ \t]*(?:-[ \t]+)?name:[ \t]*\.\/([A-Za-z0-9._-]+\.mjs)/gm
const referenced = [...new Set([...patchText.matchAll(refRe)].map((m) => m[1]))]
ok(referenced.length > 0, `patch 里存在本地 .mjs 相对引用（${referenced.length} 个唯一 basename）`)
for (const name of referenced) {
  ok(existsSync(join(OUT, name)), `锚点资产存在: ${name}`)
}

// 资产之间的本地 ESM 边也必须闭合（bootstrap → router-core）。
const assetRe = /(?:from|import\()\s*['"]\.\/([A-Za-z0-9._-]+\.mjs)['"]/g
let assets = []
try {
  assets = readdirSync(OUT).filter((f) => f.endsWith('.mjs'))
} catch {
  assets = []
}
ok(assets.length >= referenced.length, `bundle 目录下 .mjs 资产数 ${assets.length} ≥ 引用数 ${referenced.length}`)
for (const f of assets) {
  for (const m of readFileSync(join(OUT, f), 'utf8').matchAll(assetRe)) {
    ok(existsSync(join(OUT, m[1])), `资产内依赖闭合: ${f} → ${m[1]}`)
  }
}

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILURE(S)`)
process.exit(fail === 0 ? 0 : 1)
