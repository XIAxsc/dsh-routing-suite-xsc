# dsh-routing-suite — Injector × Reasoning-Mode Routing × Graded Mode Suite

One repository for the full stack: the **runtime injector** (restart-free plugin
management) plus the **reasoning-mode routing presets** (task-aware reasoning-mode
routing, measured P1-P23) plus the **graded task protocol** (brainstorm quiz →
speced plan → check-in → group close-out → final check, with redteam gate & audit endpoint).

[中文](README.md) | English

## Research & Data (graded)

**"Models slack off too — we measured it, and built defenses."** — public research slot for the graded plugin:
- [🔬 Model Attention Slack: Observation Notes](graded/docs/STUDY.md) — real segment-level data of verification-effort decay in long tasks (no-protocol chain: late-stage "1 tool / 0 image checks" vs protocol chain fully on-line) + defense mapping
- [📊 Protocol vs No-Protocol: Measured Comparison](graded/docs/COMPARE.md) — 3-session comparison table + ASCII charts (same-type 3D tasks)
- [🧪 Measurement tool](graded/scripts/measure.mjs) — `node scripts/measure.mjs your-session.jsonl`: recompute the same metrics on your own sessions (sanitized: numbers only)
- [📁 Raw data](graded/docs/DATA.md) — sanitized per-session metric tables + decay profile + audit metrics

## Component entry points

| Component | Description | Entry |
|---|---|---|
| **injector** | Runtime injector: `dev_*` tool family (inject / hot-reload / uninject / staging / route self-heal) | [injector/README.md](injector/README.md) · [SPEC](injector/docs/SPEC.md) |
| **preset** | Reasoning-mode routing presets (router-standard / router-spec, persona-based routing) | [preset/README.md](preset/README.md) · [experiments](preset/docs/experiments.md) |
| **graded** | Graded mode: session-level two-level task protocol (6 tools + 3 modes + per-item mode + redteam gate + audit endpoint + super panel) | [graded/README.md](graded/README.md) · [ARCHITECTURE](graded/docs/ARCHITECTURE.md) · [THEORY](graded/docs/THEORY.md) · [DATA](graded/docs/DATA.md) |

## DSH compatibility matrix

| DSH version | Status | Suite version | Verification | Notes |
|---|---|---|---|---|
| **`0.2.0-rc.2`** | ✅ **verified compatible** | injector **v0.3.4** · preset v0.3.0 · graded 0.0.1-rc1 | S4 six-layer isolated verification all green: kernel contracts **57/57** · in-process assembly **26/26 × 3 targets** · client smoke **18/18** · preset migration **18/18** | The target of this adaptation. Runtime: `cordis` 4.0.4 / `cordis-plugin-loader` 1.0.5 / `schemastery` 3.18.4 / Node v24 (ModuleLoader v2) |
| `0.1.x` (rc.6 – 0.1.2-alpha.1) | ✅ previously supported | v0.3.0 – v0.3.3 | historically tested | `Entry._dispose` and friends still existed on 0.1.x; removed in 0.2.x |
| `<0.1.0-rc.6` | ❌ unsupported | — | — | below the first adaptation baseline |
| `>=0.3.0` | ⚠️ **unverified** | — | — | untested; the contract surface may change again after 0.2.x |

### Critical contract dependencies (breaking any one of them requires re-adaptation)

| Contract | Authoritative location | How the suite uses it |
|---|---|---|
| `FiberState` is a `const enum` (0..5, names unreadable at runtime) | `cordis/src/fiber.ts:147-154` | the plugin hard-codes a `FIBER_NAMES` array — the only workable approach |
| **`Entry` has no `_dispose`** (since 0.2.x) | `cordis-plugin-loader/src/config/entry.ts` | must use the official `entry.fiber.dispose()` (`entry.ts:135` / `group.ts:40`) |
| `RegistryService.delete(plugin)` takes a **plugin**, not a fiber | `cordis/src/registry.ts:258-267` | passing a fiber resolves to undefined → silent no-op |
| `EntryTree.entries()/create()/import()`, `Loader.unwrapExports()`, `Loader.internal.loadCache` | `cordis-plugin-loader/src/{index,config/tree,internal}.ts` | the injector's hot-reload and self-heal paths |
| `defineTool` + `ToolRegistry.register` require `output { schema, render }` | `dsh-tools/lib/index.js:838-864, 2878-2889` | the 19 `dev_*` tools |
| `webServer.register()` returns a disposer; `kind: 'exact' \| 'prefix'` | `dsh-host-webserver/lib/index.js:177-184` | route `/super-injector/api` registered in `ctx.effect` |
| `ctx.slots.register(options, component)` is the **two-argument** form | `dsh-client-ui-slots/lib/index.js:163-219` | plugin-manager UI registered into `settings.section` (`options.component` is never read) |
| `window.__ModuleLoader__.load({ id, factory })` | official `dsh-cordis-client-runner` template | the client bundle banner |
| `dsh.client` is consumed by `dsh-client-modules`; the module graph is built from **`external` only** | `dsh-client-modules/lib/index.js:415-437` | `dsh-client-runtime` in `inject` is an inert legacy declaration (identical to the installed `dsh-prompt`) |
| a preset is an **`@deepseek-ai/dsh-agent-preset` declaration row** carried by a bundle patch | `editing-cordis-compositions/SKILL.md:8` | the old `.agent-presets/` form is no longer read (`SKILL.md:70`) |

> Re-verify without installing or writing any DSH profile: `node scripts/verify-contract.mjs`
> (requires the installed runtime on the spot and asserts each contract above).

## Install chain (three steps)

