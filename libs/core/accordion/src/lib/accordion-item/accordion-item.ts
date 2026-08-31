import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  AccordionContent,
  AccordionPanel,
  AccordionTrigger,
} from '@angular/aria/accordion';
import { MlvExpand } from '@malva-ui/core/expand';
import { LucideChevronDown } from '@lucide/angular';

/**
 * A single expandable section of a `mlv-accordion`.
 *
 * Renders a header button (the `@angular/aria` `AccordionTrigger`) and a
 * lazily-rendered content region (`AccordionPanel` + `AccordionContent`). The
 * visual open/close animation is provided by wrapping the panel content in
 * `mlv-expand`; the aria directives own the `role`, `aria-expanded`,
 * `aria-controls`/`aria-labelledby` linkage, `inert`, and keyboard handling.
 *
 * Panel content is rendered lazily on first expand via aria's `DeferredContent`
 * and then kept mounted (`preserveContent`) so the `mlv-expand`
 * grid-row animation is never torn down mid-transition — the collapse hides the
 * content through `mlv-expand`'s own `@if`, not by unmounting the panel.
 *
 * @example
 * ```html
 * <mlv-accordion>
 *   <mlv-accordion-item header="Billing" [(expanded)]="billingOpen">
 *     <p>Manage your billing details…</p>
 *   </mlv-accordion-item>
 * </mlv-accordion>
 * ```
 */
@Component({
  selector: 'mlv-accordion-item',
  templateUrl: './accordion-item.html',
  styleUrl: './accordion-item.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccordionTrigger,
    AccordionPanel,
    AccordionContent,
    MlvExpand,
    LucideChevronDown,
  ],
  host: {
    class: 'mlv-accordion-item',
    '[class.mlv-accordion-item--open]': 'expanded()',
    '[class.mlv-accordion-item--disabled]': 'disabled()',
  },
})
export class MlvAccordionItem {
  /**
   * Plain-text header shown in the trigger button. For rich header content
   * (icons, badges) project an element marked with the `mlvAccordionHeader`
   * directive instead.
   */
  readonly header = input<string>('');

  /**
   * Disables this item: the trigger becomes non-interactive and gets
   * `aria-disabled="true"`. Whether it stays keyboard-focusable is governed by
   * the parent `mlv-accordion`'s `softDisabled` input (aria default: focusable).
   * Supports attribute syntax: `<mlv-accordion-item disabled>`.
   */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Two-way bindable expanded state of this item. Bind with
   * `[(expanded)]="mySignal"`, or observe changes with
   * `(expandedChange)="onToggle($event)"`. Kept in sync with the aria
   * `AccordionTrigger` expansion model.
   */
  readonly expanded = model<boolean>(false);
}
