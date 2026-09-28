# 2026-09 — the drawer resize handle's arrow keys are spatial, and Escape is the drawer's

Applies to `@malva-ui/core/drawer`: every drawer with a resize handle —
`<mlv-drawer resizable>`, `MlvDrawerService.open(…, { resizable: true })` and
a routable drawer with `resizable` (#344, owner ruling D15, audit C051 /
OVERLAYS-11, keys and Escape half; the `pointercancel` half shipped in #338).

**Breaking, behaviour only.** No exported symbol was renamed, removed or
retyped. Every selector, input, output, config field, i18n key and BEM class
is unchanged; `MlvDrawerResize` is internal and stays unexported. What changes
is which arrow key moves the handle which way, which arrows act at all, and
the separator's `aria-orientation` — VERSIONING §3 row 112, "Changed
**default behaviour** at an unchanged API — ordering, timing, emitted events,
focus, ARIA, what a value means" (which key does what is the default
behaviour of the handle), not the issue's row 111, which is the default-value
row. So it ships with `!`, which on `0.x` releases as `0.2.0` → `0.3.0`
(VERSIONING §7). The Escape half restores documented behaviour
(`closeOnEscape`: "whether pressing Escape closes the drawer") — row 117,
"Bug fix that restores documented behaviour", not the issue's row 116, which
is the deprecation row. It bumps nothing on its own; its two consumer shapes
are listed in §3 for completeness.

## 1. What changed

### Arrow keys

The handle's arrows were **logical**: `Arrow Up` / `Arrow Right` grew the
panel and `Arrow Down` / `Arrow Left` shrank it on every drawer, with the
horizontal pair mirrored through `MlvRtlService.normalizeArrowKey` under a
`[dir="rtl"]` scope. But `position` is a **physical** viewport edge — CDK's
`GlobalPositionStrategy.left()` / `.right()` keep a `'right'` drawer on the
right in RTL, the handle sits on the panel's physical inner edge and the drag
reads physical `clientX` — so on a `right` drawer in LTR, `Arrow Right` grew
the panel while its handle moved **left**, a `top` sheet grew on `Arrow Up`
with its handle on the bottom edge, and a `left` drawer in RTL shrank on
`Arrow Right`.

Now the handle moves **the way the arrow points** (the APG window-splitter
model), 10% of the viewport per press. Only the two arrows on the drag axis
act; the cross-axis pair is ignored — no resize, not `preventDefault()`ed, so
it scrolls or reaches an ancestor handler. Direction plays no part: the table
is the same in LTR, in a scoped `[dir="rtl"]` subtree and in an LTR island.

| `position` | Grows (handle toward the content) | Shrinks (toward the edge; dismisses at zero) | Ignored          |
| ---------- | --------------------------------- | -------------------------------------------- | ---------------- |
| `left`     | `Arrow Right`                     | `Arrow Left`                                 | `Up` / `Down`    |
| `right`    | `Arrow Left`                      | `Arrow Right`                                | `Up` / `Down`    |
| `top`      | `Arrow Down`                      | `Arrow Up`                                   | `Left` / `Right` |
| `bottom`   | `Arrow Up`                        | `Arrow Down`                                 | `Left` / `Right` |

`Home` / `End` are unchanged (smallest / largest snap point, or the full
viewport; `Home` onto a `0` snap point dismisses), as are the pointer drag,
swipe-to-dismiss, snapping and `aria-valuenow`.

### `aria-orientation`

The separator now carries `aria-orientation`: `vertical` for a `left` /
`right` handle (a vertical line moved left / right) and `horizontal` for
`top` / `bottom`. Before it carried none, so every handle exposed ARIA's
`separator` default, `horizontal` — wrong for a side drawer, whose handle an
AT user was told moves up / down. Measured in Chromium 153
(`Accessibility.getFullAXTree`): the handle's markup without the attribute
exposes `orientation: horizontal`, with `aria-orientation="vertical"` it
exposes `vertical`; name (`Resize panel`), value and focusability are
unchanged.

### Escape

The handle handled Escape itself: `preventDefault()` plus `dismissed`, which
the drawer turns into `close()`, before the key reached CDK's
`OverlayKeyboardDispatcher` (one `keydown` listener on `<body>`, handing the
key to the topmost overlay that observes `keydownEvents()`). So with focus on
the handle:

