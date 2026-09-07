# 2026-08 — Sidebar responsive mode, row rhythm, and landmark naming

Applies to `@malva-ui/core/sidebar` (`MlvSidebar`, `MlvSidebarTrigger`,
`MlvSidebarContextValue`) and to `@malva-ui/i18n` (`MlvSidebarI18n`).

No exported symbol was renamed or removed. Everything below is additive except two
**default rendering** changes, both called out under "Behaviour changes".

## 1. New API

| Symbol                                               | Kind           | Default     | What it does                                                                                                                      |
| ---------------------------------------------------- | -------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `MlvSidebar.ariaLabel`                               | `input()`      | `undefined` | Accessible name for the `navigation` landmark. Falls back to `MLV_SIDEBAR_I18N.navigation`.                                       |
| `MlvSidebar.collapseBelow`                           | `input()`      | `null`      | `MlvBreakpoint \| null`. Below the given viewport breakpoint the sidebar behaves as an offcanvas drawer, whatever `mode` says.    |
| `MlvSidebar.effectiveMode`                           | `computed()`   | —           | `Signal<MlvSidebarMode>` — the mode actually in effect. Equals `mode()` unless a `collapseBelow` override is active.              |
| `MlvSidebarTrigger.sidebar`                          | `input()`      | `undefined` | The `MlvSidebarContextValue` to control, for triggers rendered **outside** `<mlv-sidebar>`.                                       |
| `MlvSidebarContextValue.effectiveMode`               | optional field | —           | `Signal<MlvSidebarMode> \| undefined`. Read it as `effectiveMode?.() ?? mode()`; optional so external implementations stay valid. |
| `MlvSidebarI18n.openNavigation` / `.closeNavigation` | i18n keys      | —           | Accessible names for the trigger while it is a drawer menu button. Present in all fourteen packs.                                 |

### `ariaLabel` — why an input and not the attribute

`MlvSidebar` binds `aria-label` on its host, so a static
`<mlv-sidebar aria-label="Admin sections">` was silently overwritten with the localized
default and two sidebars on one page became indistinguishable landmarks. Use the input:

```html
<mlv-sidebar ariaLabel="Admin sections">…</mlv-sidebar>
```

### `collapseBelow`

```html
<mlv-sidebar #nav collapseBelow="md" [(collapsed)]="collapsed">
  <div mlvSidebarContent>…</div>
</mlv-sidebar>

<!-- A closed drawer renders none of its projected content, so the trigger
     lives outside the sidebar and is pointed at it. -->
<mlv-sidebar-trigger [sidebar]="nav" />
```

Below the breakpoint the sidebar closes itself, `effectiveMode()` reports `'offcanvas'`,
and `mlv-sidebar-trigger` renders as a hamburger/close menu button (and is no longer
hidden by `mode="fixed"`). Growing the viewport back restores the authored `mode` and the
`collapsed` value the sidebar had before the override. Thresholds come from
`MLV_BREAKPOINT_CONFIG` (`provideMlvBreakpoints()`); detection uses `MlvBreakpointService`
→ CDK `BreakpointObserver`, so it is SSR-safe.

`collapseBelow` defaults to `null`, so an untouched sidebar behaves exactly as before.

## 2. Behaviour changes

### 2.1 An offcanvas sidebar no longer reserves inline width

| Before                                                     | After                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `.mlv-sidebar--offcanvas { width: 100%; }` on the **host** | `width: 0; min-width: 0; flex: 0 0 auto; overflow: hidden;` |

The drawer panel lives in a CDK overlay, so the `<mlv-sidebar>` element itself is only an
anchor in the page flow. At `width: 100%` it consumed the whole flex/grid track and
squeezed the content beside it to nothing — and it made `collapseBelow` unusable, since
the layout would break the moment the viewport crossed the breakpoint.

If you compensated for the old width with your own CSS (a negative margin, a fixed width
on the sibling, `position: absolute` on the sidebar), remove that workaround.

### 2.2 Group rows are 2px shorter — they now match plain items

`.mlv-sidebar-group__content` (the `mlv-expand` panel) applied `padding-top: 0.125rem`
unconditionally. A closed `mlv-expand` still occupies its padding box, so every collapsed
group was 38px tall against a 36px `mlv-sidebar-item`, and a mixed list visibly drifted.
The padding now applies only under `.mlv-expand--open`.

Row heights of `mlv-sidebar-item`, `.mlv-sidebar-group__header`,
`.mlv-sidebar-group__icon-btn` and `.mlv-sidebar-trigger__btn` all resolve from one new
component variable:

```css
--mlv-sidebar-row-height: 2.25rem; /* declared on .mlv-sidebar */
```

It is density-aware on the sidebar block (tight `1.875rem`, compact `--mlv-height-xs`,
comfortable `2.25rem`, spacious `--mlv-height-s`, airy `--mlv-height-m`). Override it on
`.mlv-sidebar` — or on any ancestor — to retune the whole rail at once. The derived
`--mlv-sidebar-icon-column-width` is unchanged and deliberately does not scale with
density.

## 3. Not affected

- Sidebars without `collapseBelow` (the default) — `effectiveMode()` is `mode()`.
- `mlv-sidebar-trigger` nested inside `<mlv-sidebar>` without the `sidebar` input; it
  still resolves the ancestor `SIDEBAR_CONTEXT`.
- Every other public input, output, selector, and CSS class name.
