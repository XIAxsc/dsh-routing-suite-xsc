#!/usr/bin/env bash
# dsh-routing-suite 一键安装（Linux/macOS；镜像 install.ps1）：装配注入器 + 安装预设 + 自检。
# 注入器装配：优先源码构建（npm prepare），失败自动回退官方 Release tgz（SUPER_INJECTOR_VERSION 覆盖版本，默认 0.3.3）。
#
# ⚠️ DSH 0.2.x 适配（v0.3.4）：
#   1) 目标 profile 不再硬编码叫 web —— 由 DSH_PROFILE_DIR / DSH_PROFILE 决定（本机是 desktop）。
#   2) router preset 不再装成 $DSH_HOME/.agent-presets/<id>/ 目录（DSH 0.2.x 已无人读取，
#      见 dsh-agent-preset/skills/editing-cordis-compositions/SKILL.md:70），改为生成一个
#      本地 bundle（package.json + cordis.patch.yml，内含 @deepseek-ai/dsh-agent-preset 声明行）
#      再走官方 dsh plugin add 装配。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# DSH_HOME 优先：部署环境 homedir 可能与 DSH_HOME 不一致，不能只靠 $HOME
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
INJECTOR_DIR="$ROOT/injector"
PRESET_NAMES=("router-standard" "router-spec")
# 旧形态目录（仅用于残留提示；DSH 0.2.x 不读取它）
LEGACY_PRESETS_DIR="$DSH_HOME/.agent-presets"

# 输出着色（非终端自动禁用）
if [ -t 1 ]; then
  C_CYAN=$'\e[36m'; C_GREEN=$'\e[32m'; C_YELLOW=$'\e[33m'; C_RED=$'\e[31m'; C_RESET=$'\e[0m'
else
  C_CYAN=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_RESET=''
fi

info() { printf '%s=== %s ===%s\n' "$C_CYAN" "$1" "$C_RESET"; }
ok()   { printf '%s✓ %s%s\n'  "$C_GREEN" "$1" "$C_RESET"; }
warn() { printf '%s! %s%s\n'  "$C_YELLOW" "$1" "$C_RESET"; }
err()  { printf '%s✗ %s%s\n'  "$C_RED" "$1" "$C_RESET"; }

# ── 目标 profile 解析（DSH 0.2.x）─────────────────────────────
# 顺序：DSH_PROFILE_DIR > DSH_PROFILE > $DSH_HOME/profiles 下的第一个目录 > web
PROFILE_NAME=""
if [ -n "${DSH_PROFILE_DIR:-}" ]; then
  PROFILE_NAME="$(basename "$DSH_PROFILE_DIR")"
elif [ -n "${DSH_PROFILE:-}" ]; then
  PROFILE_NAME="$DSH_PROFILE"
elif [ -d "$DSH_HOME/profiles" ]; then
  _profiles="$(ls -1 "$DSH_HOME/profiles" 2>/dev/null | grep -v '^\.' || true)"
  PROFILE_NAME="$(printf '%s\n' "$_profiles" | head -1)"
  _count="$(printf '%s\n' "$_profiles" | grep -c . || true)"
  if [ "${_count:-0}" -gt 1 ]; then
    warn "发现多个 profile（$(printf '%s' "$_profiles" | tr '\n' ' ')）——默认用 $PROFILE_NAME，可用 DSH_PROFILE 指定"
  fi
fi
[ -n "$PROFILE_NAME" ] || PROFILE_NAME=web
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE_NAME"

info '[0/4] 环境预检'
if ! command -v node >/dev/null 2>&1; then
  err '未找到 node（构建注入器 lib/ 与生成 preset bundle 需要 Node.js，请先安装或加载 nvm）'
fi
if ! command -v dsh >/dev/null 2>&1; then
  warn 'dsh 不在 PATH——装配时将回退到 npx @deepseek-ai/dsh'
