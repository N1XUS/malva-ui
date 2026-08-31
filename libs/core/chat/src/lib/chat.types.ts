/** Delivery lifecycle of an own message; rendered as tick icons in the meta row. */
export type MlvChatMessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Participant referenced by {@link MlvChatMessageData.authorId}. */
export interface MlvChatUser {
  /** Stable unique id, matched against `message.authorId` and the `mlv-chat` `selfId` input. */
  id: string;
  /** Display name; also drives the initials + `mlvColorFromText` avatar fallback. */
  name: string;
  /** Optional avatar image URL. */
  avatarSrc?: string;
}

/** A single media/audio attachment inside a message. */
export interface MlvChatAttachment {
  /** Stable unique id (track key inside the media grid). */
  id: string;
  /** Renderer selection. */
  kind: 'image' | 'gif' | 'video' | 'audio';
  /** Media source URL (object URLs are fine while uploading). */
  src: string;
  /** Image alt text; an i18n fallback is used when absent. */
  alt?: string;
  /** Intrinsic width in px; reserves the aspect-ratio before load. */
  width?: number;
  /** Intrinsic height in px; reserves the aspect-ratio before load. */
  height?: number;
  /**
   * Duration in seconds. Shown as a chip on video cells and as the audio total.
   * Audio falls back to element metadata when absent.
   */
  duration?: number;
  /** Video poster URL; falls back to the first frame via `preload="metadata"`. */
  poster?: string;
  /** 0–100 while uploading → progress overlay; omit/undefined once done. */
  uploadProgress?: number;
}

/**
 * One chat message. The `mlv-chat` `messages` input is ordered oldest → newest.
 *
 * Named `MlvChatMessageData` because the bubble component claims the
 * `MlvChatMessage` class name.
 */
export interface MlvChatMessageData<TData = unknown> {
  /** Stable unique id (track key, animation gating, edge detection). */
  id: string;
  /** Author reference; `=== selfId` ⇒ own message (right-aligned, accent). */
  authorId: string;
  /** Plain text body. */
  text?: string;
  /** Media/audio attachments. */
  attachments?: MlvChatAttachment[];
  /** Message time; accepts Date, epoch millis, or an ISO string. */
  timestamp: Date | number | string;
  /** Delivery status; ticks are rendered on own messages only. */
  status?: MlvChatMessageStatus;
  /** Full embedded replied-to message → condensed quote render (one level deep). */
  replyTo?: MlvChatMessageData;
  /** Matches an `[mlvChatMessageDef]` `mlvChatMessageDefType` for custom rendering. */
  type?: string;
  /** Consumer payload for custom templates. */
  data?: TData;
}

/** Position of a message inside its consecutive-author group. */
export type MlvChatGroupPosition = 'single' | 'first' | 'middle' | 'last';

/** A message paired with its computed group position. */
export interface MlvChatRenderMessage {
  message: MlvChatMessageData;
  position: MlvChatGroupPosition;
}

/** Item of the flattened render list produced by {@link buildChatRenderList}. */
export type MlvChatRenderItem =
  | { kind: 'date'; id: string; date: Date }
  | { kind: 'group'; id: string; authorId: string; own: boolean; messages: MlvChatRenderMessage[] };
