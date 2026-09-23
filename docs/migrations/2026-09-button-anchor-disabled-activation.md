# 2026-09 — a disabled `a[mlvButton]` stays put and leaves the tab order

Applies to `@malva-ui/core/button` (`MlvButton`, `button[mlvButton]` /
`a[mlvButton]`). Fixes #460 — the `a[mlvLink]` defect of #309
([2026-09-link-native-activation.md](2026-09-link-native-activation.md)) on
the button's anchor selector.

> **Loading half superseded by #324**
> ([2026-09-button-loading-keeps-focus.md](2026-09-button-loading-keeps-focus.md)):
> `loading` alone no longer writes native `disabled` or an anchor's
> `tabindex="-1"` — a loading button keeps focus and its tab stop, and is
> blocked by the guard below. Everything this page says about `disabled`
> stands.

**Breaking, behaviour only.** No exported symbol was renamed or removed;
nothing was retyped; no barrel changes; the selector, every input (`variant`,
`shape`, `disabled`, `loading`, `selected`), the slots, the BEM classes and the
`aria-disabled` / `aria-busy` host attributes are unchanged. What moves is what
a **disabled or loading** button lets through, and what a disabled or loading
**anchor** exposes: its tab stop and the (invalid) `disabled` attribute.
Enabled buttons activate exactly as before. A consumer who never disables an
`a[mlvButton]`, and binds no `(click)` on a disabled button, edits nothing.

