#!/bin/bash
# Build dsh-super-injector: compile src/ → lib/ with a `tsc`.
#
# 依赖来源二选一（A 优先）：
#   A) 源码 checkout —— DSH_CHECKOUT=/path/to/dsh-checkout
#      目录里要有 packages/、vendor/、node_modules/.bin/tsc。
#   B) 已安装的 runtime node_modules —— DSH_RUNTIME_NODE_MODULES=/path/to/node_modules
#      扁平布局 <nm>/@deepseek-ai/<pkg>。DSH 0.2.x 的部署就是这种形态：
#      $DSH_HOME/profiles/node_modules（或 <app>/resources/app/node_modules）。
#      未显式给出时按 $DSH_PROFILE_DIR / $DSH_HOME/profiles/* 自动探测。
#
# ⚠️ DSH 0.2.x 适配（v0.3.4）：旧版只认源码 checkout，在没有 checkout 的
#    安装版部署里必然 "cannot locate the dsh checkout" 退出。源码树里 cordis
#    位于 vendor/cordis，而安装版是扁平的 @deepseek-ai/cordis —— 两者都要支持。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE=""
CHECKOUT="${DSH_CHECKOUT:-}"
RUNTIME_NM="${DSH_RUNTIME_NODE_MODULES:-}"

# ── B 自动探测：已安装 runtime 的 node_modules ──
if [ -z "$CHECKOUT" ] && [ -z "$RUNTIME_NM" ]; then
  for c in \
    "${DSH_PROFILE_DIR:+$(dirname "$DSH_PROFILE_DIR")/node_modules}" \
    "${DSH_HOME:+$DSH_HOME/profiles/node_modules}" \
    "${DSH_HOME:+$DSH_HOME/node_modules}"
  do
    if [ -n "$c" ] && [ -d "$c/@deepseek-ai/cordis" ]; then RUNTIME_NM="$c"; break; fi
  done
  if [ -z "$RUNTIME_NM" ] && [ -n "${DSH_HOME:-}" ]; then
    RUNTIME_NM="$(ls -d "$DSH_HOME"/profiles/*/node_modules 2>/dev/null | head -1 || true)"
  fi
fi

if [ -n "$CHECKOUT" ] && [ -d "$CHECKOUT/packages" ]; then
  MODE="checkout"
elif [ -n "$RUNTIME_NM" ] && [ -d "$RUNTIME_NM/@deepseek-ai/cordis" ]; then
  MODE="runtime"
else
  echo "build: 找不到依赖来源。" >&2
  echo "build:   设 DSH_CHECKOUT=<dsh 源码 checkout>（需含 packages/ 与 vendor/），或" >&2
  echo "build:   设 DSH_RUNTIME_NODE_MODULES=<已安装 runtime 的 node_modules>" >&2
  exit 1
fi

if [ "$MODE" = "checkout" ]; then
  TSC="$CHECKOUT/node_modules/.bin/tsc"
else
  TSC="$(command -v tsc || true)"
  if [ -z "$TSC" ] && [ -x "$RUNTIME_NM/.bin/tsc" ]; then TSC="$RUNTIME_NM/.bin/tsc"; fi
fi
if [ -z "$TSC" ] || [ ! -x "$TSC" ]; then
  echo "build: tsc not found (MODE=$MODE, tried '${TSC:-none}')" >&2
  echo "build:   安装版部署里请先 npm i -g typescript，或设 DSH_CHECKOUT 用 checkout 自带的 tsc" >&2
  exit 1
fi

# link_pkg <node_modules 内的相对路径> <A 模式相对 checkout 的路径> <B 模式相对 nm 的路径>
link_pkg() {
  local rel="$1" relA="$2" relB="$3"
  local src
  if [ "$MODE" = "checkout" ]; then src="$CHECKOUT/$relA"; else src="$RUNTIME_NM/$relB"; fi
  if [ ! -e "$src" ]; then
    echo "build: dependency target missing: $src" >&2
    exit 1
  fi
  node -e "
    const fs = require('fs');
    const path = require('path');
    const link = path.resolve(process.argv[1]);
    const target = path.resolve(process.argv[2]);
    fs.rmSync(link, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  " "node_modules/$rel" "$src"
}

# optional_link_pkg：目标缺失只警告，不中断（@types/node 在部分运行时里没有）
optional_link_pkg() {
  local rel="$1" relA="$2" relB="$3"
  local src
  if [ "$MODE" = "checkout" ]; then src="$CHECKOUT/$relA"; else src="$RUNTIME_NM/$relB"; fi
  if [ ! -e "$src" ]; then
    echo "build: optional dependency missing, skipped: $src" >&2
    return 0
  fi
  link_pkg "$rel" "$relA" "$relB"
}

echo "=== Linking build dependencies (MODE=$MODE, source=${CHECKOUT:-$RUNTIME_NM}) ==="
mkdir -p node_modules/@deepseek-ai
node -e "const fs=require('fs');fs.rmSync('node_modules/@standard-schema',{recursive:true,force:true})"
link_pkg @deepseek-ai/cordis                 vendor/cordis               @deepseek-ai/cordis
link_pkg @deepseek-ai/cosmokit               vendor/cosmokit             @deepseek-ai/cosmokit
link_pkg @deepseek-ai/schemastery            vendor/schemastery          @deepseek-ai/schemastery
link_pkg @deepseek-ai/dsh-tools              packages/core/tools         @deepseek-ai/dsh-tools
link_pkg @deepseek-ai/dsh-system-prompt      packages/core/system-prompt @deepseek-ai/dsh-system-prompt
link_pkg @deepseek-ai/cordis-plugin-loader   vendor/loader               @deepseek-ai/cordis-plugin-loader
optional_link_pkg @types/node                node_modules/@types/node     @types/node

if [ "$MODE" = "checkout" ]; then
  STD_SCHEMA="$(find "$CHECKOUT/node_modules/.pnpm" -maxdepth 1 -type d -iname '@standard-schema+spec@*' 2>/dev/null | head -1 || true)"
  [ -n "$STD_SCHEMA" ] && STD_SCHEMA="$STD_SCHEMA/node_modules/@standard-schema/spec"
else
  STD_SCHEMA="$RUNTIME_NM/@standard-schema/spec"
  [ -e "$STD_SCHEMA" ] || STD_SCHEMA=""
fi
if [ -n "${STD_SCHEMA:-}" ] && [ -e "$STD_SCHEMA" ]; then
  node -e "
    const fs = require('fs');
    const path = require('path');
    fs.rmSync('node_modules/@standard-schema', { recursive: true, force: true });
    fs.mkdirSync('node_modules/@standard-schema', { recursive: true });
    fs.symlinkSync(path.resolve(process.argv[1]), path.resolve('node_modules/@standard-schema/spec'), process.platform === 'win32' ? 'junction' : 'dir');
  " "$STD_SCHEMA"
else
  echo "build: @standard-schema/spec not found; skipLibCheck should cover it" >&2
fi

echo "=== Compiling src → lib (tsc $("$TSC" --version)) ==="
"$TSC" -p tsconfig.json

echo "=== Build complete ==="
ls -la lib/ lib/types/ 2>/dev/null
