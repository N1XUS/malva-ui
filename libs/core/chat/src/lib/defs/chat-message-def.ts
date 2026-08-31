import { Directive, TemplateRef, inject, input } from '@angular/core';
import type { MlvChatMessageDefContext } from '../chat-tokens';

/**
 * Marks an `<ng-template>` as the renderer for chat messages whose `type`
 * matches `mlvChatMessageDefType`. The template replaces the bubble body;
 * alignment, meta row, and animations stay owned by the chat.
 *
 * @example
 * <ng-template mlvChatMessageDef mlvChatMessageDefType="poll" let-message let-isOwn="isOwn">
 *   <app-poll [poll]="message.data" />
 * </ng-template>
 */
@Directive({ selector: '[mlvChatMessageDef]' })
export class MlvChatMessageDef {
  /** The message `type` this template renders. Templates without a type are ignored. */
  readonly mlvChatMessageDefType = input<string>('');

  /** The template rendered for matching messages. */
  readonly templateRef = inject<TemplateRef<MlvChatMessageDefContext>>(TemplateRef);

  /** Type guard giving template variables their concrete types. */
  static ngTemplateContextGuard(
    _dir: MlvChatMessageDef,
    _ctx: unknown,
  ): _ctx is MlvChatMessageDefContext {
    return true;
  }
}
