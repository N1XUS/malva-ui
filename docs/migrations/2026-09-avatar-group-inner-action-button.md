# 2026-09 — `mlv-avatar-group`: an interactive group acts through an inner button, beside the `+N` counter

**Packages:** `@malva-ui/core/avatar-group` (`MlvAvatarGroup`); adjacent, patch class: `@malva-ui/core/popup` (`MlvPopupTrigger` now forwards `dismissExcludeElements` in standalone mode, as `MlvPopupContainer` already did).
**Kind:** breaking, **behaviour only**. No exported symbol was renamed or removed, and nothing was retyped: the selector, the four inputs (`members`, `size`, `shape`, `interactive`), both outputs (`groupClick`, `overflowClick`), `MlvAvatarGroupMember`, the `MLV_AVATAR_GROUP_I18N` keys and every existing BEM class are unchanged. One BEM element is **added** (`.mlv-avatar-group__action`, VERSIONING row 114). What moves is ARIA and focus at an unchanged API — VERSIONING §3 row 112 (_changed default behaviour … focus, ARIA_); the issue cites row 111, which is the default-**value** row. Owner ruling D19 (host `role="group"` plus an inner button, not a host-only button). Resolves #328 (audit C034 / DATA-DISPLAY-08).

---

## Why

With `interactive`, the host was the control: `role="button"`, `tabindex="0"`, and a host `keydown` handler for Enter / Space. When the members overflowed, the `+N` counter — a `div role="button" tabindex="0"`, the member popup's trigger and the `overflowClick` source — rendered **inside** it.

`button` has presentational children. Assistive technology flattens a button's subtree into its name, so the counter's own role and name vanish: some screen readers (VoiceOver) never expose it, which makes the member popup and `overflowClick` unreachable, and it still sits in the tab order as an unnamed stop inside a button. axe reports it as `nested-interactive`. Measured on `main` before this change, with the shared `runAxe` over an interactive group narrow enough to overflow:

```
PROBE-328 {"hostRole":"button","hostTabindex":"0","overflowTag":"DIV","overflowRole":"button","overflowInsideHostButton":true,"violations":["nested-interactive:1"]}
```

The existing axe sweeps covered "interactive" and "overflow" separately, never both at once, so none of them could see it.

Correction to the issue: docs example 4 did **not** render this shape. It is laid out in a column with `align-items: flex-start`, so the group is as wide as its content (232px for seven `m` avatars), all seven fit, and no `+N` counter appeared — although the example's own text told the reader to click it. The shape was reachable in any narrow interactive group, not in the shipped example. The example now carries `max-width: 10rem` and renders the counter.

---

## What changed

The host is **always** a named `role="group"` and never focusable. Under `interactive`, the visible avatars render inside an inner `<button type="button" class="mlv-avatar-group__action">`, and the `+N` counter is a native `<button type="button">` **beside** it:

```text
mlv-avatar-group[role=group][aria-label="7 members, 3 shown"]
└── div.mlv-avatar-group__list
    ├── button.mlv-avatar-group__action[aria-label="7 members, 3 shown"]   ← interactive + members only
    │   └── span.mlv-avatar-group__item × 3
    ├── button.mlv-avatar-group__overflow[aria-label="+4 more members"]   ← overflow only
    └── mlv-popup[dismissExcludeElements=[the counter]]
```

