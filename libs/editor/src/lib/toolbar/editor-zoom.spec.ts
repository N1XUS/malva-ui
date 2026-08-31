import { Component, signal, viewChild } from '@angular/core';
import type { OnDestroy, WritableSignal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Observable, Subject } from 'rxjs';
import { vi } from 'vitest';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import type { MlvEditorI18n } from '@malva-ui/i18n';
import {
  i18nTestProvider,
  provideMlvI18nTesting,
} from '@malva-ui/i18n/testing';
import {
  MlvEditor,
  MlvEditorToolbar,
  MlvEditorToolbarDef,
  MlvEditorZoom,
} from '../..';
import type { MlvEditorToolbarContext } from '../..';

function resizeEntry(width: number): ResizeObserverEntry[] {
  return [{ contentRect: { width } as DOMRectReadOnly } as ResizeObserverEntry];
}

/** Every row rendered by the zoom dropdown panel, presets first, fit last. */
function zoomOptions(menu: Element): HTMLElement[] {
  return Array.from(
    menu.querySelectorAll<HTMLElement>(
      '.mlv-editor-zoom__levels [role="option"]',
    ),
  );
}

/** Preset rows only — the fit row is the one whose label is not a percentage. */
function zoomPresets(menu: Element): HTMLElement[] {
  return zoomOptions(menu).filter((option) =>
    option.textContent?.trim().endsWith('%'),
  );
}

/** The "fit to container" row, which the panel always renders last. */
function zoomFit(menu: Element): HTMLElement | undefined {
  return zoomOptions(menu).find(
    (option) => !option.textContent?.trim().endsWith('%'),
  );
}

async function finishDetachedOverlays(
  fixture: ComponentFixture<unknown>,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  for (const panel of document.querySelectorAll('.mlv-popup--leave')) {
    panel.dispatchEvent(new Event('animationend', { bubbles: true }));
  }
  fixture.detectChanges();
  await fixture.whenStable();
}

@Component({
  imports: [MlvEditor, MlvEditorToolbarDef, MlvEditorZoom],
  template: `
    <mlv-editor
      [(value)]="value"
      [readonly]="readonly()"
      [disabled]="disabled()"
      (transaction)="transactions.update((count) => count + 1)"
    >
      <ng-template mlvEditorToolbar>
        @if (showZoom()) {
          <mlv-editor-zoom
            [(zoom)]="zoom"
            [zoomLevels]="levels()"
            [min]="min()"
            [max]="max()"
            [fitToContainer]="fit()"
          />
        }
      </ng-template>
    </mlv-editor>
  `,
})
class ZoomHost {
  readonly value = signal<string | null>('<p>Zoom stays visual</p>');
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly zoom = signal(100);
  readonly levels = signal<readonly number[]>([60, 100, 140]);
  readonly min = signal(50);
  readonly max = signal(150);
  readonly fit = signal(false);
  readonly showZoom = signal(true);
  readonly transactions = signal(0);
  readonly editor = viewChild.required(MlvEditor);
  readonly zoomControl = viewChild.required(MlvEditorZoom);
}

@Component({
  imports: [MlvEditorToolbar],
  template: '<mlv-editor-toolbar [context]="context" />',
})
class PublicToolbarHost implements OnDestroy {
  readonly editor = new Editor({ extensions: [StarterKit] });
  readonly zoom = signal(125);
  readonly context: MlvEditorToolbarContext = {
    editor: signal(this.editor).asReadonly(),
    disabled: signal(false).asReadonly(),
    readonly: signal(false).asReadonly(),
    focused: signal(false).asReadonly(),
    editable: signal(true).asReadonly(),
    format: signal<'html'>('html').asReadonly(),
    zoom: this.zoom,
    run: (command) => command(this.editor),
    can: (command) => command(this.editor),
    isActive: (name, attributes) => this.editor.isActive(name, attributes),
    reportError: () => undefined,
  };

