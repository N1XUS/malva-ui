# 2026-09 — a `readonly` editor renders no toolbar

Date: 2026-09-24. Issue: [#498](https://github.com/N1XUS/malva-ui/issues/498)
(owner ruling 2026-09-23: "a readonly editor renders no toolbar, in either
appearance"). The bubble half shipped with #483
([2026-09-editor-layout-toolbar-placement.md](2026-09-editor-layout-toolbar-placement.md)),
which already hid the selection bubble while `readonly`; this is the docked
bar's half.

Applies to **`@malva-ui/editor`** only: `MlvEditor` (`mlv-editor`).

**Breaking, behaviour only.** No exported symbol, selector, input, output,
token, i18n key or BEM class was added, renamed, removed or retyped. What
moves is what `readonly` does to the toolbar: in `toolbarAppearance="bar"` it
used to leave the band on screen with its mutation controls disabled and
zoom enabled; now the band is not rendered at all.

[VERSIONING.md](../../VERSIONING.md) § 3, row 112 (_changed default behaviour
at an unchanged API — focus, ARIA, what a value means_): the default
appearance is `'bar'`, so every readonly editor moves, and focus, the tab
order and the `role="toolbar"` landmark move with it. On the `0.x` line that
is a `!` commit, which `nx release` demotes to a minor: `0.1.15` → `0.2.0`.

## 1. Before / after

| Surface, `readonly` editor                                                       | Before                                                                                                                         | After                                                                                                       |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `.mlv-editor__toolbar-band`, `'bar'`, top or bottom, capped or not               | rendered; mutation controls natively `disabled`, zoom enabled                                                                  | **not rendered**; the viewport opens the surface and no space is kept                                       |
| `role="toolbar"` / tab stops in the composite                                    | the toolbar was one roving tab stop beside the content                                                                         | **none**: the content (and any status-row control) only                                                     |
| Zoom control                                                                     | usable from the bar                                                                                                            | **gone**; the level it set stays (`--mlv-editor-zoom`), and `MlvEditor.zoom` still sets it                  |
| Consumer toolbar — `[mlvEditorToolbar]`, start / end slots, `mlv-editor-ai-menu` | rendered; enabled unless the control read `readonly` itself (the AI menu disabled)                                             | **not rendered** (an assumption pending the owner; § 4)                                                     |
| `.mlv-editor--toolbar-sticky` with `toolbarSticky`                               | stamped                                                                                                                        | **not stamped** (there is no band to stick)                                                                 |
| ProseMirror `scrollMargin` / `scrollThreshold`, sticky bar                       | cleared band height + offset on the bar's side                                                                                 | ProseMirror's defaults (5 / 0): nothing is obscured                                                         |
| Focus on a toolbar control when `readonly` turns on                              | a mutation control turned natively `disabled`, which browsers blur to `<body>` (measured for buttons in #324); zoom kept focus | **moves to the content**, selection intact, no `blur` / `touch`                                             |
| An open toolbar popup (zoom, heading menu, color picker, table, link, AI menu)   | zoom stayed open and usable; the others were left to their own `readonly` gating (blocked commands)                            | **closed**; focus in it moves to the content first                                                          |
| Any other editor-owned popup (the table grips' menu, the image dialog)           | not closed by the editor; left to the popup's own `readonly` handling                                                          | asked to close; its registration stays with its owner, so the AI review bar keeps its focus listeners       |
| `readonly` turns off                                                             | —                                                                                                                              | the bar is stamped again in its position; directly projected nodes re-attach, template slots are re-created |
| Server rendering                                                                 | band rendered                                                                                                                  | no band                                                                                                     |
| `toolbarAppearance="floating"`                                                   | no bubble while `readonly` (#483)                                                                                              | unchanged on screen; the hidden pane also stamps no toolbar, so its controls are re-created on the way back |

Unchanged: the readonly document itself (focusable, selectable, copyable,
mutation blocked), the status row and `[mlvEditorStatus]` content, the AI
review bar (it lives in the status row), a **disabled** editor (the bar still
renders with every control disabled), and the standalone `MlvEditorToolbar`
shell (`mlv-editor-toolbar [context]`), which does not read `readonly` from
anywhere but its context: for a readonly context it renders, its mutation
controls disable and `MlvEditorZoom` stays enabled.

In-repo: the descriptions of `apps/docs` editor examples 3, 6 and 12 now say
a readonly editor renders no toolbar. The
publishing-workspace showcase's preview toggle (`[readonly]="previewing()"`)
now drops the toolbar, its directly projected `mlv-editor-ai-menu` and the
band's height, so the layout shifts on the toggle — intended by the ruling.

## 2. Mechanism

- One switch, `_toolbarRendered()` = `!readonly()`, gates both places the
  toolbar template is stamped: the bar (`_barRendered()` = `'bar'` &&
  `_toolbarRendered()`, before or after the viewport) and the bubble's pane.
  `_stickyToolbar` reads `_barRendered()`, so the sticky modifier and the
  scroll margins follow.
- Turning `readonly` on over a bar runs from the editor's constructor
  `effect`. A constructor effect is registered on the parent view, so it runs
  before this component's template (and the band's `@if`, inside the template
  the form-control wrapper stamps) refreshes, while focus in the band or its
  popups still has somewhere to go. It calls the per-editor overlay registry's internal `closeForReadonly()`, the
  same call the bubble now makes for its pane: focus in the band, or in a popup
  portaled into an overlay pane the content does not share, moves to the
  content first, then every other registered overlay is asked to close
  (`closeOthers()`, which leaves each entry for its owner to release). The
  content is focused with `dom.focus()` before `view.focus()`, because a
  non-editable ProseMirror view moves no DOM focus on its own.
- A popup whose trigger is gone finds focus already outside its pane, so it
  hands nothing back to a trigger that no longer exists.

## 3. What to do

- **Zoom in a readonly editor.** Users can no longer change the level from the
  editor. **Do:** if they must, put a control outside the editor that writes
  the public signal — `editorRef.zoom.set(125)` on a
  `viewChild.required(MlvEditor)` — or render a standalone
  `mlv-editor-toolbar` next to it.
- **Selectors, snapshots and specs that expect the bar while readonly** —
  `.mlv-editor__toolbar-band`, `[role="toolbar"]`, a disabled `Bold` button,
  an enabled zoom button, a two-stop Tab order. **Do:** assert the band is
  absent while `readonly` and present after; test a control's own readonly
  gating through the standalone `mlv-editor-toolbar` with a readonly context,
  the only place a toolbar control still meets one.
- **CSS keyed on `.mlv-editor--toolbar-sticky`** to reserve page space (a
  header offset, a scroll padding). **Do:** expect the modifier to drop while
  `readonly`, or key the reservation on your own state.
- **Actions that must stay available in a readonly editor** (copy, export,
  "edit" to leave readonly) placed in the toolbar start / end slots or a
  complete `[mlvEditorToolbar]` replacement. **Do:** move them outside the
  editor or into `[mlvEditorStatus]`, which still renders. This is the shape
  § 4 may reverse.
- **Code that restored focus by hand after toggling `readonly`** (because the
  focused toolbar button blurred to `<body>`). **Do:** delete it; focus now
  returns to the content with the selection intact.
- **State kept inside a template-slot control**
  (`<ng-template mlvEditorToolbarStart>`) across a readonly round trip.
  **Do:** keep it in the host: the template view is destroyed while
  `readonly` and re-created after. Directly projected elements
  (`<button mlvEditorToolbarStart>`) are detached and re-attached as the same
  nodes.
- **A consumer overlay opened from a directly projected slot control** — an
  `mlv-menu` through `[mlvMenuTrigger]`, an `mlvPopupTrigger`, anything the
  editor did not open. The editor closes only the overlays registered with it,
  and a projected control is detached, not destroyed, so its directives live
  on: the overlay stays open with `aria-expanded="true"` on a trigger that is
  no longer in the document (`isConnected === false`), can jump to 0,0 on its
  next reposition, and Escape hands focus back to that detached trigger, so it
  lands on `<body>` (measured with an `mlv-menu` opened from the keyboard).
  **Do:** close it in the
  same handler that turns `readonly` on (`menuTrigger.close()`), or keep the
  trigger outside the editor. A trigger in a template slot is destroyed with
  the band instead; whether its overlay closes then is the overlay's own
  behaviour, not measured here.

## 4. Open: consumer toolbars (assumption)

The ruling says "a readonly editor renders no toolbar"; whether that covers a
consumer-supplied toolbar is not yet answered. This change assumes it does,
so a complete `[mlvEditorToolbar]` replacement, the start / end slots and a
projected `mlv-editor-ai-menu` go away with the default bar. Reversing it for
consumer toolbars is local to `MlvEditor` and `MlvEditorBubble`:
`_toolbarRendered` becomes `!readonly() || <a consumer toolbar is supplied>`,
the bubble's `_wanted()` / `_ownsContentKey()` and `_editorAttributes()`'s
`aria-keyshortcuts` drop their own `readonly` gate, and the default groups
inside the band would then need their own readonly hiding. `_closeBarForReadonly()`
returns early while `_barRendered()` is true, so its early return must then
key on the removed region, not the band, or focus on a removed default control
drops to `<body>`.

The assumption has a cost beyond the removed actions: a consumer overlay opened
from a directly projected slot control outlives its trigger (§ 3). Keeping
consumer toolbars rendered would keep those triggers attached.

## 5. Verification

`libs/editor/src/lib/editor/editor-readonly-toolbar.spec.ts`: no band across
appearance × position × cap; both flips, with projected-node identity and the
roving tab stop; the sticky modifier and scroll sides against a stubbed 45px
band; focus from the bar and from the open zoom popup to the content, no
`blur`; a registered non-band popup closed and kept registered; a
simultaneous disabled flip left to the disabled path; an editor already
disabled, with focus on a projected consumer control in its band, taking no
focus when `readonly` turns on; a complete consumer toolbar hidden; axe while
readonly per appearance × position.
`editor-ssr.spec.ts` server-renders a readonly bar beside an editable one.
In Chromium, `libs/editor/e2e/editor-layout.spec.ts` toggles docs example 6
with focus on a bar control: the band and the space it took go, focus lands
on the content, and the band comes back.
On the pre-change code 9 of the 10 specs were red; the axe sweep passes
either way (a readonly bar was already accessible — it simply should not be
there). Each part was then ablated and turns specs red, counted in
`editor-readonly-toolbar.spec.ts` / across the full editor suite: the bar's
template gate (13 across the suite, the SSR spec among them), the bubble's
pane gate (1 / 2), `closeOthers()` (1 / 3), the focus move (3 / 4) and the
focus move's disabled guard (1 / 1). Existing specs that asserted disabled
controls inside a readonly `mlv-editor` now assert their absence, and the
readonly half moved to the
standalone shell (`editor-toolbar`, `editor-formatting-popovers`,
`editor-table`, `editor-zoom`, `editor-ai-menu`, `editor-bubble`).
