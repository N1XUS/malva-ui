import { Directive, TemplateRef, inject } from '@angular/core';

/**
 * Template context handed to `[mlvItemsMoreTriggerDef]`: the number of items
 * currently withheld from the row.
 */
export interface MlvItemsMoreTriggerContext {
  $implicit: number;
}

/**
 * `<ng-template mlvItemsMoreVisible>` — how an item looks **in the row**.
 *
 * Declared inside an `<mlv-items-more-item>`. Required: an item with no
 * visible form has nothing to render and nothing to measure, so it is not an
 * item.
 */
@Directive({ selector: '[mlvItemsMoreVisible]' })
export class MlvItemsMoreVisibleDef {
  /** The template rendered into the row for this item. */
  readonly templateRef = inject(TemplateRef);
}

/**
 * `<ng-template mlvItemsMoreHidden>` — how an item looks **in the overflow
 * panel**.
 *
 * Optional, and its absence is meaningful rather than a fallback: an item
 * that cannot say how it looks collapsed is **pinned**, and `mlv-items-more`
 * will never withhold it. That is the honest reading — withholding it would
 * remove it from the interface outright, not relocate it — and it is what
 * makes a mixed row (a segmented control that must stay, three buttons that
 * may go) expressible without a second input.
 */
@Directive({ selector: '[mlvItemsMoreHidden]' })
export class MlvItemsMoreHiddenDef {
  /** The template rendered into the overflow panel for this item. */
  readonly templateRef = inject(TemplateRef);
}

/**
 * `<ng-template mlvItemsMoreTriggerDef let-count>` — how the "show more"
 * control looks. `mlv-items-more` renders it at the end of the row whenever
 * anything is withheld, and reserves its measured width when deciding what
 * fits.
 *
 * The template owns the words and the chrome; the component supplies only the
 * count. That is deliberate — it is what keeps this package free of an i18n
 * slice, and free of an opinion about whether the affordance is a `More (3)`
 * button, a `⋯`, or a chevron.
 *
 * **Put `[mlvItemsMoreTrigger]` on the control inside it.** This directive
 * describes appearance; the behaviour — the click, `aria-expanded`,
 * `aria-controls` — belongs to the element that is actually the button, and
 * only the template knows which element that is.
 *
 * The selector carries the `Def` suffix that the visible/hidden pair omits,
 * because `[mlvItemsMoreTrigger]` is taken by the behaviour directive and one
 * attribute cannot mean both.
 */
@Directive({ selector: '[mlvItemsMoreTriggerDef]' })
export class MlvItemsMoreTriggerDef {
  /** The template rendered as the overflow trigger. */
  readonly templateRef = inject(TemplateRef<MlvItemsMoreTriggerContext>);

  /** Type guard so `let-count` narrows to `number`. */
  static ngTemplateContextGuard(
    _dir: MlvItemsMoreTriggerDef,
    _ctx: unknown,
  ): _ctx is MlvItemsMoreTriggerContext {
    return true;
  }
}
