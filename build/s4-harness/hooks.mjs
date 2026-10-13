// S4 进程内装配 —— ESM 解析钩子（不建 junction、不写任何 DSH profile 目录）
// 把 @deepseek-ai/* 映射到权威 runtime 树，把 @dsh-external/dsh-super-injector 映射到本仓库源码。
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const RT = 'D:/WorkSpace/Agents/DSH-Desktop/DSH Desktop/resources/app/node_modules'
const WS = 'D:/WorkSpace/AgentWorks/DSH/dsh-routing-suite-xsc'

const CANDIDATES = ['lib/index.js', 'lib/index.mjs', 'lib/index.cjs', 'index.js', 'dist/index.js']

// 插件本身装配目标（S4_TARGET 选择）：
//   dist = 真实分发包产物 injector/lib/index.js（tsdown，prepare 钩子产出）← 默认
//   tsc  = tsc --noCheck 的 emit build/s4-build/lib/index.js
//   src  = TS 源码 injector/src/index.ts（Node 类型擦除）
const TARGETS = {
  dist: path.join(WS, 'injector/lib/index.js'),
  tsc: path.join(WS, 'build/s4-build/lib/index.js'),
  src: path.join(WS, 'injector/src/index.ts'),
}
function pickTarget () {
  const want = process.env.S4_TARGET || 'dist'
  if (TARGETS[want] && fs.existsSync(TARGETS[want])) return { kind: want, file: TARGETS[want] }
  for (const kind of ['dist', 'tsc', 'src']) {
    if (fs.existsSync(TARGETS[kind])) return { kind, file: TARGETS[kind] }
  }
  return { kind: 'src', file: TARGETS.src }
}

function pkgEntry (pkgDir) {
  for (const c of CANDIDATES) {
    const f = path.join(pkgDir, c)
    if (fs.existsSync(f)) return f
  }
  return null
}

export async function resolve (specifier, context, nextResolve) {
  if (specifier === '@dsh-external/dsh-super-injector') {
    const t = pickTarget()
    return { url: pathToFileURL(t.file).href, shortCircuit: true }
  }
  if (specifier.startsWith('@deepseek-ai/')) {
    const parts = specifier.split('/')
    const pkgDir = path.join(RT, parts[0], parts[1])
    if (parts.length === 2) {
      const f = pkgEntry(pkgDir)
      if (f) return { url: pathToFileURL(f).href, shortCircuit: true }
    } else {
      const sub = parts.slice(2).join('/')
      const tries = [
        path.join(pkgDir, 'lib', sub + '.js'),
        path.join(pkgDir, 'lib', sub, 'index.js'),
        path.join(pkgDir, sub + '.js'),
      ]
      for (const f of tries) {
        if (fs.existsSync(f)) return { url: pathToFileURL(f).href, shortCircuit: true }
      }
    }
  }
  return nextResolve(specifier, context)
}
