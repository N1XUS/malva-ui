---
# Library: avatar

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Avatar library (`@malva-ui/core/avatar`) provides a versatile component for representing users or entities. Supports three content modes: image (with shimmer skeleton + fade-in), initials (explicit or derived from a name), and arbitrary projected content (icons, etc.). Includes a `MlvColorFromTextPipe` for deriving deterministic background colors from name strings.

## Public API

Exported from `libs/core/avatar/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvAvatar` | Component | User/entity avatar — `mlv-avatar` |
| `MlvAvatarSize` | Type | `'xs' \| 's' \| 'm' \| 'l' \| 'xl' \| 'xxl'` |
| `MlvAvatarShape` | Type | `'circle' \| 'square'` |
| `deriveInitials` | Function | Derives up-to-2-character initials from a name string |
| `MlvColorFromTextPipe` | Pipe | `mlvColorFromText` — deterministic HSL color from a string |

---

## Components

### `MlvAvatar`

**File:** `libs/core/avatar/src/lib/avatar/avatar.ts`
**Template:** `libs/core/avatar/src/lib/avatar/avatar.html`
**Styles:** `libs/core/avatar/src/lib/avatar/avatar.scss`

- **Selector:** `mlv-avatar`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`

#### Content Priority

1. `src` image (with skeleton + fade-in; falls back to initials on error)
2. `initials` / `name` derived initials
3. Projected `ng-content` (icons, custom elements)

#### Inputs

| Name       | Type             | Default    | Description                                                                                   |
| ---------- | ---------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `size`     | `MlvAvatarSize`  | `'m'`      | Size variant (maps to fixed width/height/font-size)                                           |
| `shape`    | `MlvAvatarShape` | `'circle'` | Shape — `circle` (50% radius) or `square` (8px radius)                                        |
| `src`      | `string \| null` | `null`     | Image URL; shows shimmer skeleton while loading; falls back on error                          |
| `name`     | `string`         | `''`       | Display name; first letter of each word (max 2) used as initials                              |
| `initials` | `string`         | `''`       | Explicit initials; overrides `name`-derived initials                                          |
| `color`    | `string`         | `''`       | Identity tint for the background; pass a **pale** one (see _Colour pair_). Empty → theme pair |
| `label`    | `string`         | `''`       | Optional text label displayed below the avatar visual                                         |

#### Host Bindings

```ts
host: {
  class: 'mlv-avatar',
  '[class]': '"mlv-avatar--" + size()',
  '[class.mlv-avatar--circle]': 'shape() === "circle"',
  '[class.mlv-avatar--square]': 'shape() === "square"',
  // Present the avatar as one labelled image to assistive tech when it names
  // an entity; omit the role when there is no name so no nameless role=img.
  '[attr.role]': '_accessibleName() ? "img" : null',
  '[attr.aria-label]': '_accessibleName()',
}
```

> **Accessible name (`_accessibleName`)** — computed as `name() || label() || null`.
> When present, the host gains `role="img"` with that name so an `aria-label`
> is valid on the otherwise role-less host (this is what mlv-avatar-group
> relies on — it passes `[name]` and no longer sets a redundant `aria-label`).
> When absent (icon-only / initials-only avatar), the role is omitted so axe
> does not flag a nameless `role="img"`.

#### Colour pair (#302)

- `.mlv-avatar__visual` always carries a background **and** a foreground; initials
  (`color: inherit`, opaque) and projected content inherit the foreground.
- **No `color`** → nothing bound inline; `avatar.scss` paints the theme pair
  `--mlv-background-neutral-1` / `--mlv-text-primary` (16.4 / 15.1 / 17.1:1 light
  / dark / HC).
- **`color` set** → `_backgroundColor()` binds the tint, `_foregroundColor()`
  binds `var(--mlv-palette-neutral-800)`. A tint does not follow the theme, so
  its foreground cannot either. Worst case over all 3,241 `mlvColorFromText`
  colours: 6.2:1.
- Contract: pass a pale tint (lightness ~75–85%). A mid or dark `color`
  (e.g. `#5770cb`, 3.3:1) fails AA under the fixed foreground — nothing detects it.
- Before #302: the default bound `var(--mlv-text-secondary)` inline under 0.8-opacity
  `neutral-800` initials — 1.72:1 in light; the worst pipe tint read 4.29:1.
