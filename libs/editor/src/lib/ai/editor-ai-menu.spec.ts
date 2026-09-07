import type { WritableSignal } from '@angular/core';
import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { By } from '@angular/platform-browser';
import { MLV_EDITOR_I18N, type MlvEditorI18n } from '@malva-ui/i18n';
import {
  i18nTestProvider,
  provideMlvI18nTesting,
} from '@malva-ui/i18n/testing';
import { vi } from 'vitest';
// The documented public surface: the menu must be reachable through the
// `@malva-ui/editor/ai` facade with the same identity the primary entry has.
import {
  MlvEditorAiMenu,
  mlvEditorAiDefaultActions,
} from '@malva-ui/editor/ai';
import type { MlvEditorError } from '../editor.types';
import { MlvEditor } from '../editor/editor';
import { MLV_EDITOR_AI_CONTEXT } from './editor-ai-context';
import type { MlvEditorAiContext } from './editor-ai-context';
import type {
  MlvEditorAiAction,
  MlvEditorAiProvider,
  MlvEditorAiRequest,
} from './editor-ai.types';

const TRANSFORM_ITEMS: readonly (readonly [string, string])[] = [
  ['Improve writing', 'improve'],
  ['Fix grammar', 'fix-grammar'],
  ['Shorten', 'shorten'],
  ['Extend', 'extend'],
  ['Summarize', 'summarize'],
  ['Change tone', 'tone'],
  ['Translate', 'translate'],
];

@Component({
  imports: [MlvEditor, MlvEditorAiMenu],
  template: `
    <mlv-editor
      [value]="value()"
      (valueChange)="value.set($event)"
      [aiProvider]="provider()"
      [readonly]="readonly()"
      [disabled]="disabled()"
      (editorError)="errors.push($event)"
      (blur)="blurs.update((count) => count + 1)"
    >
      <mlv-editor-ai-menu
        mlvEditorToolbarStart
        [actions]="actions()"
        [showCustomPrompt]="showCustomPrompt()"
      />
    </mlv-editor>
  `,
})
class AiMenuHost {
  readonly value = signal<string | null>('<p>Hello world</p>');
  readonly provider = signal<MlvEditorAiProvider | undefined>(undefined);
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly blurs = signal(0);
  readonly actions = signal<readonly MlvEditorAiAction[] | undefined>(
    undefined,
  );
  readonly showCustomPrompt = signal(true);
  readonly editor = viewChild.required(MlvEditor);
  readonly errors: MlvEditorError[] = [];
}

