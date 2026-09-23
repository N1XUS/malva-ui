# 2026-09 — `a[mlvLink]` activates like a native link

Applies to `@malva-ui/core/link` (`MlvLink`, `a[mlvLink]`). Fixes #309.

**Breaking, behaviour only.** Nothing exported was renamed, removed or retyped;
no barrel changes; the selector, both inputs (`variant`, `disabled`), the
`*mlvLinkBefore` / `*mlvLinkAfter` slots, the BEM classes and the host
attributes (`aria-disabled="true"`, `tabindex="-1"` while disabled) are
unchanged. What moves is which activations reach the browser, `RouterLink` and
the consumer's own listeners. A consumer whose links carry a real `href` or a
`routerLink` and who binds no `(click)` on a disabled link edits nothing.

`VERSIONING.md` § 3, row _Changed default behaviour at an unchanged API —
ordering, timing, emitted events_. On the `0.x` line that is a `!` commit, which
`nx release` demotes to a minor: `0.1.15` → `0.2.0` (§ 7;
`docs/RELEASING.md` § 3.1).

## 1. What changed

Until now the component bound three host listeners — `(click)`,
`(keydown.enter)`, `(keydown.space)` — each `disabled() && $event.preventDefault()`.
That expression was wrong in both states:

- **Disabled:** `preventDefault()` cancels the browser's navigation but not
  `RouterLink`, whose `onClick` calls `Router.navigateByUrl()` without reading
  `defaultPrevented` or `href`. So a disabled `a[mlvLink][routerLink]`
  navigated on screen-reader activation or `el.click()` (Enter did not reach
  it — the keydown was cancelled). No host listener could have stopped it:
  Angular coalesces every host and template `(click)` on one element into one
  native listener and walks the whole chain.
- **Enabled:** the expression evaluates to `false`, and Angular's DOM renderer
  calls `preventDefault()` on any listener that returns `false`. So every
  click, Enter and Space on an **enabled** link was cancelled: a plain `href`
  never followed on click, Ctrl/⌘ + click and `target="_blank"` opened nothing,
  and Enter activated no link at all, `routerLink` included (the keydown was
  cancelled, so the browser never produced the click). Only a pointer click on
  a `routerLink` worked, because `RouterLink` ignores `defaultPrevented` — and
  almost every link in the docs app is a `routerLink`, which is how the enabled
  half went unnoticed.

Measured in jsdom against `a[mlvLink]` at `97b7062a` and after this change
(`defaultPrevented` of the dispatched event, `router.url`, listener counts):

| Activation                                                              | Before                                                       | After                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Enabled plain `href`, click                                             | cancelled — `href` never followed                            | **followed**                                                            |
| Enabled `href="#"`, click                                               | own `(click)` runs, `#` cancelled                            | own `(click)` runs, **browser follows `#`**                             |
| Enabled `routerLink`, plain click                                       | navigates                                                    | navigates — unchanged                                                   |
| Enabled link, Ctrl/⌘/Shift + click, or `target="_blank"`                | cancelled — no new tab or window                             | **opens it**                                                            |
| Enabled link, Enter                                                     | keydown cancelled, no click — nothing, `routerLink` included | keydown left alone; the browser's click **follows / navigates**         |
| Disabled `routerLink`, click (screen reader, `el.click()`)              | `defaultPrevented`, but **navigates**                        | cancelled; no navigation, no `NavigationStart`                          |
| Disabled plain `href`, click                                            | cancelled                                                    | cancelled — unchanged                                                   |
| Disabled link, own `(click)` and bubble-phase listeners on ancestors    | run                                                          | **do not run**                                                          |
| Disabled link, capture-phase listeners on ancestors (CDK click-outside) | run                                                          | run — unchanged                                                         |
| Disabled link, Enter                                                    | keydown cancelled — nothing                                  | keydown left alone; its click is cancelled — nothing                    |
| Space, enabled **or disabled**                                          | keydown cancelled; the page does not scroll                  | keydown left alone; **the page scrolls** (Space is not link activation) |
| Disabled link, pointer                                                  | never reaches the anchor (`pointer-events: none`)            | unchanged                                                               |

Middle-click is `auxclick`, not `click`; neither version touches it.

## 2. Mechanism

- All three host listeners are gone. The disabled guard is one
  `fromEvent(host, 'click', { capture: true })` stream, released by
  `takeUntilDestroyed()`; while `disabled()` (read per click) it calls
  `preventDefault()` and `stopImmediatePropagation()`. `mlv-segmented`'s link
  item carries the same guard.
- **Capture is the mechanism.** At `AT_TARGET` the capture pass runs before the
  bubble pass whatever the registration order, so the guard beats
  `RouterLink`, the consumer's `(click)`, a co-hosted `[mlvClick]`'s click
  emission, and a listener a consumer attached to the anchor before the
  component existed; for a click on the inner text span it runs before the
  event reaches the target at all. Capture listeners on **ancestors** still run
  first.