- A tinted avatar sets an inline `color` on `__visual`, which beats any stylesheet
  rule there — a consumer retargets the foreground on `.mlv-avatar__initials` /
  `.mlv-avatar__content` instead.
- jsdom's `cssstyle` drops `var()` on `color` / `background-color`, so neither
  `element.style` nor the serialised `style` attribute can see the pair.
  `avatar.spec.ts` asserts the bound strings on the component **and** records
  writes through the `CSSStyleDeclaration` `color` setter per `__visual` (a
  `neutral-800` write for a tinted avatar), so deleting the `[style.color]`
  binding goes red.

#### Size Reference

| Size  | Width/Height  | Font size |
| ----- | ------------- | --------- |
| `xs`  | 1.5rem (24px) | 0.625rem  |
| `s`   | 2rem (32px)   | 0.75rem   |
| `m`   | 2.5rem (40px) | 0.875rem  |
| `l`   | 3.5rem (56px) | 1rem      |
| `xl`  | 5rem (80px)   | 1.25rem   |
| `xxl` | 6rem (96px)   | 1.5rem    |

#### Template Structure

```
.mlv-avatar
  .mlv-avatar__visual        ← colored container
    .mlv-avatar__skeleton    ← shimmer (while image loads)
    img.mlv-avatar__image    ← image (fades in on load)
    span.mlv-avatar__initials ← initials text
    span.mlv-avatar__content  ← ng-content slot
  .mlv-avatar__label         ← optional label below
    span.mlv-avatar__label-word (× n words, each wrapped in MlvFade)
```

---

## Pipes

### `MlvColorFromTextPipe`

**File:** `libs/core/avatar/src/lib/color-from-text.pipe.ts`
**Pipe name:** `mlvColorFromText`

Converts a string to a deterministic `hsl(...)` CSS color by hashing the characters into a hue value (0–360). Saturation ~60% and lightness ~80% are fixed for pleasant, accessible results.

Hue is the only thing the name controls; the pale-tint band is deliberate (AB-R6 of the 2026-08 visual language spec) because `mlv-avatar` paints a tinted avatar's foreground in the dark `--mlv-palette-neutral-800`. Empty / `null` / `undefined` input returns `'hsl(210,60%,80%)'` — inside the same band, so a nameless avatar keeps AA-legible initials.

- Band: `hash % 5` is signed → `(s, l) = (60 + k, 80 + k)`, `k ∈ [-4, 4]`, every hue.
- `color-from-text.pipe.spec.ts` sweeps all 3,240 hashed colours plus the
  fallback against `#262626`, composited at the `.mlv-avatar__initials`
  opacity it compiles out of `avatar.scss`: every one ≥ 4.5:1, worst 6.2:1.
  Putting the old `opacity: 0.8` back fails it (44 tints < 4.5, worst 4.29).

```html
<mlv-avatar [name]="user.name" [color]="user.name | mlvColorFromText" />
```

---

## Utilities

### `deriveInitials(name: string): string`

Takes the first character of each space-separated word (up to 2 characters), uppercased. Returns `''` for empty/blank strings.

```ts
deriveInitials('John Doe'); // 'JD'
deriveInitials('Alice'); // 'A'
deriveInitials('John Michael Doe'); // 'JD'
deriveInitials(''); // ''
```

---

## Usage Examples

```html
<!-- Auto initials from name + deterministic color -->
<mlv-avatar name="John Doe" [color]="'John Doe' | mlvColorFromText" />

<!-- Image with fallback to initials on error -->
<mlv-avatar src="https://example.com/avatar.jpg" name="John Doe" label="John Doe" />

<!-- Explicit initials + custom color -->
<mlv-avatar initials="JD" color="hsl(217, 60%, 75%)" size="l" label="John Doe" />

<!-- Icon content (no name/initials) -->
<mlv-avatar size="m" color="hsl(253, 60%, 80%)" label="Bot">
  <svg lucideBot [size]="20" />
</mlv-avatar>

<!-- Square shape -->
<mlv-avatar name="Alice" shape="square" size="xl" [color]="'Alice' | mlvColorFromText" />
```

---

## Dependencies

- `@angular/core`
- `@malva-ui/cdk` — `MlvFade` (used for label word overflow)
