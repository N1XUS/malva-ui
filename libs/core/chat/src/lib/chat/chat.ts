import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  contentChild,
  contentChildren,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet, formatDate } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';
import { MLV_CHAT_I18N, MlvTranslatePipe } from '@malva-ui/i18n';
import { MlvAvatar, MlvColorFromTextPipe } from '@malva-ui/core/avatar';
import { MlvLoader } from '@malva-ui/core/loader';
import { MlvSkeleton } from '@malva-ui/core/skeleton';
import type {
  MlvChatAttachment,
  MlvChatMessageData,
  MlvChatMessageStatus,
  MlvChatUser,
} from '../chat.types';
import { buildChatRenderList, toChatDate } from '../chat-render-list';
import { MLV_CHAT_MESSAGE_DEFS, MLV_CHAT_USERS } from '../chat-tokens';
import { MlvChatMessage } from '../chat-message/chat-message';
import { MlvChatDate } from '../chat-date/chat-date';
import { MlvChatTyping } from '../chat-typing/chat-typing';
import { MlvChatAudioService } from '../chat-audio/chat-audio.service';
import { MlvChatAuthorDef } from '../defs/chat-author-def';
import { MlvChatDateDef } from '../defs/chat-date-def';
import { MlvChatMessageDef } from '../defs/chat-message-def';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';

/** Skeleton rows rendered while the first page loads. */
const SKELETON_ROWS: ReadonlyArray<{ own: boolean; width: string }> = [
  { own: false, width: '55%' },
  { own: false, width: '35%' },
  { own: true, width: '45%' },
  { own: false, width: '65%' },
  { own: true, width: '30%' },
  { own: false, width: '50%' },
];

/**
 * Scrollable chat surface. Renders an oldest→newest `messages` array as author
 * groups with date separators, delivery statuses, replies, media, and audio.
 * Grouping is computed internally — consumers only supply flat data.
 */
@Component({
  selector: 'mlv-chat',
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    MlvTranslatePipe,
    MlvAvatar,
    MlvColorFromTextPipe,
    MlvLoader,
    MlvSkeleton,
    MlvChatMessage,
    MlvChatDate,
    MlvChatTyping,
    MlvScrollbar,
  ],
  providers: [
    MlvChatAudioService,
    { provide: MLV_DENSITY_ELEMENT, useValue: 'chat' },
    { provide: MLV_CHAT_USERS, useFactory: () => inject(MlvChat)._usersMap },
    {
      provide: MLV_CHAT_MESSAGE_DEFS,
      useFactory: () => inject(MlvChat)._defsMap,
    },
  ],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  host: { class: 'mlv-chat' },
})
export class MlvChat {
  /** @private Distance from the bottom under which the view counts as pinned. */
  private static readonly _PIN_THRESHOLD = 48;

  /** @private Distance from the top under which the window grows / `loadOlder` fires. */
  private static readonly _TOP_THRESHOLD = 150;

  /** @private Number of messages the render window grows by per step. */
  private static readonly _WINDOW_STEP = 50;

  /** Messages ordered oldest → newest. */
  readonly messages = input.required<MlvChatMessageData[]>();

  /** Id of the current user; messages authored by it render as own messages. */
  readonly selfId = input.required<string>();

  /** Known participants, used for avatars and author names. */
  readonly users = input<MlvChatUser[]>([]);

  /** Renders skeleton bubbles instead of content while the first page loads. */
  readonly loading = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Shows the top loader while an older page is being fetched. */
  readonly loadingOlder = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Whether more history exists; gates the `loadOlder` output. */
  readonly hasOlder = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Ids of users currently composing a message. */
  readonly typingUsers = input<string[]>([]);

  /** Maximum gap in minutes between messages of one author group. */
  readonly groupWindow = input<number>(5);

  /** Author slot visibility; `'auto'` shows it once more than two users are known. */
  readonly showAuthors = input<'auto' | boolean>('auto');

  /** Whether calendar-day separators are rendered. */
  readonly dateSeparators = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** Number of newest messages kept in the DOM. */
  readonly windowSize = input<number>(150);

  /** Emits when the user scrolls past the oldest rendered message and more history exists. */
  readonly loadOlder = output<void>();

  /** Emits the failed message whose retry action was activated. */
  readonly retry = output<MlvChatMessageData>();

  /** Emits the message and attachment of an activated media cell. */
  readonly mediaClick = output<{
    message: MlvChatMessageData;
    attachment: MlvChatAttachment;
  }>();

