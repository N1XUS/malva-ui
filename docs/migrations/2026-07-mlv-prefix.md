# 2026-07 — `Mlv` prefix and decorator-suffix removal

Every publicly exported class, type, and interface in the workspace now carries the
`Mlv` prefix, and classes decorated with `@Component` or `@Directive` no longer carry a
`Component` / `Directive` suffix.

```ts
// before
import { ButtonComponent, ButtonIconDirective, ButtonShape } from '@malva-ui/core/button';

// after
import { MlvButton, MlvButtonIcon, MlvButtonShape } from '@malva-ui/core/button';
```

This is a **breaking change with no deprecated aliases** — the old names are gone.

## Scope

- **In:** every identifier reachable from a `@malva-ui/*` entry point declared in
  `tsconfig.base.json` — including the testing entry points
  (`@malva-ui/cdk/testing-e2e`, `@malva-ui/core/form-utils/testing`) and the i18n AI
  translation pipeline.
- **Out:** identifiers not exported from any entry point, `apps/docs`-internal components
  (they keep their `app-` / docs-local naming), injection tokens (already
  `MLV_*` / UPPER_SNAKE_CASE), and standalone functions.

## Rules applied

| Declaration                       | Rule                                | Example                                                            |
| --------------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `@Component` class                | strip `Component` suffix, add `Mlv` | `ButtonComponent` → `MlvButton`                                    |
| `@Directive` class                | strip `Directive` suffix, add `Mlv` | `ButtonIconDirective` → `MlvButtonIcon`                            |
| service / ref / pipe / base class | add `Mlv`, keep the suffix          | `DialogService` → `MlvDialogService`, `DialogRef` → `MlvDialogRef` |
| `type` / `interface`              | add `Mlv`                           | `ButtonShape` → `MlvButtonShape`                                   |
| already `Mlv`-prefixed            | suffix rule still applies           | `MlvBreadcrumbItemDirective` → `MlvBreadcrumbItemHost` (see below) |

## File naming

The `.component` / `.directive` segment is dropped from filenames under `libs/`, matching
the convention the already-migrated libraries use (`button/button.ts`):

```
dialog.component.ts       -> dialog.ts
tooltip.directive.ts      -> tooltip.ts
alert.component.spec.ts   -> alert.spec.ts
drawer-section.component.scss -> drawer-section.scss
```

Plural multi-declaration modules (`button.directives.ts`) are unchanged.

## Collision tie-breakers

Six targets were claimed by two declarations each. Resolutions:

| Declarations                                                                             | Resolution                                                           | Why                                                                                                                    |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `TooltipDirective` `[mlvTooltip]` + `TooltipComponent` `mlv-tooltip-panel`               | `MlvTooltip` + `MlvTooltipPanel`                                     | each name follows its own selector                                                                                     |
| `TabContentDirective` `[mlvTabContent]` + `TabContentComponent` `mlv-tab-content`        | `MlvTabContentDef` + `MlvTabContent`                                 | the directive is a structural template def, matching the existing `MlvCardHeaderDef` / `MlvComboboxItemDef` convention |
| `DialogContentDirective` + `DialogContent` (type)                                        | `MlvDialogContentDef` + `MlvDialogContent`                           | same `Def` convention                                                                                                  |
| `SidebarItemComponent` `mlv-sidebar-item` + `SidebarItemDirective` `[mlvSidebarItem]`    | `MlvSidebarItem` + `MlvSidebarItemHost`                              | the element component is the primary API; the attribute directive only applies host classes/ARIA to your own markup    |
| `MlvBreadcrumbItem` (component) + `MlvBreadcrumbItemDirective` + `BreadcrumbItem` (type) | `MlvBreadcrumbItem` + `MlvBreadcrumbItemHost` + `MlvBreadcrumbEntry` | as above; the data shape for the `[items]` input becomes `MlvBreadcrumbEntry`                                          |
| `DrawerSectionComponent` + `DrawerSection` (interface)                                   | `MlvDrawerSection` + `MlvDrawerSectionState`                         | the interface is the signal-backed registry record; `MlvDrawerSectionConfig` was already the input shape               |

Corresponding filenames follow the class names: `tooltip-panel.ts`,
`tab-content-def.ts`, `sidebar-item-host.ts`, `breadcrumb-item-host.ts`.

### Cross-package collisions

- **`MlvDensityDirective` keeps its suffix.** Stripping it would collide with the
  public `MlvDensity` density-level type. `MlvDensityDirective` and
  `MlvDensityRootDirective` are the documented exceptions to the suffix rule.
- **`@malva-ui/core/data-table` filter types are namespaced.** `@malva-ui/core`
  re-exports both the `filter` and `data-table` barrels, so a bare
  `MlvFilterOperator` in each would be a duplicate export. data-table's 6-operator
  subset becomes `MlvDataTableFilterOperator` / `MlvDataTableFilterOption`; the
  15-operator `MlvFilterOperator` in `@malva-ui/core/filter` is unchanged.
- **`MlvPage` is the page component.** The Playwright page-object fixture in
  `@malva-ui/cdk/testing-e2e` is now `MlvE2ePage`.