- **No keydown handler.** With an `href`, the browser turns Enter into the
  `click` the guard sees; without one, Enter activates nothing natively. Space
  is not link activation, so there is nothing to cancel
  (`.claude/rules/angular-directive.md`, #299).
- **`href` is kept while disabled.** `RouterLink`'s own `[attr.href]` host
  binding rewrites a removal on its next URL change (host bindings have no fixed
  precedence — the last changed value wins), and `RouterLink` navigates without
  an `href` anyway. So the element stays `role="link"`, announced as disabled
  through `aria-disabled`.

Full contract: `.claude/projects/libs-link.md` § _Disabled activation guard_.

## 3. What a consumer may need to do

Four shapes. Only (a) reached code in `apps/` (§4).

### (a) `href="#"` as a pseudo-button

- **Before:** `<a mlvLink href="#" (click)="save()">` ran `save()` and nothing
  else — the component cancelled the `#` navigation by accident.
- **After:** `save()` runs **and** the browser follows `#`: the URL gains a
  hash and the page scrolls to the top. Under a `<base href>` (every Angular
  CLI app has `<base href="/">`), `#` resolves against the base, so from any
  route but the root it is a **different document** — a full reload onto
  `/#` that discards application state.
- **Do:** an action is a button — `button[mlvButton]`. A link that goes
  somewhere gets a real `href` or `routerLink`. To keep an anchor that goes
  nowhere, cancel it yourself: `(click)="save(); $event.preventDefault()"`.

### (b) `(click)` on a disabled link, or a delegated listener above it

- **Before:** a screen-reader or scripted click on a disabled link reached the
  link's own `(click)` and every ancestor's listener (a pointer never did,
  because of `pointer-events: none`).
- **After:** neither runs — the guard stops the click in the capture phase.
  Only capture-phase listeners on ancestors still see it.
- **Do:** if the click must reach your code, keep the link enabled and branch
  in the handler; to observe clicks on disabled links (analytics, a row
  click), listen on the ancestor in the capture phase —
  `fromEvent(el, 'click', { capture: true })`.

### (c) Opening links yourself

- **Before:** Ctrl/⌘/Shift + click and `target="_blank"` were cancelled, so a
  consumer may have added `(click)` that calls `window.open()` or
  `router.navigate()` to make them work.
- **After:** the browser opens the tab or window itself, so such a handler now
  opens a **second** one.
- **Do:** delete the workaround, or end it with `$event.preventDefault()`.

### (d) Specs that pinned the old events

- **Before:** an enabled link's click and Enter / Space keydown came back
  `defaultPrevented`; a disabled link's scripted click reached `(click)`.
- **After:** an enabled link's events are not cancelled, and a disabled link's
  scripted click reaches no bubble listener.
- **Do:** assert the outcome instead — `router.url`, or `defaultPrevented` on
  the **click**. A script-dispatched keydown produces no click in jsdom or a
  browser, so a unit spec for Enter dispatches the click itself unless the
  keydown was cancelled (`press()` in
  `libs/cdk/accessibility/src/lib/click.spec.ts`; the disabled-activation
  suite in `libs/core/link/src/lib/link/link.spec.ts` does the same).

## 4. In this repository

- `apps/docs` link examples 1 and 2 used `href="#"` on six enabled links, which
  would now reload the docs app onto `/#`. They point at real docs routes
  instead — `routerLink` to `/button`, `/kbd`, `/list` and `/notification` —
  and import `RouterLink`. The disabled demo keeps `href="#"`, which the guard
  never follows. In the StackBlitz playground (`provideRouter([])`) those links
  match no route, as `segmented` example 2's already do.
- The getting-started page's VERSIONING link (plain `href`,
  `target="_blank"`) did nothing on click before; it now opens.
- Every other `a[mlvLink]` in `apps/docs` is a `routerLink` (home page, home
  bento, `page` example 1): pointer clicks are unchanged, and Enter and
  Ctrl/⌘ + click now work.
- `mlv-filter`'s clear link (`a[mlvLink]` without `href`, `[mlvClick]`,
  `[disabled]`) moves only where a disabled link's scripted click used to
  reach `mlvClick` — `_clearDraft()` already returned early there. Enter /
  Space come from `MlvClick`'s keydown path, which the guard does not touch.
  Its suite passes unchanged.
- Not fixed here: `a[mlvButton][routerLink][disabled]` has the same
  disabled-`routerLink` defect (its host `(click)` cannot stop `RouterLink`)
  and stays in the tab order. Fixed by #460 —
  [2026-09-button-anchor-disabled-activation.md](2026-09-button-anchor-disabled-activation.md).
