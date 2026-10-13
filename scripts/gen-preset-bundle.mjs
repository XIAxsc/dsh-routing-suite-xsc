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
// 本脚本不做 YAML 解析：agent.cordis.yml 顶层就是一个 entry 列表，逐行统一
// 加缩进即可原样成为 config.plugins 的值，语义零改动。
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
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

/** JSON 字符串是合法的 YAML 双引号标量 —— 用它避免手写转义。 */
const yamlStr = (s) => JSON.stringify(String(s ?? ''))

const blocks = []
for (const id of ids) {
  const dir = join(presetRoot, id)
  const cordis = join(dir, 'agent.cordis.yml')
  if (!existsSync(cordis)) {
    console.error(`skip ${id}: 缺少 ${cordis}`)
    continue
  }
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
}

const banner = [
  '# 由 scripts/gen-preset-bundle.mjs 生成 —— 请勿手改，改动请落到 preset/<id>/。',
  '#',
  '# DSH 0.2.x：agent preset 是 @deepseek-ai/dsh-agent-preset 的普通声明行，由 bundle',
  '# patch 承载；$DSH_HOME/.agent-presets/ 目录已无人读取。',
  '# 权威判词：@deepseek-ai/dsh-agent-preset/skills/editing-cordis-compositions/SKILL.md:70',
  '',
].join('\n')

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'cordis.patch.yml'), `${banner}- insert:\n${blocks.join('\n')}\n`, 'utf8')

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
      files: ['cordis.patch.yml'],
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    },
    null,
    2,
  ) + '\n',
  'utf8',
)

console.error(`generated: ${outDir}  (presets: ${ids.join(', ') || 'none'})`)
