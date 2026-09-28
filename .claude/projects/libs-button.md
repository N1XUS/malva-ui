---
# Library: button

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Button library (`@malva-ui/core/button`) provides accessible button primitives: styled native buttons, close buttons, connected button groups, split-button layouts, and two-state toggle buttons. Groups, split buttons, and toggles can provide a shared visual variant so consumers do not have to repeat it on every child button.

> **Sizing is density-driven — there is no `size` input.** Button height/padding/font-size come from the `@malva-ui/cdk/density` system (`mlvDensity` host directive → `density-tight | density-compact | density-comfortable | density-spacious | density-airy`). A vestigial `size`/`ButtonSize` input existed but was never wired to any class or style (it silently did nothing) and was **removed**. Use `mlvDensity` to size a button (e.g. `<button mlvButton mlvDensity="compact">`), or set density on an ancestor.

## Public API

Exported from `libs/core/button/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvButton` | Component | Main button with disabled and loading states — selector `button[mlvButton], a[mlvButton]` |
| `MlvButtonClose` | Component | X-icon close action with transparent/circle defaults and standard density support — selector `mlv-button-close` |
| `MlvButtonGroup` | Component | Connected set of related buttons — selector `mlv-button-group` |
| `MlvButtonSplit` | Component | Joined primary action and related trigger — selector `mlv-button-split` |
| `MlvButtonToggle` | Component | Two-state button with `aria-pressed` and two-way `pressed` state — selector `mlv-button-toggle` |
| `MlvButtonVariant` | Type | `'primary' \| 'secondary' \| 'outlined' \| 'accent' \| 'transparent' \| 'elevated' \| 'error' \| 'warning' \| 'info'` |
| `MlvButtonShape` | Type | `'default' \| 'circle' \| 'square' \| 'pill'` |
| `MlvButtonVariantAccessor` | Interface | Contract used by button containers to provide an inherited variant |
| `MLV_BUTTON_VARIANT` | Injection token | Optional ancestor-provided button variant context |
| `MlvButtonBefore` | Directive | Template slot rendered before button text |
| `MlvButtonAfter` | Directive | Template slot rendered after button text |
| `MlvButtonIcon` | Directive | Marks a projected icon (`[mlvButtonIcon]` → `.mlv-button__icon`); optional since icon-only buttons are also inferred |

---

## Components

### `MlvButton`

**File:** `libs/core/button/src/lib/button/button.ts`

- **Selector:** `button[mlvButton], a[mlvButton]` — applies to native `<button>` and `<a>` elements
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Template:** `libs/core/button/src/lib/button/button.html`
- **Styles:** `libs/core/button/src/lib/button/button.scss`
- **Imports:** `NgTemplateOutlet`

#### Inputs

