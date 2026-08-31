# Library: form

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

`@malva-ui/core/form` is the **layout** layer for forms (the control infrastructure lives in `@malva-ui/core/form-utils`). It enhances native `<form>` / `<fieldset>` / `<legend>` with Malva rhythm and grid, and makes a form the single density source for every control inside it. Design: `docs/superpowers/specs/2026-08-16-form-layout-design.md`.

## Public API

Exported from `libs/core/form/src/index.ts`:

| Export                 | Kind      | Description                                                            |
| ---------------------- | --------- | ---------------------------------------------------------------------- |
| `MlvForm`              | Component | `form[mlvForm]` — vertical stack, density-scaled gap, density context  |
| `MlvFieldset`          | Component | `fieldset[mlvFieldset]` — legend/description + auto-fit or capped grid |
| `MlvFormHeader`        | Directive | `[mlvFormHeader]` — title row (flex, wrap, space-between)              |
| `MlvFormActions`       | Directive | `[mlvFormActions]` — actions row; `align` input                        |
| `MlvFieldsetSpan`      | Directive | `[mlvFieldsetSpan]` — `grid-column` span for a fieldset grid child     |
| `MlvFormGap`           | Type      | `'xs' \| 's' \| 'm' \| 'l' \| 'xl'` (spacing-2/3/4/5/6)                |
| `MlvFieldsetColumns`   | Type      | `'auto' \| number`                                                     |
| `MlvFormActionsAlign`  | Type      | `'start' \| 'end' \| 'center' \| 'between'`                            |
| `MlvFieldsetSpanValue` | Type      | `number \| 'full'`                                                     |

---

## Components

### `MlvForm`

**File:** `libs/core/form/src/lib/form/form.ts` | **Selector:** `form[mlvForm]` | **Change detection:** `OnPush` | **Encapsulation:** `None`

Attribute component on the native `<form>` (reactive forms, signal forms, `ngSubmit`, `type="submit"` all stay native). Template is `<ng-content />`.

#### Inputs

