import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
  output,
} from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import type {
  MlvViewVariant,
  MlvViewVariantAction,
  MlvViewVariantBusyAction,
} from '../view-variant.types';

/** Internal decision states; `editable-clean` intentionally has no rendered band. */
type MlvViewVariantStatusMode =
  | 'unsaved'
  | 'locked-clean'
  | 'locked-dirty'
  | 'editable-dirty'
  | 'editable-clean';

/**
 * Controlled dirty-state and read-only explanation for the active saved view.
 *
 * It never persists state or decides whether a confirmation is required; the
 * host responds to its request outputs and supplies the next controlled state.
 */
@Component({
  selector: 'mlv-view-variant-status',
  imports: [MlvButton],
  templateUrl: './view-variant-status.html',
  styleUrl: './view-variant-status.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-view-variant-status',
  },
})
export class MlvViewVariantStatus<TState> {
  /** Active saved view, or null when the working view is unsaved. */
  readonly variant = input<MlvViewVariant<TState> | null>(null);

  /** Whether the host-owned working state differs from its saved baseline. */
  readonly dirty = input(false);

  /** Whether the host permits saving a new view from the current working state. */
  readonly canCreate = input(false);

  /** Operation currently pending in the host, if any. */
  readonly busyAction = input<MlvViewVariantBusyAction | null>(null);

  /** Recoverable host-supplied error for this status surface. */
  readonly errorMessage = input<string | null>(null);

  /** Emits when the host should restore its current baseline state. */
  readonly resetRequest = output<void>();

  /** Emits the active view to duplicate as a new saved view. */
  readonly cloneRequest = output<MlvViewVariant<TState>>();

  /** Emits the active view to update from its dirty working state. */
  readonly updateRequest = output<MlvViewVariant<TState>>();

  /** Emits when the host should save the working state as a new view. */
  readonly createRequest = output<void>();

  /** Emits when the user asks the host to retry the displayed error. */
  readonly retryRequest = output<void>();

  /** Emits when the user dismisses the displayed host error. */
  readonly dismissError = output<void>();

  /** @protected The resolved internal state, including invisible editable-clean. */
  protected readonly _mode = computed<MlvViewVariantStatusMode>(() => {
    const variant = this.variant();
    if (!variant) return 'unsaved';
    if (variant.locked && this.dirty()) return 'locked-dirty';
    if (variant.locked) return 'locked-clean';
    return this.dirty() ? 'editable-dirty' : 'editable-clean';
  });

  /** @protected The rendered explanation associated with the current mode. */
  protected readonly _message = computed(() => {
    switch (this._mode()) {
      case 'locked-clean':
        return 'This system view is read-only';
      case 'locked-dirty':
        return 'Duplicate it to save your changes';
      case 'editable-dirty':
        return 'You have unsaved view changes';
      case 'unsaved':
        return 'This is an unsaved view';
      case 'editable-clean':
        return '';
    }
  });

  /** @protected Whether an actionable status band should be rendered. */
  protected readonly _isVisible = computed(
    () => this._mode() !== 'editable-clean' || !!this.errorMessage(),
  );

  /** @protected Whether any action relevant to this surface is currently busy. */
  protected readonly _isBusy = computed(() => {
    const busy = this.busyAction();
    if (!busy) return false;
    if (!['create', 'clone', 'update'].includes(busy.action)) return false;
    const variant = this.variant();
    return busy.variantId === undefined || busy.variantId === variant?.id;
  });

  /** @protected Whether a single operation is pending for this active context. */
  protected _isActionBusy(action: MlvViewVariantAction): boolean {
    const busy = this.busyAction();
    return (
      busy?.action === action &&
      (busy.variantId === undefined || busy.variantId === this.variant()?.id)
    );
  }

  /** @protected Emits reset; a busy persistence operation does not block it. */
  protected _reset(): void {
    this.resetRequest.emit();
  }

  /** @protected Emits duplication only for a clone-capable active view. */
  protected _clone(): void {
    const variant = this.variant();
    if (variant?.capabilities.clone && !this._isActionBusy('clone')) {
      this.cloneRequest.emit(variant);
    }
  }

  /** @protected Emits update only for an update-capable dirty active view. */
  protected _update(): void {
    const variant = this.variant();
    if (
      variant?.capabilities.update &&
      this.dirty() &&
      !this._isActionBusy('update')
    ) {
      this.updateRequest.emit(variant);
    }
  }

  /** @protected Emits creation only when the host has allowed it. */
  protected _create(): void {
    if (this.canCreate() && !this._isActionBusy('create')) {
      this.createRequest.emit();
    }
  }
}
