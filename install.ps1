# dsh-routing-suite 一键安装（Windows PowerShell）
# 步骤：1) 装配注入器  2) 安装 router-standard / router-spec 预设  3) 提示重启
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── profile 解析（DSH 0.2.x：profile 名不再固定为 web）─────────────────────
# 优先级：DSH_PROFILE_DIR（其父目录即 profiles 根） > DSH_PROFILE > profiles/<唯一目录> > web
$profilesRoot = if ($env:DSH_HOME) { Join-Path $env:DSH_HOME 'profiles' } else { Join-Path $env:USERPROFILE '.dsh\profiles' }
$profileName = $env:DSH_PROFILE
if ($env:DSH_PROFILE_DIR) {
  $profileName = Split-Path -Leaf $env:DSH_PROFILE_DIR
  $profilesRoot = Split-Path -Parent $env:DSH_PROFILE_DIR
}
if (-not $profileName -and (Test-Path $profilesRoot)) {
  $found = @(Get-ChildItem -Path $profilesRoot -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike '.*' })
  if ($found.Count -eq 1) { $profileName = $found[0].Name }
}
if (-not $profileName) { $profileName = 'web' }
Write-Host "profile = $profileName  (profiles 根: $profilesRoot)" -ForegroundColor DarkGray

Write-Host '=== [1/3] 装配注入器 ===' -ForegroundColor Cyan
$injector = Join-Path $root 'injector'
if (-not (Test-Path (Join-Path $injector 'lib\index.js'))) {
  # 全新 clone 没有 lib/（构建产物不入库）。github: 装配（方式 B）会在安装时由
  # prepare 钩子自动构建；本地目录装配若构建不可行，请改用 Release tgz（方式 A）。
  Write-Host 'injector/lib 缺失——尝试 npm install 触发 prepare 钩子构建（若私有 peer 拉取失败会自动跳过）...' -ForegroundColor Yellow
  Push-Location $injector
  try {
    & npm install --no-audit --no-fund 2>&1 | Out-Host
  } catch {
    Write-Host 'npm install 失败（可忽略）' -ForegroundColor DarkGray
  } finally {
    Pop-Location
  }
  if (-not (Test-Path (Join-Path $injector 'lib\index.js'))) {
    Write-Host '自动构建不可行——注入器请改用以下方式装配：' -ForegroundColor Yellow
    Write-Host '  A. Release tgz（预构建，推荐）：https://github.com/yjh051108/dsh-super-injector/releases' -ForegroundColor Yellow
    Write-Host "  B. github: 装配（prepare 钩子自动构建）：dsh plugin --profile $profileName add github:yjh051108/dsh-super-injector" -ForegroundColor Yellow
    Write-Host '  （构建需要依赖来源：源码 checkout 用 DSH_CHECKOUT，安装版用 DSH_RUNTIME_NODE_MODULES）' -ForegroundColor DarkGray
  } else {
    Write-Host 'injector/lib 构建完成' -ForegroundColor Green
  }
}
if (Test-Path (Join-Path $injector 'lib\index.js')) {
  # dsh CLI 可能不在 PATH（用 npx @deepseek-ai/dsh web 启动的场景）；优先 dsh，fallback 到 npx
  $dshCmd = Get-Command dsh -ErrorAction SilentlyContinue
  if ($dshCmd) {
    & dsh plugin --profile $profileName add $injector 2>&1 | Out-Host
  } else {
    & npx '@deepseek-ai/dsh' plugin --profile $profileName add $injector 2>&1 | Out-Host
  }
  Write-Host '注入器已装配（重启后由 bundles 接管）' -ForegroundColor Green
}

Write-Host '=== [2/3] 安装 router presets ===' -ForegroundColor Cyan
# DSH 0.2.x：preset 是 @deepseek-ai/dsh-agent-preset 的普通声明行，由 bundle patch 承载。
# 旧形态 $DSH_HOME/.agent-presets/<id>/ 目录已无人读取（SKILL.md:70），这里改为生成一个
# 声明式 bundle 再 dsh plugin add。preset/<id>/ 仍是唯一真源——生成器只做原样内联。
$presetRoot = Join-Path $root 'preset'
$presets = @('router-standard', 'router-spec')
$bundleDir = Join-Path $env:USERPROFILE '.dsh\external\dsh-router-presets'
& node (Join-Path $root 'scripts\gen-preset-bundle.mjs') $root $bundleDir $presets 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
  Write-Host 'preset bundle 生成失败' -ForegroundColor Red
  exit 1
}
$dshCmd2 = Get-Command dsh -ErrorAction SilentlyContinue
if ($dshCmd2) {
  & dsh plugin --profile $profileName add $bundleDir 2>&1 | Out-Host
} else {
  & npx '@deepseek-ai/dsh' plugin --profile $profileName add $bundleDir 2>&1 | Out-Host
}

# 自检：生成的 patch 里必须能按 Loader 行 id（preset-<目录名>）找到每个 preset 的声明行
Write-Host '=== 自检 preset 声明 ===' -ForegroundColor Cyan
$patchPath = Join-Path $bundleDir 'cordis.patch.yml'
if (-not (Test-Path $patchPath)) {
  Write-Host "FAIL: 未生成 $patchPath" -ForegroundColor Red
} else {
  foreach ($name in $presets) {
    if (Select-String -Path $patchPath -Pattern ("id: preset-" + $name) -Quiet) {
      Write-Host "OK: $name -> 声明行 preset-$name 就位" -ForegroundColor Green
    } else {
      Write-Host "FAIL: $name 缺少声明行 preset-$name（$patchPath）——预设不会被 DSH 发现" -ForegroundColor Red
    }
  }
}
if (Test-Path (Join-Path $env:USERPROFILE '.dsh\.agent-presets')) {
  Write-Host '提示：检测到旧形态 ~/.dsh/.agent-presets 残留目录——DSH 0.2.x 不再读取它，可安全删除' -ForegroundColor Yellow
}

Write-Host '=== [3/3] 完成 ===' -ForegroundColor Cyan
Write-Host '1. 重启 DSH（web 服务）' -ForegroundColor Yellow
Write-Host '2. GUI 新建会话 → 选择 Router Standard / Router Spec (experimental)' -ForegroundColor Yellow
Write-Host '3. 发任务：生成任务自动 react，维护任务自动 spec，模糊任务进 weak 内路由' -ForegroundColor Yellow
Write-Host '4. AI 自优化工具：dev_router_status / dev_router_mode / dev_mode_subagent' -ForegroundColor Yellow
