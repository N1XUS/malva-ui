# 2026-09 — stepper, breadcrumb and copy-to-clipboard take their name from the right element

Applies to `@malva-ui/core/stepper` (`MlvStepper`), `@malva-ui/core/breadcrumb`
(`MlvBreadcrumb`) and `@malva-ui/core/copy-to-clipboard`
(`MlvCopyToClipboard`). Fixes #326 (owner ruling D24 for copy-to-clipboard).

**Breaking — behaviour, plus one compile-time case** (a bound `[id]` on the
copy, §3). Nothing is renamed or removed, and no existing input is retyped.
Every selector, `exportAs`, output, i18n key and BEM class is unchanged. Two
inputs are added, both optional: `MlvBreadcrumb.ariaLabel` and
`MlvCopyToClipboard.id`. What moves is **which element carries the accessible
name** and **which attribute carries it**, and every copy host now carries an
`id`. On `0.x` the `!` releases as `0.2.0` (VERSIONING §7).

| Component         | VERSIONING §3 row                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| copy-to-clipboard | 112 for ARIA at an unchanged API (every host gains an `id`, with or without `value`; with `value` unset, also a self-referencing `aria-labelledby`; an empty `ariaLabel` now counts as unset) + 115 for the new `id` input + 109 for its compile-time half: a bound `[id]` used to reach the DOM property, which templates never type-check, and now reaches a `string \| undefined` input (§3) |
| stepper           | 117 for `ariaLabel` (its JSDoc said screen readers announced it; none did) + 112 for a static host `aria-label` or `aria-labelledby`, which now names the tablist instead                                                                                                                                                                                                                       |
| breadcrumb        | 115 for the new `ariaLabel` input + 112 for a static host `aria-label`, which is now kept instead of overwritten                                                                                                                                                                                                                                                                                |

## 1. What changed

### copy-to-clipboard: the name carries the projected text

With no `value`, the host wrote `aria-label="Copy to clipboard"`. An
`aria-label` replaces the element's text in the name, so the projected text —
the words on screen — was never part of it. A speech-input user saying "click
sk_live_abc123" could not activate the control (WCAG 2.5.3, Label in Name). The
old `ariaLabel` JSDoc promised the opposite: that projected text was appended.

Now, with no `value`, the host names itself through `aria-labelledby`, and the
first id it references is **its own**:

| `value`          | Host carries                                                                       | Name                                        |
| ---------------- | ---------------------------------------------------------------------------------- | ------------------------------------------- |
| unset / `null`   | `aria-label="<base>:"` + `aria-labelledby="<host id> <id>-content"` + `id` **new** | "Copy to clipboard: " + the projected text  |
| non-empty string | `aria-label` (as before) + `id` **new**                                            | "Copy to clipboard: " + `value` (unchanged) |
| `''`             | `aria-label` (as before) + `id` **new**                                            | "Copy to clipboard" (unchanged)             |

`<host id>` is the host's own `id`, taken from the new optional `id` input —
which a static `id="…"`, a bound `[id]` and an interpolated `id="{{…}}"` all
set, a per-row id inside `@for` included, and which the self-reference follows
when it changes. Unset or empty, the host gets a generated
`mlv-copy-to-clipboard-N`, a **new** attribute on every copy — with a `value`
too, where it names nothing and the accessible name is unchanged. `<id>-content`
is `.mlv-copy-to-clipboard__content`, which gains an `id`. An element met while
traversing `aria-labelledby` is not traversed again, so the self-reference
contributes the host's own `aria-label`, `"<ariaLabel>:"` (accname step 2B,
then 2C), and the content contributes its text. This is the one host in the
library that carries both naming attributes, and the exception is deliberate:
the `aria-label` does not compete with `aria-labelledby`, it is read through
it. The prefix is an attribute and not text on purpose: a text node would
enter the `textContent` of the host and of every ancestor, which
`provideMlvPageRouteFocus`, `mlvTitle` and menu typeahead read. A hidden,
textless prefix node carrying the `aria-label` — the first shape tried — named
the button "0042" in Firefox 146, which ignores the `aria-label` of a hidden
node an `aria-labelledby` references. The host's and its ancestors'
`textContent` and `innerText` are exactly what they were.

