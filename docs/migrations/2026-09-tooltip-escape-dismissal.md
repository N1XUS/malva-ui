# 2026-09 — Escape dismisses a tooltip wherever focus is, and only the tooltip

Applies to `@malva-ui/core/tooltip` (`MlvTooltip`, `[mlvTooltip]`). Fixes #319
(audit OVERLAYS-10; owner ruling D13).

**Breaking, behaviour only.** No exported symbol was renamed, removed or
retyped; no barrel, selector, input, output, token, i18n key or BEM class
changed. `[mlvTooltip]`'s six inputs keep their names, types and defaults. What
moves is **which keystroke reaches what**: Escape now dismisses a visible
tooltip from anywhere on the page, and the press that dismisses it no longer
reaches the dialog, drawer, popup or speed-dial the tooltip sits in, nor any
bubbling `keydown` listener on `document` / `window`. Every other key — Escape
with a modifier held included — passes the tooltip by, exactly as before.

`VERSIONING.md` § 3, row _Changed default behaviour at an unchanged API —
ordering, timing, emitted events, focus_ (row 112): inside a dialog the first
Escape no longer closes it, so `afterClosed()` no longer emits and focus is no
longer restored on that press. The other half — Escape now dismissing a
hover-shown tooltip at all (WCAG 1.4.13) — is the _Bug fix that restores
documented behaviour_ row on its own (row 117: the directive documented
"disappears … on Escape key"), and ships in the same change. On the `0.x` line
a `!` commit is demoted to a minor: `0.1.15` → `0.2.0` (§ 7;
`docs/RELEASING.md` § 3.1).

A consumer who binds no Escape handler of their own on `document` / `window`,
and whose tooltips do not sit inside an overlay that closes on Escape, edits
nothing.

## 1. What changed

Escape used to be a host `(keydown.escape)` listener on the tooltip's own
trigger. Two defects followed:

- **A hover-shown tooltip could not be dismissed from the keyboard.** The
  listener fires only while focus is on the host, so with focus anywhere else
  Escape did nothing. WCAG 1.4.13 (_Content on Hover or Focus_) requires such
  content to be dismissible "without moving pointer hover or keyboard focus".
- **Inside a dialog, one Escape closed both.** The tooltip overlay had no
  `keydownEvents()` subscriber, so CDK's `OverlayKeyboardDispatcher` — one
  bubbling `keydown` listener on `<body>` that walks the attached overlays from
  the top and stops at the first **with an observer** — never stopped at it.
  With focus on the described button, the host listener hid the tooltip, the
  same keystroke bubbled on to `<body>`, and the dispatcher handed it to the
  dialog, which closed.

Now `_show()` subscribes the tooltip overlay's `keydownEvents()`, and the
overlay is created with an `eventPredicate` that admits only an unmodified
Escape keydown. Being attached last, the tooltip overlay is the topmost one,
so the dispatcher gives it that Escape first; the handler calls
`preventDefault()` and `stopPropagation()` and hides the tooltip, and the
dispatcher delivers the key to no overlay below. The first Escape closes only
the tooltip — the APG tooltip pattern and `MatTooltip`'s behaviour; the second
reaches the container. Any other key fails the predicate, so the dispatcher
skips the tooltip and hands it to the overlay below as it always did.

Measured in jsdom against `origin/main` @ `750cdb8f` and after this change
(`tooltip.spec.ts` → _MlvTooltip — Escape_ and _… inside an MlvDialogService
dialog_; `speed-dial.spec.ts` → _lets a visible action label take the first
Escape and closes on the second_):

| Situation                                                                                               | Before                                                                   | After                                                                      |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Hover-shown tooltip, focus on another element, Escape                                                   | tooltip stays (pane still attached)                                      | **tooltip hidden**, event `defaultPrevented`                               |
| Hover-shown tooltip, focus on `<body>`, Escape                                                          | tooltip stays                                                            | **tooltip hidden**                                                         |
| Focus on the host, tooltip visible, Escape                                                              | tooltip hidden; `document` listeners see it                              | tooltip hidden; **bubbling `document` / `window` listeners do not see it** |
| Tooltip on a button in an `MlvDialogService` dialog, focus on it, Escape                                | tooltip hidden **and** dialog closes                                     | tooltip hidden, **dialog stays open**; the next Escape closes it           |
| `mlv-speed-dial` action focused ≥ 300 ms (label tooltip up, `showTooltips` default on), Escape          | label hidden **and** dial closes                                         | label hidden, **dial stays open**; the next Escape closes it               |
| Tooltip visible over a dialog / drawer / popup; Enter, Ctrl+S or any other non-Escape key               | reaches that overlay's `keydownEvents()`                                 | unchanged — the `eventPredicate` passes it by                              |
| Tooltip visible over a dialog / drawer / popup; Escape with Shift / Alt / Ctrl / Meta held              | tooltip stays; the overlay below gets it (a popup or drawer closes)      | unchanged — `hasModifierKey` fails the predicate                           |
| Focus on the host, show still pending (inside `tooltipDelay`), Escape                                   | pending show cancelled; the key passes through                           | unchanged                                                                  |
| Focus on the host, tooltip visible, an overlay opened **above** it (popup opened from the host), Escape | that overlay takes it **and** the tooltip hides                          | unchanged — the tooltip hides one task later (host fallback)               |
| Focus elsewhere, tooltip visible, an overlay opened **above** it, Escape                                | that overlay takes it; the tooltip stays, and no later Escape reaches it | that overlay takes it; the tooltip stays, and **takes the next Escape**    |
| Focus on the host, tooltip visible, an ancestor stops Escape propagation below `<body>`                 | tooltip hides (host listener)                                            | unchanged — the tooltip hides one task later (host fallback)               |
| No tooltip visible                                                                                      | —                                                                        | unchanged: the key reaches whatever it reached before                      |

