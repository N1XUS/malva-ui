---
# Library: rating

> **Keep this file up to date.** Update whenever the public API, component behaviour, or dependencies change.

---

## Overview

**Package:** `@malva-ui/core/rating`
**Selector:** `mlv-rating`
**Path:** `libs/core/rating/src/lib/rating/rating.ts`

A signal-forms-native star rating component with hover preview, half-star precision via clip-path, read-only display mode, keyboard navigation, and compatibility across all Angular forms APIs.

---

## Public API

### `MlvRating`

Extends `MlvSignalFormControlBase<number>` from `@malva-ui/core/form-utils`. Its `value = model(0)` implements `FormValueControl<number>`; the inherited `touch` output and field-state inputs complete the signal-forms contract. Provides `MLV_FORM_CONTROL` for Malva form-field composition and deliberately does not provide `NG_VALUE_ACCESSOR`.

| Member                       | Type                  | Default            | Description                                                                                                                                                                                                        |
| ---------------------------- | --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `max`                        | `number`              | `5`                | Total number of stars rendered                                                                                                                                                                                     |
| `step`                       | `1 or 0.5`            | `1`                | Step increment — `0.5` enables half-star precision                                                                                                                                                                 |
| `value`                      | `ModelSignal<number>` | `0`                | Two-way value model used by signal, reactive, and template-driven forms                                                                                                                                            |
| `readonly`                   | `BooleanInput`        | `false`            | _(inherited)_ Disables interaction; shows a static value display                                                                                                                                                   |
| `disabled`                   | `BooleanInput`        | `false`            | _(inherited)_ Disables interaction; also settable via `FormControl.disable()` (merged into `computedDisabled()`)                                                                                                   |
| `state`                      | `MlvFormState`        | `'default'`        | _(inherited)_ Explicit validation state. A non-default value wins; otherwise bound errors resolve to `error` after the field is touched. The effective state is reflected as the `mlv-rating--state-*` host class. |
| `id`                         | `string`              | auto (`mlvNextId`) | _(inherited)_ Bound to the host `id` attribute                                                                                                                                                                     |
| `label` / `hint` / `message` | `string`              | `''`               | _(inherited)_ Available from the base; no text-field chrome is rendered (rating does not adopt `MlvFormControlWrapper`)                                                                                            |

Implements the signal-forms `FormValueControl<number>` contract. Angular's compatibility bridge keeps `ngModel`, `[formControl]`, and `formControlName` working without CVA plumbing. The reusable binding-matrix spec verifies value, touched, and disabled round-trips through all three forms transports.

The inherited `resolvedState` computed signal keeps visual validation consistent with other migrated controls: explicit non-default states take precedence, while an invalid Signal Forms field becomes visually `error` only after it is touched.

### Keyboard Navigation

| Key                   | Action                                                               |
| --------------------- | -------------------------------------------------------------------- |
| ArrowRight / ArrowUp  | Increment by step                                                    |
| ArrowLeft / ArrowDown | Decrement by step                                                    |
| Home                  | Set to 0                                                             |
| End                   | Set to max                                                           |
| Enter / Space         | Commit the focused star's whole value (native `<button>` activation) |

