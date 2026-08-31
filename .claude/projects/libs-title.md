# Library: title

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Title library (`@malva-ui/core/title`) provides an inline heading-typography component that decorates the host element itself through the `[mlvTitle]` selector. It can infer heading size from native `h1` to `h6` tags, accept an explicit `level` override on any host element, render projected content or a bound value, and switch into an editable form-control mode backed by Angular's ControlValueAccessor API.

## Public API

Exported from `libs/core/title/src/index.ts`:

| Export          | Kind      | Description                                       |
| --------------- | --------- | ------------------------------------------------- |
| `MlvTitle`      | Component | Inline title component applied as `[mlvTitle]`    |
| `MlvTitleLevel` | Type      | `1 \| 2 \| 3 \| 4 \| 5 \| 6` visual heading scale |

---

## Components

### `MlvTitle`

**File:** `libs/core/title/src/lib/title/title.ts`

- **Selector:** `[mlvTitle]`
- **Change Detection:** `OnPush`
- **Template:** `libs/core/title/src/lib/title/title.html`
- **Styles:** `libs/core/title/src/lib/title/title.scss`

#### Inputs

| Name          | Type                         | Default                | Description                                                     |
| ------------- | ---------------------------- | ---------------------- | --------------------------------------------------------------- |
| `level`       | `MlvTitleLevel \| undefined` | inferred from host tag | Visual heading size override                                    |
| `editable`    | `boolean`                    | `false`                | Enables the synchronized `<pre>` + `<textarea>` editing surface |
| `placeholder` | `string`                     | `''`                   | Placeholder text used by editable mode                          |
| `readonly`    | `boolean`                    | `false`                | Prevents textarea editing when editable mode is active          |
| `disabled`    | `boolean`                    | `false`                | Disables the control                                            |

#### Model

| Name    | Type                    | Default | Description                                                                  |
| ------- | ----------------------- | ------- | ---------------------------------------------------------------------------- |
| `value` | `Model<string \| null>` | `null`  | Signal-model API for the title text; takes precedence over projected content |

#### Form Support

- Implements `ControlValueAccessor`
- Provides `NG_VALUE_ACCESSOR`
- Provides `MLV_FORM_CONTROL`
- Compatible with `[(ngModel)]`, `formControl`, and `formControlName`
- Works inside `mlv-form-field`

#### Rendering Rules

- Native `h1` to `h6` hosts keep their semantics and infer `level` automatically
- Non-heading hosts receive `role="heading"` and `aria-level`
- Projected content is used when `value` is not bound
- Editable mode hydrates its initial text from the projected content if needed
- Bound `value` and form writes both feed the same internal editable state

#### Styles Summary

- Uses Malva UI heading typography tokens directly (`--mlv-typography-heading-h1-size` through `h6`)
- Does not create component-scoped CSS variables for static token mappings
- Editable mode overlays a transparent textarea on top of a synchronized `<pre>` so the heading auto-grows naturally

---

## Usage Examples

```html
<!-- Inferred from h1 -->
<h1 mlvTitle>Quarterly roadmap</h1>

<!-- Explicit level override -->
<div mlvTitle level="2">Section heading</div>

<!-- Signal-model binding -->
<h2 mlvTitle editable [value]="headline()" (valueChange)="headline.set($event)"></h2>

<!-- Template-driven forms -->
<h3 mlvTitle editable name="title" [(ngModel)]="title"></h3>

<!-- Reactive forms -->
<h2 mlvTitle editable formControlName="title"></h2>
```

---

## Accessibility Notes

- Non-heading hosts get `role="heading"` and `aria-level`
- Editable mode uses a native `<textarea>` for keyboard and assistive-technology compatibility
- The visible heading typography remains the host element, preserving semantic structure when used on native heading tags

## Dependencies

- `@angular/forms`
- `@angular/cdk`
- `@malva-ui/core/form-utils`

---

## Field surface (2026-08)

- The editable `<textarea>` now carries `[attr.aria-label]="ariaLabel()"` and `[attr.aria-required]="required() || null"` from the inherited base inputs.
- `mlv-title` renders no `mlv-description` / `mlv-message` chrome, so the inherited `description` input has no effect and no `aria-describedby` is emitted — wrap the title in `mlv-form-field` when a field description is needed.
