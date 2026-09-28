---
# Library: copy-to-clipboard

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library.

## Overview

`@malva-ui/core/copy-to-clipboard` provides the `<mlv-copy-to-clipboard>` component — an inline text wrapper that copies its projected content (or an explicit `value`) to the system clipboard on click, Enter, or Space. Visually the component is invisible chrome by default: it reads as regular inline text until the user hovers or focuses it, at which point a subtle background tint appears and a small copy icon fades in. On successful copy, the icon morphs from Copy to Check via a soft blur crossfade, the `(copied)` output fires, and a visually hidden `aria-live="polite"` region announces the confirmation.

---

## Public API

Exported from `libs/core/copy-to-clipboard/src/index.ts`:

| Export               | Kind      | Description                                                |
| -------------------- | --------- | ---------------------------------------------------------- |
| `MlvCopyToClipboard` | Component | `mlv-copy-to-clipboard` — inline copy-to-clipboard wrapper |

---

## Components

### `MlvCopyToClipboard`

**File:** `libs/core/copy-to-clipboard/src/lib/copy-to-clipboard/copy-to-clipboard.ts`
**Selector:** `mlv-copy-to-clipboard` | **Change Detection:** `OnPush` | **Encapsulation:** `None`

#### Inputs

| Name              | Type                     | Default                                                    | Description                                                                                                                                                                                                                            |
| ----------------- | ------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`           | `string \| undefined`    | `undefined`                                                | Explicit text to copy. When omitted, the component falls back to the trimmed `textContent` of the projected default slot.                                                                                                              |
| `copiedDuration`  | `number`                 | `2000`                                                     | Milliseconds the copied state remains active after a successful write.                                                                                                                                                                 |
| `ariaLabel`       | `string \| undefined`    | `undefined` → i18n `copyToClipboard` ("Copy to clipboard") | Base of the accessible name; the copied text is always appended after a colon — see _Accessible name_. Not a replacement name. An empty string counts as unset. A static host `aria-label` is not honoured (overwritten) — use this.   |
| `copiedAriaLabel` | `string`                 | `'Copied to clipboard'`                                    | Announced via the visually hidden `aria-live="polite"` region after a successful copy.                                                                                                                                                 |
| `disabled`        | `BooleanInput` (coerced) | `false`                                                    | Disables the copy action, sets `aria-disabled`, and removes the host from the tab order.                                                                                                                                               |
| `id`              | `string \| undefined`    | `undefined` → generated `mlv-copy-to-clipboard-N`          | Host id; the self-referencing `aria-labelledby` follows it. Set by a static `id="…"`, a bound `[id]` (per-row in `@for` too) or `id="{{…}}"`. Empty counts as unset. `[attr.id]` bypasses it and races the host binding — bind `[id]`. |

#### Outputs

| Name     | Type                       | Description                                                                        |
| -------- | -------------------------- | ---------------------------------------------------------------------------------- |
| `copied` | `OutputEmitterRef<string>` | Emits the exact string that was written to the clipboard after a successful write. |

#### Public Properties

| Property   | Type              | Description                                                                                                              |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `isCopied` | `Signal<boolean>` | Read-only signal reflecting the current copied state — useful for template-driven UI that reacts to the transient state. |

#### Methods

| Method   | Returns         | Description                                                                                                                                                                                                                                                          |
| -------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `copy()` | `Promise<void>` | Writes the resolved value to the clipboard, flips `isCopied()` to true, emits `copied`, and schedules the auto-reset timer. No-op when `disabled` is true or the resolved value is empty. Errors are swallowed silently (the idle state stays unchanged on failure). |

#### Host Bindings

```ts
host: {
  'class': 'mlv-copy-to-clipboard',
  '[class.mlv-copy-to-clipboard--copied]': 'isCopied()',
  '[class.mlv-copy-to-clipboard--disabled]': 'disabled()',
  'role': 'button',
  '[attr.id]': '_hostId()',                          // `id` input, else generated (#326)
  '[attr.tabindex]': 'disabled() ? -1 : 0',
  '[attr.aria-label]': '_computedAriaLabel()',       // always; "<base>:" while `value` is unset
  '[attr.aria-labelledby]': '_ariaLabelledBy()',     // "<host id> <id>-content" while `value` is unset (#326)
  '[attr.aria-disabled]': 'disabled() || null',
  '(click)': 'copy()',
  '(keydown.enter)': 'copy(); $event.preventDefault()',
  '(keydown.space)': 'copy(); $event.preventDefault()',
}
```

### Accessible name

Both resolved from `ariaLabel` (default i18n "Copy to clipboard"):

| `value`          | Host carries                                                               | Name                                       |
| ---------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| unset / `null`   | `aria-label="<base>:"` + `aria-labelledby="<host id> <id>-content"` + `id` | "Copy to clipboard: " + projected text     |
| non-empty string | `aria-label` + `id` (names nothing here)                                   | "Copy to clipboard: " + `value`            |
| `''`             | `aria-label` + `id` (names nothing here)                                   | "Copy to clipboard" (base only, unchanged) |

- Unset path (#326, D24): the host references **itself**, then `.mlv-copy-to-clipboard__content`. An element met while traversing `aria-labelledby` is not traversed again, so the self-reference contributes the host's own `aria-label` (accname 2B → 2C) and the content its text; the name follows the projected text live, with no attribute rewrite, and never picks up the icon, tooltip or live region.
- The one host in the library with **both** naming attributes, deliberately: the `aria-label` is read through `aria-labelledby`, not competing with it.
- The prefix is an attribute, never a node: a text prefix leaked into the `textContent` of the host and every ancestor (read by `provideMlvPageRouteFocus`, `mlvTitle`, menu typeahead) — review round 1; a hidden textless span carrying the `aria-label` named the button "0042" in Firefox 146, which ignores the `aria-label` of a hidden referenced node — review round 2. Pinned by the _keeps the prefix out of textContent_ spec; the spec helper takes a hidden referenced node's text only, so a hidden prefix goes red.
- Host id: `_hostId` = `computed(() => id() || generated)`, `mlvNextId('mlv-copy-to-clipboard')`; never `null`, which would remove the attribute. A static `id`, a bound `[id]` and `id="{{…}}"` all feed the `id` input, so a per-row `@for` id lands and a changing one moves the self-reference with it (review round 3: before the input, a bound `[id]` lost the race to the host binding). A bound `[id]` is now type-checked: a number or `string | null` expression fails `strictTemplates` (TS2322), where the old DOM binding compiled. Residuals: `[attr.id]` bypasses the input and races the host binding, last change wins (measured) — first render drops the consumer's id, a later change of it leaves the self-reference dangling (name = projected text only) — bind `[id]`; a `createComponent(…, { hostElement })` root host's pre-set `id` feeds no input and is overwritten — `setInput('id', …)`.
- Native names, rendered markup of `<h1>Order <mlv-copy-to-clipboard><code>0042</code></…></h1>`: Chromium 145 (CDP AX tree) and Firefox 146 (Marionette `GetComputedLabel`) both → button "Copy to clipboard: 0042" (generated or static id, idle or copied; "Copy the order number: 0042" with that `ariaLabel`); h1 `textContent` "Order 0042". h1 accessible name differs by engine: Chromium "Order Copy to clipboard: 0042", Firefox "Order Copy to clipboard:". WebKit unmeasured (native WebKit needs `safaridriver --enable`).
- `ariaLabel` uses `||`: an empty string falls back to the i18n base, as on `mlv-stepper` / `mlv-breadcrumb` (before, `ariaLabel=""` emitted `aria-label=""` or `": <value>"`).
- Migration: `docs/migrations/2026-09-accessible-name-sources.md`.
- Before #326 the unset path wrote `aria-label="Copy to clipboard"`, which replaces subtree text — the projected text was never in the name (WCAG 2.5.3 Label in Name; a speech-input user saying the visible text could not activate it).
- `value` path: the name is unchanged by #326 and carries `value`, not the visible text; the host still gains its `id`, because the `[attr.id]` binding is unconditional — every copy host carries one, and generated-id snapshots of `value` copies shift too. Keeping the visible text inside it (in `value` or in `ariaLabel`) is the consumer's call — docs example 2 says so.
- `ariaLabel` stays a **base**, not an override, unlike `mlv-progress` (explicit `ariaLabel` wins there): this API documents it as the prefix, and dropping the text would fail 2.5.3.
- `copy()` with no `value` reads `.mlv-copy-to-clipboard__content`'s trimmed `textContent`, not the host's — the host also holds the live region, so a copy during the copied window used to write `"<text> Copied to clipboard"` (fixed with #326; pinned by the rapid-repeat spec).
- Pinned by `copy-to-clipboard.spec.ts` § _accessible name_ and the a11y sweeps.

---

## Template Structure

```html
<span #content class="mlv-copy-to-clipboard__content" [id]="_contentId">
  <ng-content />
