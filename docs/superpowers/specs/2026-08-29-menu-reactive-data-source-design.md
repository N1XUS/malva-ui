# Reactive menu and menubar data sources

## Status

The design direction was approved in conversation. Implementation is
intentionally not included in this document's commit.

## Goal

Extend `mlv-menu` and `mlv-menubar` with an optional data-driven rendering mode:

- accept an in-memory array or `MlvDataSource<T>`;
- render each item through a typed `*mlvMenuItemDef` template;
- preserve the existing projected-template API when no data source is set;
- turn items with lazy children into submenu triggers automatically;
- show a localized loader while a lazy submenu is being fetched; and
- support non-focusable dividers between root-level menubar items.

The feature must fit the current CDK-overlay menu architecture, retain the
existing keyboard and hover behavior, and avoid changing the general-purpose
`mlv-list-item` component.

## Public API

### Menu item model and source

Add the following public types to the menu package. `T` is the payload type
owned by the application; the menu item itself remains a strongly typed
`MlvMenuItemData<T>` value.

```ts
import { Observable } from 'rxjs';
import { MlvDataSource } from '@malva-ui/cdk/data-source';

export interface MlvMenuItemData<T = unknown> {
  readonly id: string | number;
  readonly label: string;
  readonly data?: T;
  readonly disabled?: boolean;
  readonly children?: Observable<MlvMenuItemData<T>[]>;
}

export type MlvMenuDataSource<T> = T[] | MlvDataSource<T>;
```

`children` is an observable child collection. The observable emits an array of
child items; a one-item submenu is represented by a one-element array. This
keeps the API consistent with the root `dataSource` collection and permits a
source to emit refreshed child collections over time.

`dataSource` is an optional input on both `MlvMenu` and `MlvMenubar`. The
component generic defaults to the standard menu item shape and constrains
custom item types to expose the same structural fields:

```ts
export class MlvMenu<
  TItem extends MlvMenuItemData<unknown> = MlvMenuItemData<unknown>,
> {
  readonly dataSource = input<MlvMenuDataSource<TItem> | undefined>(undefined);
}
```

The concrete `TItem` used by the menu is `MlvMenuItemData<TPayload>` in the
standard case. The input contract deliberately remains `T[] | MlvDataSource<T>`
so consumers can use a custom item subtype without an adapter. The data item
must expose the fields required by `MlvMenuItemData` for automatic submenu
behavior. `MlvMenubar` uses the same generic shape with
`MlvMenubarEntry<TItem>` as its source item.

An array is rendered as supplied. An `MlvDataSource` is connected through its
existing `connect()` signal, and the latest emitted collection is the menu's
current collection. Menus do not add pagination or accumulation semantics;
those remain the responsibility of the data source. Replacing the source or
updating its emitted collection reconciles the rendered rows and preserves the
open menu only when the active item id still exists.

When `dataSource` is `undefined` (or is cleared), the current content-projected
behavior is used. If projected menu content and a data source are both present,
data mode takes precedence and the projected item definition is used only as
the row template.

### `mlvMenuItemDef`

Add a typed structural directive:

```ts
export interface MlvMenuItemDefContext<T> {
  readonly $implicit: T;
  readonly index: number;
  readonly hasChildren: boolean;
  readonly loading: boolean;
}

@Directive({ selector: '[mlvMenuItemDef]' })
export class MlvMenuItemDef<T = unknown> {
  readonly templateRef = inject(
    TemplateRef<MlvMenuItemDefContext<T>>,
  );

  static ngTemplateContextGuard<T>(
    _directive: MlvMenuItemDef<T>,
    _context: unknown,
  ): _context is MlvMenuItemDefContext<T> {
    return true;
  }
}
```

The intended usage is:

```html
<mlv-menu [dataSource]="items">
  <mlv-list-item mlvMenuItem *mlvMenuItemDef="let item">
    {{ item.label }}
  </mlv-list-item>
</mlv-menu>
```