fi
echo "仓库目录 : $ROOT"
echo "DSH_HOME  : $DSH_HOME"
echo "profile   : $PROFILE_NAME ($PROFILE_DIR)"

info '[1/4] 装配注入器'

# 装配包目录：源码构建成功 = 仓库内 injector/；否则 = Release tgz 解压目录
PKG_DIR="$INJECTOR_DIR"

if [ ! -f "$PKG_DIR/lib/index.js" ]; then
  warn 'injector/lib 缺失——尝试 npm install 触发 prepare 钩子构建（首次需网络拉取 tsdown）...'
  ( cd "$INJECTOR_DIR" && npm install --no-audit --no-fund ) || warn 'npm install 失败（可忽略）'
  if [ -f "$INJECTOR_DIR/lib/index.js" ]; then
    ok 'injector/lib 构建完成'
  else
    # 源码构建依赖私有 @deepseek-ai peer 包（package-lock 锁定），公共 npm registry 404 → 回退官方 Release tgz
    SPI_VERSION="${SUPER_INJECTOR_VERSION:-0.3.4}"
    SPI_DIST_DIR="$DSH_HOME/external/dsh-super-injector"
    SPI_TGZ="https://github.com/XIAxsc/dsh-routing-suite-xsc/releases/download/v${SPI_VERSION}/dsh-external-dsh-super-injector-${SPI_VERSION}.tgz"
    if [ ! -f "$SPI_DIST_DIR/lib/index.js" ]; then
      warn "源码构建不可行——尝试下载本仓库预构建 Release v${SPI_VERSION}（本 fork 的 Release 若未附带 tgz 资产，会走到下面的源码构建指引）..."
      warn "  $SPI_TGZ"
      mkdir -p "$SPI_DIST_DIR"
      if curl -fL --retry 2 -m 120 "$SPI_TGZ" | tar -xzf - -C "$SPI_DIST_DIR" --strip-components=1; then
        if [ -f "$SPI_DIST_DIR/lib/index.js" ]; then
          ok "Release 包就位：$SPI_DIST_DIR"
        else
          err "Release 包解压后缺少 lib/index.js——包内容异常，请到 https://github.com/XIAxsc/dsh-routing-suite-xsc/releases 核对"
        fi
      else
        err "Release 下载/解压失败（$SPI_TGZ）——请手动下载 tgz 后重跑本脚本，或改用："
        warn "  B. github: 装配（prepare 钩子自动构建）：dsh plugin --profile $PROFILE_NAME add github:XIAxsc/dsh-routing-suite-xsc"
        warn "  C. 有 DSH 源码 checkout 时：DSH_CHECKOUT=<checkout> bash injector/scripts/build.sh 后再重跑本脚本"
        warn "     没有 checkout（安装版部署）时：DSH_RUNTIME_NODE_MODULES=<已安装 runtime 的 node_modules> bash injector/scripts/build.sh"
      fi
    else
      ok "检测到已就位的 Release 包：$SPI_DIST_DIR"
    fi
    if [ -f "$SPI_DIST_DIR/lib/index.js" ]; then
      PKG_DIR="$SPI_DIST_DIR"
    fi
  fi
fi

PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
manual_fallback=0
if [ -f "$PATCH_FILE" ] && grep -q 'dsh-super-injector' "$PATCH_FILE"; then
  warn 'cordis.patch.yml 已含 dsh-super-injector——跳过装配（防 duplicate loader entry id）'
