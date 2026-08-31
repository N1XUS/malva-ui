import { Directive, inject } from '@angular/core';
import { Listbox, Option } from '@angular/aria/listbox';

/**
 * Turns a `mlv-list` into a single- or multi-select listbox, backed by
 * `@angular/aria`'s headless `ngListbox` pattern.
 *
 * The `Listbox` directive is applied as a host directive so the public
 * `mlv-list[selectable]` selector, `multiple`/`value` inputs and `valueChange`
 * output are unchanged. The aria pattern's selection/navigation knobs are
 * re-exposed as inputs so consumers (and the shared dropdown panel) can pin
 * them:
 *
 * - `selectionMode` (default aria `follow`) — set `"explicit"` to reproduce the
 *   previous `CdkListbox` behaviour where selection only changes on
 *   click / Space / Enter, never on arrow-key focus movement. The shared
 *   `mlv-dropdown-panel` (and therefore `mlv-select` / `mlv-combobox`) pins
 *   this to `"explicit"`.
 * - `softDisabled` (default aria `true`) — set `false` to skip disabled options
 *   during keyboard navigation, matching the previous `CdkListbox` behaviour.
 *
 * - `focusMode` (default aria `roving`) — set `"activedescendant"` so DOM focus
 *   stays on an owning combobox trigger/input while the active option is tracked
 *   via `aria-activedescendant`. The shared `mlv-dropdown-panel` re-exposes this
 *   so `mlv-combobox` can keep keyboard focus in its text input.
 *
 * `wrap` and text typeahead keep aria's defaults, which already match the
 * previous configuration (typeahead reads each option's `label`; see
 * {@link MlvListItemSelectable}).
 *
 * The aria `Listbox`'s own `id` input is re-exposed publicly as `listboxId`. The
 * pattern binds `[attr.id]="id()"` on the host and, when left unset, generates a
 * `ng-listbox-*` id that would otherwise override any `[id]` template binding —
 * dangling the `aria-controls` reference of a wrapping `mlv-select` /
 * `mlv-combobox` trigger. Forwarding a consumer-provided id through the aria
 * input keeps the rendered DOM id under the consumer's control (the shared
 * `mlv-dropdown-panel` wires this from its `listboxId` input). A host
 * directive's exposed inputs cannot be set from this wrapper's own `host`
 * metadata, so `listboxId` is bound where the `<mlv-list>` element is used.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'mlv-list[selectable]',
  hostDirectives: [
    {
      directive: Listbox,
      inputs: [
        'value',
        'multi: multiple',
        'orientation',
        'wrap',
        'disabled',
        'readonly',
        'selectionMode',
        'softDisabled',
        'focusMode',
        'id: listboxId',
      ],
      outputs: ['valueChange'],
    },
  ],
})
export class MlvListSelectable<T> {
  /** @protected The host `ngListbox` pattern instance. */
  protected readonly _listbox = inject<Listbox<T>>(Listbox);

  /**
   * Moves keyboard focus to the first option in the list. Used by the
   * dropdown panel when a parent select/combobox opens the popup.
   */
  focusFirst(): void {
    this._listbox.gotoFirst();
  }
}

/**
 * Marks a `mlv-list-item` as a selectable option inside a
 * `mlv-list[selectable]`, backed by `@angular/aria`'s `ngOption`.
 *
 * The required `value`, optional `disabled`, optional typeahead `label`, and
 * optional `optionId` inputs are forwarded to the host `Option` directive.
 * Provide `label` (the visible option text) so type-to-select works — aria's
 * typeahead reads the explicit `label` input and defaults to an empty search
 * term otherwise. The shared `mlv-dropdown-panel` sets this automatically from
 * the option label.
 *
 * `optionId` re-exposes aria's `ngOption` `id` input (rendered as the option
 * element's `[attr.id]`). Forwarding a deterministic id lets an owning combobox
 * point its input's `aria-activedescendant` at the active option element (the
 * activedescendant focus model). Left unset, aria mints its own id.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'mlv-list-item[value]',
  exportAs: 'uiListItemSelectable',
  hostDirectives: [
    {
      directive: Option,
      inputs: ['value', 'disabled', 'label', 'id: optionId'],
    },
  ],
})
export class MlvListItemSelectable {
  /** @protected The host `ngOption` pattern instance. */
  protected readonly option = inject(Option, { self: true });
}
