import { Dialog } from '@angular/cdk/dialog';
import {
  afterEveryRender,
  ApplicationRef,
  Component,
  signal,
  viewChild,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { vi } from 'vitest';
import type {
  MlvEditorToolbarAppearance,
  MlvEditorToolbarPosition,
} from '../editor.types';
import { MlvEditor } from './editor';
import {
  mlvEditorBubblePlacement,
  mlvEditorVisibleRect,
} from './editor-layout';

@Component({
  imports: [MlvEditor],
  template: `
    <div [attr.dir]="dir()">
      <mlv-editor
        label="Bubble"
        [value]="value()"
        [maxHeight]="maxHeight()"
        [disabled]="disabled()"
        [readonly]="readonly()"
        [toolbarPosition]="position()"
        [toolbarAppearance]="appearance()"
        [toolbarSticky]="sticky()"
      />
    </div>
    <button type="button" data-outside>Outside</button>
  `,
})
class BubbleHost {
  readonly value = signal<string | null>('<p>Alpha beta</p><p>Gamma</p>');
  readonly maxHeight = signal<number | undefined>(undefined);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly position = signal<MlvEditorToolbarPosition>('top');
  readonly appearance = signal<MlvEditorToolbarAppearance>('floating');
  readonly sticky = signal(false);
  readonly dir = signal<'ltr' | 'rtl' | null>(null);
  readonly editor = viewChild.required(MlvEditor);
}

interface BubbleHarness {
  fixture: ComponentFixture<BubbleHost>;
  host: BubbleHost;
  root: HTMLElement;
  editor: Editor;
  content: HTMLElement;
  viewport: HTMLElement;
  settle(): Promise<void>;
  select(from: number, to?: number): Promise<void>;
}

async function createBubbleHost(
  configure?: (host: BubbleHost) => void,
): Promise<BubbleHarness> {
  await TestBed.configureTestingModule({
    imports: [BubbleHost],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(BubbleHost);
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
    viewport: root.querySelector('.mlv-editor__viewport') as HTMLElement,
    settle,
    select: async (from, to = from) => {
      editor.commands.setTextSelection({ from, to });
      await settle();
    },
  };
}

/** The bubble's overlay pane; `null` while no overlay exists. */
function bubble(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.mlv-editor-bubble');
}

/** Whether the bubble is on screen. */
function shown(): boolean {
  const pane = bubble();
  return pane !== null && !pane.classList.contains('mlv-editor-bubble--hidden');
}

/** Legacy key codes a real browser sends; ProseMirror and CDK read them. */
const KEY_CODES: Record<string, number> = {
  Tab: 9,
  Enter: 13,
  Escape: 27,
  ArrowLeft: 37,
  ArrowRight: 39,
  F10: 121,
};

/**
 * Dispatches a keydown carrying the real `keyCode`: jsdom's is always 0, and
 * ProseMirror cancels Escape (and CDK dialogs close on it) only by key code.
 */
function press(
  target: HTMLElement,
  key: string,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  const keyCode = KEY_CODES[key] ?? 0;
  Object.defineProperty(event, 'keyCode', { get: () => keyCode });
  Object.defineProperty(event, 'which', { get: () => keyCode });
  target.dispatchEvent(event);
  return event;
}

/** Records whether keydown events reach the document once `target` is done. */
function watchDocumentKeys(): { keys: string[]; stop(): void } {
  const keys: string[] = [];
  const listener = (event: KeyboardEvent) => keys.push(event.key);
  document.addEventListener('keydown', listener);
  return {
    keys,
    stop: () => document.removeEventListener('keydown', listener),
  };
}

/**
 * Gives the document a window-sized client box. CDK scores overlay fit against
 * `documentElement.clientWidth/Height`, which jsdom reports as 0, so without
 * this every position "overflows" and CDK falls back to whichever overflows
 * by the most convenient amount.
 */
function stubLayoutViewport(): void {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    window.innerWidth,
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    window.innerHeight,
  );
}

/** Fixes the selection's client rect; jsdom lays nothing out. */
function stubSelectionRect(
  editor: Editor,
  rect: { top: number; bottom: number; left: number; right: number },
) {
  return vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue(rect);
}

describe('mlvEditorVisibleRect', () => {
  const boundary = { top: 100, bottom: 340, left: 0, right: 600 };

  it('clips the selection to the boundary and reports nothing once it leaves', () => {
    expect(
      mlvEditorVisibleRect(
        { top: 120, bottom: 136, left: 10, right: 90 },
        boundary,
      ),
    ).toEqual({ top: 120, bottom: 136, left: 10, right: 90 });
    expect(
      mlvEditorVisibleRect(
        { top: 60, bottom: 180, left: 10, right: 90 },
        boundary,
      ),
    ).toEqual({ top: 100, bottom: 180, left: 10, right: 90 });
    expect(
      mlvEditorVisibleRect(
        { top: 350, bottom: 366, left: 10, right: 90 },
        boundary,
      ),
    ).toBeNull();
    expect(
      mlvEditorVisibleRect(
        { top: 60, bottom: 90, left: 10, right: 90 },
        boundary,
      ),
    ).toBeNull();
  });

  it('keeps a zero-size caret on the boundary edge', () => {
    expect(
      mlvEditorVisibleRect(
        { top: 100, bottom: 100, left: 5, right: 5 },
        boundary,
      ),
    ).toEqual({ top: 100, bottom: 100, left: 5, right: 5 });
  });
});

describe('mlvEditorBubblePlacement', () => {
  const boundary = { top: 100, bottom: 700, left: 0, right: 600 };

  it('prefers above and flips below only when above would cross the boundary', () => {
    const anchor = (top: number) => ({
      top,
      bottom: top + 16,
      left: 10,
      right: 90,
    });
    expect(mlvEditorBubblePlacement(anchor(300), boundary, 44, 8)).toBe(
      'above',
    );
    // 152 - 8 - 44 = 100: touching the edge still fits.
    expect(mlvEditorBubblePlacement(anchor(152), boundary, 44, 8)).toBe(
      'above',
    );
    expect(mlvEditorBubblePlacement(anchor(151), boundary, 44, 8)).toBe(
      'below',
    );
  });
});

describe('MlvEditor selection bubble (toolbarAppearance="floating")', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the toolbar in the bubble, not in the surface', async () => {
    const { root } = await createBubbleHost();
    expect(root.querySelector('.mlv-editor__toolbar-band')).toBeNull();
    expect(root.querySelector('[role="toolbar"]')).toBeNull();
    const pane = bubble();
    expect(pane).not.toBeNull();
    expect(
      pane?.querySelector('.mlv-editor__toolbar[role="toolbar"]'),
    ).not.toBeNull();
    expect(shown()).toBe(false);
  });

  it('stays hidden on a bare caret, shows on a non-empty selection and hides when it collapses', async () => {
    const { content, select } = await createBubbleHost();
    content.focus();
    await select(1);
    expect(shown()).toBe(false);

    await select(1, 6);
    expect(shown()).toBe(true);
    // It never takes focus by appearing.
    expect(document.activeElement).toBe(content);

    await select(3);
    expect(shown()).toBe(false);
  });

  it('stays hidden without focus, and hides when focus leaves the editor and its bubble', async () => {
    const { root, content, select, settle } = await createBubbleHost();
    await select(1, 6);
    expect(shown()).toBe(false);

    content.focus();
    await settle();
    expect(shown()).toBe(true);

    (root.querySelector('[data-outside]') as HTMLElement).focus();
    await settle();
    expect(shown()).toBe(false);
  });

  it('dismisses on Escape in the content, keeps the selection, and returns on the next selection', async () => {
    const { editor, content, select, settle } = await createBubbleHost();
    content.focus();
    await select(1, 6);
    expect(shown()).toBe(true);

    const page = watchDocumentKeys();
    const escape = press(content, 'Escape');
    await settle();
    page.stop();
    expect(escape.defaultPrevented).toBe(true);
    // Stopped at the content: nothing around the editor sees this Escape.
    expect(page.keys).toEqual([]);
    expect(shown()).toBe(false);
    expect(document.activeElement).toBe(content);
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.selection.to).toBe(6);

    await select(1, 7);
    expect(shown()).toBe(true);
  });

  it('lets Escape through to the page while the bubble is hidden', async () => {
    const { content, select, settle } = await createBubbleHost();
    content.focus();
    await select(2);
    const page = watchDocumentKeys();
    press(content, 'Escape');
    await settle();
    page.stop();
    expect(page.keys).toEqual(['Escape']);
  });

  it('lets a later plugin that claims Escape take it first, as an AI stream does', async () => {
    const { editor, content, select, settle } = await createBubbleHost();
    content.focus();
    await select(1, 6);
    expect(shown()).toBe(true);
    // Registered after the bubble's own plugin, the way an AI stream session
    // registers its Escape claim.
    let claimed = 0;
    const popupKey = new PluginKey('testPopup');
    const popup = new Plugin({
      key: popupKey,
      props: {
        handleKeyDown: (_view, event) => {
          if (event.key !== 'Escape') return false;
          claimed++;
          return true;
        },
      },
    });
    editor.registerPlugin(popup);

    press(content, 'Escape');
    await settle();
    expect(claimed).toBe(1);
    expect(shown()).toBe(true);

    editor.unregisterPlugin(popupKey);
    press(content, 'Escape');
    await settle();
    expect(claimed).toBe(1);
    expect(shown()).toBe(false);
  });

  it('offers Escape once to a later plugin that declines it, even when that plugin hides the bubble', async () => {
    const { editor, content, select, settle } = await createBubbleHost();
    content.focus();
    await select(1, 6);
    expect(shown()).toBe(true);
    // Declines Escape after a side effect that hides the bubble at once
    // (here, Escape on the bubble itself). Offered the key by the bubble's
    // plugin, it must not get it again from ProseMirror.
    let offered = 0;
    const declinerKey = new PluginKey('testDecliner');
    editor.registerPlugin(
      new Plugin({
        key: declinerKey,
        props: {
          handleKeyDown: (_view, event) => {
            if (event.key !== 'Escape') return false;
            offered++;
            press(bubble() as HTMLElement, 'Escape');
            return false;
          },
        },
      }),
    );

    const escape = press(content, 'Escape');
    await settle();
    editor.unregisterPlugin(declinerKey);
    expect(offered).toBe(1);
    expect(escape.defaultPrevented).toBe(true);
    expect(shown()).toBe(false);
  });

  it('dismisses on an Escape ProseMirror skipped inside its composition window', async () => {
    const { editor, content, select, settle } = await createBubbleHost();
    content.focus();
    await select(1, 6);
    expect(shown()).toBe(true);
    // Safari keeps ProseMirror composing for 500ms after `compositionend`,
    // by when the bubble is back, and ProseMirror runs no key handler until
    // then. jsdom is not Safari, so set the flag ProseMirror reads.
    const input = (editor.view as unknown as { input: { composing: boolean } })
      .input;
    input.composing = true;
    try {
      const page = watchDocumentKeys();
      const escape = press(content, 'Escape');
      await settle();
      page.stop();
      expect(escape.defaultPrevented).toBe(true);
      expect(page.keys).toEqual([]);
      expect(shown()).toBe(false);
    } finally {
      input.composing = false;
    }
  });

  it('stays hidden in a readonly editor and claims neither Escape nor Alt+F10', async () => {
    const { fixture, content, select, settle } = await createBubbleHost(
      (host) => host.readonly.set(true),
    );
    content.focus();
    await select(1, 6);
    expect(shown()).toBe(false);

    const page = watchDocumentKeys();
    const escape = press(content, 'Escape');
    const summon = press(content, 'F10', { altKey: true });
    await settle();
    page.stop();
    expect(escape.defaultPrevented).toBe(false);
    expect(summon.defaultPrevented).toBe(false);
    expect(page.keys).toEqual(['Escape', 'F10']);
    expect(shown()).toBe(false);

    // A selection that can never show schedules no render on scroll.
    let renders = 0;
    const counter = TestBed.runInInjectionContext(() =>
      afterEveryRender(() => renders++),
    );
    await fixture.whenStable();
    renders = 0;
    document.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    await Promise.resolve();
    await fixture.whenStable();
    expect(renders).toBe(0);
    counter.destroy();
  });

  it('shows when readonly turns off over a selection, and hides when it turns back on, focus returning to the content', async () => {
    const { host, editor, content, select, settle } = await createBubbleHost(
      (h) => h.readonly.set(true),
    );
    content.focus();
    await select(1, 6);
    expect(shown()).toBe(false);

    host.readonly.set(false);
    await settle();
    expect(shown()).toBe(true);
    press(content, 'F10', { altKey: true });
    await settle();
    expect(bubble()?.contains(document.activeElement)).toBe(true);

    host.readonly.set(true);
    await settle();
    expect(shown()).toBe(false);
    expect(document.activeElement).toBe(content);
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.selection.to).toBe(6);
  });

  it('closes a popup the bubble opened when readonly turns on, focus returning from it to the content', async () => {
    const { host, content, select, settle } = await createBubbleHost();
    content.focus();
    await select(1, 6);
    expect(shown()).toBe(true);
    // The zoom popup stays usable while readonly, so only the bubble can
    // close it here.
    const trigger = bubble()?.querySelector<HTMLButtonElement>(
      '.mlv-editor-zoom button[aria-haspopup="dialog"]',
    );
    if (!trigger) throw new Error('Expected the zoom popup trigger.');
    trigger.focus();
    trigger.click();
    await settle();
    const popup = document.activeElement?.closest('.mlv-popup');
    expect(popup).not.toBeNull();
    expect(bubble()?.contains(popup ?? null)).toBe(false);

    host.readonly.set(true);
    await settle();
    expect(shown()).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(content);
  });

  it('summons the bubble at a bare caret with Alt+F10 and focuses its first control', async () => {
    const { editor, content, select, settle } = await createBubbleHost();
    content.focus();
    await select(3);
    const coords = stubSelectionRect(editor, {
      top: 300,
      bottom: 316,
      left: 120,
      right: 120,
    });
    expect(shown()).toBe(false);

    const summon = press(content, 'F10', { altKey: true });
    await settle();
    expect(summon.defaultPrevented).toBe(true);
    expect(shown()).toBe(true);
    const toolbar = bubble()?.querySelector('[role="toolbar"]');
    const first = [
      ...(toolbar?.querySelectorAll<HTMLElement>('button') ?? []),
    ].find(
      (button) =>
        !button.disabled &&
        button.getAttribute('aria-disabled') !== 'true' &&
        !button.closest('[hidden]'),
    );
    expect(first).toBeDefined();
    expect(document.activeElement).toBe(first);
    // Anchored at the caret.
    expect(coords).toHaveBeenCalledWith(3);
    expect(editor.state.selection.empty).toBe(true);
  });

  it('returns focus to the content on Escape from the bubble, with the selection intact', async () => {
    const { editor, content, select, settle } = await createBubbleHost();
    content.focus();
    await select(1, 6);
    press(content, 'F10', { altKey: true });
    await settle();
    const focused = document.activeElement as HTMLElement;
    expect(bubble()?.contains(focused)).toBe(true);

    press(focused, 'Escape');
    await settle();
    expect(document.activeElement).toBe(content);
    expect(shown()).toBe(false);
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.selection.to).toBe(6);
  });

  it('keeps focus in the editor on Tab from the bubble instead of leaving for the end of the document', async () => {
    const { content, select, settle } = await createBubbleHost();
    content.focus();
    await select(1, 6);
    press(content, 'F10', { altKey: true });
    await settle();
    const tab = press(document.activeElement as HTMLElement, 'Tab');
    await settle();
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(content);
    // The selection is still there, so the bubble stays.
    expect(shown()).toBe(true);
  });

  it('hides a summoned bubble again when focus returns to a bare caret', async () => {
    const { content, select, settle } = await createBubbleHost();
    content.focus();
    await select(2);
    press(content, 'F10', { altKey: true });
    await settle();
    expect(shown()).toBe(true);
    press(document.activeElement as HTMLElement, 'Tab');
    await settle();
    expect(document.activeElement).toBe(content);
    expect(shown()).toBe(false);
  });

  it('hides during IME composition and a drag, and while a pointer is still selecting', async () => {
    const { content, select, settle } = await createBubbleHost();
    content.focus();
    await select(1, 6);
    expect(shown()).toBe(true);

    content.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true }),
    );
    await settle();
    expect(shown()).toBe(false);
    content.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true }),
    );
    await settle();
    expect(shown()).toBe(true);

    content.dispatchEvent(new Event('dragstart', { bubbles: true }));
    await settle();
    expect(shown()).toBe(false);
    document.dispatchEvent(new Event('dragend', { bubbles: true }));
    await settle();
    expect(shown()).toBe(true);

    // jsdom has no PointerEvent constructor; the handler reads `button`.
    content.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, button: 0 }),
    );
    await settle();
    expect(shown()).toBe(false);
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    await settle();
    expect(shown()).toBe(true);
  });

  it('hides while disabled', async () => {
    const { host, content, select, settle } = await createBubbleHost();
    content.focus();
    await select(1, 6);
    expect(shown()).toBe(true);
    host.disabled.set(true);
    await settle();
    expect(shown()).toBe(false);
  });

  it('prefers above the selection whatever toolbarPosition and toolbarSticky say', async () => {
    const { host, root, editor, content, select, settle } =
      await createBubbleHost();
    stubLayoutViewport();
    host.position.set('bottom');
    host.sticky.set(true);
    await settle();
    const editorHost = root.querySelector('mlv-editor') as HTMLElement;
    // Sticky is a docked-bar behaviour; it does nothing to the bubble.
    expect(editorHost.classList).not.toContain('mlv-editor--toolbar-sticky');
    expect(root.querySelector('.mlv-editor__toolbar-band')).toBeNull();

    stubSelectionRect(editor, { top: 300, bottom: 316, left: 40, right: 90 });
    content.focus();
    await select(1, 6);
    expect(shown()).toBe(true);
    expect(bubble()?.classList).not.toContain('mlv-editor-bubble--below');
  });

  it('flips below at a capped scroller’s top edge and follows the selection as it scrolls', async () => {
    const { editor, content, viewport, select, settle } =
      await createBubbleHost((host) => host.maxHeight.set(240));
    stubLayoutViewport();
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 100, 600, 240),
    );
    const pane = bubble() as HTMLElement;
    vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 300, 44),
    );
    const coords = stubSelectionRect(editor, {
      top: 110,
      bottom: 126,
      left: 40,
      right: 90,
    });
    content.focus();
    await select(1, 6);
    expect(shown()).toBe(true);
    expect(pane.classList).toContain('mlv-editor-bubble--below');

    // The viewport scrolls the selection down: there is room above again.
    coords.mockReturnValue({ top: 260, bottom: 276, left: 40, right: 90 });
    viewport.dispatchEvent(new Event('scroll'));
    await settle();
    expect(shown()).toBe(true);
    expect(pane.classList).not.toContain('mlv-editor-bubble--below');

    // Scrolled out of the viewport: hidden, focus untouched.
    coords.mockReturnValue({ top: 400, bottom: 416, left: 40, right: 90 });
    viewport.dispatchEvent(new Event('scroll'));
    await settle();
    expect(shown()).toBe(false);
    expect(document.activeElement).toBe(content);

    coords.mockReturnValue({ top: 200, bottom: 216, left: 40, right: 90 });
    viewport.dispatchEvent(new Event('scroll'));
    await settle();
    expect(shown()).toBe(true);
  });

  it('mirrors under a scoped [dir="rtl"] while the document stays LTR, and follows a flip while open', async () => {
    const { fixture, host, content, select, settle } = await createBubbleHost(
      (h) => h.dir.set('rtl'),
    );
    const rtl = TestBed.inject(MlvRtlService);
    expect(rtl.direction()).toBe('ltr');
    content.focus();
    await select(1, 6);
    expect(shown()).toBe(true);
    const pane = bubble() as HTMLElement;
    expect(pane.closest('[dir]')?.getAttribute('dir')).toBe('rtl');

    // The toolbar inside the pane reads the pane's direction: ArrowLeft is
    // "next" in RTL.
    press(content, 'F10', { altKey: true });
    await settle();
    const toolbar = pane.querySelector('[role="toolbar"]') as HTMLElement;
    const enabled = [...toolbar.querySelectorAll<HTMLElement>('button')].filter(
      (button) =>
        !(button as HTMLButtonElement).disabled &&
        button.getAttribute('aria-disabled') !== 'true' &&
        !button.closest('[hidden]'),
    );
    expect(document.activeElement).toBe(enabled[0]);
    press(enabled[0], 'ArrowLeft');
    expect(document.activeElement).toBe(enabled[1]);

    host.dir.set('ltr');
    fixture.detectChanges();
    await settle();
    expect(pane.closest('[dir]')?.getAttribute('dir')).toBe('ltr');
  });

  it('has no axe violations with the bubble open', async () => {
    const { root, content, select } = await createBubbleHost();
    content.focus();
    await select(1, 6);
    expect(shown()).toBe(true);
    await expectNoAxeViolations(root);
    await expectNoAxeViolations(
      document.querySelector('.cdk-overlay-container') as HTMLElement,
    );
  });

  it('keeps the docked bar and creates no bubble for toolbarAppearance="bar"', async () => {
    const { root, content, select } = await createBubbleHost((host) =>
      host.appearance.set('bar'),
    );
    content.focus();
    await select(1, 6);
    expect(
      root.querySelector('.mlv-editor__toolbar-band [role="toolbar"]'),
    ).not.toBeNull();
    expect(bubble()).toBeNull();
  });

  it('keeps the caret on a press on the bubble itself, but lets its controls take focus', async () => {
    const { content, select } = await createBubbleHost();
    content.focus();
    await select(1, 6);
    const pane = bubble() as HTMLElement;
    const mousedown = (target: Element) => {
      const event = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      return event;
    };

    expect(mousedown(pane).defaultPrevented).toBe(true);
    const button = pane.querySelector('button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(mousedown(button).defaultPrevented).toBe(false);
  });

  it('advertises Alt+F10 on the content only while the toolbar floats and the editor is editable', async () => {
    const { host, content, settle } = await createBubbleHost();
    expect(content.getAttribute('aria-keyshortcuts')).toBe('Alt+F10');

    host.appearance.set('bar');
    await settle();
    expect(content.hasAttribute('aria-keyshortcuts')).toBe(false);

    host.appearance.set('floating');
    await settle();
    expect(content.getAttribute('aria-keyshortcuts')).toBe('Alt+F10');

    host.readonly.set(true);
    await settle();
    expect(content.hasAttribute('aria-keyshortcuts')).toBe(false);

    host.readonly.set(false);
    await settle();
    expect(content.getAttribute('aria-keyshortcuts')).toBe('Alt+F10');

    host.disabled.set(true);
    await settle();
    expect(content.hasAttribute('aria-keyshortcuts')).toBe(false);
  });

  it('removes its key plugin when the toolbar docks, so bar-mode Escape and Alt+F10 pass through', async () => {
    const { host, editor, content, select, settle } = await createBubbleHost();
    const keyPlugins = () =>
      editor.state.plugins.filter((plugin) =>
        (plugin as unknown as { key: string }).key.startsWith(
          'mlvEditorBubbleKeys$',
        ),
      ).length;
    expect(keyPlugins()).toBe(1);
    content.focus();
    await select(1, 6);
    expect(shown()).toBe(true);

    // Docked while shown: nothing may keep claiming keys for the bubble.
    host.appearance.set('bar');
    await settle();
    expect(keyPlugins()).toBe(0);
    content.focus();
    const page = watchDocumentKeys();
    press(content, 'Escape');
    const summon = press(content, 'F10', { altKey: true });
    await settle();
    page.stop();
    expect(page.keys).toEqual(['Escape', 'F10']);
    expect(summon.defaultPrevented).toBe(false);

    for (let trip = 0; trip < 3; trip++) {
      host.appearance.set('floating');
      await settle();
      host.appearance.set('bar');
      await settle();
    }
    host.appearance.set('floating');
    await settle();
    expect(keyPlugins()).toBe(1);
    content.focus();
    await select(1, 7);
    expect(shown()).toBe(true);
    const dismiss = press(content, 'Escape');
    await settle();
    expect(dismiss.defaultPrevented).toBe(true);
    expect(shown()).toBe(false);
  });

  it('schedules no render for page scroll or resize at a bare caret, only while the bubble can show', async () => {
    const { fixture, content, select } = await createBubbleHost();
    content.focus();
    await select(2);
    let renders = 0;
    const counter = TestBed.runInInjectionContext(() =>
      afterEveryRender(() => renders++),
    );
    const layoutEvents = async () => {
      for (let index = 0; index < 5; index++) {
        document.dispatchEvent(new Event('scroll'));
      }
      window.dispatchEvent(new Event('resize'));
      await Promise.resolve();
      await fixture.whenStable();
    };

    // Registering a render hook schedules one render of its own.
    await fixture.whenStable();
    renders = 0;

    await layoutEvents();
    expect(renders).toBe(0);

    await select(1, 6);
    expect(shown()).toBe(true);
    renders = 0;
    await layoutEvents();
    expect(renders).toBeGreaterThan(0);
    counter.destroy();
  });
});

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      label="Dialog editor"
      value="<p>Alpha beta</p>"
      toolbarAppearance="floating"
    />
  `,
})
class DialogEditor {
  readonly editor = viewChild.required(MlvEditor);
}

describe('MlvEditor selection bubble inside a CDK dialog', () => {
  afterEach(() => TestBed.inject(Dialog).closeAll());

  async function openInDialog() {
    await TestBed.configureTestingModule({
      imports: [DialogEditor],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const dialog = TestBed.inject(Dialog);
    const appRef = TestBed.inject(ApplicationRef);
    const ref = dialog.open(DialogEditor);
    const settle = async () => {
      await Promise.resolve();
      await Promise.resolve();
      appRef.tick();
      await appRef.whenStable();
    };
    await settle();
    await settle();
    const editor = ref.componentInstance?.editor().editor();
    if (!editor) throw new Error('Expected a mounted Tiptap editor.');
    const content = editor.view.dom as HTMLElement;
    content.focus();
    editor.commands.setTextSelection({ from: 1, to: 6 });
    await settle();
    return { dialog, editor, content, settle };
  }

  it('closes the bubble on the first Escape in the content and the dialog on the second', async () => {
    const { dialog, content, settle } = await openInDialog();
    expect(shown()).toBe(true);

    press(content, 'Escape');
    await settle();
    expect(shown()).toBe(false);
    expect(dialog.openDialogs.length).toBe(1);

    press(content, 'Escape');
    await settle();
    expect(dialog.openDialogs.length).toBe(0);
  });

  it('keeps the dialog open on Escape from inside the bubble', async () => {
    const { dialog, content, settle } = await openInDialog();
    press(content, 'F10', { altKey: true });
    await settle();
    const focused = document.activeElement as HTMLElement;
    expect(bubble()?.contains(focused)).toBe(true);

    press(focused, 'Escape');
    await settle();
    expect(shown()).toBe(false);
    expect(document.activeElement).toBe(content);
    expect(dialog.openDialogs.length).toBe(1);
  });
});
