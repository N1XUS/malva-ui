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

### Focus / tab order

- **Single tab stop (roving tabindex):** only the star covering the current value is tabbable (`tabindex="0"`); all other stars are `-1` (and all `-1` when read-only or disabled). Arrow keys change the value; the host (`role="group"`) handles the key events. Previously every star was `tabindex="0"`, producing up to `max` tab stops.
- Star buttons keep toggle-button semantics (`aria-pressed`) rather than `role="radio"`, because half-star precision (`step="0.5"`) does not map cleanly onto a discrete radio group.

### Hover preview

- The preview is driven by **one delegated `mousemove` listener on the host**, bound in the constructor as `fromEvent(host, 'mousemove').pipe(takeUntilDestroyed())` — not a per-star `(mousemove)` binding (changed in #76). An Angular listener binding notifies the change-detection scheduler on every event before knowing whether the handler changed anything; a hover sweep is hundreds of events, and after the first, `_hoverValue` is set to the value it already holds. It also replaces `max()` listeners with one.
- The handler resolves the star with `closest('.mlv-rating__star')` and its one-based position among its siblings. A move that lands between stars resolves to no star and is ignored, exactly as the per-star binding did.
- `_isLeadingHalf` is unaffected: `event.target` is the `<svg>` under the cursor in both forms, so `offsetX` is unchanged. Covered by the `MlvRating hover preview` suite in `rating.spec.ts`.
- Host `(mouseleave)` still clears the preview and remains a host binding — it fires once per sweep.

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
