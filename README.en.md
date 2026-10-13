# dsh-routing-suite-xsc — DSH 0.2.x adaptation (Injector × Reasoning-Mode Routing × Graded Mode)

[中文](README.md) | English

> **This repository is a fork of [`yjh051108/dsh-routing-suite`](https://github.com/yjh051108/dsh-routing-suite).**
> The upstream project last adapted to DSH `0.1.x` (it declares `DSH Target >=0.1.0-rc.6 <0.2.0`) and never
> followed the 0.2.x breaking changes — installing upstream as-is on the current DSH (`0.2.0-rc.2`)
> **fails to assemble**. This fork completes the 0.2.x adaptation: it fixes **2 hard breaks + 5 contract drifts**,
> migrates presets to declarative bundles, and adds a dual-mode build chain. Every judgement, code citation and
> verification result is archived under **[docs/compat/](docs/compat/)**.

| Item | Value |
|---|---|
| Adaptation target | DSH **`0.2.0-rc.2`** (`cordis` 4.0.4 · `cordis-plugin-loader` 1.0.5 · `schemastery` 3.18.4 · Node v24 / ModuleLoader v2) |
| Branch / tag | `fix/adapt-dsh-0.2.0-rc2` · **`v0.3.4`** |
| Component versions | injector **v0.3.4** · preset v0.3.0 · graded 0.0.1-rc1 |
| Verification | kernel contracts **57/57** · in-process assembly **26/26 × 3 targets** · client smoke **18/18** · preset bundle **26/26** · **real install on a live `web` profile** (HTTP 200) |
| License | MIT (inherited from upstream) |

---

## What this fork changes relative to upstream

### ① Two hard breaks — upstream throws or silently fails on 0.2.x

| # | Symptom | Root cause (runtime-side evidence) | Fix in this fork |
|---|---|---|---|
| **HARD-1** | the self-heal / reboot path always throws `selfEntry 无官方 _dispose（loader 契约缺失）` | `Entry` in `cordis-plugin-loader@1.0.5` **has no `_dispose`**: a package-wide grep (`src` + `lib`) returns zero hits, and `export class Entry {` extends no base class | use the official equivalent `entry.fiber.dispose()` — upstream itself does exactly that at `src/config/entry.ts:135` and `src/config/group.ts:40`; then `entry.fiber = undefined` |
| **HARD-2** | `ctx.registry.delete(fiber)` is a **silent no-op**; the old fiber is never released | `RegistryService.delete()` takes a **plugin, not a fiber**; passing a fiber makes `resolve()` return `undefined` (`cordis/src/registry.ts:258-267`). Measured: `registry.size` 7 → 7 | call `registry.delete(fiber.runtime.callback)` |

### ② Five contract / configuration drifts

1. **Hard-coded profile** — `~/.dsh/profiles/web/node_modules` baked the profile name as `web` (real profiles
   are often `desktop`). Now resolved in three steps: `DSH_PROFILE_DIR` → `$DSH_HOME/profiles/$DSH_PROFILE` → `web`.
2. **Dead slot name** — `settings.plugin.item` (**singular**) in both the scaffold self-check allow-list and the
   live-validation allow-list has **zero hits** in `0.2.0-rc.2`; the real slot is the **plural** `settings.plugins.tab`.
   Keeping it makes the self-check **wave through** scaffolds that register into a removed slot → removed in both places.
3. **Client registration form** — the scaffold template used the retired **one-argument**
   `ctx.slots.register({ …, component })`. The official `register(options, component)` only reads its second
   argument; `options.component` is **never read**, so the result is a blank panel with no error → switched to the
   official **two-argument** form.
4. **Bare dependency names** — `cordis` / `schemastery` → scoped `@deepseek-ai/cordis` / `@deepseek-ai/schemastery`.
   The 0.2.0-rc.2 browser module table (9 entries) likewise contains no bare `cordis`.
5. **Build chain** — the scaffold `build.sh` only accepted a source checkout (it required `$DSH_CHECKOUT/packages`),
   so it **always `exit 1`** on an installed deployment → now **dual-mode**: A) source checkout;
   B) the `node_modules` of the installed runtime (`DSH_RUNTIME_NODE_MODULES`, or auto-detected from
   `$DSH_HOME/profiles/*/node_modules`). Added `detectRuntimeNodeModules()` / `detectBuildSource()`.