elif [ -f "$PKG_DIR/lib/index.js" ]; then
  if command -v dsh >/dev/null 2>&1; then
    dsh plugin --profile "$PROFILE_NAME" add "$PKG_DIR" \
      || { err 'dsh plugin add 失败（见上方输出）——可改用手动装配（见下）'; manual_fallback=1; }
  else
    warn 'dsh 不在 PATH——改用 npx @deepseek-ai/dsh 装配'
    npx '@deepseek-ai/dsh' plugin --profile "$PROFILE_NAME" add "$PKG_DIR" \
      || { err 'npx 装配失败（见上方输出）——可改用手动装配（见下）'; manual_fallback=1; }
  fi
  if [ "$manual_fallback" -eq 0 ]; then
    ok '注入器已装配（重启后由 bundles 接管）'
  else
    warn '手动装配回退（免 pnpm，与官方装配二选一）：'
    warn "  1) mkdir -p '$PROFILE_DIR/node_modules/@dsh-external'"
    warn "  2) ln -sfn '$PKG_DIR' '$PROFILE_DIR/node_modules/@dsh-external/dsh-super-injector'"
    warn "  3) 在 '$PATCH_FILE' 的顶层数组里追加："
    warn '     - insert:'
    warn '         - id: dsh-super-injector'
    warn "           name: '@dsh-external/dsh-super-injector'"
    warn '           config: {}'
    warn '  4) 重启 DSH'
  fi
else
  warn '未获得可装配的注入器包（lib 缺失）——请按上方提示处理后再重跑本脚本'
fi

info '[2/4] 安装 router presets（DSH 0.2.x 声明式 bundle）'
# 旧形态（$DSH_HOME/.agent-presets/<id>/{preset.yml,agent.cordis.yml}）在 DSH 0.2.x 已无人读取，
# 改为生成 bundle：package.json（dsh.bundle.patch）+ cordis.patch.yml（@deepseek-ai/dsh-agent-preset 声明行）。
PRESET_BUNDLE_DIR="$DSH_HOME/external/dsh-router-presets"
if node "$ROOT/scripts/gen-preset-bundle.mjs" "$ROOT" "$PRESET_BUNDLE_DIR" "${PRESET_NAMES[@]}"; then
  ok "preset bundle 已生成：$PRESET_BUNDLE_DIR"
else
  err 'preset bundle 生成失败——请检查 preset/<id>/preset.yml 与 agent.cordis.yml 是否齐备'
fi
if [ -f "$PRESET_BUNDLE_DIR/cordis.patch.yml" ]; then
  if command -v dsh >/dev/null 2>&1; then
    dsh plugin --profile "$PROFILE_NAME" add "$PRESET_BUNDLE_DIR" \
      || warn 'preset bundle 装配失败——可手动把该目录加进 profile package.json 的 dsh.profile.bundles'
  else
    npx '@deepseek-ai/dsh' plugin --profile "$PROFILE_NAME" add "$PRESET_BUNDLE_DIR" \
      || warn 'preset bundle 装配失败——可手动把该目录加进 profile package.json 的 dsh.profile.bundles'
  fi
fi
if [ -d "$LEGACY_PRESETS_DIR" ]; then
  warn "检测到旧形态目录 $LEGACY_PRESETS_DIR —— DSH 0.2.x 已不读取它；确认新形态可用后可自行删除"
fi

info '[3/4] 自检 preset 声明'
failed=0
for name in "${PRESET_NAMES[@]}"; do
  if grep -q "id: preset-$name" "$PRESET_BUNDLE_DIR/cordis.patch.yml" 2>/dev/null; then
    ok "$name -> 声明行就位（preset-$name）"
  else
    err "$name 缺少声明行（$PRESET_BUNDLE_DIR/cordis.patch.yml）"
    failed=1
  fi
done
if [ "$failed" -ne 0 ]; then
  err 'preset 声明自检失败——preset 不会被 DSH 发现'
fi

info '[4/4] 完成'
echo "1. 重启 DSH（profile: $PROFILE_NAME）"
echo '2. GUI 新建会话 → 选择 Router Standard / Router Spec (experimental)'
echo '3. 发任务：生成任务自动 react，维护任务自动 spec，模糊任务进 weak 内路由'
echo '4. AI 自优化工具：dev_router_status / dev_router_mode / dev_mode_subagent'
