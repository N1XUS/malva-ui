---
# Library: tokenizer

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Tokenizer library (`@malva-ui/core/tokenizer`) provides a tag/token input component with signal/reactive/template-driven forms support.

## Public API

Exported from `libs/forms/tokenizer/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvTokenizer<T>` | Component | Token input — `mlv-tokenizer` |
| `MlvToken` | Component | Individual token — `mlv-token` |
| `MlvTokenTemplate` | Directive | Custom token template — `[mlvTokenTemplate]` |
| `MlvTokenTemplateContext<T>` | Interface | `{ $implicit: MlvSelectOption<T> }` |
| `MlvSelectOption<T>` | Interface | `{ label: string; value: T }` |

---

## Components

### `MlvTokenizer<T>`

**File:** `libs/forms/tokenizer/src/lib/tokenizer/tokenizer.ts`
**Template:** `libs/forms/tokenizer/src/lib/tokenizer/tokenizer.html`
**Styles:** `libs/forms/tokenizer/src/lib/tokenizer/tokenizer.css`

- **Selector:** `mlv-tokenizer`
- **Change Detection:** `OnPush`
- **Extends:** `MlvSignalFormControlBase<MlvSelectOption<T>[]>`

#### Model (two-way binding)

| Name     | Type                   | Default |
| -------- | ---------------------- | ------- |
| `tokens` | `MlvSelectOption<T>[]` | `[]`    |

#### Inputs (own)

| Name              | Type                                        | Default                         | Description                                       |
| ----------------- | ------------------------------------------- | ------------------------------- | ------------------------------------------------- |
| `placeholder`     | `string`                                    | `''`                            | Input placeholder                                 |
| `showOverflow`    | `boolean`                                   | `true`                          | Show `+N more` overflow indicator                 |
| `maxVisible`      | `number \| null`                            | `null`                          | Max tokens shown (`null` = unlimited)             |
| `allowDuplicates` | `boolean`                                   | `false`                         | Allow identical token values                      |
| `createToken`     | `(v: string) => MlvSelectOption<T>`         | `v => ({ label: v, value: v })` | Transform input string → token                    |
| `splitFn`         | `((v: string) => string[] \| null) \| null` | `null`                          | Split input into multiple tokens (e.g., by comma) |

#### Inputs (from MlvSignalFormControlBase)

`disabled`, `label`, `hint`, `message`, `state`, `id`

#### Computed Signals

| Signal          | Description                              |
| --------------- | ---------------------------------------- |
| `visibleTokens` | Subset of tokens limited by `maxVisible` |
| `overflowCount` | Number of hidden tokens                  |

#### Host Bindings

```ts
host: {
  'class': 'mlv-tokenizer',
  '[class.mlv-tokenizer--disabled]': 'disabled()',
  '[class.mlv-tokenizer--focused]': 'focused()',
}
```

#### Content Children

- `tokenTemplate: contentChild(MlvTokenTemplate)` — optional custom token rendering

#### Key Methods

| Method                  | Description                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `focusInput()`          | Focus the text input                                                                         |
| `onInputEnter(event)`   | Parse input with `createToken` + optional `splitFn`; add tokens (deduplication); clear input |
| `onInputBackspace()`    | Remove last token if input is empty                                                          |
| `removeToken(token)`    | Remove a specific token                                                                      |
| `onTokenKeydown(event)` | Delegate to `FocusKeyManager` for token-to-token navigation                                  |

#### Template Summary

Form control wrapper → label → token list → each token rendered as `mlv-token` (with optional custom template via `tokenTemplate`) → overflow indicator (`+N more`) → text input.

---

### `MlvToken`

**File:** `libs/forms/tokenizer/src/lib/token/token.ts`
**Selector:** `mlv-token` | **Change Detection:** `OnPush`
**Implements:** `FocusableOption`

#### Inputs

| Name        | Type                       | Default |
| ----------- | -------------------------- | ------- |
| `value`     | `MlvSelectOption<unknown>` | —       |
| `removable` | `boolean`                  | `true`  |
| `disabled`  | `boolean`                  | `false` |

#### Outputs

| Name      | Type                               |
| --------- | ---------------------------------- |
| `removed` | `output<MlvSelectOption<unknown>>` |

#### Host Bindings

```ts
host: {
  'class': 'mlv-token',
  'role': 'option',
  '[attr.aria-selected]': 'true',
  '[class.mlv-token--disabled]': 'disabled()',
  '[tabindex]': 'disabled() ? -1 : 0',
}
```

#### Template (inline)

```html
<span class="mlv-token__content"><ng-content /></span>
@if (removable() && !disabled()) {
<button class="mlv-token__remove" (click)="onRemove($event)" aria-label="Remove" tabindex="-1">×</button>
}
```

---

## Directives

### `MlvTokenTemplate`

**Selector:** `[mlvTokenTemplate]`
**File:** `libs/forms/tokenizer/src/lib/token-template.ts`

Provides `templateRef: TemplateRef<MlvTokenTemplateContext<T>>`. Use as `contentChild(MlvTokenTemplate)` in the tokenizer.

---

## Interfaces

```ts
export interface MlvSelectOption<T = unknown> {
  label: string;
  value: T;
}

export interface MlvTokenTemplateContext<T = unknown> {
  $implicit: MlvSelectOption<T>;
}
```

---

## Usage Examples

```html
<!-- Basic tokenizer -->
<mlv-tokenizer [(tokens)]="tags" placeholder="Add tags..." />

<!-- With max visible + overflow -->
<mlv-tokenizer [(tokens)]="tags" [maxVisible]="3" [showOverflow]="true" />

<!-- Comma-split input -->
<mlv-tokenizer [(tokens)]="emails" [splitFn]="splitByComma" placeholder="email1, email2, ..." />

<!-- Custom token template -->
<mlv-tokenizer [(tokens)]="users">
  <ng-template mlvTokenTemplate let-option>
    <strong>{{ option.label }}</strong>
  </ng-template>
</mlv-tokenizer>

<!-- Reactive forms -->
<mlv-tokenizer [formControl]="tagsCtrl" placeholder="Add tags" />
```

```ts
splitByComma = (v: string) =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
```

---

## Dependencies

- `@angular/forms/signals` — signal-control contract
- `@angular/cdk/a11y` — `FocusKeyManager`, `FocusableOption`
- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase`, `MlvFormControlWrapper`, `MlvLabel`, `MlvHint`, `MlvMessage`