  /** Emits the message and its embedded original when a reply quote is activated. */
  readonly replyClick = output<{
    message: MlvChatMessageData;
    replyTo: MlvChatMessageData;
  }>();

  /** @internal Chat i18n strings. */
  protected readonly _i18n = inject(MLV_CHAT_I18N);

  /** @internal Author slot template, when a consumer provides one. */
  protected readonly authorDef = contentChild(MlvChatAuthorDef);

  /** @internal Date separator template, when a consumer provides one. */
  protected readonly dateDef = contentChild(MlvChatDateDef);

  /** @private Custom message-type templates projected by the consumer. */
  private readonly _messageDefs = contentChildren(MlvChatMessageDef);

  /** @internal id → user map, provided to bubbles through `MLV_CHAT_USERS`. */
  readonly _usersMap = computed(
    () => new Map(this.users().map((u) => [u.id, u])),
  );

  /** @internal type → def map, provided to bubbles through `MLV_CHAT_MESSAGE_DEFS`. */
  readonly _defsMap = computed(
    () =>
      new Map(
        this._messageDefs()
          .filter((def) => def.mlvChatMessageDefType())
          .map((def) => [def.mlvChatMessageDefType(), def]),
      ),
  );

  /** @internal Number of newest messages currently rendered; grown by the scroll engine. */
  protected readonly _renderCount = signal(150);

  /** @internal Newest slice of `messages` kept in the DOM. */
  protected readonly _windowed = computed(() =>
    this.messages().slice(-this._renderCount()),
  );

  /** @internal Flattened author groups and date separators of the render window. */
  protected readonly _renderItems = computed(() =>
    buildChatRenderList(
      this._windowed(),
      this.selfId(),
      this.groupWindow(),
      this.dateSeparators(),
    ),
  );

  /** @internal Whether the author slot renders above other-authored groups. */
  protected readonly _authorsVisible = computed(() => {
    const mode = this.showAuthors();
    return mode === 'auto' ? this.users().length > 2 : mode;
  });

  /** @internal Typing users resolved against the known participants. */
  protected readonly _typingUserObjects = computed(() =>
    this.typingUsers()
      .map((id) => this._usersMap().get(id))
      .filter((user): user is MlvChatUser => !!user),
  );

  /** @internal Placeholder rows rendered while `loading` is set. */
  protected readonly _skeletonRows = SKELETON_ROWS;

  /** @internal The scroll container; measured by the scroll engine. */
  protected readonly _viewport = viewChild(MlvScrollbar);

  /** @private Inner content wrapper; its height changes drive re-pinning. */
  private readonly _content = viewChild<ElementRef<HTMLElement>>('content');

  /** @private Shared resize observer used to follow content height changes. */
  private readonly _resizeObserver = inject(MlvResizeObserverService);

  /** @internal True while the view sits at (or near) the newest message. */
  protected readonly _pinned = signal(true);

  /** @internal Messages appended while unpinned; drives the new-messages pill. */
  protected readonly _newCount = signal(0);

  /** @internal Ids of messages that arrived live, so only those animate in. */
  protected readonly _liveIds = signal<ReadonlySet<string>>(new Set());

  /** @private First/last ids of the previous `messages` value, to classify changes. */
  private _edgeIds: { first: string | null; last: string | null } = {
    first: null,
    last: null,
  };

  /** @private Distance from the viewport bottom captured before a prepend renders. */
  private _pendingCompensation: number | null = null;

