import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvEditor } from '@malva-ui/editor';
import {
  MlvEditorCollaboration,
  MlvEditorCollaborationTransport,
  MlvEditorPresence,
  type MlvEditorCollaborationTransportContext,
  type MlvEditorCollaborationTransportEvent,
  type MlvEditorCollaborationUser,
} from '@malva-ui/editor/collaboration';
import { Observable } from 'rxjs';

/** Names a tab picks from, so two tabs are told apart in presence. */
const NAMES = ['Ada', 'Grace', 'Alan', 'Katherine', 'Linus', 'Barbara'];

/**
 * A reference transport over `BroadcastChannel`: every tab of this origin
 * that opens the same document id joins one channel. The channel keeps no
 * state, so `relay` is `true` and each tab pushes its full state on connect.
 * Frames are posted as binary; a text transport would use
 * `encodeMlvEditorCollaborationFrame` / `decodeMlvEditorCollaborationFrame`.
 */
class BroadcastChannelTransport extends MlvEditorCollaborationTransport {
  override readonly relay = true;

  connect(
    context: MlvEditorCollaborationTransportContext,
  ): Observable<MlvEditorCollaborationTransportEvent> {
    return new Observable((subscriber) => {
      const channel = new BroadcastChannel(
        `malva-docs-collaboration:${context.documentId}`,
      );
      channel.onmessage = (event: MessageEvent<Uint8Array>) =>
        subscriber.next({ type: 'message', data: event.data });
      // Subscribe to `outbound` before reporting `connected`: the handshake
      // is sent the moment `connected` arrives, on a hot stream.
      const outbound = context.outbound.subscribe((frame) =>
        channel.postMessage(frame),
      );
      subscriber.next({ type: 'connection', state: 'connected' });
      // Unsubscribing is the library's signal that the session ended.
      return () => {
        outbound.unsubscribe();
        channel.close();
      };
    });
  }
}

@Component({
  selector: 'docs-editor-collaboration-example-2',
  imports: [MlvEditor, MlvEditorCollaboration, MlvEditorPresence],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class DocsEditorCollaborationExample2 {
  readonly transport = new BroadcastChannelTransport();

  readonly user: MlvEditorCollaborationUser = {
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
  };

  readonly seed =
    '<p>Open this page in a second tab of the same browser, then edit in either one.</p>';
}