The definition is a complete row template. The menu renderer instantiates it
once per data item and supplies the item as `$implicit`; `index`,
`hasChildren`, and `loading` are available for advanced templates. The
renderer attaches the existing menu item behavior to the resulting
`mlv-list-item[mlvMenuItem]`, so click, disabled, roving-tabindex, type-ahead,
and submenu keyboard behavior remain centralized in the menu layer.

Exactly one `mlvMenuItemDef` is supported per data-driven menu level. If no
definition is projected, the menu uses an internal default row that renders
the item's `label`. Existing projected menus do not require a definition.

### Root menubar dividers

Add a divider entry type for data-driven menubars:

```ts
export interface MlvMenubarDividerData {
  readonly kind: 'divider';
  readonly id: string | number;
}

export type MlvMenubarEntry<
  TItem extends MlvMenuItemData<unknown>,
> = TItem | MlvMenubarDividerData;
```

`MlvMenubar.dataSource` accepts
`MlvMenubarEntry<TItem>[] | MlvDataSource<MlvMenubarEntry<TItem>>`, where
`TItem` defaults to `MlvMenuItemData<unknown>`.
Divider entries render as a vertical `role="separator"` and are excluded from
the menubar's `FocusKeyManager`, type-ahead, open-follow, and adjacent-menu
navigation. Divider ids must be unique within the root collection and are used
for reconciliation tracking.

In projected mode, a root-level `<mlv-divider orientation="vertical" />` is
also supported as a visual divider. It is ignored by the top-level trigger
query and is not made focusable. Dividers are supported at the menubar root
only; nested menu item collections remain action-item collections.

## Rendering architecture

Keep the existing `MlvMenu` overlay, `MlvPopupService`, `MlvMenuTrigger`, and
manual CDK `FocusKeyManager` architecture. Add a small internal data-rendering
layer rather than teaching `MlvListItem` about menus:

1. `MlvMenu` and `MlvMenubar` normalize their source to a signal of current
   entries. Arrays are wrapped in a stable signal; `MlvDataSource.connect()` is
   consumed as the reactive signal.
2. A menu-owned renderer uses `NgTemplateOutlet` with the queried
   `MlvMenuItemDef` and creates the recursive data-mode menu panels. Each
   generated row is associated with its data item id and the owning `MlvMenu`
   instance.
3. The renderer registers generated menu items with the same menu-level focus
   manager used by projected items. Reconciliation updates registration,
   disabled state, and roving tabindex without rebuilding focus state
   unnecessarily.
4. A data item with `children` is automatically configured as a submenu
   trigger. Consumers do not add `[mlvMenuTrigger]`, `isSubmenuTrigger`, or an
   arrow to the row template. Leaf items retain the normal activation behavior.
5. A child observable is subscribed to only when its submenu is first opened
   or otherwise needs to render. The subscription is disposed when that item is
   removed or its owning menu is destroyed. Later emissions update the open
   submenu in place.

The data renderer must not change the behavior of projected menus. In
particular, a projected item with an explicit `MlvMenuTrigger` continues to
use the existing trigger directive, pointer-intent cone, popup positioning,
focus restoration, and menubar coordination.

## Submenu indicator

The arrow is a menu concern, not a `MlvListItem` concern. In data mode, the
menu renderer marks a row with `aria-haspopup="menu"` and the menu stylesheet
adds a menu-owned CSS chevron to the existing list-item surface. The
pseudo-element is decorative by construction and does not create another
accessible node or focus target.

Use the same visual vocabulary as select/combobox control icons:

- width and height from `var(--form-ctrl-icon-size, 1.25rem)`;
- `display: inline-flex`, centered alignment, and `flex: 0 0 auto`;
- default color `var(--mlv-text-tertiary)`;
- stronger color on row hover/focus using the existing menu/list text tokens;
- a menu-specific chevron pseudo-element, without modifying `MlvListItem`
  source or styles.

The indicator is present for every data item that declares `children`, even
before the child observable has emitted. `aria-expanded` is synchronized with
the submenu open state. The loading affordance is rendered in the submenu
panel and does not replace the row's chevron.

## Lazy loading and loading state

When a submenu with an observable `children` value is opened before its first
child collection arrives:

