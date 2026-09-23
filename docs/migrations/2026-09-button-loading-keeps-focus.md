# 2026-09 — a loading `mlvButton` keeps focus and its tab stop

Applies to `@malva-ui/core/button` (`MlvButton`, `button[mlvButton]` /
`a[mlvButton]`). Fixes #324 (owner ruling D20). Composes with #460
([2026-09-button-anchor-disabled-activation.md](2026-09-button-anchor-disabled-activation.md)),
whose capture-phase click guard it now relies on.

**Breaking, behaviour only.** No exported symbol was renamed, removed or
retyped; no barrel changes; the selector, every input (`variant`, `shape`,
`disabled`, `loading`, `selected`), the slots, the BEM classes and the
`aria-disabled` / `aria-busy` host attributes are unchanged. What moves is
what `loading` does **on its own**: it no longer writes the native `disabled`
attribute on a `<button>` host, nor `tabindex="-1"` on an `<a>` host. A
loading button still announces itself as unavailable and busy, and still
activates nothing. An explicit `disabled` — alone or beside `loading` — is
unchanged. A consumer who binds `disabled` whenever it binds `loading`, or who
never binds `loading`, edits nothing.

`VERSIONING.md` § 3, row _Changed default behaviour at an unchanged API —
ordering, timing, emitted events, focus, ARIA_ (focus and tab order move; the
issue's "row 111" is the default-_value_ row, which does not apply). On the
`0.x` line that is a `!` commit, which `nx release` demotes to a minor:
`0.1.15` → `0.2.0` (§ 7; `docs/RELEASING.md` § 3.1).

## 1. What changed

`loading` wrote `[attr.disabled]` on every `<button>` host, exactly as
`disabled` did. Browsers move focus off a button that becomes `disabled` and
never give it back, so the commonest async pattern — press Save, the button
starts loading — dropped a keyboard or screen-reader user onto `<body>`: the
next Tab restarted from the top of the document, and a screen reader lost its
place. Since #460 a loading **anchor** also left the tab order through
`tabindex="-1"`.

Measured in Chromium, Firefox and WebKit (Playwright, real input) on a focused
submit button inside a `<form>` with a text field — a plain page reproducing
both mechanisms, the guard written exactly as `MlvButton`'s — then confirmed on
the component itself: in Chromium on `apps/docs` button example 8
(`libs/core/button/e2e/button.spec.ts`, red before this change) and in jsdom
for the `RouterLink`, `[mlvClick]` and form rows (`button.spec.ts`):

| Case                                                                                                                      | Before                                                 | After                                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| Focused `<button>` starts loading                                                                                         | **focus → `<body>`**, one `blur`, all three engines    | focus kept, no `blur`                                                    |
| Loading ends                                                                                                              | focus still on `<body>`                                | focus still on the button                                                |
| Tab onto a loading `<button>`                                                                                             | **skipped** (native `disabled`)                        | tab stop                                                                 |
| Tab onto a loading `a[mlvButton]`                                                                                         | **skipped** (`tabindex="-1"`, #460)                    | tab stop; its own `tabindex` untouched                                   |
| Loading `<button>` host attributes                                                                                        | `disabled`, `aria-disabled="true"`, `aria-busy="true"` | `aria-disabled="true"`, `aria-busy="true"`                               |
| Accessible name while loading                                                                                             | projected text (not focusable)                         | projected text, e.g. "Saving…" — the loader's `progressbar` is not in it |
| Pointer click, `el.click()`, Enter, Space, screen-reader activation                                                       | nothing                                                | nothing — stopped by the capture guard                                   |
| Implicit submission (Enter in a text field; the browser clicks the default button)                                        | no submit                                              | no submit — the guard `preventDefault()`s that synthetic click           |
| `form.requestSubmit()` / `requestSubmit(button)` from script                                                              | submits                                                | submits — unchanged; it bypasses buttons, `disabled` never stopped it    |
| Consumer `(click)`, co-hosted `[mlvClick]`, `mlvMenuTrigger` / `mlvPopupTrigger` click                                    | do not run                                             | do not run                                                               |
| Loading `a[mlvButton][routerLink]`, click or Enter                                                                        | no navigation                                          | no navigation                                                            |
| Loading `<button>` matches `:disabled` / `[disabled]`; `button.disabled`                                                  | yes / yes / `true`                                     | **no / no / `false`**                                                    |
| `:active` while Space is held on a focused loading button (Chromium)                                                      | n/a (not focusable)                                    | not painted — every `:active` rule skips `--loading`                     |
| Co-hosted `mlvMenuTrigger` / `[mlvContextMenuTrigger]` / anchor `[mlvClick]` keydown, `mlvPopupTrigger triggerOn="focus"` | unreachable (not focusable)                            | **run** on a focused loading button (§ 2, residual; § 3 (c))             |
| `[attr.tabindex]="-1"` bound on a loading anchor, client-rendered                                                         | removed when loading ends (#460 residual)              | kept                                                                     |
| The same, server-rendered and hydrated while still loading                                                                | kept while loading, removed when it ends               | **removed at hydration** (§ 2, residual)                                 |
| `disabled` bound (with or without `loading`)                                                                              | native `disabled` / anchor `-1`; focus lost            | unchanged                                                                |
| Enabled button, any activation                                                                                            | activates                                              | unchanged                                                                |

## 2. Mechanism

- **`[attr.disabled]` follows `disabled()` alone**:
  `'(!_isAnchor && disabled()) || null'`. `aria-disabled` and the click guard
  still follow `_inert()` = `disabled() || loading()`; `aria-busy` follows
  `loading()`.
- **The anchor `tabindex` effect keys on `disabled()`**, so a loading anchor
  keeps its tab stop — one rule for both hosts: `loading` blocks activation,
  `disabled` also leaves the tab order.
- **The capture guard is the whole block for a loading `<button>`.** It is the
  `fromEvent(host, 'click', { capture: true })` stream #460 installed on every
  host; with no native `disabled` the click now reaches it, and
  `preventDefault()` + `stopImmediatePropagation()` cancel the native action
  (form submission included) and every bubble listener on the host and its
  ancestors, whatever the registration order. Ablated (guard reading only
  `disabled()`), five button specs go red: the busy-state spec, form
  submission plus the consumer `(click)`, the co-hosted `[mlvClick]`, and both
  loading-anchor navigation specs (#460's and this change's).
- **`:active` is guarded in CSS.** Chromium matches `:active` on a focused
  button while Space is held even under `pointer-events: none`, so a blocked
  press would have painted the pointer-down fill, the 0.97 shrink, the elevated
  shadow and the outlined border. Each of the three `:active` rules in
  `button.scss` is `&:not(:where(.mlv-button--loading)):active`; `:where()`
  adds zero specificity, so the emission-order contests are unchanged. Of the
  sixteen hosts that bind `loading` (§ 4), one is reached by a `:disabled`
  selector: `mlv-search-field`'s submit, through
  `.mlv-search-field__submit:hover:not(:disabled)`
  (`search-field.scss:84`), which a loading submit now passes. It does match
  in Chromium after a pointer click: Chromium keeps `:hover` on an element
  that turns `pointer-events: none` until the pointer next moves (Firefox and
  WebKit clear it), so the rule sets `--mlv-btn-text-color` to
  `--mlv-text-primary` on the loading submit. It paints nothing, because the
  loading submit renders only the projected `mlv-loader`, whose stroke is
  `--mlv-l-color`, not `currentColor` (`search-field.html`, `loader.scss`).
  No other `:disabled` / `[disabled]` rule in `libs/` or `apps/` reaches a
  host that loads — the rest sit on plain buttons or on hosts that never load
  — so the resting and hovered loading look is painted identically. What is
  new is focus styling on a button that can now be focused: its
  `:focus-visible` ring. `mlv-search-field`'s `:focus-visible` colour rule
  also matches the loading submit and, like the hover rule, paints nothing on
  the loader.
- **Server rendering.** The pre-hydration markup of a loading anchor carries
  `aria-disabled="true"` and no `-1`; a disabled one still carries `-1`
  (`ssr-smoke.spec.ts`, `button-ssr.spec.ts`).
- **Residual — co-hosted keydown and focus handlers.** The guard stops the
  `click`, and only the click. In this library: `mlvMenuTrigger` opens its
  menu on Enter / Space / ArrowDown / ArrowUp **keydown**, gated only by its
  own `menuTriggerDisabled`; `[mlvContextMenuTrigger]` (targeted, the
  default) opens its menu on the ContextMenu key or Shift+F10 **keydown**,
  gated only by `contextMenuDisabled`; `mlvPopupTrigger` with
  `triggerOn="focus"` opens on **focus** and has no disabled input;
  `[mlvClick]` on an anchor host emits on **keydown** for Space, and for any
  activation key when the anchor has no `href`. On a focused loading button
  each of these now runs, where native `disabled` used to keep the button from
  being focused at all. No host in `libs/` or `apps/` combines one with
  `loading` alone: `mlv-filter`'s trigger
  co-hosts `mlvPopupTrigger` with `loading`, but binds `disabled` too and uses
  the click trigger. A shared "inert host" contract the trigger directives
  honour is #506. See § 3 (c).
- **Residual — hydration.** #460's reconcile treats `aria-disabled="true"`
  beside `tabindex="-1"` on a claimed anchor as the server's own `-1`, and
  takes it back on the client's first render if the anchor is not disabled. A
  loading-only anchor now writes the first without the second, so a
  server-loading anchor with a consumer-bound `[attr.tabindex]="-1"` reads as
  the mark and loses that `-1` at hydration. Pinned at `null` in
  `button-ssr.spec.ts`, in two cases that differ in what is new:
  - **Loading on the server only** (`loading-bound`): unchanged. The server
    wrote `-1` for loading too, and the client removed it the same way on its
    first render that was neither disabled nor loading.
  - **Loading on both sides** (`loading-both-bound`): **new.** Before, the
    client wrote its own `-1` while loading, which coincided with the
    consumer's, and the consumer's went only when loading ended (the restore
    is to the template's `tabindex`, and a binding leaves none). Now it goes
    at hydration, and the anchor is a tab stop for the rest of the load.
    Measured on both sources with a throwaway round-trip probe.

  Not fixed, because the claimed node cannot tell this `-1` from the
  component's own: a disabled + loading server render carries the same
  `aria-disabled` and `aria-busy`, and hydration rewrites `class` from the
  template. Keeping a marked `-1` while the client is loading would restore
  the old timing, but would also keep a disabled + loading render's `-1` on
  an anchor the client renders loading only — the defect this change fixes.
  Client-rendered, the same binding now fares better: `loading` never touches
  it, so it survives loading's end, where before it was removed then. None in
  `libs/` or `apps/`. Write that `tabindex` statically.

Full contract: `.claude/projects/libs-button.md` § _Loading keeps focus
(#324)_.

## 3. What a consumer may need to do

### (a) Code or selectors that read "loading" through `disabled`

- **Before:** `button.disabled`, `button:disabled`, `button[disabled]`,
  `el.hasAttribute('disabled')` and `toBeDisabled()` were true for a loading
  button.
- **After:** false while only loading.
- **Do:** read `.mlv-button--loading`, or `[aria-disabled="true"]` for "blocked
  for either reason". A spec asserting `button.disabled === true` on a loading
  button asserts `getAttribute('aria-disabled') === 'true'` and
  `hasAttribute('disabled') === false` instead, plus the outcome of a click
  (`view-variant-status.spec.ts` and `search-field.spec.ts` are the in-repo
  examples).

### (b) A loading button that must also leave the tab order

- **Before:** `[loading]="saving()"` alone removed the button from the tab
  order while it lasted.
- **After:** it stays a tab stop, announced unavailable and busy.
- **Do:** nothing, in the common case — keeping focus is the point. If the
  button must really be unreachable while busy, bind `disabled` too:
  `[disabled]="saving()" [loading]="saving()"`. That keeps native semantics,
  and so drops focus exactly as before.

### (c) A keydown or focus directive on a loading button

`mlvMenuTrigger`, `[mlvContextMenuTrigger]`, `mlvPopupTrigger` with
`triggerOn="focus"`, or `[mlvClick]` on an anchor host.

- **Before:** unreachable while loading.
- **After:** focusable; a keyboard user can open the menu with Enter / Space /
  ArrowDown / ArrowUp (not through `click`, which the guard still stops), open
  a context menu with the ContextMenu key or Shift+F10, a focus popup opens on
  focus, and `[mlvClick]` on an anchor emits on Space (on any activation key
  without `href`).
- **Do:** bind the directive's own disabled input — `[menuTriggerDisabled]`,
  `[contextMenuDisabled]` — or `disabled` beside `loading`. (`mlvPopupTrigger`
  has no disabled input: bind `disabled`.)

### (d) A `tabindex` bound with `[attr.tabindex]="-1"` on a loading anchor under hydration

- **Before:** lost at hydration if the server rendered the anchor loading and
  the client does not; otherwise kept while loading and lost when it ended.
- **After:** lost at hydration whenever the server rendered the anchor
  loading — the client still loading included. Client-rendered, it is now
  kept through loading and after.
- **Do:** write it statically (§ 2, residual).

## 4. In this repository

Sixteen `mlvButton` hosts bind `loading`, all on `<button>`:

- **Loading only — now keep focus and their tab stop while busy:**
  `mlv-search-field`'s submit (a focused submit stays focused through the
  search it started; its own `_submit()` also ignores clicks while loading),
  `mlv-view-variant-list`'s two create buttons, `mlv-view-variant-status`'s
  five clone / update / create buttons, `apps/docs` button example 8, and the
  website-builder showcase's Save (while it is dirty).
- **Bind `disabled` while loading — unchanged, still drop focus:**
  `mlv-filter`'s trigger (`_editorDisabled()` is `disabled() || loading()`),
  `mlv-smart-filter-bar`'s query button (`[disabled]="disabled() ||
loading()"`), `apps/docs` form-field example 4
  (`[disabled]="fields().submitting()"`), and the settings-access showcase's
  dock Save, Invite and Transfer (each disabled condition is true while its
  action runs).
- No `a[mlvButton]` binds `loading`, and no host co-hosts `mlvMenuTrigger`,
  `[mlvContextMenuTrigger]`, `mlvPopupTrigger` or `[mlvClick]` with `loading`
  alone. The one co-host,
  `mlv-filter`'s trigger (`filter.html`, `[mlvPopupTrigger]` beside
  `[loading]`), also binds `[disabled]="_editorDisabled()"` and uses the click
  trigger.
- `view-variant-status.spec.ts` asserted `button.disabled === true` on the busy
  button; it now asserts `aria-disabled` and no native `disabled`. Every other
  suite depending on `core-button` passes unchanged.