### ③ Preset migration: directory form → declarative bundle

Since DSH 0.2.x a preset is an `@deepseek-ai/dsh-agent-preset` **declaration row** carried by a bundle patch;
the old `$DSH_HOME/.agent-presets/<id>/` directory form **is no longer read**
(official migration note, `editing-cordis-compositions/SKILL.md:70`: *“Nothing reads that directory any more.”*).

- New **`scripts/gen-preset-bundle.mjs`**: turns `preset/<id>/` (the single source of truth) into
  `cordis.patch.yml` + `package.json`, inlining `preset.yml` (`name/description/order`) and the
  `agent.cordis.yml` entry list **verbatim** (no YAML rewriting — semantically identical).
- **The generated bundle carries its anchor `.mjs` assets.** `name: ./router-bootstrap-vNN.mjs` inside
  `agent.cordis.yml` is a relative reference, and in the patch dialect the anchor of a relative path is the
  **directory of the patch file that carries it** (`cordis-plugin-include/src/index.ts:188`).
  Without shipping `router-bootstrap-vNN.mjs` and its `./router-core-vNN.mjs` dependencies alongside,
  the preset **fails to resolve at mount time**. The generator collects them via `localRefs()` + `localClosure()`,
  flattens them into outDir, and asserts that every `./x.mjs` lands there.
- Fixed a **dependency package that no longer exists**: `@deepseek-ai/dsh-workflow-worker-thread` is absent from the
  whole runtime tree → replaced with `@deepseek-ai/dsh-workflow-ptc` (its
  `static Config = z.object({ provider: … default "spawn" })` matches the `config: { provider: spawn }` in the preset
  rows character-for-character; 6 replacements across three presets).
- New **`scripts/verify-preset-bundle.mjs`**: **26** assertions, including “the generated output is JSON-identical to
  the YAML parse of the source `agent.cordis.yml`” and “anchor assets present and dependency-closed”.

### ④ graded and docs / script clean-up

- Deleted the dead manifest **`graded/dsh.plugin.json`** — the `dsh.plugin.json` / `contributes.commands` form has
  **zero consumers** across the whole runtime tree (`grep contributes` returns 66 hits that are all prose/JSDoc).
- `graded/package.json`: non-standard `engines.dsh` → `engines.node`; removed the dangling `types` entry.
- Fixed one genuine type defect, **`TS7006`** (the only unannotated `execute(args)` parameter in `injector/src/index.ts`).
- Removed hard-coded `--profile web` and `~/.dsh/profiles/web` from `README` / `injector/INSTALL.md` /
  `injector/docs/SPEC.md` / `install.sh` / `install.ps1`.
- `injector/docs/SPEC.md` gained a “0.2.x corrections” section at the top giving the official replacement for each
  retired private API (`_dispose`, `_start`, …) — that section wins wherever it conflicts with the body text.

---

## Verification

> Full report: [docs/compat/VERIFICATION.md](docs/compat/VERIFICATION.md) ·
> Judgements and conclusions: [docs/compat/ADAPTATION-REPORT.md](docs/compat/ADAPTATION-REPORT.md)

| Layer | Method | Result |
|---|---|---|
| **V0 kernel contracts** | `node scripts/verify-contract.mjs` — `require`s the **installed runtime** on the spot and asserts each contract | **57 / 57** |
| **V1 in-process real assembly** | `build/s4-harness/assemble.mjs` — real `Context` + real `Loader` / `Timer` / `Tools` / `SystemPrompt` / `WebServer`, going through the official `loader.create`; run against **dist / tsc / src** targets | **26 / 26 × 3** |
| **V2 types & build** | `tsc --noEmit` (only 6 `TS2307` remain, caused by the deployed runtime shipping no `.d.ts`) + a real `tsc --noCheck` build | no code-level errors |
| **V3 preset bundle** | `node scripts/verify-preset-bundle.mjs` | **26 / 26** |
| **V5 client smoke** | `build/s4-harness/client-smoke.mjs` — minimal React stand-in + fake `__ModuleLoader__`; asserts only in-table specifiers are requested, two-argument registration, and `label()` resolution | **18 / 18** |
| **V6 real install** | `dsh plugin --profile web add …` → `dsh --profile web --dump-config` → **actually starting** `dsh web` and probing HTTP | composition tree contains the plugin row and 3 `preset-router-*` rows; `GET /super-injector/api/list` → **200** |

