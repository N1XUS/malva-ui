import type { Signal, WritableSignal } from '@angular/core';
import {
  Directive,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
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
 * key-manager creation over the current children, the roving tab stop,
 * keydown delegation, child-focus tracking, and teardown. Subclasses supply the
 * live children signal ({@link _items}) and the skip predicate
 * ({@link _isDisabled}); everything else (selection, CVA, templates) stays in
 * the concrete component.
 *
 * The tab stop is the child focused last, and the first child that is not
 * disabled until one has been. A disabled child is never the stop: a disabled
 * native input cannot take focus, so a stop left on one would leave the group
 * with none and Tab would skip it entirely. When the focused child turns
 * disabled the stop moves to the next enabled child, wrapping; while every
 * child is disabled there is no stop at all.
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
   * signal on the subclass. Read reactively inside the base effects so the key
   * manager is rebuilt, and the tab stop re-resolved, whenever the projected
   * set changes.
   */
  protected abstract readonly _items: Signal<readonly T[]>;

  /**
   * @protected Predicate marking a child as skipped by arrow navigation and
   * ineligible as the tab stop. Groups bridge their own disabled model here
   * (e.g. `computedDisabled()`). Read inside a reactive context, so any signal
   * it reads re-resolves the tab stop when it changes.
   */
  protected abstract _isDisabled(item: T): boolean;

  /** @private FocusKeyManager driving roving-tabindex arrow navigation between children. */
  private _keyManager?: FocusKeyManager<T>;

  /** @private Subscription to the key manager's active-item changes. */
  private _changeSub?: Subscription;

  /**
   * @private The child focused last — by Tab, pointer or arrow key — mirrored
   * from the key manager so the tab-stop effect can track it. `null` until a
   * child has been focused, and again once that child leaves the group.
   */
  private readonly _activeItem = signal<T | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this._changeSub?.unsubscribe();
      this._keyManager?.destroy();
    });

    // Rebuild the key manager over the current children. Untracked past the
    // children themselves: the rebuild reads the active child to carry it over,
    // and must not re-run every time focus moves.
    effect(() => {
      const items = [...this._items()];
      untracked(() => this._rebuildKeyManager(items));
    });

    // Resolve the roving tab stop. Tracks the children, the active child and —
    // through `_isDisabled` — each candidate's disabled flag, so a child
    // turning disabled hands the stop on. The disabled flag of a child
    // projected through `@for` is bound only after this first runs (its input
    // is set when the row view refreshes, after this view's effects), so the
    // tracking is also what makes the initial stop honour it.
    effect(() => this._syncTabIndices());
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
    // No direction argument, deliberately: this handler only matches the
    // vertical pair, which never mirrors (`.claude/rules/rtl.md`).
    const key = this._rtlService.normalizeArrowKey(event);
    if (key === UP_ARROW || key === DOWN_ARROW) {
      this._keyManager?.onKeydown(event);
      event.preventDefault();
    }
  }

  /**
   * @private Replaces the key manager with one over `items`, carrying the
   * active child over when it is still among them — otherwise every change to
   * the projected set sent arrow navigation back to the first child while focus
   * stayed where it was.
   */
  private _rebuildKeyManager(items: T[]): void {
    // Destroy the previous instance before allocating a new one — without
    // this, every children emission accumulates a live FocusKeyManager
    // (subscriptions, change-detection refs) against detached items.
    this._changeSub?.unsubscribe();
    this._keyManager?.destroy();
    this._keyManager = undefined;

    const active = this._activeItem();
    if (active !== null && !items.includes(active)) {
      this._activeItem.set(null);
    }
    if (items.length === 0) return;

    const keyManager = new FocusKeyManager<T>(items)
      .skipPredicate((item) => this._isDisabled(item))
      .withVerticalOrientation()
      .withWrap();
    if (active !== null && items.includes(active)) {
      keyManager.updateActiveItem(active);
    }

    // Keep the roving tabindex in sync as focus moves between children so only
    // the active item is tabbable. `tabIndex` is a signal, so the host binding
    // updates under OnPush without an extra change-detection trigger.
    this._changeSub = keyManager.change.subscribe(() => {
      this._activeItem.set(keyManager.activeItem);
      this._syncTabIndices();
    });
    this._keyManager = keyManager;
  }

  /** @private Sets tabindex 0 on the resolved tab stop and -1 on the rest. */
  private _syncTabIndices(): void {
    const items = this._items();
    const stop = this._resolveTabStop(items);
    items.forEach((item) => {
      item.tabIndex.set(item === stop ? 0 : -1);
    });
  }

  /**
   * @private The child that should carry the tab stop: the first child that is
   * not disabled, scanning forward — and wrapping — from the active child, or
   * from the first child while none is active. `null` when every child is
   * disabled.
   */
  private _resolveTabStop(items: readonly T[]): T | null {
    const active = this._activeItem();
    const start = active === null ? 0 : Math.max(items.indexOf(active), 0);
    for (let offset = 0; offset < items.length; offset++) {
      const item = items[(start + offset) % items.length];
      if (!this._isDisabled(item)) return item;
    }
    return null;
  }
}