| Name         | Type                      | Default     | Description                                                                                                                                            |
| ------------ | ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mlvDensity` | `MlvDensity \| undefined` | `undefined` | Forwarded from the `MlvDensityDirective` host directive (`MLV_DENSITY_ELEMENT: 'form'`). Stamps `mlv-form--<density>` and is projected to descendants. |
| `gap`        | `MlvFormGap \| undefined` | `undefined` | Inline `--mlv-form-gap` override; unset = density default.                                                                                             |
| `maxWidth`   | `string \| undefined`     | `undefined` | Bound to `max-inline-size`.                                                                                                                            |

#### Density projection

The form both stamps `mlv-form--<density>` (cascade-only components such as `mlv-form-control-wrapper` follow the ancestor class) **and** provides `MLV_DENSITY_CONTEXT` via `provideMlvDensityContext(MlvDensityDirective)` (directive-bearing components such as `mlvButton`, and `mlv-popup`/`[mlvAutocomplete]` panels, resolve it before the service). Resolution everywhere: explicit input → nearest context → `MlvDensityService`. See `libs-density.md`.

**Caveat — the form always stamps its own modifier.** `mlv-form--<density>` is written on every form from its resolved density (explicit input → context → service), so it _shadows_ an enclosing CSS-only density region for everything inside it. A region declared as a bare class (an ancestor `mlv--tight` / `*--tight` with no directive and no context) is not readable from JS, so the form resolves to the service value and cascade-only descendants follow `mlv-form--<service density>`, not the region. Pass `mlvDensity` on the form (or provide a context above it) instead of relying on a CSS-only region.

#### Host bindings

```ts
host: {
  class: 'mlv-form',
  '[style.--mlv-form-gap]': '_gapValue()',       // null when gap is unset
  '[style.max-inline-size]': 'maxWidth() ?? null',
}
```

#### Styles (`form.scss`, block `mlv-form`)

- `display:flex; flex-direction:column; align-items:stretch; min-inline-size:0; gap: var(--mlv-form-gap)`.
- `--mlv-form-gap` density scale (`_form-mixins.scss` `gap-scale`): tight `--mlv-spacing-2`, compact `-3`, comfortable `-4` (default), spacious `-5`, airy `-6`. Override anywhere with `--mlv-form-gap`.
- `> .mlv-button { align-self: flex-start }`.

### `MlvFieldset`

**File:** `libs/core/form/src/lib/fieldset/fieldset.ts` | **Selector:** `fieldset[mlvFieldset]` | **Template:** `fieldset.html` | **Styles:** `fieldset.scss`

Template: `@if (legend()) <legend class="mlv-fieldset__legend">` else `<ng-content select="legend" />` → optional `<p class="mlv-fieldset__description" [id]>` → `<div class="mlv-fieldset__body"><ng-content /></div>`. The grid sits on `__body` (legend never becomes a grid item; avoids the WebKit fieldset+grid bug). A projected `<legend>` is used only when the `legend` input is unset.

#### Inputs

| Name             | Type                                                                         | Default                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | `string`                                                                     | `mlvNextId('mlv-fieldset')` | Host id; the description id is `<id>-description`.                                                                                                                                                                                                                                                                                                                                                                                 |
| `legend`         | `string \| undefined`                                                        | `undefined`                 | Renders `<legend class="mlv-fieldset__legend">`.                                                                                                                                                                                                                                                                                                                                                                                   |
| `description`    | `string \| undefined`                                                        | `undefined`                 | Renders `<p class="mlv-fieldset__description">`; host `aria-describedby` points at it (removed when absent). A **static** `aria-describedby` authored on the `<fieldset>` is read once at construction and preserved: with a description the attribute becomes `"<id>-description <authored>"`, without one it stays `"<authored>"`. A **bound** `[attr.aria-describedby]` is not supported — the host binding owns the attribute. |
| `columns`        | `MlvFieldsetColumns` (transform accepts numeric strings; invalid → `'auto'`) | `'auto'`                    | `'auto'` = auto-fit; number = **max** columns → `mlv-fieldset--capped` + `--mlv-fieldset-columns`.                                                                                                                                                                                                                                                                                                                                 |
| `minColumnWidth` | `string`                                                                     | `'10rem'`                   | `--mlv-fieldset-min-column-width`.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `gap`            | `MlvFormGap \| undefined`                                                    | `undefined`                 | Inline `--mlv-form-gap` on the fieldset (shadows the form's for it and nested fieldsets).                                                                                                                                                                                                                                                                                                                                          |

#### Host bindings

`class: 'mlv-fieldset'`, `[attr.id]`, `[class.mlv-fieldset--capped]`, `[style.--mlv-fieldset-columns]`, `[style.--mlv-fieldset-min-column-width]`, `[style.--mlv-form-gap]`, `[attr.aria-describedby]` (`_describedBy()` — the description id merged with a static consumer-authored value, `null` when neither is present).

#### Styles (`fieldset.scss`, block `mlv-fieldset`)

- Host: `fieldset-reset`, `display:block`, `--mlv-fieldset-default-gap` density-scaled (standalone rhythm), `--mlv-fieldset-min-column-width: 10rem`.
- `__legend` and `> legend`: `legend` mixin — `padding: 0 0 spacing-2`, body-l / semibold, `--mlv-text-primary`, `inline-size:100%`, `float:none`; plus `legend-dense` (body-m) under `density-tight` / `density-compact`.
- `__description`: body-s, `--mlv-text-secondary`, `margin: 0 0 spacing-3`.
- `__body`: `display:grid; min-inline-size:0; gap: var(--mlv-form-gap, var(--mlv-fieldset-default-gap)); grid-template-columns: repeat(auto-fit, minmax(min(var(--mlv-fieldset-min-column-width), 100%), 1fr))`.
- `--capped > __body`: `repeat(auto-fit, minmax(max(min(min-col, 100%), calc((100% - (n - 1) * gap) / n)), 1fr))` — the inner `min(…, 100%)` clamp keeps the track from overflowing a container narrower than `minColumnWidth`.

#### Bare `<fieldset>` fallback (in `form.scss`)

`.mlv-form fieldset:not(.mlv-fieldset)`: `fieldset-reset` + `display:flex; flex-direction:column; gap: var(--mlv-form-gap)`; `> legend` gets the `legend` mixin. No grid — use `mlvFieldset` for columns.

Its tight/compact type scale is written as two explicit selectors (`.mlv-form[class*='--tight'|'--compact'] fieldset:not(.mlv-fieldset) > legend { @include form.legend-dense }`), not through the `density.*` mixins: those prefix the whole selector with an **ancestor** `[class*='--x']`, and this selector already starts at `.mlv-form`, so the form's own `mlv-form--<density>` modifier could never match. Regression-guarded by `form-styles.spec.ts`, which compiles `form.scss` with `sass` and asserts both selectors.

#### Caveat

Native `fieldset[disabled]` disables the inner native inputs of Malva controls without updating their `disabled` signal (wrapper not styled disabled). Not synced yet — drive `disabled` on the controls / form group instead.

## Directives

### `MlvFormHeader` — `[mlvFormHeader]`

**File:** `libs/core/form/src/lib/form-header.ts`. Host class `mlv-form__header`: `display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap: var(--mlv-spacing-3)`. Direct-child headings (`> :is(h1…h6)`) get `margin: 0` so consumer heading rules don't break the row (the `[class*='mlv']` reset is layered and loses to them). Put `h*[mlvTitle]` + accessories inside. No inputs. Styled by `form.scss` (use inside `form[mlvForm]`).

### `MlvFormActions` — `[mlvFormActions]`

**File:** `libs/core/form/src/lib/form-actions.ts`. Host class `mlv-form__actions`: `display:flex; flex-wrap:wrap; align-items:center; gap: var(--mlv-spacing-3); justify-content:flex-start`.

| Input   | Type                  | Default   | Description                                                                                                |
| ------- | --------------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `align` | `MlvFormActionsAlign` | `'start'` | `end` / `center` / `between` add `mlv-form__actions--align-<x>` (`flex-end` / `center` / `space-between`). |

### `MlvFieldsetSpan` — `[mlvFieldsetSpan]`

**File:** `libs/core/form/src/lib/fieldset-span.ts`. Host `[style.grid-column]`.

| Input             | Type                                                                            | Description                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `mlvFieldsetSpan` | `MlvFieldsetSpanValue` (required; numeric strings accepted, invalid → `'full'`) | `'full'` → `1 / -1`; `n` → `span n`. Numeric spans overflow an auto-fit grid that collapsed below `n` columns — prefer `'full'` there. |

## Internal helpers

- `libs/core/form/src/lib/form-gap.ts` — `mlvFormGapValue(gap)` maps a step to its `var(--mlv-spacing-*)` (not exported).
- `libs/core/form/src/lib/_form-mixins.scss` — `gap-scale($var)`, `fieldset-reset`, `legend` (base declarations, no density blocks), `legend-dense` (body-m type scale for tight/compact).

## Dependencies

- `@angular/core`; `@malva-ui/cdk/density` (`MlvDensityDirective`, `MLV_DENSITY_ELEMENT`, `provideMlvDensityContext`); `@malva-ui/cdk/utils` (`mlvNextId`); `@malva-ui/styles` (SCSS mixins/tokens).
