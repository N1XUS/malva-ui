# Visual Harmonization Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harmonize Malva UI visually — audit all components/showcases, define a Taiga-informed visual language delta, normalize every SCSS dimension, and fix showcase composition — verified by screenshots and lint gates.

**Architecture:** Token-first cascade. Phase 1 captures evidence (screenshots + grep inventory), Phase 2 writes an opinionated token/recipe delta against `theme.scss`, Phase 3 applies it in dimension-ordered SCSS sweeps, Phase 4 fixes showcase composition. Showcases are the acceptance test.

**Tech Stack:** Nx + Angular v20 monorepo, SCSS/BEM, `--mlv-*` tokens, Playwright (installed) for scripted capture, docs app at `localhost:4200` via `.claude/launch.json` name `docs`.

**Spec:** `docs/superpowers/specs/2026-08-24-visual-harmonization-design.md`

## Global Constraints

- Model tiering: **haiku** = capture/inventory execution; **sonnet** = scripts, sweeps, showcase edits, styling review; **opus** = audit judgment, visual language spec, composition recipes, re-score. Orchestrator passes `model` explicitly on every Agent call.
- North star: keep Malva identity, refine toward Taiga UI polish. No new aesthetic direction, no new components, no component API changes (escalate to main loop if a sweep is blocked without one).
- Working tree on `main` is dirty with unrelated changes. Commits use explicit file paths (`git add <paths>` / `git commit -- <paths>`). NEVER `git add -A`, never stash.
- `/docs/` is gitignored. Program artifacts under `docs/audits/harmonization-2026-08-24/` stay **local-only** (do not force-add). Plan/spec docs are already force-added.
- SCSS rules from `.claude/rules/bem-scss.md` apply to every edit: BEM, `$block` var, rem values, no invented tokens, `--mlv-padding-*` only as whole `padding:` value.
- Gates available: `yarn nx run styles:lint`, `yarn nx run styles:check-tokens`, `yarn nx run styles:check-padding-tokens`, `yarn nx run styles:verify-tokens` (tokens md in sync; regen with `yarn nx run styles:generate-tokens`), `yarn nx affected -t lint --base=HEAD`.
- Browser pane is shared — any Browser-pane interaction is sequential, one agent at a time. Scripted Playwright capture runs its own headless Chromium and is exempt.
- Reduced-motion paths must survive every sweep (`mixins.reduced-motion`).

---

### Task 1: Capture tooling — route manifest + Playwright screenshot script

**Model:** sonnet

**Files:**
- Create: `docs/audits/harmonization-2026-08-24/tools/capture.mjs`
- Create: `docs/audits/harmonization-2026-08-24/routes.json`

**Interfaces:**
- Produces: `routes.json` — `{ "components": [{"slug": "button", "path": "/button"}, ...], "showcases": [{"slug": "website-builder", "path": "/showcases/website-builder"}, ...] }`
- Produces: `capture.mjs` CLI — `node capture.mjs --out <dir> [--routes slug1,slug2] [--scheme light|dark] [--base http://localhost:4200]`. Writes `<NN>-<slug>.png` (full-page) per route, ordered by manifest index.

- [ ] **Step 1: Build routes.json**

Component slugs = directories of `apps/docs/src/app/pages/` minus `home`, `not-found` (keep `getting-started`, `theming`, `density`, etc. — they show token surfaces). Showcase slugs are in `apps/docs/src/app/showcases/showcase.registry.ts` (`slug:` fields): `project-workspace`, `support-inbox`, `publishing-workspace`, `data-operations`, `settings-access`, `website-builder`.

```bash
ls apps/docs/src/app/pages | grep -v -E '^(home|not-found)$'
```

Write `routes.json` by hand from that output: component path = `/<slug>`, showcase path = `/showcases/<slug>`.

- [ ] **Step 2: Write capture.mjs**

