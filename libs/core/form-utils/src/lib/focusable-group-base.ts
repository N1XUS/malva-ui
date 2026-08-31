import type { Signal, WritableSignal } from '@angular/core';
import { Directive, DestroyRef, effect, inject } from '@angular/core';
import type { FocusOrigin } from '@angular/cdk/a11y';
import { FocusKeyManager } from '@angular/cdk/a11y';
import { DOWN_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import type { Subscription } from 'rxjs';
import { MlvRtlService } from '@malva-ui/cdk/utils';

/**
 * The per-item contract a roving-tabindex group needs from each child: a
 * focusable element whose `tabIndex` is a writable signal the group flips
 * between `0` (the single tab stop) and `-1` (the rest). Satisfied by
 * `mlv-checkbox` and `mlv-switch`, whose native input binds `[attr.tabindex]`
 * to this signal.
 *
 * Deliberately NOT `extends FocusableOption`: components type `disabled` as a
 * coerced input signal (`InputSignalWithTransform<boolean, BooleanInput>`),
 * which is incompatible with `FocusableOption`'s plain `disabled?: boolean`.
 * Disabled-skipping is expressed through the group's
 * {@link MlvFocusableGroupBase._isDisabled} predicate instead, and
 * `FocusKeyManager<T>` needs no constraint (it intersects `FocusableOption & T`
 * internally).
 */
export interface MlvFocusableGroupItem {
  /** Focuses the item's focus target (the visually-hidden native input). */
  focus(origin?: FocusOrigin): void;

  /** Roving tabindex applied to the item's focus target. */
  readonly tabIndex: WritableSignal<number>;
}

/**
 * Shared, selection-agnostic scaffold for composite groups that navigate their
 * children with a vertical, wrapping {@link FocusKeyManager} and a roving
 * tabindex that follows focus (only the active child is tabbable).
 *
 * Extracted from the duplicated lifecycle in `MlvCheckboxGroup` and
 * `MlvSwitchGroup`. It owns **only** the focus / roving-tabindex concern:
 * key-manager creation over the current children, the `change`→tabindex sync,
 * keydown delegation, child-focus tracking, and teardown. Subclasses supply the
 * live children signal ({@link _items}) and the skip predicate
 * ({@link _isDisabled}); everything else (selection, CVA, templates) stays in
 * the concrete component.
 *
 * NB: this is a *focus-roving* base — the tab stop follows the focused child.
 * Groups whose tab stop must follow a *selected* child instead (e.g.
 * `mlv-radio-group`, whose checked radio is the tab stop and whose arrow keys
 * also move selection) do not fit this contract and keep their own manager.
 *
 * @typeParam T The concrete focusable child component type.
 */
@Directive()
export abstract class MlvFocusableGroupBase<T extends MlvFocusableGroupItem> {
  /** @private Normalizes the vertical arrow keys delegated to the key manager. */
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @protected The live children in DOM order — typically a `contentChildren`
   * signal on the subclass. Read reactively inside the base effect so the key
   * manager is rebuilt whenever the projected set changes.
   */
  protected abstract readonly _items: Signal<readonly T[]>;

  /**
   * @protected Predicate marking a child as skipped by arrow navigation. Groups
   * bridge their own disabled model here (e.g. `computedDisabled()`).
   */
  protected abstract _isDisabled(item: T): boolean;

  /** @private FocusKeyManager driving roving-tabindex arrow navigation between children. */
  private _keyManager?: FocusKeyManager<T>;

  /** @private Subscription to the key manager's active-item changes. */
  private _changeSub?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this._changeSub?.unsubscribe();
      this._keyManager?.destroy();
    });

    effect(() => {
      const items = [...this._items()];
      if (items.length === 0) return;

      // Destroy the previous instance before allocating a new one — without
      // this, every children emission accumulates a live FocusKeyManager
      // (subscriptions, change-detection refs) against detached items.
      this._changeSub?.unsubscribe();
      this._keyManager?.destroy();
      this._keyManager = new FocusKeyManager<T>(items)
        .skipPredicate((item) => this._isDisabled(item))
        .withVerticalOrientation()
        .withWrap();

      // Keep the roving tabindex in sync as focus moves between children so only
      // the active item is tabbable. `tabIndex` is a signal, so the host binding
      // updates under OnPush without an extra change-detection trigger.
      this._changeSub = this._keyManager.change.subscribe((index) =>
        this._syncTabIndices(index),
      );

      // Initial roving state: the first child is the single tab stop.
      this._syncTabIndices(0);
    });
  }

  /**
   * Notifies the manager which child took focus so arrow navigation resumes from
   * it. Wire to each child's focus notification (group accessor token).
   */
  onChildFocus(item: T): void {
    const index = this._items().indexOf(item);
    if (index >= 0) {
      this._keyManager?.setActiveItem(index);
    }
  }

  /**
   * Delegates ArrowUp/ArrowDown to the key manager (moving focus + the tab stop)
   * and suppresses the default page scroll. Wire to the group's `(keydown)`.
   */
  onKeydown(event: KeyboardEvent): void {
    const key = this._rtlService.normalizeArrowKey(event);
    if (key === UP_ARROW || key === DOWN_ARROW) {
      this._keyManager?.onKeydown(event);
      event.preventDefault();
    }
  }

  /** @private Sets tabindex 0 on the active child and -1 on the rest. */
  private _syncTabIndices(activeIndex: number): void {
    this._items().forEach((item, i) => {
      item.tabIndex.set(i === activeIndex ? 0 : -1);
    });
  }
}