`VERSIONING.md` § 3, row _Changed default behaviour at an unchanged API —
ordering, timing, emitted events, focus, ARIA_. The navigation itself is the
patch row (restoring behaviour the library documented — "blocks anchor
activation through the component click guard"); the tab stop and the listeners
a disabled click reaches are not. On the `0.x` line that is a `!` commit, which
`nx release` demotes to a minor: `0.1.15` → `0.2.0` (§ 7;
`docs/RELEASING.md` § 3.1).

## 1. What changed

`MlvButton` blocked a disabled or loading click with a host `(click)` listener,
`_handleClick`, calling `preventDefault()` + `stopImmediatePropagation()`, and
wrote `[attr.disabled]` on every host. On an anchor neither held:

- **`RouterLink` navigated anyway.** Its `onClick` calls
  `Router.navigateByUrl()` without reading `defaultPrevented`, and no host
  listener can stop it: Angular coalesces every host and template `(click)` on
  one element into **one** native listener and walks the whole chain
  (`__ngNextListenerFn__`), so `stopImmediatePropagation()` inside it stops
  only listeners registered separately. The same walk ran the consumer's own
  `(click)`.
- **The anchor kept its tab stop.** Anchors have no disabled state, so
  `disabled="true"` on an `<a>` does nothing: Tab landed on it and Enter
  produced a click that navigated.

`_handleClick` returned `undefined`, so no listener expression evaluated to
`false` and Angular never `preventDefault()`ed an **enabled** click — the
second half of #309 does not apply here, and enabled activation is unchanged.

Measured in jsdom against `MlvButton` at `1a520c10` and after this change
(`router.url`, listener counts, attributes, `defaultPrevented`):

| Case                                                                                             | Before                                                                 | After                                                |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| Disabled or loading `a[mlvButton][routerLink]`, click (screen reader, `el.click()`, label click) | **navigates**                                                          | no navigation, no `NavigationStart`                  |
| Same, Enter                                                                                      | **navigates**                                                          | no navigation                                        |
| Disabled plain `href`, click                                                                     | cancelled                                                              | cancelled — unchanged                                |
| Disabled anchor, consumer's own `(click)`                                                        | **runs**                                                               | does not run                                         |
| Disabled anchor, listener attached to it before the component existed                            | runs                                                                   | does not run                                         |
| Disabled anchor, bubble-phase listeners on ancestors                                             | do not run                                                             | do not run — unchanged                               |
| Disabled anchor, capture-phase listeners on ancestors (CDK click-outside)                        | run                                                                    | run — unchanged                                      |
| Disabled or loading anchor, Tab                                                                  | **tab stop**                                                           | skipped: `tabindex="-1"`                             |
| Disabled or loading anchor, `disabled` attribute                                                 | `disabled="true"` (invalid; a static `disabled` too)                   | absent                                               |
| Disabled anchor with an authored `tabindex="0"`                                                  | `0`                                                                    | `-1` while inert, `0` again once enabled             |
| Anchor inert on the server, not on the hydrating client                                          | server writes `disabled`, the client removes it                        | server writes `-1`, the client removes it            |
| Disabled or loading `<button>`, user click                                                       | never dispatched (native `disabled`)                                   | unchanged                                            |
| Same, scripted `dispatchEvent(new MouseEvent('click'))`                                          | cancelled, but the consumer's own `(click)` **runs**                   | cancelled; the consumer's own `(click)` does not run |
| `<button>` host `disabled` attribute, `aria-disabled`, `aria-busy`                               | written                                                                | unchanged                                            |
| Enabled button or anchor, any activation                                                         | activates                                                              | unchanged                                            |
| Enabled click with no `(click)` bound anywhere on the element                                    | the host listener marked the view dirty and scheduled change detection | nothing scheduled — there is no host listener        |

## 2. Mechanism

- `_handleClick` and the `(click)` host listener are gone. The guard is one
  `fromEvent(host, 'click', { capture: true })` stream, released by
  `takeUntilDestroyed()`; while `disabled() || loading()` (read per click) it
  calls `preventDefault()` and `stopImmediatePropagation()`. It is the guard
  `a[mlvLink]` and the `mlv-segmented` link item already carry, and it is
  installed on `<button>` hosts too, where it only matters for a scripted
  click.
- **Capture is the mechanism.** At `AT_TARGET` the capture pass runs before the
  bubble pass whatever the registration order, so the guard beats `RouterLink`,
  the consumer's `(click)` and a listener attached before the component
  existed; for a click on the label span it runs before the event reaches the
  target at all.
- **`disabled` is written on `<button>` hosts only**; `aria-disabled` stays on
  both. A static `disabled` a consumer wrote on an anchor is removed by the
  binding's first `null`.
- **`tabindex="-1"` on an inert anchor comes from an `effect()`, not a host
  binding.** A `[attr.tabindex]` host binding would evaluate to `null` on every
  `<button>` host and remove the consumer's own tabindex — the speed-dial
  actions (`tabindex="-1"`) and the calendar's roving cells
  (`[attr.tabindex]`). Nothing is written until the anchor first becomes
  inert.
- **On leaving the inert state the anchor gets back its own `tabindex`, or
  none**, read once at construction:
  - outside hydration, from the host — static template attributes are already
    written and no binding has run, and a root host created with
    `createComponent(…, { hostElement })` keeps the attribute it came with
    (`HostAttributeToken` is always `null` there);
  - while hydrating (`ngh` on the host, read as `MlvSelect` reads it), from the
    template through `HostAttributeToken`, because the claimed node may hold
    the server's `-1`.
- **The effect runs on the server**, so the attribute is in the pre-hydration
  markup. A server that rendered the anchor inert and a client whose first
  render is not — `[disabled]="!isBrowser"`, a login state only the browser
  knows, `[loading]` over client-fetched data — would otherwise leave that `-1`
  on an enabled link. So a hydrating client owns the `-1` from construction
  when the claimed node carries it together with `aria-disabled="true"` and
  the template writes no static `aria-disabled`, and takes it back on its
  first render. The host binding writes `aria-disabled="true"` when the server
  rendered the anchor inert and removes a static one when it did not, so the
  check keeps a consumer-bound `[attr.tabindex]="-1"` on a never-inert anchor
  untouched. A static `aria-disabled` is excluded because hydration re-applies
  static attributes to the claimed node before the component reads it. It is
  a heuristic, not proof, and it errs toward leaving a `-1` alone:
  - **Residual — mistaken for the server's mark:** an `aria-disabled="true"`
    bound by a directive on the same host, or by a consumer binding whose value
    changes after the server's first pass. Beside a bound
    `[attr.tabindex]="-1"` on an anchor that is never inert, either one takes
    that `-1` away on hydration. None in `libs/` or `apps/`, where no
    `a[mlvButton]` co-hosts a directive that binds `aria-disabled`, or binds
    it itself.
  - **Residual — not taken back:** an anchor with a static `aria-disabled`
    (the host binding overwrites it, so it has no effect on the rendered
    `aria-disabled`), no static `tabindex`, rendered inert by the server only,
    keeps the server's `-1` after hydration. Delete the static
    `aria-disabled`.
- **Residual, as on `a[mlvLink]`:** `tabindex="-1"` does not blur, so an
  anchor focused before it turned inert (an async action setting `loading`)
  keeps focus, and the Menu key or Shift+F10 opens its context menu, whose
  "Open in new tab" reads `href` and dispatches no `click`; so do
  screen-reader context-menu commands. By pointer, `pointer-events: none` on
  the disabled and loading modifiers stops the menu and middle-click.
- **`href` is kept while disabled**, as on `a[mlvLink]`: `RouterLink` rewrites
  a removed `href` on its next URL change and navigates without one anyway. The
  element stays `role="link"`, announced as disabled through `aria-disabled`.

Full contract: `.claude/projects/libs-button.md` § _Disabled activation guard
(#460)_.

## 3. What a consumer may need to do

Four shapes. None reaches code in `libs/` or `apps/` (§ 4).

### (a) Selectors or queries on the anchor's `disabled` attribute

- **Before:** `a.mlv-button[disabled]`, `a[mlvButton]:is([disabled])`, or
  `el.hasAttribute('disabled')` on an anchor button matched a disabled one.
- **After:** the attribute is never on an anchor.
- **Do:** select `.mlv-button--disabled` (or `.mlv-button--loading`), or
  `[aria-disabled="true"]`, which covers both. `button[disabled]` is unchanged.

### (b) `(click)` on a disabled button

- **Before:** a screen-reader or scripted click on a disabled anchor button ran
  its `(click)` (a pointer never reached it, because of `pointer-events:
none`); a scripted `dispatchEvent` on a disabled `<button>` ran it too.
- **After:** neither runs — the guard stops the click in the capture phase. The
  same holds for the click listener of a directive on the same host
  (`mlvMenuTrigger`, `mlvPopupTrigger`): a scripted or screen-reader click on a
  disabled button no longer opens its menu or popup.
- **Do:** if the click must reach your code (to explain why the action is
  unavailable, say), keep the button enabled and branch in the handler; to
  observe clicks on disabled buttons, listen on an ancestor in the capture
  phase — `fromEvent(el, 'click', { capture: true })`.

### (c) A `tabindex` bound dynamically on an anchor button

- **Before:** the component never touched `tabindex`.
- **After:** while inert the anchor carries `-1`; on re-enable it gets back the
  `tabindex` written **statically** in the template, or none. A value bound
  with `[attr.tabindex]` misbehaves both ways:
  - while inert, the binding overwrites the `-1` whenever its value changes,
    putting a disabled anchor back in the tab order (its first render still
    shows `-1`, because the component's effect runs after the parent's
    bindings);
  - on re-enable it is removed, and comes back only when its value next
    changes.
- **Do:** write the tabindex statically, or bind `-1` yourself while the
  button is disabled and re-emit your value after re-enabling. An anchor with
  an `href` is focusable already; it needs no tabindex at all.

### (d) Specs that pinned the old behaviour

- **Before:** a disabled anchor button carried `disabled="true"`, had no
  `tabindex`, and its scripted click reached `(click)`.
- **After:** assert `aria-disabled="true"` and `tabindex="-1"`, and assert the
  outcome of a click — `router.url`, or `defaultPrevented` on the click — not
  that `(click)` ran. A script-dispatched keydown produces no click, so a unit
  spec for Enter dispatches the click itself unless the keydown was cancelled
  (`press()` in `libs/cdk/accessibility/src/lib/click.spec.ts`; the
  disabled-anchor suite in `libs/core/button/src/lib/button/button.spec.ts`
  does the same).

## 4. In this repository

- No `a[mlvButton]` in `libs/` or `apps/docs` is ever disabled or loading (15
  anchor buttons, all in `apps/docs`: 13 `routerLink` / `href`, 2 href-less in
  card example 5; none binds `disabled`, `loading` or `tabindex`), so nothing
  renders or activates differently.
- The `<button mlvButton>` hosts that carry their own tabindex — the
  speed-dial actions, `apps/docs` compare example 6 — keep it: the component
  writes no `tabindex` on a `<button>` host.
- Every suite that depends on `core-button` (53 projects) passes unchanged.
