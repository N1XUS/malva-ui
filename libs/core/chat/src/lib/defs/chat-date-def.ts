import { Directive, TemplateRef, inject } from '@angular/core';

/** Template context of an `[mlvChatDateDef]` date separator. */
export interface MlvChatDateDefContext {
  /** Start of the calendar day the separator introduces. */
  $implicit: Date;
}

/**
 * Replaces the default Today/Yesterday/date pill rendered between messages of
 * different calendar days.
 *
 * @example
 * <ng-template mlvChatDateDef let-date>{{ date | date: 'fullDate' }}</ng-template>
 */
@Directive({ selector: '[mlvChatDateDef]' })
export class MlvChatDateDef {
  /** The template rendered for each date separator. */
  readonly templateRef = inject<TemplateRef<MlvChatDateDefContext>>(TemplateRef);

  /** Type guard giving template variables their concrete types. */
  static ngTemplateContextGuard(
    _dir: MlvChatDateDef,
    _ctx: unknown,
  ): _ctx is MlvChatDateDefContext {
    return true;
  }
}