## 2. Who is affected

- **Tooltips inside a container that closes on Escape through the CDK keyboard
  dispatcher**: `MlvDialogService` / `ng-template[mlvDialog]` dialogs,
  `MlvDrawerService` / `<mlv-drawer>` drawers (`closeOnEscape`),
  `MlvPopupService` popups (select, combobox, the date / time pickers,
  `mlv-color-picker-popup`, `mlv-popup-container`), and `mlv-speed-dial`. While
  a tooltip is **visible**, the first Escape closes only the tooltip. This is
  the D13 ruling, not a side effect. In-repo, `mlv-speed-dial`'s action labels
  are the one shipped surface that moves (measured above).
- **Containers that handle Escape with their own `keydown` listener below
  `<body>`** — `mlv-menu`'s panel, `mlv-color-picker-popup`'s input, the drawer
  resize handle — run **before** the key reaches `<body>` when focus is inside
  them. They close exactly as before, and a tooltip whose host they destroy
  goes with it. `mlv-menu`'s panel and the drawer resize handle do not stop
  propagation, so the key still reaches `<body>`: a hover-shown tooltip visible
  while focus is inside an open `mlv-menu` panel, and topmost there, also hides
  on that same press — and a bubbling `document` listener does not see it
  (next bullet). The colour-picker input stops propagation, so a hover-shown
  tooltip stays up on that press (the focus-elsewhere limit in § 4).
- **Bubbling `keydown` listeners on `document` or `window`** —
  `@HostListener('document:keydown.escape')`, `(document:keydown.escape)` host
  bindings, `fromEvent(document, 'keydown')` — do not see the one press that
  dismisses a visible tooltip. In-repo, five drag cancellations listen on
  `document` in the bubble phase: the taskboard card and column drags
  (`taskboard-sortable.ts`, `taskboard-column-sortable.ts`), the scheduler's
  event drag-move and its range-selection / resize gesture
  (`scheduler-drag.service.ts`,
  `scheduler-pointer.ts`) and the editor's block drag
  (`editor-block-handle.ts`). They are reached only if a tooltip is up during a
  drag, and the next Escape cancels.
- **Specs** that dispatch Escape on `document.body` or an unrelated element
  and expect a visible tooltip to stay, or that open a tooltip inside a dialog
  and expect one Escape to close the dialog.

Not affected: a tooltip that is not visible (a pending show included); every
key other than an unmodified Escape, which reaches the overlay below a visible
tooltip exactly as before; and an overlay opened above the tooltip — the
dispatcher still gives it Escape first, and with focus on the host the tooltip
still hides on that same press.

## 3. What to do

| Shape                                                                                    | Do                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A dialog / drawer / popup that must close on the **first** Escape even with a tooltip up | Nothing is configurable: this is the APG model. If a flow genuinely needs it, drop the tooltip on the element that is focused when the container opens (`tooltipDisabled`), or give the control a visible label. |
| A `document` / `window` Escape listener that must see every press                        | Listen in the **capture** phase — `fromEvent(document, 'keydown', { capture: true })` runs before the `<body>` dispatcher, so it sees the press whether or not a tooltip consumes it.                            |
| A spec that expected one Escape to close a dialog with a tooltip showing                 | Press Escape twice, or assert that the first press hides the tooltip and leaves `ref.animationState()` at `'enter'`.                                                                                             |
| A spec that expected a hover-shown tooltip to survive Escape on `body`                   | Delete the expectation — that was the WCAG 1.4.13 defect.                                                                                                                                                        |

## 4. Mechanism notes

- The subscription lives for one show: `_show()` pushes its teardown onto
  `_overlayTeardowns` beside the panel hover listeners, and `_hide()` runs them
  (disposing the overlay also completes the stream).
- The `eventPredicate` is load-bearing, not a filter. The dispatcher picks the
  topmost overlay with **any** `keydownEvents()` observer and stops there,
  before an operator inside that stream could look at the key; without the
  predicate a visible tooltip would swallow every keydown — Enter, Ctrl+S,
  Shift+Escape meant for the dialog, drawer or popup below it. It returns
  `true` for non-keydown events; the tooltip observes no outside pointer
  events, so the outside-click dispatcher never consults it.
- The host `(keydown.escape)` binding cancels a pending show and, when the
  tooltip is visible, arms a zero-delay fallback that hides it if the same
  press left it on screen. It must not hide synchronously: disposing the
  overlay there removes it from the dispatcher before the key bubbles to
  `<body>`, which then hands the key to the overlay below — the double close
  this change removes. The fallback covers the two ways a press on the host can
  leave the tooltip up — an overlay above took the key, or an ancestor stopped
  its propagation before `<body>` — both of which hid the tooltip before. A
  task, not a microtask: a trusted event's whole dispatch runs inside one task,
  but microtasks run between its listeners. `_hide()` clears the fallback, so
  it never touches a tooltip the dispatcher already dismissed.
- The overlay handler clears a pending show as well, so a hover that re-entered
  the trigger while the tooltip was up does not bring it back.
- Limit, with focus **elsewhere**: an ancestor of the focused element that
  stops Escape propagation below `<body>` keeps the key from the dispatcher, so
  a hover-shown tooltip stays up — the same limit every CDK overlay's Escape
  has (a dialog's included). Such a tooltip could not be dismissed from the
  keyboard at all before, so nothing regresses. No in-repo ancestor stops
  Escape propagation around a tooltip host.
- `isComposing` is not guarded; the shared dismiss-Escape predicate across all
  overlays is a separate change (audit OVERLAYS-16, ruling D16).
