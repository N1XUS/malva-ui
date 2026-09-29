import { Component, input, signal, viewChild, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS,
  MlvEditor,
  type MlvEditorError,
  type MlvEditorFormat,
  type MlvEditorImageUploadFailure,
  type MlvEditorImageUploadOptions,
  type MlvEditorImageUploader,
  type MlvEditorTransactionEvent,
} from '@malva-ui/editor';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import type { Editor, Extensions } from '@tiptap/core';
import type { Doc } from 'yjs';
import { MlvEditorCollaboration } from '../collaboration';
import type { MlvEditorCollaborationTransport } from '../collaboration-transport';
import type {
  MlvEditorCollaborationPeer,
  MlvEditorCollaborationStatus,
  MlvEditorCollaborationUser,
} from '../collaboration.types';
import { MlvEditorPresence } from '../editor-presence/editor-presence';
import { MemoryCollaborationHub, type MemoryTopology } from './memory-relay';

/*
 * Spec-only harness, never exported: one host component rendering a
 * collaborating `mlv-editor`, plus helpers to mount several of them.
 */

/** One collaborating editor under test. */
@Component({
  selector: 'mlv-collaboration-test-editor',
  imports: [MlvEditor, MlvEditorCollaboration, MlvEditorPresence],
  template: `
    <mlv-editor
      [format]="format()"
      [(value)]="value"
      [readonly]="readonly()"
      [disabled]="disabled()"
      [characterLimit]="characterLimit()"
      [blockIds]="blockIds()"
      [headingAnchors]="headingAnchors()"
      [extensions]="extensions()"
      [mlvEditorCollaboration]="transport()"
      #collab="mlvEditorCollaboration"
      [collaborationDocumentId]="documentId()"
      [collaborationUser]="user()"
      [collaborationInitialContent]="initialContent()"
      [collaborationDocument]="document()"
      [collaborationSyncTimeout]="syncTimeout()"
      [imageUploadOptions]="imageUploadOptions()"
      [imageUploader]="imageUploader()"
      (imageUploadFailure)="uploadFailures.push($event)"
      (editorError)="errors.push($event)"
      (editorReady)="readyCount = readyCount + 1"
      (transaction)="transactions.push($event)"
      (collaborationStatusChange)="statuses.push($event)"
      (collaborationPeersChange)="peerChanges.push($event)"
    />
    @if (presence()) {
      <mlv-editor-presence [collaboration]="collab" />
    }
  `,
})
export class CollaborationTestEditor {
  readonly transport = input.required<MlvEditorCollaborationTransport>();
  readonly documentId = input('doc-1');
  readonly user = input<MlvEditorCollaborationUser | null>(null);
  readonly initialContent = input<string | null>(null);
  readonly document = input<Doc | null>(null);
  readonly format = input<MlvEditorFormat>('html');
  readonly syncTimeout = input(10_000);
  readonly characterLimit = input<number | null>(null);
  readonly blockIds = input(false);
  readonly headingAnchors = input(false);
  readonly extensions = input<Extensions | undefined>(undefined);
  readonly imageUploader = input<MlvEditorImageUploader | undefined>(undefined);
  readonly uploadFailures: MlvEditorImageUploadFailure[] = [];
  readonly imageUploadOptions = input<MlvEditorImageUploadOptions>(
    MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS,
  );
  /** Renders `mlv-editor-presence` after the editor. */
  readonly presence = input(false);
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly value = signal<string | null>(null);
  readonly errors: MlvEditorError[] = [];
  readonly transactions: MlvEditorTransactionEvent[] = [];
  readonly statuses: MlvEditorCollaborationStatus[] = [];
  readonly peerChanges: (readonly MlvEditorCollaborationPeer[])[] = [];
  readyCount = 0;
  readonly editor = viewChild.required(MlvEditor);
  readonly collaboration = viewChild.required(MlvEditorCollaboration);
}

/** Inputs a mounted test editor starts with. */
export interface CollaborationTestEditorInputs {
  readonly transport: MlvEditorCollaborationTransport;
  readonly documentId?: string;
  readonly user?: MlvEditorCollaborationUser | null;
  readonly initialContent?: string | null;
  readonly document?: Doc | null;
  readonly format?: MlvEditorFormat;
  readonly syncTimeout?: number;
  readonly characterLimit?: number | null;
  readonly blockIds?: boolean;
  readonly headingAnchors?: boolean;
  readonly extensions?: Extensions;
  readonly imageUploadOptions?: MlvEditorImageUploadOptions;
  readonly imageUploader?: MlvEditorImageUploader;
  readonly presence?: boolean;
  /** The model value the host starts with (not an input: the two-way model). */
  readonly value?: string | null;
}

/** Configures TestBed for collaboration specs. */
export async function configureCollaborationTestBed(
  extra: Type<unknown>[] = [],
): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [CollaborationTestEditor, ...extra],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
}

/** Mounts one collaborating editor and waits for it to render. */
export async function mountCollaborationEditor(
  inputs: CollaborationTestEditorInputs,
): Promise<ComponentFixture<CollaborationTestEditor>> {
  const fixture = TestBed.createComponent(CollaborationTestEditor);
  for (const [key, value] of Object.entries(inputs)) {
    if (value === undefined) continue;
    if (key === 'value')
      fixture.componentInstance.value.set(value as string | null);
    else fixture.componentRef.setInput(key, value);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

/** Lets effects, microtask delivery and change detection settle. */
export async function settle(
  ...fixtures: ComponentFixture<unknown>[]
): Promise<void> {
  for (let round = 0; round < 4; round++) {
    await Promise.resolve();
    for (const fixture of fixtures) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }
}

/** The Tiptap editor a mounted test editor created. Throws when there is none. */
export function tiptap(
  fixture: ComponentFixture<CollaborationTestEditor>,
): Editor {
  const editor = fixture.componentInstance.editor().editor();
  if (!editor) throw new Error('the test editor created no Tiptap editor');
  return editor;
}

/** Owns the hubs and editors of one spec, and tears them all down. */
export class CollaborationRig {
  /** Every editor mounted, in order. */
  readonly fixtures: ComponentFixture<CollaborationTestEditor>[] = [];
  /** @private Every hub created. */
  private readonly _hubs: MemoryCollaborationHub[] = [];

  /** Creates a hub the rig destroys. */
  hub(
    topology: MemoryTopology,
    options: { latency?: number; autoConnect?: boolean } = {},
  ): MemoryCollaborationHub {
    const hub = new MemoryCollaborationHub(topology, options);
    this._hubs.push(hub);
    return hub;
  }

  /** Mounts an editor the rig destroys. */
  async mount(
    inputs: CollaborationTestEditorInputs,
  ): Promise<ComponentFixture<CollaborationTestEditor>> {
    const fixture = await mountCollaborationEditor(inputs);
    this.fixtures.push(fixture);
    return fixture;
  }

  /** Delivers every frame and settles, until nothing is left in flight. */
  async sync(hub: MemoryCollaborationHub): Promise<void> {
    for (let round = 0; round < 3; round++) {
      hub.flush();
      await settle(...this.fixtures);
    }
  }

  /** Settles every mounted editor. */
  async settle(): Promise<void> {
    await settle(...this.fixtures);
  }

  /** Destroys every editor, then every hub. */
  destroy(): void {
    this.fixtures.splice(0).forEach((fixture) => fixture.destroy());
    this._hubs.splice(0).forEach((hub) => hub.destroy());
  }
}