Measured natively on the rendered markup of
`<h1>Order <mlv-copy-to-clipboard><code>0042</code></mlv-copy-to-clipboard></h1>`,
in Chromium 145 (CDP accessibility tree) and Firefox 146 (Marionette
`GetComputedLabel`, which reads Firefox's own accessible name):

| Call site                                             | Chromium 145 button                   | Firefox 146 button                    |
| ----------------------------------------------------- | ------------------------------------- | ------------------------------------- |
| no `value` — generated or static `id`, idle or copied | "Copy to clipboard: 0042"             | "Copy to clipboard: 0042"             |
| `ariaLabel="Copy the order number"`                   | "Copy the order number: 0042"         | "Copy the order number: 0042"         |
| `[value]="'ORDER-0042-7F9X2'"`                        | "Copy to clipboard: ORDER-0042-7F9X2" | "Copy to clipboard: ORDER-0042-7F9X2" |
| before this change, no `value`                        | "Copy to clipboard"                   | "Copy to clipboard"                   |

WebKit is unmeasured: native WebKit needs `safaridriver --enable`, an admin
setting. The heading's `textContent` stays "Order 0042" in both engines. Its
accessible name is computed from content, and so from the child button's name
(accname recursion, not `textContent`), and differs by engine: Chromium's is
"Order Copy to clipboard: 0042" (was "Order Copy to clipboard"), Firefox's
"Order Copy to clipboard:". The button's name follows the projected text as it
changes, with no attribute rewrite, and never includes the icon, the tooltip or
the live region.

`ariaLabel` stays a **prefix**, as its JSDoc always said: "Copy API key" gives
`Copy API key: sk_live_…`. This is not `mlv-progress`, where an explicit
`ariaLabel` replaces the generated name. Here the documented contract is a base
plus the text, and dropping the text would bring back the 2.5.3 failure. An
empty string counts as unset, as on the stepper and the breadcrumb: `ariaLabel=""`
used to write `aria-label=""` (ignored, so the name fell back to the bare
content) or, with a `value`, `aria-label=": <value>"`; both now read "Copy to
clipboard: …".

A static `aria-label` written on `<mlv-copy-to-clipboard>` is still not honoured
— the host binding overwrites it, before and after. Use `ariaLabel`.

**Residuals — the host id.** `[attr.id]` bypasses the input and races the
host's own `id` binding, the last value to change winning (measured): the
first render replaces the consumer's id with the generated one, and a later
change of the bound value replaces the generated one and leaves the
self-reference dangling, so the name drops to the projected text alone.
**Do:** bind `[id]` instead. For a root host from
`createComponent(MlvCopyToClipboard, { hostElement })`, an `id` already on the
host element feeds no input, so it is overwritten with the generated one.
**Do:** pass it through `setInput('id', …)`.

**Adjacent fix (patch):** with no `value`, `copy()` read the **host's**
`textContent`. The host also holds the live region, so pressing again while
"Copied to clipboard" was showing wrote `"sk_live_abc123 Copied to clipboard"`
to the clipboard. It now reads `.mlv-copy-to-clipboard__content`.

### stepper: the name lands on the tablist

The host bound `[attr.aria-label]="ariaLabel()"` on `<mlv-stepper>`, a roleless
custom element. ARIA prohibits `aria-label` there and no screen reader announces
it; axe reports that only as `incomplete`, which is why every sweep stayed green.
The `role="tablist"` inside — the widget that takes a name — had none. Both
tablists (horizontal, and the `display: contents` vertical one) now carry the
name, and the host carries none.

A static `aria-label` written on `<mlv-stepper>` was **removed** by that binding
when `ariaLabel` was unset (Angular removes an attribute bound to `null` on the
first pass) and overwritten when it was set. A static `aria-labelledby` stayed
on the host, where it is prohibited too and named nothing. Now both are read
once through `HostAttributeToken`, stripped from the host and written on the
tablists. The tablist carries one naming attribute: `ariaLabel` wins, then a
static `aria-labelledby`, then a static `aria-label`. An empty string counts as
unset.

**Residual — `createComponent(MlvStepper, { hostElement })`.** For a root host,
`HostAttributeToken` is `null`, so a pre-set `aria-label` or `aria-labelledby`
is neither moved nor stripped: it stays on the host and names nothing (before,
the `null` binding removed a pre-set `aria-label`). There is no DOM-read
fallback, because on hydration it would re-capture a server-written bound
value. **Do:** pass the name through `setInput('ariaLabel', …)` and leave the
attribute off the host element.

### breadcrumb: an `ariaLabel` input, and a static `aria-label` survives

The host bound `aria-label` to the i18n "Breadcrumb" unconditionally, so a
static `aria-label` on `<nav mlvBreadcrumb>` was overwritten, and every trail on
a page was the same "Breadcrumb" landmark (axe `landmark-unique`). The new
`ariaLabel` input names the landmark. The order is: `ariaLabel` → a static host
`aria-label` → i18n `label`. An empty string counts as unset. The name stays on
the `<nav>`, which has a native landmark role, so nothing is moved.

**Residual — `createComponent(MlvBreadcrumb, { hostElement })`.** For a root
host, `HostAttributeToken` is `null`, so a pre-set `aria-label` is overwritten
with `ariaLabel` or the i18n label, as before. **Do:** pass it through
`setInput('ariaLabel', …)`.

## 2. Before / after

| Call site                                                          | Before                                                                    | After                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `<mlv-copy-to-clipboard>sk_live_…</mlv-copy-to-clipboard>`         | `aria-label="Copy to clipboard"`                                          | self-reference → `Copy to clipboard: sk_live_…`                                                        |
| same + `ariaLabel="Copy API key"`                                  | `aria-label="Copy API key"`                                               | self-reference → `Copy API key: sk_live_…`                                                             |
| same + `ariaLabel=""`                                              | `aria-label=""` → named `sk_live_…`                                       | self-reference → `Copy to clipboard: sk_live_…`                                                        |
| same + static `aria-label="Copy the key"`                          | overwritten: `aria-label="Copy to clipboard"`                             | overwritten; self-reference → `Copy to clipboard: sk_live_…`                                           |
| same + static `id="api-key"`                                       | `id="api-key"`                                                            | `id="api-key"`, referenced first by `aria-labelledby`                                                  |
| same + bound `[id]="keyId"` (a `@for` row id included)             | `id` = `keyId` (DOM property, not type-checked)                           | `id` = `keyId` (the `id` input), referenced first; follows `keyId` as it changes                       |
| same + bound `[attr.id]="keyId"`                                   | `id` = `keyId`                                                            | first render: generated id; after `keyId` changes: `keyId`, self-reference dangles → named `sk_live_…` |
| `<mlv-copy-to-clipboard [value]="id">0042</mlv-copy-to-clipboard>` | `aria-label="Copy to clipboard: ORDER-0042"`                              | name **unchanged**; host gains a generated `id`                                                        |
| same + `ariaLabel=""`                                              | `aria-label=": ORDER-0042"`                                               | `aria-label="Copy to clipboard: ORDER-0042"`; host gains a generated `id`                              |
| copy with no `value`, pressed while "Copied" shows                 | copies `"<text> Copied to clipboard"`                                     | copies `"<text>"`                                                                                      |
| `<mlv-stepper ariaLabel="Checkout">`                               | host `aria-label="Checkout"` (prohibited, not announced); tablist unnamed | host none; tablist `aria-label="Checkout"`                                                             |
| `<mlv-stepper aria-label="Checkout">`                              | attribute removed; nothing named                                          | host none; tablist `aria-label="Checkout"`                                                             |
| `<mlv-stepper aria-labelledby="checkout-heading">`                 | host `aria-labelledby` (prohibited, names nothing); tablist unnamed       | host none; tablist `aria-labelledby="checkout-heading"`                                                |
| `<mlv-stepper [attr.aria-label]="name">`                           | races the host binding; on the roleless host either way                   | **unchanged**: on the roleless host, names nothing                                                     |
| `<nav mlvBreadcrumb>`                                              | `aria-label="Breadcrumb"`                                                 | **unchanged**                                                                                          |
| `<nav mlvBreadcrumb aria-label="Project path">`                    | `aria-label="Breadcrumb"`                                                 | `aria-label="Project path"`                                                                            |
| `<nav mlvBreadcrumb [ariaLabel]="name">`                           | AOT compile error (NG8002, no such input)                                 | `aria-label` = `name`                                                                                  |

## 3. Who is affected

- **Specs or queries asserting `aria-label="Copy to clipboard"`** on a copy
  with no `value`. The `aria-label` is now `"Copy to clipboard:"`, the prefix
  `aria-labelledby` reads back, and not the name.
  **Do:** assert the name. Resolve `aria-labelledby` (see §4), or query
  `getByRole('button', { name: 'Copy to clipboard: sk_live_…' })`.
- **A bound `[attr.id]` on `<mlv-copy-to-clipboard>`.** It races the id the
  host references itself by: dropped on the first render, and once its value
  changes it wins and the name loses its base label. **Do:** bind `[id]`.
- **A bound `[id]` whose expression is not `string | undefined`** (a number,
  `string | null`). It used to bind the DOM property, which templates never
  type-check; it now binds the `id` input, so `strictTemplates` fails it with
  TS2322 (measured with `ngc`: `[id]="7"` and `[id]="maybeNull"` fail, the old
  build passed both). **Do:** `[id]="'copy-' + row.id"`, `String(…)`, or
  `?? undefined`.
- **A root host from `createComponent(MlvCopyToClipboard, { hostElement })`
  that already carries an `id`.** It is overwritten with a generated one (see
  the residuals in §1). **Do:** `setInput('id', …)`.
- **An `ariaLabel` on a no-`value` copy that already contains the visible
  text** (`ariaLabel="Copy the key sk_live_…"`). The text is now in the name
  twice. **Do:** make `ariaLabel` the verb phrase alone ("Copy the key").
- **A static `aria-label` on `<mlv-copy-to-clipboard>`.** Unlike the stepper
  and the breadcrumb, the copy does not honour it: the host binding overwrites
  it, before and after. **Do:** write `ariaLabel="Copy the key"`.
- **A `value` whose text differs from what is shown** (`[value]="orderId"`
  around "0042"). Its name is unchanged — still the value, not the visible text;
  the host only gains a generated `id`. **Do:** keep the visible text inside the name, in `value` or in
  `ariaLabel`, if speech input matters there.
- **Snapshots of generated ids, or of the copy host.** Each copy instance now
  takes one `mlvNextId()`, and `mlvNextId()` shares one counter across
  prefixes; the host carries it as its `id` unless its `id` input is set.
  **Do:** expect every id generated after a copy instance to shift by one;
  every copy host to gain an `id`, with or without `value`; and a copy with no
  `value` also to gain `aria-labelledby` and a colon-ended `aria-label`.
- **Stepper selectors or specs reading `mlv-stepper[aria-label]` or
  `mlv-stepper[aria-labelledby]`.** The host has neither. **Do:** read
  `mlv-stepper [role="tablist"]`.
- **A bound `[attr.aria-label]` or `[attr.aria-labelledby]` on
  `<mlv-stepper>`.** Only a static attribute is moved; a bound one stays on the
  roleless host and names nothing, before and after. **Do:** bind `[ariaLabel]`.
- **A static `aria-label` on `<mlv-stepper>` or `<nav mlvBreadcrumb>`, or a
  static `aria-labelledby` on `<mlv-stepper>`.** It used to be removed or left
  naming nothing (stepper) or overwritten with "Breadcrumb" (breadcrumb), and
  now it names the widget. **Do:** nothing if that was the intent. Otherwise
  delete it. `ariaLabel` is the documented spelling for both.
- **`[attr.aria-label]` bound on `<nav mlvBreadcrumb>`.** It still races the
  host binding: the last value to change wins, so it can revert to "Breadcrumb".
  **Do:** bind `[ariaLabel]` instead.
- **A root host from `createComponent(…, { hostElement })` that already carries
  `aria-label` (either component) or `aria-labelledby` (stepper).** Not moved:
  see the residuals in §1. **Do:** `setInput('ariaLabel', …)`.
- **Pages with several breadcrumb trails.** They are still identical
  "Breadcrumb" landmarks until you name them. **Do:** give each one an
  `ariaLabel`.

Name unchanged: every copy that binds `value` — every copy in `apps/docs`
except copy examples 1, 3 and 4 and the home page's two, whose names now carry
their text. Those `value` copies (copy examples 2 and 5, getting-started,
support-inbox, settings-access) still gain a generated host `id`. Also unaffected: every stepper that binds `ariaLabel`, which is all
six in `apps/docs` (the name moves onto the tablist, where it is announced).
In-repo, the `/breadcrumb` page names all eleven of its trails — examples 1–3
gain an `ariaLabel` each, and example 4 drops the `landmark-unique` narrowing
that #325 left for this change.

## 4. What a consumer changes

```html
<!-- Copy: a verb phrase for ariaLabel; the visible text is appended for you. -->
<mlv-copy-to-clipboard ariaLabel="Copy API key">sk_live_abc123</mlv-copy-to-clipboard>

<!-- Stepper and breadcrumb: ariaLabel, not a raw attribute. -->
<mlv-stepper ariaLabel="Checkout">…</mlv-stepper>
<nav mlvBreadcrumb ariaLabel="Project path" [items]="trail"></nav>
```

```ts
// Spec: resolve the name instead of reading aria-label off the copy host. The
// host references itself first; that reference contributes its own
// aria-label, never its subtree.
const name = copy
  .getAttribute('aria-labelledby')!
  .split(' ')
  .map((id) => {
    const node = document.getElementById(id);
    if (node === copy) return copy.getAttribute('aria-label') ?? '';
    return node?.textContent?.trim() ?? '';
  })
  .join(' ');
expect(name).toBe('Copy to clipboard: sk_live_abc123');

// Stepper: the name is on the tablist.
expect(stepper.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Checkout');
expect(stepper.hasAttribute('aria-label')).toBe(false);
```

## 5. Not changed

- The copy `value` path with a non-empty `ariaLabel`, `copiedAriaLabel`, the
  live region and the indicator tooltip. The tooltip sits on the `aria-hidden`
  indicator, so #532's description-from-init adds nothing to the button's name
  or description.
- The copy host's `textContent` and `innerText`, and those of its ancestors.
- The stepper's tab names, `aria-selected` / `aria-controls` wiring and #312's
  selection model.
- The breadcrumb's `role="navigation"`, `hiddenItems` / `showMore` strings, and
  #325's projected-mode separators.