## Types reachable only through public signatures

These are declared in files their package barrel does not re-export, so they are not
importable by name from the barrel — but public signatures reference them, so ng-packagr
emits them into the published `.d.ts` (e.g. `MlvButton`'s `variant` input is typed
`MlvButtonVariant`). They are renamed for the same reason.

| Old                                | New                                   | Kind       |
| ---------------------------------- | ------------------------------------- | ---------- |
| `ButtonVariant`                    | `MlvButtonVariant`                    | type       |
| `ButtonShape`                      | `MlvButtonShape`                      | type       |
| `ColumnState`                      | `MlvColumnState`                      | interface  |
| `DataRow`                          | `MlvDataRow`                          | type       |
| `DataTableColumnVisibilityService` | `MlvDataTableColumnVisibilityService` | injectable |
| `DataTableEditingService`          | `MlvDataTableEditingService`          | injectable |
| `DataTablePinningService`          | `MlvDataTablePinningService`          | injectable |
| `DialogServiceContentComponent`    | `MlvDialogServiceContent`             | component  |
| `DrawerResizeDirective`            | `MlvDrawerResize`                     | directive  |
| `FilterDropdownComponent`          | `MlvFilterDropdown`                   | component  |
| `RadioGroupAccessor`               | `MlvRadioGroupAccessor`               | interface  |
| `RgbaColor`                        | `MlvRgbaColor`                        | interface  |
| `SidebarGroupLabelDirective`       | `MlvSidebarGroupLabel`                | directive  |
| `SplitPaneEndDirective`            | `MlvSplitPaneEnd`                     | directive  |
| `SplitPaneStartDirective`          | `MlvSplitPaneStart`                   | directive  |
| `StepHeaderDirective`              | `MlvStepHeader`                       | directive  |
| `SubmenuAimState`                  | `MlvSubmenuAimState`                  | interface  |
| `SwitchGroupAccessor`              | `MlvSwitchGroupAccessor`              | interface  |
| `TimePickerColumnComponent`        | `MlvTimePickerColumn`                 | component  |
| `TreeSubtreeComponent`             | `MlvTreeSubtree`                      | component  |

## Full mapping

<!-- prettier-ignore-start -->

### `@malva-ui/cdk/accessibility`

| Old | New | Kind |
| --- | --- | --- |
| `ClickDirective` | `MlvClick` | directive |
| `TabbableElementService` | `MlvTabbableElementService` | injectable |

### `@malva-ui/cdk/density`

| Old | New | Kind |
| --- | --- | --- |
| `MlvComfortableSpaciousDensityDirective` | `MlvComfortableSpaciousDensity` | directive |
| `MlvCompactComfortableDensityDirective` | `MlvCompactComfortableDensity` | directive |
| `MlvCompactSpaciousDensityDirective` | `MlvCompactSpaciousDensity` | directive |

### `@malva-ui/cdk/infinite-scroll`

| Old | New | Kind |
| --- | --- | --- |
| `InfiniteScrollDirective` | `MlvInfiniteScroll` | directive |
| `InfiniteScrollOrientation` | `MlvInfiniteScrollOrientation` | type |
| `InfiniteScrollTrigger` | `MlvInfiniteScrollTrigger` | interface |

### `@malva-ui/cdk/overlay`

| Old | New | Kind |
| --- | --- | --- |
| `BaseOverlayConfig` | `MlvBaseOverlayConfig` | interface |

### `@malva-ui/cdk/testing-e2e`

| Old | New | Kind |
| --- | --- | --- |
| `Category` | `MlvCategory` | type |
| `CategoryApplicability` | `MlvCategoryApplicability` | type |
| `ComponentManifest` | `MlvComponentManifest` | interface |
| `MlvPage` | `MlvE2ePage` | class |
| `E2eConfigOptions` | `MlvE2eConfigOptions` | interface |
| `ExpectedMouseEntry` | `MlvExpectedMouseEntry` | interface |
| `ExpectedStateEntry` | `MlvExpectedStateEntry` | interface |

### `@malva-ui/cdk/utils`

| Old | New | Kind |
| --- | --- | --- |
| `AnimatedPresenceDirective` | `MlvAnimatedPresence` | directive |
| `AutofocusDirective` | `MlvAutofocus` | directive |
| `FadeComponent` | `MlvFade` | component |
| `MlvBreakpointDownDirective` | `MlvBreakpointDown` | directive |
| `MlvBreakpointUpDirective` | `MlvBreakpointUp` | directive |
| `MlvStructuralDirective` | `MlvStructural` | directive |
| `ResizeObserverDirective` | `MlvResizeObserver` | directive |
| `ResizeObserverFactory` | `MlvResizeObserverFactory` | injectable |
| `ResizeObserverService` | `MlvResizeObserverService` | injectable |
| `UiAnimationDefaults` | `MlvUiAnimationDefaults` | interface |

### `@malva-ui/core/action-bar`

| Old | New | Kind |
| --- | --- | --- |
| `ActionBarPosition` | `MlvActionBarPosition` | type |
| `ActionBarShape` | `MlvActionBarShape` | type |

