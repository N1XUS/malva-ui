# 2026-08 — Icon-only button inference and neutral default variant

Applies to `@malva-ui/core/button` (`MlvButton`).

No exported symbol was renamed, added, or removed. Two **default behaviours** changed for
`button[mlvButton]` / `a[mlvButton]` with `shape="square"` or `shape="circle"`.

## 1. `variant` fallback is shape-aware

| Before                             | After                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `variant` unset ⇒ always `primary` | `variant` unset ⇒ `secondary` for `shape="square"`/`shape="circle"`, `primary` otherwise |

Resolution order is unchanged apart from the last step:

1. the local `variant` input;
2. the nearest `MLV_BUTTON_VARIANT` provider (`mlv-button-group`, `mlv-button-split`,
   `mlv-button-toggle`);
3. **new:** `secondary` when `shape` is `square`/`circle`, otherwise `primary`.

Rationale: every un-annotated icon action rendered as a saturated call-to-action. A
repeater of row actions (delete, edit, more) produced a wall of accent-filled circles, so
consumers had to repeat `variant="secondary"` on every one of them.

### Restoring the old rendering

Set the variant explicitly — it always wins:

```html
<button mlvButton shape="circle" variant="primary" aria-label="Add">
  <svg lucidePlus />
</button>
```

### Not affected

- Any button with an explicit `variant`.
- Any button inside `mlv-button-group`, `mlv-button-split`, or `mlv-button-toggle` —
  those containers always provide `MLV_BUTTON_VARIANT`, and their own fallback is still
  `primary`, so it resolves before the shape-aware default.
- `mlv-button-close`, which sets `variant="transparent"` itself.
- Every non-icon shape (`default`, `pill`).

## 2. `mlvButtonIcon` is no longer required for icon-only sizing

`.mlv-button--icon-only` was previously applied only when an icon shape **and** a projected
`[mlvButtonIcon]` were both present. It is now also applied when the shape is
`square`/`circle` and the default content slot renders no non-whitespace text, so

```html
<button mlvButton shape="circle" aria-label="Close"><svg lucideX /></button>
```

gets the same treatment as the annotated form. `button.scss` sizes a lone `svg` inside
`.mlv-button__text` to `var(--mlv-icon-font-size)` (`1.75em` for icon-only buttons), so an
unannotated Lucide icon no longer keeps its intrinsic `24px` and overflow the square at
tight/compact density.

**Consequence:** an icon that was passed an explicit `[size]` and projected _without_
`mlvButtonIcon` into a square/circle button now renders at the button's icon size instead.
This already applied to icons carrying `mlvButtonIcon`. Project the icon through
`<ng-template mlvButtonBefore>` (or add a visible label) if the intrinsic size must be kept.

### Detection limits

The label slot is projected content, so it is read back from the DOM after render by an
`afterRenderEffect`. The effect re-runs when `shape`, `loading`, or the presence of the
`mlvButtonIcon` directive changes — **not** when the projected text itself appears or
disappears inside an already-rendered button, and not during server-side rendering (where
`afterRenderEffect` does not run and the pre-existing directive-only behaviour applies).
Annotate the icon with `mlvButtonIcon` when the label content is toggled at runtime.

## Known gap

`mlv-button-toggle` provides `MLV_BUTTON_VARIANT` to its own inner button and falls back to
`primary`, so `<mlv-button-toggle shape="square">` still renders a primary icon button. Set
`variant="secondary"` on the toggle (or on the enclosing `mlv-button-group`) for the
neutral treatment.
