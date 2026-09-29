import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { MlvEditor } from '@malva-ui/editor';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { NEVER, type Observable } from 'rxjs';
import { MlvEditorCollaboration } from './collaboration';
import {
  MlvEditorCollaborationTransport,
  type MlvEditorCollaborationTransportEvent,
} from './collaboration-transport';
import type { MlvEditorCollaborationStatus } from './collaboration.types';
import { MlvEditorPresence } from './editor-presence/editor-presence';

/*
 * U7: on the server the directive creates nothing — no session, no Y.Doc, no
 * awareness (whose 15 s renewal is a `setInterval`), no transport
 * connection — and the editor shell renders as it does without it.
 */

/** Counts connections; never emits. */
class SpyTransport extends MlvEditorCollaborationTransport {
  connections = 0;

  connect(): Observable<MlvEditorCollaborationTransportEvent> {
    this.connections++;
    return NEVER;
  }
}

const transport = new SpyTransport();
const statuses: MlvEditorCollaborationStatus[] = [];

@Component({
  selector: 'mlv-collaboration-ssr-host',
  imports: [MlvEditor, MlvEditorCollaboration, MlvEditorPresence],
  template: `
    <mlv-editor
      #collaboration="mlvEditorCollaboration"
      label="Body"
      [mlvEditorCollaboration]="transport"
      collaborationDocumentId="doc-1"
      collaborationInitialContent="<p>Seed</p>"
      (collaborationStatusChange)="statuses.push($event)"
    />
    <output data-status>{{ collaboration.status() }}</output>
    <output data-document>{{ collaboration.document() === null }}</output>
    <output data-peers>{{ collaboration.peers().length }}</output>
    <mlv-editor-presence [collaboration]="collaboration" />
  `,
})
class CollaborationSsrHost {
  readonly transport = transport;
  readonly statuses = statuses;
}

describe('MlvEditorCollaboration on the server (U7)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the shell and creates no session, document, timer or connection', async () => {
    const intervals = vi.spyOn(globalThis, 'setInterval');
    const html = await renderApplication(
      (context) =>
        bootstrapApplication(
          CollaborationSsrHost,
          { providers: [provideMlvI18nTesting()] },
          context,
        ),
      {
        document: '<mlv-collaboration-ssr-host></mlv-collaboration-ssr-host>',
        url: '/',
      },
    );

    expect(html).toContain('<mlv-editor');
    expect(html).toContain('mlv-form-control-wrapper');
    expect(html).not.toContain('ProseMirror');
    // The seed stays an (escaped) attribute; it is never rendered as content.
    expect(html).not.toContain('<p>Seed</p>');
    expect(html).toContain('<output data-status="">idle</output>');
    expect(html).toContain('<output data-document="">true</output>');
    expect(html).toContain('<output data-peers="">0</output>');
    // F-D21: presence server-renders idle — a named group, no peers, no text.
    const presence =
      /<mlv-editor-presence[^>]*>([\s\S]*?)<\/mlv-editor-presence>/.exec(html);
    expect(presence?.[0]).toContain('role="group"');
    expect(presence?.[0]).toContain('aria-label="Collaborators"');
    expect(presence?.[1].replace(/<!--[\s\S]*?-->/g, '').trim()).toBe('');
    expect(transport.connections).toBe(0);
    expect(statuses).toEqual([]);
    expect(intervals).not.toHaveBeenCalled();
  });
});
