---
# Library: avatar-group

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Avatar Group library (`@malva-ui/core/avatar-group`) renders a horizontal stack of overlapping `mlv-avatar` instances representing a list of members (team, collaborators, reviewers). The visible count is calculated automatically from the host width via `MlvResizeObserverService` — there is **no** `max` input. When members overflow, an avatar-styled `+N` counter is appended; hovering or focusing the counter opens a popup listing every hidden member.

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
- **Imports:** `MlvAvatar`, `MlvColorFromTextPipe` (from `@malva-ui/core/avatar`); `MlvPopup`, `MlvPopupTrigger`, `MlvPopupContent` (from `@malva-ui/core/popup`)

#### Inputs

| Name          | Type                     | Default    | Description                                                                              |
| ------------- | ------------------------ | ---------- | ---------------------------------------------------------------------------------------- |
| `members`     | `MlvAvatarGroupMember[]` | `[]`       | The full member list. Visible count is auto-calculated from container width.             |
| `size`        | `MlvAvatarSize`          | `'m'`      | Size variant applied to all avatars (incl. overflow counter). Forwarded to `mlv-avatar`. |
| `shape`       | `MlvAvatarShape`         | `'circle'` | Shape applied to all avatars in the group. Forwarded to `mlv-avatar`.                    |
| `interactive` | `BooleanInput`           | `false`    | When true, exposes the host as a tabbable button with Enter/Space activation.            |

> The `max` input mentioned in older docs does not exist. Constrain visible count by sizing the host (`max-width`, `width`).

#### Outputs

| Name            | Payload                  | Fires when                                                                                                                                                         |
| --------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `groupClick`    | `MlvAvatarGroupMember[]` | User clicks anywhere on the host. Emits the full member array. Suppressed when `members().length === 0`.                                                           |
| `overflowClick` | `MlvAvatarGroupMember[]` | User clicks (or activates via Enter/Space on) the `+N` counter. Emits the **hidden** member subset. Stops propagation so the host `groupClick` does not also fire. |

#### Host Bindings

```ts
host: {
  class: 'mlv-avatar-group',
  '[class]': '"mlv-avatar-group--size-" + size()',
  '[class.mlv-avatar-group--interactive]': 'interactive()',
  '[attr.role]': 'interactive() ? "button" : "group"',
  '[attr.tabindex]': 'interactive() && members().length > 0 ? 0 : null',
  '[attr.aria-label]': '_hostAriaLabel()',
  '(click)': '_onHostClick()',
  '(keydown)': '_onHostKeydown($event)',
}
```

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

| Class                                       | Purpose                                                                       |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `.mlv-avatar-group`                         | Block — flex container that fills the parent.                                 |
| `.mlv-avatar-group--size-{xs,s,m,l,xl,xxl}` | Size modifier (per-size overlap override).                                    |
| `.mlv-avatar-group--interactive`            | Modifier — applies `cursor: pointer` to the host.                             |
| `.mlv-avatar-group__list`                   | Element — flex row holding visible avatars.                                   |
| `.mlv-avatar-group__item`                   | Element — wraps each visible avatar; carries z-index stacking + ring outline. |
| `.mlv-avatar-group__overflow`               | Element — wraps the `+N` overflow counter (interactive trigger).              |
| `.mlv-avatar-group__overflow-avatar`        | Element — the avatar visual for the overflow counter.                         |
| `.mlv-avatar-group__popup-list`             | Element — popup body listing hidden members.                                  |
| `.mlv-avatar-group__popup-row`              | Element — row inside the popup (avatar + name).                               |
| `.mlv-avatar-group__popup-name`             | Element — name label inside a popup row.                                      |

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

- The passive host carries `role="group"`; interactive groups use `role="button"`, a conditional tab stop, and Enter/Space activation.
- Overflow counter is keyboard-activatable: `Enter` and `Space` both trigger `overflowClick`.
- Stop-propagation on the overflow counter prevents host `groupClick` from also firing.
- The overflow counter is the `mlvPopupTrigger` for the members popover. It sets `[ariaHasPopup]="null"` because the popover is a purely **informational** member list (`role="list"`) — not a menu/listbox/dialog — so no `aria-haspopup` type is advertised; the directive's `aria-expanded` still communicates open/closed state. The wrapping `mlv-popup` stays roleless; the `role="list"` lives on the projected content.

---

## Testing

`libs/core/avatar-group/src/lib/avatar-group/avatar-group.spec.ts`. Member-count,
overflow, and list labels resolve through `MLV_AVATAR_GROUP_I18N`; specs provide
`provideMlvI18nTesting()`.