```powershell
# 1. Clone the suite (single repo: injector/preset content is stored directly, no submodules)
git clone https://github.com/yjh051108/dsh-routing-suite.git
cd dsh-routing-suite

# 2. One-shot install (injector assembly + preset copy + layout self-check + restart prompt)
.\install.ps1
```

Or manually:

```powershell
# Step 1: assemble the injector (official assembly; bundles take over after restart)
dsh plugin --profile <profile> add .\injector
# If dsh is not on PATH (npx @deepseek-ai/dsh web): npx '@deepseek-ai/dsh' plugin --profile <profile> add .\injector

# Step 2: install the router presets (DSH 0.2.x: a preset is an ordinary
# @deepseek-ai/dsh-agent-preset declaration row carried by a bundle patch.
# The old $DSH_HOME/.agent-presets/<id>/ directory is no longer read.)
$bundle = Join-Path $env:USERPROFILE '.dsh\external\dsh-router-presets'
node .\scripts\gen-preset-bundle.mjs . $bundle router-standard router-spec
dsh plugin --profile <profile> add $bundle

# Step 3: restart DSH → pick Router Standard / Router Spec in a new session
```

> `preset/<id>/` stays the single source of truth; the generator inlines
> `preset.yml` (name/description/order) and the `agent.cordis.yml` entry list
> verbatim into declaration rows. Do not hand-edit the generated output, and do
> not copy directories into `.agent-presets/` any more.

## Components

| Path | Repo | Version | Role |
|---|---|---|---|
| `injector/` | [dsh-super-injector](https://github.com/yjh051108/dsh-super-injector) | [v0.3.3](https://github.com/yjh051108/dsh-super-injector/releases/tag/v0.3.3) → **v0.3.4 (unreleased, DSH 0.2.x adaptation)** | Runtime injector: dev_* tool family (inject / hot-reload / staging-promote / uninject / route self-heal); git installs build automatically (prepare hook) |
| `preset/` | [dsh-router-standard](https://github.com/yjh051108/dsh-router-standard) | [v0.3.0 … mainline v1.19.1/v34](https://github.com/yjh051108/dsh-router-standard/releases/tag/v0.3.0) | Reasoning-mode routing presets: router-standard (classified persona + full sections) / router-spec (deep-think-first). router-pro is planned but NOT part of v0.3.0 |
| `graded/` | [dsh-graded-mode](https://github.com/yjh051108/dsh-routing-suite/tree/main/graded) | [v0.0.1-rc1](https://github.com/yjh051108/dsh-routing-suite/releases/tag/v0.0.1-rc1) | Graded mode: session-level two-level task protocol (brainstorm quiz alignment → North-Star finalization → speced plan → spec-driven injection → check-in → group close-out → final check); 6 tools + 3 modes + per-item mode + redteam gate + audit endpoint; `graded/dsh-external-dsh-graded-mode-0.0.1-rc1.tgz` is a direct `dsh plugin --profile <profile> add` target |

> Versions follow each component repo's git tag (links go to the matching Release).

The three components now evolve together with this repository (`injector/`,
`preset/` and `graded/` are ordinary directories whose contents are committed directly); the
standalone upstream repos `dsh-super-injector` / `dsh-router-standard` stay for
independent releases and may later become mirrors/archives. The preset install
directory is `preset/router-standard` (flat, no extra nesting).

## router-standard preset capabilities (P1–P23 measured summary)

- **Three behavior bands + weak internal routing**: spec (plan-collective) / react (doer) / mixed (trap, avoided) / weak (model self-classifies)
- **Model-matched persona**: Pro = spec sentence + few-shot (discrimination +5.0); Flash = neutral + classify (+5.7)
- **Near-field guidance**: fixed guidance after every real user message (cache 92–94% hit), routing 96% + convergence 100% + anti-dilution
- **Single-task three anchors** (persona-static): recall + converge + anti-runaway — open-task completion 0% → 100%
- **plan-mode preserved**: only the persona section is replaced; plan boundaries never lose focus
- **AI self-optimization tools**: `dev_router_status` / `dev_router_mode` / `dev_mode_subagent`

## v0.3.0 changes (real-assembly-chain fixes)

- **First-turn routing actually works** ([#13](https://github.com/yjh051108/dsh-routing-suite/issues/13)): the first real user message is captured via `agent/inbox/claimed` BEFORE assembly, so the first request is classified (previously every session's first request was unconditionally weak)
- **Near-field guidance moved to `agent/pre-step`** ([#34](https://github.com/yjh051108/dsh-routing-suite/issues/34)/[#36](https://github.com/yjh051108/dsh-routing-suite/issues/36)/[#55](https://github.com/yjh051108/dsh-routing-suite/issues/55)): the guide now rides the SAME request as the user message — reachable on the real chain, and it no longer manufactures a second API call per user message (the 2× cost spike)
- **Missing imports** ([#11](https://github.com/yjh051108/dsh-routing-suite/issues/11)), preset.yml YAML quoting ([#53](https://github.com/yjh051108/dsh-routing-suite/issues/53)), full sections after promotion ([#44](https://github.com/yjh051108/dsh-routing-suite/issues/44)), install script & docs fixes ([#35](https://github.com/yjh051108/dsh-routing-suite/issues/35)/[#42](https://github.com/yjh051108/dsh-routing-suite/issues/42)/[#41](https://github.com/yjh051108/dsh-routing-suite/issues/41)), injector git-install auto-build ([#40](https://github.com/yjh051108/dsh-routing-suite/issues/40))

## Docs

- Injector guide (10 rules): `injector/README.md`
- Routing preset paper & experiments: `preset/docs/paper.md` + `preset/docs/experiments.md` (P1–P23)

## License

MIT. Credits: xiaobright/modeltest (V4.1b evaluation), xiaobright/dsh-anchored-standard (anchoring mechanism).
