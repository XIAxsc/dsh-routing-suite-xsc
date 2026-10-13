#!/usr/bin/env node
// 生成 router preset 的 DSH 0.2.x 声明式 bundle。
//
// 用法：node scripts/gen-preset-bundle.mjs <repoRoot> <outDir> [presetId...]
//
// ── 为什么要这个脚本（O3 / 旧形态已废）────────────────────────────
// 旧形态是 $DSH_HOME/.agent-presets/<id>/{preset.yml,agent.cordis.yml}。
// 权威判词（@deepseek-ai/dsh-agent-preset/skills/editing-cordis-compositions/SKILL.md:70）：
//   "Before declaration rows, a user preset was a directory $DSH_HOME/.agent-presets/<id>/
//    holding preset.yml … and agent.cordis.yml … Nothing reads that directory any more."
// 同 SKILL :8 给出新形态：
//   "Agent presets are ordinary @deepseek-ai/dsh-agent-preset declarations carried by
//    bundle patches."
// 迁移映射（同 SKILL :70）：声明 config.id ← 目录名；config.name/description/order
// ← preset.yml；config.plugins ← agent.cordis.yml 原样。
// Loader 行 id 约定为 preset-<id>（同 SKILL :14）。
//
// ── 本地 .mjs 资产必须随行（真装验证发现，v0.3.4 补）──────────────
// agent.cordis.yml 里有 `name: ./router-bootstrap-v34.mjs?v=88` 这类相对引用。
// cordis-composition-reference 的 patch 方言明确规定相对路径的锚点是承载它的
// patch 文件所在目录；代码证据：cordis-plugin-include/src/index.ts:188
//   this.ctx.baseUrl = new URL('.', pathToFileURL(this.filename)).href
// 旧形态下 agent.cordis.yml 与这些 .mjs 同目录所以能解析；迁移成单一 bundle
// patch 后，若不把 .mjs 一并放到 <outDir>/，相对引用会在 preset 挂载时解析失败。
// 三件 preset 引用的 basename 全局唯一（router-bootstrap-v{34,10,17}.mjs、
// router-core-v{34,10,17}.mjs、gitbash-executor.mjs），故可平铺到 <outDir>/ 根，
// 无需改写 YAML —— 语义与旧形态逐字一致。
//
// 本脚本不做 YAML 解析：agent.cordis.yml 顶层就是一个 entry 列表，逐行统一
// 加缩进即可原样成为 config.plugins 的值，语义零改动。
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [repoRoot, outDir, ...only] = process.argv.slice(2)
if (!repoRoot || !outDir) {
  console.error('usage: node scripts/gen-preset-bundle.mjs <repoRoot> <outDir> [presetId...]')
  process.exit(1)
}

const presetRoot = join(repoRoot, 'preset')
const ids = (
  only.length > 0
    ? only
    : readdirSync(presetRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory() && existsSync(join(presetRoot, d.name, 'preset.yml')))
        .map((d) => d.name)
).sort()

/** preset.yml 只有 name / description / order 三个顶层标量（见 SKILL.md:70 的迁移映射）。 */
function readPresetYml(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line)
    if (!m) continue
    let v = m[2].trim()
    if (v.length >= 2 && /^(".*"|'.*')$/.test(v)) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}

/** agent.cordis.yml → config.plugins 的 YAML 文本（统一 +10 空格，原样保留）。 */
function indentPlugins(file, prefix = '          ') {
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => (line.trim() === '' ? '' : prefix + line))
    .join('\n')
    .replace(/\n+$/, '')
}

/** YAML 里 `name: ./x.mjs?v=N` 形式的本地引用（去掉 query）。 */
function localRefs(text) {
  return [
    ...new Set([...text.matchAll(/^[ \t]*(?:-[ \t]+)?name:[ \t]*\.\/([A-Za-z0-9._-]+\.mjs)/gm)].map((m) => m[1])),
  ]
}