**One important fact**: the deployed runtime **ships no `.d.ts`** — `cordis` / `cordis-plugin-loader` /
`schemastery` only publish `*.d.ts.map` under `lib/types/`, `dsh-tools` only `*.js`, and
`dsh-system-prompt` / `dsh-host-webserver` / `dsh-client-ui-slots` have no types directory at all.
Type-checking against an **installed runtime** is therefore impossible (`tsc -p tsconfig.json` needs a source
checkout). `node scripts/verify-contract.mjs` needs **no installation and writes no DSH profile**, so it can be
re-run at any time.

---

## One-shot install

```powershell
git clone https://github.com/XIAxsc/dsh-routing-suite-xsc.git
cd dsh-routing-suite-xsc
.\install.ps1            # Windows
# Linux / macOS: ./install.sh
```

`install.*` assembles the injector, generates and installs the router preset bundle, self-checks the layout, and
prompts for a restart. You can also install the whole suite over the official `github:` path:

```powershell
dsh plugin --profile <profile> add github:XIAxsc/dsh-routing-suite-xsc
```

### Manual, in three steps

```powershell
# Step 1: assemble the injector (bundles take over after a restart)
dsh plugin --profile <profile> add .\injector
# If dsh is not on PATH: npx '@deepseek-ai/dsh' plugin --profile <profile> add .\injector

# Step 2: generate and install the router preset bundle
# DSH 0.2.x: a preset is an @deepseek-ai/dsh-agent-preset declaration row carried by a bundle patch.
# The old $DSH_HOME/.agent-presets/<id>/ directory is no longer read — do not copy directories any more.
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$bundle  = Join-Path $dshHome 'external\dsh-router-presets'
node .\scripts\gen-preset-bundle.mjs . $bundle router-standard router-spec router-react
dsh plugin --profile <profile> add $bundle

# Step 3: restart DSH → pick Router Standard / Router Spec (experimental) in a new session
```

> - `preset/<id>/` is the **single source of truth**; do not hand-edit generated output and do not copy
>   directories into `.agent-presets/` any more.
> - It is **normal** for `$bundle` to contain `cordis.patch.yml` *and* several `.mjs` files — those `.mjs` files
>   are the anchor assets for the patch's relative references (see ③ above).
> - Building the injector from source needs a dependency source: `DSH_CHECKOUT=<source checkout>` or
>   `DSH_RUNTIME_NODE_MODULES=<installed runtime node_modules>`.

---

## DSH compatibility matrix

| DSH version | Status | Suite version | Verification | Notes |
|---|---|---|---|---|
| **`0.2.0-rc.2`** | ✅ **verified compatible** | injector **v0.3.4** · preset v0.3.0 · graded 0.0.1-rc1 | contracts **57/57** · assembly **26/26 × 3** · client **18/18** · preset bundle **26/26** · **real install on a live `web` profile passed** | the target of this fork's adaptation. Runtime `cordis` 4.0.4 / `cordis-plugin-loader` 1.0.5 / `schemastery` 3.18.4 / Node v24 (ModuleLoader v2) |
| `0.1.x` (rc.6 – 0.1.2-alpha.1) | ✅ supported by upstream | v0.3.0 – v0.3.3 (upstream) | upstream historical testing | `Entry._dispose` and other private APIs still existed on 0.1.x; removed in 0.2.x |
| `<0.1.0-rc.6` | ❌ unsupported | — | — | below the first adaptation baseline |
| `>=0.3.0` | ⚠️ **unverified** | — | — | untested; the contract surface may change again after 0.2.x |

### Critical contract dependencies (breaking any one of them requires re-adaptation)