| Name       | Type                            | Default     | Description                                                                                                                                                                                                                   |
| ---------- | ------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant`  | `MlvButtonVariant \| undefined` | `undefined` | Local variant; inherits from a button container, then falls back to `secondary` for the icon-only `square`/`circle` shapes and `primary` for the rest                                                                         |
| `shape`    | `MlvButtonShape`                | `'default'` | Shape variant; `pill` keeps content width with a fully rounded stadium radius (`--mlv-radius-full`), matching the pill action bar and pill form controls                                                                      |
| `disabled` | `BooleanInput`                  | `false`     | Disables the button; coerced to boolean. Blocks every activation (see **Disabled activation guard**); native `disabled` on `<button>`, `tabindex="-1"` on `<a>`                                                               |
| `loading`  | `BooleanInput`                  | `false`     | Shows a spinner, exposes `aria-busy` + `aria-disabled`, blocks click activation as `disabled` does, but stays focusable and in the tab order — a co-hosted keydown / focus directive still runs (see **Loading keeps focus**) |
| `selected` | `BooleanInput`                  | `false`     | Paints the pressed surface with no ARIA of its own — for a menu button reflecting an active state (see **Pressed state** below)                                                                                               |

#### Content Children (protected)

| Name        | Directive         | Description                              |
| ----------- | ----------------- | ---------------------------------------- |
| `beforeRef` | `MlvButtonBefore` | Template rendered before the button text |
| `afterRef`  | `MlvButtonAfter`  | Template rendered after the button text  |

#### Host Bindings

```ts
host: {
  'class': 'mlv-button',
  '[class]': '"mlv-button--variant-" + effectiveVariant() + " mlv-button--shape-" + shape()',
  '[class.mlv-button--disabled]': 'disabled()',
  '[class.mlv-button--loading]': 'loading()',
  '[class.mlv-button--selected]': 'selected()',
  '[class.mlv-button--icon-only]': '_iconOnly()',
  '[attr.disabled]': '(!_isAnchor && disabled()) || null', // <button> hosts only, never for loading (#324)
  '[attr.aria-disabled]': '_inert() || null',
  '[attr.aria-busy]': 'loading() || null',
}
```

`_inert()` is `disabled() || loading()` and drives `aria-disabled` and the click
guard only; leaving the tab order (native `disabled`, an anchor's
`tabindex="-1"`) follows `disabled()` alone (#324). `_isAnchor` is
`host.tagName === 'A'`, resolved once. **No `(click)` host listener and no
`tabindex` host binding** — both deliberately (#460).

#### Loading keeps focus (#324)

Owner ruling D20. Migration: [docs/migrations/2026-09-button-loading-keeps-focus.md](../../docs/migrations/2026-09-button-loading-keeps-focus.md).

- **Rule:** `loading` alone → `aria-disabled="true"` + `aria-busy="true"` + the
  capture guard; **no** native `disabled`, **no** anchor `tabindex="-1"`. The
  button keeps focus when loading starts and ends, and stays a tab stop. An
  explicit `disabled` (alone or beside `loading`) keeps native semantics:
  `disabled` on `<button>`, `-1` on `<a>`. One rule for both hosts.
- **Why:** browsers move focus off a button that becomes `disabled` and never
  return it (measured Chromium / Firefox / WebKit: `activeElement` → `<body>`,
  one `blur`, still `<body>` after re-enable) — a keyboard or screen-reader user
  who pressed Save lost their place.
- **Activation while loading** (measured in all three engines): pointer click,
  `el.click()`, Enter, Space, screen-reader activation and implicit submission
  (Enter in a text field fires the browser's synthetic click at the default
  button) all reach the host and stop at the guard — `preventDefault()` cancels
  the submission, `stopImmediatePropagation()` stops the consumer's `(click)`, a
  co-hosted `[mlvClick]` / `mlvMenuTrigger` / `mlvPopupTrigger` click listener,
  `RouterLink` and ancestor bubble listeners. `form.requestSubmit()` (with or
  without a submitter) bypasses buttons and submits, exactly as it did under
  native `disabled`.
- **Look:** unchanged. The one visible delta would have been `:active` —
  Chromium matches it on a focused button while Space is held, even under
  `pointer-events: none` — so every `:active` rule in `button.scss` is written
  `&:not(:where(.mlv-button--loading)):active` (zero specificity, emission
  order untouched). A focused loading button shows its `:focus-visible` ring,
  which it could not before because it could not be focused.
- **Residual — keydown / focus handlers of co-hosted directives:** the guard
  stops the click only. In this library: `mlvMenuTrigger` opens on Enter /
  Space / ArrowDown / ArrowUp keydown, gated only by `menuTriggerDisabled`;
  `[mlvContextMenuTrigger]` (targeted) opens on the ContextMenu key or
  Shift+F10 keydown, gated only by `contextMenuDisabled`; `mlvPopupTrigger`
  with `triggerOn="focus"` opens on focus (no disabled input); `[mlvClick]` on
  an anchor host emits on Space, or on any activation key without `href`. On a
  focused loading button each now runs. Bind the directive's own disabled
  input, or `disabled`. No host in `libs/` or `apps/` combines one with
  `loading` alone (`mlv-filter`'s trigger co-hosts `mlvPopupTrigger` with
  `loading` but also binds `disabled`). Shared inert-host contract: #506.
- **Residual — hydration:** a loading-only anchor server-renders
  `aria-disabled="true"` with no `-1`, so a consumer-bound
  `[attr.tabindex]="-1"` beside it reads as the server's mark and is removed at
  hydration — pinned at `null` in `button-ssr.spec.ts`:
  - `loading-bound` (loading on the server only): unchanged — before #324 the
    server wrote `-1` for loading too and the client removed it the same way.
  - `loading-both-bound` (loading on both sides): **new** — before, the
    client's own loading `-1` coincided with the consumer's, which went only
    when loading ended; now it goes at hydration (probe-measured on both
    sources).
  - Not fixable from the claimed node: a disabled + loading render carries the
    same `aria-disabled` + `aria-busy`, and hydration rewrites `class`. Keeping
    a marked `-1` while the client loads would keep a disabled + loading
    render's `-1` on an anchor the client renders loading only.
  - Client-rendered, the binding now survives loading's end (was removed then,
    #460's bound-`tabindex` residual) — `button.spec.ts`. None in `libs/` or
    `apps/`.

#### Disabled activation guard (#460)

Same mechanism as `a[mlvLink]` (#309) and the `mlv-segmented` link item.
Migration: [docs/migrations/2026-09-button-anchor-disabled-activation.md](../../docs/migrations/2026-09-button-anchor-disabled-activation.md).

- **Guard:** one `fromEvent(host, 'click', { capture: true })` stream, released by
  `takeUntilDestroyed()`; while `_inert()` (read per click) it calls
  `preventDefault()` + `stopImmediatePropagation()`. Installed on every host.
- **Why capture:** `RouterLink.onClick` never reads `defaultPrevented`, and a host
  `(click)` cannot stop it — Angular coalesces every host and template `(click)`
  on one element into one native listener and walks the chain
  (`__ngNextListenerFn__`). At `AT_TARGET` the capture pass runs before the bubble
  pass whatever the registration order, so the guard beats `RouterLink`, the
  consumer's `(click)`, the click listener of a **co-hosted directive**
  (`mlvMenuTrigger`, `mlvPopupTrigger` — they no longer open from a scripted or
  screen-reader click on an inert button), a listener attached before the
  component existed, and ancestor bubble listeners. Ancestor **capture**
  listeners (CDK click-outside) still run. Pinned by a `createComponent(MlvButton, { hostElement })` spec whose
  consumer listener is on the anchor first.
- **No keydown handler:** Enter on an `<a href>` arrives as the click the guard
  sees. The guard returns nothing, so no listener evaluates to `false` and Angular
  never `preventDefault()`s an enabled click (#309's `cond && …` trap — the old
  `_handleClick` returned `undefined`, so enabled activation was never affected).
- **`<button>` hosts:** keep the native `disabled` attribute while `disabled`
  (which already stops real clicks); there the guard only keeps a scripted
  `dispatchEvent(click)` cancelled, as the old host listener did — and now also
  stops the consumer's own `(click)` on it. While `loading` alone there is no
  native `disabled` and the guard is the whole block (**Loading keeps focus**).
- **`<a>` hosts:** no `disabled` attribute (anchors have no disabled state; a
  consumer-authored static `disabled` is removed by the binding's first `null`).
  `aria-disabled="true"` while inert, `href` kept (element stays `role="link"`),
  and `tabindex="-1"` while **disabled** (not while only loading, #324),
  written by an `effect()` through `Renderer2`:
  - **Not a host binding:** `[attr.tabindex]` would evaluate to `null` on every
    `<button>` host and remove the consumer's own — speed-dial actions
    (`tabindex="-1"`) and the calendar's roving cells (`[attr.tabindex]`). The
    ablation turns the "never writes one on a button host" spec red.
  - **Nothing written until the anchor is first disabled**, so an anchor that
    never is keeps whatever the consumer bound — one exception, hydration, below.
  - **Restore:** on re-enable, the consumer's own `tabindex`, or none. Read
    once at construction, from one of two sources:
    - **Not hydrating:** the host's attribute. Static template attributes are
      written before directives are constructed and no binding has run, so it
      is the template's value; a root host from
      `createComponent(…, { hostElement })` (Angular Elements, dynamic hosting)
      has no template and keeps the attribute it came with.
      `HostAttributeToken` is always `null` there — ablation turns the root-host
      spec red.
    - **Hydrating** (`ngh` on the host at construction, read like
      `MlvSelect._hydrating`): the claimed node is the server's and its
      `tabindex` may be the component's own `-1`, so the template's
      (`HostAttributeToken('tabindex')`). Ablation (DOM instead) leaves
      hydrated anchors at `-1`.
  - **Hydration reconciliation:** a server that rendered the anchor disabled
    wrote `tabindex="-1"`; a client whose first render is not disabled
    (`[disabled]="!isBrowser"`, a browser-only login state, `[disabled]` on
    client-fetched data) claims that node. So the client **owns the `-1` from
    construction** when the claimed node carries `aria-disabled="true"` and
    `tabindex="-1"` and the template has no static `aria-disabled`
    (`HostAttributeToken('aria-disabled') === null`), and takes it back on its
    first render. `aria-disabled` is a **heuristic mark, not proof**: the host
    binding writes it when the server rendered the anchor inert (disabled or
    loading) and removes a static one when it did not. Without it (seed on
    `tabindex` alone) a consumer-bound `[attr.tabindex]="-1"` on a
    never-inert anchor is stripped —
    measured, ablation red. The static check exists because hydration's
    `elementStart` re-applies static attributes to the claimed node before
    construction, so a static `aria-disabled="true"` reads as the mark on a
    never-inert anchor (#460 review R2-1 (A); the `static-aria` anchor in
    `button-ssr.spec.ts`, red without the check). `button-ssr.spec.ts` runs the
    real `renderApplication` → `provideClientHydration` round trip; without the
    seed the anchor stays at `-1` (Tab never reaches an enabled link). Not a
    class-based mark: hydration rewrites `class` wholesale before construction.
    - **Residual — mistaken for the mark** (probe-measured, not pinned): an
      `aria-disabled="true"` bound by a co-hosted directive, or by a consumer
      `[attr.aria-disabled]` whose value changes after the server's first pass,
      beside a bound `[attr.tabindex]="-1"` on a never-inert anchor — that
      `-1` is removed on hydration. None in `libs/` or `apps/`.
    - **Residual — a loading anchor reads as the mark** (#324, pinned:
      `loading-bound` and `loading-both-bound` in `button-ssr.spec.ts`):
      loading writes `aria-disabled="true"` but no `-1`, so a server-loading
      anchor with a bound `[attr.tabindex]="-1"` loses that `-1` at hydration,
      whether or not the client is still loading (new for the latter; see
      _Loading keeps focus_). Not separable: `aria-busy` is also on a
      disabled + loading anchor, and `class` is rewritten. None in `libs/` or
      `apps/`.
    - **Residual — not taken back** (pinned: `static-aria-server` in
      `button-ssr.spec.ts`, which goes red on purpose once the seed can tell a
      bound `-1` from the server's): a static `aria-disabled` (no effect on the
      rendered `aria-disabled` — the host binding overwrites it), no static
      `tabindex`, disabled on the server only → keeps the server's `-1`. With a
      static `tabindex` hydration re-applies it, so that case is fine.
  - **Residual — a `tabindex` bound with `[attr.tabindex]` on an anchor host:**
    both halves. While disabled, the binding overwrites the `-1` whenever its value
    changes (the component effect runs after the parent's bindings, so the
    first render still shows `-1`), putting a disabled anchor back in the tab
    order. On re-enable it is removed, until its value next changes. Write the
    tabindex statically. None in `libs/` or `apps/`.
  - **Residual — focus and the context menu**, as `a[mlvLink]`: `tabindex="-1"`
    does not blur, so an anchor focused before it was disabled keeps focus —
    and a loading anchor keeps focus and its tab stop by design (#324) — and
    the Menu key or Shift+F10 opens its context menu, whose "Open in new tab"
    reads `href` and dispatches no `click`. So do screen-reader context-menu
    commands on any inert anchor. By
    pointer, `pointer-events: none` on `--disabled` / `--loading` stops the menu
    and middle-click.
  - **`effect()`, not `afterRenderEffect()`:** the attribute is in the
    server-rendered markup (`ssr-smoke.spec.ts` pins it; the ablation goes red).

> **Outlined vs. transparent label colour (AB-R1)** — `outlined` keeps the
> accent label (`--mlv-btn-text-color: var(--mlv-text-action)`): a bordered
> button is a call to action, not a routine per-row glyph. `transparent`
> instead resolves `--mlv-text-secondary` at rest, stepping to
> `--mlv-text-primary` on hover — a bare glyph (the row's configure/add/
> remove/reorder cluster, and per AB-R3 its destructive members too) is
> neutral chrome, never an accent mark, so a repeated unit never spends more
> than one accent-carrying mark. Both variants keep
> `--mlv-btn-bg-hover: var(--mlv-background-neutral-1-hover)` /
> `-active: var(--mlv-background-neutral-1-active)` on `transparent`, and
> `--mlv-background-accent-1-pale` / `--mlv-background-neutral-1-active` on
> `outlined`.

#### Template Structure (`button.html`)

```html
@if (loading()) {
<mlv-loader variant="circle" color="currentColor" indeterminate [size]="20" [strokeWidth]="2" />
} @else if (beforeRef()) {
<ng-container [ngTemplateOutlet]="beforeRef()!.templateRef" />
}
<span class="mlv-button__text"><ng-content /></span>
@if (!loading() && afterRef()) {
<ng-container [ngTemplateOutlet]="afterRef()!.templateRef" />
}
```

The loading state keeps the projected text visible, replaces optional before/after
content with an indeterminate `MlvLoader`, and blocks every activation through the
capture-phase click guard (see **Disabled activation guard**) while leaving the
button focusable and in the tab order (see **Loading keeps focus**). The accessible
name stays the projected text: the loader is a sibling `role="progressbar"` with its
own label, not part of the button's name. Consumers remain responsible for changing
the action label when a more specific in-progress label is useful.

#### Styles Summary (`button.scss`)

- Base: `display: inline-flex; align-items: center; gap: 0.25rem`
- `appearance: none; cursor: pointer; transition: 0.2s`
- Focus: Form A — `outline: var(--mlv-stroke-width-medium) solid transparent;` at rest, coloured `var(--mlv-border-focus)` (or a variant's own `focus-outline`) on `:focus-visible`, offset `var(--mlv-focus-ring-offset)` (SF-R3). Every filled variant now uses `--mlv-border-focus`; `accent` borrowed `--mlv-background-accent-2-hover` until #302 (2.28:1 on the light page).
- Filled fills (`primary`, `accent`, `error`, `warning`, `info`): rest / hover / active read the semantic `--mlv-background-*-1` / `-accent-*` triple and its paired label — no `--mlv-palette-*`, no component-derived `color-mix()` (#302: `info` read raw `info-500`, 2.77:1; `warning` mixed its own hover/press, bypassing high contrast). Each state ≥ 4.5:1 in light, dark and HC (`tone-contrast.spec.mjs`). In dark, `accent` / `error` / `warning` / `info` carry a near-black label on the 500 fill.
- Size presets (padding, height, font scale):
  - `xs`: xs padding, xs height, body-xs font
  - `s`: s padding, s height, body-s font
  - `m`: m padding, m height, body-m font
  - `l`: l padding, l height, body-l font
  - `xl`: xl padding, xl height, body-xl font
- Variant styles:
  - `primary`: `accent-1` background
  - `secondary`: `neutral-1` background
  - `accent`: `accent-2` background
  - `transparent`: no background, neutral `--mlv-text-secondary` label, neutral hover (AB-R1)
  - `outlined`: transparent with border, accent label kept
- Shape styles:
  - `default`: standard rectangular with radius
  - `square`: `padding: 0.25rem; width = height`
  - `circle`: `border-radius: var(--mlv-radius-full)`
- Disabled (SF-R4): a declared surface, not an opacity multiply — `--mlv-background-disabled` fill (transparent for `transparent`/`outlined`) + `--mlv-text-disabled` label; `cursor: not-allowed`, `pointer-events: none`
- Loading: current-colour `MlvLoader`, wait cursor, blocked pointer interaction, and inherited reduced-motion support. Every `:active` rule is `&:not(:where(.mlv-button--loading)):active` (#324) — a loading button is focusable, and Chromium matches keyboard `:active` (Space held) even under `pointer-events: none`
- Pressed (SF-R1): `[aria-pressed='true']` fills with `--mlv-background-selected` / `-hover` + `--mlv-text-on-selected` label, plus a `--mlv-stroke-width` inset `--mlv-border-normal` ring — never the pressed/`-active` fill, which means "the pointer is down right now"

**Canonical emission order (AB-R3).** The filled-variant loop and
`--variant-transparent`/`--variant-outlined` are plain single-class
selectors — specificity `(0,1,0)` — so both state selectors below always
outrank them regardless of source order. `[aria-pressed='true']` is
class+attribute (`(0,2,0)`). `--disabled` is deliberately emitted as a
doubled class (`&#{&}--disabled`, i.e. `.mlv-button.mlv-button--disabled`)
to match that same `(0,2,0)` specificity — a plain `&--disabled` is only
`(0,1,0)` and silently loses the specificity contest to `[aria-pressed]`
regardless of source order, which is exactly the bug this doubling fixes (a
disabled+pressed control — e.g. a disabled time-picker AM/PM button or
calendar month/year button — previously rendered as enabled-and-selected).
With both at `(0,2,0)`, source order decides, so disabled must stay
emitted **after** pressed. Emitted in this order, after the density blocks
and `&__*` parts: 1) base `:hover`/`:active`, 2) the filled-variant `@each`
loop, 3) `--variant-transparent`/`--variant-outlined` (AB-R1), 4)
`[aria-pressed='true']` (SF-R1 — outranks variant), 5) `--disabled` + its
two variant qualifiers (SF-R4 — outranks everything, including pressed, via
both the specificity tie and source order), 6) `--loading`, then the shape
modifiers.