### `@malva-ui/core/autocomplete`

| Old | New | Kind |
| --- | --- | --- |
| `AutocompleteSearchFn` | `MlvAutocompleteSearchFn` | type |

### `@malva-ui/core/avatar`

| Old | New | Kind |
| --- | --- | --- |
| `AvatarShape` | `MlvAvatarShape` | type |
| `AvatarSize` | `MlvAvatarSize` | type |

### `@malva-ui/core/avatar-group`

| Old | New | Kind |
| --- | --- | --- |
| `AvatarGroupMember` | `MlvAvatarGroupMember` | interface |

### `@malva-ui/core/badge`

| Old | New | Kind |
| --- | --- | --- |
| `BadgeTone` | `MlvBadgeTone` | type |

### `@malva-ui/core/bottom-nav`

| Old | New | Kind |
| --- | --- | --- |
| `BottomNavLabelVisibility` | `MlvBottomNavLabelVisibility` | type |
| `BottomNavStacking` | `MlvBottomNavStacking` | type |

### `@malva-ui/core/breadcrumb`

| Old | New | Kind |
| --- | --- | --- |
| `BreadcrumbItem` | `MlvBreadcrumbEntry` | interface |
| `MlvBreadcrumbItemDirective` | `MlvBreadcrumbItemHost` | directive |

### `@malva-ui/core/button`

| Old | New | Kind |
| --- | --- | --- |
| `ButtonVariantAccessor` | `MlvButtonVariantAccessor` | interface |
| `MlvButtonCloseComponent` | `MlvButtonClose` | component |

### `@malva-ui/core/calendar`

| Old | New | Kind |
| --- | --- | --- |
| `CalendarRangeValue` | `MlvCalendarRangeValue` | interface |
| `CalendarView` | `MlvCalendarView` | type |

### `@malva-ui/core/card`

| Old | New | Kind |
| --- | --- | --- |
| `CardActionsDirective` | `MlvCardActions` | directive |
| `CardFooterDirective` | `MlvCardFooter` | directive |
| `CardSize` | `MlvCardSize` | type |

### `@malva-ui/core/checkbox`

| Old | New | Kind |
| --- | --- | --- |
| `CheckboxGroupAccessor` | `MlvCheckboxGroupAccessor` | interface |
| `CheckboxGroupState` | `MlvCheckboxGroupState` | type |
| `CheckboxState` | `MlvCheckboxState` | type |

### `@malva-ui/core/chip`

| Old | New | Kind |
| --- | --- | --- |
| `ChipTone` | `MlvChipTone` | type |

### `@malva-ui/core/color-picker`

| Old | New | Kind |
| --- | --- | --- |
| `ColorInputMode` | `MlvColorInputMode` | type |

### `@malva-ui/core/data-table`

| Old | New | Kind |
| --- | --- | --- |
| `ColumnAlign` | `MlvColumnAlign` | type |
| `ColumnFilterConfig` | `MlvColumnFilterConfig` | interface |
| `ColumnResizeEvent` | `MlvColumnResizeEvent` | interface |
| `ColumnResizeSource` | `MlvColumnResizeSource` | type |
| `ColumnResponsive` | `MlvColumnResponsive` | type |
| `DataSourceState` | `MlvDataSourceState` | interface |
| `DataTableCellContext` | `MlvDataTableCellContext` | interface |
| `DataTableCellDirective` | `MlvDataTableCell` | directive |
| `DataTableComponent` | `MlvDataTable` | component |
| `DataTableEditCellContext` | `MlvDataTableEditCellContext` | interface |
| `DataTableEditCellDirective` | `MlvDataTableEditCell` | directive |
| `DataTableFooterDirective` | `MlvDataTableFooter` | directive |
| `DataTableNoDataDirective` | `MlvDataTableNoData` | directive |
| `EditEvent` | `MlvEditEvent` | interface |
| `EditMode` | `MlvEditMode` | type |
| `EditSaveEvent` | `MlvEditSaveEvent` | interface |
| `FilterDisplay` | `MlvFilterDisplay` | type |
| `FilterOperator` | `MlvDataTableFilterOperator` | type |
| `FilterOption` | `MlvDataTableFilterOption` | interface |
| `FilterState` | `MlvFilterState` | interface |
| `LoadMoreEvent` | `MlvLoadMoreEvent` | interface |
| `PaginationMode` | `MlvPaginationMode` | type |
| `PinSide` | `MlvPinSide` | type |
| `RowClickEvent` | `MlvRowClickEvent` | interface |
| `SearchState` | `MlvSearchState` | interface |
| `SelectableMode` | `MlvSelectableMode` | type |
| `SelectionChangeEvent` | `MlvSelectionChangeEvent` | interface |
| `SortDirection` | `MlvSortDirection` | type |
| `SortState` | `MlvSortState` | interface |

### `@malva-ui/core/date-range-picker`

