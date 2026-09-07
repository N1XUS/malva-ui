import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  computed,
  Directive,
  ElementRef,
  HostAttributeToken,
  inject,
  input,
} from '@angular/core';
import type { MlvTone } from '@malva-ui/cdk/utils';
import { MLV_SWIPE_ACTIONS } from '../swipe-actions-token';

/**
 * Fill of a swipe action. The four semantic {@link MlvTone}s plus a
 * `'neutral'` surface (the default — a "More"-style secondary action) and the
 * brand `'accent'`.
 */
export type MlvSwipeActionTone = MlvTone | 'neutral' | 'accent';

/**
 * How a swipe action paints itself.
 *
 * - `'block'` — the iOS look: a full-height, solid tone-filled block that
 *   stacks the projected icon above its label. Meant for a bare `<button>`.
 * - `'plain'` — no chrome at all: the host keeps its own look and is only
 *   centred on the row. Meant for a host that already paints itself — a
 *   `button[mlvButton]`, an `mlv-switch`, an `mlv-icon-toggle`.
 */
export type MlvSwipeActionAppearance = 'block' | 'plain';

/**
 * One action revealed by swiping an `mlv-swipe-actions` row.
 *
 * On a bare `<button>` it paints the iOS look — a full-height, solid-filled
 * block with the projected icon above its label. On a host that already
 * paints itself (`button[mlvButton]`, `mlv-switch`, …) set
 * `appearance="plain"`: the directive then only places the element on the
 * row and wires the close-on-activate behaviour.
 *
 * Which edge the action lives on is the **static** `side` attribute
 * (`side="start"`, or nothing for the end side). It is read by the row's
 * content projection, so it cannot be bound: an `[side]` binding is a
 * template error, not a silently misplaced action.
 *
 * Activating the action closes the row unless `closeOnActivate` is `false`
 * — a toggle that stays on the row, say. The row's `opened` model changes
 * only once that scroll settles, so the consumer's own `(click)` handler on
 * the same element still observes the row open. Outside a row the directive
 * is only styling.
 *
 * The host must be interactive on its own: a `<button>`, or a component
 * that handles its keys itself (`mlv-switch`, `button[mlvButton]`). The
 * directive adds no role, tabindex or key handling.
 *
 * @example
 * ```html
 * <button mlvSwipeAction side="start" tone="success" (click)="archive()">
 *   <svg lucideArchive [size]="20" aria-hidden="true" />
 *   Archive
 * </button>
 * <button mlvSwipeAction tone="danger" (click)="remove()">
 *   <svg lucideTrash2 [size]="20" aria-hidden="true" />
 *   Delete
 * </button>
 *
 * <!-- A control with its own look, kept on the row when toggled. -->
 * <mlv-switch mlvSwipeAction appearance="plain" closeOnActivate="false"
 *             [(checked)]="muted" ariaLabel="Mute" />
 * ```
 */
@Directive({
  selector: '[mlvSwipeAction]',
  host: {
    class: 'mlv-swipe-action',
    '[class]': '_modifierClasses()',
    '[attr.type]': '_type',
    '(click)': '_onClick()',
  },
})
export class MlvSwipeAction {
  /**
   * Fill of a `block` action: `'neutral'` (default), `'accent'`, or a
   * semantic `info` / `success` / `warning` / `danger`. Reflected as
   * `mlv-swipe-action--tone-<tone>`; a `plain` action ignores it.
   */
  readonly tone = input<MlvSwipeActionTone | undefined>(undefined);

  /**
   * `'block'` (default) paints the full-height tone-filled block; `'plain'`
   * leaves the host's own look untouched and only centres it on the row.
   * Reflected as `mlv-swipe-action--block` / `mlv-swipe-action--plain`.
   */
  readonly appearance = input<MlvSwipeActionAppearance>('block');

  /**
   * Whether activating the action closes the row (default). Set to `false`
   * for a control whose state lives on the row — a switch, a rating, a
   * pressed toggle — so the row stays open after each change.
   */
  readonly closeOnActivate = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /**
   * @private The row this action belongs to, or `null` when the directive is
   * used on its own.
   */
  private readonly _row = inject(MLV_SWIPE_ACTIONS, { optional: true });

  /**
   * @protected Native `type` for a `<button>` host, defaulting to `"button"`
   * so a row rendered inside a `<form>` never submits it on activation. An
   * explicit static `type` attribute wins; any other host gets no attribute.
   */
  protected readonly _type: string | null =
    inject(ElementRef<HTMLElement>).nativeElement.tagName === 'BUTTON'
      ? (inject(new HostAttributeToken('type'), { optional: true }) ?? 'button')
      : null;

  /** @protected The `--<appearance>` and `--tone-*` modifier classes. */
  protected readonly _modifierClasses = computed(
    () =>
      `mlv-swipe-action--${this.appearance()} mlv-swipe-action--tone-${this.tone() ?? 'neutral'}`,
  );

  /**
   * @protected Closes the owning row once the action has been activated. A
   * directive host listener runs before the template's `(click)` on the same
   * element, so this only *starts* the closing scroll; `opened` still
   * reports the open side when the consumer's handler runs.
   */
  protected _onClick(): void {
    if (this.closeOnActivate()) this._row?.close();
  }
}
