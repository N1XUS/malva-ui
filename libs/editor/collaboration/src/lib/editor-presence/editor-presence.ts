import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  ViewEncapsulation,
} from '@angular/core';
import {
  coerceBooleanProperty,
  type BooleanInput,
} from '@angular/cdk/coercion';
import { deriveInitials } from '@malva-ui/core/avatar';
import {
  MlvAvatarGroup,
  type MlvAvatarGroupMember,
} from '@malva-ui/core/avatar-group';
import {
  MlvStatusIndicator,
  type MlvStatusIndicatorTone,
} from '@malva-ui/core/status-indicator';
import type { MlvEditorCollaboration } from '../collaboration';
import {
  injectMlvEditorCollaborationMessages,
  type MlvEditorCollaborationMessageKey,
} from '../collaboration-messages';
import { mlvEditorCollaborationTint } from '../collaboration-palette';
import type { MlvEditorCollaborationStatus } from '../collaboration.types';

/** @private Status text key and indicator tone per status; `idle` shows nothing. */
const STATUS: Readonly<
  Record<
    Exclude<MlvEditorCollaborationStatus, 'idle'>,
    { key: MlvEditorCollaborationMessageKey; tone: MlvStatusIndicatorTone }
  >
> = {
  connecting: { key: 'collaborationConnecting', tone: 'warning' },
  syncing: { key: 'collaborationSyncing', tone: 'warning' },
  synced: { key: 'collaborationSynced', tone: 'success' },
  offline: { key: 'collaborationOffline', tone: 'warning' },
  closed: { key: 'collaborationClosed', tone: 'danger' },
  failed: { key: 'collaborationFailed', tone: 'danger' },
};

/**
 * Who else is in a collaborating editor, and whether its changes are synced.
 *
 * Placed by the host — in the toolbar end slot, `[mlvEditorStatus]` or a page
 * header — and bound to the directive through its `exportAs`, because
 * projected content resolves the declaration site's injector, not the
 * editor's:
 *
 * ```html
 * <mlv-editor [mlvEditorCollaboration]="transport" #collab="mlvEditorCollaboration">
 *   <mlv-editor-presence mlvEditorToolbarEnd [collaboration]="collab" />
 * </mlv-editor>
 * ```
 *
 * Renders a `role="group"` named by the `collaborationPresenceLabel` i18n key:
 * an `mlv-avatar-group` of the remote peers (a peer who only views is named
 * "{name} (viewing)"), a visually hidden peer count, and — unless `showStatus`
 * is off — a status dot with its text. While the status is `idle` (server
 * render, before the editor attaches) it renders no peers and no text, so a
 * server render never flashes "Offline". Status changes are announced by the
 * directive, not here, so they reach assistive technology without it.
 *
 * Avatar backgrounds are a pale tint of each peer's colour, so the avatar's
 * dark initials hold contrast whatever colour a peer publishes.
 */
@Component({
  selector: 'mlv-editor-presence',
  templateUrl: './editor-presence.html',
  styleUrl: './editor-presence.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAvatarGroup, MlvStatusIndicator],
  host: {
    class: 'mlv-editor-presence',
    role: 'group',
    '[attr.aria-label]': '_label()',
    '[class.mlv-editor-presence--offline]': '_status() === "offline"',
    '[class.mlv-editor-presence--failed]': '_status() === "failed"',
    '[class.mlv-editor-presence--closed]': '_status() === "closed"',
  },
})
export class MlvEditorPresence {
  /**
   * The collaborating editor's directive, through its `exportAs`
   * (`#collab="mlvEditorCollaboration"`).
   */
  readonly collaboration = input.required<MlvEditorCollaboration>();

  /** Whether the status dot and text render. Defaults to `true`. */
  readonly showStatus = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** @private Localised collaboration messages, with English fallbacks. */
  private readonly _messages = injectMlvEditorCollaborationMessages();

  /** @protected The session status. */
  protected readonly _status = computed(() => this.collaboration().status());

  /** @protected The group's accessible name. */
  protected readonly _label = computed(
    () => this._messages.templates().collaborationPresenceLabel,
  );

  /** @protected Whether anything renders: nothing while `idle`. */
  protected readonly _active = computed(() => this._status() !== 'idle');

  /**
   * @protected The remote peers as avatar-group members: a viewer named
   * "{name} (viewing)", initials from the bare name, a pale tint of the
   * peer's colour behind them.
   */
  protected readonly _members = computed<MlvAvatarGroupMember[]>(() => {
    this._messages.templates();
    return this.collaboration()
      .peers()
      .map((peer) => ({
        name:
          peer.mode === 'viewing'
            ? this._messages.format('collaborationViewing', { name: peer.name })
            : peer.name,
        initials: deriveInitials(peer.name),
        color: mlvEditorCollaborationTint(peer.color),
      }));
  });

  /** @protected The visually hidden peer count. */
  protected readonly _count = computed(() => {
    this._messages.templates();
    return this._messages.format('collaborationPeers', {
      count: this.collaboration().peers().length,
    });
  });

  /** @protected Status text and dot tone, or `null` while `idle`. */
  protected readonly _statusView = computed(() => {
    const status = this._status();
    if (status === 'idle') return null;
    const { key, tone } = STATUS[status];
    this._messages.templates();
    return { text: this._messages.format(key), tone };
  });
}
