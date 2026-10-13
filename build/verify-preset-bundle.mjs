// S4 临时校验：用 runtime 自带的 YAML 解析器证明生成的 preset bundle patch 合法，
// 并证明 plugins 的文本内联与原 agent.cordis.yml 语义完全一致。
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const RT = process.argv[2]
const OUT = process.argv[3] ?? 'build/presets-test'
const require = createRequire(join(RT, 'noop.js'))
const YAML = require('yaml')

let fail = 0
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail++ }

const patchText = readFileSync(join(OUT, 'cordis.patch.yml'), 'utf8')
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
ok(rows.length === 3, `insert 有 3 行（实际 ${rows.length}）`)
for (const row of rows) {
  const id = row?.config?.id
  ok(typeof row?.id === 'string' && row.id === `preset-${id}`, `Loader 行 id 约定 preset-<id>：${row?.id}`)
  ok(row?.name === '@deepseek-ai/dsh-agent-preset', `${id}: name = @deepseek-ai/dsh-agent-preset`)
  ok(Array.isArray(row?.config?.plugins), `${id}: config.plugins 是数组`)
  const src = YAML.parse(readFileSync(join('preset', id, 'agent.cordis.yml'), 'utf8'))
  const a = JSON.stringify(row.config.plugins)
  const b = JSON.stringify(src)
  ok(a === b, `${id}: plugins 与 agent.cordis.yml 语义一致（${src.length} 个顶层 entry）`)
  if (a !== b) {
    console.log('  gen :', a.slice(0, 300))
    console.log('  orig:', b.slice(0, 300))
  }
}

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILURE(S)`)
process.exit(fail === 0 ? 0 : 1)
