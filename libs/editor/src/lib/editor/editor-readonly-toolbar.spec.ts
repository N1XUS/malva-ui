import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Editor } from '@tiptap/core';
import { vi } from 'vitest';
import {
  MlvEditorToolbarDef,
  MlvEditorToolbarStartDef,
  MlvEditorToolbarWidget,
} from '../..';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  type MlvEditorOverlayRegistry,
} from '../editor-toolbar-context';
import type {
  MlvEditorToolbarAppearance,
  MlvEditorToolbarPosition,
} from '../editor.types';
import { MlvEditor } from './editor';

/**
 * #498 owner ruling: a `readonly` editor renders no toolbar, in either
 * appearance. The docked bar is torn down while `readonly` and re-stamped on
 * the way back; the selection bubble keeps its hidden pane but stamps no band.
 */
@Component({
  imports: [MlvEditor, MlvEditorToolbarStartDef, MlvEditorToolbarWidget],
  template: `
    <mlv-editor
      label="Readonly toolbar"
      [value]="value()"
      [readonly]="readonly()"
      [disabled]="disabled()"
      [maxHeight]="maxHeight()"
      [toolbarPosition]="position()"
      [toolbarAppearance]="appearance()"
      [toolbarSticky]="sticky()"
      (blur)="blurs.update((count) => count + 1)"
      (touch)="touches.update((count) => count + 1)"
    >
      <button
        mlvEditorToolbarStart
        mlvEditorToolbarWidget
        type="button"
        data-projected-start
      >
        Projected
      </button>
    </mlv-editor>
  `,
})
class ReadonlyToolbarHost {
  readonly value = signal<string | null>('<p>Alpha beta</p><p>Gamma</p>');
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly maxHeight = signal<number | undefined>(undefined);
  readonly position = signal<MlvEditorToolbarPosition>('top');
  readonly appearance = signal<MlvEditorToolbarAppearance>('bar');
  readonly sticky = signal(false);
  readonly blurs = signal(0);
  readonly touches = signal(0);
  readonly editor = viewChild.required(MlvEditor);
  readonly hostElement = viewChild.required(MlvEditor, { read: ElementRef });
}

/** A complete consumer toolbar replacement (`[mlvEditorToolbar]`). */
@Component({
  imports: [MlvEditor, MlvEditorToolbarDef, MlvEditorToolbarWidget],
  template: `
    <mlv-editor label="Custom toolbar" [readonly]="readonly()">
      <ng-template mlvEditorToolbar>
        <button mlvEditorToolbarWidget type="button" data-custom-command>
          Copy
        </button>
      </ng-template>
    </mlv-editor>
  `,
})
class CustomToolbarHost {
  readonly readonly = signal(false);
}

interface Harness {
  fixture: ComponentFixture<ReadonlyToolbarHost>;
  host: ReadonlyToolbarHost;
  root: HTMLElement;
  editor: Editor;
  content: HTMLElement;
  settle(): Promise<void>;
}

