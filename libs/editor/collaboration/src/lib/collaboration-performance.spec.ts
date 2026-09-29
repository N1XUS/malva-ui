import { mlvEditorDefaultExtensions } from '@malva-ui/editor';
import { getSchema } from '@tiptap/core';
import * as Y from 'yjs';
import { createMlvEditorCollaborationSeed } from './collaboration-seed';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';
import type { MemoryTransport } from './testing/memory-relay';

/*
 * U8 / R1: one remote keystroke into a 2,000-block document. What Malva adds
 * to the inbound path — the schema guard (D-F9), its ProseMirror plugins and
 * the editor's transaction handler — must stay a small share of the whole
 * path, which y-tiptap's full rebuild and upstream plugins dominate.
 *
 * No wall-clock threshold: this runs in the parallel unit suite, where a
 * contended runner stretches every sample. Both sides are measured in the
 * same run and compared as a ratio, with a wide margin: Malva's median must
 * stay under a fifth of the median total. Measured in jsdom (R1): overhead
 * about 0.05 ms at p95 against a p95 total of about 12 ms, under the 16 ms
 * that would call for inbound coalescing.
 */

const BLOCKS = 2_000;
const WARM_UP = 10;
const KEYSTROKES = 60;

/** The value at quantile `q`. */
const quantile = (values: readonly number[], q: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
};

type Fn = (...args: never[]) => unknown;

describe('MlvEditorCollaboration — inbound cost at 2,000 blocks (U8)', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  it("keeps Malva's share of a remote keystroke small", async () => {
    const hub = rig.hub('server');
    const schema = getSchema(mlvEditorDefaultExtensions({ format: 'html' }));
    const content = Array.from({ length: BLOCKS }, (_, index) => ({
      type: 'paragraph',
      content: [
        { type: 'text', text: `Paragraph ${index} with a few words in it` },
      ],
    }));
    Y.applyUpdate(
      hub.serverDoc as Y.Doc,
      createMlvEditorCollaborationSeed({ type: 'doc', content }, { schema }),
    );

    // Listeners registered before the editor attaches run before the guard,
    // the ones registered after it run after the guard.
    const host = new Y.Doc();
    let beforeGuard = 0;
    let guard = 0;
    host.on('beforeObserverCalls', () => (beforeGuard = performance.now()));
    const a = await rig.mount({ transport: hub.endpoint(), document: host });
    host.on(
      'beforeObserverCalls',
      () => (guard = performance.now() - beforeGuard),
    );
    const b = await rig.mount({ transport: hub.endpoint() });
    await rig.sync(hub);
    const editorA = tiptap(a);
    const editorB = tiptap(b);

    // Malva-owned work inside the inbound transaction.
    let owned = 0;
    const timed = <F extends Fn>(f: F): F =>
      ((...args: never[]) => {
        const start = performance.now();
        try {
          return f(...args);
        } finally {
          owned += performance.now() - start;
        }
      }) as F;
    const state = editorA.state as unknown as {
      config: { fields: { name: string; apply: Fn }[] };
      plugins: { key: string; spec: Record<string, unknown> }[];
    };
    for (const field of state.config.fields)
      if (field.name.startsWith('mlv')) field.apply = timed(field.apply);
    for (const plugin of state.plugins.filter((candidate) =>
      candidate.key.startsWith('mlv'),
    )) {
      for (const hook of ['filterTransaction', 'appendTransaction']) {
        const f = plugin.spec[hook] as Fn | undefined;
        if (f) plugin.spec[hook] = timed(f);
      }
    }
    const component = a.componentInstance.editor() as unknown as Record<
      string,
      Fn
    > & {
      transaction: { emit: Fn };
    };
    for (const method of ['_transactionOrigin', '_writeCollaborativeValue']) {
      component[method] = timed(component[method].bind(component));
    }
    component.transaction.emit = timed(
      component.transaction.emit.bind(component.transaction),
    );

    const endpointA = hub.endpoints[0] as MemoryTransport;
    const receive = endpointA._receive.bind(endpointA);
    let total = 0;
    endpointA._receive = (data: Uint8Array) => {
      const start = performance.now();
      receive(data);
      total += performance.now() - start;
    };

    const overhead: number[] = [];
    const totals: number[] = [];
    for (let index = 0; index < WARM_UP + KEYSTROKES; index++) {
      const pos = Math.floor(editorB.state.doc.content.size / 2) + (index % 7);
      editorB.view.dispatch(editorB.state.tr.insertText('x', pos));
      owned = 0;
      total = 0;
      guard = 0;
      hub.flush();
      if (index < WARM_UP) continue;
      overhead.push(owned + guard);
      totals.push(total);
    }
    await rig.settle();

    expect(editorA.getText()).toBe(editorB.getText());
    expect(totals.every((value) => value > 0)).toBe(true);
    // A same-run ratio (F3): measured about 1:200, asserted at 1:5. The
    // lower bound keeps it from passing vacuously if the timed hooks stop
    // running (overhead would read 0).
    expect(quantile(overhead, 0.5)).toBeGreaterThan(0);
    expect(quantile(overhead, 0.5)).toBeLessThan(quantile(totals, 0.5) / 5);
  }, 60_000);
});