- the submenu overlay opens immediately;
- the submenu panel renders an indeterminate circular `MlvLoader`;
- the loader uses the existing `MlvLoader` default aria label, which resolves
  through `MLV_LOADER_I18N`; no hardcoded accessibility string is added to the
  menu package;
- the first child emission replaces the loader with the child rows; and
- subsequent child emissions reconcile the rows without resubscribing.

An empty first emission produces an empty submenu and ends the loading state.
If the observable errors, the renderer ends loading, leaves the submenu empty,
and keeps the parent menu usable. The error is not allowed to surface as an
unhandled subscription error from the menu component. A later source
replacement may retry by creating a new child observable.

Root `MlvDataSource` loading is not used to show a loader inside an already
projected menu. Data-driven root rendering waits for the source's connected
collection according to the existing `MlvDataSource` contract; lazy submenu
loading is the required new loader behavior.

## Accessibility and interaction

- Existing `role="menu"`, `role="menubar"`, `role="menuitem"`, roving
  tabindex, type-ahead, Escape, ArrowLeft, and ArrowRight behavior remains in
  place.
- Data-driven submenu rows expose `aria-haspopup="menu"` and
  `aria-expanded`; the generated submenu trigger points to the stable panel id
  with `aria-controls` while open.
- Disabled data items set the same disabled semantics as projected menu items
  and are skipped by keyboard navigation.
- The arrow is decorative and never receives focus.
- The lazy loader is a progressbar with the existing localized loader label.
- Dividers expose `role="separator"` with vertical orientation and are not
  included in the roving-tabindex collection.
- Focus restoration and menubar sibling switching continue to be handled by
  `MlvMenuTrigger` and `MlvMenubarAccessor`, not duplicated in the data
  renderer.

## Files and package changes

Expected implementation changes are limited to the menu family and its
documented dependencies:

- add public menu data types and the `MlvMenuItemDef` directive;
- add the internal recursive data renderer and its focused unit tests;
- extend `MlvMenu` and `MlvMenubar` with data-source mode while preserving the
  projected path;
- add menu-owned submenu-indicator styling and root divider styling;
- import `MlvLoader` and `MlvDataSource` through the existing public package
  boundaries and update the menu project dependency metadata if required;
- update the menu barrel export;
- update `libs/core/menu/CLAUDE.md` with the API, examples, accessibility
  behavior, and file structure; and
- add documentation examples for array sources, `MlvDataSource`, lazy
  children, typed item definitions, and menubar dividers.

No new i18n token or locale shape is required because the loader already owns
and resolves its localized accessible label.

## Testing strategy

Use focused `core-menu` Nx/Vitest tests, following the existing projected-menu
coverage. Add tests for:

1. array-source rendering with the typed item definition and default-label
   fallback;
2. reactive updates from an `MlvDataSource` signal, including removal of the
   currently open item;
3. disabled data items and their exclusion from keyboard navigation;
4. automatic submenu configuration from `children`, including pointer and
   ArrowRight opening and `aria-haspopup`/`aria-expanded` state;
5. lazy child loading, localized `MlvLoader` rendering, first emission,
   refresh emission, empty emission, and error completion;
6. submenu indicator dimensions, color/state classes, and the fact that no
   changes are required in `MlvListItem`;
7. menubar arrays and data sources containing root-level dividers, proving
   dividers are rendered, non-focusable, and skipped during Home/End,
   ArrowLeft/ArrowRight, and type-ahead navigation;
8. projected menus and projected menubars retaining their current behavior;
9. source replacement and component destruction disposing child subscriptions;
   and
10. Angular template type-checking for `let item` and the context properties
    exposed by `MlvMenuItemDef`.

Run the menu test, lint, and typecheck targets through Nx. Existing unrelated
working-tree changes must remain untouched.

## Non-goals

- replacing the current projected menu API;
- changing `MlvListItem` or making its generic layout aware of submenu arrows;
- adding menu pagination, filtering, or selection state;
- supporting nested dividers inside menu item child collections;
- adding a second menu-specific loading translation key; or
- migrating the menu to `@angular/aria` primitives.