- a drawer opened with `closeOnEscape` false — an unsaved form — closed anyway;
- with `closeOnEscape` on, the same press reached the drawer's own Escape
  subscription as well, so `close()` / `MlvDrawerRef.close()` ran twice
  (both idempotent — one leave animation, one `afterClosed()`);
- an overlay above the drawer that owns Escape could not stop it: with a
  hover-shown `[mlvTooltip]` up (#319), one Escape hid the tooltip **and**
  closed the drawer under it (measured with the real tooltip).

The handle no longer handles Escape. It is Escape like anywhere else in the
drawer: `closeOnEscape` decides, an overlay above takes the first press, and
one press closes the drawer once, restoring focus to the trigger.

## 2. Before / after

Keys that grow / shrink the panel, per position (`—` = no effect).

| `position`, scope | Before: grow / shrink              | After: grow / shrink            |
| ----------------- | ---------------------------------- | ------------------------------- |
| `left`, LTR       | `Up`, `Right` / `Down`, `Left`     | `Right` / `Left`                |
| `left`, RTL       | `Up`, `Left` / `Down`, `Right`     | `Right` / `Left` (was inverted) |
| `right`, LTR      | `Up`, `Right` / `Down`, `Left`     | `Left` / `Right` (was inverted) |
| `right`, RTL      | `Up`, `Left` / `Down`, `Right`     | `Left` / `Right`                |
| `top`, any        | `Up`, `Right`\* / `Down`, `Left`\* | `Down` / `Up` (was inverted)    |
| `bottom`, any     | `Up`, `Right`\* / `Down`, `Left`\* | `Up` / `Down`                   |

\* `Left` / `Right` swapped under RTL.

Escape with focus on the handle (measured in `drawer.spec.ts` /
`drawer.service.spec.ts` § _Escape on the resize handle (#344)_ and a probe
with the real `MlvTooltip`):

| Case                                  | Before                              | After                           |
| ------------------------------------- | ----------------------------------- | ------------------------------- |
| `closeOnEscape` false                 | closes                              | stays open, focus on the handle |
| `closeOnEscape` on                    | closes; `close()` called twice      | closes; `close()` called once   |
| hover-shown tooltip above, 1st Escape | tooltip hides **and** drawer closes | tooltip hides, drawer open      |
| same, 2nd Escape                      | —                                   | drawer closes                   |

## 3. Who is affected

- **Keyboard users of a `right`, `top`, or RTL `left` drawer, and specs or
  e2e tests driving the handle by key.** The arrows that grew the panel now
  shrink it there. **Do:** press the arrow pointing where the handle should
  go; in a spec, derive the key from the table above instead of asserting
  `ArrowUp` / `ArrowRight` grows. A keydown dispatched with `keyCode` only
  — CDK testing's `dispatchKeyboardEvent(handle, 'keydown', LEFT_ARROW)`,
  whose `key` is `''` — no longer resizes either: the handle reads
  `event.key`, and `normalizeArrowKey`'s `keyCode` fallback went with it.
  Dispatch with `key` (`new KeyboardEvent('keydown', { key: 'ArrowLeft' })`);
  a browser always sets it.
- **Code relying on the cross-axis arrows** — `Arrow Left` / `Right` on a
  bottom sheet, `Arrow Up` / `Down` on a side drawer. They no longer resize
  and are no longer `defaultPrevented`. **Do:** use the on-axis pair.
- **Specs asserting the handle's attributes exactly**, or a snapshot of them.
  **Do:** expect `aria-orientation="vertical"` on a `left` / `right` handle,
  `"horizontal"` on `top` / `bottom`.
- **Code that closed a `closeOnEscape: false` drawer through Escape on its
  handle**, or counted `close()` calls. **Do:** close it yourself (a button,
  `drawerRef.close()`); expect one `close()` per Escape.
- **A spec asserting one Escape closes the drawer while a tooltip is up.**
  **Do:** press Escape twice — the first dismisses the tooltip (#319's ruling
  D13, now honoured on the handle too).

Not affected: drawers without a resize handle and the pointer drag. In this
repository no code drives the handle by key or relies on its Escape. The key
change reaches every resizable drawer in `apps/docs` — `/drawer` examples 2
(`bottom`, loses `Left` / `Right`), 4 (`left`, loses `Up` / `Down`), 5
(`top`, arrows inverted, loses `Left` / `Right`) and 6 (the playground,
every position) — of which only 2 and 6 describe keys, and their notes were
reworded.