|                                 | Before                                                                   | After                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Host role (`interactive`)       | `button`                                                                 | `group` (as in the passive mode)                                                                                                 |
| Host `tabindex` (`interactive`) | `0` (none for an empty group)                                            | none                                                                                                                             |
| Group action, keyboard / AT     | host `keydown` (Enter, Space) → `groupClick`                             | inner `<button>`'s native click → bubbles to the host `(click)` → `groupClick`                                                   |
| Group action, name              | host `aria-label` (`_hostAriaLabel()`)                                   | the inner button's `aria-label` — the **same** string; the group keeps it too                                                    |
| `+N` counter element            | `div role="button" tabindex="0"`                                         | `<button type="button">`                                                                                                         |
| `+N` counter, keyboard          | own `keydown` (Enter, Space; Space `preventDefault()`)                   | native click; no keydown handler (#299)                                                                                          |
| Activating the `+N` counter     | keyboard: emits, popup stays open; pointer click: emits, popup closes    | both emit and leave the member popup open (the counter is a dismissal exclusion)                                                 |
| Visible item wrapper            | `div.mlv-avatar-group__item`                                             | `span.mlv-avatar-group__item` (what the template writes inside the button is phrasing)                                           |
| Empty `interactive` group       | `role="button"`, no tab stop                                             | `role="group"`, no inner button (it would be a named tab stop that does nothing)                                                 |
| Focus ring (`interactive`)      | on the host (`.mlv-avatar-group--interactive:focus-visible`, radius `m`) | on `.mlv-avatar-group__action:focus-visible` — Form A, radius following the avatar shape, lifted above the counter while focused |

Unchanged: a pointer click **anywhere on the host** still emits `groupClick` in either mode (the host listener stays; the inner button binds none, so one activation emits once), `overflowClick` still stops propagation, the popup still opens on hover and focus of the counter and still closes on a click anywhere else, `.mlv-avatar-group--interactive` still sets `cursor: pointer`, and the geometry of every avatar and of the counter is identical in LTR and RTL (measured in Chromium, relative to the host: items at 0 / 32 / 64px, counter at 96px, 40 × 40 — passive and interactive, LTR and RTL).

Measured in Chromium through the docs page with trusted input: Enter and Space on the action button emit `groupClick` once each; Enter and Space on the counter emit `overflowClick` once each and `groupClick` never; a pointer click on an avatar and on the counter emit one of each. Tab order is action button → counter, focusing the counter opens the member popup with `aria-expanded="true"`, and activating it — Enter, Space or a pointer click — leaves the popup open. While the action button is focused its ring paints over the counter, which overlaps it by the avatar overlap: the button is lifted to `z-index: 22` (the counter is 21), so for as long as it holds focus the last visible avatar also paints over the counter's overlapping edge and takes the pointer there: a click on that strip (8px of 40 at size `m`) emits `groupClick` rather than `overflowClick`, and hovering it opens nothing, until focus moves on.

---

## What a consumer may need to do

**Who is affected:** every `interactive` group — (a), (b), (e), (f) — and every group that overflows, interactive or not, because the `+N` counter is a native `<button>` and a dismissal exclusion in both modes — (c), (d), (e). **Who is not:** a passive group whose members all fit renders the same markup as before apart from the item wrappers' tag, and needs nothing.

### (a) Code or specs that treat the interactive host as the button

`host.getAttribute('role') === 'button'`, `host.tabIndex === 0`, `host.focus()`, `getByRole('button', { name: '7 members, 3 shown' })` resolving to `mlv-avatar-group`, or a spec dispatching `keydown` Enter / Space on the host to trigger `groupClick` — none of these hold any more.

**Do:** target `.mlv-avatar-group__action` (or `getByRole('button', { name })`, which now resolves to it). The host is `role="group"` with the same name.

### (b) Focus styling written against the host

A consumer override on `mlv-avatar-group:focus-visible` or `.mlv-avatar-group--interactive:focus-visible` never matches: the host is not focused. The library's own host focus rule is deleted.

**Do:** move it to `.mlv-avatar-group__action:focus-visible`.

### (c) Scripted keyboard events on the `+N` counter

The counter is a native `<button>` with no keydown handler, so a scripted `keydown` (Enter or Space) no longer emits `overflowClick` — a browser fires a button's click only for **trusted** keys — and a scripted Space is no longer `defaultPrevented` (a native button does not scroll the page). Real keyboard users are unaffected, except that Space now activates on **keyup**, as on every native button, instead of on keydown.

**Do:** in specs, dispatch the `click` the browser would fire (`counter.click()`), or dispatch the keydown and then the click, as `avatar-group.spec.ts`'s `press()` does.

### (d) Activating the counter no longer closes the member popup

The counter is now listed in the popup's `dismissExcludeElements`, so a click on it is no longer taken for a click outside. A **pointer click** on the counter used to emit `overflowClick` **and** close the member popup that hovering had opened — the popup's backdrop-less click-outside listener counted a click on its own trigger as outside. It now emits and leaves the popup open. Keyboard activation, which now fires a native click (shape (c)), behaves the same way: without the exclusion, Enter / Space on the focused counter would have closed the preview that focus opened, and a second press could not bring it back. A click anywhere else, moving focus away or leaving the counter with the pointer still closes it.

The exclusion needed a one-line fix in `@malva-ui/core/popup`: a standalone `[mlvPopupTrigger]` never forwarded `dismissExcludeElements` to the overlay, so the documented input did nothing outside a `mlv-popup-container` (see _In this repository_).

**Do:** nothing, unless your `overflowClick` handler relied on the click closing the preview — close your own surface, or move focus, from the handler instead.

### (e) Selectors reading the element types

`div.mlv-avatar-group__overflow`, `.mlv-avatar-group__overflow[role="button"]`, `div.mlv-avatar-group__item`, or `.mlv-avatar-group__list > .mlv-avatar-group__item` (under `interactive` the items are children of `__action`, not of `__list`) stop matching. DOM below the named BEM elements is not public (VERSIONING §2), but this is the one place it moved.

**Do:** select by class alone — `.mlv-avatar-group__overflow`, `.mlv-avatar-group__item`.

### (f) Screen-reader output

An interactive group now reads as a group and then a button, both carrying the count ("7 members, 3 shown, group" → "7 members, 3 shown, button" → "+4 more members, button"), where it used to read as one button whose counter was lost. The individual avatar names inside the action button remain presentational — as they were inside the old host button; the member popup lists everyone.

**Do:** nothing. There is no input to name the action after what your `groupClick` handler does; if you need one, say so in an issue.

---

## In this repository

- `libs/core/avatar-group` — host, template, stylesheet, spec (a new axe sweep of **interactive + `+N` counter**, the per-state coverage the audit asked for; keyboard specs through `press()`; activation specs pinning that Enter, Space and a pointer click on the counter leave the member popup open, red without either half of the exclusion).
- `libs/core/popup` — `MlvPopupTrigger` forwards `dismissExcludeElements` when it opens its own overlay, as `MlvPopupContainer` does. The input was documented on `MlvPopup` and ignored in standalone mode; restoring documented behaviour, patch class (VERSIONING §3). No other standalone trigger in `libs/` or `apps/` binds it, and `mlv-menu` computes its own exclusions, so nothing else moves. Pinned by a `popup-trigger.spec.ts` case that goes red without the line.
- `apps/docs` avatar-group example 4 — the one interactive usage; now `max-width: 10rem` so the counter it documents renders, and its text describes the inner button.
- No other consumer is interactive: the publishing-workspace showcase and `libs/core/src/ssr-smoke.spec.ts` render a passive group, whose only change is the counter becoming a native `<button>` (and the items `span`s).
