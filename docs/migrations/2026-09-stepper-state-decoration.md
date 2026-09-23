# 2026-09 — `mlv-step`'s `state` is decoration; `activeIndex` alone selects

Applies to `@malva-ui/core/stepper` (`MlvStepper`, `MlvStep`, `MlvStepState`).
Fixes #312 (audit LN-02, state half; owner ruling D9).

**Breaking, behaviour only.** No exported symbol was renamed, removed or
retyped; no barrel, selector, input, output, token, i18n key or BEM class
changed. `MlvStep.state` keeps its name, its type (`MlvStepState | undefined`)
and its default. What changes is what a value **means**: `state` now styles one
step's indicator and nothing else, and the selected step — `aria-selected`,
the rendered panel — is always the one at `activeIndex`.

`VERSIONING.md` § 3, row _Changed default behaviour at an unchanged API — …
ARIA, what a value means_ (`state="active"` no longer selects). The other half
— an explicit `error` / `completed` / `pending` on the step at `activeIndex`
now showing its panel — is the _Bug fix that restores documented behaviour_
row on its own, and ships in the same change. On the `0.x` line a `!` commit is
demoted to a minor: `0.1.15` → `0.2.0` (§ 7; `docs/RELEASING.md` § 3.1).

A stepper that binds no `state` on any step renders byte-identical markup:
with no explicit state, "derived `active`" and "at `activeIndex`" are the same
step.

## 1. What changed

One derived string, `_stateFor(step)`, used to drive both the indicator and
the selection. It returned the step's explicit `state` first, and
`aria-selected`, the horizontal panel, the vertical panel's `--active` class
and its `inert` all keyed on `_stateFor(step) === 'active'`. So any explicit
`state` hid the real selection.

Now `_isSelected(step)` — the step's live position `=== activeIndex()` —
drives every selection surface, and `_stateFor` feeds only the indicator, the
step-header / vertical-label state modifiers and the connector `--completed`.

Measured in jsdom against `mlv-stepper` at `f523684f` and after this change
(three steps A / B / C; `aria-selected` per tab, panels rendered and not
`inert`):

| Arrangement                                                                         | Before                                                                                                                  | After                                                                              |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `activeIndex` 1, B `state="error"` (or `"completed"`, `"pending"`) — horizontal     | **no tabpanel rendered**; no tab `aria-selected="true"`; the roving tab stop sits on B, a tab announced as not selected | B selected, B's panel rendered; B keeps the error indicator                        |
| Same — vertical                                                                     | **every panel `inert` and collapsed**; no tab selected                                                                  | B's panel open, the others `inert`; B keeps the error indicator                    |
| `activeIndex` 0, C `state="active"` — horizontal                                    | **two tabpanels** (A and C) rendered one under the other; two tabs `aria-selected="true"`                               | only A selected and rendered; C shows the active indicator, nothing else           |
| Same — vertical                                                                     | **two panels open**; two tabs selected                                                                                  | only A's panel open; C shows the active indicator                                  |
| A `state="completed"`, B `state="active"`, no `initialIndex` (the old docs pattern) | B open and selected; A shows the checkmark and is closed                                                                | **A open and selected** (with the checkmark); B shows the active indicator, closed |
| User on B; the app sets B `state="error"` (a failed validation)                     | B's panel **disappears**, no tab selected, nothing emitted                                                              | B stays selected and open with the error indicator; nothing emitted                |
| Clicking a step marked `state="error"` (docs example 5, Payment)                    | `activeIndexChange` emits `1`, then a **blank content area** and no selected tab                                        | emits `1`; Payment selected and open, error indicator kept                         |
| `previous()` onto a step marked `state="completed"` (docs example 3, Back)          | emits `0`, then a **blank content area**                                                                                | emits `0`; that step selected and open, checkmark kept                             |
| No `state` on any step                                                              | derived `completed` / `active` / `pending`                                                                              | unchanged — byte-identical                                                         |

Unchanged: the roving tab stop (seeded from `activeIndex` before and after), the
mobile `Step N of M` counter (already read `activeIndex`), `linear` gating
(`_isClickable` compares positions, never states), `next()` / `previous()` /
`selectStep()` and `activeIndexChange`.

Full contract: `.claude/projects/libs-stepper.md` § _Explicit `state` is
decoration_.

