import type { OnDestroy, OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  contentChild,
  inject,
  input,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  MlvItemsMoreHiddenDef,
  MlvItemsMoreVisibleDef,
} from '../items-more.directives';
import { MlvItemsMoreService } from '../items-more.service';

/**
 * One entry of an `mlv-items-more` row.
 *
 * A **definition node**, like `<mlv-tab>`: it renders nothing itself
 * (`display: none`) and exists to carry the two templates and to hold a
 * stable identity that the width cache and the visible/hidden split can be
 * keyed by. Identity is the component instance, not a `value` input — a
 * width measured for *this* element is invalid precisely when the element is
 * destroyed, which is exactly when the instance goes away, so an extra
 * required input would only be a second name for something the object model
 * already says.
 *
 * ```html
 * <mlv-items-more-item>
 *   <ng-template mlvItemsMoreVisible>
 *     <button mlvButton variant="transparent">Share</button>
 *   </ng-template>
 *   <ng-template mlvItemsMoreHidden>
 *     <button mlvButton variant="transparent">Share</button>
 *   </ng-template>
 * </mlv-items-more-item>
 * ```
 */
@Component({
  selector: 'mlv-items-more-item',
  template: '',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: none' },
})
export class MlvItemsMoreItem implements OnInit, OnDestroy {
  /** @private The owning row's registry. */
  private readonly _service = inject(MlvItemsMoreService);

  /**
   * The `display: none` definition node. Not a box to measure — the row
   * measures the *rendered* template, not this — but a position in the
   * document, which is how the registry keeps items in declaration order
   * regardless of the order they happen to initialize in.
   */
  readonly elementRef = inject(ElementRef<HTMLElement>);

  /**
   * Pins the item into the row: it is never withheld, and its width is
   * reserved before any other item is considered.
   *
   * An item with no `mlvItemsMoreHidden` template is pinned regardless — see
   * {@link collapsible}. Set this when the item *has* a collapsed form but
   * should still never be the one to go.
   */
  readonly pinned = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * The item's in-row template. Required: an item with no in-row form has
   * nothing to render and nothing to measure, and an unmeasurable item would
   * hold every split in the row back indefinitely.
   */
  readonly visibleTemplate = contentChild.required(MlvItemsMoreVisibleDef);

  /** The item's in-panel template, or `undefined` when it has none. */
  readonly hiddenTemplate = contentChild(MlvItemsMoreHiddenDef);

  /**
   * Whether this item may be withheld from the row. False when it is
   * {@link pinned}, and false when it declares no collapsed form — there
   * would be nowhere for it to go.
   */
  readonly collapsible = computed(
    () => !this.pinned() && this.hiddenTemplate() !== undefined,
  );

  ngOnInit(): void {
    this._service.register(this);
  }

  ngOnDestroy(): void {
    this._service.unregister(this);
  }
}
