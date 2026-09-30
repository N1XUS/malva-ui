import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { POPUP_LEAVE_FALLBACK_MS } from '@malva-ui/core/popup';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { vi } from 'vitest';
import { MlvEditor } from '../editor/editor';
import type { MlvEditorToolbarAppearance } from '../editor.types';
import { MLV_EDITOR_AI_CONTEXT } from './editor-ai-context';
import type { MlvEditorAiContext } from './editor-ai-context';
import {
  MLV_EDITOR_AI_PROMPT,
  mlvEditorAiPromptDelegate,
} from './editor-ai-prompt';
import type { MlvEditorAiPromptHost } from './editor-ai-prompt';
import type { MlvEditorAiProvider } from './editor-ai.types';

/** A provider held at its first chunk until released. */
function createGatedProvider() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const provider: MlvEditorAiProvider = {
    async *stream() {
      await gate;
      yield 'Answer';
    },
  };
  return { provider, release };
}

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      label="Prompt"
      value="<p>Hello world</p>"
      [aiProvider]="provider()"
      [readonly]="readonly()"
      [toolbarAppearance]="appearance()"
    />
  `,
})
class PromptHost {
  readonly provider = signal<MlvEditorAiProvider | undefined>(
    createGatedProvider().provider,
  );
  readonly readonly = signal(false);
  readonly appearance = signal<MlvEditorToolbarAppearance>('clean');
  readonly editor = viewChild.required(MlvEditor);
}

const ANCHOR = new DOMRect(40, 60, 120, 20);

describe('MlvEditorAiPrompt (#516)', () => {
  let fixture: ComponentFixture<PromptHost>;

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i += 1) {
      await Promise.resolve();
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  function injected<T>(token: { toString(): string }): T {
    return fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(token as never) as T;
  }

  const prompt = () => injected<MlvEditorAiPromptHost>(MLV_EDITOR_AI_PROMPT);
  const ai = () => injected<MlvEditorAiContext>(MLV_EDITOR_AI_CONTEXT);
  const panel = () =>
    document.querySelector<HTMLElement>('.mlv-editor-ai-menu__panel');
  const field = () => panel()?.querySelector('input') as HTMLInputElement;
  const content = () =>
    (fixture.nativeElement as HTMLElement).querySelector(
      '.ProseMirror',
    ) as HTMLElement;

  function actionButton(label: string): HTMLButtonElement {
    const found = [
      ...(panel()?.querySelectorAll<HTMLButtonElement>(
        '.mlv-editor-ai-menu__actions button',
      ) ?? []),
    ].find((button) => button.textContent?.trim() === label);
    if (!found) throw new Error(`No "${label}" action.`);
    return found;
  }

  async function type(text: string): Promise<void> {
    field().value = text;
    field().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  /** Waits out the popup's leave (no `animationend` under jsdom). */
  async function leave(): Promise<void> {
    await new Promise((resolve) =>
      setTimeout(resolve, POPUP_LEAVE_FALLBACK_MS + 50),
    );
    await settle();
  }

  async function open(output?: 'insert-below'): Promise<void> {
    content().focus();
    prompt().open({ anchor: ANCHOR, output });
    await settle();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromptHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(PromptHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    await settle();
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve));
    vi.restoreAllMocks();
  });

  it('opens from MLV_EDITOR_AI_PROMPT as a named modal dialog anchored to the request and focuses its field', async () => {
    await open('insert-below');
    expect(prompt().isOpen()).toBe(true);
    const dialog = panel()?.closest('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Custom prompt');
    const anchor = document.querySelector<HTMLElement>(
      '.mlv-editor-ai-prompt__anchor',
    ) as HTMLElement;
    expect(anchor.style.left).toBe('40px');
    expect(anchor.style.top).toBe('60px');
    expect(anchor.style.width).toBe('120px');
    expect(document.activeElement).toBe(field());
  });

  it('hides the output choice for a fixed output and applies the custom transform with it', async () => {
    const run = vi.spyOn(ai(), 'runTransform').mockResolvedValue();
    await open('insert-below');
    expect(panel()?.querySelector('.mlv-editor-ai-menu__output')).toBeNull();
    await type('  Make it formal ');
    actionButton('Apply').click();
    await settle();
    expect(run).toHaveBeenCalledWith('custom', {
      instruction: 'Make it formal',
      output: 'insert-below',
    });
    expect(prompt().isOpen()).toBe(false);
  });

  it('offers the output choice when the request fixes none', async () => {
    const run = vi.spyOn(ai(), 'runTransform').mockResolvedValue();
    await open();
    expect(
      panel()?.querySelector('.mlv-editor-ai-menu__output'),
    ).not.toBeNull();
    await type('Summarize');
    field().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    await settle();
    expect(run).toHaveBeenCalledWith('custom', {
      instruction: 'Summarize',
      output: 'replace-selection',
    });
  });

  it('blocks Apply and Enter while a transform cannot start', async () => {
    void ai().runTransform('improve');
    await settle();
    const run = vi.spyOn(ai(), 'runTransform');
    await open('insert-below');
    await type('Anything');
    expect(actionButton('Apply').disabled).toBe(true);
    field().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    await settle();
    expect(run).not.toHaveBeenCalled();
    expect(prompt().isOpen()).toBe(true);
    ai().cancel();
  });

  it('returns focus to the content on Cancel', async () => {
    await open('insert-below');
    actionButton('Cancel').click();
    await settle();
    expect(prompt().isOpen()).toBe(false);
    await leave();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(content());
  });

  it('closes when the editor turns readonly', async () => {
    await open('insert-below');
    fixture.componentInstance.readonly.set(true);
    await settle();
    expect(prompt().isOpen()).toBe(false);
    await leave();
    expect(panel()).toBeNull();
  });

  it.each(['bar', 'floating'] as const)(
    'does nothing in the %s appearance',
    async (appearance) => {
      fixture.componentInstance.appearance.set(appearance);
      await settle();
      await open('insert-below');
      expect(prompt().isOpen()).toBe(false);
      expect(panel()).toBeNull();
    },
  );

  it('has no axe violations while open', async () => {
    await open();
    await expectNoAxeViolations(document.body);
  });
});

describe('mlvEditorAiPromptDelegate (#516)', () => {
  it('forwards to the host rendered now and does nothing without one', () => {
    const isOpen = signal(false);
    const opened: unknown[] = [];
    const current = signal<MlvEditorAiPromptHost | undefined>(undefined);
    const delegate = mlvEditorAiPromptDelegate(() => current());

    delegate.open({ anchor: ANCHOR });
    expect(delegate.isOpen()).toBe(false);

    current.set({ open: (request) => opened.push(request), isOpen });
    delegate.open({ anchor: ANCHOR, output: 'insert-below' });
    expect(opened).toEqual([{ anchor: ANCHOR, output: 'insert-below' }]);
    isOpen.set(true);
    expect(delegate.isOpen()).toBe(true);

    current.set(undefined);
    expect(delegate.isOpen()).toBe(false);
  });
});
