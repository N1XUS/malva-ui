import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

/** Translatable strings used by `mlv-chat` and `mlv-chat-message`. */
export interface MlvChatI18n {
  /** Accessible label for the chat log region. */
  chatLabel: string;
  /** Date separator label for the current day. */
  today: string;
  /** Date separator label for the previous day. */
  yesterday: string;
  /** Status text while an own message is being sent. */
  statusSending: string;
  /** Status text once an own message reached the server. */
  statusSent: string;
  /** Status text once an own message reached the recipient. */
  statusDelivered: string;
  /** Status text once an own message was read. */
  statusRead: string;
  /** Status text when sending an own message failed. */
  statusFailed: string;
  /** Label of the retry action on a failed message. */
  retry: string;
  /** ICU `{count}` — new-messages pill label while scrolled up. */
  newMessages: string;
  /** ICU `{count}` — typing indicator label. */
  typing: string;
  /** Accessible label for the play action of an audio message. */
  playAudio: string;
  /** Accessible label for the pause action of an audio message. */
  pauseAudio: string;
  /** Fallback alt text for image attachments without one. */
  imageFallbackAlt: string;
  /** ICU `{count}` — label of the +N overflow cell in the media grid. */
  moreMedia: string;
  /** Accessible text while an older page of messages is loading. */
  loadingOlder: string;
}

/** Reactive translations for `mlv-chat`. */
export const MLV_CHAT_I18N = new InjectionToken<Signal<MlvChatI18n>>('MLV_CHAT_I18N');

/** Translation context supplied to AI and tooling. */
export const MLV_CHAT_I18N_CONTEXT: Record<keyof MlvChatI18n, MlvTranslationContext> = {
  chatLabel: {
    component: 'mlv-chat',
    usage: 'aria-label',
    description: 'Accessible label for the scrollable chat message log',
  },
  today: {
    component: 'mlv-chat',
    usage: 'label',
    description: 'Date separator label shown for messages sent today',
  },
  yesterday: {
    component: 'mlv-chat',
    usage: 'label',
    description: 'Date separator label shown for messages sent yesterday',
  },
  statusSending: {
    component: 'mlv-chat-message',
    usage: 'aria-label',
    description: 'Delivery status of an own message that is still being sent',
  },
  statusSent: {
    component: 'mlv-chat-message',
    usage: 'aria-label',
    description: 'Delivery status of an own message accepted by the server',
  },
  statusDelivered: {
    component: 'mlv-chat-message',
    usage: 'aria-label',
    description: 'Delivery status of an own message delivered to the recipient',
  },
  statusRead: {
    component: 'mlv-chat-message',
    usage: 'aria-label',
    description: 'Delivery status of an own message read by the recipient',
  },
  statusFailed: {
    component: 'mlv-chat-message',
    usage: 'aria-label',
    description: 'Delivery status of an own message that failed to send',
  },
  retry: {
    component: 'mlv-chat-message',
    usage: 'button-text',
    description: 'Action shown on a failed message to retry sending it',
  },
  newMessages: {
    component: 'mlv-chat',
    usage: 'button-text',
    description:
      'ICU plural with {count}: pill shown while scrolled up announcing newly arrived messages',
  },
  typing: {
    component: 'mlv-chat',
    usage: 'label',
    description: 'ICU plural with {count}: label of the typing indicator bubble',
  },
  playAudio: {
    component: 'mlv-chat',
    usage: 'aria-label',
    description: 'Accessible label of the play button of an audio message',
  },
  pauseAudio: {
    component: 'mlv-chat',
    usage: 'aria-label',
    description: 'Accessible label of the pause button of an audio message',
  },
  imageFallbackAlt: {
    component: 'mlv-chat',
    usage: 'label',
    description: 'Fallback alt text for image attachments that carry none',
  },
  moreMedia: {
    component: 'mlv-chat',
    usage: 'aria-label',
    description:
      'ICU plural with {count}: label of the +N overlay covering additional hidden media attachments',
  },
  loadingOlder: {
    component: 'mlv-chat',
    usage: 'aria-label',
    description: 'Accessible text announced while an older page of messages loads',
  },
};
