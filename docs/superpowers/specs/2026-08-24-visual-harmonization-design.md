# Visual Harmonization Program — Design

Date: 2026-08-24
Status: approved direction, pre-plan
North star: **keep Malva identity, refine toward Taiga UI polish** — token discipline, calm surfaces, confident density. No new aesthetic direction.

## Problem

- User-perceived gaps (all four confirmed): component drift, generic aesthetic, weak composition, and a need to re-assess first.
- Prior audit ([docs/audits/component-library-2026-08-20/AUDIT.md](../../audits/component-library-2026-08-20/AUDIT.md)): components individually consistent; premium gap = composition ("parts, not products").
- Concrete exhibit: website-builder showcase — nested card-in-card-in-card borders, repeated toggle/config/delete clusters, flat surface hierarchy, accent noise.

## Approach (chosen: token-first cascade)

Spec before pixels. Audit → visual language spec → dimension sweeps → composition recipes. Showcases are the acceptance test. Rejected alternatives: showcase-first hand-polish (overrides never generalize), per-component redesign (creates new drift, 60× effort).

## Phase 1 — Audit

**Capture (haiku):**
- Screenshot all ~82 component docs routes + 6 showcase pages + open/clicked overlay states via docs dev server. Contact sheets like 2026-08-20 audit.
- Browser pane is shared — capture batches run sequentially, never parallel.

**Inventory (haiku):**
- Grep-based drift matrix over `libs/`: per-component `--mlv-*` token usage, hard-coded rem/px values, radius/spacing value histograms, component-scoped alias sprawl.

**Judge (opus):**
- Score screenshots against Taiga UI references per dimension: surface ladder, radius roles, control-height rhythm, accent budget, state styling, motion.
- Output: `docs/audits/harmonization-2026-08-24/AUDIT.md`, severity-ranked findings. User's two website-builder screenshots = exhibit #1.

## Phase 2 — Visual language spec

Delta document against `libs/styles/src/lib/theme.scss` — not a rewrite. Every decision annotated `current → target (Taiga-informed rationale)`. Covers:

- **Surface ladder:** 3 tiers (base / subtle / raised) + overlay; explicit nesting rule — when nested, drop borders, use sunken/plain zones.
- **Radius role map:** which `--mlv-radius-*` role each component anatomy part uses; kill per-component drift.
- **Control-height rhythm:** `--mlv-height-*` scale enforcement, vertical rhythm between stacked controls.
- **Accent budget:** one action color per view; semantic tones reserved for state, not decoration.
- **State formula:** uniform hover/active/focus/disabled recipe (bg ramp + focus ring + disabled opacity) applied identically everywhere.
- **Motion table:** duration/easing per interaction class; reduced-motion paths intact.

Output feeds Phase 3 as a token change list + per-dimension rules. Written by opus + main loop.

## Phase 3 — Normalization sweeps (sonnet)

Sweep by **dimension**, not by component. Order:

1. `theme.scss` token changes (single commit, everything downstream inherits)
2. Radius
3. Spacing/padding (respect `--mlv-padding-*` pair rules)
4. Surface/elevation
5. Typography
6. States
7. Motion

Per sweep: one sonnet agent with the spec excerpt for that dimension; `ui-styling-reviewer` (sonnet) verifies; gates: `styles:lint`, `check-padding-tokens`, affected component lint. Sweeps sequential; **no git stash while agents edit** (worktree or report-only if isolation needed). SCSS-only intent — API changes escalate back to main loop.

## Phase 4 — Composition recipes + acceptance

Recipes (opus defines, sonnet applies to showcases):

- **Nested-surface rule** — flatten card-in-card noise (exhibit #1 target).
- **Control-cluster spacing** — repeated action groups (toggle/config/delete rows) share one geometry.
- **Accent discipline** — audit showcase views to one action color.

Acceptance criteria:

- Before/after screenshots per sweep; final `qa-chrome-tester` pass over all 6 showcases.
- Drift matrix re-run clean (no hard-coded values, no off-role radius/spacing).
- Showcases read Taiga-grade to opus judge re-score.

## Model map

| Work | Model |
| --- | --- |
| Screenshot capture, grep inventory | haiku |
| Sweeps, styling review, showcase application | sonnet |
| Audit judgment, spec authoring, composition recipes, re-score | opus |
| Orchestration, final taste, API-change decisions | main loop (Fable) |

Program-scoped override of the "all subagents opus/sonnet" memory rule: haiku allowed for mechanical capture/inventory only.

## Non-goals

- No new components, no component API changes unless a sweep is blocked without one (escalate first).
- No dark-theme redesign — tokens keep both themes in sync by construction; verify, don't redesign.
- No docs-app chrome redesign (nav/article frame) — showcase pages only.

## Risks

- Shared browser pane serializes capture — accept slower Phase 1 over flaky parallel capture.
- Dirty working tree on `main` (large uncommitted changeset) — sweeps must not stage/commit unrelated files; targeted `git add` only.
- Taiga references are external — judge works from public Taiga docs screenshots; if unreachable, fall back to documented Taiga token values.