/** Records every request and streams the given chunks when unblocked. */
function createRecordingProvider(chunks: readonly string[] = ['Improved']) {
  const requests: MlvEditorAiRequest[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let gated = false;
  const provider: MlvEditorAiProvider = {
    async *stream(request) {
      requests.push(request);
      if (gated) await gate;
      yield* chunks;
    },
  };
  return {
    provider,
    requests,
    release,
    gate: () => {
      gated = true;
    },
  };
}

describe('MlvEditorAiMenu', () => {
  let fixture: ComponentFixture<AiMenuHost>;
  let overlayContainer: OverlayContainer;
  let editorCopy: WritableSignal<MlvEditorI18n>;

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve));
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiMenuHost],
      providers: [provideMlvI18nTesting(), i18nTestProvider(MLV_EDITOR_I18N)],
    }).compileComponents();
    fixture = TestBed.createComponent(AiMenuHost);
    overlayContainer = TestBed.inject(OverlayContainer);
    editorCopy = TestBed.inject(
      MLV_EDITOR_I18N,
    ) as WritableSignal<MlvEditorI18n>;
    document.body.appendChild(fixture.nativeElement);
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
    overlayContainer.ngOnDestroy();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function aiContext(): MlvEditorAiContext {
    return fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_AI_CONTEXT) as MlvEditorAiContext;
  }

  function menuHost(): HTMLElement {
    const host = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-editor-ai-menu',
    );
    if (!(host instanceof HTMLElement)) {
      throw new Error('Expected the AI menu host.');
    }
    return host;
  }

  function trigger(label: string): HTMLButtonElement {
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      `mlv-editor-ai-menu button[aria-label="${label}"]`,
    );
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Expected the "${label}" trigger.`);
    }
    return button;
  }

  function menuItems(): readonly HTMLElement[] {
    return [
      ...overlayContainer
        .getContainerElement()
        .querySelectorAll<HTMLElement>('[role="menu"] [role="menuitem"]'),
    ];
  }

  function menuItem(label: string): HTMLElement {
    const item = menuItems().find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!item) throw new Error(`Expected the "${label}" menu item.`);
    return item;
  }

  function promptPanel(): HTMLElement | null {
    return overlayContainer
      .getContainerElement()
      .querySelector<HTMLElement>('.mlv-editor-ai-menu__panel');
  }

  function panelButton(root: ParentNode, text: string): HTMLButtonElement {
    const button = [...root.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Expected button "${text}".`);
    }
    return button;
  }

  /**
   * The element's resolved accessible name, following `aria-labelledby` to the
   * elements it references and falling back to `aria-label`. Asserting the name
   * rather than one attribute keeps the assertion about what a screen reader
   * announces, so a control that renames itself through the other mechanism
   * stays covered instead of going red.
   */
  function accessibleName(element: Element | null): string | null {
    if (!element) {
      return null;
    }
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      return labelledBy
        .split(/\s+/)
        .filter(Boolean)
        .map(
          (id) => element.ownerDocument.getElementById(id)?.textContent ?? '',
        )
        .join(' ')
        .trim();
    }
    return element.getAttribute('aria-label');
  }

  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function completeClose(): Promise<void> {
    overlayContainer
      .getContainerElement()
      .querySelectorAll('.mlv-popup--leave')
      .forEach((panel) =>
        panel.dispatchEvent(new Event('animationend', { bubbles: true })),
      );
    await settle();
  }

  async function withProvider(chunks: readonly string[] = ['Improved']) {
    const source = createRecordingProvider(chunks);
    fixture.componentInstance.provider.set(source.provider);
    await settle();
    return source;
  }

  async function openMenu(): Promise<void> {
    trigger('AI assist').click();
    await settle();
  }

  async function closeMenu(): Promise<void> {
    const item = menuItems()[0];
    item?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    await completeClose();
  }

  it('hides entirely without a provider and appears when one arrives', async () => {
    expect(aiContext().hasProvider()).toBe(false);
    expect(menuHost().hasAttribute('hidden')).toBe(true);

    await withProvider();

    expect(aiContext().hasProvider()).toBe(true);
    expect(menuHost().hasAttribute('hidden')).toBe(false);
  });

  it('opens a labelled menu with all eight transform items in order', async () => {
    await withProvider();
    await openMenu();

    const panel = overlayContainer
      .getContainerElement()
      .querySelector('[role="menu"]');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('aria-label')).toBe('AI assist');
    expect(menuItems().map((item) => item.textContent?.trim())).toEqual([
      ...TRANSFORM_ITEMS.map(([label]) => label),
      'Custom prompt',
    ]);
    expect(fixture.componentInstance.blurs()).toBe(0);
    await closeMenu();
  });

  it('runs each plain kind with the replace-selection output mode', async () => {
    await withProvider();
    const run = vi
      .spyOn(aiContext(), 'runTransform')
      .mockResolvedValue(undefined);

    for (const [label, kind] of TRANSFORM_ITEMS) {
      await openMenu();
      menuItem(label).click();
      await settle();
      expect(run).toHaveBeenLastCalledWith(kind, {
        output: 'replace-selection',
      });
      await completeClose();
    }
    expect(run).toHaveBeenCalledTimes(TRANSFORM_ITEMS.length);
  });

  it('disables items while a transform is running and while readonly or disabled', async () => {
    const source = await withProvider(['Never lands']);
    source.gate();
    await openMenu();

    expect(
      menuItems().every(
        (item) => item.getAttribute('aria-disabled') !== 'true',
      ),
    ).toBe(true);

    void aiContext().runTransform('improve');
    await settle();
    expect(
      menuItems().every(
        (item) => item.getAttribute('aria-disabled') === 'true',
      ),
    ).toBe(true);

    aiContext().cancel();
    source.release();
    await new Promise((resolve) => setTimeout(resolve));
    await settle();
    expect(
      menuItems().every(
        (item) => item.getAttribute('aria-disabled') !== 'true',
      ),
    ).toBe(true);

    fixture.componentInstance.readonly.set(true);
    await settle();
    expect(
      menuItems().every(
        (item) => item.getAttribute('aria-disabled') === 'true',
      ),
    ).toBe(true);
    expect(trigger('AI assist').disabled).toBe(true);

    fixture.componentInstance.readonly.set(false);
    fixture.componentInstance.disabled.set(true);
    await settle();
    expect(trigger('AI assist').disabled).toBe(true);

    fixture.componentInstance.disabled.set(false);
    await settle();
    await closeMenu();
  });

  it('opens the custom prompt, focuses the instruction, and applies the drafted transform', async () => {
    await withProvider();
    const run = vi
      .spyOn(aiContext(), 'runTransform')
      .mockResolvedValue(undefined);

    await openMenu();
    menuItem('Custom prompt').click();
    await settle();
    await completeClose();

    const panel = promptPanel();
    expect(panel).not.toBeNull();
    if (!panel) return;
    const dialog = panel.closest('[role="dialog"]');
    expect(dialog?.getAttribute('aria-label')).toBe('Custom prompt');

    const instruction = panel.querySelector('input');
    if (!(instruction instanceof HTMLInputElement)) {
      throw new Error('Expected the instruction input.');
    }
    expect(document.activeElement).toBe(instruction);
    expect(fixture.componentInstance.blurs()).toBe(0);

    const apply = panelButton(panel, 'Apply');
    expect(apply.disabled).toBe(true);
    type(instruction, 'Make it rhyme');
    await settle();
    expect(apply.disabled).toBe(false);

    // The output-mode choice must be a *named* radiogroup: without an
    // accessible name a screen-reader user lands on two bare radios with no
    // indication of what the choice is about. The name is asserted, not the
    // mechanism: `mlv-radio-group` names itself through `aria-labelledby`
    // pointing at its own visible `<mlv-label>` when it has one (this menu
    // passes `[label]`), and falls back to `aria-label` when it does not - see
    // `docs/migrations/2026-09-form-field-label-association.md`.
    const outputGroup = panel.querySelector('[role="radiogroup"]');
    expect(accessibleName(outputGroup)).toBe('Output');

    const radios = [
      ...panel.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ];
    expect(radios).toHaveLength(3);
    radios[1].click();
    await settle();

    apply.click();
    await settle();
    expect(run).toHaveBeenCalledExactlyOnceWith('custom', {
      instruction: 'Make it rhyme',
      output: 'insert-below',
    });

    await completeClose();
    expect(promptPanel()).toBeNull();
    expect(document.activeElement).toBe(trigger('AI assist'));
    expect(fixture.componentInstance.blurs()).toBe(0);
  });

  it('offers the review output mode and dispatches the custom transform with it', async () => {
    await withProvider();
    const run = vi
      .spyOn(aiContext(), 'runTransform')
      .mockResolvedValue(undefined);

    await openMenu();
    menuItem('Custom prompt').click();
    await settle();
    await completeClose();
    const panel = promptPanel();
    if (!panel) throw new Error('Expected the prompt panel.');

    // The third output-mode radio is the labelled review option.
    const reviewRadio = [
      ...panel.querySelectorAll<HTMLElement>('mlv-radio'),
    ].find((radio) => radio.textContent?.trim() === 'Review changes');
    expect(reviewRadio).not.toBeUndefined();
    reviewRadio
      ?.querySelector<HTMLInputElement>('input[type="radio"]')
      ?.click();
    await settle();

    const instruction = panel.querySelector('input');
    if (!(instruction instanceof HTMLInputElement)) {
      throw new Error('Expected the instruction input.');
    }
    type(instruction, 'Tighten the copy');
    await settle();
    panelButton(panel, 'Apply').click();
    await settle();

    expect(run).toHaveBeenCalledExactlyOnceWith('custom', {
      instruction: 'Tighten the copy',
      output: 'review',
    });
    await completeClose();
    expect(promptPanel()).toBeNull();
  });

  it('closes the prompt on Escape and on cancel without running a transform', async () => {
    await withProvider();
    const run = vi
      .spyOn(aiContext(), 'runTransform')
      .mockResolvedValue(undefined);

    await openMenu();
    menuItem('Custom prompt').click();
    await settle();
    await completeClose();
    let panel = promptPanel();
    if (!panel) throw new Error('Expected the prompt panel.');

    panel.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    await completeClose();
    expect(promptPanel()).toBeNull();
    expect(document.activeElement).toBe(trigger('AI assist'));

    await openMenu();
    menuItem('Custom prompt').click();
    await settle();
    await completeClose();
    panel = promptPanel();
    if (!panel) throw new Error('Expected the reopened prompt panel.');
    panelButton(panel, 'Cancel').click();
    await settle();
    await completeClose();
    expect(promptPanel()).toBeNull();
    expect(document.activeElement).toBe(trigger('AI assist'));
    expect(run).not.toHaveBeenCalled();
    expect(fixture.componentInstance.blurs()).toBe(0);
  });

  it('swaps the trigger to a stop affordance that cancels the running transform', async () => {
    const source = await withProvider(['Never lands']);
    source.gate();

    await openMenu();
    menuItem('Improve writing').click();
    await settle();

    expect(aiContext().status()).toBe('running');
    const stop = trigger('Cancel');
    expect(stop.disabled).toBe(false);
    await completeClose();

    stop.click();
    await settle();
    expect(source.requests[0]?.signal.aborted).toBe(true);
    expect(
      overlayContainer.getContainerElement().querySelector('[role="menu"]'),
    ).toBeNull();

    source.release();
    await new Promise((resolve) => setTimeout(resolve));
    await settle();
    expect(aiContext().status()).toBe('idle');
    expect(trigger('AI assist')).toBeInstanceOf(HTMLButtonElement);
    expect(fixture.componentInstance.errors).toEqual([]);
  });

  it('registers the trigger with the editor roving-focus registry as one tab stop', async () => {
    await withProvider();
    await new Promise((resolve) => setTimeout(resolve));
    await settle();

    const toolbar = (fixture.nativeElement as HTMLElement).querySelector(
      '[role="toolbar"]',
    );
    if (!(toolbar instanceof HTMLElement)) {
      throw new Error('Expected the editor toolbar.');
    }
    const aiTrigger = trigger('AI assist');
    expect(toolbar.contains(aiTrigger)).toBe(true);
    expect(['0', '-1']).toContain(aiTrigger.getAttribute('tabindex'));

    const visibleEnabled = [...toolbar.querySelectorAll('button')].filter(
      (button) => !button.disabled && !button.closest('[hidden]'),
    );
    expect(
      visibleEnabled.filter(
        (button) => button.getAttribute('tabindex') === '0',
      ),
    ).toHaveLength(1);

    aiTrigger.focus();
    await settle();
    expect(aiTrigger.getAttribute('tabindex')).toBe('0');

    aiTrigger.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    expect(document.activeElement).not.toBe(aiTrigger);
    expect(aiTrigger.getAttribute('tabindex')).toBe('-1');
  });

  it('reacts to editor i18n changes on the trigger, items, and prompt copy', async () => {
    await withProvider();
    editorCopy.update((copy) => ({
      ...copy,
      aiMenu: 'Assistant IA',
      aiImprove: 'Améliorer',
      aiCustom: 'Instruction libre',
    }));
    await settle();

    const localizedTrigger = trigger('Assistant IA');
    expect(localizedTrigger).toBeInstanceOf(HTMLButtonElement);
    localizedTrigger.click();
    await settle();
    expect(menuItem('Améliorer')).toBeInstanceOf(HTMLElement);
    expect(menuItem('Instruction libre')).toBeInstanceOf(HTMLElement);

    await closeMenu();
    expect(
      overlayContainer.getContainerElement().querySelector('[role="menu"]'),
    ).toBeNull();
  });

  describe('host-owned action list', () => {
    async function withActions(
      actions: readonly MlvEditorAiAction[],
    ): Promise<void> {
      fixture.componentInstance.actions.set(actions);
      await settle();
    }

    it('renders exactly the localized defaults when no list is supplied', async () => {
      await withProvider();
      editorCopy.update((copy) => ({ ...copy, aiShorten: 'Kürzen' }));
      await settle();
      await openMenu();

      // The factory is the single source of the built-in label table: the
      // default menu must be its output, plus the custom-prompt item.
      const defaults = mlvEditorAiDefaultActions(editorCopy());
      expect(menuItems().map((item) => item.textContent?.trim())).toEqual([
        ...defaults.map((action) => action.label),
        'Custom prompt',
      ]);
      expect(defaults.map((action) => action.label)).toContain('Kürzen');
      await closeMenu();
    });

    it('replaces the built-in list literally rather than merging', async () => {
      await withProvider();
      await withActions([
        { kind: 'improve', label: 'Polish it' },
        { kind: 'legal-review', label: 'Legal review' },
      ]);
      await openMenu();

      expect(menuItems().map((item) => item.textContent?.trim())).toEqual([
        'Polish it',
        'Legal review',
        'Custom prompt',
      ]);
      for (const [label] of TRANSFORM_ITEMS) {
        expect(
          menuItems().some((item) => item.textContent?.trim() === label),
        ).toBe(false);
      }
      await closeMenu();
    });

    it('forwards a host kind, instruction, and output mode verbatim', async () => {
      await withProvider();
      await withActions([
        {
          kind: 'legal-review',
          label: 'Legal review',
          instruction: 'German contract law',
          output: 'review',
        },
      ]);
      const run = vi
        .spyOn(aiContext(), 'runTransform')
        .mockResolvedValue(undefined);

      await openMenu();
      menuItem('Legal review').click();
      await settle();

      expect(run).toHaveBeenCalledExactlyOnceWith('legal-review', {
        instruction: 'German contract law',
        output: 'review',
      });
      await completeClose();
    });

    it('defaults an action without an output mode to replace-selection', async () => {
      await withProvider();
      await withActions([{ kind: 'improve', label: 'Polish it' }]);
      const run = vi
        .spyOn(aiContext(), 'runTransform')
        .mockResolvedValue(undefined);

      await openMenu();
      menuItem('Polish it').click();
      await settle();

      expect(run).toHaveBeenCalledExactlyOnceWith('improve', {
        output: 'replace-selection',
      });
      await completeClose();
    });

    it('calls an action run callback with the context instead of runTransform', async () => {
      await withProvider();
      const received: MlvEditorAiContext[] = [];
      await withActions([
        {
          kind: 'ignored-when-run-is-present',
          label: 'Own behaviour',
          instruction: 'also ignored',
          output: 'insert-below',
          run: (context) => received.push(context),
        },
      ]);
      const run = vi
        .spyOn(aiContext(), 'runTransform')
        .mockResolvedValue(undefined);

      await openMenu();
      menuItem('Own behaviour').click();
      await settle();

      expect(received).toEqual([aiContext()]);
      expect(received[0].hasProvider()).toBe(true);
      expect(run).not.toHaveBeenCalled();
      await completeClose();
    });

    it('renders every entry of a list that repeats a kind', async () => {
      await withProvider();
      await withActions([
        { kind: 'translate', label: 'Translate to German', instruction: 'de' },
        { kind: 'translate', label: 'Translate to French', instruction: 'fr' },
      ]);
      const run = vi
        .spyOn(aiContext(), 'runTransform')
        .mockResolvedValue(undefined);

      await openMenu();
      expect(menuItems().map((item) => item.textContent?.trim())).toEqual([
        'Translate to German',
        'Translate to French',
        'Custom prompt',
      ]);

      menuItem('Translate to French').click();
      await settle();
      expect(run).toHaveBeenCalledExactlyOnceWith('translate', {
        instruction: 'fr',
        output: 'replace-selection',
      });
      await completeClose();
    });

    it('drops the custom-prompt item and its popup when disabled', async () => {
      await withProvider();
      await withActions([{ kind: 'improve', label: 'Polish it' }]);
      // `mlv-menu` renders an `mlv-popup` of its own, so the prompt popup is
      // identified through its own anchor container.
      expect(
        menuHost().querySelector('.mlv-editor-ai-menu__anchor mlv-popup'),
      ).not.toBeNull();

      fixture.componentInstance.showCustomPrompt.set(false);
      await settle();

      // The popup is gone from the view, so nothing can open it and its
      // composite-overlay registration never happens.
      expect(
        menuHost().querySelector('.mlv-editor-ai-menu__anchor'),
      ).toBeNull();
      expect(menuHost().querySelector('mlv-popup-container')).toBeNull();
      expect(promptPanel()).toBeNull();

      const run = vi
        .spyOn(aiContext(), 'runTransform')
        .mockResolvedValue(undefined);
      await openMenu();
      expect(menuItems().map((item) => item.textContent?.trim())).toEqual([
        'Polish it',
      ]);

      // The remaining action still runs, and the trigger still works.
      menuItem('Polish it').click();
      await settle();
      expect(run).toHaveBeenCalledExactlyOnceWith('improve', {
        output: 'replace-selection',
      });
      await completeClose();
      expect(promptPanel()).toBeNull();
    });

    it('applies the executability guards to host actions and run callbacks', async () => {
      const source = await withProvider(['Never lands']);
      source.gate();
      const runs: string[] = [];
      await withActions([
        { kind: 'improve', label: 'Polish it' },
        { kind: 'own', label: 'Own behaviour', run: () => runs.push('own') },
      ]);

      await openMenu();
      expect(
        menuItems().every(
          (item) => item.getAttribute('aria-disabled') !== 'true',
        ),
      ).toBe(true);

      void aiContext().runTransform('improve');
      await settle();
      expect(
        menuItems().every(
          (item) => item.getAttribute('aria-disabled') === 'true',
        ),
      ).toBe(true);
      menuItem('Own behaviour').click();
      await settle();
      expect(runs).toEqual([]);

      aiContext().cancel();
      source.release();
      await new Promise((resolve) => setTimeout(resolve));
      await settle();

      fixture.componentInstance.readonly.set(true);
      await settle();
      expect(
        menuItems().every(
          (item) => item.getAttribute('aria-disabled') === 'true',
        ),
      ).toBe(true);
      expect(trigger('AI assist').disabled).toBe(true);
      menuItem('Own behaviour').click();
      await settle();
      expect(runs).toEqual([]);

      fixture.componentInstance.readonly.set(false);
      fixture.componentInstance.disabled.set(true);
      await settle();
      expect(trigger('AI assist').disabled).toBe(true);

      fixture.componentInstance.disabled.set(false);
      await settle();
      menuItem('Own behaviour').click();
      await settle();
      expect(runs).toEqual(['own']);
      await completeClose();
    });
  });
});
