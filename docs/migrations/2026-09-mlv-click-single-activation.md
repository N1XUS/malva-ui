# 2026-09 — `MlvClick` emits once per activation

Applies to `@malva-ui/cdk/accessibility` (`MlvClick`, `[mlvClick]`), and to the
two library consumers moved off it on native buttons: `@malva-ui/core/pagination`
and `@malva-ui/core/notification`. Fixes #299.

**Breaking, behaviour only.** Nothing exported was renamed, removed or retyped;
no barrel changes; the selector, both inputs (`disabled`, `hostRole`) and the
output (`mlvClick: MouseEvent | KeyboardEvent`) are unchanged. What moves is how
many times `mlvClick` fires for one key press, which event it carries, and
whether Space's default still runs. A consumer whose host is a `<div>`, a
`<span>`, an `<a>` without `href` or a custom element edits nothing.

## 1. What changed

Until now the directive listened to Enter / Space keydown and to `click`
independently, and documented exactly that: "Emits on native click, Enter
keydown, or Space keydown". On a host that turns the key into a `click` of its
own, one press therefore emitted twice — once for the keydown, once for the
click the browser synthesised from it. In this repository that made
pagination's Next skip a page (and walk `currentPage` past `totalPages`),
notification actions run their callback twice, and two docs demos add two
items per press.

Emissions per key press, measured in Chrome 153 with trusted input:

| Host                                                                          | Enter: before → after | Space: before → after                                            |
| ----------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------- |
| `button`, `input[button\|submit\|reset\|image\|file\|color]`, first `summary` | 2 → **1** (the click) | 2 → **1** (the click)                                            |
| `input[checkbox\|radio]`                                                      | 1 → 1 (keydown)       | 2 → **1** (the click)                                            |
| `a[href]`, `area[href]`                                                       | 2 → **1** (the click) | 1 → 1 (keydown); `a[href]` and `area[href]` **no longer scroll** |
| `div`, `span`, `a` / `area` without `href`, custom elements                   | 1 → 1 (keydown)       | 1 → 1 (keydown), **no longer scrolls**                           |
| `input` (text types), `textarea`, `select`, `contenteditable`                 | 1 → 1 (keydown)       | 1 → 1 (keydown), Space still types / opens                       |

`a[href]` / `area[href]` + Space emitted before this change as well — only the
lost scroll is new.

The same count applies when the native control is a **descendant** of a
non-native host rather than the host itself — in light DOM or inside an open
shadow root (a web component, a `ViewEncapsulation.ShadowDom` child): its click
bubbles to the host and is the one emission, where the keydown bubbling out of
it used to be a second.

## 2. Mechanism

One `keydown` stream, merged with the `click` stream:

1. Enter or Space with no modifier (`hasModifierKey`, the match Angular's
   `keydown.enter` / `keydown.space` gave the old listeners).
2. Dropped when the element the key was pressed on turns that key into a
   `click` — the measured table above, read per press so a bound `href` /
   `type` counts. That element is `event.composedPath()[0]`, not
   `event.target`, which a shadow root retargets to its host. The click is then
   the one emission.
3. Space the directive does emit for is `preventDefault()`ed when that element
   is the host itself and the host does not own Space (`input`, `textarea`,
   `select`, `contenteditable`).

