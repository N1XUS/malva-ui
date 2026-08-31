import { InjectionToken, type Signal, type TemplateRef } from '@angular/core';
import type { MlvChatGroupPosition, MlvChatMessageData, MlvChatUser } from './chat.types';

/** Template context of an `[mlvChatMessageDef]` custom message renderer. */
export interface MlvChatMessageDefContext {
  /** The message being rendered. */
  $implicit: MlvChatMessageData;
  /** True when the message is authored by the current user. */
  isOwn: boolean;
  /** Position inside the consecutive-author group. */
  groupPosition: MlvChatGroupPosition;
  /** True when rendered condensed inside a reply quote. */
  quote: boolean;
}

/** Reference to a registered custom message-type template. */
export interface MlvChatMessageDefRef {
  /** The template to render for messages of the registered type. */
  templateRef: TemplateRef<MlvChatMessageDefContext>;
}

/**
 * Users map (id → user) provided by `mlv-chat` so bubbles can resolve author
 * display names (reply quotes). Optional — standalone bubbles render without it.
 */
export const MLV_CHAT_USERS = new InjectionToken<Signal<ReadonlyMap<string, MlvChatUser>>>(
  'MLV_CHAT_USERS',
);

/** Custom message-type templates (type → def) provided by `mlv-chat`. */
export const MLV_CHAT_MESSAGE_DEFS = new InjectionToken<
  Signal<ReadonlyMap<string, MlvChatMessageDefRef>>
>('MLV_CHAT_MESSAGE_DEFS');