| Old | New | Kind |
| --- | --- | --- |
| `DateRangePickerComponent` | `MlvDateRangePicker` | component |
| `DateRangePickerState` | `MlvDateRangePickerState` | type |
| `DateRangePickerValue` | `MlvDateRangePickerValue` | interface |

### `@malva-ui/core/day-picker`

| Old | New | Kind |
| --- | --- | --- |
| `DayPickerComponent` | `MlvDayPicker` | component |
| `DayPickerState` | `MlvDayPickerState` | type |

### `@malva-ui/core/dialog`

| Old | New | Kind |
| --- | --- | --- |
| `DialogBodyComponent` | `MlvDialogBody` | component |
| `DialogComponent` | `MlvDialog` | component |
| `DialogConfig` | `MlvDialogConfig` | interface |
| `DialogContent` | `MlvDialogContent` | type |
| `DialogContentDirective` | `MlvDialogContentDef` | directive |
| `DialogFooterDirective` | `MlvDialogFooter` | directive |
| `DialogHeaderDefDirective` | `MlvDialogHeaderDef` | directive |
| `DialogHeaderDirective` | `MlvDialogHeader` | directive |
| `DialogRef` | `MlvDialogRef` | class |
| `DialogService` | `MlvDialogService` | injectable |
| `DialogSize` | `MlvDialogSize` | type |
| `DialogSizeConfig` | `MlvDialogSizeConfig` | interface |
| `DialogSizePreset` | `MlvDialogSizePreset` | type |
| `DialogSizePresets` | `MlvDialogSizePresets` | type |
| `DialogTemplateContext` | `MlvDialogTemplateContext` | interface |

### `@malva-ui/core/divider`

| Old | New | Kind |
| --- | --- | --- |
| `DividerComponent` | `MlvDivider` | component |
| `DividerOrientation` | `MlvDividerOrientation` | type |

### `@malva-ui/core/drawer`

| Old | New | Kind |
| --- | --- | --- |
| `DrawerBodyComponent` | `MlvDrawerBody` | component |
| `DrawerComponent` | `MlvDrawer` | component |
| `DrawerConfig` | `MlvDrawerConfig` | interface |
| `DrawerContentDirective` | `MlvDrawerContent` | directive |
| `DrawerFooterDirective` | `MlvDrawerFooter` | directive |
| `DrawerHeaderDirective` | `MlvDrawerHeader` | directive |
| `DrawerPosition` | `MlvDrawerPosition` | type |
| `DrawerRef` | `MlvDrawerRef` | class |
| `DrawerSection` | `MlvDrawerSectionState` | interface |
| `DrawerSectionComponent` | `MlvDrawerSection` | component |
| `DrawerSectionConfig` | `MlvDrawerSectionConfig` | interface |
| `DrawerSectionIntersection` | `MlvDrawerSectionIntersection` | interface |
| `DrawerSectionsComponent` | `MlvDrawerSections` | component |
| `DrawerSectionsService` | `MlvDrawerSectionsService` | injectable |
| `DrawerService` | `MlvDrawerService` | injectable |

### `@malva-ui/core/dropdown`

| Old | New | Kind |
| --- | --- | --- |
| `ActiveDescendant` | `MlvActiveDescendant` | class |
| `DropdownPanelComponent` | `MlvDropdownPanel` | component |
| `HighlightMatchPipe` | `MlvHighlightMatchPipe` | pipe |
| `MatchSegment` | `MlvMatchSegment` | interface |
| `OptionMatcher` | `MlvOptionMatcher` | type |
| `SelectOption` | `MlvSelectOption` | interface |
| `SelectOptionTransform` | `MlvSelectOptionTransform` | type |

### `@malva-ui/core/empty-state`

| Old | New | Kind |
| --- | --- | --- |
| `EmptyStateComponent` | `MlvEmptyState` | component |

### `@malva-ui/core/expand`

| Old | New | Kind |
| --- | --- | --- |
| `ExpandComponent` | `MlvExpand` | component |
| `ExpandContentDirective` | `MlvExpandContent` | directive |

### `@malva-ui/core/file-upload`

| Old | New | Kind |
| --- | --- | --- |
| `FileUploadComponent` | `MlvFileUpload` | component |
| `FileUploadItemComponent` | `MlvFileUploadItem` | component |
| `FileUploadState` | `MlvFileUploadState` | type |
| `FileValidationError` | `MlvFileValidationError` | interface |
| `UploadedFile` | `MlvUploadedFile` | interface |

### `@malva-ui/core/filter`

| Old | New | Kind |
| --- | --- | --- |
| `MlvFilterComponent` | `MlvFilter` | component |
| `MlvSmartFilterBarComponent` | `MlvSmartFilterBar` | component |

### `@malva-ui/core/form-utils`