Three shapes still emit twice, all unusual and all documented on the class: a
focusable element **inside** a `<button>` host (the browser activates the
button ancestor, not the focused element; a button's content model forbids
such descendants); Enter in a text field of a `<form>` that the host wraps
(implicit submission clicks the form's submit button); and a native control
inside a **closed** shadow root below the host (a closed root hides its tree
from `composedPath()` too, so the directive sees only the shadow host —
measured, and pinned by a spec so this list cannot go stale silently).

Full rule and the measured table: `.claude/projects/libs-accessibility.md`
§ _Activation rule (#299)_.

## 3. What a consumer may need to do

Six shapes. Only (e) reaches code in `libs/` or `apps/` (§4).

### (a) A script-dispatched keydown on a native host

- **Before:** `button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))`
  on a `<button mlvClick>` emitted once (the `KeyboardEvent`).
- **After:** **0.** The directive leaves the key to the browser, and neither a
  browser nor jsdom turns an untrusted keydown into a `click` (measured: an
  untrusted Enter on a `<button>` in Chrome 153 produces no click).
- **Do:** in a unit spec, dispatch the `click` the browser would after the
  keydown (`press()` in `libs/cdk/accessibility/src/lib/click.spec.ts` is the
  reference), or assert on a pointer click. In a browser test, press a trusted
  key (Playwright `keyboard.press`). `@testing-library/user-event` v14 also
  dispatches the click itself for Enter / Space on a button — it is not used in
  this workspace and was not measured here.

### (b) Another listener cancels the keydown on a native host

- **Before:** 1 (the keydown), whatever the other listener did.
- **After:** **0.** A cancelled keydown suppresses the browser's activation —
  measured with `preventDefault()` on the target and on a bubbling ancestor,
  0 clicks — and the directive no longer emits for the keydown.
- Typical sources: an ancestor keymap or hotkey handler that cancels Enter, a
  co-hosted directive that calls `preventDefault()` on Enter / Space. CDK's own
  `cdkMenuItem` is **not** one: in `@angular/cdk` 22 it skips
  `preventDefault()` on `A` / `BUTTON` hosts and, for trusted keys, leaves them
  to the native click (`eventDispatchesNativeClick`).
- **Do:** stop cancelling Enter / Space on native controls, or run the action
  from the listener that cancels it (for a co-host, its own activation output).

### (c) A native child that stops its click, inside a non-native host

- **Before:** Enter on the child emitted once on the host (the keydown bubbled),
  while a **pointer** click on the same child emitted nothing — the child
  stopped the click.
- **After:** **0** for both. Keyboard now behaves like the pointer.
- **Do:** if the host must hear the child's activation, let the click
  propagate, or handle it on the child.

### (d) The payload on native hosts

- **Before:** keyboard activation emitted a `KeyboardEvent` first (plus the
  click).
- **After:** only the browser's click. In Chromium it is a `PointerEvent` with
  `detail === 0` and `pointerType === ''`; a pointer click has `detail >= 1`
  (measured). `event instanceof KeyboardEvent` and `event.key` checks flip on
  native hosts. Non-native hosts still emit the `KeyboardEvent`.
- **Do:** `event instanceof KeyboardEvent || event.detail === 0` tells a
  keyboard **or programmatic** activation from a counted pointer click — a
  script `el.click()` carries `detail === 0` as well (measured). To exclude
  script clicks, test `event.detail === 0 && event.isTrusted`: the browser's
  keyboard click is trusted, `el.click()` and a dispatched `MouseEvent` are
  not.

### (e) Space on a non-native host is cancelled

- **Before:** Space emitted and its default ran, so the page or panel scrolled
  (760px on the docs `mlv-select` page).
- **After:** `keydown.defaultPrevented === true`, no scroll. A later listener
  that skips prevented events (`if (event.defaultPrevented) return;`) now skips
  Space on these hosts. Not cancelled: a host that owns Space (`input`,
  `textarea`, `select`, `contenteditable`), a descendant's own Space (one in
  the host's own shadow root included), a Space pressed with a modifier.
- **Do:** usually nothing — this is the WAI-ARIA APG button behaviour. A
  listener that must still act reads `event.key` instead of `defaultPrevented`,
  or listens in the capture phase.

### (f) A focused `<button>` that becomes `disabled`

- **Before:** Enter / Space emitted once — the browser still delivers the
  keydown to the focused element.
- **After:** **0.** A disabled button has no activation, so no click follows
  (measured). This matches the button's own `(click)`. CDK's
  `eventDispatchesNativeClick` agrees on the premise — a disabled button
  dispatches no native click — but then activates `cdkMenuItem` on the keydown
  itself; `MlvClick` deliberately does not.
- **Do:** nothing if that is the intent. A control that must stay operable
  while looking disabled takes `aria-disabled`, not `disabled`.

## 4. In this repository

- Moved to `(click)`, each a native `button[mlvButton]`: pagination's
  previous / next / page-number buttons, notification actions, and the docs
  examples `tabs/3`, `notification/4`, `toast/3`, `slider/4`. The directive fix
  alone would have made them correct; `(click)` also drops a redundant
  `role="button"` / `tabindex="0"` and the `@malva-ui/cdk/accessibility`
  dependency.
- Kept on `mlvClick`, all non-native and so affected only by (e): the
  `mlv-select` trigger (`div`), `mlv-drawer-sections` rows (`mlv-list-item`)
  and the `mlv-filter` clear link (`a[mlvLink]` without `href`). Space no longer
  scrolls; Enter is unchanged; their suites pass unchanged.