| Contract | Authoritative location | How the suite uses it |
|---|---|---|
| `FiberState` is a `const enum` (0..5, names unreadable at runtime) | `cordis/src/fiber.ts:147-154` | the plugin hard-codes a `FIBER_NAMES` array — the only workable approach |
| **`Entry` has no `_dispose`** (since 0.2.x) | `cordis-plugin-loader/src/config/entry.ts` | must use the official `entry.fiber.dispose()` (`entry.ts:135` / `group.ts:40`) |
| `RegistryService.delete(plugin)` takes a **plugin**, not a fiber | `cordis/src/registry.ts:258-267` | passing a fiber resolves to `undefined` → silent no-op |
| `EntryTree.entries()/create()/import()`, `Loader.unwrapExports()`, `Loader.internal.loadCache` | `cordis-plugin-loader/src/{index,config/tree,internal}.ts` | the injector's hot-reload and self-heal paths |
| `defineTool` + `ToolRegistry.register` require `output { schema, render }` | `dsh-tools/lib/index.js:838-864, 2878-2889` | the 19 `dev_*` tools |
| `webServer.register()` returns a disposer; `kind: 'exact' \| 'prefix'` | `dsh-host-webserver/lib/index.js:177-184` | route `/super-injector/api` registered in `ctx.effect` |
| `ctx.slots.register(options, component)` is the **two-argument** form | `dsh-client-ui-slots/lib/index.js:163-219` | plugin-manager UI registered into `settings.section` (`options.component` is never read) |
| `window.__ModuleLoader__.load({ id, factory })` | official `dsh-cordis-client-runner` template | the client bundle banner |
| `dsh.client` is consumed by `dsh-client-modules`; the module graph is built from **`external` only** | `dsh-client-modules/lib/index.js:415-437` | `dsh-client-runtime` in `inject` is an inert legacy declaration (identical to the installed `dsh-prompt`, so it is left alone) |
| the anchor of a relative path in a patch is the **directory of the patch file** | `cordis-plugin-include/src/index.ts:188` | a preset bundle must carry its `.mjs` anchor assets (D14) |
| a preset is an **`@deepseek-ai/dsh-agent-preset` declaration row** carried by a bundle patch | `editing-cordis-compositions/SKILL.md:8` | the old `.agent-presets/` form is no longer read (`SKILL.md:70`) |

> Re-verify without installing or writing any DSH profile: `node scripts/verify-contract.mjs`
> (requires the installed runtime on the spot and asserts each contract above).

---

## Components

