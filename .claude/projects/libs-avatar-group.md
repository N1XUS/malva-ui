---
# Library: avatar-group

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Avatar Group library (`@malva-ui/core/avatar-group`) renders a horizontal stack of overlapping `mlv-avatar` instances representing a list of members (team, collaborators, reviewers). The visible count is calculated automatically from the host width via `MlvResizeObserverService` — there is **no** `max` input. When members overflow, an avatar-styled `+N` counter button is appended; hovering or focusing the counter opens a popup listing every member. The host is always a named `role="group"`; an `interactive` group puts its visible avatars inside an inner action `<button>` beside the counter (#328).

## Public API

Exported from `libs/core/avatar-group/src/index.ts`:

| Export                 | Kind      | Description                                                            |
| ---------------------- | --------- | ---------------------------------------------------------------------- |
| `MlvAvatarGroup` | Component | Overlapping avatar stack — `mlv-avatar-group`                         |
| `MlvAvatarGroupMember`    | Interface | Per-member shape: `name`, optional `src`, `initials`, `color`          |

---

## Components

### `MlvAvatarGroup`

**File:** `libs/core/avatar-group/src/lib/avatar-group/avatar-group.ts`
**Template:** `libs/core/avatar-group/src/lib/avatar-group/avatar-group.html`
**Styles:** `libs/core/avatar-group/src/lib/avatar-group/avatar-group.scss`

- **Selector:** `mlv-avatar-group`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Imports:** `NgTemplateOutlet` (from `@angular/common`); `MlvAvatar`, `MlvColorFromTextPipe` (from `@malva-ui/core/avatar`); `MlvPopup`, `MlvPopupTrigger`, `MlvPopupContent` (from `@malva-ui/core/popup`)

#### Inputs

| Name          | Type                     | Default    | Description                                                                                                                                                                                                                                                                                                                         |
| ------------- | ------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `members`     | `MlvAvatarGroupMember[]` | `[]`       | The full member list. Visible count is auto-calculated from container width.                                                                                                                                                                                                                                                        |
| `size`        | `MlvAvatarSize`          | `'m'`      | Size variant applied to all avatars (incl. overflow counter). Forwarded to `mlv-avatar`.                                                                                                                                                                                                                                            |
| `shape`       | `MlvAvatarShape`         | `'circle'` | Shape applied to all avatars in the group. Forwarded to `mlv-avatar`.                                                                                                                                                                                                                                                               |
| `interactive` | `BooleanInput`           | `false`    | When true, renders the visible avatars inside an inner action `<button>` (`.mlv-avatar-group__action`, named like the group) — the tab stop that emits `groupClick` on Enter / Space / AT activation — and shows a pointer cursor on the host. The host stays `role="group"` with no tab stop. No action button for an empty group. |

> The `max` input mentioned in older docs does not exist. Constrain visible count by sizing the host (`max-width`, `width`).

#### Outputs

| Name            | Payload                  | Fires when                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `groupClick`    | `MlvAvatarGroupMember[]` | User clicks anywhere on the host (either mode), or — under `interactive` — activates the inner action button (its click bubbles to the host listener; the button binds none, so one activation emits once). Emits the full member array. Suppressed when `members().length === 0`. |
| `overflowClick` | `MlvAvatarGroupMember[]` | User activates the `+N` counter `<button>` (click, or the click the browser fires for Enter / Space — no keydown handler). Emits the **hidden** member subset. Stops propagation so the host `groupClick` does not also fire.                                                      |

#### Host Bindings

```ts
host: {
  class: 'mlv-avatar-group',
  '[class]': '"mlv-avatar-group--size-" + size()',
  '[class.mlv-avatar-group--interactive]': 'interactive()',
  role: 'group',
  '[attr.aria-label]': '_hostAriaLabel()',
  '(click)': '_onHostClick()',
}
```

The host is never a control and never focusable. Until #328 an `interactive` host was `role="button"` with a tab stop and a keydown handler, which nested the `+N` counter (itself a `role="button"`) inside a button — axe `nested-interactive`; `button` has presentational children, so AT flattened the counter away. See [docs/migrations/2026-09-avatar-group-inner-action-button.md](../../docs/migrations/2026-09-avatar-group-inner-action-button.md).

#### Template structure

```
mlv-avatar-group[role=group][aria-label]
└── div.__list
    ├── button.__action[type=button][aria-label]   (interactive + members only)
    │   └── span.__item × visible                     (else stamped straight into __list)
    ├── button#overflowButton.__overflow[type=button][aria-label][mlvPopupTrigger]   (overflow only)
    └── mlv-popup[dismissExcludeElements]=[overflowButton]   (overflow only; role="list" content)
```

The visible items are one `<ng-template #visibleItems>` stamped through `NgTemplateOutlet` into either parent. The wrapper is a `span` so the markup this template writes inside a button stays phrasing content; `mlv-avatar`'s own internals (`div.mlv-avatar__visual`, `div.mlv-avatar__label`) are still `div`s, so the button as a whole is not strictly phrasing — no runtime or a11y-tree effect, but an HTML validator still flags it.

The member popup lists the counter in `dismissExcludeElements`: it has no backdrop (hover trigger), so a document-level click listener dismisses it, and a click on the counter — which Enter / Space on the native button fire — would otherwise count as outside and collapse the preview focus had opened. Keyboard activation and a pointer click on the counter both leave it open; a click anywhere else, Escape, blur or pointer-leave close it.

`_hostAriaLabel()` produces:

- `'No members'` when `members().length === 0`
- `'N member'` / `'N members'` when no overflow
- `'N members, V shown'` when overflowing (`V` = visible count)

#### Auto-fit Algorithm

`_maxFit` computed signal returns the maximum **total** avatars (visible + overflow) that fit:

- Returns `Infinity` until the first `MlvResizeObserverService` measurement (so the initial render shows everything before width is known).
- Otherwise: `Math.max(1, Math.floor((width - avatarPx) / (avatarPx - overlapPx)) + 1)`.
- When `members.length > _maxFit`, reserves 1 slot for the `+N` counter (`_visibleMembers().length === Math.max(1, maxFit - 1)`).

Avatar pixel sizes (matches `mlv-avatar` SCSS tokens):

| Size  | Avatar px | Overlap px |
| ----- | --------: | ---------: |
| `xs`  |        24 |          4 |
| `s`   |        32 |          6 |
| `m`   |        40 |          8 |
| `l`   |        56 |         10 |
| `xl`  |        80 |         12 |
| `xxl` |        96 |         14 |

#### Computed (protected)

| Name              | Returns                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `_visibleMembers` | `MlvAvatarGroupMember[]` — `members.slice(0, max(1, maxFit - 1))` when overflowing, else the full list. |
| `_hiddenMembers`  | `MlvAvatarGroupMember[]` — `members.slice(_visibleMembers.length)`.                                     |
| `_overflowCount`  | `number` — `_hiddenMembers.length`.                                                                     |
| `_hasOverflow`    | `boolean` — `_overflowCount > 0`.                                                                       |
| `_overflowLabel`  | `string` — `'+' + _overflowCount` (e.g. `'+5'`).                                                        |
| `_actionable`     | `boolean` — `interactive() && members().length > 0`; renders the inner action button.                   |

---

## Interfaces

### `MlvAvatarGroupMember`

```ts
interface MlvAvatarGroupMember {
  /** Full display name — used for initials derivation, popup label, and aria-label. */
  name: string;
  /** Optional image URL. Falls back to initials or color on error. */
  src?: string | null;
  /** Explicit initials string; overrides name-derived initials. */
  initials?: string;
  /** CSS color for the avatar background. Defaults to a deterministic color from name. */
  color?: string;
}
```

---

## CSS Custom Properties

Declared in `avatar-group.scss`:

| Variable              | Default                              | Purpose                                                               |
| --------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| `--mlv-ag-overlap`    | `-0.5rem` (size `m`); see size table | Negative `margin-left` applied to stacked items (per-size override).  |
| `--mlv-ag-ring-width` | `0.125rem`                           | Outline width of each avatar's ring (used to separate stacked tiles). |
| `--mlv-ag-ring-color` | `var(--mlv-background-base)`         | Outline color of the ring.                                            |

Per-size `--mlv-ag-overlap` defaults applied via `&--size-{xs,s,m,l,xl,xxl}` modifiers:

| Modifier     | Overlap     |
| ------------ | ----------- |
| `--size-xs`  | `-0.25rem`  |
| `--size-s`   | `-0.375rem` |
| `--size-m`   | `-0.5rem`   |
| `--size-l`   | `-0.625rem` |
| `--size-xl`  | `-0.75rem`  |
| `--size-xxl` | `-0.875rem` |

---

## CSS Classes (BEM)

| Class                                       | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.mlv-avatar-group`                         | Block — flex container that fills the parent.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `.mlv-avatar-group--size-{xs,s,m,l,xl,xxl}` | Size modifier (per-size overlap override).                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `.mlv-avatar-group--interactive`            | Modifier — applies `cursor: pointer` to the host (the host is never focused).                                                                                                                                                                                                                                                                                                                                                                                                 |
| `.mlv-avatar-group__list`                   | Element — flex row holding visible avatars.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `.mlv-avatar-group__action`                 | Element — `interactive` only: the inner `<button>` wrapping the visible items; carries the focus ring (Form A, radius following the shape). At rest no position/z-index, so no stacking context and the counter paints over the last item; `:focus-visible` adds `position: relative; z-index: 22` so the counter (z-index 21) cannot hide the ring's inline-end end — the avatars lift with it, so while focused the last avatar paints over the counter's overlapping edge. |
| `.mlv-avatar-group__item`                   | Element — `span` wrapping each visible avatar (keeps the template's own markup phrasing; `mlv-avatar` internals are still `div`s); carries z-index stacking + ring outline.                                                                                                                                                                                                                                                                                                   |
| `.mlv-avatar-group__overflow`               | Element — the `+N` overflow counter `<button>` (popup trigger), a sibling of `__action`.                                                                                                                                                                                                                                                                                                                                                                                      |
| `.mlv-avatar-group__overflow-avatar`        | Element — the avatar visual for the overflow counter.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `.mlv-avatar-group__popup-list`             | Element — popup body listing hidden members.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `.mlv-avatar-group__popup-row`              | Element — row inside the popup (avatar + name).                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `.mlv-avatar-group__popup-name`             | Element — name label inside a popup row.                                                                                                                                                                                                                                                                                                                                                                                                                                      |

---

## Dependencies

### Internal package dependencies

- `@malva-ui/core/avatar` — `MlvAvatar`, `MlvColorFromTextPipe`, `MlvAvatarSize`, `MlvAvatarShape`
- `@malva-ui/core/popup` — `MlvPopup`, `MlvPopupTrigger`, `MlvPopupContent`
- `@malva-ui/cdk` — `MlvResizeObserverService`

### Angular peers

- `@angular/cdk` (`coerceBooleanProperty`, `BooleanInput`)
- `@angular/core` (signals, `takeUntilDestroyed`)

---

## Accessibility

- The host is always a named `role="group"` (`_hostAriaLabel()`) and never a tab stop.
- `interactive` adds one tab stop, the inner action `<button>`, named with the same `_hostAriaLabel()` the old host button carried; native Enter / Space / AT activation fire its click, which bubbles to the host listener.
- The `+N` counter is a native `<button>` beside the action button, never inside it — two sibling buttons in a group, so AT exposes both (#328). Enter / Space activate it natively.
- Stop-propagation on the overflow counter prevents host `groupClick` from also firing.
- Neither button binds a keydown handler: the browser already turns Enter / Space on a `<button>` into a `click`, and a handler beside it would emit twice (#299).
- The overflow counter is the `mlvPopupTrigger` for the members popover. It sets `[ariaHasPopup]="null"` because the popover is a purely **informational** member list (`role="list"`) — not a menu/listbox/dialog — so no `aria-haspopup` type is advertised; the directive's `aria-expanded` still communicates open/closed state. The wrapping `mlv-popup` stays roleless; the `role="list"` lives on the projected content.
- Activating the focused counter (Enter / Space, or a pointer click) emits `overflowClick` and leaves the popover open, `aria-expanded="true"` — the popup lists the counter in `dismissExcludeElements`, which a standalone `mlvPopupTrigger` forwards since #328. Without it the native button's click counted as a click outside: the first press collapsed the preview and a second never reopened it.

---

## Testing

`libs/core/avatar-group/src/lib/avatar-group/avatar-group.spec.ts`. Member-count,
overflow, and list labels resolve through `MLV_AVATAR_GROUP_I18N`; specs provide
`provideMlvI18nTesting()`.

Keyboard specs go through `press()`, which dispatches the keydown and then the
click a browser fires for it on a `<button>` (jsdom fires none), so a handler
acting on both shows up as a double emission. _MlvAvatarGroup member popup —
activation keeps it open_ pins `aria-expanded="true"` after two presses of Enter
/ Space on the focused counter and after a pointer click on the hover-opened
one, and that an outside click still closes it (the three keep-open specs go
red with either the template's `dismissExcludeElements` binding or the popup
trigger's forwarding line removed; the outside-click control stays green). Axe sweeps: plain fit, interactive, **interactive + `+N`
counter** (#328), empty, counter, popup open.