| Old | New | Kind |
| --- | --- | --- |
| `ErrorDisplayStrategy` | `MlvErrorDisplayStrategy` | type |
| `FormControlWrapper` | `MlvFormControlWrapper` | component |
| `FormControlWrapperControl` | `MlvFormControlWrapperControl` | directive |
| `FormFieldComponent` | `MlvFormField` | component |
| `FormsBindingAdapter` | `MlvFormsBindingAdapter` | interface |
| `FormsBindingMatrixOptions` | `MlvFormsBindingMatrixOptions` | interface |
| `FormState` | `MlvFormState` | type |
| `HintComponent` | `MlvHint` | component |
| `LabelComponent` | `MlvLabel` | component |
| `MessageComponent` | `MlvMessage` | component |
| `MlvFormControlAppendDirective` | `MlvFormControlAppend` | directive |
| `MlvFormControlPrependDirective` | `MlvFormControlPrepend` | directive |
| `SelectionService` | `MlvSelectionService` | injectable |
| `SignalCheckboxControlBase` | `MlvSignalCheckboxControlBase` | directive |
| `SignalFormControlBase` | `MlvSignalFormControlBase` | directive |
| `SignalFormUiControlBase` | `MlvSignalFormUiControlBase` | directive |

### `@malva-ui/core/input`

| Old | New | Kind |
| --- | --- | --- |
| `InputComponent` | `MlvInput` | component |
| `InputInputMode` | `MlvInputInputMode` | type |
| `InputState` | `MlvInputState` | type |
| `InputType` | `MlvInputType` | type |
| `MlvInputNativeDirective` | `MlvInputNative` | directive |

### `@malva-ui/core/kbd`

| Old | New | Kind |
| --- | --- | --- |
| `KbdComponent` | `MlvKbd` | component |
| `KbdKey` | `MlvKbdKey` | type |
| `ResolvedKey` | `MlvResolvedKey` | interface |

### `@malva-ui/core/layout`

| Old | New | Kind |
| --- | --- | --- |
| `Layout` | `MlvLayout` | component |

### `@malva-ui/core/link`

| Old | New | Kind |
| --- | --- | --- |
| `LinkComponent` | `MlvLink` | component |
| `LinkVariant` | `MlvLinkVariant` | type |
| `MlvLinkAfterDirective` | `MlvLinkAfter` | directive |
| `MlvLinkBeforeDirective` | `MlvLinkBefore` | directive |

### `@malva-ui/core/list`

| Old | New | Kind |
| --- | --- | --- |
| `ListComponent` | `MlvList` | component |
| `ListItemAccent` | `MlvListItemAccent` | type |
| `ListItemActionsDirective` | `MlvListItemActions` | directive |
| `ListItemBylineDirective` | `MlvListItemByline` | directive |
| `ListItemComponent` | `MlvListItem` | component |
| `ListItemGroup` | `MlvListItemGroup` | component |
| `ListItemLink` | `MlvListItemLink` | component |
| `ListItemMediaDirective` | `MlvListItemMedia` | directive |
| `ListItemMetaDirective` | `MlvListItemMeta` | directive |
| `ListItemPrefixDirective` | `MlvListItemPrefix` | directive |
| `ListItemSelectableDirective` | `MlvListItemSelectable` | directive |
| `ListItemSuffixDirective` | `MlvListItemSuffix` | directive |
| `ListItemTemplateContext` | `MlvListItemTemplateContext` | interface |
| `ListItemTemplateDirective` | `MlvListItemTemplate` | directive |
| `ListItemTitleDirective` | `MlvListItemTitle` | directive |
| `ListSelectableDirective` | `MlvListSelectable` | directive |
| `ListVariant` | `MlvListVariant` | type |

### `@malva-ui/core/loader`

| Old | New | Kind |
| --- | --- | --- |
| `Loader` | `MlvLoader` | component |
| `LoaderTone` | `MlvLoaderTone` | type |
| `LoaderVariant` | `MlvLoaderVariant` | type |

### `@malva-ui/core/menu`

| Old | New | Kind |
| --- | --- | --- |
| `MenuAccessor` | `MlvMenuAccessor` | interface |
| `MenubarAccessor` | `MlvMenubarAccessor` | interface |
| `MenubarComponent` | `MlvMenubar` | component |
| `MenubarItem` | `MlvMenubarItem` | interface |
| `MenubarMenuController` | `MlvMenubarMenuController` | interface |
| `MenuComponent` | `MlvMenu` | component |
| `MenuGroupComponent` | `MlvMenuGroup` | component |
| `MenuGroupLabelDirective` | `MlvMenuGroupLabel` | directive |
| `MenuItemDirective` | `MlvMenuItem` | directive |
| `MenuSeparatorComponent` | `MlvMenuSeparator` | component |
| `MenuTriggerDirective` | `MlvMenuTrigger` | directive |

### `@malva-ui/core/notification`

| Old | New | Kind |
| --- | --- | --- |
| `InternalNotification` | `MlvInternalNotification` | interface |
| `NotificationAction` | `MlvNotificationAction` | interface |
| `NotificationConfig` | `MlvNotificationConfig` | interface |
| `NotificationContent` | `MlvNotificationContent` | type |
| `NotificationItemComponent` | `MlvNotificationItem` | component |
| `NotificationOpenConfig` | `MlvNotificationOpenConfig` | interface |
| `NotificationRef` | `MlvNotificationRef` | class |
| `NotificationService` | `MlvNotificationService` | injectable |
| `NotificationTemplateContext` | `MlvNotificationTemplateContext` | interface |
| `NotificationTone` | `MlvNotificationTone` | type |

