# Filter redesign & standardization — design

Date: 2026-08-26
Status: approved
Scope: `@malva-ui/core/filter` (`mlv-filter`, `mlv-smart-filter-bar`), docs filter page

## Goals

- Custom value-editor slot so consumers configure which component edits a condition value (e.g. `mlv-day-picker` for date fields).
- Options editor rebuilt on `mlv-dropdown-panel` — identical row geometry, selected state, and keyboard model as `mlv-select`/`mlv-combobox`.
- Fix the empty-panel dead end after Clear in explicit apply mode.
- "Add filter" trigger restyled as a dashed ghost chip with a plus icon.
- Panel spacing swept onto `--mlv-spacing-*` tokens.

## Non-goals

- No built-in `date` editor type (`MlvFilterEditor` stays `options | text | number`); date editing is demonstrated via the custom slot.
- No nested AND/OR group-builder UI. `MlvFilterExpression` remains a payload/adapter concern.
- No breaking API changes; everything is additive plus visual.

## 1. Custom value-editor slot

### New directive

```ts
@Directive({ selector: '[mlvFilterValueEditor]' })
export class MlvFilterValueEditorDef {
  /** Definition key this editor targets inside mlv-smart-filter-bar. Empty = default for all free-form fields / standalone mlv-filter. */
  readonly mlvFilterValueEditor = input<string>('');
  readonly templateRef = inject(TemplateRef<MlvFilterValueEditorContext>);
  static ngTemplateContextGuard(
    dir: MlvFilterValueEditorDef,
    ctx: unknown,
  ): ctx is MlvFilterValueEditorContext;
}
```

### Context

```ts
export interface MlvFilterValueEditorContext {
  /** Current condition value (scalar, or range array for `between`). */
  $implicit: unknown;
  /** Full condition being edited. */
  condition: MlvFilterCondition;
  /** Condition index within the editor. */
  index: number;
  /** Current operator. */
  operator: MlvFilterOperator;
  /** Forwarded editor state. */
  disabled: boolean;
  placeholder: string;
  /** Writes the draft value; honors live/explicit apply mode (live commits immediately). */
  setValue: (value: unknown) => void;
  /** Explicit-mode apply — Enter-equivalent. No-op in live mode. */
  commit: () => void;
}
```

### Wiring

- `mlv-filter` gains:
  - `contentChild(MlvFilterValueEditorDef)` for standalone usage;
  - a `valueEditor` input (`TemplateRef<MlvFilterValueEditorContext> | null`, default `null`) so `mlv-smart-filter-bar` can forward keyed templates. Input wins over content child when both are set.
- `mlv-smart-filter-bar` collects `contentChildren(MlvFilterValueEditorDef)`; per definition it resolves the template whose key equals `definition.key`, falling back to the key-less template, else `null`, and binds it to the inner `mlv-filter`'s `valueEditor`.
- The slot replaces only the value cell of a free-form condition row. Operator select, strategy select, add/remove condition, panel header/footer stay lib-owned.
- `between`: the template receives the whole range array as `$implicit` and owns rendering; `setValue` writes the whole array.
- `empty`/`not-empty`: no value cell is rendered — the slot is not invoked.
- Options editors ignore the slot (the bounded list is the editor).
- Focus on open: when a custom editor is active, `_onOpened` focuses the first tabbable element inside the first condition's value cell via `MlvTabbableElementService`, falling back to the operator select.

### Usage

```html
<!-- standalone -->
<mlv-filter label="Renewal date" [operators]="ops">
  <ng-template mlvFilterValueEditor let-value let-set="setValue">
    <mlv-day-picker [value]="value" (valueChange)="set($event)" />
  </ng-template>
</mlv-filter>

<!-- smart bar, keyed -->
<mlv-smart-filter-bar [definitions]="definitions">
  <ng-template mlvFilterValueEditor="renewalDate" let-value let-set="setValue">
    <mlv-day-picker [value]="value" (valueChange)="set($event)" />
  </ng-template>
</mlv-smart-filter-bar>
```

## 2. Options editor on `mlv-dropdown-panel`

- Replace the hand-rolled `role="listbox"` button list in `filter.html` with `<mlv-dropdown-panel>`:
  - `scrollMode="self"` — the filter panel header/footer stay pinned; the panel owns its `mlv-scrollbar` (bounded by its default max-height).
  - `[options]` from `options()` (already `MlvFilterOption`, shape-compatible with `MlvSelectOption`), `[multiple]` from `multiple()`, `[selectedValues]` derived from draft conditions.
  - `(valueChange)` builds conditions exactly as `_toggleOption` does today: multi → `[{ operator: 'in', value: values }]` (or `[]`), single → `[{ operator: 'equals', value }]`; same live-commit semantics (single-select closes the popup, multi stays open).