  ngOnDestroy(): void {
    this.editor.destroy();
  }
}

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      [readonly]="readonly()"
      [disabled]="disabled()"
      (blur)="blurs.update((count) => count + 1)"
      (transaction)="transactions.update((count) => count + 1)"
    />
  `,
})
class ResponsiveHost {
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly blurs = signal(0);
  readonly transactions = signal(0);
  readonly editor = viewChild.required(MlvEditor);
}

@Component({
  imports: [MlvEditor],
  template: '<mlv-editor [extensions]="extensions" />',
})
class LimitedResponsiveHost {
  readonly extensions = [
    StarterKit.configure({
      bold: false,
      strike: false,
      underline: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
    }),
  ];
}

describe('MlvEditorZoom', () => {
  let resized: Subject<ResizeObserverEntry[]>;

  async function createZoomHost(): Promise<ComponentFixture<ZoomHost>> {
    resized = new Subject<ResizeObserverEntry[]>();
    await TestBed.configureTestingModule({
      imports: [ZoomHost],
      providers: [
        provideMlvI18nTesting(),
        {
          provide: MlvResizeObserverService,
          useValue: { observe: () => resized.asObservable() },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ZoomHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  async function openMenu(
    fixture: ComponentFixture<unknown>,
    label: string,
  ): Promise<HTMLElement> {
    const trigger = fixture.nativeElement.querySelector(
      `button[aria-label="${label}"]`,
    ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    return (document.getElementById(
      trigger.getAttribute('aria-controls') ?? '',
    ) ??
      document.querySelector(
        `[role="dialog"][aria-label="${label}"]`,
      )) as HTMLElement;
  }

  function zoomButtons(
    fixture: ComponentFixture<unknown>,
  ): readonly HTMLButtonElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('mlv-editor-zoom > button'),
    ) as HTMLButtonElement[];
  }

  async function closeDetachedMenus(
    fixture: ComponentFixture<unknown>,
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    for (const panel of document.querySelectorAll('.mlv-popup--leave')) {
      panel.dispatchEvent(new Event('animationend', { bubbles: true }));
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('owns a real model signal and clamps external writes before synchronizing context', async () => {
    const fixture = await createZoomHost();
    const host = fixture.componentInstance;
    const control = host.zoomControl();

    expect(control.zoom.set).toEqual(expect.any(Function));
    host.editor().zoom.set(120);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(control.zoom()).toBe(120);
    expect(host.zoom()).toBe(120);

    host.zoom.set(500);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(control.zoom()).toBe(150);
    expect(host.zoom()).toBe(150);
    expect(host.editor().zoom()).toBe(150);

    host.zoom.set(-10);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(control.zoom()).toBe(50);
    expect(host.editor().zoom()).toBe(50);
  });

  it('lets an explicitly bound initial 100 win over an existing non-default context value', async () => {
    const fixture = await createZoomHost();
    const host = fixture.componentInstance;
    host.showZoom.set(false);
    fixture.detectChanges();
    host.editor().zoom.set(125);
    host.zoom.set(100);

    host.showZoom.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.zoom()).toBe(100);
    expect(host.zoomControl().zoom()).toBe(100);
    expect(host.editor().zoom()).toBe(100);
  });

  it('exposes the ModelSignal output subscription surface for two-way zoom changes', async () => {
    const fixture = await createZoomHost();
    const control = fixture.componentInstance.zoomControl();
    const emitted: number[] = [];
    const subscription = control.zoom.subscribe((value) => emitted.push(value));

    control.zoom.set(140);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(emitted).toContain(140);
    expect(fixture.componentInstance.editor().zoom()).toBe(140);

    subscription.unsubscribe();
  });

  it('renders custom preset levels and steps through them without skipping bounds', async () => {
    const fixture = await createZoomHost();
    const host = fixture.componentInstance;
    const menu = await openMenu(fixture, 'Zoom');

    expect(zoomPresets(menu).map((item) => item.textContent?.trim())).toEqual([
      '60%',
      '100%',
      '140%',
    ]);

    zoomButtons(fixture)[2]?.click();
    fixture.detectChanges();
    expect(host.zoom()).toBe(140);

    zoomButtons(fixture)[2]?.click();
    fixture.detectChanges();
    expect(host.zoom()).toBe(150);

    zoomButtons(fixture)[0]?.click();
    fixture.detectChanges();
    expect(host.zoom()).toBe(140);
    zoomPresets(menu)[1].click();
    await finishDetachedOverlays(fixture);
  });

  it('normalizes reversed bounds and excludes duplicate, invalid, and out-of-range presets', async () => {
    const fixture = await createZoomHost();
    const host = fixture.componentInstance;
    host.min.set(150);
    host.max.set(50);
    host.levels.set([
      Number.NaN,
      Number.POSITIVE_INFINITY,
      20,
      60,
      60,
      100,
      180,
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const menu = await openMenu(fixture, 'Zoom');
    expect(zoomPresets(menu).map((item) => item.textContent?.trim())).toEqual([
      '60%',
      '100%',
    ]);
    const input = menu.querySelector(
      'input[aria-label="Zoom"]',
    ) as HTMLInputElement;
    expect(input.min).toBe('50');
    expect(input.max).toBe('150');

    host.zoom.set(999);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.zoom()).toBe(150);
    zoomPresets(menu)[0].click();
    await closeDetachedMenus(fixture);
  });

  it('normalizes bounds and presets to a strictly positive percentage domain', async () => {
    const fixture = await createZoomHost();
    const host = fixture.componentInstance;
    host.min.set(-20);
    host.max.set(80);
    host.levels.set([-50, -1, 0, 1, 40, 80]);
    host.zoom.set(-10);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const menu = await openMenu(fixture, 'Zoom');
    const input = menu.querySelector(
      'input[aria-label="Zoom"]',
    ) as HTMLInputElement;
    expect(input.min).toBe('1');
    expect(input.max).toBe('80');
    expect(host.zoom()).toBe(1);
    expect(zoomPresets(menu).map((item) => item.textContent?.trim())).toEqual([
      '1%',
      '40%',
      '80%',
    ]);
    zoomPresets(menu)[0].click();
    await closeDetachedMenus(fixture);
  });

  it('parses the percentage MlvInput and renders an actionable optional fit item', async () => {
    const fixture = await createZoomHost();
    const host = fixture.componentInstance;
    let menu = await openMenu(fixture, 'Zoom');
    expect(menu.textContent).not.toContain('Fit to container');
    zoomPresets(menu)[1].click();
    await closeDetachedMenus(fixture);

    host.fit.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected browser editor.');
    const view = fixture.nativeElement.querySelector(
      '.mlv-editor__view',
    ) as HTMLElement;
    Object.defineProperty(view, 'scrollWidth', {
      configurable: true,
      value: 800,
    });
    const viewport = fixture.nativeElement.querySelector(
      '.mlv-editor__viewport',
    ) as HTMLElement;
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      width: 400,
    } as DOMRect);
    Object.defineProperty(viewport, 'clientWidth', {
      configurable: true,
      value: 400,
    });

    menu = await openMenu(fixture, 'Zoom');
    const input = menu.querySelector(
      'input[aria-label="Zoom"]',
    ) as HTMLInputElement;
    input.value = '135';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    );
    fixture.detectChanges();
    expect(host.zoom()).toBe(135);

    const fit = zoomFit(menu) as HTMLElement;
    fit.click();
    fixture.detectChanges();
    expect(host.zoom()).toBe(50);
    await closeDetachedMenus(fixture);
  });

  it('fits to the largest integral safe scale after each container resize', async () => {
    const fixture = await createZoomHost();
    const host = fixture.componentInstance;
    host.fit.set(true);
    fixture.detectChanges();
    const view = fixture.nativeElement.querySelector(
      '.mlv-editor__view',
    ) as HTMLElement;
    Object.defineProperty(view, 'scrollWidth', {
      configurable: true,
      value: 900,
    });
    vi.spyOn(view, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          width: (900 * host.zoom()) / 100,
        }) as DOMRect,
    );
    const viewport = fixture.nativeElement.querySelector(
      '.mlv-editor__viewport',
    ) as HTMLElement;
    let viewportWidth = 460;
    Object.defineProperty(viewport, 'clientWidth', {
      configurable: true,
      get: () => viewportWidth,
    });

    resized.next(resizeEntry(500));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.zoom()).toBe(51);
    expect(host.editor().zoom()).toBe(51);
    expect((view.scrollWidth * host.zoom()) / 100).toBeLessThanOrEqual(
      viewport.clientWidth,
    );
    expect((view.scrollWidth * (host.zoom() + 1)) / 100).toBeGreaterThan(
      viewport.clientWidth,
    );

    viewportWidth = 2000;
    resized.next(resizeEntry(2000));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.zoom()).toBe(150);
  });

  it('opens numeric zoom in a named dialog, moves focus to the input, and restores it on Escape', async () => {
    const fixture = await createZoomHost();
    const trigger = zoomButtons(fixture)[1] as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));

    const dialog = document.querySelector(
      '[role="dialog"][aria-label="Zoom"]',
    ) as HTMLElement | null;
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(dialog).not.toBeNull();
    const input = dialog?.querySelector(
      'input[aria-label="Zoom"]',
    ) as HTMLInputElement;
    expect(document.activeElement).toBe(input);

    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    await closeDetachedMenus(fixture);

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('changes only the inner visual view and preserves document, value, selection, and history', async () => {
    const fixture = await createZoomHost();
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected browser editor.');
    const proseMirror = editor.view.dom as HTMLElement;
    editor.commands.setContent('<p>Zoom <strong>history</strong></p>');
    editor.commands.setTextSelection({ from: 2, to: 6 });
    fixture.detectChanges();
    const before = {
      json: editor.getJSON(),
      html: editor.getHTML(),
      value: host.value(),
      selection: {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      },
      canUndo: editor.can().undo(),
      transactions: host.transactions(),
    };

    zoomButtons(fixture)[2]?.click();
    fixture.detectChanges();

    expect(editor.getJSON()).toEqual(before.json);
    expect(editor.getHTML()).toBe(before.html);
    expect(host.value()).toBe(before.value);
    expect({
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    }).toEqual(before.selection);
    expect(editor.can().undo()).toBe(before.canUndo);
    expect(host.transactions()).toBe(before.transactions);
    expect(
      (fixture.nativeElement.querySelector('mlv-editor') as HTMLElement).style
        .getPropertyValue('--mlv-editor-zoom')
        .trim(),
    ).toBe('1.4');
    expect(
      fixture.nativeElement.querySelector('.mlv-editor__view .ProseMirror'),
    ).toBe(proseMirror);
    expect(proseMirror.style.transform).toBe('');
  });

  it('keeps zoom available in readonly mode and disables it with the editor composite', async () => {
    const fixture = await createZoomHost();
    const host = fixture.componentInstance;
    host.readonly.set(true);
    fixture.detectChanges();
    expect(zoomButtons(fixture).every((button) => !button.disabled)).toBe(true);

    host.disabled.set(true);
    fixture.detectChanges();
    expect(zoomButtons(fixture).every((button) => button.disabled)).toBe(true);
  });

  it('blocks an already-open zoom menu when the editor becomes disabled', async () => {
    const fixture = await createZoomHost();
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected browser editor.');
    const view = fixture.nativeElement.querySelector(
      '.mlv-editor__view',
    ) as HTMLElement;
    Object.defineProperty(view, 'scrollWidth', {
      configurable: true,
      value: 800,
    });
    const viewport = fixture.nativeElement.querySelector(
      '.mlv-editor__viewport',
    ) as HTMLElement;
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      width: 400,
    } as DOMRect);
    Object.defineProperty(viewport, 'clientWidth', {
      configurable: true,
      value: 400,
    });
    host.fit.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    host.zoom.set(100);
    fixture.detectChanges();
    const menu = await openMenu(fixture, 'Zoom');

    host.disabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const input = menu.querySelector(
      'input[aria-label="Zoom"]',
    ) as HTMLInputElement;
    const items = zoomOptions(menu);
    expect(input.disabled).toBe(true);
    // Dropdown rows are aria options, so inertness is `aria-disabled` rather
    // than the native button property the preset buttons used to carry.
    expect(
      items.every((item) => item.getAttribute('aria-disabled') === 'true'),
    ).toBe(true);

    input.value = '130';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    );
    items.find((item) => item.textContent?.trim() === '140%')?.click();
    items
      .find((item) => item.textContent?.trim() === 'Fit to container')
      ?.click();
    fixture.detectChanges();
    expect(host.zoom()).toBe(100);
    await closeDetachedMenus(fixture);
  });

  it('updates all zoom and fit labels when editor translations change', async () => {
    resized = new Subject<ResizeObserverEntry[]>();
    await TestBed.configureTestingModule({
      imports: [ZoomHost],
      providers: [
        provideMlvI18nTesting(),
        i18nTestProvider(MLV_EDITOR_I18N),
        {
          provide: MlvResizeObserverService,
          useValue: { observe: () => resized.asObservable() },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ZoomHost);
    fixture.componentInstance.fit.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const copy = TestBed.inject(
      MLV_EDITOR_I18N,
    ) as WritableSignal<MlvEditorI18n>;
    copy.update((current) => ({
      ...current,
      zoom: 'Scale',
      fitToContainer: 'Fit view',
    }));
    fixture.detectChanges();

    expect(
      zoomButtons(fixture).map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Scale −', 'Scale', 'Scale +']);
    const menu = await openMenu(fixture, 'Scale');
    expect(menu.textContent).toContain('Fit view');
    (zoomFit(menu) as HTMLElement).click();
    await closeDetachedMenus(fixture);
  });
});

describe('MlvEditor responsive toolbar', () => {
  let resized: Subject<ResizeObserverEntry[]>;

  beforeEach(() => {
    resized = new Subject<ResizeObserverEntry[]>();
  });

  it('keeps formatting commands in logical order behind an accessible overflow when narrow', async () => {
    await TestBed.configureTestingModule({
      imports: [ResponsiveHost],
      providers: [
        provideMlvI18nTesting(),
        {
          provide: MlvResizeObserverService,
          useValue: { observe: () => resized.asObservable() },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ResponsiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const editor = fixture.componentInstance.editor().editor();
    if (!editor) throw new Error('Expected browser editor.');
    vi.spyOn(editor.view, 'scrollToSelection').mockImplementation(
      () => undefined,
    );
    editor.commands.setContent('<p>Overflow selection</p>');
    editor.commands.setTextSelection({ from: 2, to: 10 });
    fixture.detectChanges();
    resized.next(resizeEntry(480));
    fixture.detectChanges();

    const toolbar = fixture.nativeElement.querySelector(
      '[role="toolbar"]',
    ) as HTMLElement;
    expect(toolbar.classList).toContain('mlv-editor-toolbar--narrow');
    expect(
      (
        toolbar.querySelector(
          'button[aria-label="Heading level"]',
        ) as HTMLElement
      ).closest('[hidden]'),
    ).toBeNull();
    expect(
      (
        toolbar.querySelector('button[aria-label="Bullet list"]') as HTMLElement
      ).closest('[hidden]'),
    ).toBeNull();
    expect(
      toolbar.querySelector('button[aria-label="More formatting"]'),
    ).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    const widgets = Array.from(
      toolbar.querySelectorAll('button[mlvEditorToolbarWidget]'),
    ) as HTMLButtonElement[];
    expect(
      widgets.filter(
        (widget) =>
          !widget.closest('[hidden]') &&
          widget.getAttribute('tabindex') === '0',
      ),
    ).toHaveLength(1);

    const beforeMenu = {
      json: editor.getJSON(),
      transactions: fixture.componentInstance.transactions(),
      selection: {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      },
    };
    const menu = await (async () => {
      const trigger = toolbar.querySelector(
        'button[aria-label="More formatting"]',
      ) as HTMLButtonElement;
      trigger.focus();
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
      return document.getElementById(
        trigger.getAttribute('aria-controls') ?? '',
      ) as HTMLElement;
    })();
    expect(editor.getJSON()).toEqual(beforeMenu.json);
    expect(fixture.componentInstance.transactions()).toBe(
      beforeMenu.transactions,
    );
    expect(fixture.componentInstance.blurs()).toBe(0);
    expect(
      Array.from(menu.querySelectorAll('[role="menuitem"]')).map((item) =>
        item.textContent?.trim(),
      ),
    ).toEqual([
      'Bold',
      'Italic',
      'Strike-through',
      'Underline',
      'Align left',
      'Align center',
      'Align right',
      'Justify',
      'Blockquote',
      'Code block',
      'Horizontal rule',
    ]);
    const chain = vi.spyOn(editor, 'chain');
    (menu.querySelectorAll('[role="menuitem"]')[0] as HTMLElement).click();
    fixture.detectChanges();
    expect(chain).toHaveBeenCalledTimes(1);
    expect(editor.isActive('bold')).toBe(true);
    expect({
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    }).toEqual(beforeMenu.selection);
    await new Promise((resolve) => setTimeout(resolve));
    for (const panel of document.querySelectorAll('.mlv-popup--leave')) {
      panel.dispatchEvent(new Event('animationend', { bubbles: true }));
    }
    fixture.detectChanges();
    await fixture.whenStable();

    resized.next(resizeEntry(1000));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(toolbar.classList).not.toContain('mlv-editor-toolbar--narrow');
    expect(
      toolbar.querySelector('mlv-editor-inline-marks')?.hasAttribute('hidden'),
    ).toBe(false);
    expect(
      toolbar
        .querySelector('mlv-editor-toolbar-overflow')
        ?.hasAttribute('hidden'),
    ).toBe(true);
  });

  it('closes an open overflow on wide recovery and moves focus to a visible roving widget', async () => {
    await TestBed.configureTestingModule({
      imports: [ResponsiveHost],
      providers: [
        provideMlvI18nTesting(),
        {
          provide: MlvResizeObserverService,
          useValue: { observe: () => resized.asObservable() },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ResponsiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    resized.next(resizeEntry(480));
    fixture.detectChanges();
    const toolbar = fixture.nativeElement.querySelector(
      '[role="toolbar"]',
    ) as HTMLElement;
    const trigger = toolbar.querySelector(
      'button[aria-label="More formatting"]',
    ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    const panel = document.getElementById(
      trigger.getAttribute('aria-controls') ?? '',
    ) as HTMLElement;
    (panel.querySelector('[role="menuitem"]') as HTMLElement).focus();
    expect(panel.contains(document.activeElement)).toBe(true);

    resized.next(resizeEntry(1000));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await finishDetachedOverlays(fixture);

    const focused = document.activeElement as HTMLElement;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(focused.closest('[role="toolbar"]')).toBe(toolbar);
    expect(focused.closest('[hidden]')).toBeNull();
    expect(focused.getAttribute('tabindex')).toBe('0');
  });

  it('omits unregistered custom-extension commands from narrow overflow', async () => {
    await TestBed.configureTestingModule({
      imports: [LimitedResponsiveHost],
      providers: [
        provideMlvI18nTesting(),
        {
          provide: MlvResizeObserverService,
          useValue: { observe: () => resized.asObservable() },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LimitedResponsiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    resized.next(resizeEntry(480));
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector(
      'button[aria-label="More formatting"]',
    ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    const menu = document.getElementById(
      trigger.getAttribute('aria-controls') ?? '',
    ) as HTMLElement;

    expect(
      Array.from(menu.querySelectorAll('[role="menuitem"]')).map((item) =>
        item.textContent?.trim(),
      ),
    ).toEqual(['Italic']);
    (menu.querySelector('[role="menuitem"]') as HTMLElement).click();
    await finishDetachedOverlays(fixture);
  });

  it('includes view zoom and responsive overflow in the public toolbar shell', async () => {
    await TestBed.configureTestingModule({
      imports: [PublicToolbarHost],
      providers: [
        provideMlvI18nTesting(),
        {
          provide: MlvResizeObserverService,
          useValue: { observe: () => resized.asObservable() },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PublicToolbarHost);
    fixture.detectChanges();
    await fixture.whenStable();
    resized.next(resizeEntry(480));
    fixture.detectChanges();

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('button[aria-label]'),
    ).map((button) => button.getAttribute('aria-label'));
    expect(labels).toContain('Zoom');
    expect(labels).toContain('More formatting');
    expect(
      (
        fixture.nativeElement.querySelector(
          'button[aria-label="Zoom"]',
        ) as HTMLButtonElement
      ).textContent?.trim(),
    ).toBe('125%');
    const editor = fixture.componentInstance.editor;
    fixture.destroy();
    expect(editor.isDestroyed).toBe(true);
  });

  it('updates the overflow trigger and every command label reactively', async () => {
    await TestBed.configureTestingModule({
      imports: [ResponsiveHost],
      providers: [
        provideMlvI18nTesting(),
        i18nTestProvider(MLV_EDITOR_I18N),
        {
          provide: MlvResizeObserverService,
          useValue: { observe: () => resized.asObservable() },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ResponsiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    resized.next(resizeEntry(480));
    fixture.detectChanges();
    const copy = TestBed.inject(
      MLV_EDITOR_I18N,
    ) as WritableSignal<MlvEditorI18n>;
    copy.update((current) => ({
      ...current,
      moreFormatting: 'Advanced formatting',
      bold: 'Strong',
      italic: 'Emphasis',
      strike: 'Cross out',
      underline: 'Underline text',
      alignLeft: 'Flush left',
      alignCenter: 'Centre',
      alignRight: 'Flush right',
      alignJustify: 'Fill line',
      blockquote: 'Quote',
      codeBlock: 'Code',
      horizontalRule: 'Divider',
    }));
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector(
      'button[aria-label="Advanced formatting"]',
    ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    const menu = document.getElementById(
      trigger.getAttribute('aria-controls') ?? '',
    ) as HTMLElement;
    expect(
      Array.from(menu.querySelectorAll('[role="menuitem"]')).map((item) =>
        item.textContent?.trim(),
      ),
    ).toEqual([
      'Strong',
      'Emphasis',
      'Cross out',
      'Underline text',
      'Flush left',
      'Centre',
      'Flush right',
      'Fill line',
      'Quote',
      'Code',
      'Divider',
    ]);
    (menu.querySelectorAll('[role="menuitem"]')[0] as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve));
    for (const panel of document.querySelectorAll('.mlv-popup--leave')) {
      panel.dispatchEvent(new Event('animationend', { bubbles: true }));
    }
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('does not subscribe to resize observation while server rendering', async () => {
    let subscriptions = 0;

    @Component({
      selector: 'mlv-editor-zoom-ssr-host',
      imports: [MlvEditor],
      template: '<mlv-editor />',
    })
    class SsrHost {}

    const html = await renderApplication(
      (context) =>
        bootstrapApplication(
          SsrHost,
          {
            providers: [
              provideMlvI18nTesting(),
              {
                provide: MlvResizeObserverService,
                useValue: {
                  observe: () =>
                    new Observable(() => {
                      subscriptions += 1;
                    }),
                },
              },
            ],
          },
          context,
        ),
      {
        document: '<mlv-editor-zoom-ssr-host></mlv-editor-zoom-ssr-host>',
        url: '/',
      },
    );

    expect(html).toContain('mlv-editor-zoom');
    expect(subscriptions).toBe(0);
  });

  it('unsubscribes every Malva resize observation during teardown', async () => {
    let activeSubscriptions = 0;
    await TestBed.configureTestingModule({
      imports: [MlvEditor],
      providers: [
        provideMlvI18nTesting(),
        {
          provide: MlvResizeObserverService,
          useValue: {
            observe: () =>
              new Observable(() => {
                activeSubscriptions += 1;
                return () => {
                  activeSubscriptions -= 1;
                };
              }),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MlvEditor);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(activeSubscriptions).toBeGreaterThan(0);

    fixture.destroy();
    expect(activeSubscriptions).toBe(0);
  });
});