</span>
<span class="mlv-copy-to-clipboard__indicator" [mlvTooltip]="isCopied() ? 'Copied' : 'Copy'" tooltipPlacement="top" aria-hidden="true">
  <svg lucideCopy class="mlv-copy-to-clipboard__icon mlv-copy-to-clipboard__icon--idle" [size]="12" />
  <svg lucideCheck class="mlv-copy-to-clipboard__icon mlv-copy-to-clipboard__icon--success" [size]="12" />
</span>
<span class="mlv-copy-to-clipboard__live" aria-live="polite"> @if (isCopied()) { {{ copiedAriaLabel() }} } </span>
```

The indicator icon stack is decorated with `[mlvTooltip]` from `@malva-ui/core/tooltip` so the small icon gets a discoverable "Copy" label on hover, flipping to "Copied" in the success state.

---

## CSS Classes

| Class                                   | Description                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `.mlv-copy-to-clipboard`                | Root block — inline-flex wrapper with zero-inset hover tint                                     |
| `.mlv-copy-to-clipboard__content`       | Span wrapping the projected default slot                                                        |
| `.mlv-copy-to-clipboard__indicator`     | Relatively-positioned ~0.875rem square holding the two icons                                    |
| `.mlv-copy-to-clipboard__icon`          | Absolutely-positioned icon inside the indicator                                                 |
| `.mlv-copy-to-clipboard__icon--idle`    | Copy icon layer (visible in idle state)                                                         |
| `.mlv-copy-to-clipboard__icon--success` | Check icon layer (visible in copied state), colored with `--mlv-text-positive`                  |
| `.mlv-copy-to-clipboard__live`          | Visually hidden `aria-live="polite"` announcement region                                        |
| `.mlv-copy-to-clipboard--copied`        | Success state modifier — crossfades the two icons with a blur bridge                            |
| `.mlv-copy-to-clipboard--disabled`      | Disabled modifier — `--mlv-text-disabled` ink on host + content (#366), disables pointer events |

---

## Motion Design

The component follows Emil Kowalski's motion principles:

- **Invisible by default.** The host has no visible chrome until hover or focus — the component reads as prose text.
- **Hover tint only on fine pointers.** The hover background reveal is gated behind `@media (hover: hover) and (pointer: fine)` so touch devices never stick with a phantom hover state. `:focus-visible` reveals the tint unconditionally so keyboard users always see it.
- **Blur crossfade between states.** The Copy and Check icons are absolutely stacked inside the indicator. Transitioning from idle to copied crossfades them while briefly applying `filter: blur(2px)` and opposing `transform: scale(...)` values — a soft bridge that hides the visual seam between the two glyphs.
- **Press feedback.** `:active` applies `transform: scale(0.97)` so the entire inline chunk depresses slightly on click.
- **Custom easing.** Uses `var(--mlv-ease-out-strong)` (`cubic-bezier(0.23, 1, 0.32, 1)`) for every transition (no `transition: all`, no `ease-in`).
- **Reduced motion.** Under `@media (prefers-reduced-motion: reduce)` the scale and blur transforms drop out, leaving only opacity crossfade.
- **Content fade follows the indicator in RTL** (#341). The indicator sits at the inline end (`inset-inline-end`), and so does the `__content` mask that fades text under it on hover / focus / copied. `mask-position` and gradient direction have no logical keywords, so both edge layers are placed by the sign `d` = `--mlv-inline-direction` (inline-end revealed at `calc(50% + (50% + var(--mlv-copy-to-clipboard-fade-extension)) * d)`) and the gradients use `mixins.inline-distance(±90deg)` — the `mlv-fade` technique. Before, the fade stayed on the physical right while the RTL indicator sat on the left. LTR values unchanged; `copy-to-clipboard-styles.spec.ts` evaluates both directions per state. `dir="auto"` is transparent to `--mlv-inline-direction` (`.claude/rules/rtl.md`), so under a `dir="auto"` that resolves to RTL the fade still sits at the physical right while the `inset-inline-end` indicator moves to the left.

---

## Accessibility

- Host has `role="button"`, `tabindex="0"` (or `-1` when disabled) and an accessible name that always ends in the copied text — see _Accessible name_.
- Activation is supported via mouse click, `Enter`, and `Space`. `Space` calls `preventDefault()` to suppress page scroll.
- The two absolutely-positioned icons are wrapped in a single `aria-hidden="true"` container, so screen readers do not see the "Copy/Check" SVGs as extra content.
- A visually hidden `aria-live="polite"` region exposes the `copiedAriaLabel()` text for the duration of the copied state, giving screen-reader users an unambiguous confirmation.
- `:focus-visible` shows an outline using `--mlv-border-focus` and reveals the hover tint so keyboard users see the same affordance as hover users.
- When `disabled`, the host reflects `aria-disabled="true"` and copy is a no-op.

---

## Usage Examples

```html
<!-- Basic inline usage -->
<p>Your API key is <mlv-copy-to-clipboard>sk_live_abc123xyz</mlv-copy-to-clipboard>.</p>