| Path | Upstream | Version | Role |
|---|---|---|---|
| `injector/` | [dsh-super-injector](https://github.com/yjh051108/dsh-super-injector) | **v0.3.4** (this fork; upstream is v0.3.3) | Runtime injector: the `dev_*` tool family (inject / hot-reload / staging-promote / uninject / route self-heal); `github:` installs build automatically through the `prepare` hook |
| `preset/` | [dsh-router-standard](https://github.com/yjh051108/dsh-router-standard) | v0.3.0 (mainline v34 / v17 / v10) | Reasoning-mode routing presets: router-standard (classified persona + full sections) / router-spec (deep-think-first) / router-react. router-pro is planned |
| `graded/` | this repository's `graded/` directory | v0.0.1-rc1 | Graded mode: session-level two-level task protocol (brainstorm quiz alignment → North-Star finalization → speced plan → spec-driven injection → check-in → group close-out → final check); 6 tools + 3 modes + per-item mode + redteam gate + audit endpoint; `graded/dsh-external-dsh-graded-mode-0.0.1-rc1.tgz` is a direct `dsh plugin --profile <profile> add` target |

| Component | Description | Entry |
|---|---|---|
| **injector** | Runtime injector: the `dev_*` tool family | [injector/README.md](injector/README.md) · [SPEC](injector/docs/SPEC.md) · [INSTALL](injector/INSTALL.md) |
| **preset** | Reasoning-mode routing presets | [preset/README.md](preset/README.md) · [experiments](preset/docs/experiments.md) |
| **graded** | Graded mode | [graded/README.md](graded/README.md) · [ARCHITECTURE](graded/docs/ARCHITECTURE.md) · [THEORY](graded/docs/THEORY.md) · [DATA](graded/docs/DATA.md) |

The three components now evolve together with this repository (`injector/`, `preset/` and `graded/` are ordinary
directories whose contents are committed directly); the standalone upstream repos remain for independent releases.

---

## Research & Data (graded)

**“Models slack off too — we measured it, and built defenses.”** — public research slot for the graded plugin:

- [🔬 Model Attention Slack: Observation Notes](graded/docs/STUDY.md) — real segment-level data of verification-effort decay in long tasks (no-protocol chain: late-stage “1 tool / 0 image checks” vs protocol chain fully on-line) + defense mapping
- [📊 Protocol vs No-Protocol: Measured Comparison](graded/docs/COMPARE.md) — 3-session comparison table + ASCII charts (same-type 3D tasks)
- [🧪 Measurement tool](graded/scripts/measure.mjs) — `node scripts/measure.mjs your-session.jsonl`: recompute the same metrics on your own sessions (sanitized: numbers only)
- [📁 Raw data](graded/docs/DATA.md) — sanitized per-session metric tables + decay profile + audit metrics

---

## router-standard preset capabilities (P1–P23 measured summary)

- **Three behavior bands + weak internal routing**: spec (plan-collective) / react (doer) / mixed (trap, avoided) / weak (model self-classifies)
- **Model-matched persona**: Pro = spec sentence + few-shot (discrimination +5.0); Flash = neutral + classify (+5.7)
- **Near-field guidance**: fixed guidance after every real user message (cache 92–94% hit), routing 96% + convergence 100% + anti-dilution
- **Single-task three anchors** (persona-static): recall + converge + anti-runaway — open-task completion 0% → 100%
- **plan-mode preserved**: only the persona section is replaced; plan boundaries never lose focus
- **AI self-optimization tools**: `dev_router_status` / `dev_router_mode` / `dev_mode_subagent`

---

## Syncing with upstream

```bash
git remote add upstream https://github.com/yjh051108/dsh-routing-suite.git
git fetch upstream
git merge upstream/main        # ⚠️ upstream is NOT adapted to 0.2.x; re-run verification after merging
node scripts/verify-contract.mjs
node scripts/verify-preset-bundle.mjs
```

Upstream's `v0.3.0` changes (real-assembly-chain fixes) still apply; the full list lives in the upstream
[issues](https://github.com/yjh051108/dsh-routing-suite/issues): first-turn routing actually works (#13),
near-field guidance moved to `agent/pre-step` (#34 / #36 / #55, which also removes the extra second API call per
turn), missing imports (#11), `preset.yml` YAML quoting (#53), full sections after promotion (#44),
install script & docs fixes (#35 / #42 / #41), injector git-install auto-build (#40).

---

## Docs

| Document | Contents |
|---|---|
| [docs/compat/BASELINE.md](docs/compat/BASELINE.md) | S0 baseline freeze: scope, repo state, declaration surface, runtime versions, not-installed proof |
| [docs/compat/CONTRACT-MATRIX.md](docs/compat/CONTRACT-MATRIX.md) | S1 contract matrix: plugin-side call sites × authoritative runtime definitions, verdicts with `file:line` |
| [docs/compat/ADAPTATION-REPORT.md](docs/compat/ADAPTATION-REPORT.md) | S2/S5 judgements and conclusions + S6 real-install verification (incl. residual risks R-2…R-9) |
| [docs/compat/VERIFICATION.md](docs/compat/VERIFICATION.md) | S4/S6 verification: six layers, real numbers, live-install evidence |
| [docs/compat/raw/](docs/compat/raw/) | Three read-only audit reports (loader / host / client) + decompressed evidence |
| [injector/README.md](injector/README.md) | Injector guide (10 rules) + a 0.2.x correction block |
| [injector/docs/SPEC.md](injector/docs/SPEC.md) | Injector spec (with a 0.2.x correction section at the top) |
| [preset/docs/paper.md](preset/docs/paper.md) · [preset/docs/experiments.md](preset/docs/experiments.md) | Routing preset paper and the P1–P23 experiments |
| [docs/FLATTEN-MIGRATION.md](docs/FLATTEN-MIGRATION.md) | Repository structure migration (submodules → committed files) |

---

## License

MIT. Copyright belongs to the upstream author **yjh051108** (see [LICENSE](LICENSE)); the adaptation work in this
fork is maintained by **XIAxsc**.

Credits: xiaobright/modeltest (V4.1b evaluation), xiaobright/dsh-anchored-standard (anchoring mechanism).
