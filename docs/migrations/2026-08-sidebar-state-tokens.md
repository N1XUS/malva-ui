# 2026-08 — Sidebar state surfaces + page-shell chrome remap

**Packages:** `@malva-ui/core/sidebar`, `@malva-ui/core/page`
**Kind:** visual default change + behaviour fix. No public TypeScript API changed — nothing to rename, nothing to re-import.

---

## Why

`MlvPageShell` paints a projected `mlv-sidebar` on its own chrome (the default
`neutral-900`, or an arbitrary brand colour via `[color]`). The sidebar's state
fills, however, came straight from the global theme tokens, which resolve against
the _page_ surface. On a `rgb(65, 99, 169)` brand rail that produced:

- a global grey `#dcdcdc` hover pill under a white icon — **1.37:1**;
- a global lavender `#eaeefa` active pill under a white icon — **1.16:1**, i.e.
  the icon disappeared;
- a grey `--mlv-border-normal` tree line down the expanded accordion.

Remapping the globals wholesale was not an option: everything else a consumer
projects into the rail reads them too.

---

## What changed

### 1. Three state variables on `.mlv-sidebar`

`sidebar.scss` now declares the seam:

```scss
--mlv-sidebar-hover-bg: var(--mlv-background-neutral-1);
--mlv-sidebar-active-bg: var(--mlv-background-accent-1-pale);
--mlv-sidebar-rail-color: var(--mlv-border-normal);
```

Every consumer reads them **with the global repeated as the `var()` fallback** —
the group flyout is portalled into the CDK overlay container, outside
`.mlv-sidebar`, where the declarations do not reach:

```scss
background-color: var(--mlv-sidebar-hover-bg, var(--mlv-background-neutral-1));
```

Consumers: `mlv-sidebar-item` hover + active, `.mlv-sidebar-group__header`
hover, `.mlv-sidebar-group__icon-btn` hover + active,
`.mlv-sidebar-trigger__btn` hover, `.mlv-sidebar-workspace__trigger` hover, and
the `.mlv-sidebar-group__content.mlv-expand--open` tree line.

Defaults are unchanged, so a standalone sidebar looks the same as before except
for the two items below.

### 2. Visual default changes (both themes)

| Surface                                             | Before                                               | After                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Active plain item** (`.mlv-sidebar-item--active`) | action colour + bold only                            | **also gets the `--mlv-background-accent-1-pale` pill.** Colour alone was invisible whenever the host already used the action colour as the sidebar foreground, and it read as a different kind of row than a collapsed group trigger, which always had a pill.                                                                                            |
| **Collapsed group icon button hover**               | `--mlv-background-neutral-1-hover` (a stronger step) | `--mlv-background-neutral-1` — the same tint a plain item uses, so a mixed rail has one hover language.                                                                                                                                                                                                                                                    |
| **Active `--active` rows on hover**                 | dropped back to the hover tint                       | keep the active pill. Both `--active` rules are now written against the block class (`.mlv-sidebar-item.mlv-sidebar-item--active`, `.mlv-sidebar-group__icon-btn.mlv-sidebar-group__icon-btn--active`) plus explicit `:hover`/`:focus-visible` variants, because the modifier alone (one class) loses to the sibling `:hover` rule (class + pseudo-class). |

`.mlv-sidebar-group__header--active` is **deliberately left text-only** (action
colour + bold, no pill): the accordion is open when a child is active, that
child now carries the pill, and a second pill on the header would read as two
active destinations rather than one active section.

**Dark theme.** `--mlv-background-accent-1-pale` resolves to
`color-mix(in srgb, var(--mlv-palette-primary-500) 15%, var(--mlv-palette-neutral-900))`
≈ `rgb(32, 36, 51)` against `--mlv-background-raised` `#1e1e1e` — a quiet blue
tint that reads as a pill without shouting, paired with the `--mlv-text-action`
foreground and `font-weight: 600`. `--mlv-background-neutral-1` (`neutral-800`,
`#262626`) and `--mlv-border-normal` (`neutral-700`, `#404040`) both exist under
the dark block and sit correctly on the same surface. No dark-specific override
was needed.

### 3. `mlv-page-shell` remaps the chrome

`page-shell.scss`, on `&__sidebar.mlv-sidebar`, adds:

```scss
--mlv-sidebar-hover-bg: color-mix(in srgb, var(--mlv-page-shell-effective-foreground) 15%, transparent);
--mlv-sidebar-active-bg: color-mix(in srgb, var(--mlv-page-shell-effective-foreground) 24%, transparent);
--mlv-sidebar-rail-color: color-mix(in srgb, var(--mlv-page-shell-effective-foreground) 30%, transparent);
--mlv-background-neutral-1-hover: /* the same 15 % tint */;
--mlv-background-neutral-1-active: /* the same 24 % tint */;
```

The last two cover anything projected into the rail that resolves the neutral
interactive ramp directly — a transparent-variant `mlvButton` used as a custom
trigger, the workspace switcher's open state — which otherwise kept the theme's
grey pill on the chrome colour. Existing remaps (`--mlv-text-*`,
`--mlv-background-neutral-1`, `--mlv-border-focus`,
`--mlv-sidebar-border-width`) are unchanged.

Because everything derives from `--mlv-page-shell-effective-foreground` (the
contrast-derived black/white endpoint), one rule set covers a light brand
colour, a dark brand colour, and the default `neutral-900` chrome in light and
dark. Measured on `rgb(65, 99, 169)`: active pill = white 24 % → white icon at
**3.53:1**; hover = white 15 % → **4.26:1**. Both clear the WCAG AA 3:1 minimum
for UI components.

### 4. `MlvSidebarGroup` behaviour

- **The accordion never opens while the sidebar is collapsed.** `mlv-expand` is
  now bound to `_accordionOpen()` (`expanded() && !isSidebarCollapsed()`)
  instead of `expanded()`. `expanded` is public and writable, so a host that
  auto-expands the group owning the active route could open an empty accordion
  inside the icon rail — a ghost tree line plus reserved height — and, because
  `#childrenRef` can only project once, it also pulled the children out of the
  open flyout, leaving it showing only its header. The constructor `effect`
  still resets `expanded` when collapse begins, so the guard is purely
  presentational: a pending write takes effect the moment the sidebar expands.
- **The collapsed-mode flyout closes when a child item is activated**, and
  focus returns to the icon trigger — the WAI-ARIA menu-button pattern. A
  bubbling `click` handler on the panel, gated on
  `target.closest('.mlv-sidebar-item')`, so the flyout header and empty panel
  space are ignored. Enter/Space are covered too: `MlvSidebarItem` activates a
  button-style row by calling `.click()` on its host, and a projected anchor
  dispatches a real click. Previously a `routerLink` navigation left the flyout
  hanging over the new page.

---

## Action required

**None** for the public API. Review these if they apply:

- A consumer that hand-styled `.mlv-sidebar-item--active` to add its own
  background now stacks with the library pill. Override
  `--mlv-sidebar-active-bg` on `.mlv-sidebar` instead of writing a background
  rule.
- A consumer overriding `--mlv-background-neutral-1` / `-hover` /
  `--mlv-background-accent-1-pale` / `--mlv-border-normal` on `.mlv-sidebar` to
  reach the sidebar states should move to the three `--mlv-sidebar-*`
  variables — narrower, and it will not bleed into anything else projected into
  the rail.
- A consumer that relied on writing `group.expanded.set(true)` to open an
  accordion while the sidebar is collapsed: it is now a no-op until the sidebar
  expands (which is the intended behaviour — the flyout is the collapsed-mode
  disclosure).
