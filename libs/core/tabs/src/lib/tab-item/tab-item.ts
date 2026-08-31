import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'mlv-tab-item',
  template: `<ng-content />`,
  styleUrl: './tab-item.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-tab-item',
    '[class.mlv-tab-item--active]': 'active()',
    '[class.mlv-tab-item--disabled]': 'disabled()',
    '(click)': '!disabled() && activate.emit()',
    '(keydown.enter)':
      '!disabled() && activate.emit(); $event.stopPropagation()',
    '(keydown.space)':
      '!disabled() && activate.emit(); $event.stopPropagation(); $event.preventDefault()',
  },
})
export class MlvTabItem {
  readonly elementRef = inject(ElementRef<HTMLElement>);

  /**
   * Whether this tab is currently selected. Drives the active styling only —
   * `aria-selected`, `role="tab"`, roving `tabindex` and `aria-controls` are
   * provided by the `@angular/aria` `ngTab` directive applied on this element
   * by the parent `mlv-tab-group`.
   */
  readonly active = input(false);

  /** Whether this tab is disabled. Drives the disabled styling only. */
  readonly disabled = input(false);

  /**
   * Emitted on click or Enter/Space when not disabled. Enter/Space stop
   * propagation so the aria `ngTabList` keyboard handler does not additionally
   * activate the (roving-)focused tab; this preserves the historical behaviour
   * where keyboard activation targets the tab receiving the event.
   */
  readonly activate = output<void>();

  /**
   * Programmatically focuses this tab item. Used by the parent
   * `mlv-tab-group` when promoting an overflow tab into the visible header.
   */
  focus(): void {
    this.elementRef.nativeElement.focus();
  }
}
