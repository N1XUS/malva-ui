# 2026-09 — Drawer header rebuilt as a component

Applies to `@malva-ui/core/drawer` (`MlvDrawerHeader`, `MlvDrawer`,
`MlvDrawerRef`) and `@malva-ui/i18n` (`MLV_DRAWER_I18N`). Fixes #117.

**No exported symbol was renamed or removed.** `MlvDrawerHeader` changed
kind — from a bare class-applying directive to a component with a template —
and its old selector `[mlvDrawerHeader]` keeps working. Most consumers get
the new behaviour for free; the two spots that need a decision are called out
in §3.

## 1. What changed

| Before                                                          | After                                                                                                                                                                                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[mlvDrawerHeader]` directive: `class="mlv-drawer__header"`, nothing else | `mlv-drawer-header, [mlvDrawerHeader]` component: **title → projected content → `mlv-button-close`**, in that order                                                                                                     |
| Consumers hand-rolled a close button (`button[mlvButton]` + `lucideX`) | A trailing `mlv-button-close` (`variant="transparent" shape="circle"`, `aria-label` = `MLV_DRAWER_I18N.closeDrawer`) is rendered unless `closable="false"`; it calls `close()` on the enclosing `MlvDrawer` or `MlvDrawerRef` |
| Header content inherited the app density; `mlv-drawer-sections` (36px) sat next to a 44px close | The header **pins `compact`** on its content through `MLV_DENSITY_CONTEXT` (override with `mlvDensity`) and pins the close at `comfortable`, so every control on the row is 36px                                            |
| No title API; the drawer's accessible name came from `ariaLabel` / `ariaLabelledBy` / the i18n fallback only | `title` input (renders `<h2 class="mlv-drawer__title">`, or `<h{level}>` through the new `level` input), or a projected `h1`–`h6` / `[mlvDrawerTitle]` element; the title's id is registered as the drawer's `aria-labelledby` |
| Resizable bottom sheet: a 48px handle strip **stacked above** a 69px header (117px of chrome) | The handle overlays the top of the header — one 69px band; empty header space still drags                                                                                                                                   |
| `MLV_DRAWER_I18N`: `drawer`                                     | `MLV_DRAWER_I18N`: `drawer`, **`closeDrawer`** — added to every locale pack                                                                                                                                                  |

Two adjacent `mlv-drawer` fixes ride along, both surfaced by the new docs
examples (left resizable panel, playground):

- `minSize` was declared and documented but never bound; it is now the
  panel's `min-width` / `min-height`, so a drag resize cannot shrink the
  panel below it.
- A resizable `left` / `right` drawer rendered its handle as an in-flow
  `height: 100%` flex-column item, which took a full row and pushed the
  header (and body) below the panel. The handle is now absolute in a 48px
  gutter the panel reserves at its inward edge.
- `minSize` is clamped to the viewport the way `maxSize` already was
  (`min-*` beats `max-*`, so an unclamped floor undid the viewport clamp).
- The resize handle's `aria-valuenow` is now a signal, re-read from the
  rendered box after a free-resize gesture and after every key step. It was
  a plain field written from a `fromEvent` listener — stale after any drag
  under zoneless — and it reported the requested size where `minSize` /
  `maxSize` had clamped the box.
- The header's close button is optically hung: `.mlv-drawer__close > .mlv-button`
  gets a negative `margin-inline-end` derived from its own glyph / height
  tokens, so the X's strokes sit on the same vertical line as the body's
  field edges instead of ~12px inside it.
- `.mlv-drawer__body` is `overflow: clip` instead of `hidden`, so nothing
  can scroll it programmatically; the body viewport is the only scroller.

Three fixes outside `mlv-drawer` were found while testing the new product
form and ship in their own commits on the same branch:

- `mlv-switch`, `mlv-checkbox`, `mlv-radio` and `mlv-file-upload` now
  position their block (`position: relative`), so their visually-hidden,
  absolutely positioned native input is contained by the control. Without
  it the input was laid out against the drawer body's scrollbar host —
  outside the scroll viewport — and clicking a switch label scrolled the
  hidden-overflow body ~2000px: the content vanished, the viewport stayed.
- `mlv-select`, `mlv-day-picker` and `mlv-date-range-picker` paint their
  rendered placeholder with `--mlv-text-tertiary`, the token `mlv-input` /
  `mlv-textarea` / `mlv-number-input` use for `::placeholder` (was
  `--mlv-text-secondary`, one shade darker than the input beside them).

Accessible-name precedence on `mlv-drawer` is now `ariaLabelledBy` →
`ariaLabel` → registered header title(s) → i18n `drawer`. Service-opened
drawers (`MlvDrawerService.open()`, routable drawers) get the same title
labelling through `MlvDrawerRef`, and the service now writes the i18n
`drawer` string as `aria-label` on the pane at open, handed back whenever the
last title withdraws; before this change those panes had **no** accessible
name unless the opened component set one itself. A header inside a service
drawer that was opened with an `injector` from inside a declarative drawer's
content (a routable drawer from a drawer body) labels and closes the pane it
renders in, not the outer drawer.

## 2. Migrate

Preferred form — drop the hand-rolled close and pass the title:

```html
<!-- before -->
<div mlvDrawerHeader>
  <h3>New product</h3>
  <mlv-drawer-sections />
  <mlv-spacer />
  <button mlvButton mlvButtonIcon shape="circle" (click)="drawer.close()">
    <svg lucideX [size]="16" />
  </button>