/** 本地引用的传递闭包：bootstrap → `from './router-core-vNN.mjs'` 同目录依赖。 */
function localClosure(dir, seeds) {
  const seen = new Set()
  const queue = [...seeds]
  while (queue.length > 0) {
    const name = queue.shift()
    if (seen.has(name)) continue
    seen.add(name)
    const p = join(dir, name)
    if (!existsSync(p)) continue
    for (const m of readFileSync(p, 'utf8').matchAll(/(?:from|import\()\s*['"]\.\/([A-Za-z0-9._-]+\.mjs)['"]/g)) {
      if (!seen.has(m[1])) queue.push(m[1])
    }
  }
  return [...seen].sort()
}

/** JSON 字符串是合法的 YAML 双引号标量 —— 用它避免手写转义。 */
const yamlStr = (s) => JSON.stringify(String(s ?? ''))

const blocks = []
/** basename → 绝对源路径（跨 preset 去重；同名不同内容即报错）。 */
const assets = new Map()
for (const id of ids) {
  const dir = join(presetRoot, id)
  const cordis = join(dir, 'agent.cordis.yml')
  if (!existsSync(cordis)) {
    console.error(`skip ${id}: 缺少 ${cordis}`)
    continue
  }
  const cordisText = readFileSync(cordis, 'utf8')
  const meta = readPresetYml(join(dir, 'preset.yml'))
  const lines = [
    `    - id: preset-${id}`,
    `      name: '@deepseek-ai/dsh-agent-preset'`,
    '      config:',
    `        id: ${id}`,
  ]
  if (meta.name) lines.push(`        name: ${yamlStr(meta.name)}`)
  if (meta.description) lines.push(`        description: ${yamlStr(meta.description)}`)
  if (meta.order) lines.push(`        order: ${meta.order}`)
  lines.push('        plugins:')
  lines.push(indentPlugins(cordis))
  blocks.push(lines.join('\n'))

  for (const name of localClosure(dir, localRefs(cordisText))) {
    const from = join(dir, name)
    const prev = assets.get(name)
    if (prev && prev !== from && readFileSync(prev, 'utf8') !== readFileSync(from, 'utf8')) {
      console.error(`COLLISION: ${name} 来自 ${prev} 与 ${from} 且内容不同 —— 需按 preset 分子目录`)
      process.exit(1)
    }
    assets.set(name, from)
  }
}

const banner = [
  '# 由 scripts/gen-preset-bundle.mjs 生成 —— 请勿手改，改动请落到 preset/<id>/。',
  '#',
  '# DSH 0.2.x：agent preset 是 @deepseek-ai/dsh-agent-preset 的普通声明行，由 bundle',
  '# patch 承载；$DSH_HOME/.agent-presets/ 目录已无人读取。',
  '# 权威判词：@deepseek-ai/dsh-agent-preset/skills/editing-cordis-compositions/SKILL.md:70',
  '#',
  '# 同目录的 *.mjs 是 agent.cordis.yml 里相对 `name: ./*.mjs` 引用的锚点资产',
  '# （锚点 = 本 patch 文件所在目录；cordis-plugin-include/src/index.ts:188），勿删。',
  '',
].join('\n')

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'cordis.patch.yml'), `${banner}- insert:\n${blocks.join('\n')}\n`, 'utf8')

for (const [name, from] of assets) copyFileSync(from, join(outDir, name))

const suitePkgPath = join(presetRoot, 'package.json')
const suitePkg = existsSync(suitePkgPath) ? JSON.parse(readFileSync(suitePkgPath, 'utf8')) : {}
writeFileSync(
  join(outDir, 'package.json'),
  JSON.stringify(
    {
      name: 'dsh-router-presets',
      version: suitePkg.version ?? '0.0.0',
      private: true,
      type: 'module',
      description: 'router presets as DSH 0.2.x @deepseek-ai/dsh-agent-preset declaration rows (bundle patch)',
      files: ['cordis.patch.yml', '*.mjs'],
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    },
    null,
    2,
  ) + '\n',
  'utf8',
)

// 自检：生成的 patch 里每个 `name: ./x.mjs` 都必须能在 <outDir>/ 找到实体。
const generated = readFileSync(join(outDir, 'cordis.patch.yml'), 'utf8')
const missing = localRefs(generated).filter((n) => !existsSync(join(outDir, n)))
if (missing.length > 0) {
  console.error(`MISSING assets in bundle (${outDir}): ${missing.join(', ')}`)
  process.exit(1)
}

console.error(`generated: ${outDir}  (presets: ${ids.join(', ') || 'none'}; assets: ${[...assets.keys()].join(', ') || 'none'})`)
