import { Directive, TemplateRef, inject } from '@angular/core';
import type { MlvChatMessageData, MlvChatUser } from '../chat.types';

/** Template context of an `[mlvChatAuthorDef]` author slot. */
export interface MlvChatAuthorDefContext {
  /** The group's author, or undefined when the id is missing from `users`. */
  $implicit: MlvChatUser | undefined;
  /** True when the group is authored by the current user. */
  isOwn: boolean;
  /** First message of the group, for timestamps or role badges. */
  firstMessage: MlvChatMessageData;
}

/**
 * Replaces the default author name shown above a group of other-authored
 * messages — for example to render an avatar plus a role badge.
 *
 * @example
 * <ng-template mlvChatAuthorDef let-user>
 *   <mlv-avatar size="xs" [name]="user.name" [src]="user.avatarSrc ?? null" />
 *   {{ user.name }}
 * </ng-template>
 */
@Directive({ selector: '[mlvChatAuthorDef]' })
export class MlvChatAuthorDef {
  /** The template rendered in the author slot. */
  readonly templateRef = inject<TemplateRef<MlvChatAuthorDefContext>>(TemplateRef);

  /** Type guard giving template variables their concrete types. */
  static ngTemplateContextGuard(
    _dir: MlvChatAuthorDef,
    _ctx: unknown,
  ): _ctx is MlvChatAuthorDefContext {
    return true;
  }
}
