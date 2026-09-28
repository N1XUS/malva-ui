---
# Library: combobox

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Combobox library (`@malva-ui/core/combobox`) provides a searchable dropdown supporting single/multiple selection and all three Angular forms modes.

## Public API

Exported from `libs/forms/combobox/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvCombobox<T>` | Component | Main combobox — `mlv-combobox` |
| `MlvComboboxItemDef` | Directive | Custom item template — `[mlvComboboxItemDef]` |
| `MlvComboboxSelectedItemDef` | Directive | Custom selected display — `[mlvComboboxSelectedItemDef]` |

---

## Components

### `MlvCombobox<T>`

**File:** `libs/forms/combobox/src/lib/combobox/combobox.ts`
**Template:** `libs/forms/combobox/src/lib/combobox/combobox.html`
**Styles:** `libs/forms/combobox/src/lib/combobox/combobox.scss`

- **Selector:** `mlv-combobox`
- **Change Detection:** `OnPush`
- **Extends:** `MlvSignalFormControlBase<T | T[] | null>`

#### Inputs (own)

| Name          | Type                          | Default                  | Description                         |
| ------------- | ----------------------------- | ------------------------ | ----------------------------------- |
| `options`     | `T[]`                         | `[]`                     | Selectable options                  |
| `multiple`    | `boolean`                     | `false`                  | Multi-select mode                   |
| `placeholder` | `string`                      | `'Search...'`            | Input placeholder                   |
| `allowCreate` | `boolean`                     | `false`                  | Allow creating new values via Enter |
| `toOption`    | `MlvSelectOptionTransform<T>` | `defaultOptionTransform` | Transform T → `MlvSelectOption`     |

#### Inputs (from MlvSignalFormControlBase)

`state`, `readonly`, `disabled`, `id`, `label`, `hint`, `message`

#### Outputs

| Name           | Type        | Description                           |
| -------------- | ----------- | ------------------------------------- |
| `valueCreated` | `output<T>` | Emitted when user creates a new value |

#### Computed Signals

| Signal            | Description                              |
| ----------------- | ---------------------------------------- |
| `resolvedOptions` | Options passed through `toOption()`      |
| `filteredOptions` | Options filtered by `searchQuery`        |
| `dropdownIcon`    | `LucideChevronDown` or `LucideChevronUp` |

#### Host Bindings

```ts
host: {
  'class': 'mlv-combobox',
  '[class.mlv-combobox--disabled]': 'disabled()',
  '[class.mlv-combobox--open]': 'isOpen()',
}
```

#### Content Children

| Name               | Directive                    | Description                   |
| ------------------ | ---------------------------- | ----------------------------- |
| `itemTemplate`     | `MlvComboboxItemDef`         | Custom option rendering       |
| `selectedTemplate` | `MlvComboboxSelectedItemDef` | Custom selected value display |

#### Key Methods

- `onSearchInput(event)` — Filters options by user text
- `onEnterKey()` — Select the active option, else the listed option the text names (case and every diacritic folded, like the list), else create a new value unless it names a selected one
- `selectValue(value: T)` — Select/toggle a single value
- `selectValues(values: readonly T[])` — Set multiple values
- `updateTriggerWidth(entries)` — Sync popup width to trigger via `MlvResizeObserver`

#### Template Summary

Form control wrapper → label/hint → popup container with trigger (displays selected value or placeholder + dropdown chevron) → `MlvPopup` containing `MlvDropdownPanel` with filtered options.

#### Dropdown Positions

- Primary: below trigger (`bottom`, `offsetY: 8`)
- Fallback: above trigger (`top`, `offsetY: -8`)

---

## Directives

### `MlvComboboxItemDef`

**Selector:** `[mlvComboboxItemDef]` | **File:** `libs/forms/combobox/src/lib/combobox-template.directives.ts`

Provides `templateRef: TemplateRef<{ $implicit: MlvSelectOption<T> }>`.

### `MlvComboboxSelectedItemDef`

**Selector:** `[mlvComboboxSelectedItemDef]` | **File:** `libs/forms/combobox/src/lib/combobox-template.directives.ts`

Provides `templateRef: TemplateRef` for custom selected value rendering in trigger.

---

## Usage Examples

```html
<!-- Basic single select -->
<mlv-combobox [options]="fruits" label="Fruit" />

<!-- Multi-select -->
<mlv-combobox [options]="items" [multiple]="true" label="Items" />

<!-- Allow creating new values -->
<mlv-combobox [options]="tags" [allowCreate]="true" (valueCreated)="addTag($event)" />

<!-- Custom transform -->
<mlv-combobox [options]="users" [toOption]="u => ({ label: u.name, value: u.id })" />

<!-- Custom item template -->
<mlv-combobox [options]="users">
  <ng-template mlvComboboxItemDef let-item> {{ item.label }} — {{ item.value.email }} </ng-template>
</mlv-combobox>

<!-- Reactive forms -->
<mlv-combobox [formControl]="ctrl" [options]="opts" />
```

---

## Dependencies

- `@angular/forms/signals` — signal-control contract
- `@angular/cdk/overlay` — popup positioning
- `@malva-ui/core/popup` — `MlvPopup`, `MlvPopupContent`, `MlvPopupContainer`
- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase`, `MlvSelectionService`
- `@malva-ui/core/dropdown` — `MlvDropdownPanel`, `MlvSelectOptionTransform`, `defaultOptionTransform`
- `@malva-ui/cdk/accessibility` — `MlvClick`
- `@malva-ui/cdk/utils` — `MlvResizeObserver`
- `@lucide/angular` — chevron icons