async function createHost(
  configure?: (host: ReadonlyToolbarHost) => void,
): Promise<Harness> {
  await TestBed.configureTestingModule({
    imports: [ReadonlyToolbarHost],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(ReadonlyToolbarHost);
  configure?.(fixture.componentInstance);
  fixture.detectChanges();
  await fixture.whenStable();
  const host = fixture.componentInstance;
  const root = fixture.nativeElement as HTMLElement;
  const editor = host.editor().editor();
  if (!editor) throw new Error('Expected a mounted Tiptap editor.');
  const settle = async () => {
    // The composite blur check resolves on a microtask, the bubble on the
    // next render.
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  await settle();
  return {
    fixture,
    host,
    root,
    editor,
    content: root.querySelector('.ProseMirror') as HTMLElement,
    settle,
  };
}

/** Every toolbar band in the document: under the editor or in the bubble's pane. */
function bands(): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>('.mlv-editor__toolbar-band'),
  ];
}

/** The one band the editor currently stamps. */
function band(): HTMLElement {
  const [only, ...rest] = bands();
  if (!only || rest.length) {
    throw new Error(`Expected one toolbar band, found ${bands().length}.`);
  }
  return only;
}

/** The surface's element children, in DOM order, as class-ish labels. */
function surfaceLayout(root: HTMLElement): string[] {
  const surface = root.querySelector('.mlv-editor__surface') as HTMLElement;
  return [...surface.children].map((child) =>
    child.classList.contains('mlv-editor__toolbar-band')
      ? 'band'
      : child.classList.contains('mlv-editor__viewport')
        ? 'viewport'
        : child.tagName.toLowerCase(),
  );
}

/** ProseMirror's resolved scroll prop, copied out of the live getter object. */
function scrollSides(
  editor: Editor,
  name: 'scrollMargin' | 'scrollThreshold',
): { top: number; right: number; bottom: number; left: number } {
  const value = editor.view.someProp(name) as {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  return {
    top: value.top,
    right: value.right,
    bottom: value.bottom,
    left: value.left,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MlvEditor readonly toolbar (#498)', () => {
  it('renders no toolbar band while readonly, in either appearance, position and cap', async () => {
    const { host, root, settle } = await createHost();
    for (const appearance of ['bar', 'floating'] as const) {
      for (const position of ['top', 'bottom'] as const) {
        for (const maxHeight of [undefined, 240]) {
          const label = `${appearance} / ${position} / cap ${maxHeight}`;
          host.appearance.set(appearance);
          host.position.set(position);
          host.maxHeight.set(maxHeight);
          host.readonly.set(false);
          await settle();
          expect(bands(), label).toHaveLength(1);

          host.readonly.set(true);
          await settle();
          expect(bands(), label).toHaveLength(0);
          expect(
            document.querySelectorAll('[role="toolbar"]'),
            label,
          ).toHaveLength(0);
          // No slot is kept for the missing band: the viewport opens the
          // surface and the upload status follows it directly.
          expect(surfaceLayout(root), label).toEqual([
            'viewport',
            'mlv-editor-image-upload-status',
          ]);
        }
      }
    }
  }, 30_000);

  it('re-stamps the bar on the way back to editable, in its position, with projected content re-attached', async () => {
    const { host, root, settle } = await createHost();
    const projected = root.querySelector('[data-projected-start]');
    expect(projected?.closest('.mlv-editor__toolbar-band')).toBe(band());
    const tabStops = () =>
      [...band().querySelectorAll<HTMLElement>('button, [tabindex]')]
        .filter(
          (element) => element.tabIndex >= 0 && !element.closest('[hidden]'),
        )
        .map(
          (element) =>
            element.getAttribute('aria-label') ?? element.textContent?.trim(),
        );
    const stopsBefore = tabStops();
    expect(stopsBefore).toHaveLength(1);

    host.readonly.set(true);
    await settle();
    expect(bands()).toHaveLength(0);

    host.readonly.set(false);
    await settle();
    expect(surfaceLayout(root)).toEqual([
      'band',
      'viewport',
      'mlv-editor-image-upload-status',
    ]);
    const restored = root.querySelector('[data-projected-start]');
    expect(restored).toBe(projected);
    expect(restored?.closest('.mlv-editor__toolbar-band')).toBe(band());
    // The re-created toolbar is one roving tab stop again, on the same control.
    expect(tabStops()).toEqual(stopsBefore);

    host.position.set('bottom');
    host.readonly.set(true);
    await settle();
    expect(bands()).toHaveLength(0);
    host.readonly.set(false);
    await settle();
    expect(surfaceLayout(root)).toEqual([
      'viewport',
      'band',
      'mlv-editor-image-upload-status',
    ]);
  });

  it('drops the sticky modifier and keeps ProseMirror scroll defaults while readonly, then clears the band again', async () => {
    const { host, root, editor, settle } = await createHost((h) =>
      h.sticky.set(true),
    );
    const hostElement = host.hostElement().nativeElement as HTMLElement;
    // jsdom lays nothing out: give whichever band exists a 45px block size.
    const measure = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return this.classList.contains('mlv-editor__toolbar-band')
          ? new DOMRect(0, 0, 600, 45)
          : measure.call(this);
      },
    );

    expect(hostElement.classList).toContain('mlv-editor--toolbar-sticky');
    expect(scrollSides(editor, 'scrollMargin').top).toBe(50);
    expect(scrollSides(editor, 'scrollThreshold').top).toBe(45);

    host.readonly.set(true);
    await settle();
    expect(bands()).toHaveLength(0);
    expect(hostElement.classList).not.toContain('mlv-editor--toolbar-sticky');
    expect(scrollSides(editor, 'scrollMargin')).toEqual({
      top: 5,
      right: 5,
      bottom: 5,
      left: 5,
    });
    expect(scrollSides(editor, 'scrollThreshold')).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });

    host.position.set('bottom');
    await settle();
    expect(scrollSides(editor, 'scrollMargin').bottom).toBe(5);
    expect(scrollSides(editor, 'scrollThreshold').bottom).toBe(0);

    host.readonly.set(false);
    await settle();
    expect(hostElement.classList).toContain('mlv-editor--toolbar-sticky');
    expect(scrollSides(editor, 'scrollMargin').bottom).toBe(50);
    expect(scrollSides(editor, 'scrollThreshold').bottom).toBe(45);
    expect(root.querySelector('.mlv-editor__toolbar-band')).not.toBeNull();
  });

  it('returns focus from the bar to the content with the selection intact when readonly turns on', async () => {
    const { host, root, editor, content, settle } = await createHost();
    content.focus();
    editor.commands.setTextSelection({ from: 1, to: 6 });
    await settle();
    const projected = root.querySelector<HTMLElement>('[data-projected-start]');
    projected?.focus();
    await settle();
    expect(document.activeElement).toBe(projected);

    host.readonly.set(true);
    await settle();
    expect(bands()).toHaveLength(0);
    expect(document.activeElement).toBe(content);
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.selection.to).toBe(6);
    // Focus never left the composite.
    expect(host.editor().focused()).toBe(true);
    expect(host.blurs()).toBe(0);
    expect(host.touches()).toBe(0);
  });

  it('closes an open toolbar popup when readonly turns on, focus returning from it to the content', async () => {
    const { host, content, settle } = await createHost();
    content.focus();
    await settle();
    // Zoom stayed usable while readonly before #498, so nothing else closed it.
    const trigger = band().querySelector<HTMLButtonElement>(
      '.mlv-editor-zoom button[aria-haspopup="dialog"]',
    );
    if (!trigger) throw new Error('Expected the zoom popup trigger.');
    trigger.focus();
    trigger.click();
    await settle();
    const popupFocus = document.activeElement;
    expect(popupFocus?.closest('.mlv-popup')).not.toBeNull();
    expect(band().contains(popupFocus)).toBe(false);

    host.readonly.set(true);
    await settle();
    expect(bands()).toHaveLength(0);
    expect(document.activeElement).toBe(content);
    expect(popupFocus?.isConnected).toBe(false);
    expect(host.editor().focused()).toBe(true);
    expect(host.blurs()).toBe(0);
  });

  it('asks every other editor-owned popup to close and moves focus out of one, leaving its registration to its owner', async () => {
    const { fixture, host, content, settle } = await createHost();
    const registry = fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_OVERLAY_REGISTRY) as MlvEditorOverlayRegistry;
    // A popup outside the band (the table-controls menu, a link panel) is a
    // registered root in an overlay pane of its own.
    const pane = document.createElement('div');
    pane.className = 'cdk-overlay-pane';
    const popup = document.createElement('button');
    pane.append(popup);
    document.body.append(pane);
    const close = vi.fn();
    const release = registry.register(popup, close);
    try {
      content.focus();
      await settle();
      popup.focus();
      await settle();
      expect(host.editor().focused()).toBe(true);

      host.readonly.set(true);
      await settle();
      expect(close).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(content);
      expect(host.blurs()).toBe(0);
      // `closeOthers()`, not `closeAll()`: the owner releases its own entry.
      expect(registry.contains(popup)).toBe(true);
    } finally {
      release();
      pane.remove();
    }
  });

  it('lets a simultaneous disabled flip win: focus is removed from the editor, not moved to the content', async () => {
    const { host, root, settle } = await createHost();
    const projected = root.querySelector<HTMLElement>('[data-projected-start]');
    projected?.focus();
    await settle();

    host.disabled.set(true);
    host.readonly.set(true);
    await settle();
    // Pins the disabled branch's precedence inside the one effect: it has
    // removed focus before the readonly branch runs. The readonly branch's own
    // `computedDisabled()` guard is pinned by the next spec, not this one.
    expect(bands()).toHaveLength(0);
    expect(root.contains(document.activeElement)).toBe(false);
    expect(host.editor().focused()).toBe(false);
    expect(host.blurs()).toBe(0);
    expect(host.touches()).toBe(0);
  });

  it('moves no focus into an editor that was already disabled when readonly turns on', async () => {
    const { host, content, root, settle } = await createHost();
    host.disabled.set(true);
    await settle();
    // A projected consumer control is the consumer's own and stays focusable
    // in a disabled editor, so focus can still be in the band here.
    const projected = root.querySelector<HTMLElement>('[data-projected-start]');
    projected?.focus();
    await settle();
    expect(document.activeElement).toBe(projected);

    host.readonly.set(true);
    await settle();
    expect(bands()).toHaveLength(0);
    expect(document.activeElement).not.toBe(content);
    expect(host.editor().focused()).toBe(false);
  });

  it('hides a complete consumer toolbar too (assumption pending an owner answer on #498)', async () => {
    await TestBed.configureTestingModule({
      imports: [CustomToolbarHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(CustomToolbarHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-custom-command]')).not.toBeNull();

    fixture.componentInstance.readonly.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root.querySelector('[data-custom-command]')).toBeNull();
    expect(bands()).toHaveLength(0);

    fixture.componentInstance.readonly.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root.querySelector('[data-custom-command]')).not.toBeNull();
  });

  it('has no axe violations while readonly, in either appearance and position', async () => {
    const { host, root, content, editor, settle } = await createHost((h) =>
      h.readonly.set(true),
    );
    for (const appearance of ['bar', 'floating'] as const) {
      for (const position of ['top', 'bottom'] as const) {
        host.appearance.set(appearance);
        host.position.set(position);
        host.maxHeight.set(position === 'bottom' ? 240 : undefined);
        await settle();
        content.focus();
        editor.commands.setTextSelection({ from: 1, to: 6 });
        await settle();
        await expectNoAxeViolations(document.body);
        expect(root.querySelector('[role="textbox"]')).not.toBeNull();
      }
    }
  }, 30_000);
});
