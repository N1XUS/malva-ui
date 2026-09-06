---
# Library: tokenizer

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Tokenizer library (`@malva-ui/core/tokenizer`) provides a tag/token input component for managing a collection of labelled items. Users type text, press Enter (or a configurable split key) to create tokens, and can remove them. Supports overflow limiting, custom token templates, duplicate control, and all three Angular forms modes.

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

#### Models (two-way binding)

| Name     | Type                   | Default | Notes                                                           |
| -------- | ---------------------- | ------- | --------------------------------------------------------------- |
| `value`  | `MlvSelectOption<T>[]` | `[]`    | Canonical collection; what every Angular forms API reads/writes |
| `tokens` | `MlvSelectOption<T>[]` | `[]`    | Legacy alias of `value`, kept in sync in both directions        |

**Alias contract.** `value` and `tokens` are two views of one collection — bind
either, both, or neither:

- Bind **one side only** and the unbound alias adopts it. It never writes its `[]`
  default back over a seeded binding, and nothing is emitted to the consumer on
  first render (no phantom edit staged).
- Bind **both** and they stay pinned to the same array reference.
- On the rare flush where both sides change at once, **`value` wins** — it is the
  canonical surface.

Internally only the side that actually changed propagates (tracked against the
last reference the component published), which is what makes a one-sided binding
safe. Every internal commit (`Enter`, click-removal, Backspace deletion) sets both
models to the same array.

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

| Method                    | Description                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `focusInput()`            | Focus the text input (also disarms any Backspace chip-selection)                                                                                       |
| `onInputEnter(event)`     | Disarm, then parse input with `createToken` + optional `splitFn`; add tokens (deduplication); clear input                                              |
| `onInputBackspace(event)` | Empty-input Backspace: arm the last chip (first press), then remove-and-re-arm from the end (subsequent presses). See _Backspace chip-selection flow_. |
| `onInputDelete(event)`    | Delete parity: removes the armed chip and re-arms the new last one; no-op when nothing armed                                                           |
| `removeToken(token)`      | Remove a specific token                                                                                                                                |
| `onTokenKeydown(event)`   | Delegate to `FocusKeyManager` for token-to-token navigation                                                                                            |

#### Backspace chip-selection flow

Pressing **Backspace** in the text input **while the input is empty** does not immediately delete. Instead it follows a Gmail-style two-stage model, tracked by the `_armed` signal (visual-only selection — DOM focus stays in the input):

1. **First Backspace** → _arms_ the **last** token. The armed token renders its inner `mlv-chip` with `tone="primary"` and gets a `.mlv-token--armed` ring; **no deletion** occurs.
2. **Second (and each further) Backspace** → removes the armed (last) token and arms the new last one, walking deletion from the end **one token per press**.
3. Removing the final token leaves the input focused and **disarmed**.

**Delete** (`onInputDelete`) mirrors the second-Backspace behavior but only acts on an already-armed token.

**Disarm triggers** (any clears the selection): typing a character (`input` event), caret movement (`ArrowLeft`/`ArrowRight`/`Home`/`End`), `Enter`, blur, pointer interaction (`focusInput`), an external forms value write, and any **external** `[(tokens)]` change. Internal arm-driven deletions are distinguished via `_internalTokensRef`, so re-arming survives its own mutation.

This flow is **independent of** the token roving-focus model: `ArrowLeft`/`ArrowRight` on a DOM-focused token still navigate via `FocusKeyManager`, and **Backspace/Delete on a DOM-focused token** still removes that token directly (`MlvToken._onKeyRemove`).

**Screen-reader communication.** The armed token is announced through a **visually-hidden `aria-live="polite"` / `role="status"` region** (`.mlv-tokenizer__sr`, bound to the `_srMessage` signal) inside the tokens container. This live-region approach was chosen over `aria-activedescendant` deliberately: the token structure is a `role="list"` of `role="listitem"` (not a `listbox`/`option` combobox), so per `.claude/rules/accessibility.md` `aria-activedescendant` is not the appropriate pattern, and arming is a visual highlight while real focus never leaves the input. The region announces the armed token's label and clears on disarm.

#### Template Summary

Form control wrapper → label → `div[role="list"]` wrapping each token as `mlv-token[role="listitem"]` (with optional custom template via `tokenTemplate`) → overflow indicator (`+N more`) → text input → a visually-hidden `span.mlv-tokenizer__sr[aria-live="polite"][role="status"]` (Backspace-selection announcements). The `mlv-input` is a **sibling of** the list, never inside `role="list"`. `MlvTokenizer` wires a `FocusKeyManager` over the rendered tokens (Arrow keys navigate; roving tabindex keeps a single token in the tab order).

The `role="list"` container's `aria-label` falls back to the localized `MLV_TOKENIZER_I18N` **`selectedItems`** string (`"Selected items"` in the `en` pack) when the consumer provides no `label` input — it is no longer a hard-coded English literal. The `_i18n` signal (`inject(MLV_TOKENIZER_I18N)`) supplies both `addToken` (input aria-label) and `selectedItems` (list aria-label).

---

### `MlvToken`

**File:** `libs/core/tokenizer/src/lib/token/token.ts`
**Selector:** `mlv-token` | **Change Detection:** `OnPush` | **Encapsulation:** `None`

Driven by the parent `MlvTokenizer`'s `FocusKeyManager` (roving tabindex).
The token host is the single keyboard focus target; the inner `mlv-chip`
provides the visual chrome and mouse close affordance but is kept out of the tab
order (`[chipTabIndex]="-1"`).

#### Inputs