- Delete the roving-focus machinery made redundant: `_onOptionKeydown`, `_optionTabIndex`, `_setActiveOption`, `_activeOptionIndex`, `_optionButtons`, the option-button template block, and the `.mlv-filter__option*` SCSS (selected-state styling now comes from the dropdown panel/list tokens).
- Keyboard/a11y (arrows, Home/End, type-ahead, `aria-selected`, explicit selection mode) comes from the panel's `@angular/aria` listbox.
- **Prerequisite — per-option disabled in `core-dropdown`:** `MlvFilterOption.disabled` has no counterpart in `MlvSelectOption`. Additive extension: `MlvSelectOption` gains optional `disabled?: boolean`; the panel's option row binds `[disabled]="option.disabled ?? false"` on `mlv-list-item` (the aria `Option` input already exists via `MlvListItemSelectable`; nav skips disabled options because the panel pins `softDisabled=false`). Field optional → select/combobox unaffected. Includes a `dropdown-panel.spec.ts` case (disabled option not selectable, skipped by arrows) and a `libs-dropdown.md` update.
- `_onOpened` focuses the panel's active option (selected one when present) — the panel's roving focus model handles this once focus enters the list; the filter moves initial focus to the listbox.
- Empty options keep the translated `selectValue` empty state, projected into the panel's empty slot.

## 3. Clear dead-end bug fix

`_clearDraft()` currently leaves `_draftConditions = []`; the template renders zero condition rows and the panel dead-ends (no value cell, no add action when `allowMultipleConditions` is false). Fix: after clearing, reseed free-form drafts with `[this._newCondition()]` — mirroring `_onOpened`. The reseeded condition is not meaningful, so explicit-mode rollback semantics are unchanged: Apply still commits `[]` and emits `cleared`; Cancel still restores the previous applied state.

## 4. "Add filter" chip

`.mlv-smart-filter-bar__add` restyled as a dashed ghost chip:

- `LucidePlus` (14) + label.
- Height `--mlv-height-xs`, padding `--mlv-padding-xs`, radius `--mlv-radius-m` — matches query-chip triggers.
- `var(--mlv-stroke-width) dashed var(--mlv-border-normal)` border, transparent background.
- Text `--mlv-text-secondary`; hover → `--mlv-text-primary` + `--mlv-background-neutral-1-hover`.
- Focus ring Form A. Disabled via the button's own disabled state.

Implemented as component-scoped overrides on the existing `mlvButton` (variant stays `transparent`); no new button variant.

## 5. Panel polish

- `filter.scss` and `smart-filter-bar.scss` literal paddings/gaps swept onto `--mlv-spacing-*` tokens (no geometry redesign).
- Condition row grid unchanged; custom editors occupy the same value-cell grid area (`minmax(10rem, 1.2fr)`).

## 6. Docs

- Filter example 4: `renewalDate` uses a keyed `mlvFilterValueEditor` with `mlv-day-picker` for scalar operators and two pickers for `between`; prose explains the slot.
- `.claude/projects/libs-filter.md` updated (new directive, context interface, `valueEditor` input, options-editor internals note).
- `yarn nx run docs:check-doc-api` after doc edits.

## 7. Testing

- `filter.spec.ts`:
  - Clear in explicit mode reseeds one empty condition (regression for the dead-end bug); Apply after Clear commits `[]` + `cleared`.
  - Custom slot renders in place of the value cell; `setValue` updates the draft; live mode commits immediately, explicit mode waits for `commit()`/Apply.
  - `between` passes the range array; valueless operators render no slot.
  - Options editor: dropdown panel receives options/selection; `valueChange` round-trips to `in`/`equals` conditions; single-select closes.
- `smart-filter-bar.spec.ts`: keyed template resolution (exact key > key-less fallback > none) reaches the inner filter.
- Gate: `yarn nx run-many -t vite:test typecheck lint -p core-filter`, docs build.

## Dependencies

- `core-filter` adds `@malva-ui/core/dropdown` (allowed: core leaf → core family) and `@malva-ui/cdk/accessibility` (`MlvTabbableElementService`).
- `core-dropdown` gains the optional `MlvSelectOption.disabled` field (see §2 prerequisite).
- Docs example adds `@malva-ui/core/day-picker`.
- Verification widens to `yarn nx run-many -t vite:test typecheck lint -p core-filter core-dropdown`.
