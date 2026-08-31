# Malva UI showcase-first composition primitives

**Date:** 2026-08-21

**Status:** Approved for implementation

**Amends:** [Malva UI documentation showcases and saved views design](./2026-08-20-documentation-showcases-design.md)

## Purpose

The full-size showcases must demonstrate what Malva UI can compose out of the box. A showcase may own realistic fixtures, URL state, and simulated persistence, but it must not reimplement generic layout, overlay, filtering, search, sorting, or column-management behavior.

This amendment closes the reusable-library gaps exposed by the Data Operations showcase before additional showcase routes are built. Existing public behavior remains the default; the new APIs are opt-in or additive.

## Source-of-truth rule for CSS custom properties

Every design-system custom property used by a component, example, or documentation page must be declared by `libs/styles/src/lib/*.scss` and listed in `libs/styles/tokens.md`. Component-owned customization hooks remain valid only under that component's namespace and with an explicit fallback.

The workspace already enforces this contract with `styles:check-tokens`. The implementation plan will run it in strict mode. No new baseline entries are permitted.

The audit verified these facts directly from the current source:

- `--mlv-background-elevation-1` is a deprecated-name mapping in `tokens.md`, not a runtime declaration.
- `--mlv-background-page` and `--mlv-color-danger` are also undefined.
- `--mlv-background-raised`, `--mlv-elevation-bg-1`, `--mlv-shadow-0`, `--mlv-shadow-1`, and `--mlv-radius-m` are declared runtime tokens.

Data Operations must remove all three undefined names. Documentation that still presents deprecated names as live API must be corrected. New examples may name a token only after the strict checker and the generated token catalog confirm it.

## Sidebar surface appearance

`MlvSidebar` gains a public, exported appearance contract:

```ts
export type MlvSidebarAppearance = 'raised' | 'flat';
```

```html
<mlv-sidebar appearance="flat">…</mlv-sidebar>
```

- `raised` remains the default and preserves the current border radius and `--mlv-shadow-1` treatment.
- `flat` removes the outer radius and shadow by resolving to zero radius and `--mlv-shadow-0`.
- Flat appearance does not make the surface transparent and does not remove its boundary border. Page Shell may continue to remove the border and remap the background when the sidebar is part of application chrome.
- Off-canvas and floating modes keep their existing behavioral semantics. The off-canvas host remains geometry-only; the Drawer owns the overlay surface.
- The host exposes a BEM modifier class rather than route-specific CSS overrides.

This is deliberately one cohesive appearance choice instead of independent shadow and radius inputs. It covers embedded application navigation without expanding the API into arbitrary styling controls.

## Responsive end pane for Page Shell

The Page package gains reusable `MlvPageEndPane`, `MlvPageEndPaneContent`, and `MlvPageEndPaneTrigger` primitives. The component is a responsive trailing application pane: inline above a configured breakpoint and a Drawer below it.

```html
<mlv-page-end-pane
  #details
  width="20rem"
  collapseBelow="lg"
  ariaLabel="Account details"
  [(opened)]="detailsOpen"
>
  <ng-template mlvPageEndPaneContent>
    …details content…
  </ng-template>
</mlv-page-end-pane>
```

Public contract:

- `opened`: two-way bindable logical visibility, independent of the current renderer;
- `width`: CSS inline size for both the inline pane and Drawer, defaulting to `20rem`;
- `collapseBelow`: `MlvBreakpoint | null`, using `MlvBreakpointService` and the workspace breakpoint provider;
- `ariaLabel`: accessible name for the inline complementary landmark and compact Drawer;
- `closeOnBackdropClick`, `closeOnEscape`, and `initialFocus`: forwarded overlay behavior with current Drawer defaults;
- `open()`, `close()`, and `toggle()` imperative helpers for row selection and ordinary buttons;
- `afterOpened` and `afterClosed` lifecycle outputs representing the logical pane rather than a renderer migration.

`MlvPageEndPaneTrigger` is an optional directive for explicit native-button controls. It accepts the pane instance, calls `toggle()`, and owns `aria-expanded` plus the pane relationship. Table row activation may call `open()` directly; the pane still captures the focused row as the restoration target.

Page Shell accepts `<mlv-page-end-pane>` in its trailing projection slot in addition to the existing `[mlvPageEndSidebar]` marker. Existing static end sidebars remain supported.

The pane has one projected template and renders exactly one content instance. When the viewport crosses the breakpoint while the pane is open, the content migrates between inline and Drawer presentation without changing `opened`, duplicating landmarks, firing a logical close, or restoring focus prematurely. Escape, backdrop dismissal, and an internal close control all set `opened` to `false`. A real close restores focus to the connected element that initiated the logical open.

The inline renderer is a named `aside`; the compact renderer uses the existing modal Drawer and its focus trap. The host collapses to zero width while closed or while its content is in the overlay, so the center Page track never reserves stale space.

To make breakpoint migration correct, the shared declarative overlay base gains a backward-compatible `restoreFocus` boolean input, defaulting to `true`. `MlvPageEndPane` disables Drawer-owned restoration and owns one logical focus lifecycle across both renderers.

## Data Table toolbar ownership

Data Operations will use the existing controlled Data Table search and built-in Columns popup. The route will not render parallel Search or Columns controls.

Data Table gains an opt-in table-owned Sort menu:

```html
<mlv-data-table showSortMenu [(searchQuery)]="accountSearch" … />
```