<!-- Decouple visible label from copied payload -->
<mlv-copy-to-clipboard [value]="orderId">#0042</mlv-copy-to-clipboard>

<!-- Extended copied window -->
<mlv-copy-to-clipboard [copiedDuration]="4000">pnpm add @malva-ui/core</mlv-copy-to-clipboard>

<!-- Wire to toast -->
<mlv-copy-to-clipboard [value]="webhookUrl" (copied)="onCopied($event)"> hooks.example.com </mlv-copy-to-clipboard>

<!-- Disabled -->
<mlv-copy-to-clipboard disabled>cannot copy</mlv-copy-to-clipboard>
```

---

## Dependencies

- `@angular/core` `[@angular/core_VERSION_PLACEHOLDER]` — `Component`, `inject`, `input`, `output`, `signal`, `computed`, `DestroyRef`, `ElementRef`
- `@angular/cdk/coercion` `[@angular/cdk_VERSION_PLACEHOLDER]` — `BooleanInput`, `coerceBooleanProperty`
- `@lucide/angular` `[@lucide/angular_VERSION_PLACEHOLDER]` — `LucideCopy`, `LucideCheck`
- `@malva-ui/core/tooltip` (workspace peer) — `MlvTooltip` for the indicator hover label

---

## File Structure

```
libs/core/copy-to-clipboard/src/
  index.ts                                     — public API barrel
  test-setup.ts                                — Vitest setup
  lib/
    copy-to-clipboard/
      copy-to-clipboard.ts                     — MlvCopyToClipboard
      copy-to-clipboard.html                   — template
      copy-to-clipboard.scss                   — BEM styles, hover reveal, blur crossfade
      copy-to-clipboard.spec.ts                — unit tests
      copy-to-clipboard-styles.spec.ts         — compiled-CSS mask geometry, LTR + RTL
```

## Disabled surface (2026-09, #366)

- `--disabled`: host `color` and `--mlv-copy-to-clipboard-content-color` → `--mlv-text-disabled` (content and indicator read it), no opacity.
- Spec: `copy-to-clipboard-disabled-styles.spec.ts`.
- Guard: `styles:check-disabled-surface` (`scripts/check-disabled-surface.mjs`, a `styles:lint` dependency) fails any other disabled `opacity` and any `--state-success/warning/info` rule.
