import { Directive, inject } from '@angular/core';
import { Toolbar, ToolbarWidget } from '@angular/aria/toolbar';

/**
 * Opt-in roving-focus behaviour for a `mlv-toolbar`, backed by
 * `@angular/aria`'s headless `ngToolbar` pattern.
 *
 * Apply `mlvToolbarRoving` to the `<mlv-toolbar>` element and
 * {@link MlvToolbarWidget} (`mlvToolbarWidget`) to each interactive
 * child to turn the toolbar into a single Tab stop whose items are traversed
 * with the arrow keys (plus `Home`/`End`), per the WAI-ARIA toolbar pattern:
 *
 * ```html
 * <mlv-toolbar mlvToolbarRoving>
 *   <button mlvButton mlvToolbarWidget>Save</button>
 *   <button mlvButton mlvToolbarWidget>Print</button>
 * </mlv-toolbar>
 * ```
 *
 * This is **opt-in** on purpose: `mlv-toolbar` projects arbitrary content, so
 * applying the aria toolbar pattern unconditionally would (a) require every
 * consumer to annotate their children and (b) mark a widget-less toolbar as a
 * focusable, `aria-disabled` element. Plain `mlv-toolbar` usage is therefore
 * left completely untouched.
 *
 * The aria pattern's knobs are re-exposed so consumers can pin them where the
 * element is used (a host directive's inputs cannot be set from the wrapper's
 * own `host` metadata):
 *
 * - `orientation` (`'horizontal'` default) — arrow-key axis.
 * - `wrap` (`true` default) — whether arrow navigation wraps at the ends.
 * - `softDisabled` (`true` default) — keep disabled widgets focusable-but-inert
 *   (`false` skips them during navigation).
 * - `disabled` — disable the whole toolbar.
 * - `value` / `valueChange` — selection model for toggle/radio-style toolbars
 *   (an array of the selected widget values; see {@link MlvToolbarWidget}).
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'mlv-toolbar[mlvToolbarRoving]',
  exportAs: 'mlvToolbarRoving',
  hostDirectives: [
    {
      directive: Toolbar,
      inputs: ['orientation', 'wrap', 'disabled', 'softDisabled', 'value'],
      outputs: ['valueChange'],
    },
  ],
})
export class MlvToolbarRoving<V> {
  /** @protected The host `ngToolbar` pattern instance. */
  protected readonly _toolbar = inject<Toolbar<V>>(Toolbar);
}

/**
 * Marks an interactive element as a widget inside a
 * {@link MlvToolbarRoving} (`mlvToolbarRoving`) toolbar, backed by
 * `@angular/aria`'s `ngToolbarWidget`.
 *
 * The widget's `value` is exposed through the selector attribute itself, so a
 * plain action button needs no extra binding and a selection-group button
 * supplies its identity inline:
 *
 * ```html
 * <!-- action buttons: value defaults to '' -->
 * <button mlvButton mlvToolbarWidget>Save</button>
 *
 * <!-- toggle/radio group: distinct values feed the toolbar's [(value)] model -->
 * <button mlvButton mlvToolbarWidget="left">Left</button>
 * <button mlvButton mlvToolbarWidget="center">Center</button>
 * ```
 *
 * **Deviation from the migration plan:** the plan called for synthesising the
 * required `value` internally via `mlvNextId`. In `@angular/aria` 22.0.5
 * `ngToolbarWidget.value` is a *required* input, and a wrapper directive cannot
 * set its own host directive's input from the wrapper's `host` metadata (doing
 * so raises `NG0950`). The value must therefore be supplied where the element
 * is declared; exposing it through the selector alias keeps that ergonomic
 * (omitted → `''`) without forcing every consumer to bind it.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[mlvToolbarWidget]',
  exportAs: 'mlvToolbarWidget',
  hostDirectives: [
    {
      directive: ToolbarWidget,
      inputs: ['value: mlvToolbarWidget', 'disabled'],
    },
  ],
})
export class MlvToolbarWidget<V> {
  /** @protected The host `ngToolbarWidget` pattern instance. */
  protected readonly _widget = inject<ToolbarWidget<V>>(ToolbarWidget);
}