## 2. Why decoration and not selection

A step's `state` is domain status — "payment failed", "already done" — and
selection is which panel the user is looking at. They are independent: the user
must be able to open the failed step to fix it, and a step can read as the
current process step while the user reviews an earlier one. Folding both into
one string made the first impossible (the failed step could not be opened) and
the second produce two open panels. D9 — accepted by the owner 2026-09-23 —
keeps `state` for the indicator only.

No dev-mode warning is emitted for `state="active"`: it is a legitimate
decoration now (the current process step shown as active while the user views
another), so a warning would fire on correct code.

## 3. What a consumer may need to do

### (a) `state="active"` used to choose the open step

- **Before:** `<mlv-step label="Processing" state="active">` opened that step,
  whatever `activeIndex` held — usually `0`.
- **After:** the step at `activeIndex` is open; `Processing` only shows the
  active indicator. With the common `state="completed"` on the steps before
  it, step 0 now opens under a checkmark.
- **Do:** delete `state="active"` (and any `state="completed"` that only
  imitated the derived look) and set the index instead:
  `<mlv-stepper [initialIndex]="1">`. To move later, call
  `selectStep(i)` on the stepper (emits `activeIndexChange`, moves the roving
  tab stop, refuses forward moves in `linear` mode) or `activeIndex.set(i)`
  (ignores `linear`, emits nothing, and does not move the roving tab stop yet
  — #459).

### (b) A bound `[state]` that tracks your own step index

- **Before:** `[state]="i === step() ? 'active' : i < step() ? 'completed' : 'pending'"`
  opened whichever step your `step()` signal named, even when the stepper's
  `activeIndex` pointed elsewhere.
- **After:** the open step is the stepper's `activeIndex`; your binding only
  paints indicators, so a header click moves the panel while your indicators
  stay on `step()`.
- **Do:** delete the binding — the derived states are exactly those three —
  and derive `step()` from the stepper instead of keeping your own copy
  (`computed(() => stepper()?.activeIndex() ?? 0)` over
  `viewChild(MlvStepper)`; libs-stepper § _Conditional steps_). Keep a
  `[state]` binding only for what the stepper cannot derive, typically
  `'error'`.

### (c) An explicit `error` / `completed` / `pending` on a reachable step

- **Before:** navigating to that step — by click, Enter, `next()`,
  `previous()`, `selectStep()` or a re-index — showed a blank content area and
  no selected tab.
- **After:** its panel opens and its indicator keeps the explicit state.
- **Do:** nothing. This is the defect being fixed. Note that the selected step
  then has no step-header look of its own: the header shows the explicit
  state, and in a horizontal row at desktop width `aria-selected` is its only
  selection cue (see libs-stepper § _Explicit `state` is decoration_). A
  selection cue independent of `state` is left open as #480.

### (d) Selectors and specs that read selection from a state class

- **Before:** `.mlv-stepper__step-header--active` and the vertical
  `.mlv-stepper__label--active` always sat on the selected step.
- **After:** they follow the indicator state, so with explicit states they can
  sit on an unselected step, or be absent from the selected one.
- **Do:** read selection from `[role="tab"][aria-selected="true"]`, or from the
  rendered / `.mlv-stepper__content-panel--active` panel, which still means the
  open one. Read the step-header state modifiers only to test the indicator.

## 4. In this repository

- `.claude/projects/libs-stepper.md`'s "Vertical stepper" example used
  `state="completed"` + `state="active"` to open its second step — shape (a).
  It now writes `[initialIndex]="1"` and no `state`. It also passed
  `aria-label` to `mlv-stepper`, which the host's `[attr.aria-label]` binding
  removes; it now uses the `ariaLabel` input.
- `apps/docs` stepper example 3 (_Deviative Step_) marked its first step
  `state="completed"` only to imitate the derived look beside
  `[initialIndex]="1"`. Back used to strand the user on an empty panel; it
  now opens the step, and with the redundant `state` removed the step shows
  the active indicator there rather than a checkmark.
- `apps/docs` stepper example 5 (_Semantic States_) keeps its markup:
  selecting Payment (`state="error"`) used to show a blank content area and
  now opens it with the error indicator. Its description says so.
- The home page's stepper and the SSR smoke stepper bind no `state` and
  are unchanged.