</div>

<!-- after -->
<mlv-drawer-header title="New product">
  <mlv-drawer-sections />
  <mlv-spacer />
  <button mlvButton type="submit" form="product-form">Create</button>
</mlv-drawer-header>
```

The attribute form needs no change to keep rendering, but a heading inside
it must be a **direct child** (`h1`–`h6`, or any element with a
`mlvDrawerTitle` attribute) to be picked up as the title:

```html
<div mlvDrawerHeader>
  <h4>Edit product</h4>
  <mlv-spacer />
  <button mlvButton type="submit" form="product-form">Save</button>
</div>
```

## 3. Decide

- **You still render your own close button.** You now get two. Either delete
  yours (preferred) or pass `closable="false"` — do the latter when every
  dismissal must go through your own confirm flow (the docs `settings-access`
  showcase does this).
- **You bind `ariaLabel` on `mlv-drawer`.** It keeps winning over the header
  title — nothing changes, but you can usually drop it now.
- **The header's buttons were `comfortable` (44px) before.** They are
  `compact` (36px) now. Pass `mlvDensity="comfortable"` on `mlv-drawer-header`
  to get the old height back — the close button stays 36px either way.
- **A `[mlvTitle]` heading inside the header** keeps its own `data-level`
  size and does not take the row's 16px type. Use a plain heading or the
  `title` input.
- **Custom `MLV_DRAWER_I18N` providers** must add `closeDrawer`.
- **The body holds `[mlvDrawerSection]`s and the header uses `title`.**
  Sections render `<h5>`; pass `level="4"` so the outline does not jump from
  `<h2>` to `<h5>` (axe `heading-order`).

## 4. Known follow-ups

- `mlv-button-close` resolves one density step **below** `mlvButton` at every
  level (36 / 28 / 24 vs 44 / 36 / 28), which is why the header has to pin
  the two at different densities to line up. That ladder — and the comment in
  `button-close.ts` that contradicts it — is unchanged here and tracked as a
  separate issue.
- An app that only ever opens drawers through `MlvDrawerService` gets no
  `drawer.scss`: the sheet is `MlvDrawer`'s component stylesheet, and that
  goes for `mlv-drawer-header` exactly as it did for `[mlvDrawerBody]` /
  `[mlvDrawerFooter]` before it. Pre-existing; tracked separately.
- The merged bottom-sheet band is gated on `:has()` (Baseline 2023). Firefox
  < 121 drops those rules and renders the stacked strip + header instead.