```js
// docs/audits/harmonization-2026-08-24/tools/capture.mjs
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')),
);
const base = args.base ?? 'http://localhost:4200';
const out = args.out ?? 'shots';
const scheme = args.scheme === 'dark' ? 'dark' : 'light';
const only = args.routes ? new Set(args.routes.split(',')) : null;

const manifest = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'routes.json'), 'utf8'),
);
const all = [...manifest.components, ...manifest.showcases];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: scheme,
});
const page = await ctx.newPage();
let failures = 0;
for (const [i, r] of all.entries()) {
  if (only && !only.has(r.slug)) continue;
  const n = String(i + 1).padStart(2, '0');
  try {
    await page.goto(base + r.path, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500); // settle animations
    await page.screenshot({ path: join(out, `${n}-${r.slug}.png`), fullPage: true });
    console.log(`ok ${n}-${r.slug}`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${r.slug}: ${e.message}`);
  }
}
await browser.close();
if (failures) process.exit(1);
```

- [ ] **Step 3: Smoke-test against running docs app**

Start docs server (Browser-pane `preview_start` name `docs`, or it may already run). Then:

```bash
node docs/audits/harmonization-2026-08-24/tools/capture.mjs --routes=button,website-builder --out=docs/audits/harmonization-2026-08-24/tools/smoke
```

Expected: `ok NN-button`, `ok NN-website-builder`, exit 0, two non-empty PNGs in `tools/smoke/`. If chromium missing: `yarn playwright install chromium` and retry.

- [ ] **Step 4: Verify manifest completeness**

Route count in `routes.json` must equal `ls apps/docs/src/app/pages | grep -vcE '^(home|not-found)$'` plus 6 showcases. No commit (local-only artifacts).

---

### Task 2: Baseline capture — all routes, light + dark

**Model:** haiku

**Files:**
- Create: `docs/audits/harmonization-2026-08-24/baseline/light/*.png`, `.../baseline/dark/*.png`

**Interfaces:**
- Consumes: Task 1 `capture.mjs` + `routes.json`; docs server on `:4200`.
- Produces: full baseline PNG sets, filenames `<NN>-<slug>.png`.

- [ ] **Step 1: Capture light**

```bash
node docs/audits/harmonization-2026-08-24/tools/capture.mjs --out=docs/audits/harmonization-2026-08-24/baseline/light
```

Expected: one `ok` line per manifest route, exit 0.

- [ ] **Step 2: Capture dark**

```bash
node docs/audits/harmonization-2026-08-24/tools/capture.mjs --scheme=dark --out=docs/audits/harmonization-2026-08-24/baseline/dark
```

- [ ] **Step 3: Verify counts**

```bash
ls docs/audits/harmonization-2026-08-24/baseline/light | wc -l
ls docs/audits/harmonization-2026-08-24/baseline/dark | wc -l
```

Both equal manifest route count. Any `FAIL` line → report the failing slugs in the task summary; do not silently drop routes.

---

### Task 3: Open/overlay states + exhibit #1 (Browser pane, sequential)

**Model:** haiku

**Files:**
- Create: `docs/audits/harmonization-2026-08-24/baseline/states/*.png`

**Interfaces:**
- Consumes: docs server; shared Browser pane (`preview_start` name `docs`).
- Produces: screenshots named `<slug>--open.png` for: `dialog`, `drawer`, `menu`, `tooltip`, `toast`, `notification`, `time-picker`, `select`, `combobox`, `popup`; plus `website-builder--page-layouts.png` (**exhibit #1**).

- [ ] **Step 1:** For each overlay route: `navigate` to it, `read_page` to find the first example's trigger button, click it, take `computer {action:"screenshot"}`, save the returned image to the states dir (agent writes the image content to file). One route at a time — shared pane.
- [ ] **Step 2:** Navigate `/showcases/website-builder`, scroll to the "Page layouts" panel (nested row/block cards with toggle+config+delete clusters), screenshot → `website-builder--page-layouts.png`. This is exhibit #1 from the spec (matches the user's reference screenshots).
- [ ] **Step 3:** Verify 11 files exist, non-empty. List any trigger that could not be found instead of guessing a different interaction.

---

### Task 4: Token drift inventory

**Model:** haiku (commands are given verbatim; collate outputs, no judgment)

**Files:**
- Create: `docs/audits/harmonization-2026-08-24/inventory.md`

**Interfaces:**
- Produces: `inventory.md` with one section per dimension, each containing the raw command, hit counts, and full hit lists (trimmed to `path:line: match`).

- [ ] **Step 1: Run each command, paste results under its heading**

```bash
# 1 Hard-coded px (should be ~none outside tooling)
grep -rn --include='*.scss' -E '[0-9]+px' libs/core libs/cdk libs/editor

# 2 Raw colors (hex/rgb/hsl — should be zero; tokens only)
grep -rnE --include='*.scss' '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' libs/core libs/cdk libs/editor

# 3 Radius usage histogram (token vs literal)
grep -rhn --include='*.scss' 'border-radius' libs/core libs/cdk libs/editor | grep -oE 'var\(--mlv-radius-[a-z0-9-]+\)|[0-9.]+rem|50%|9999px' | sort | uniq -c | sort -rn

# 4 Literal rem values histogram (candidates for spacing tokens)
grep -rhoE --include='*.scss' '\b[0-9]*\.?[0-9]+rem\b' libs/core libs/cdk libs/editor | sort | uniq -c | sort -rn

# 5 Component-scoped --mlv-* alias declarations (sprawl check)
grep -rhoE --include='*.scss' '^\s*--mlv-[a-z0-9-]+:' libs/core libs/cdk libs/editor | tr -d ' ' | sort | uniq -c | sort -rn

# 6 Shadow usage (raw box-shadow vs --mlv-shadow-* tokens)
grep -rn --include='*.scss' 'box-shadow' libs/core libs/cdk libs/editor | grep -v 'var(--mlv-shadow'

# 7 Duration/easing literals (vs --mlv-duration-* / --mlv-ease-*)
grep -rnE --include='*.scss' '[0-9]+m?s\b' libs/core libs/cdk libs/editor | grep -vE 'var\(--mlv-(duration|ease)'

# 8 Focus-ring drift (all focus-visible blocks, for uniformity review)
grep -rn -A2 --include='*.scss' ':focus-visible' libs/core libs/cdk libs/editor | grep -E 'outline|box-shadow'
```

- [ ] **Step 2:** Header of `inventory.md`: total `.scss` file count audited (`find libs/core libs/cdk libs/editor -name '*.scss' | wc -l`) so coverage is checkable.
- [ ] **Step 3:** No editing, no filtering beyond the given greps, no fixes. Raw evidence only.

---

### Task 5: Taiga UI reference capture

**Model:** haiku

**Files:**
- Create: `docs/audits/harmonization-2026-08-24/taiga-refs/*.png`

**Interfaces:**
- Produces: reference screenshots `taiga-<name>.png` for: button, input, select, checkbox, toggle, badge, tag, tabs, dialog, notification, table, breadcrumbs, accordion, pagination, avatar.

- [ ] **Step 1:** Browser pane → `https://taiga-ui.dev/components/<name>` for each name above; wait for demo to render; screenshot the demo area; save. Sequential (shared pane).
- [ ] **Step 2:** Verify 15 files. If taiga-ui.dev unreachable, record that in a `README.md` in the folder and stop — the judge (Task 6) then falls back to Taiga's published token values (`@taiga-ui/core` styles on GitHub) per spec risk note. Do not substitute a different design system.

---

### Task 6: Audit judgment

**Model:** opus

**Files:**
- Create: `docs/audits/harmonization-2026-08-24/AUDIT.md`

**Interfaces:**
- Consumes: Task 2 baselines, Task 3 states + exhibit #1, Task 4 `inventory.md`, Task 5 taiga-refs, prior audit `docs/audits/component-library-2026-08-20/AUDIT.md`.
- Produces: `AUDIT.md` — findings grouped by the spec's six dimensions (**surface ladder, radius roles, control-height rhythm, accent budget, state formula, motion**), each finding: severity (critical/high/medium/low), affected components (slugs), evidence (screenshot filename + inventory line refs), Taiga contrast note. Ends with a ranked "top 10 fixes" list.

- [ ] **Step 1:** Read prior audit first — do not re-litigate composition findings it already made; reference them.
- [ ] **Step 2:** Per dimension: compare Malva baselines against taiga-refs; cross-check visual suspicion against inventory data before recording a finding (a visual "radius looks off" must cite the inventory histogram line).
- [ ] **Step 3:** Exhibit #1 (`website-builder--page-layouts.png`) gets its own composition section: name each concrete defect (nested border count, repeated control-cluster geometry, accent instance count in view).
- [ ] **Step 4:** Verify every finding has: severity, ≥1 slug, ≥1 evidence ref. No fix proposals in this doc — findings only.

---

### Task 7: Visual language spec (delta doc) — USER GATE

**Model:** opus (main loop reviews before presenting)

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-visual-language-spec.md` (force-add + commit after user approval)

**Interfaces:**
- Consumes: Task 6 `AUDIT.md`, `libs/styles/src/lib/theme.scss` (source of truth, 1149 lines).
- Produces: per-dimension rule sections **1 Surface ladder, 2 Radius roles, 3 Height rhythm, 4 Accent budget, 5 State formula, 6 Motion**, each rule as `current → target (rationale)`; plus a **Token change list** table: `token | current value (light/dark) | new value (light/dark) | affected components`; plus a **Sweep worklist** per dimension: exact `file:line` targets sourced from inventory + audit.

- [ ] **Step 1:** Draft the six sections. Every rule must be executable by a sonnet agent without taste: exact token names from `theme.scss` (no invented tokens — `check-tokens` gate), exact values.
- [ ] **Step 2:** Token change list covers BOTH themes for every changed token.
- [ ] **Step 3:** Sweep worklist: for each dimension, list the files/lines to change (from inventory) and the rule that applies. Empty worklist for a dimension = state explicitly "no drift found".
- [ ] **Step 4:** Self-check: no TBDs; every worklist entry maps to a rule; every rule maps to ≥1 audit finding or is marked "preventive".
- [ ] **Step 5: STOP. Present to user for approval.** No sweep starts before explicit yes. After approval:

```bash
git add -f docs/superpowers/specs/2026-08-24-visual-language-spec.md
git commit -m "docs: visual language spec for harmonization sweeps" -- docs/superpowers/specs/2026-08-24-visual-language-spec.md
```

---

### Task 8: Sweep 0 — theme.scss token changes

**Model:** sonnet

**Files:**
- Modify: `libs/styles/src/lib/theme.scss` (light + dark blocks)
- Possibly regen: tokens markdown via `yarn nx run styles:generate-tokens`

**Interfaces:**
- Consumes: Token change list from visual language spec (Task 7).
- Produces: updated global tokens; every downstream sweep assumes these values.

- [ ] **Step 1:** Apply each row of the token change list to `theme.scss` — both theme blocks per row.
- [ ] **Step 2: Gates**

```bash
yarn nx run styles:lint
yarn nx run styles:check-tokens
yarn nx run styles:check-padding-tokens
yarn nx run styles:generate-tokens && yarn nx run styles:verify-tokens
```

Expected: all pass.

- [ ] **Step 3: Visual spot-check** — recapture 6 representative routes and eyeball against baseline:

```bash
node docs/audits/harmonization-2026-08-24/tools/capture.mjs --routes=button,input,card,dialog,data-table,website-builder --out=docs/audits/harmonization-2026-08-24/after-sweep0
```

Diff vs `baseline/light`: only intended changes. Repeat with `--scheme=dark`.

- [ ] **Step 4: Commit (explicit paths only)**

```bash
git add libs/styles/src/lib/theme.scss libs/styles/tokens.md
git commit -m "refactor(styles): apply visual language token changes" -- libs/styles/src/lib/theme.scss libs/styles/tokens.md
```

(`generate-tokens` writes `libs/styles/tokens.md` — always commit it with `theme.scss` or `verify-tokens` fails in CI.)

---

### Task 9–14: Dimension sweeps (one task per dimension, strictly in order)

**Model:** sonnet per sweep; after each sweep dispatch `ui-styling-reviewer` (model sonnet) on the diff.

Order and commit message per sweep:

| # | Dimension | Commit |
| --- | --- | --- |
| 9 | Radius roles | `refactor(core): normalize radius roles per visual language spec` |
| 10 | Spacing/padding | `refactor(core): normalize spacing to token halves per visual language spec` |
| 11 | Surface/elevation | `refactor(core): normalize surface ladder and shadows per visual language spec` |
| 12 | Typography | `refactor(core): normalize type roles per visual language spec` |
| 13 | States | `refactor(core): unify hover/active/focus/disabled formula per visual language spec` |
| 14 | Motion | `refactor(core): normalize durations/easings per visual language spec` |

Each sweep task, identically structured:

**Files:**
- Modify: exactly the `file:line` entries in that dimension's Sweep worklist (visual language spec). No other files.

**Interfaces:**
- Consumes: dimension rule section + worklist; tokens already final from Task 8.
- Produces: SCSS-only diff; component APIs, templates, and TS untouched (template/TS change needed → STOP, escalate to main loop per Global Constraints).

- [ ] **Step 1:** Work through the worklist top to bottom. Apply the rule verbatim: replace literals with the specified token, move off-role tokens to the specified role. Respect `--mlv-padding-*` pair semantics (per-side/gap → matching `--mlv-spacing-*` half: xs→1/2, s→1-5/3, m→2/4, l/xl/2xl→3/6).
- [ ] **Step 2:** Pattern sweep — for every defect class fixed, grep the whole `libs/` tree for other instances of the *pattern* (not just worklist lines) and fix or report them:

```bash
# example for radius sweep
grep -rn --include='*.scss' -E 'border-radius:\s*[0-9.]+rem' libs/core libs/cdk libs/editor
```

- [ ] **Step 3: Gates**

```bash
yarn nx run styles:check-padding-tokens
yarn nx run styles:check-tokens
yarn nx affected -t lint --base=HEAD
```

Expected: all pass (affected lint covers every touched lib).

- [ ] **Step 4: Visual verify** — recapture the routes of all affected components (`--routes=` from worklist slugs), light + dark, into `after-sweep<N>/`; compare against previous sweep's capture; confirm only the dimension under sweep changed.
- [ ] **Step 5:** Dispatch `ui-styling-reviewer` on `git diff` output; fix its findings; re-run Step 3 gates.
- [ ] **Step 6: Commit** — explicit paths:

```bash
git add $(git diff --name-only -- libs | tr '\n' ' ')
git commit -m "<message from table>" -- libs
```

- [ ] **Step 7:** Reduced-motion check (sweeps 13–14 especially): every animated block still has `mixins.reduced-motion` or bespoke fallback:

```bash
grep -rLn --include='*.scss' 'reduced-motion' $(grep -rln --include='*.scss' -E '@keyframes|animation:' libs/core libs/cdk libs/editor)
```

Expected: empty output (every animating file references reduced-motion).

---

### Task 15.5: Build `mlv-icon-toggle` (owner-added at gate, 2026-08-25)

**Model:** sonnet implement; review per teammates directive (ui-styling-reviewer + code-reviewer-fixer)

**Files:**
- Create: `libs/core/icon-toggle/` — new leaf lib (Nx generator per `nx-generate` skill), component `button[mlvIconToggle]`, BEM `.mlv-icon-toggle`, spec file, lib `CLAUDE.md` (symlink pattern `.claude/projects/libs-icon-toggle.md`)
- Modify: `libs/core/` package exports (secondary entry point `@malva-ui/core/icon-toggle`), root `CLAUDE.md` library index, docs app: new `icon-toggle` page with examples + route + `routes.json` manifest addition
- Design authority: visual language spec **AB-R7** (chromeless fill-based toggle; `pressed` model + `aria-pressed`; `tone?: MlvTone` colors icon only; ≥24px target; reduced-motion path)

**Interfaces:**
- Produces: `MlvIconToggle` with `pressed` model(), `tone` input, `disabled` input (BooleanInput). Task 16 uses it for the support-inbox star (`tone="warning"`).

- [ ] Step 1: scaffold lib per nx-generate + repo conventions (ViewEncapsulation.None, OnPush, host BEM class).
- [ ] Step 2: implement per AB-R7; SCSS per bem-scss rules; states rest/hover/pressed/focus/disabled.
- [ ] Step 3: unit tests (state toggling asserts aria-pressed + class changes, keyboard activation, disabled gating — assert states, not just "no throw").
- [ ] Step 4: docs page with examples (default, tone=warning star, disabled); add route; update routes.json; `yarn nx run docs:check-doc-api` after CLAUDE.md.
- [ ] Step 5: gates — affected lint+test; capture new route screenshot.
- [ ] Step 6: commit `feat(icon-toggle): chromeless icon toggle component`.

### Task 15: Composition recipes

**Model:** opus

**Files:**
- Modify: `docs/superpowers/specs/2026-08-24-visual-language-spec.md` (append "7 Composition recipes" section; amend-commit not needed — new commit)

**Interfaces:**
- Consumes: exhibit #1 findings (AUDIT.md composition section), post-sweep captures.
- Produces: three recipes, each with concrete CSS guidance an executor applies without taste:
  - **Nested-surface rule** — max one bordered card level; inner grouping via `--mlv-background-sunken`/plain zones + spacing, not borders. Include a before/after DOM sketch for the website-builder block card.
  - **Control-cluster geometry** — one shared spec (gap token, control size, alignment) for repeated toggle/config/delete clusters.
  - **Accent discipline** — per view: primary action instances allowed, everything else secondary/ghost; semantic tones only for state.

- [ ] **Step 1:** Write the three recipes with exact tokens/classes.
- [ ] **Step 2:** Each recipe cites the exhibit/audit finding it fixes.
- [ ] **Step 3: Commit**

```bash
git add -f docs/superpowers/specs/2026-08-24-visual-language-spec.md
git commit -m "docs: composition recipes for showcase harmonization" -- docs/superpowers/specs/2026-08-24-visual-language-spec.md
```

---

### Task 16: Apply recipes to showcases

**Model:** sonnet (one dispatch per showcase, sequential, website-builder first)

**Files:**
- Modify: `apps/docs/src/app/showcases/pages/<slug>/*` (html/scss/ts per showcase; docs-app components keep default encapsulation — do not add `ViewEncapsulation.None`)

**Interfaces:**
- Consumes: composition recipes (Task 15).
- Produces: showcases conforming to all three recipes; showcase registry/spec files untouched unless a showcase's structure change breaks its spec — then update the spec test to the new structure in the same commit.

Per showcase (order: `website-builder`, `settings-access`, `support-inbox`, `data-operations`, `publishing-workspace`, `project-workspace`):

- [ ] **Step 1:** Apply the three recipes to the page's templates/SCSS.
- [ ] **Step 2:** Run its tests + lint:

```bash
yarn nx affected -t test lint --base=HEAD
```

- [ ] **Step 3:** Recapture: `capture.mjs --routes=<slug> --out=.../after-showcases`, light + dark; verify nested-border count reduced and one primary accent per view (visual check against recipe).
- [ ] **Step 4: Commit** per showcase:

```bash
git add $(git diff --name-only -- apps/docs/src/app/showcases | tr '\n' ' ')
git commit -m "refactor(docs): apply composition recipes to <slug> showcase" -- apps/docs/src/app/showcases
```

---

### Task 17: Acceptance

**Model:** haiku (recapture + re-inventory), opus (re-score), then `qa-chrome-tester` (sonnet)

**Files:**
- Create: `docs/audits/harmonization-2026-08-24/ACCEPTANCE.md`, `.../final/light/*.png`, `.../final/dark/*.png`

- [ ] **Step 1 (haiku):** Full recapture both schemes into `final/`; re-run every Task 4 inventory command, paste fresh results into `ACCEPTANCE.md` under "Inventory after".
- [ ] **Step 2 (opus):** Re-score: walk AUDIT.md findings one by one — `fixed` (evidence: final screenshot) / `improved` / `open (reason)`. Compare `final/` vs `baseline/` for the top-10 list explicitly. Verdict line: ship / another sweep needed (name the dimension).
- [ ] **Step 3 (qa-chrome-tester):** Interactive pass over the 6 showcases on `:4200` — overlays open/close, keyboard nav intact, no visual regressions in open states. Findings → fix (sonnet) → re-verify.
- [ ] **Step 4:** All gates green:

```bash
yarn nx run styles:lint && yarn nx run styles:check-tokens && yarn nx run styles:check-padding-tokens && yarn nx run styles:verify-tokens
yarn nx affected -t test lint --base=main~1
```

(If affected base drifted, run `yarn nx run-many -t test lint -p styles,docs` plus every swept lib.)

- [ ] **Step 5:** Any `open` finding at critical/high → loop back to the owning sweep task; medium/low → record in ACCEPTANCE.md as accepted debt with one-line reason.

---

### Task 18: Documentation upkeep

**Model:** sonnet

**Files:**
- Modify: `.claude/rules/bem-scss.md` (if token values/roles changed), `.claude/projects/libs-styles.md`, any `libs/*/CLAUDE.md` whose documented styling behavior changed, `CLAUDE.md` migrations list if a token was renamed/removed.

- [ ] **Step 1:** Diff-driven: `git log --oneline main..HEAD -- libs/styles` + token change list → update every doc that states an old value. Repo-wide grep for each changed/removed token name (whole repo, not just diff):

```bash
grep -rn 'mlv-<old-token>' . --include='*.md' --include='*.scss' --include='*.ts' --include='*.html' -l
```

Expected after fixes: no stale references.

- [ ] **Step 2:** If any lib CLAUDE.md changed: `yarn nx run docs:check-doc-api` — expected pass.
- [ ] **Step 3: Commit**

```bash
git add $(git diff --name-only -- .claude CLAUDE.md libs | grep -E '\.md$' | tr '\n' ' ')
git commit -m "docs: sync styling docs with harmonization changes"
```