### `@malva-ui/core/number-input`

| Old | New | Kind |
| --- | --- | --- |
| `NumberInputComponent` | `MlvNumberInput` | component |
| `NumberInputControlAlignment` | `MlvNumberInputControlAlignment` | type |
| `NumberInputControlStack` | `MlvNumberInputControlStack` | type |

### `@malva-ui/core/page`

| Old | New | Kind |
| --- | --- | --- |
| `PageAsideDirective` | `MlvPageAside` | directive |
| `PageAsidePlacement` | `MlvPageAsidePlacement` | type |
| `PageBreadcrumbDirective` | `MlvPageBreadcrumb` | directive |
| `PageComponent` | `MlvPage` | component |
| `PageContentComponent` | `MlvPageContent` | component |
| `PageContentGap` | `MlvPageContentGap` | type |
| `PageEndSidebarDirective` | `MlvPageEndSidebar` | directive |
| `PageHeaderActionsDirective` | `MlvPageHeaderActions` | directive |
| `PageHeaderComponent` | `MlvPageHeader` | component |
| `PageHeaderDescriptionDirective` | `MlvPageHeaderDescription` | directive |
| `PageHeaderIconDirective` | `MlvPageHeaderIcon` | directive |
| `PageHeaderMetaDirective` | `MlvPageHeaderMeta` | directive |
| `PageHeaderTabsActionsDirective` | `MlvPageHeaderTabsActions` | directive |
| `PageHeaderTabsDirective` | `MlvPageHeaderTabs` | directive |
| `PagePadding` | `MlvPagePadding` | type |
| `PageScroll` | `MlvPageScroll` | type |
| `PageShellComponent` | `MlvPageShell` | component |
| `PageSidebarDirective` | `MlvPageSidebar` | directive |
| `PageSurface` | `MlvPageSurface` | type |
| `PageTitleDirective` | `MlvPageTitle` | directive |
| `PageTopbarDirective` | `MlvPageTopbar` | directive |

### `@malva-ui/core/pagination`

| Old | New | Kind |
| --- | --- | --- |
| `MlvPaginationCountDirective` | `MlvPaginationCount` | directive |
| `PaginationComponent` | `MlvPagination` | component |
| `PaginationObject` | `MlvPaginationObject` | interface |
| `PaginationService` | `MlvPaginationService` | injectable |

### `@malva-ui/core/pin-input`

| Old | New | Kind |
| --- | --- | --- |
| `PinInputComponent` | `MlvPinInput` | component |
| `PinInputSeparatorDirective` | `MlvPinInputSeparator` | directive |

### `@malva-ui/core/popup`

| Old | New | Kind |
| --- | --- | --- |
| `PopupArrowAlign` | `MlvPopupArrowAlign` | type |
| `PopupArrowEdge` | `MlvPopupArrowEdge` | type |
| `PopupComponent` | `MlvPopup` | component |
| `PopupContainerComponent` | `MlvPopupContainer` | component |
| `PopupContainerRef` | `MlvPopupContainerRef` | interface |
| `PopupContentDirective` | `MlvPopupContent` | directive |
| `PopupHandle` | `MlvPopupHandle` | interface |
| `PopupHeaderContentDirective` | `MlvPopupHeaderContent` | directive |
| `PopupMobileMode` | `MlvPopupMobileMode` | type |
| `PopupOpenConfig` | `MlvPopupOpenConfig` | interface |
| `PopupPositionName` | `MlvPopupPositionName` | type |
| `PopupPositionResolver` | `MlvPopupPositionResolver` | class |
| `PopupScrollStrategy` | `MlvPopupScrollStrategy` | type |
| `PopupService` | `MlvPopupService` | injectable |
| `PopupSizeConfig` | `MlvPopupSizeConfig` | interface |
| `PopupTriggerDirective` | `MlvPopupTrigger` | directive |
| `PopupTriggerType` | `MlvPopupTriggerType` | type |

### `@malva-ui/core/progress`

| Old | New | Kind |
| --- | --- | --- |
| `ProgressComponent` | `MlvProgress` | component |
| `ProgressShape` | `MlvProgressShape` | type |
| `ProgressSize` | `MlvProgressSize` | type |
| `ProgressTone` | `MlvProgressTone` | type |

### `@malva-ui/core/radio`

| Old | New | Kind |
| --- | --- | --- |
| `RadioComponent` | `MlvRadio` | component |
| `RadioGroupComponent` | `MlvRadioGroup` | component |
| `RadioGroupState` | `MlvRadioGroupState` | type |

### `@malva-ui/core/rating`

| Old | New | Kind |
| --- | --- | --- |
| `RatingComponent` | `MlvRating` | component |

### `@malva-ui/core/scrollbar`

| Old | New | Kind |
| --- | --- | --- |
| `ScrollbarComponent` | `MlvScrollbar` | component |
| `ScrollbarOrientation` | `MlvScrollbarOrientation` | type |