  constructor() {
    // The window starts at the configured size; the scroll engine grows it as
    // the user scrolls up and trims it back once they return to the bottom.
    effect(() => this._renderCount.set(this.windowSize()));

    effect(() => {
      const list = this.messages();
      const first = list[0]?.id ?? null;
      const last = list[list.length - 1]?.id ?? null;
      const previous = this._edgeIds;
      this._edgeIds = { first, last };
      if (previous.last === null) return;

      const appended = last !== null && last !== previous.last;
      const prepended =
        first !== null && first !== previous.first && last === previous.last;

      if (prepended) this._captureCompensation();
      if (appended) {
        this._markLiveMessages(list, previous.last);
        if (this._pinned()) this._scrollToBottom('smooth');
        else this._newCount.update((count) => count + 1);
      }
    });

    afterRenderEffect(() => {
      // Re-runs whenever the rendered content changes.
      this._renderItems();
      this.loading();
      if (this._applyCompensation()) return;
      if (this._pinned()) this._stickToBottom();
    });

    // Renders alone are not enough: media can load late and `content-visibility`
    // reveals height without a change-detection pass. Following the content box
    // keeps the newest message in view in all of those cases.
    effect((onCleanup) => {
      const content = this._content()?.nativeElement;
      if (!content) return;
      const subscription = this._resizeObserver
        .observe(content)
        .subscribe(() => {
          if (this._pendingCompensation === null && this._pinned())
            this._stickToBottom();
        });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  /** @internal Re-reads the viewport metrics after a scroll event. */
  protected _onScroll(): void {
    const viewport = this._viewport()?.viewportElement;
    if (!viewport) return;
    this._evaluateScroll(
      viewport.scrollTop,
      viewport.scrollHeight,
      viewport.clientHeight,
    );
  }

  /**
   * @internal Updates pinning and top-edge behavior from raw scroll metrics.
   * Split from `_onScroll` so the logic is testable without layout.
   */
  protected _evaluateScroll(
    scrollTop: number,
    scrollHeight: number,
    clientHeight: number,
  ): void {
    const bottomDistance = scrollHeight - scrollTop - clientHeight;
    const pinned = bottomDistance < MlvChat._PIN_THRESHOLD;

    if (pinned && !this._pinned()) {
      this._newCount.set(0);
      // Trimming is invisible while the view is anchored to the newest message.
      this._renderCount.set(this.windowSize());
    }
    this._pinned.set(pinned);

    if (scrollTop < MlvChat._TOP_THRESHOLD) this._growWindow();
  }

  /** @internal Grows the render window, or asks for an older page once it is exhausted. */
  protected _growWindow(): void {
    const total = this.messages().length;
    if (this._renderCount() < total) {
      this._captureCompensation();
      this._renderCount.update((count) =>
        Math.min(count + MlvChat._WINDOW_STEP, total),
      );
      return;
    }
    if (this.hasOlder() && !this.loadingOlder()) this.loadOlder.emit();
  }

  /** @internal Scrolls to the newest message and clears the pill counter. */
  protected _scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    const viewport = this._viewport()?.viewportElement;
    this._newCount.set(0);
    this._pinned.set(true);
    if (!viewport) return;
    viewport.scrollTo?.({ top: viewport.scrollHeight, behavior });
  }

  /**
   * @private Records every message newer than the previous last id so only
   * live arrivals animate in — initial load, window growth, and prepended
   * history render instantly.
   */
  private _markLiveMessages(
    list: readonly MlvChatMessageData[],
    previousLast: string,
  ): void {
    const previousIndex = list.findIndex(
      (message) => message.id === previousLast,
    );
    const fresh = list.slice(previousIndex + 1).map((message) => message.id);
    if (!fresh.length) return;
    this._liveIds.update((ids) => {
      const next = new Set(ids);
      for (const id of fresh) next.add(id);
      return next;
    });
  }

  /** @private Records the distance from the bottom so a prepend keeps the view still. */
  private _captureCompensation(): void {
    const viewport = this._viewport()?.viewportElement;
    if (viewport)
      this._pendingCompensation = viewport.scrollHeight - viewport.scrollTop;
  }

  /**
   * @private Restores the captured distance once the taller content has rendered.
   * Returns true when a compensation was applied, so the caller skips pinning.
   */
  private _applyCompensation(): boolean {
    const pending = this._pendingCompensation;
    if (pending === null) return false;
    this._pendingCompensation = null;
    const viewport = this._viewport()?.viewportElement;
    if (viewport) viewport.scrollTop = viewport.scrollHeight - pending;
    return true;
  }

  /** @private Jumps the viewport to the newest message without animation. */
  private _stickToBottom(): void {
    const viewport = this._viewport()?.viewportElement;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }

  /** @internal Composes the accessible label of one message article. */
  protected _messageLabel(message: MlvChatMessageData, own: boolean): string {
    const author = own
      ? (this._usersMap().get(this.selfId())?.name ?? '')
      : (this._usersMap().get(message.authorId)?.name ?? '');
    const time = formatDate(
      toChatDate(message.timestamp),
      'shortTime',
      'en-US',
    );
    const status =
      own && message.status ? this._statusLabel(message.status) : '';
    return [author, time, status].filter(Boolean).join(', ');
  }

  /** @private Maps a delivery status to its translated label. */
  private _statusLabel(status: MlvChatMessageStatus): string {
    const i18n = this._i18n();
    switch (status) {
      case 'sending':
        return i18n.statusSending;
      case 'sent':
        return i18n.statusSent;
      case 'delivered':
        return i18n.statusDelivered;
      case 'read':
        return i18n.statusRead;
      case 'failed':
        return i18n.statusFailed;
    }
  }
}
