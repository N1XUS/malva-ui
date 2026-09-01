---
name: implementer
description: Use when delivering a GitHub ticket end-to-end in this repo — a bug, a perf ticket, a refactor, or a new component. Covers reproduce-first verification, branch naming, the implement → review → remediate loop, out-of-scope flagging, and the verification gate.
---

# Implementer

Delivering a ticket is five phases. Do not collapse them.

`Verify → Implement → Review → Remediate → Gate`

---

## 1. Verify — before writing a line

**Confirm the ticket still reproduces in the current source.** Not in the issue body, not in the git log — in the files on disk right now.

Two failure modes this catches, both of which have already bitten this repo:

| Case          | Symptom                                                   | Action                                                                      |
| ------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| Already fixed | Issue open, fix present in source                         | Report it. Close the issue with the file:line evidence. Do not "re-fix" it. |
| Fix was lost  | Merged PR exists, commit is **not** an ancestor of `main` | `main` was rewritten. Redo the work on a fresh branch.                      |

Check the second with `git merge-base --is-ancestor <sha> origin/main` — a merged PR in `gh pr list` is not proof the code is on `main`.

Then:

- Search for reuse before adding anything. A helper that already exists in `@malva-ui/cdk/*` beats a new one in a leaf lib.
- If the ticket's stated fix is wrong, or its scope is understated, say so **before** implementing. Ticket authors are not infallible; a ticket that says "one line in docs" may turn out to be a plugin-level default affecting every project.

---

## 2. Branch

`[type]/ds/[issue-number]`, cut from an up-to-date `main`.

`type` ∈ `fix` · `perf` · `feat` · `refactor` · `docs` · `ci` · `test` — match the issue's own prefix where it has one.

One ticket, one branch, one PR.

---

## 3. Implement — test first, always

1. Write the regression test. Run it. **Confirm it fails, and fails for the right reason.** Paste the failure output.
2. Then fix.
3. Re-run. Green.

A test that would pass against the unfixed code proves nothing and is worse than no test — it certifies the bug. Assert the resulting **state**, never merely that nothing threw.

Watch the assertion level. A class-only assertion (`expect(host.classList).toContain('--scrolling')`) passes on a broken component; assert the computed effect (`getComputedStyle(track).opacity`) instead.

### Repo-specific traps

- jsdom cannot parse `@layer` and drops the whole stylesheet, so `getComputedStyle` silently reads `''` instead of failing. `setupFiles` strips layers for injected `<style>`; for assertions on compiled CSS **text**, wrap in `stripCssLayersFromText()` from `@malva-ui/internal-testing`.
- Run everything through nx: `yarn nx run <project>:<target>`. Never invoke vitest/eslint directly.
- After any rename or removal, grep the **whole repo** for the old name — enums, DI registrations, docs, READMEs, lockfile. Not just your diff.

---

## 4. Review — a different teammate

The reviewer must not be the agent that wrote the code. Brief the reviewer to **refute**, not to approve.

The reviewer reads the actual `git diff`, not the implementer's summary.

**Gate question first:** would the new test fail without the fix? If the reviewer cannot demonstrate that, it is a blocker — everything else is secondary.

Then sweep four dimensions. Report per dimension so a silent one is visible as "checked, clean" rather than "forgotten".

### Performance & complexity

- **Nested scans.** `.some()` / `.find()` / `.includes()` inside `.filter()` / `.every()` / `.map()` is O(n x m). Name the real sizes — `selected x options`, `batch x existing`, `rows x columns`.
- **Measure before swapping to a Set/Map.** The break-even is often higher than the real data size, and building the index can cost more than the scan it replaces. State the crossover and the expected n. "Replace scan with Set" is a hypothesis, not a fix.
- **Hot paths deserve extra scrutiny**: scroll / pointermove / input / resize handlers, any `computed()` read from a template, anything re-running per lazy page or per rendered row.
- **Allocation in a hot path.** A fresh object or array per call defeats memoization and `OnPush` identity checks downstream.
- **Forced reflow.** A layout read (`getBoundingClientRect`, `offsetHeight`, `getComputedStyle`) after a style write in the same frame. Batch reads before writes.
- **Listener cost.** High-frequency listeners registered in-zone, or registered raw without `takeUntilDestroyed` / `DestroyRef.onDestroy`.
- **Observer churn.** One `ResizeObserver` / `MutationObserver` per element where a shared one would do; undebounced broad-subtree callbacks; a callback that writes a style it also observes (measurement feedback loop).

### Angular best practices

