import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { vi } from 'vitest';
import type { MlvEditorError } from './editor.types';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_UPLOAD_ABORT_REGISTRY,
  type MlvEditorOverlayRegistry,
  type MlvEditorToolbarContext,
  type MlvEditorUploadAbortRegistry,
} from './editor-toolbar-context';
import { MlvEditor } from './editor/editor';

@Component({
  imports: [MlvEditor],
  template: '<mlv-editor [readonly]="readonly()" />',
})
class ContextHost {
  readonly editor = viewChild.required(MlvEditor);
  readonly readonly = signal(false);
}

describe('MlvEditorToolbarContext', () => {
  async function createHost() {
    await TestBed.configureTestingModule({
      imports: [ContextHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ContextHost);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, host: fixture.componentInstance };
  }

  it('is editor-scoped and runs available commands safely', async () => {
    const { fixture, host } = await createHost();
    const context = fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_TOOLBAR_CONTEXT) as MlvEditorToolbarContext;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected the editor to be created.');

    expect(context.editor()).toBe(editor);
    expect(context.run((instance) => instance.commands.toggleBold())).toBe(
      true,
    );
    expect(context.isActive('bold')).toBe(true);
    expect(context.can((instance) => instance.can().toggleBold())).toBe(true);
    expect(context.focused()).toBe(false);
    expect(context.editable()).toBe(true);

    const errors: MlvEditorError[] = [];
    host.editor().editorError.subscribe((error) => errors.push(error));
    const reported: MlvEditorError = {
      code: 'unsupported-command',
      message: 'Consumer command failed.',
      recoverable: true,
    };
    context.reportError(reported);
    expect(errors).toEqual([reported]);

    (
      fixture.nativeElement.querySelector('.ProseMirror') as HTMLElement
    ).focus();
    expect(context.focused()).toBe(true);

    host.readonly.set(true);
    fixture.detectChanges();
    expect(context.editable()).toBe(false);
  });

  it('returns false rather than throwing for unavailable commands or no editor', async () => {
    const { fixture } = await createHost();
    const context = fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_TOOLBAR_CONTEXT) as MlvEditorToolbarContext;

    expect(
      context.run(() => {
        throw new Error('missing command');
      }),
    ).toBe(false);
    expect(
      context.can(() => {
        throw new Error('missing command');
      }),
    ).toBe(false);
    expect(context.isActive('does-not-exist')).toBe(false);
    fixture.destroy();
    expect(context.run(() => true)).toBe(false);
    expect(context.can(() => true)).toBe(false);
  });

  it('isolates context zoom and internal cleanup registries per editor', async () => {
    @Component({
      imports: [MlvEditor],
      template: '<mlv-editor /><mlv-editor />',
    })
    class TwoEditorsHost {}

    await TestBed.configureTestingModule({
      imports: [TwoEditorsHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(TwoEditorsHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const editors = fixture.debugElement.queryAll(By.directive(MlvEditor));
    const first = editors[0].injector.get(
      MLV_EDITOR_TOOLBAR_CONTEXT,
    ) as MlvEditorToolbarContext;
    const second = editors[1].injector.get(
      MLV_EDITOR_TOOLBAR_CONTEXT,
    ) as MlvEditorToolbarContext;
    const firstOverlays = editors[0].injector.get(
      MLV_EDITOR_OVERLAY_REGISTRY,
    ) as MlvEditorOverlayRegistry;
    const secondOverlays = editors[1].injector.get(
      MLV_EDITOR_OVERLAY_REGISTRY,
    ) as MlvEditorOverlayRegistry;
    const firstUploads = editors[0].injector.get(
      MLV_EDITOR_UPLOAD_ABORT_REGISTRY,
    ) as MlvEditorUploadAbortRegistry;
    const secondUploads = editors[1].injector.get(
      MLV_EDITOR_UPLOAD_ABORT_REGISTRY,
    ) as MlvEditorUploadAbortRegistry;

    first.zoom.set(125);
    expect(second.zoom()).toBe(100);
    expect(first.editor()).not.toBe(second.editor());
    expect(firstOverlays).not.toBe(secondOverlays);
    expect(firstUploads).not.toBe(secondUploads);
  });

  it('makes duplicate overlay registration idempotent and continues cleanup after a close failure', async () => {
    const { fixture } = await createHost();
    const overlays = fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_OVERLAY_REGISTRY) as MlvEditorOverlayRegistry;
    const one = document.createElement('div');
    const two = document.createElement('div');
    const failedClose = vi.fn(() => {
      throw new Error('close failed');
    });
    const secondClose = vi.fn();
    document.body.append(one, two);
    overlays.register(one, failedClose);
    overlays.register(one, failedClose);
    overlays.register(two, secondClose);

    expect(() => overlays.closeAll()).not.toThrow();
    expect(failedClose).toHaveBeenCalledTimes(1);
    expect(secondClose).toHaveBeenCalledTimes(1);
    one.remove();
    two.remove();
  });
});

/**
 * Roving-registry invalidation cost.
 *
 * The registry's single source of DOM truth is `_enabled()`, whose only DOM
 * read is `closest('[hidden]')` — and it is the sole caller of that selector in
 * library source. (Fifteen further call sites live in five spec files elsewhere
 * under `libs/`, none of them in this one, and the monkeypatch below is
 * installed and removed around a single `act()` window — so none are in scope.)
 * Counting those calls therefore measures exactly the registry's own DOM work
 * across one invalidation, with no coupling to a private member name.
 */
describe('MlvEditorToolbarRovingRegistry invalidation cost', () => {
  @Component({
    imports: [MlvEditor],
    template: '<mlv-editor [disabled]="disabled()" />',
  })
  class RovingHost {
    readonly disabled = signal(false);
  }

  /**
   * Counts `closest('[hidden]')` calls — the registry's only DOM read — while
   * `act` runs and the resulting change detection settles.
   */
  async function countHiddenLookups(
    fixture: ComponentFixture<unknown>,
    act: () => void,
  ): Promise<number> {
    const realClosest = Element.prototype.closest;
    let calls = 0;
    Element.prototype.closest = function (this: Element, selector: string) {
      if (selector === '[hidden]') calls++;
      return realClosest.call(this, selector) as Element | null;
    } as typeof Element.prototype.closest;
    try {
      act();
      for (let pass = 0; pass < 3; pass++) {
        fixture.detectChanges();
        await fixture.whenStable();
      }
    } finally {
      Element.prototype.closest = realClosest;
    }
    return calls;
  }

  async function createRovingHost() {
    await TestBed.configureTestingModule({
      imports: [RovingHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(RovingHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('derives the enabled-widget order once per invalidation, not once per widget', async () => {
    const fixture = await createRovingHost();
    const widgetCount = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.mlv-editor-toolbar [tabindex]',
    ).length;
    // The built-in toolbar registers ~21 widgets; the guard is written against
    // whatever this build actually renders so it cannot rot into a tautology.
    expect(widgetCount).toBeGreaterThan(10);

    // Disabling the editor writes `disabled`/`aria-disabled` on every command
    // button. Those are observed attributes, so the batch lands as ONE
    // MutationObserver callback and ONE `_domStateRevision` bump — but it also
    // disables the widget that currently owns the tab stop, which sends every
    // widget's `isActive()` down the "recompute the enabled order" branch.
    //
    // Derivation. Resolving the tab stop needs the enabled widget list, which
    // costs one `closest('[hidden]')` per widget: N walks per derivation.
    // Derived once inside every widget's `isActive()`, the transition costs
    // `(≈2N + c) derivations × N` — `isActive()` runs for all N widgets in each
    // of ~2 change-detection passes — which measures 44 derivations and 924
    // walks at N=21 with only the `computed()` removed from the registry, and
    // 841 walks on the code that preceded it. Note this is ~2N^2, not N^2:
    // N^2 at N=21 is 441.
    //
    // Memoized it is one derivation, so the measured value is exactly N. The
    // band below is one derivation wide in each direction:
    //
    // - the ceiling is 2N, not 4N. At 4N a change that tripled derivations per
    //   invalidation (63 walks — a second `_enabledWidgets()` read on a
    //   per-CD-pass path, or a spurious memo dependency recomputing per pass on
    //   top of the observer callback) would still pass. 2N leaves room for
    //   jsdom change-detection-pass variance and nothing else.
    // - the floor is N, and it is not decoration. `toBeLessThanOrEqual` is
    //   satisfied by zero, so if `_enabled()` ever stops calling
    //   `closest('[hidden]')` — `checkVisibility()`, a hand-rolled parent walk,
    //   a cached hidden ancestor — the monkeypatch would count nothing and this
    //   test would measure nothing while staying green.
    const lookups = await countHiddenLookups(fixture, () => {
      fixture.componentInstance.disabled.set(true);
    });

    expect(lookups).toBeGreaterThanOrEqual(widgetCount);
    expect(lookups).toBeLessThanOrEqual(2 * widgetCount);
  });

  it('keeps exactly one tab stop across a disable and re-enable cycle', async () => {
    const fixture = await createRovingHost();
    const tabStops = () =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll(
          '.mlv-editor-toolbar [tabindex="0"]',
        ),
      );

    expect(tabStops()).toHaveLength(1);

    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(tabStops()).toHaveLength(0);

    fixture.componentInstance.disabled.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(tabStops()).toHaveLength(1);
  });

  /**
   * Characterization, not a regression: this passes before and after the
   * memoization above. It pins the platform behaviour that makes a manual
   * microtask debounce on this observer pointless — `MutationObserver` already
   * delivers one callback per microtask checkpoint carrying every record
   * accumulated since the last delivery, so N mutations in one turn are already
   * one invalidation. Mutations spread across separate microtasks are not
   * merged by a `queueMicrotask` debounce either: each already lands in its own
   * turn, which is where such a debounce flushes.
   *
   * The argument that does not depend on finding every interleaving is the memo
   * above: after it, a redundant invalidation costs exactly one derivation (N
   * walks, 21 here), so even a coalescer that did merge something would save
   * ~nothing and would pay for it with a turn of tab-stop staleness. Anyone
   * tempted to add a `queueMicrotask` coalescer here should read both.
   */
  it('coalesces a whole batch of observed mutations into one invalidation', async () => {
    const fixture = await createRovingHost();
    const root = (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-editor-toolbar',
    ) as HTMLElement;
    const buttons = Array.from(root.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(10);

    let callbacks = 0;
    let records = 0;
    const observer = new MutationObserver((batch) => {
      callbacks++;
      records += batch.length;
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['aria-disabled', 'disabled', 'hidden'],
      childList: true,
      subtree: true,
    });

    for (const button of buttons) button.setAttribute('aria-disabled', 'true');
    await fixture.whenStable();

    observer.disconnect();
    expect(records).toBe(buttons.length);
    expect(callbacks).toBe(1);
  });
});