### `@malva-ui/core/search-field`

| Old | New | Kind |
| --- | --- | --- |
| `SearchFieldTrigger` | `MlvSearchFieldTrigger` | type |

### `@malva-ui/core/select`

| Old | New | Kind |
| --- | --- | --- |
| `SelectComponent` | `MlvSelect` | component |
| `SelectItemTemplateDirective` | `MlvSelectItemTemplate` | directive |
| `SelectListTemplateDirective` | `MlvSelectListTemplate` | directive |
| `SelectSelectedTemplateDirective` | `MlvSelectSelectedTemplate` | directive |
| `SelectState` | `MlvSelectState` | type |

### `@malva-ui/core/sidebar`

| Old | New | Kind |
| --- | --- | --- |
| `SidebarComponent` | `MlvSidebar` | component |
| `SidebarContentComponent` | `MlvSidebarContent` | component |
| `SidebarContextValue` | `MlvSidebarContextValue` | interface |
| `SidebarFooterDirective` | `MlvSidebarFooter` | directive |
| `SidebarGroupComponent` | `MlvSidebarGroup` | component |
| `SidebarHeaderDirective` | `MlvSidebarHeader` | directive |
| `SidebarItemComponent` | `MlvSidebarItem` | component |
| `SidebarItemDirective` | `MlvSidebarItemHost` | directive |
| `SidebarItemIconDirective` | `MlvSidebarItemIcon` | directive |
| `SidebarItemTitleDirective` | `MlvSidebarItemTitle` | directive |
| `SidebarMode` | `MlvSidebarMode` | type |
| `SidebarRailComponent` | `MlvSidebarRail` | component |
| `SidebarTriggerComponent` | `MlvSidebarTrigger` | component |
| `SidebarWorkspaceComponent` | `MlvSidebarWorkspace` | component |
| `SidebarWorkspaceLogoDirective` | `MlvSidebarWorkspaceLogo` | directive |
| `SidebarWorkspaceOption` | `MlvSidebarWorkspaceOption` | interface |
| `SidebarWorkspaceTemplateContext` | `MlvSidebarWorkspaceTemplateContext` | interface |
| `SidebarWorkspaceTextDirective` | `MlvSidebarWorkspaceText` | directive |

### `@malva-ui/core/skeleton`

| Old | New | Kind |
| --- | --- | --- |
| `SkeletonComponent` | `MlvSkeleton` | component |
| `SkeletonVariant` | `MlvSkeletonVariant` | type |

### `@malva-ui/core/slider`

| Old | New | Kind |
| --- | --- | --- |
| `SliderComponent` | `MlvSlider` | component |
| `SliderTooltipDef` | `MlvSliderTooltipDef` | directive |
| `SliderTooltipDefContext` | `MlvSliderTooltipDefContext` | interface |
| `SliderTooltipThumb` | `MlvSliderTooltipThumb` | type |
| `SliderValue` | `MlvSliderValue` | type |

### `@malva-ui/core/split-pane`

| Old | New | Kind |
| --- | --- | --- |
| `SplitPaneComponent` | `MlvSplitPane` | component |
| `SplitPaneOrientation` | `MlvSplitPaneOrientation` | type |
| `SplitPanePanelComponent` | `MlvSplitPanePanel` | component |

### `@malva-ui/core/status-indicator`

| Old | New | Kind |
| --- | --- | --- |
| `StatusIndicatorComponent` | `MlvStatusIndicator` | component |
| `StatusIndicatorTone` | `MlvStatusIndicatorTone` | type |

### `@malva-ui/core/stepper`

| Old | New | Kind |
| --- | --- | --- |
| `StepComponent` | `MlvStep` | component |
| `StepperAccessor` | `MlvStepperAccessor` | interface |
| `StepperComponent` | `MlvStepper` | component |
| `StepperOrientation` | `MlvStepperOrientation` | type |
| `StepState` | `MlvStepState` | type |

### `@malva-ui/core/switch`

| Old | New | Kind |
| --- | --- | --- |
| `SwitchComponent` | `MlvSwitch` | component |
| `SwitchGroupComponent` | `MlvSwitchGroup` | component |
| `SwitchGroupState` | `MlvSwitchGroupState` | type |
| `SwitchState` | `MlvSwitchState` | type |

### `@malva-ui/core/tabs`

| Old | New | Kind |
| --- | --- | --- |
| `TabAppearance` | `MlvTabAppearance` | type |
| `TabComponent` | `MlvTab` | component |
| `TabContentComponent` | `MlvTabContent` | component |
| `TabContentDirective` | `MlvTabContentDef` | directive |
| `TabDefContext` | `MlvTabDefContext` | interface |
| `TabDefDirective` | `MlvTabDef` | directive |
| `TabGroupAccessor` | `MlvTabGroupAccessor` | interface |
| `TabGroupComponent` | `MlvTabGroup` | component |
| `TabItemComponent` | `MlvTabItem` | component |
| `TabOrientation` | `MlvTabOrientation` | type |
| `TabsService` | `MlvTabsService` | injectable |

### `@malva-ui/core/textarea`

