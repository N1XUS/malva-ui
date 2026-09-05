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

| Key                   | Action            |
| --------------------- | ----------------- |
| ArrowRight / ArrowUp  | Increment by step |
| ArrowLeft / ArrowDown | Decrement by step |
| Home                  | Set to 0          |
| End                   | Set to max        |

The horizontal pair is **logical against the document direction only**. `_onHostKeydown` switches on `MlvRtlService.normalizeArrowKey`, which reads the service's **global** `direction()` — so with `<html dir="rtl">` ArrowLeft increments and ArrowRight decrements. It does **not** follow a `[dir="rtl"]` scope on an ancestor: inside one the paint and the hit test mirror (they read `elementDirection(host)`) while the arrows keep their LTR meaning. That split is a defect in `MlvRtlService`, tracked as **#147**, and is fixed there rather than in this component; `MlvRating direction › keyboard` pins today's behaviour so the fix cannot land without this section being corrected with it. The vertical pair, Home and End never mirror.

### Focus / tab order

- **Single tab stop (roving tabindex):** only the star covering the current value is tabbable (`tabindex="0"`); all other stars are `-1` (and all `-1` when read-only or disabled). Arrow keys change the value; the host (`role="group"`) handles the key events. Previously every star was `tabindex="0"`, producing up to `max` tab stops.
- Star buttons keep toggle-button semantics (`aria-pressed`) rather than `role="radio"`, because half-star precision (`step="0.5"`) does not map cleanly onto a discrete radio group.

### Hover preview

- The preview is driven by **one delegated `mousemove` listener on the host**, bound in the constructor as `fromEvent(host, 'mousemove').pipe(takeUntilDestroyed())` — not a per-star `(mousemove)` binding (issue #16, landed in PR #113 alongside #76). An Angular listener binding notifies the change-detection scheduler on every event before knowing whether the handler changed anything; a hover sweep is hundreds of events, and after the first, `_hoverValue` is set to the value it already holds. It also replaces `max()` listeners with one.
- The handler resolves the star with `closest('.mlv-rating__star')` and its one-based position among its siblings. A move that lands between stars resolves to no star and is ignored, exactly as the per-star binding did.
- `_isLeadingHalf` is unaffected: the two icon layers are `pointer-events: none`, so `event.target` is the star `<button>` in both forms and `event.offsetX` stays measured against the same box as `star.offsetWidth`. Removing `pointer-events: none` from `.mlv-rating__icon` would silently move `offsetX` into the `<svg>`'s coordinate space and misplace the half-star midpoint.
- The geometry read is on the half-star path only: `step() === 0.5` short-circuits before `_isLeadingHalf`, so a whole-star rating performs no layout read during a hover sweep.
- Covered by the `MlvRating hover preview` suite in `rating.spec.ts`; the delegated shape itself (one host listener, none per star, flat as `max` grows) is pinned by `MlvRating pointer-listener delegation`, since hover behaviour is identical either way and every behavioural test passes against the per-star form.
- Host `(mouseleave)` still clears the preview and remains a host binding — it fires once per sweep.

### Direction (RTL)

- Half-star precision is direction-aware on **both** sides, and they are derived from one signal — `_direction = MlvRtlService.elementDirection(host)`, which follows the global direction and any `[dir]` scope above the host.
  - **Hit test** — `_isLeadingHalf` mirrors the `offsetX` midpoint test: `offsetX < half` in LTR, `offsetX > half` in RTL.
  - **Paint** — `_clipPath` picks the physical side to inset from: `inset(0 R% 0 0)` in LTR, `inset(0 0 0 R%)` in RTL.
- Why the paint needs the direction at all: `.mlv-rating` is a plain `flex-direction: row`, so the star row follows the inline base direction and a star's leading (lower-value) half is its physical **left** half in LTR and its **right** half in RTL — while CSS `inset()` takes physical `top right bottom left` offsets and has no logical form or `dir` sensitivity.
- Issue #127 was these two disagreeing: the hit test resolved `2.5` correctly and the fill painted on the star's other half, in hover preview, committed value and `readonly` display alike. Whole stars were unaffected, so it was specific to `step=0.5`.
- **Scope caveat — the keyboard is not scope-aware.** Only the paint and the hit test read `_direction`. The arrow mirror goes through `MlvRtlService.normalizeArrowKey`, which reads the **global** direction, so inside a `[dir="rtl"]` ancestor with the document still LTR a rating paints and hit-tests RTL while ArrowLeft still decrements. Do not read the bullet above as a whole-component guarantee. See **Keyboard Navigation** and **#147**.
- **Why not the CSS-token approach `mlv-compare` uses.** Compare clips its own inline axis entirely in SCSS, with `--mlv-inline-direction` zeroing one `inset()` side (`libs-compare.md` → _Clipping_), which mirrors on a scoped `[dir]` at any depth with no TypeScript. Rating cannot borrow it: `_isLeadingHalf` has to read the direction in TypeScript regardless, because `offsetX` is physical — so a CSS-side sign would give the paint a **second, independent** direction source, which is precisely the two-sources split #127 was. Both sides reading one `_direction()` is the invariant the fix buys. Compare has no pointer half-test, so one source is all it needs. That is why the two components clip the same axis by different mechanisms; it is deliberate, not drift.
- The star glyph itself must **not** mirror — a star is near-symmetric, and `transform: scaleX(var(--mlv-inline-direction))` on the icon box would fix the fill indirectly and mislead the next reader.
- Covered by the `MlvRating direction` suite in `rating.spec.ts`: global flip, a repaint driven only by the direction signal (no `detectChanges()`), a scoped `[dir=rtl]` ancestor with the document still LTR, pointer hit-test/paint agreement under **both** a global and a scoped flip, the keyboard axes, and a characterization test pinning the unmirrored scoped keyboard (#147).

---

## Usage

Import: `import { MlvRating } from '@malva-ui/core/rating';`

Selector: `mlv-rating`

Inputs: max, step, readonly, disabled

---

## Internationalization (i18n)

Strings resolve through `MLV_RATING_I18N` (`@malva-ui/i18n`): `rating` (the `role="group"` host label) and `rateValue` — an ICU string (`"Rate {value} out of {max}"`) resolved per star via `MlvI18nResolverService`. Provide `provideMlvI18nTesting()` in specs.

## Dependencies

- @angular/core
- @angular/forms/signals
- @malva-ui/core/form-utils (`MlvSignalFormControlBase`, `MLV_FORM_CONTROL`, `MlvFormState`)
- @lucide/angular (LucideStar)

---

## Field surface (2026-08)

- No `aria-required` / `aria-label` forwarding: every star is a `<button>` that already carries its own `aria-label` (the i18n `rateValue` template), and ARIA does not allow `aria-required` on `role="button"`. The inherited `required` and `ariaLabel` inputs therefore have no ARIA effect on `mlv-rating` — express the requirement through the surrounding `mlv-form-field` / label copy.