| Name        | Type                       | Default | Description                                                                                                                                                                                              |
| ----------- | -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`     | `MlvSelectOption<unknown>` | —       | The option this token represents                                                                                                                                                                         |
| `removable` | `boolean`                  | `true`  | Whether the token shows a remove affordance                                                                                                                                                              |
| `disabled`  | `boolean`                  | `false` | Disables the token (renamed from `isDisabled`)                                                                                                                                                           |
| `armed`     | `boolean`                  | `false` | Visual-only "selected" state — renders the inner chip with `tone="primary"` and a `.mlv-token--armed` ring. Driven by the tokenizer's empty-input Backspace flow; does not change tabindex/role/removal. |

#### Outputs

| Name      | Type                               |
| --------- | ---------------------------------- |
| `removed` | `output<MlvSelectOption<unknown>>` |

#### Host Bindings

```ts
host: {
  'class': 'mlv-token',
  'role': 'listitem',
  '[attr.aria-label]': '_ariaLabel()',            // the option label
  '[class.mlv-token--disabled]': 'disabled()',
  '[class.mlv-token--armed]': 'armed()',              // visual Backspace-selection
  '[attr.tabindex]': 'disabled() ? -1 : tabIndex()',  // roving tabindex signal
  '(keydown.backspace)': '_onKeyRemove($event)',
  '(keydown.delete)': '_onKeyRemove($event)',
}
```

- `role="listitem"` (the previous `role="option"` + unconditional `aria-selected="true"` were invalid outside a listbox and have been removed).
- Keyboard removal: **Backspace/Delete** on a focused token emits `removed`. Mouse removal is the chip's close (×) button.
- **`.mlv-token:focus-visible`** ring uses `--mlv-border-focus`.

#### Template (inline)

```html
<mlv-chip mlvDensity="compact" [chipTabIndex]="-1" [tone]="armed() ? 'primary' : 'default'" [closable]="removable() && !disabled()" [closeAriaLabel]="_closeAriaLabel()" [muted]="disabled()" (chipClose)="onRemove()">
  <ng-content />
</mlv-chip>
```

`_closeAriaLabel()` composes a descriptive accessible name for the inner chip's
close button as `"<Remove>: <label>"` (e.g. `"Remove: Angular"`), reusing the
localized "Remove" verb from `MLV_CHIP_I18N` so screen-reader users know which
token the close button removes. Falls back to the bare verb when the token has
no label.

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

## Direction (RTL)

- **Scoped, not per-document.** The token `FocusKeyManager` takes `withHorizontalOrientation(this._direction())`, where `_direction` is `elementDirection(host)` — **not** the global `direction()` — and the manager is rebuilt whenever the token set or the direction changes.
- So tokens inside a `[dir="rtl"]` subtree step with `ArrowLeft` = next and `ArrowRight` = previous while the document stays LTR, and an LTR island under an RTL document does not mirror. Reading the global direction here was the #147 defect in its `FocusKeyManager` form: chips laid out right-to-left, arrows still stepping left-to-right.
- The manager is not activated on focus, so the first arrow of any kind lands on index 0 before stepping begins.
- Regressions in `tokenizer.spec.ts` → _scoped [dir] keyboard mirroring_.

## Dependencies

- `@angular/forms/signals` — signal-control contract; reactive/ngModel compatibility is built into Angular
- `@angular/cdk/a11y` — `FocusKeyManager`, `FocusableOption`
- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase`, `MlvFormControlWrapper`, `MlvLabel`, `MlvHint`, `MlvMessage`

---

## Field surface (2026-08)

- Inherited `required` renders the `mlv-label` marker and is forwarded to the inner `mlv-input`.
- Inherited `ariaLabel` overrides the i18n `addToken` label on the inner input when supplied.
- Inherited `description` renders `<mlv-description>` below the control; the inner bare input receives `[ariaDescribedBy]="_describedBy()"`.
- The non-reactive public `messageId` string field is gone; `<mlv-message>` carries the base's `_messageId()`.

---

## Rendering identity (2026-09)

- The token `@for` tracks by **object identity** — `track token`, not `track token.value` (#185). A token's rendered row, its `MlvToken` instance and everything attached to that DOM node (`armed`, the roving `tabindex`, DOM focus, and any component state a consumer's `[mlvTokenTemplate]` holds) belong to **that option object** for as long as the object stays in the collection.
- Required because `allowDuplicates` deliberately permits several tokens sharing one `value`: `track token.value` handed Angular duplicate keys (NG0955), and the reconciler then paired old row _i_ with new item _i_ by key. Removing the **first** of three identical-valued tokens detached the row built for the **last** one and slid the survivors' content one row up — the model was always right (`removeToken` is `filter((t) => t !== token)`), only the rows were wrong.
- Safe because nothing on the value path re-wraps an element: `_syncModels` and `_setTokens` propagate one array reference to both model surfaces, `visibleTokens` is `all.slice(0, max)`, and `MlvSignalFormControlBase` declares the `value` model without cloning. A consumer keeping its option objects stable keeps its rows.
- **`createToken` must return a fresh object per call** (the default does). One returning a cached instance re-introduces duplicate keys — as does a consumer binding literally the same object twice (`[(tokens)]="[a, a]"`). Both are already ambiguous to the component, since `removeToken(a)` drops every match, so NG0955 there is an honest signal rather than a regression.
- `track $index` is the rejected alternative: it re-creates every row on an insertion at the front, discarding exactly the per-token state this contract protects.
- Regressions in `tokenizer-tracking.spec.ts` → _rendering identity with duplicate token values_.
