import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvSwitch } from '@malva-ui/core/switch';
import { MlvEditor } from '@malva-ui/editor';
import {
  MlvEditorCollaboration,
  MlvEditorCollaborationTransport,
  MlvEditorPresence,
  type MlvEditorCollaborationTransportContext,
  type MlvEditorCollaborationTransportEvent,
} from '@malva-ui/editor/collaboration';
import { Observable } from 'rxjs';

/** Simulated one-way network latency, so remote carets visibly travel. */
const LATENCY_MS = 120;

/** One connected editor, as the relay sees it. */
interface RelayPeer {
  deliver(frame: Uint8Array): void;
}

/**
 * An in-page fan-out: every frame one editor sends reaches every other editor
 * on the page. It holds no Yjs state — exactly like a pub/sub channel — so the
 * transports declare `relay = true` and push their full state on connect.
 */
class LocalRelay {
  private readonly _peers = new Set<RelayPeer>();

  join(peer: RelayPeer): () => void {
    this._peers.add(peer);
    return () => this._peers.delete(peer);
  }

  broadcast(from: RelayPeer, frame: Uint8Array): void {
    for (const peer of this._peers) {
      if (peer !== from) setTimeout(() => peer.deliver(frame), LATENCY_MS);
    }
  }
}

/**
 * A reference `MlvEditorCollaborationTransport`: the library encodes every
 * frame, the transport only moves bytes. `setOnline(false)` models a dropped
 * network — a transient `disconnected`, never an error — so the editor keeps
 * working offline and syncs when the link returns.
 */
class LocalRelayTransport extends MlvEditorCollaborationTransport {
  override readonly relay = true;

  private _online = true;
  private _emit:
    | ((event: MlvEditorCollaborationTransportEvent) => void)
    | null = null;

  constructor(private readonly _relay: LocalRelay) {
    super();
  }

  connect(
    context: MlvEditorCollaborationTransportContext,
  ): Observable<MlvEditorCollaborationTransportEvent> {
    return new Observable((subscriber) => {
      const peer: RelayPeer = {
        deliver: (data) => {
          if (this._online && !subscriber.closed)
            subscriber.next({ type: 'message', data });
        },
      };
      this._emit = (event) => subscriber.next(event);
      const leave = this._relay.join(peer);
      // Subscribe to `outbound` before reporting `connected`: the handshake
      // is sent the moment `connected` arrives, on a hot stream.
      const outbound = context.outbound.subscribe((frame) => {
        if (this._online) this._relay.broadcast(peer, frame);
      });
      subscriber.next({
        type: 'connection',
        state: this._online ? 'connected' : 'disconnected',
      });
      return () => {
        outbound.unsubscribe();
        leave();
        this._emit = null;
      };
    });
  }

  setOnline(online: boolean): void {
    this._online = online;
    this._emit?.({
      type: 'connection',
      state: online ? 'connected' : 'disconnected',
    });
  }
}

@Component({
  selector: 'docs-editor-collaboration-example-1',
  imports: [MlvEditor, MlvEditorCollaboration, MlvEditorPresence, MlvSwitch],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class DocsEditorCollaborationExample1 {
  private readonly _relay = new LocalRelay();

  readonly seed =
    '<h2>Launch plan</h2><p>Type on either side: the other editor follows, with a named caret for each collaborator.</p>';

  readonly ada = new LocalRelayTransport(this._relay);
  readonly grace = new LocalRelayTransport(this._relay);

  readonly adaOnline = signal(true);
  readonly graceOnline = signal(true);

  setOnline(side: 'ada' | 'grace', online: boolean): void {
    (side === 'ada' ? this.adaOnline : this.graceOnline).set(online);
    this[side].setOnline(online);
  }
}