> **Pressed state** — any `button[mlvButton]` carrying `aria-pressed="true"`
> **or the `selected` input** gets the visible treatment, not just
> `mlv-button-toggle`. The two share one rule: `selected` renders
> `.mlv-button--selected` (doubled to `(0,2,0)` so it matches the attribute
> half's specificity and cannot lose to `--variant-transparent:hover`) and adds
> no ARIA. It exists for a **menu** button that reflects an active state — the
> editor's heading trigger while the caret sits in an H2 — which must not claim
> the toggle-button pattern on top of `aria-haspopup`/`aria-expanded`; its state
> reaches assistive technology through the level-bearing accessible name
> instead. A real toggle sets `aria-pressed` and paints identically. Toggles that render
> the attribute on a plain `mlvButton` — every editor toolbar command button —
> previously announced their state to assistive technology while looking
> identical to an inactive control. The rule pins `--mlv-btn-bg-hover` **and**
> `--mlv-btn-text-color` as well, because `.mlv-button:hover` and
> `.mlv-button--variant-transparent:hover` carry the same `(0,2,0)`
> specificity and would otherwise decide the background/label by Sass
> emission order. It writes `--mlv-btn-box-shadow` rather than `box-shadow`,
> keeping the base `box-shadow: var(--mlv-btn-box-shadow, none)` the single
> place the property is set. `--mlv-background-selected` / `-hover` back it
> in both themes (SF-R1), so a pressed control reads as a persistent
> selection, not a mouse-down affordance, against light and dark toolbar
> surfaces alike. `button.spec.ts` compiles `button.scss` through Sass and
> pins the selector's targeting and all three declarations.
>
> **Disabled state (SF-R4)** — `&#{&}--disabled` (doubled class,
> `.mlv-button.mlv-button--disabled`, specificity `(0,2,0)`) sits **last** in
> the canonical emission order (after `[aria-pressed='true']`), so a disabled
> control never shows a pressed fill. The doubling matters: a plain
> `&--disabled` is only `(0,1,0)` and loses to `[aria-pressed='true']`'s
> `(0,2,0)` outright, regardless of source order — `button.spec.ts` pins this
> against real cascade resolution via `getComputedStyle`, not just rule
> declarations in isolation. It sets `--mlv-btn-bg`/`-hover`/`-active` to the new
> `--mlv-background-disabled` token and `--mlv-btn-text-color` to
> `--mlv-text-disabled` — a declared pale surface with legible ink, not the
> old `opacity: var(--mlv-disabled-opacity)` multiply, which produced white
> text on a washed-out accent composite at ~1.9:1 contrast. Two qualifiers
> keep `transparent`/`outlined` disabled buttons background-free
> (`--variant-outlined.--disabled` also mutes its border to
> `--mlv-border-subtle`).

> **Icon-only inference & the shape-aware default variant** — see
> [docs/migrations/2026-08-button-icon-only-default-variant.md](../../docs/migrations/2026-08-button-icon-only-default-variant.md).
>
> - `.mlv-button--icon-only` no longer requires `mlvButtonIcon`. `_iconOnly()` is true when
>   `shape` is `square`/`circle` **and** either a `[mlvButtonIcon]` is projected **or** the
>   default slot renders no non-whitespace text. The slot is projected content, so its text
>   is read back from `.mlv-button__text` (view child `#textRef`) inside an
>   `afterRenderEffect` that re-runs on `shape`, `loading`, and `mlvButtonIcon` changes.
>   `_hasProjectedText` starts `true`, so SSR (where `afterRenderEffect` never runs) keeps
>   the directive-only behaviour. Text that appears/disappears inside an already-rendered
>   button is **not** observed — annotate the icon for that case.
> - `button.scss` sizes `.mlv-button--icon-only .mlv-button__text > svg:only-child` to
>   `var(--mlv-icon-font-size)`, so an unannotated Lucide icon stops rendering at its
>   intrinsic `24px` and overflowing the square at tight/compact density.

The public `effectiveVariant` computed signal resolves the local `variant`, the closest `MLV_BUTTON_VARIANT` provider, and finally a shape-aware fallback — `secondary` for `square`/`circle`, `primary` for everything else — in that order. Because `mlv-button-group`, `mlv-button-split`, and `mlv-button-toggle` always provide `MLV_BUTTON_VARIANT` (falling back to `primary` themselves), the shape-aware default only applies to a standalone button.

### `MlvButtonClose`

**File:** `libs/core/button/src/lib/button-close/button-close.ts`

- **Selector:** `mlv-button-close`
- Renders an inner native `<button type="button">` using `MlvButton`
- **Inputs:** `variant` (`transparent` by default), `shape` (`circle` by default), required `ariaLabel`, and `disabled` (`BooleanInput`, default `false`; added 2026-09, #568)
- `disabled` is forwarded to the inner native button, which takes the `mlvButton` disabled contract: declared disabled surface, out of the tab order, not activatable. A pointer click on the inner button never reaches a `(click)` bound on the host, but a click dispatched on the host element itself still does — a handler that must not act while disabled guards itself (`mlv-file-upload-item` does)
- Attaches the standard `MlvDensityDirective` as a host directive and supports `tight`, `compact`, `comfortable`, `spacious`, and `airy`
- Forwards the directive's resolved density to the inner button, so dimensions match a regular icon-only `mlvButton` at every density
- Applies `ariaLabel` to the inner native button; the role-less custom-element host is not an accessible-name target
- For the transparent variant, uses `--mlv-text-secondary` at rest and `--mlv-text-primary` on hover/active, adapting automatically to light and dark themes
- Retains regular button background, focus, active, and motion behavior
- Glyph size uses a component-local `--mlv-button-close-icon-ratio: 0.6` (vs. the shared `--mlv-icon-in-container-ratio: 0.45` every other icon-only button uses), applied through a `.mlv-button--close.mlv-button--icon-only` override that outranks the base rule regardless of stylesheet order. `mlv-button-close` is most often seen at `compact` density or smaller (dialog/drawer headers, tile, inline clear affordances), where the shared 0.45 ratio rendered an illegibly small X (~12.6px at compact); 0.6 raises it to ~16.8px without touching the shared token or any other icon-only button
- Pins its own `:focus-visible` ring (`.mlv-button--close.mlv-button:focus-visible { outline-color: var(--mlv-border-focus) }`). The base `.mlv-button` neutralises the UA outline and only the per-variant rules restore a colour, so the close button previously depended entirely on the variant it happened to render with; the qualified selector also outranks those equally specific variant rules regardless of stylesheet order. Width/offset stay on the shared base so the ring matches every other button.

### `MlvButtonGroup`

**File:** `libs/core/button/src/lib/button-group/button-group.ts`

- **Selector:** `mlv-button-group`
- **Role:** `group`; name it with native `aria-label` or `aria-labelledby` when surrounding context is insufficient
- **Input:** `variant?: MlvButtonVariant`
- Projects ordinary `button[mlvButton]` and/or `mlv-button-toggle` children
- Joins adjacent corners and keeps focused buttons above their neighbors
- Provides its resolved variant through `MLV_BUTTON_VARIANT`; a child's local `variant` wins

### `MlvButtonSplit`

**File:** `libs/core/button/src/lib/button-split/button-split.ts`

- **Selector:** `mlv-button-split`
- **Role:** `group`
- **Input:** `variant?: MlvButtonVariant`
- Projects the primary action first and its related trigger second
- Owns connected layout, a vertically centered separator that is `0.25rem` shorter than the buttons, and shared variant injection; popup/menu behavior stays with the projected trigger

### `MlvButtonToggle`

**File:** `libs/core/button/src/lib/button-toggle/button-toggle.ts`

- **Selector:** `mlv-button-toggle`
- Renders an inner native `<button type="button">` using `MlvButton`
- **Inputs:** `variant?`, `shape`, `disabled`, `mlvDensity?`, `ariaLabel?`, `ariaLabelledBy?`
- **Model:** `pressed` (two-way bindable with `[(pressed)]`)
- Reflects state through native `aria-pressed` and a visible pressed treatment
- Forwards `mlvDensity` to the inner button
- Inherits a group/split variant when its local `variant` is omitted, then provides that resolved value to its inner button

---

## Directives

All defined in `libs/core/button/src/lib/button.directives.ts`.

### `MlvStructural` (abstract base, from `@malva-ui/cdk/utils`)

Base class extended by `MlvButtonBefore` and `MlvButtonAfter`. Provides `templateRef = inject(TemplateRef)`. It lives in `@malva-ui/cdk/utils`, not in this barrel.

### `MlvButtonBefore`

- **Selector:** `[mlvButtonBefore]`
- **Purpose:** Template slot for content rendered **before** the button text label.
- Use with `<ng-template mlvButtonBefore>` inside a button.

### `MlvButtonAfter`

- **Selector:** `[mlvButtonAfter]`
- **Purpose:** Template slot for content rendered **after** the button text label.
- Use with `<ng-template mlvButtonAfter>` inside a button.

---

## Services

None.

---

## Usage Examples

```html
<!-- Primary button (default) -->
<button mlvButton>Click me</button>

<!-- Variants -->
<button mlvButton variant="secondary">Secondary</button>
<button mlvButton variant="outlined">Outlined</button>
<button mlvButton variant="accent">Accent</button>
<button mlvButton variant="transparent">Transparent</button>
<button mlvButton variant="error">Error</button>
<button mlvButton variant="warning">Warning</button>
<button mlvButton variant="info">Info</button>

<!-- Sizing via density -->
<button mlvButton mlvDensity="compact">Small</button>
<button mlvButton mlvDensity="spacious">Large</button>

<!-- Close action; all five standard density values are supported -->
<mlv-button-close ariaLabel="Close dialog" mlvDensity="compact" />

<!-- Icon before text -->
<button mlvButton>
  <ng-template mlvButtonBefore>
    <svg><!-- search icon --></svg>
  </ng-template>
  Search
</button>

<!-- Icon after text -->
<button mlvButton variant="primary">
  Continue
  <ng-template mlvButtonAfter><span>→</span></ng-template>
</button>

<!-- Circle icon button — icon-only sizing and the neutral `secondary` default
     are inferred; `mlvButtonIcon` is optional -->
<button mlvButton shape="circle" aria-label="Add">
  <svg lucidePlus />
</button>

<!-- Explicit variant still wins over the shape-aware default -->
<button mlvButton shape="circle" variant="primary" aria-label="Add">
  <svg lucidePlus mlvButtonIcon />
</button>

<!-- Disabled -->
<button mlvButton [disabled]="true">Disabled</button>

<!-- Loading: aria-busy + aria-disabled, every activation blocked, but still
     focusable — a focused Save keeps focus while it runs (#324). Add
     [disabled] too only if it must leave the tab order. -->
<button mlvButton [loading]="saving()">{{ saving() ? 'Saving…' : 'Save changes' }}</button>

<!-- Link button -->
<a mlvButton href="/page" variant="transparent">Go to page</a>

<!-- Disabled link button: aria-disabled, tabindex="-1", every click blocked;
     href / routerLink kept, no disabled attribute -->
<a mlvButton routerLink="/billing" [disabled]="!canBill()">Billing</a>

<!-- One shared variant for a connected group -->
<mlv-button-group variant="secondary" aria-label="Text alignment">
  <button mlvButton>Left</button>
  <button mlvButton>Center</button>
  <button mlvButton>Right</button>
</mlv-button-group>

<!-- Split primary action and related trigger -->
<mlv-button-split variant="primary" aria-label="Save options">
  <button mlvButton>Save</button>
  <button mlvButton shape="square" aria-label="More save options">…</button>
</mlv-button-split>

<!-- Two-way toggle state; both toggles inherit the group variant -->
<mlv-button-group variant="secondary" aria-label="Formatting">
  <mlv-button-toggle [(pressed)]="bold">Bold</mlv-button-toggle>
  <mlv-button-toggle [(pressed)]="italic">Italic</mlv-button-toggle>
</mlv-button-group>
```

---

## Dependencies

- `@angular/core` ^22.0.0
- `@angular/common` — `NgTemplateOutlet`
- `@angular/cdk/coercion` — `BooleanInput`, `coerceBooleanProperty`
- `@lucide/angular` — close icon
- `@malva-ui/cdk/density` — standard five-level density directive
- `@malva-ui/core/loader` — indeterminate loading indicator
- Malva UI CSS design tokens (`--mlv-*`)