- `showSortMenu` is a coerced boolean input with a default of `false`, preserving current tables.
- The control appears only when at least one column is sortable.
- The menu derives labels and keys from sortable column definitions; the host does not repeat column metadata.
- The menu lists every sortable column. Choosing an inactive column applies ascending sort. The active column exposes a nested direction menu with Ascending, Descending, and Clear sort actions, using the existing nested-menu keyboard model.
- User actions reset pagination to page one and emit exactly one normalized `presentationStateChange` snapshot.
- Programmatic presentation-state application remains silent.
- Sort, direction, clear, and accessible-label strings are added to `MLV_DATA_TABLE_I18N` and every locale pack. No English-only literals are introduced.
- Existing sortable column headers remain available and synchronized with the same controlled sort state.

Data Table also gains an optional `MlvDataTableToolbarActions` template slot. It places host-owned domain actions, such as Export or Refresh, after the table-owned Search, Sort, Columns, and Filters controls without requiring a parallel toolbar. The slot affects toolbar visibility but owns no action behavior; projected controls remain ordinary public Malva buttons/menus.

The toolbar renders only when at least one owned control or status is visible. Search, Sort, Columns, and Filters preserve the existing density and popup/menu keyboard behavior.

## Close-button interaction semantics

`mlv-button-close` already owns one native button and its keyboard semantics. A consumer must listen to that button's bubbled native `click`; it must not put `mlvClick` on the custom-element host, because that creates a second `role="button"`/`tabindex="0"` ancestor around an interactive descendant.

The affected Search Field, Alert, Form Control Wrapper, Combobox, and Select templates will switch their close-button bindings to native `click` and remove unused `MlvClick` imports. Existing disabled, clear, and focus-preservation behavior must remain intact. Component tests and axe regressions must prove that each rendered close affordance has one focus stop and no nested interactive violation.

## Data Operations refactor

After the shared primitives exist, Data Operations becomes a composition reference rather than an application-specific component fork:

1. The Views region is `MlvSidebar appearance="flat" mode="fixed" collapseBelow="lg"` containing `MlvViewVariantList`. The existing external `MlvSidebarTrigger` reopens it in off-canvas mode.
2. The details region is `MlvPageEndPane`, bound to account selection and using its responsive Drawer behavior.
3. Search, Sort, and Columns come from `MlvDataTable`; the route binds controlled query and presentation state. Export is projected through `MlvDataTableToolbarActions` instead of creating a second toolbar.
4. Filter serialization and evaluation use `mlvFilterFieldsToExpression`, `mlvFilterExpressionToFields`, and `mlvMatchesFilterExpression`. The route-local converters and matcher are deleted.
5. View actions are either wired through visible rendered interactions or declared unavailable in capabilities. The showcase will not advertise dead Rename, Share, or Delete actions.
6. The empty-state action really clears optional filters. Restoring a saved view remains a separately labelled action.
7. Route SCSS is limited to domain cell formatting and the smallest spacing/layout glue that no public component owns. It contains no shell surfaces, duplicated responsive sidebars, handcrafted overlay layout, or undefined global tokens.

The route continues to own deterministic account fixtures, URL query synchronization, view selection, simulated create/clone/update persistence, and user-facing operation announcements. Those are intentional domain orchestration, not library behavior.

## State and event flow

- Saved-view selection supplies a normalized filter expression and Data Table presentation snapshot.
- Smart Filter Bar edits the expression through public adapters.
- Data Table emits search and presentation changes through its controlled APIs.
- Any user change marks the active view dirty; programmatic replay does not echo events.
- Row activation sets the selected account and opens the Page end pane.
- Pane dismissal closes the logical inspector and clears the selected account in one host transaction.
- Breakpoint changes alter presentation only; they do not change selection or dirty state.

Async create, clone, and update operations remain isolated by operation identity. A late completion cannot replace a newer selection or action. Failures retain local edits, expose retry/dismiss actions, and do not mutate persisted fixtures.

## Accessibility and responsive requirements

- Exactly one `main` landmark, one named Views `navigation`, and at most one named details `aside` or modal Drawer are present.
- No hidden sidebar or pane content remains tabbable.
- Sidebar and pane triggers expose current expanded state and an accessible name.
- Drawer Escape/backdrop closure synchronizes the controlled model and restores focus after the close animation.
- Sort and Columns menus use the library's menu/popup keyboard behavior and return focus to their triggers.
- Search Field and every close-button consumer pass axe with `nested-interactive` enabled; only jsdom's unsupported color-contrast rule may be excluded from unit axe runs.
- Desktop-to-compact and compact-to-desktop transitions are tested while both open and closed.
- Reduced-motion behavior must not strand an overlay or delay model synchronization.

## Verification contract

Implementation is not complete until all of the following are green on the same committed tree:

- focused RED/GREEN unit suites for Sidebar appearance, Page end pane, Drawer focus restoration, Data Table sort menu, Search Field/close-button consumers, and Data Operations rendered interactions;
- library and docs lint/typecheck targets;
- full affected component suites and the full docs suite;
- grouped core build and production docs build;
- `yarn nx run styles:check-tokens --strict --skipNxCache` with zero findings;
- the existing padding-token gate and docs API extraction/check;
- axe checks covering rendered menus, Drawer, and clear buttons;
- in-app Browser review at the approved fixed viewport, without entering fullscreen, with the approved Data Operations reference and implementation captured at the same state and compared together.

The rendered route tests must click the real menu items, dialog actions, clear/reset controls, sidebar trigger, row, pane close control, backdrop, and Escape path. Direct method calls alone do not satisfy the showcase interaction contract.

## Out of scope

- Backend persistence, real authorization, or live account data.
- A generic saved-view persistence service.
- A second start-pane abstraction; `MlvSidebar` already owns that use case.
- Domain-specific Page inspector APIs.
- Replacing sortable headers or existing static `[mlvPageEndSidebar]` content.
- Showcase-only wrappers that conceal custom behavior behind a local component name.
