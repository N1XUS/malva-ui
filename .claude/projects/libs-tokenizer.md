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

Focus and touched (#347):

- The template binds the inner `mlv-input`'s `(inputFocus)` / `(inputBlur)` outputs to `onInputFocus()` / `onInputBlur()`.
- They used to be `(focus)` / `(blur)` on the `<mlv-input>` element. Those events do not bubble, so neither ever fired in a browser (measured): `focused()` was never `true`, the `--focused` ring never showed, and focus leaving never touched.
- `onInputFocus()` sets `focused()`. `onInputBlur()` only disarms — now reachable in a browser, so a token armed by Backspace disarms when the input loses focus.
- `touch` and clearing `focused()` belong to the base's `_reportTouchOnFocusLeave({ enabled: () => !computedDisabled() })`. So input ↔ token moves do nothing, and leaving the tokenizer touches once.
- Disabled while the input has focus: `@if (!computedDisabled())` removes the input, and Firefox / WebKit fire no `focusout` for a removed element, so a constructor effect clears `focused()` and touches once when `computedDisabled()` turns `true` with `focused()` set. The `enabled` gate drops the `focusout` Chromium does fire for the removal, so every engine reports once.
- The clear button (`_onClear`) still touches on clear, like every `clearable` control's (#301); follow-up.
- Gap: a token focused from outside, never through the input, does not set `focused()`.
- Spec: `tokenizer-touched.spec.ts` (focus ring, input ↔ token, leaving, disable with focus inside, Chromium's extra `focusout`).

#### Content Children

- `tokenTemplate: contentChild(MlvTokenTemplate)` — optional custom token rendering

#### Key Methods

| Method                    | Description                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `focusInput()`            | Focus the text input (also disarms any Backspace chip-selection)                                                                                       |
| `onInputEnter(event)`     | Disarm, then parse input with `createToken` + optional `splitFn`; add tokens (deduplication — see _Bulk entry and dedupe_); clear input                |
| `onInputBackspace(event)` | Empty-input Backspace: arm the last chip (first press), then remove-and-re-arm from the end (subsequent presses). See _Backspace chip-selection flow_. |
| `onInputDelete(event)`    | Delete parity: removes the armed chip and re-arms the new last one; no-op when nothing armed                                                           |
| `removeToken(token)`      | Remove a specific token                                                                                                                                |
| `onTokenKeydown(event)`   | Delegate to `FocusKeyManager` for token-to-token navigation                                                                                            |

#### Bulk entry and dedupe

`onInputEnter` is the only path that adds tokens. With no `splitFn` it commits one value; with a `splitFn` (`(v) => v.split(',')`) it commits the whole entry at once, which is how a pasted list becomes many tokens.

- `createToken` runs **exactly once per value, in order**, whether or not the result survives dedupe — it is consumer-supplied and may be impure.
- Dedupe compares the **created** `token.value`, not the raw text, so normalisation inside `createToken` (trim, lower-case) participates.
- A value is rejected when it matches an existing token **or** a value accepted earlier in the same entry. Both checks are skipped entirely when `allowDuplicates` is set.
- Equality is **`===`**, unchanged. So `NaN` never collapses (not even against itself), `-0` ties `0`, and a non-primitive `T` compares by reference — a `createToken` minting a fresh object per call never dedupes, which is what `apps/docs`' email example (`value: { email: value }`) relies on.
- Nothing is committed when every value is rejected: `tokens` / `value` keep their array reference and no form write happens.

Cost. The existing-token half of the dedupe can answer "is this value already a token?" two ways, and a long entry uses both. It starts with a scan that stops at its first match; once that scanning has cost as much as an index would — **and** enough values remain for an index to repay itself — the rest of the entry goes through `valueIndex` from `@malva-ui/core/dropdown`, the same "is this value among those?" primitive `mlv-select` and `mlv-combobox` use. `valueIndex` is also what keeps the comparison `===`: it keys on a `Map` only while the values it has walked past cannot tell `===` and SameValueZero apart, and reverts to the pairwise scan the moment one can. The within-batch half is a `Set` of accepted values, filled as the loop runs and consulted at every batch size, which turns the old rescan of the pending tokens from `O(k^2)` into `O(k)`; `NaN` is never admitted to it, so `Set` membership stays an exact stand-in for `===`.

**The switch is priced in comparisons, not gated on the batch size.** A scan that matches at position `i` spends `i + 1` comparisons and one that matches nothing spends all `n`; an index spends one `Map` insertion per token walked, measured at about eighteen comparisons each (`INDEX_COST_RATIO`), so a build costs eighteen full scans and every query after it is free. Both are per element, so the exchange rate does not move with `n`. `values.length` cannot see any of that — it cannot tell a value that matches `current[0]` from one that matches nothing — and a `values.length > 32` gate therefore bought an index for batches that never ran a single full scan, at up to **17x** the loop it replaced. Both conditions are needed: the first (ski-rental) keeps an entry from paying for an index it will not use, the second keeps it from buying one with nothing left to spend it on. `INDEX_COST_RATIO` is a **speed knob only** — both arms answer the same question the same way, and the within-batch half never consults it, so retuning it cannot change which tokens an entry adds; `tokenizer.spec.ts` brackets it to 2..19 without naming it, and every behavioural spec there stays green at 0, 1, 20, 200 and 100000.

Measured on this loop (node 24, one dedicated process per shape and cell so V8 never tiers one against the other's feedback, 21 timed rounds, minimum reported, `n = 2000` existing tokens). `main` is the two nested scans this replaces; the last column is what a `values.length > 32` gate measured on the same cell.

| batch shape                                              |   k | main      | now      | ratio            | batch-size gate  |
| -------------------------------------------------------- | --: | --------- | -------- | ---------------- | ---------------- |
| the same new value repeated                              | 500 | 2018.6 us | 125.3 us | **16.1x faster** | 59.7 us          |
| every value new — the pasted-list case #19 was filed for | 500 | 1677.0 us | 115.9 us | **14.5x faster** | 72.0 us          |
| half new, half already present                           | 500 | 1297.7 us | 98.6 us  | **13.2x faster** | 57.7 us          |
| every value already present, spread through `current`    | 500 | 909.3 us  | 120.2 us | **7.6x faster**  | 55.4 us          |
| every value new                                          |  33 | 93.4 us   | 98.3 us  | 1.05x            | 57.2 us          |
| a re-paste that all matches `current[0]`                 | 500 | 1.78 us   | 1.85 us  | 1.04x            | 3.08 us (1.73x)  |
| ditto, plus one new value at the end                     |  33 | 2.88 us   | 2.65 us  | 0.92x            | 50.07 us (17.4x) |
| a `NaN` among the existing token values                  |  33 | 51.0 us   | 41.0 us  | 0.80x            | 72.8 us (1.43x)  |
| a `NaN` among the existing token values                  | 256 | 414.3 us  | 495.7 us | 1.20x            | 479.5 us (1.16x) |
| a `NaN` among the existing token values                  | 500 | 880.2 us  | 995.4 us | 1.13x            | 964.0 us (1.10x) |

The last two columns are the trade. A batch-size gate is two to fourteen times faster on the four wins at the top — it indexes from the first value where this indexes after about eighteen scans' worth — and seventeen times slower on the head-matching row, where it buys an index no value in the batch will use. Across a 484-cell sweep (eleven batch shapes x `n` in 20…2000 x `k` in 1…500), every cell added exactly the tokens `main` added, and every cell that showed a ratio above 1.3x was re-measured one at a time on an unloaded machine (the sweep shares a runner, so a contended cell reads slow). Twenty-five of the twenty-six fell to 1.30x or below; the one that survived is **1.35x**, a 500-value re-paste all matching `current[0]` against only twenty existing tokens, which is +0.7 us — the one place the pricing misjudges, because it charges the past honestly and then assumes the values still to come cost like the ones already seen, where here they each cost one comparison and there is nothing for an index to save. The largest absolute regression anywhere in the sweep is the `NaN` shape below, at +115 us.

The `NaN` rows are the one shape that can still buy an index and get nothing back. A `NaN` anywhere among the existing token values makes `valueIndex` latch and answer every query with a pairwise scan, so the build is pure waste. It is reachable — a numeric `createToken` plus one unparseable entry — and sticky, since the `NaN` stays a token. **This is a real regression, not a rounding error:** one walk of `current`, **+81 us at k = 256 and +115 us at k = 500** for `n = 2000`. What the gate buys is that it is bounded and no longer cheap to trigger: the entry never builds the index until it has already spent that much scanning, and at `k = 33` — where the batch-size gate paid the walk and lost 43% — it now never builds one at all and comes out ahead. Removing the waste entirely needs `valueIndex` to expose whether it has latched, which is `@malva-ui/core/dropdown`'s API to change — left for a follow-up rather than widened into this ticket.

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
- `@malva-ui/core/input` — `MlvInput`, the text field the tokenizer wraps
- `@malva-ui/core/dropdown` — **runtime** since the bulk-entry dedupe (2026-09): `valueIndex` + the `MlvValueIndex` type, plus the `MlvSelectOption<T>` shape a token is. It was a type-only import before, so the built `fesm2022` bundle now carries a real `from '@malva-ui/core/dropdown'`
- `@malva-ui/cdk/utils` — `MlvRtlService` (scoped direction for the token `FocusKeyManager`) and `defaultCompareWith`, the identity comparator `valueIndex` has to _recognise_ for its keyed fast path
- `@malva-ui/i18n` — `MLV_TOKENIZER_I18N`

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

## Naming from a projected `<mlv-label>` (2026-09, #197)

`MlvTokenizer` reports `_externalLabelStrategy()` **`'native'`** while enabled:
`id()` is forwarded to the inner `mlv-input`'s native `<input>`, so an
`<mlv-label>` projected beside it into `mlv-form-field` names it with a plain
`for`. A disabled tokenizer renders no input at all and reports `'none'`.

The inner input's `aria-label` falls back to the non-null `_i18n().addToken`,
and `aria-label` **outranks** `<label for>` in the accessible-name computation —
so the fallback is now suppressed through the base's `_externallyLabelled()`
whenever the field's label names the control. Without that the `for` would buy
click-to-focus and no name. Standalone, and in a field with no projected label,
the i18n fallback still applies.

Full contract, the `'native'` vs `'aria'` split and the dev-mode warning:
`.claude/projects/libs-form-utils.md` → _`MlvFormField` → Accessible name_.

## Its own label (2026-09, #216)

The `<mlv-label>` `MlvTokenizer` renders from its own `label` input binds
`[for]="_ownLabelFor()"` instead of `[for]="id()"`, so it follows the same
enabled / disabled split as the projected case. Enabled, nothing changes.
**Disabled** the inner `mlv-input` is not rendered, so the `for` is now absent
rather than pointing at an id no element carries; a disabled control is not a
tab stop and no name is due.

## Overflow caption colour (2026-09, #302)

- `.mlv-tokenizer__overflow` ("+N more") paints `--mlv-text-secondary`.
- Was the literal `#666` — frozen to light: 5.5:1 there, 2.9–3.1:1 on the dark field and page. Now ≥ 7.5:1 light, ≥ 8.5:1 dark (`tone-contrast.spec.mjs`).
- The placeholder dropped its `#999` fallback behind `--mlv-text-tertiary` (the token is always declared).

## Clear button (2026-09, #301)

- `clearable` renders the wrapper's X while at least one token exists and the tokenizer is neither readonly nor disabled. Before #301 nothing was bound to the wrapper's `(clear)`, so the X did nothing.
- Handler: protected `_onClear()`, gated on `_canWrite()` **up front** rather than through `_write` — a clear writes both models (`_setTokens([])` sets `tokens` then `value`) and must not touch the armed selection either. It disarms, empties both models and emits `touch`. Draft text in the input is not the value and is left alone.
- The inner `mlv-input`'s public `clearValue()` (called after a token is committed) stays an ungated application API — which is why `mlv-input`'s own clear button got a separate gated handler rather than a gate inside `clearValue()`.
- Scope: the clear button only. Readonly on typing / Backspace / token removal is #402.
- Spec: `tokenizer-clear.spec.ts`.

## Disabled surface (2026-09, #366)

- `.mlv-token--disabled` multiplied an already muted chip by 0.4; now `.mlv-token.mlv-token--disabled .mlv-chip` (0,3,0, above the chip's `--muted.--tone-*`) sets `--mlv-chip-bg: --mlv-background-disabled`, `--mlv-chip-color: --mlv-text-disabled`, `--mlv-chip-border: transparent`. The field surface comes from `mlv-form-control-wrapper`.
- Spec: `token-disabled-styles.spec.ts`.
- Guard: `styles:check-disabled-surface` (`scripts/check-disabled-surface.mjs`, a `styles:lint` dependency) fails any other disabled `opacity` and any `--state-success/warning/info` rule.