- Signal APIs only: `input()` / `output()` / `model()` / `computed()` / `contentChild()` / `viewChild()` — never the `@Input` / `@Output` / `@ViewChild` decorators.
- `ChangeDetectionStrategy.OnPush` on every component; `ViewEncapsulation.None` on every library component.
- `host` object — never `@HostBinding` / `@HostListener`.
- Native control flow `@if` / `@for` (with `track`) / `@switch` — never `*ngIf` / `*ngFor` / `*ngSwitch`.
- `[class.x]` / `[style.x]` — never `ngClass` / `ngStyle`.
- `inject()`, not constructor parameter injection.
- No `signal.mutate()`. No side effects inside `computed()`.
- `effect()` only where `computed()` genuinely cannot express it.
- SSR safety: no browser global (`window`, `document`, `getComputedStyle`, `ResizeObserver`, `matchMedia`, `IntersectionObserver`, `navigator`) reachable during server render. Prefer `afterNextRender` over a guarded `effect` for anything that measures — it removes the class instead of guarding each instance.
- No `standalone: true` — it is the default and setting it is wrong here.

### Code quality

- Naming: `Mlv` prefix on every public export; no `Component` / `Directive` suffix on those classes; `_` prefix + JSDoc on private/protected members.
- JSDoc on every public input, output, and method.
- Barrel exports use `export * from './x'`, never named re-exports.
- No `any` — `unknown` plus narrowing.
- After a rename or removal, no orphan references anywhere in the repo.
- Tests assert resulting **state**, not that nothing threw.

### Correctness, a11y, and drift

- Trace the fix's mechanism rather than accepting its description. Look for specificity or cascade-layer orderings where the new rule loses.
- Repo style rules: BEM + `$block`, rem units, real `--mlv-*` tokens only, `@layer mlv.components`, a reduced-motion path, the `--mlv-padding-*` pair rule.
- Accessibility: keyboard reachability, focus-ring form A/B, contrast, ARIA correctness.
- Cross-component drift for any change in a shared lib — name the consumers and say what happens to each.

Findings carry a concrete failure scenario — inputs/state → wrong output. "Consider renaming" is not a finding.

---

## 5. Remediate — verify before you agree

Findings go **back to the implementer**, not to a third agent.

Do not perform agreement. Check each claim against the code first:

- **fixed** — the finding was right.
- **disputed** — the finding is technically wrong. Say why, with evidence. Changing correct code to satisfy a wrong review is a regression.
- **deferred** — right, but genuinely outside this ticket. Record it.

---

## 6. Gate

Run, capture real exit codes, read the output:

```
yarn nx run <project>:test
yarn nx run <project>:lint
```

…plus the `test` and `lint` target of **every** project appearing in `git diff --name-only`.

Never report a pass you did not observe. If something failed, say so and quote the error verbatim. A green claim over a red run is the one unrecoverable mistake here.

---

## Out-of-scope finds

Both the implementer and the reviewer will notice adjacent problems. Triage them:

|                                                  | Action                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| In the area you're already touching, small, safe | Fix it. Add a note to the PR description under **Adjacent fixes**. |
| Anything larger, or outside the area             | Leave the code alone. Record it for a follow-up issue.             |

The PR description must name every adjacent fix. An unexplained change in a diff costs the reviewer more than it saved you.

---

## Teammates

- Pass `model` explicitly on every agent call — `opus` unless there's a reason.
- Subagents share one working tree: **no commit, no push, no branch switch, no `git stash`.** Stashing races their writes and silently eats work. Orchestrator owns the commit and the PR.
- Parallelise across independent tickets only. Phases within a ticket are sequential by construction.

---

## Red Flags — STOP

- About to fix without confirming the bug reproduces in current source
- Wrote the fix before the failing test
- Test passes on unfixed code
- Claiming a command passed without reading its output
- Same agent implemented and reviewed
- `git stash` while a subagent has the tree
- Silently widened scope beyond the ticket

## Common Rationalizations

| Excuse                                         | Reality                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| Issue is well-written, no need to reproduce it | Issues go stale, and merged PRs get lost in history rewrites. Verify.     |
| Test after the fix is the same thing           | It isn't. You never saw it fail, so you don't know it can.                |
| Reviewer flagged it, so change it              | Reviewers are wrong sometimes. Verify, then fix or dispute with evidence. |
| Small enough to skip the review pass           | The loop is cheap. Shipping a wrong fix under a ticket number is not.     |
| I'll note the extra change in the commit body  | The PR description is where reviewers look. Put it there.                 |