| Old | New | Kind |
| --- | --- | --- |
| `TextareaComponent` | `MlvTextarea` | component |

### `@malva-ui/core/tile`

| Old | New | Kind |
| --- | --- | --- |
| `TileComponent` | `MlvTile` | component |
| `TileHeaderDirective` | `MlvTileHeader` | directive |
| `TileSize` | `MlvTileSize` | type |
| `TileTone` | `MlvTileTone` | type |

### `@malva-ui/core/time-picker`

| Old | New | Kind |
| --- | --- | --- |
| `TimeMode` | `MlvTimeMode` | type |
| `TimePickerComponent` | `MlvTimePicker` | component |
| `TimePickerState` | `MlvTimePickerState` | type |

### `@malva-ui/core/timeline`

| Old | New | Kind |
| --- | --- | --- |
| `TimelineComponent` | `MlvTimeline` | component |
| `TimelineItemComponent` | `MlvTimelineItem` | component |
| `TimelineItemDirection` | `MlvTimelineItemDirection` | type |
| `TimelineItemIconDirective` | `MlvTimelineItemIcon` | directive |
| `TimelineItemMetaDirective` | `MlvTimelineItemMeta` | directive |
| `TimelineItemTone` | `MlvTimelineItemTone` | type |

### `@malva-ui/core/title`

| Old | New | Kind |
| --- | --- | --- |
| `TitleComponent` | `MlvTitle` | component |
| `TitleLevel` | `MlvTitleLevel` | type |

### `@malva-ui/core/toast`

| Old | New | Kind |
| --- | --- | --- |
| `AbstractToastContainerComponent` | `MlvAbstractToastContainerComponent` | directive |
| `AbstractToastItem` | `MlvAbstractToastItem` | directive |
| `AbstractToastService` | `MlvAbstractToastService` | class |
| `BaseToastConfig` | `MlvBaseToastConfig` | interface |
| `BaseToastRef` | `MlvBaseToastRef` | interface |
| `IAbstractToastComponent` | `MlvIAbstractToastComponent` | interface |
| `InternalBaseToast` | `MlvInternalBaseToast` | interface |
| `InternalToast` | `MlvInternalToast` | interface |
| `MlvToastDescriptionDirective` | `MlvToastDescription` | directive |
| `MlvToastIconDirective` | `MlvToastIcon` | directive |
| `MlvToastTitleDirective` | `MlvToastTitle` | directive |
| `ToastConfig` | `MlvToastConfig` | interface |
| `ToastContainerComponent` | `MlvToastContainer` | component |
| `ToastContent` | `MlvToastContent` | type |
| `ToastItemComponent` | `MlvToastItem` | component |
| `ToastOpenConfig` | `MlvToastOpenConfig` | interface |
| `ToastPosition` | `MlvToastPosition` | type |
| `ToastRef` | `MlvToastRef` | class |
| `ToastService` | `MlvToastService` | injectable |
| `ToastTemplateContext` | `MlvToastTemplateContext` | interface |
| `ToastTimer` | `MlvToastTimer` | class |
| `ToastTone` | `MlvToastTone` | type |

### `@malva-ui/core/tokenizer`

| Old | New | Kind |
| --- | --- | --- |
| `TokenComponent` | `MlvToken` | component |
| `TokenizerComponent` | `MlvTokenizer` | component |
| `TokenTemplateContext` | `MlvTokenTemplateContext` | interface |
| `TokenTemplateDirective` | `MlvTokenTemplate` | directive |

### `@malva-ui/core/toolbar`

| Old | New | Kind |
| --- | --- | --- |
| `ToolbarComponent` | `MlvToolbar` | component |
| `ToolbarRovingDirective` | `MlvToolbarRoving` | directive |
| `ToolbarSpacerComponent` | `MlvToolbarSpacer` | component |
| `ToolbarWidgetDirective` | `MlvToolbarWidget` | directive |

### `@malva-ui/core/tooltip`

| Old | New | Kind |
| --- | --- | --- |
| `TooltipComponent` | `MlvTooltipPanel` | component |
| `TooltipDirective` | `MlvTooltip` | directive |
| `TooltipPlacement` | `MlvTooltipPlacement` | type |
| `TooltipTone` | `MlvTooltipTone` | type |

### `@malva-ui/core/tree`

| Old | New | Kind |
| --- | --- | --- |
| `FlatTreeNode` | `MlvFlatTreeNode` | interface |
| `TreeComponent` | `MlvTree` | component |
| `TreeCurrentType` | `MlvTreeCurrentType` | type |
| `TreeNode` | `MlvTreeNode` | interface |
| `TreeNodeDefContext` | `MlvTreeNodeDefContext` | interface |
| `TreeNodeDefDirective` | `MlvTreeNodeDef` | directive |
| `TreeSelectMode` | `MlvTreeSelectMode` | type |

### `@malva-ui/i18n`

| Old | New | Kind |
| --- | --- | --- |
| `ClaudeProviderConfig` | `MlvClaudeProviderConfig` | interface |

<!-- prettier-ignore-end -->