The horizontal pair is **logical and scoped to the host** (#147). `_onHostKeydown` switches on `MlvRtlService.normalizeArrowKey(event, this._direction())`, the same cached signal the paint reads — so ArrowLeft increments under `<html dir="rtl">`, under a `[dir="rtl"]` ancestor with the document still LTR, and inside an overlay pane (CDK stamps `dir` on every one). Paint, hit test and keyboard can no longer disagree. The vertical pair, Home and End never mirror.

**Focus and fill follow the value (#314).** A handled key commits `value`, clears `_hoverValue` and calls `_focusActiveStar()`, which focuses the star at `_activeIndex()` — the one now holding `tabindex="0"`:

- Whole stars: 2 → ArrowRight ×2 → 4, star 4 focused, four stars filled. Half stars (`step="0.5"`): each press moves 0.5; 2.5 focuses **star 3** (the star the value sits in, `Math.ceil(value) - 1`) and paints it half; 2.5 → 3 keeps focus on star 3. Value 0 (Home, or a decrement to 0) puts focus and the stop on **star 1** with every star empty — the rating is cleared, not "one star".
- Only moves focus that is **already inside** the rating — on a star, or on the `tabindex="-1"` host a click between stars focuses. A keydown dispatched on the host while focus is elsewhere changes the value and leaves focus alone. The focused element is read from `host.getRootNode()`, so a rating inside a shadow root works — there `document.activeElement` is the shadow host, outside the rating, and focus would stay behind (pinned by `rating-keyboard.spec.ts` § _inside a shadow root_).
- **Touched waits for focus to leave the rating:** the base's `_reportTouchOnFocusLeave()` (#347) ignores a star→star or star→host move, so `_focusActiveStar()` calls `star.focus()` directly. The `_movingFocusBetweenStars` flag that used to guard `_onStarBlur` is gone, and `_onStarBlur` only clears the hover preview. Before #347, a pointer move from one star to another went through `_onStarBlur` too, which touched the rating mid-choice. Dirty follows the value write.
- **Enter / Space commit the whole star** the focused button's label names (#314, adjacent). They reach `_onStarClick` as the browser's own `click`, with `detail === 0` and — measured in Chrome — `offsetX` 0, which `_isLeadingHalf` read as the leading half in LTR and the trailing half in RTL: under `step="0.5"`, Enter on "Rate 3 out of 5" at 3 committed **2.5** in LTR and 3 in RTL. The half test now runs only when `event.detail > 0` (a pointer click carries its click count); keyboard activation and script `click()` commit `starIndex`. A spec dispatching a synthetic pointer click that should hit-test a half must pass `detail: 1` — `new MouseEvent('click')` defaults to `0`.
- `readonly` / `disabled`: the handler returns before anything happens; the stars are natively `disabled` and the host has no `tabindex`, so nothing can hold focus to begin with.
- Before #314 focus stayed on the old star (now `-1`, so Tab from it reached the new stop — two stops inside one control) and the fill did not move at all, because focus pinned the hover preview; see _Hover preview_. The host-dispatched keyboard suites in `rating.spec.ts` never focused a star, which is why nothing caught it; `rating-keyboard.spec.ts` focuses the tab stop first, as a user does, and covers every key (Enter / Space included), half steps, 0, global and scoped RTL, a shadow root, readonly/disabled, hover interplay and touched/dirty. A spec stubbing `MouseEvent.prototype.offsetX` restores jsdom's own getter afterwards rather than deleting it — Vitest shares one jsdom window across the files a worker runs. Verified in Chrome on the docs page with trusted key presses: focus, `tabindex`, fill and `aria-pressed` move together, a single Tab leaves the rating, and `ng-touched` appears only then.

### Focus / tab order

- **Single tab stop (roving tabindex):** only the star covering the current value is tabbable (`tabindex="0"`); all other stars are `-1` (and all `-1` when read-only or disabled). Arrow keys change the value and move focus onto the new stop (above); the host (`role="group"`) handles the key events. Previously every star was `tabindex="0"`, producing up to `max` tab stops.
- Focusing a star changes nothing on screen — the fill shows `value()`. There is no focus preview (removed in #314).
- Star buttons keep toggle-button semantics (`aria-pressed`) rather than `role="radio"`, because half-star precision (`step="0.5"`) does not map cleanly onto a discrete radio group. `aria-pressed` is `value() >= star`, so at 2.5 the focused star 3 reads "not pressed".

### Hover preview

- The preview is driven by **one delegated `mousemove` listener on the host**, bound in the constructor as `fromEvent(host, 'mousemove').pipe(takeUntilDestroyed())` — not a per-star `(mousemove)` binding (issue #16, landed in PR #113 alongside #76). An Angular listener binding notifies the change-detection scheduler on every event before knowing whether the handler changed anything; a hover sweep is hundreds of events, and after the first, `_hoverValue` is set to the value it already holds. It also replaces `max()` listeners with one.
- The handler resolves the star with `closest('.mlv-rating__star')` and its one-based position among its siblings. A move that lands between stars resolves to no star and is ignored, exactly as the per-star binding did.
- `_isLeadingHalf` is unaffected: the two icon layers are `pointer-events: none`, so `event.target` is the star `<button>` in both forms and `event.offsetX` stays measured against the same box as `star.offsetWidth`. Removing `pointer-events: none` from `.mlv-rating__icon` would silently move `offsetX` into the `<svg>`'s coordinate space and misplace the half-star midpoint.
- The geometry read is on the half-star path only: `step() === 0.5` short-circuits before `_isLeadingHalf`, so a whole-star rating performs no layout read during a hover sweep.
- Covered by the `MlvRating hover preview` suite in `rating.spec.ts`; the delegated shape itself (one host listener, none per star, flat as `max` grows) is pinned by `MlvRating pointer-listener delegation`, since hover behaviour is identical either way and every behavioural test passes against the per-star form.
- Host `(mouseleave)` still clears the preview and remains a host binding — it fires once per sweep.
- **`_hoverValue` is pointer-only (#314).** Star focus used to write it too, pinning the preview to the focused star; since it outranks `value()` in `_displayValue`, the fill then ignored every arrow key. With a roving stop the focused star is derived from the value, so a focus preview could only repeat the value or contradict it (2.5 painted as 3, an unrated control as 1). A keyboard change clears the preview so the newer input is the one on screen; the next `mousemove` previews again and `mouseleave` restores the committed value. Star `blur` still clears it.

### Direction (RTL)

- Half-star precision is direction-aware on **both** sides, and they are derived from one signal — `_direction = MlvRtlService.elementDirection(host)`, which follows the global direction and any `[dir]` scope above the host.
  - **Hit test** — `_isLeadingHalf` mirrors the `offsetX` midpoint test: `offsetX < half` in LTR, `offsetX > half` in RTL.
  - **Paint** — `_clipPath` picks the physical side to inset from: `inset(0 R% 0 0)` in LTR, `inset(0 0 0 R%)` in RTL.
- Why the paint needs the direction at all: `.mlv-rating` is a plain `flex-direction: row`, so the star row follows the inline base direction and a star's leading (lower-value) half is its physical **left** half in LTR and its **right** half in RTL — while CSS `inset()` takes physical `top right bottom left` offsets and has no logical form or `dir` sensitivity.
- Issue #127 was these two disagreeing: the hit test resolved `2.5` correctly and the fill painted on the star's other half, in hover preview, committed value and `readonly` display alike. Whole stars were unaffected, so it was specific to `step=0.5`.
- **All three halves share one scope (#147).** Paint, hit test and arrow keys read the same `_direction` signal, `elementDirection(host)` — so a `[dir]` ancestor, or the `dir` CDK stamps on an overlay pane, mirrors the whole component. Before #147 the keyboard read the global direction and stayed LTR inside such a scope.
- **Why not the CSS-token approach `mlv-compare` uses.** Compare clips its own inline axis entirely in SCSS, with `--mlv-inline-direction` zeroing one `inset()` side (`libs-compare.md` → _Clipping_), which mirrors on a scoped `[dir]` at any depth with no TypeScript. Rating cannot borrow it: `_isLeadingHalf` has to read the direction in TypeScript regardless, because `offsetX` is physical — so a CSS-side sign would give the paint a **second, independent** direction source, which is precisely the two-sources split #127 was. Both sides reading one `_direction()` is the invariant the fix buys. Compare has no pointer half-test, so one source is all it needs. That is why the two components clip the same axis by different mechanisms; it is deliberate, not drift.
- The star glyph itself must **not** mirror — a star is near-symmetric, and `transform: scaleX(var(--mlv-inline-direction))` on the icon box would fix the fill indirectly and mislead the next reader.
- Covered by the `MlvRating direction` suite in `rating.spec.ts`: global flip, a repaint driven only by the direction signal (no `detectChanges()`), a scoped `[dir=rtl]` ancestor with the document still LTR, pointer hit-test/paint agreement under **both** a global and a scoped flip, the keyboard axes, the scoped-`[dir]` keyboard mirror (#147) and a `dir="ltr"` island under an RTL document.

### Axe coverage

`rating-a11y.spec.ts` sweeps every state that changes the markup (#314): unrated, a value committed with the keyboard (focus on the new stop), a half value reached with the keyboard, readonly with a half value, disabled, `state="error"`, and a scoped `[dir="rtl"]`. All clean with no narrowing, so `core-rating` left `ROLLOUT_PENDING` in `scripts/check-axe-coverage.mjs`.

---

## Usage

Import: `import { MlvRating } from '@malva-ui/core/rating';`

Selector: `mlv-rating`

Inputs: max, step, readonly, disabled

---

## Internationalization (i18n)

Strings resolve through `MLV_RATING_I18N` (`@malva-ui/i18n`): `rating` (the `role="group"` host label) and `rateValue` — an ICU string (`"Rate {value} out of {max}"`) resolved per star via `MlvI18nResolverService`. Provide `provideMlvI18nTesting()` in specs.

## Validation state (2026-09, #320)

- **`aria-invalid="true"`** on the `role="group"` host while `resolvedState()` is `error`; no attribute otherwise. The stars are toggle buttons (`aria-pressed`), and `button` supports no `aria-invalid`, so the group is the one element that can carry it — as ARIA 1.3's deprecated-global form (1.3 limits `aria-invalid` to a list of roles that `group` is not on), so how it is announced depends on the screen reader.
- **`aria-describedby`** on the host = `_fieldErrorId()`: the enclosing `mlv-form-field`'s error message id while it renders, no attribute otherwise. Not `_describedBy()`: the rating still renders no description / message of its own (follow-up), so pointing at their ids would dangle.
- No visual change: the existing `mlv-rating--state-*` host class is untouched (FC-18, the success / warning / info tints, is its own ticket).
- Spec: `rating-validation.spec.ts`.

## Dependencies

- @angular/core
- @angular/forms/signals
- @malva-ui/core/form-utils (`MlvSignalFormControlBase`, `MLV_FORM_CONTROL`, `MlvFormState`)
- @lucide/angular (LucideStar)

---

## Field surface (2026-08)

- No `aria-required` / `aria-label` forwarding: every star is a `<button>` that already carries its own `aria-label` (the i18n `rateValue` template), and ARIA does not allow `aria-required` on `role="button"`. The inherited `required` and `ariaLabel` inputs therefore have no ARIA effect on `mlv-rating` — express the requirement through the surrounding `mlv-form-field` / label copy.
